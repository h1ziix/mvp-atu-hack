import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { PhotoPreviewWithScanner } from "@/components/photo-scanner";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Group,
  ListRow,
  Icon,
  Notice,
  Row,
  Screen,
  Sheet,
  Txt,
  useConfirm,
} from "@/components/ui";
import { preparePhoto } from "@/lib/photo";
import { SmartError } from "@/components/smart-error";
import {
  recognizePhoto,
  recognizePhrase,
  smartConfigured,
  translateWaste,
} from "@/lib/smart-input";
import type { Recognition } from "@/lib/smart-types";
import { NativePicker } from "@/components/native-picker";
import { DatePicker } from "@/components/date-picker";
import { WorkspaceGate } from "@/components/workspace";
import { useApp } from "@/providers/app-provider";
import { readJSON, removeJSON, writeJSON } from "@/lib/storage";
import { backendConfigured } from "@/lib/supabase";
import { canRecognizeSpeech, recognizeSpeech } from "@/lib/voice";
import type {
  CatalogItem,
  Category,
  Draft,
  Recyclability,
  Unit,
  Workspace,
} from "@/lib/types";
import { colors, radius, spacing, typography } from "@/theme";
import {
  decimal,
  editable,
  isDuplicate,
  localDate,
  number,
  parseVoice,
  totals,
  validateDraft,
} from "@/utils/domain";

export default function EntryScreen() {
  const { user, workspace } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!user) return null;
  return (
    <WorkspaceGate>
      {workspace && (
        <EntryForm
          key={`${workspace.report.id}-${id ?? "new"}`}
          initialWorkspace={workspace}
          id={id}
        />
      )}
    </WorkspaceGate>
  );
}
function EntryForm({
  initialWorkspace,
  id,
}: {
  initialWorkspace: Workspace;
  id?: string;
}) {
  const {
    user,
    workspace: current,
    language,
    t,
    busy,
    save,
    remove,
    addWaste,
    offline,
    refresh,
  } = useApp();
  const w = current ?? initialWorkspace;
  const existing = initialWorkspace.records.find((r) => r.id === id);
  const first = initialWorkspace.catalog[0];
  const defaultDate = localDate().startsWith(w.report.period_month)
    ? localDate()
    : `${w.report.period_month}-01`;
  const [draft, setDraft] = useState<Draft>(() =>
    existing
      ? {
          record_date: existing.record_date,
          waste_type_id: existing.waste_type_id,
          amount: String(existing.amount),
          disposal_method_id: existing.disposal_method_id,
          photo_url: existing.photo_url,
          ai_recognized: existing.ai_recognized,
        }
      : {
          record_date: defaultDate,
          waste_type_id: first?.waste_type_id ?? "",
          amount: "",
          disposal_method_id: first?.recommended_method_id ?? "",
          photo_url: null,
          ai_recognized: false,
        },
  );
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [translatedName, setTranslatedName] = useState("");
  const [category, setCategory] = useState<Category>("organic");
  const [unit, setUnit] = useState<Unit>("kg");
  const [recyclable, setRecyclable] = useState<Recyclability>("yes");
  const [newError, setNewError] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [voiceError, setVoiceError] = useState(false);
  const [listening, setListening] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [photoNote, setPhotoNote] = useState("");
  const [smartError, setSmartError] = useState<string | null>(null);
  const [voiceAiError, setVoiceAiError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [aiBusy, setAiBusy] = useState<"photo" | "voice" | null>(null);
  const [photoRecognition, setPhotoRecognition] = useState<Recognition | null>(
    null,
  );
  const [newRecognition, setNewRecognition] = useState<Recognition | null>(
    null,
  );
  const smartAbort = useRef<AbortController | null>(null);
  const storageQueue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  const draftRef = useRef(draft);
  const { confirm, dialog } = useConfirm();
  const draftKey = `draft:v1:${backendConfigured ? "remote" : "demo"}:${user!.organization_id}:${w.report.period_month}:${id ?? "new"}`;
  const item = w.catalog.find((i) => i.waste_type_id === draft.waste_type_id);
  const canEdit = editable(w.report.status) && (!id || !!existing);
  const disabled = busy || localBusy || !hydrated || !canEdit;
  useEffect(() => {
    let active = true;
    readJSON<Draft>(draftKey)
      .then((saved) => {
        if (active && saved) {
          setDraft(saved);
          draftRef.current = saved;
        }
      })
      .catch(() => {
        if (active) setDraftStatus("error");
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [draftKey]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      smartAbort.current?.abort();
    };
  }, []);
  function patch(value: Partial<Draft>) {
    if (error === "amount" && value.amount !== undefined) setError(null);
    if (["date", "future", "period"].includes(error ?? "") && value.record_date)
      setError(null);
    const next = { ...draftRef.current, ...value };
    draftRef.current = next;
    setDraft(next);
    setDraftStatus("saving");
    storageQueue.current = storageQueue.current
      .catch(() => {})
      .then(() => writeJSON(draftKey, next));
    void storageQueue.current.then(
      () => {
        if (alive.current) setDraftStatus("saved");
      },
      () => {
        if (alive.current) setDraftStatus("error");
      },
    );
  }
  function selectWaste(selected: CatalogItem) {
    patch({
      waste_type_id: selected.waste_type_id,
      disposal_method_id: selected.recommended_method_id,
      ai_recognized: false,
      ...(selected.unit !== item?.unit ? { amount: "" } : {}),
    });
  }
  async function commit() {
    if (disabled) return;
    if (offline) {
      setError("network");
      return;
    }
    Keyboard.dismiss();
    setError(null);
    const invalid = validateDraft(draft, w.report.period_month);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (
      isDuplicate(draft, w.records, id) &&
      !(await confirm(
        t("Ещё одно взвешивание?", "Тағы бір өлшем бе?"),
        t(
          "За выбранную дату этот вид отхода уже вносился. Добавить ещё одно взвешивание?",
          "Таңдалған күні бұл қалдық түрі енгізілген. Тағы бір өлшем қосу керек пе?",
        ),
        t("Да, сохранить", "Иә, сақтау"),
      ))
    )
      return;
    setLocalBusy(true);
    try {
      await save(draft, id);
      // A failed cleanup must not present an already committed server write as a failed save.
      await storageQueue.current.catch(() => {});
      await removeJSON(draftKey).catch(() => {});
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/journal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "network");
    } finally {
      if (alive.current) setLocalBusy(false);
    }
  }
  async function deleteEntry() {
    if (
      !id ||
      disabled ||
      !(await confirm(
        t("Удалить взвешивание?", "Өлшемді жою керек пе?"),
        t(
          "Запись будет удалена из отчёта, итоги пересчитаются.",
          "Жазба есептен жойылып, қорытынды қайта есептеледі.",
        ),
        t("Удалить", "Жою"),
      ))
    )
      return;
    setLocalBusy(true);
    try {
      await remove(id);
      await storageQueue.current.catch(() => {});
      await removeJSON(draftKey).catch(() => {});
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network");
    } finally {
      if (alive.current) setLocalBusy(false);
    }
  }
  async function createWaste() {
    if (translating || busy) return;
    if (!newName.trim()) {
      setNewError("required");
      return;
    }
    setNewError(null);
    try {
      const wasteId = await addWaste({
        name: newName,
        translatedName,
        language,
        category,
        unit,
        recyclable,
      });
      const methodCode =
        category === "special"
          ? "OIL"
          : ["recyclable", "mixed"].includes(category)
            ? "RECYCLE"
            : "COMPOST";
      patch({
        waste_type_id: wasteId,
        disposal_method_id: w.methods.find((m) => m.code === methodCode)!.id,
        ai_recognized: Boolean(newRecognition),
        ...(newRecognition
          ? {
              amount:
                newRecognition.amount !== undefined &&
                newRecognition.unit === unit
                  ? String(newRecognition.amount)
                  : "",
            }
          : {}),
      });
      setNewOpen(false);
      setNewRecognition(null);
      setNewName("");
      setTranslatedName("");
    } catch (e) {
      setNewError(e instanceof Error ? e.message : "network");
    }
  }
  async function photo(source: "camera" | "library") {
    if (disabled) return;
    setPhotoNote("");
    setSmartError(null);
    try {
      if (source === "camera" && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setPhotoNote(
            t(
              "Разрешите камеру в настройках или выберите фото из галереи.",
              "Камераға рұқсат беріңіз немесе галереядан фото таңдаңыз.",
            ),
          );
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.8,
        base64: false,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !alive.current) return;
      setLocalBusy(true);
      const image = await preparePhoto(result.assets[0]);
      if (!alive.current) return;
      patch({ photo_url: image, ai_recognized: false });
      if (!smartConfigured) {
        setPhotoNote(
          t(
            "Фото прикреплено. Выберите вид отхода и укажите измеренный вес.",
            "Фото тіркелді. Қалдық түрін таңдап, өлшенген салмағын енгізіңіз.",
          ),
        );
        return;
      }
      const controller = new AbortController();
      smartAbort.current = controller;
      setLocalBusy(true);
      setAiBusy("photo");
      const recognition = await recognizePhoto(
        image,
        user!,
        w.catalog,
        controller.signal,
      );
      if (!alive.current || controller.signal.aborted) return;
      if (recognition.kind === "unknown" || recognition.confidence < 0.45) {
        setPhotoNote(
          t(
            "Не удалось однозначно определить отход на фото. Выберите вид вручную.",
            "Фотодағы қалдық түрін нақты анықтау мүмкін болмады. Қолмен таңдаңыз.",
          ),
        );
        return;
      }
      if (recognition.kind === "new" && recognition.suggestion) {
        const suggestion = recognition.suggestion;
        setNewName(suggestion[`name_${language}`]);
        setTranslatedName(
          suggestion[language === "ru" ? "name_kz" : "name_ru"],
        );
        setCategory(suggestion.category);
        setUnit(suggestion.unit);
        setRecyclable(suggestion.recyclable);
        setNewRecognition(recognition);
        setNewError(null);
        setNewOpen(true);
      } else {
        const selected = w.catalog.find(
          (c) => c.waste_type_id === recognition.waste_type_id,
        );
        if (selected) {
          patch({
            waste_type_id: selected.waste_type_id,
            disposal_method_id: selected.recommended_method_id,
            amount:
              recognition.amount === undefined
                ? draftRef.current.amount
                : String(recognition.amount),
            ai_recognized: true,
          });
          const unitLabel = selected.unit === "l" ? "л" : "кг";
          const weightPart =
            recognition.amount !== undefined
              ? ` · ~${number(recognition.amount, 2)} ${unitLabel}`
              : "";
          setPhotoNote(
            t(
              `ИИ распознал: ${selected.name_ru}${weightPart}. Проверьте данные перед сохранением.`,
              `ЖИ анықтады: ${selected.name_kz}${weightPart}. Сақтамас бұрын тексеріңіз.`,
            ),
          );
        } else {
          setPhotoRecognition(recognition);
        }
      }
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof Error ? e.message : "ai_unavailable";
      if (code !== "ai_cancelled")
        setSmartError(code.startsWith("ai_") ? code : "ai_unavailable");
    } finally {
      if (alive.current) {
        setLocalBusy(false);
        setAiBusy(null);
      }
    }
  }
  function applyPhoto() {
    if (!photoRecognition) return;
    const selected = w.catalog.find(
      (c) => c.waste_type_id === photoRecognition.waste_type_id,
    );
    if (!selected) {
      setSmartError("ai_response");
      return;
    }
    patch({
      waste_type_id: selected.waste_type_id,
      disposal_method_id: selected.recommended_method_id,
      amount:
        photoRecognition.amount === undefined
          ? ""
          : String(photoRecognition.amount),
      ai_recognized: true,
    });
    setPhotoNote(
      photoRecognition.amount_source === "estimate"
        ? t(
            "В форме — оценка веса по фото. Проверьте её на весах перед сохранением.",
            "Формадағы салмақ фото бойынша бағаланған. Сақтамас бұрын таразымен тексеріңіз.",
          )
        : photoRecognition.amount === undefined
          ? t(
              "Вид отхода определён. Укажите измеренный вес.",
              "Қалдық түрі анықталды. Өлшенген салмағын енгізіңіз.",
            )
          : t(
              "Данные с фото перенесены. Проверьте вид и вес.",
              "Фотодағы деректер толтырылды. Түрі мен салмағын тексеріңіз.",
            ),
    );
    setPhotoRecognition(null);
  }
  async function translateName() {
    if (!newName.trim() || translating || busy) return;
    const controller = new AbortController();
    smartAbort.current = controller;
    setTranslating(true);
    setNewError(null);
    try {
      const translated = await translateWaste(
        newName.trim(),
        language,
        user!,
        controller.signal,
      );
      if (alive.current && !controller.signal.aborted)
        setTranslatedName(
          language === "ru" ? translated.name_kz : translated.name_ru,
        );
    } catch (e) {
      if (alive.current)
        setNewError(e instanceof Error ? e.message : "ai_unavailable");
    } finally {
      if (alive.current) setTranslating(false);
    }
  }
  async function applyVoice() {
    if (localBusy || listening) return;
    setVoiceError(false);
    setVoiceAiError(null);
    if (smartConfigured) {
      const controller = new AbortController();
      smartAbort.current = controller;
      setLocalBusy(true);
      setAiBusy("voice");
      try {
        const result = await recognizePhrase(
          phrase,
          user!,
          w.catalog,
          controller.signal,
        );
        if (!alive.current || controller.signal.aborted) return;
        const selected = w.catalog.find(
          (c) => c.waste_type_id === result.waste_type_id,
        );
        if (
          result.kind !== "existing" ||
          !selected ||
          result.amount === undefined ||
          result.confidence < 0.65
        ) {
          setVoiceError(true);
          return;
        }
        patch({
          waste_type_id: selected.waste_type_id,
          disposal_method_id: selected.recommended_method_id,
          amount: String(result.amount),
          ai_recognized: true,
        });
        setVoiceOpen(false);
        return;
      } catch (e) {
        if (!alive.current) return;
        const code = e instanceof Error ? e.message : "ai_unavailable";
        if (code === "ai_cancelled") return;
        setVoiceAiError(code);
        // A useful local interpretation remains available when the server is offline.
        const local = parseVoice(phrase, w.catalog);
        if (
          !local.item ||
          local.amount === undefined ||
          local.amount <= 0 ||
          local.amount > 2000
        )
          return;
        patch({
          waste_type_id: local.item.waste_type_id,
          disposal_method_id: local.item.recommended_method_id,
          amount: String(local.amount),
          ai_recognized: true,
        });
        setVoiceOpen(false);
        setPhotoNote(
          t(
            "Фраза разобрана локально: проверьте вид отхода и вес.",
            "Сөйлем жергілікті талданды: қалдық түрі мен салмағын тексеріңіз.",
          ),
        );
        return;
      } finally {
        if (alive.current) {
          setLocalBusy(false);
          setAiBusy(null);
        }
      }
    }
    const result = parseVoice(phrase, w.catalog);
    if (
      !result.item ||
      result.amount === undefined ||
      result.amount <= 0 ||
      result.amount > 2000
    ) {
      setVoiceError(true);
      return;
    }
    patch({
      waste_type_id: result.item.waste_type_id,
      disposal_method_id: result.item.recommended_method_id,
      amount: String(result.amount),
      ai_recognized: true,
    });
    setVoiceOpen(false);
  }
  const daily = totals(
    w.records.filter((r) => r.record_date === draft.record_date),
    w.catalog,
    w.methods,
  );
  return (
    <>
      <Stack.Screen
        options={{
          title: !canEdit
            ? t("Просмотр записи", "Жазбаны қарау")
            : id
              ? t("Изменить запись", "Жазбаны өзгерту")
              : t("Новое взвешивание", "Жаңа өлшем"),
        }}
      />
      <Screen
        footer={
          canEdit ? (
            <>
              <Button
                title={
                  id
                    ? t("Сохранить изменения", "Өзгерістерді сақтау")
                    : t("Сохранить запись", "Жазбаны сақтау")
                }
                icon="check"
                disabled={disabled || offline}
                loading={busy || localBusy}
                onPress={() => void commit()}
              />
              <Row
                style={{
                  justifyContent: "center",
                  gap: 6,
                  paddingTop: 4,
                  paddingBottom: 2,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      draftStatus === "error"
                        ? colors.red
                        : draftStatus === "saving"
                          ? colors.orange
                          : colors.emerald,
                  }}
                />
                <Txt
                  variant="caption"
                  style={{
                    color: draftStatus === "error" ? colors.red : colors.muted,
                    textAlign: "center",
                  }}
                >
                  {!hydrated
                    ? t(
                        "Восстанавливаем черновик…",
                        "Жоба қалпына келтірілуде…",
                      )
                    : draftStatus === "error"
                      ? t("Не удалось сохранить черновик", "Жоба сақталмады")
                      : draftStatus === "saving"
                        ? t("Сохраняем черновик…", "Жоба сақталуда…")
                        : t(
                            "Черновик сохранён на телефоне",
                            "Жоба телефонда сақталды",
                          )}
                </Txt>
              </Row>
            </>
          ) : undefined
        }
      >
        {!canEdit && (
          <Notice
            tone="blue"
            text={t(
              "Отчёт доступен только для просмотра. Изменения возможны в черновике или после возврата на доработку.",
              "Есеп тек қарауға қолжетімді. Жобаны немесе толықтыруға қайтарылған есепті өзгертуге болады.",
            )}
          />
        )}
        {offline && canEdit && (
          <View style={{ gap: spacing.sm }}>
            <Notice
              tone="orange"
              text={t(
                "Нет связи. Заполняйте черновик — отправить запись можно после подключения.",
                "Байланыс жоқ. Жобаны толтырыңыз — байланысты қалпына келтірген соң жіберіңіз.",
              )}
            />
            <Button
              title={t("Проверить подключение", "Байланысты тексеру")}
              variant="secondary"
              onPress={() => void refresh()}
            />
          </View>
        )}
        {canEdit && (
          <Card style={{ gap: spacing.md }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Row style={{ gap: spacing.xs }}>
                <Icon name="zap" size={16} color={colors.green} />
                <Txt variant="label">
                  {t("Быстрый умный ввод", "Ақылды енгізу")}
                </Txt>
              </Row>
              {draft.ai_recognized && (
                <View
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                    borderRadius: radius.full,
                    backgroundColor: colors.greenSoft,
                  }}
                >
                  <Txt
                    variant="eyebrow"
                    style={{ color: colors.green, fontWeight: "700" }}
                  >
                    AI ✓
                  </Txt>
                </View>
              )}
            </Row>
            <Row style={{ gap: spacing.sm }}>
              {(
                [
                  {
                    key: "photo",
                    icon: "camera",
                    title: smartConfigured ? "Фото · AI" : t("Камера", "Камера"),
                  },
                  {
                    key: "library",
                    icon: "image",
                    title: t("Галерея", "Галерея"),
                  },
                  {
                    key: "voice",
                    icon: "mic",
                    title: t("Голос", "Дауыс"),
                  },
                ] as const
              ).map((control) => (
                <Pressable
                  key={control.key}
                  accessibilityRole="button"
                  accessibilityLabel={control.title}
                  disabled={disabled}
                  onPress={() => {
                    if (control.key === "photo") void photo("camera");
                    else if (control.key === "library") void photo("library");
                    else if (control.key === "voice") setVoiceOpen(true);
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 62,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: spacing.xs,
                    opacity: disabled ? 0.45 : 1,
                    backgroundColor: pressed ? colors.border : colors.pressed,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.xs,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                  })}
                >
                  <Icon name={control.icon} color={colors.green} size={18} />
                  <Txt
                    variant="caption"
                    numberOfLines={1}
                    style={{
                      color: colors.ink,
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    {control.title}
                  </Txt>
                </Pressable>
              ))}
            </Row>

            {draft.photo_url ? (
              <PhotoPreviewWithScanner
                uri={draft.photo_url}
                scanning={aiBusy === "photo"}
                disabled={disabled}
                onCancelScan={() => smartAbort.current?.abort()}
                onRemovePhoto={() =>
                  patch({ photo_url: null, ai_recognized: false })
                }
                t={t}
              />
            ) : (
              aiBusy === "photo" && (
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt variant="caption" style={{ color: colors.green, flex: 1 }}>
                    {t("Идёт анализ фото…", "Фото талдануда…")}
                  </Txt>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => smartAbort.current?.abort()}
                    style={{ padding: spacing.xs }}
                  >
                    <Txt variant="caption" style={{ color: colors.red }}>
                      {t("Отмена", "Болдырмау")}
                    </Txt>
                  </Pressable>
                </Row>
              )
            )}
            {photoNote ? (
              <Notice
                tone={draft.ai_recognized ? "emerald" : "blue"}
                text={photoNote}
              />
            ) : null}
            <SmartError code={smartError} />
          </Card>
        )}

        <View style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt variant="label">{t("1. Вид отходов", "1. Қалдық түрі")}</Txt>
            {canEdit && (
              <Pressable
                accessibilityRole="button"
                disabled={disabled || offline}
                onPress={() => setNewOpen(true)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radius.sm,
                  backgroundColor: pressed ? colors.border : colors.greenSoft,
                })}
              >
                <Icon name="plus" size={14} color={colors.green} />
                <Txt
                  variant="caption"
                  style={{ color: colors.green, fontWeight: "600" }}
                >
                  {t("Новый вид", "Жаңа түр")}
                </Txt>
              </Pressable>
            )}
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("1. Вид отходов", "1. Қалдық түрі")}
            disabled={disabled}
            onPress={() => {
              setCatalogQuery("");
              setCatalogOpen(true);
            }}
            style={({ pressed }) => ({
              minHeight: 54,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.pressed : colors.surface,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.sm,
              opacity: disabled ? 0.55 : 1,
            })}
          >
            <Row style={{ flex: 1, gap: spacing.sm }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.sm,
                  backgroundColor: colors.greenSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={
                    item?.unit === "l"
                      ? "droplet"
                      : item?.category === "organic"
                        ? "feather"
                        : "package"
                  }
                  size={16}
                  color={colors.green}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt
                  numberOfLines={1}
                  style={{ fontWeight: "600", color: colors.ink }}
                >
                  {item?.[`name_${language}`] ??
                    t("Выберите вид отхода", "Қалдық түрін таңдаңыз")}
                </Txt>
                <Txt variant="caption" style={{ color: colors.muted }}>
                  {item?.unit === "l"
                    ? t("Единица: литры (л)", "Бірлігі: литр (л)")
                    : t("Единица: килограммы (кг)", "Бірлігі: килограмм (кг)")}
                </Txt>
              </View>
            </Row>
            <Row style={{ gap: 6 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: colors.pressed,
                }}
              >
                <Txt
                  variant="caption"
                  style={{ fontWeight: "600", color: colors.muted }}
                >
                  {item?.unit === "l" ? "л" : "кг"}
                </Txt>
              </View>
              <Icon name="chevron-down" size={16} color={colors.muted} />
            </Row>
          </Pressable>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt variant="label">
              {item?.unit === "l"
                ? t("2. Объём (л)", "2. Көлем (л)")
                : t("2. Вес (кг)", "2. Салмақ (кг)")}
            </Txt>
            <Txt variant="caption" style={{ color: colors.muted }}>
              {t("За день: ", "Бүгін: ")}
              {number(daily.kg)} кг
            </Txt>
          </Row>
          <Card>
            <Row style={{ alignItems: "baseline" }}>
              <TextInput
                accessibilityLabel={
                  item?.unit === "l"
                    ? t("Объём в литрах", "Литрмен көлем")
                    : t("Вес в килограммах", "Килограммен салмақ")
                }
                editable={!disabled}
                value={draft.amount}
                onChangeText={(amount) => {
                  patch({ amount, ai_recognized: false });
                  if (error === "amount") setError(null);
                }}
                placeholder="0,0"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                inputMode="decimal"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                style={{
                  ...typography.amount,
                  flex: 1,
                  minWidth: 0,
                  minHeight: 52,
                  color: colors.ink,
                  padding: 0,
                }}
              />
              <Txt variant="heading" style={{ color: colors.muted }}>
                {item?.unit === "l" ? "л" : "кг"}
              </Txt>
            </Row>
            {canEdit && (
              <Row style={{ gap: spacing.sm }}>
                {[0.5, 1, 5, 10].map((amount) => (
                  <Button
                    key={amount}
                    title={`+${String(amount).replace(".", ",")}`}
                    variant="secondary"
                    disabled={disabled}
                    onPress={() =>
                      patch({
                        amount: String(
                          Math.round(
                            ((decimal(draft.amount) || 0) + amount) * 100,
                          ) / 100,
                        ),
                        ai_recognized: false,
                      })
                    }
                    style={{
                      flex: 1,
                      minHeight: 38,
                      paddingHorizontal: spacing.xs,
                      paddingVertical: spacing.xs,
                    }}
                  />
                ))}
              </Row>
            )}
          </Card>
          {error === "amount" && <ErrorText code={error} />}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Txt variant="label">
            {t("3. Утилизация и дата", "3. Кәдеге жарату және күн")}
          </Txt>
          <Card style={{ gap: spacing.md }}>
            <NativePicker
              label={t("Способ утилизации", "Кәдеге жарату тәсілі")}
              value={draft.disposal_method_id}
              onChange={(value) => patch({ disposal_method_id: value })}
              disabled={disabled}
              options={w.methods.map((method) => ({
                value: method.id,
                label: method[`name_${language}`],
              }))}
            />
            {item && (
              <Notice
                tone="emerald"
                title={
                  "🌱 " +
                  t("Рекомендуется: ", "Ұсынылады: ") +
                  (w.methods.find(
                    (method) => method.id === item.recommended_method_id,
                  )?.[`name_${language}`] ?? "")
                }
                text={t(
                  `Экономия ${number(Number(item.co2_saving_per_ton), 2)} кг CO₂-экв./т по сравнению с вывозом в ТБО.`,
                  `ТҚҚ полигонымен салыстырғанда ${number(Number(item.co2_saving_per_ton), 2)} кг CO₂-экв./т үнемдейді.`,
                )}
              />
            )}
            <DatePicker
              label={
                w.organization.is_laboratory
                  ? t("Дата лабораторного занятия", "Зертханалық сабақ күні")
                  : t("Дата взвешивания", "Өлшеу күні")
              }
              value={draft.record_date}
              month={w.report.period_month}
              onChange={(value) => patch({ record_date: value })}
              disabled={disabled}
            />
          </Card>
        </View>

        {error !== "amount" && <ErrorText code={error} />}
        {canEdit && id && (
          <Button
            title={t("Удалить запись", "Жазбаны жою")}
            variant="danger"
            icon="trash-2"
            disabled={disabled || offline}
            onPress={() => void deleteEntry()}
          />
        )}
      </Screen>
      <Sheet
        visible={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        title={t("Вид отходов", "Қалдық түрі")}
      >
        <Field
          label={t("Поиск по справочнику", "Анықтамалықтан іздеу")}
          placeholder={t("Начните вводить название", "Атауын енгізіңіз")}
          value={catalogQuery}
          onChangeText={setCatalogQuery}
          autoCorrect={false}
        />
        <Group>
          {w.catalog
            .filter((c) =>
              c[`name_${language}`]
                .toLowerCase()
                .includes(catalogQuery.toLowerCase().trim()),
            )
            .map((c, i, items) => (
              <ListRow
                key={c.waste_type_id}
                title={c[`name_${language}`]}
                value={c.unit === "l" ? "л" : "кг"}
                selected={c.waste_type_id === draft.waste_type_id}
                onPress={() => {
                  selectWaste(c);
                  setCatalogOpen(false);
                }}
                last={i === items.length - 1}
              />
            ))}
        </Group>
        {!w.catalog.some((c) =>
          c[`name_${language}`]
            .toLowerCase()
            .includes(catalogQuery.toLowerCase().trim()),
        ) && (
          <Txt style={{ color: colors.muted }}>
            {t(
              "Ничего не найдено. Новый вид можно добавить из формы.",
              "Ештеңе табылмады. Жаңа түрді формадан қосуға болады.",
            )}
          </Txt>
        )}
      </Sheet>

      <Sheet
        visible={newOpen}
        dismissDisabled={busy || translating}
        onClose={() => {
          if (!busy && !translating) {
            setNewOpen(false);
            setNewRecognition(null);
          }
        }}
        title={t("Новый вид отхода", "Жаңа қалдық түрі")}
      >
        <Field
          label={t("Название на русском", "Қазақша атауы")}
          value={newName}
          onChangeText={setNewName}
          placeholder={t("Например, чайная заварка", "Мысалы, шай қалдығы")}
          maxLength={120}
          editable={!busy && !translating}
        />
        {newRecognition && (
          <Notice
            title={t("Предложение по фото", "Фото бойынша ұсыныс")}
            text={t(
              "Проверьте название, единицу и категорию перед добавлением.",
              "Қоспас бұрын атауын, бірлігі мен санатын тексеріңіз.",
            )}
          />
        )}
        {smartConfigured && (
          <Button
            title={t("Перевести на казахский", "Орысшаға аудару")}
            variant="secondary"
            loading={translating}
            disabled={!newName.trim() || busy}
            onPress={() => void translateName()}
          />
        )}
        <Field
          label={t(
            "Название на казахском (необязательно)",
            "Орысша атауы (міндетті емес)",
          )}
          value={translatedName}
          onChangeText={setTranslatedName}
          maxLength={120}
          editable={!busy && !translating}
        />
        <Txt variant="caption" style={{ color: colors.muted }}>
          {t(
            "Без перевода исходное название будет показано на обоих языках.",
            "Аудармасыз бастапқы атау екі тілде де көрсетіледі.",
          )}
        </Txt>
        <NativePicker
          disabled={busy || translating}
          label={t("Категория", "Санат")}
          value={category}
          onChange={(v) => setCategory(v as Category)}
          options={[
            { value: "organic", label: t("Органические", "Органикалық") },
            { value: "recyclable", label: t("Вторсырьё", "Қайталама шикізат") },
            { value: "special", label: t("Специальные", "Арнайы") },
            { value: "mixed", label: t("Смешанные", "Аралас") },
          ]}
        />
        <NativePicker
          disabled={busy || translating}
          label={t("Единица измерения", "Өлшем бірлігі")}
          value={unit}
          onChange={(v) => setUnit(v as Unit)}
          options={[
            { value: "kg", label: "кг" },
            { value: "l", label: "л" },
          ]}
        />
        <NativePicker
          disabled={busy || translating}
          label={t("Пригодность к переработке", "Қайта өңдеуге жарамдылығы")}
          value={recyclable}
          onChange={(v) => setRecyclable(v as Recyclability)}
          options={[
            { value: "yes", label: t("Да", "Иә") },
            { value: "partial", label: t("Частично", "Ішінара") },
            { value: "no", label: t("Нет", "Жоқ") },
          ]}
        />
        {newError?.startsWith("ai_") ? (
          <SmartError code={newError} />
        ) : (
          <ErrorText code={newError} />
        )}
        <Button
          title={t("Добавить и выбрать", "Қосу және таңдау")}
          onPress={() => void createWaste()}
          loading={busy}
          disabled={!newName.trim() || translating}
        />
      </Sheet>
      <Sheet
        visible={voiceOpen}
        dismissDisabled={listening || aiBusy === "voice"}
        onClose={() => {
          if (!listening && aiBusy !== "voice") setVoiceOpen(false);
        }}
        title={t("Голосовой ввод", "Дауыспен енгізу")}
      >
        <Notice
          text={t(
            "Нажмите микрофон на системной клавиатуре и продиктуйте фразу. Например: «Очистки овощей двенадцать с половиной килограмм».",
            "Жүйелік пернетақтадағы микрофонды басып, айтыңыз. Мысалы: «Көкөніс қабықтары он екі жарым килограмм».",
          )}
        />
        <Field
          label={t("Распознанная фраза", "Танылған сөйлем")}
          placeholder={t("Вид отхода и вес…", "Қалдық түрі және салмақ…")}
          value={phrase}
          onChangeText={(value) => {
            setPhrase(value);
            setVoiceError(false);
            setVoiceAiError(null);
          }}
          multiline
          editable={!listening && aiBusy !== "voice"}
        />
        {canRecognizeSpeech() && (
          <Button
            title={
              listening
                ? t("Слушаем…", "Тыңдауда…")
                : t("Включить микрофон браузера", "Браузер микрофонын қосу")
            }
            loading={listening}
            variant="secondary"
            icon="mic"
            onPress={() => {
              setListening(true);
              void recognizeSpeech(language)
                .then(setPhrase)
                .catch(() => setVoiceError(true))
                .finally(() => setListening(false));
            }}
          />
        )}
        <SmartError code={voiceAiError} />
        {voiceError && (
          <Notice
            tone="red"
            text={t(
              "Не удалось определить вид и вес. Укажите название из справочника и число или заполните форму вручную.",
              "Түрі мен салмағын анықтау мүмкін болмады. Анықтамалықтағы атау мен санды көрсетіңіз немесе қолмен енгізіңіз.",
            )}
          />
        )}
        <Button
          title={t("Заполнить форму", "Форманы толтыру")}
          disabled={!phrase.trim() || listening}
          loading={aiBusy === "voice"}
          onPress={() => void applyVoice()}
        />
      </Sheet>
      <Sheet
        visible={!!photoRecognition}
        onClose={() => setPhotoRecognition(null)}
        title={t("Проверьте данные с фото", "Фото деректерін тексеріңіз")}
      >
        <Txt variant="heading">
          {
            w.catalog.find(
              (c) => c.waste_type_id === photoRecognition?.waste_type_id,
            )?.[`name_${language}`]
          }
        </Txt>
        {photoRecognition?.amount !== undefined ? (
          <Txt variant="title">
            {number(photoRecognition.amount, 2)}{" "}
            {photoRecognition.unit === "l" ? "л" : "кг"}
          </Txt>
        ) : (
          <Txt>
            {t(
              "Вес определить не удалось. Введите его после взвешивания.",
              "Салмақ анықталмады. Өлшегеннен кейін енгізіңіз.",
            )}
          </Txt>
        )}
        {photoRecognition?.amount_source === "estimate" && (
          <Notice
            tone="orange"
            text={t(
              "Это приблизительная оценка. Проверьте вес на весах перед сохранением.",
              "Бұл шамамен бағалау. Сақтамас бұрын таразымен тексеріңіз.",
            )}
          />
        )}
        <Button
          title={t("Заполнить форму", "Форманы толтыру")}
          onPress={applyPhoto}
        />
        <Button
          title={t("Выбрать вручную", "Қолмен таңдау")}
          variant="ghost"
          onPress={() => setPhotoRecognition(null)}
        />
      </Sheet>
      {dialog}
    </>
  );
}
