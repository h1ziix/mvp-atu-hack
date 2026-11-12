import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useApp } from "@/providers/app-provider";
import {
  Button,
  Card,
  ErrorText,
  Group,
  Icon,
  Notice,
  Row,
  Screen,
  SectionTitle,
  StatusBadge,
  Txt,
  useConfirm,
} from "@/components/ui";
import {
  PeriodPicker,
  ReportNotice,
  WorkspaceGate,
} from "@/components/workspace";
import { backendConfigured } from "@/lib/supabase";
import { categoryColors, colors, layout, radius, spacing } from "@/theme";
import {
  editable,
  number,
  recordWeight,
  timestampLabel,
  totals,
} from "@/utils/domain";

export default function ReportScreen() {
  const {
    workspace: w,
    language,
    t,
    busy,
    submit,
    demoReview,
    loading,
    refresh,
    offline,
  } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const { confirm, dialog } = useConfirm();
  if (!w) return <WorkspaceGate>{null}</WorkspaceGate>;
  const sum = totals(w.records, w.catalog, w.methods);
  const groups = w.catalog.map((item, i) => ({
    item,
    kg: w.records
      .filter((r) => r.waste_type_id === item.waste_type_id)
      .reduce((a, r) => a + recordWeight(r, w.catalog), 0),
    color: categoryColors[i % categoryColors.length],
  }));
  async function send() {
    if (
      !(await confirm(
        t("Отправить отчёт?", "Есепті жіберу керек пе?"),
        t(
          "После отправки записи будут доступны только для просмотра. Если проверяющий вернёт отчёт, их можно будет исправить.",
          "Жіберілген соң жазбалар тек қарауға қолжетімді. Тексеруші қайтарса, оларды түзетуге болады.",
        ),
        t("Отправить", "Жіберу"),
      ))
    )
      return;
    setError(null);
    try {
      await submit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "network");
    }
  }
  const canSubmit = editable(w.report.status);
  return (
    <WorkspaceGate>
      <Screen
        compactFooter
        refreshing={loading}
        onRefresh={() => void refresh()}
        footer={
          canSubmit ? (
            <>
              <Button
                title={
                  w.report.status === "returned"
                    ? t("Отправить повторно", "Қайта жіберу")
                    : t("Отправить на проверку", "Тексеруге жіберу")
                }
                icon="send"
                loading={busy}
                disabled={!w.records.length || offline}
                onPress={() => void send()}
              />
              <Txt
                variant="caption"
                style={{ color: colors.muted, textAlign: "center" }}
              >
                {w.records.length
                  ? t(
                      "В отчёт войдут все записи за выбранный месяц.",
                      "Есепке таңдалған айдың барлық жазбалары кіреді.",
                    )
                  : t(
                      "Добавьте хотя бы одно взвешивание.",
                      "Кемінде бір өлшем қосыңыз.",
                    )}
              </Txt>
            </>
          ) : undefined
        }
      >
        <PeriodPicker />
        <ReportNotice />
        <Card>
          <Txt variant="label">
            {t("Общая масса отходов", "Қалдықтардың жалпы салмағы")}
          </Txt>
          <Row style={{ alignItems: "baseline" }}>
            <Txt selectable variant="display">
              {number(sum.kg)}
            </Txt>
            <Txt style={{ color: colors.muted }}>кг</Txt>
          </Row>
          <Txt variant="caption" style={{ color: colors.muted }}>
            {t("Взвешиваний: ", "Өлшемдер: ")}
            {w.records.length}
            {sum.liters
              ? ` · ${number(sum.liters)} ${t("л пересчитаны в массу", "л салмаққа айналдырылды")}`
              : ""}
          </Txt>
          <View
            style={{
              height: 12,
              flexDirection: "row",
              overflow: "hidden",
              borderRadius: radius.full,
              backgroundColor: colors.track,
              gap: 2,
            }}
          >
            {groups
              .filter((g) => g.kg > 0)
              .map((g) => (
                <View
                  key={g.item.waste_type_id}
                  style={{
                    flex: g.kg,
                    backgroundColor: g.color,
                    borderRadius: radius.full,
                  }}
                />
              ))}
          </View>
        </Card>
        <View style={{ gap: spacing.sm }}>
          <SectionTitle
            title={t("По видам отходов", "Қалдық түрлері бойынша")}
          />
          <Group>
            {groups.map((g, i) => (
              <View
                key={g.item.waste_type_id}
                style={{
                  padding: spacing.lg,
                  gap: spacing.sm,
                  borderBottomWidth:
                    i === groups.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                }}
              >
                <Row style={{ alignItems: "center" }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: radius.full,
                      backgroundColor: g.color,
                    }}
                  />
                  <Txt style={{ flex: 1 }}>{g.item[`name_${language}`]}</Txt>
                  <Txt selectable variant="label">
                    {number(g.kg)} кг
                  </Txt>
                </Row>
              </View>
            ))}
          </Group>
          {w.organization.summary_rule === "tara_plus_bones" && (
            <Notice
              title={t("Итого: тара + кости", "Барлығы: ыдыс + сүйектер")}
              text={`${number(sum.tara)} + ${number(sum.bones)} = ${number(sum.kg)} кг`}
            />
          )}
        </View>
        <Card
          style={{
            backgroundColor: colors.emeraldSoft,
            borderColor: "#A7F3D0",
          }}
        >
          <Row>
            <Icon name="feather" color={colors.emerald} />
            <Txt variant="label" style={{ flex: 1, color: colors.emerald }}>
              {t("Экономия CO₂", "CO₂ үнемдеу")}
            </Txt>
            <Txt selectable variant="heading" style={{ color: colors.emerald }}>
              {number(sum.co2)} кг
            </Txt>
          </Row>
          <Txt variant="caption" style={{ color: colors.emerald }}>
            {t(
              "В сравнении с вывозом этих отходов на полигон.",
              "Осы қалдықтарды полигонға шығарумен салыстырғанда.",
            )}
          </Txt>
          <Button
            title={
              details
                ? t("Скрыть расчёт", "Есептеуді жасыру")
                : t("Как считается", "Қалай есептеледі")
            }
            variant="ghost"
            onPress={() => setDetails((v) => !v)}
            style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
          />
          {details && (
            <Txt variant="caption" style={{ color: colors.emerald }}>
              {t(
                "Масса каждой записи × разница коэффициентов полигона и выбранного способа утилизации ÷ 1000. Коэффициенты — из справочника на основе DEFRA 2024; для отдельных материалов использованы допущения. Для масла 1 л = 0,92 кг.",
                "Әр жазбаның салмағы × полигон мен таңдалған тәсіл коэффициенттерінің айырмасы ÷ 1000. Коэффициенттер DEFRA 2024 негізіндегі анықтамалықтан; кей материалдарға болжам қолданылған. Май үшін 1 л = 0,92 кг.",
              )}
            </Txt>
          )}
        </Card>
        <View style={{ gap: spacing.md }}>
          <SectionTitle title={t("История отчёта", "Есеп тарихы")} />
          {w.history.map((event, i) => (
            <Row key={event.id} style={{ alignItems: "flex-start" }}>
              <View
                style={{
                  width: spacing.xxl,
                  alignItems: "center",
                  paddingTop: spacing.sm,
                  gap: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: spacing.sm,
                    height: spacing.sm,
                    borderRadius: radius.full,
                    backgroundColor:
                      i === w.history.length - 1 ? colors.green : colors.border,
                  }}
                />
                {i !== w.history.length - 1 && (
                  <View
                    style={{
                      width: 1,
                      minHeight: layout.touch,
                      backgroundColor: colors.border,
                    }}
                  />
                )}
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <StatusBadge status={event.to_status} />
                <Txt variant="caption" style={{ color: colors.muted }}>
                  {timestampLabel(event.created_at, language)}
                </Txt>
                {event.comment && <Txt variant="caption">{event.comment}</Txt>}
              </View>
            </Row>
          ))}
        </View>
        <ErrorText code={error} />
        {!backendConfigured &&
          ["submitted", "in_review"].includes(w.report.status) && (
            <View style={{ gap: spacing.md }}>
              <SectionTitle
                title={t("Демо: проверка отчёта", "Демо: есепті тексеру")}
              />
              <Notice
                tone="orange"
                text={t(
                  "Эти действия имитируют ответ проверяющего только на этом устройстве.",
                  "Бұл әрекеттер тек осы құрылғыда тексерушінің жауабын көрсетеді.",
                )}
              />
              <Button
                title={t("Вернуть с комментарием", "Түсініктемемен қайтару")}
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  void demoReview("returned").catch(() => setError("storage"))
                }
              />
              <Button
                title={t("Принять отчёт", "Есепті қабылдау")}
                variant="ghost"
                disabled={busy}
                onPress={() =>
                  void demoReview("approved").catch(() => setError("storage"))
                }
              />
            </View>
          )}
      </Screen>
      {dialog}
    </WorkspaceGate>
  );
}
