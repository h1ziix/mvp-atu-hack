import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "@/providers/app-provider";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Icon,
  Notice,
  Row,
  Sheet,
  StatusBadge,
  Txt,
} from "./ui";
import { colors, layout, radius, spacing } from "@/theme";
import {
  dateLabel,
  editable,
  localDate,
  monthLabel,
  monthShortLabel,
  number,
} from "@/utils/domain";
import type { WasteRecord } from "@/lib/types";

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { workspace, loading, error, refresh, logout, t } = useApp();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  if (workspace) return <>{children}</>;
  return (
    <View
      style={{
        padding: spacing.xl,
        gap: spacing.xl,
        flex: 1,
        width: "100%",
        maxWidth: layout.contentWidth,
        alignSelf: "center",
      }}
    >
      {loading || !error ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t(
            "Загрузка данных организации",
            "Ұйым деректері жүктелуде",
          )}
          style={{ gap: spacing.xl }}
        >
          <View style={{ gap: spacing.sm }}>
            <View
              style={{
                height: 24,
                width: "85%",
                borderRadius: radius.sm,
                backgroundColor: colors.track,
              }}
            />
            <View
              style={{
                height: 16,
                width: "55%",
                borderRadius: radius.sm,
                backgroundColor: colors.track,
              }}
            />
          </View>
          <View
            style={{
              height: layout.touch,
              borderRadius: radius.md,
              backgroundColor: colors.track,
            }}
          />
          <View
            style={{
              height: 180,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
            }}
          />
          <Txt variant="caption" style={{ color: colors.muted }}>
            {t("Загружаем данные точки…", "Ұйым деректері жүктелуде…")}
          </Txt>
        </View>
      ) : (
        <>
          <ErrorText code={logoutError ?? error} />
          <Button
            title={t("Повторить загрузку", "Қайта жүктеу")}
            onPress={() => void refresh()}
          />
          <Button
            title={t("Сменить аккаунт", "Аккаунтты ауыстыру")}
            variant="ghost"
            onPress={() => void logout().catch(() => setLogoutError("storage"))}
          />
        </>
      )}
    </View>
  );
}
export function PeriodPicker() {
  const { month, language, setMonth, workspace, busy, t } = useApp();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  return (
    <>
      <Row
        style={{
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: spacing.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Выбрать отчётный месяц", "Есепті айды таңдау")}
          disabled={busy}
          onPress={() => {
            setYear(Number(month.slice(0, 4)));
            setOpen(true);
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            minHeight: 38,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: radius.sm,
            backgroundColor: pressed ? colors.pressed : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.sm,
          })}
        >
          <Icon name="calendar" size={16} color={colors.green} />
          <Txt variant="label" style={{ textTransform: "capitalize" }}>
            {monthLabel(month, language)}
          </Txt>
          <Icon name="chevron-down" size={15} color={colors.muted} />
        </Pressable>
        {workspace && <StatusBadge status={workspace.report.status} />}
      </Row>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t("Отчётный месяц", "Есепті ай")}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <Button
            title="−"
            variant="secondary"
            onPress={() => setYear((y) => y - 1)}
          />
          <Txt variant="heading">{year}</Txt>
          <Button
            title="+"
            variant="secondary"
            onPress={() => setYear((y) => y + 1)}
          />
        </Row>
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const value = `${year}-${String(i + 1).padStart(2, "0")}`;
            return (
              <Chip
                key={value}
                title={monthShortLabel(value, language)}
                selected={value === month}
                onPress={() => {
                  setMonth(value);
                  setOpen(false);
                }}
              />
            );
          })}
        </View>
      </Sheet>
    </>
  );
}
export function ReportNotice() {
  const { workspace, t, offline, error, refresh } = useApp();
  if (!workspace) return null;
  const report = workspace.report;
  if (!error && !offline && report.status === "draft") return null;
  return (
    <View style={{ gap: spacing.md }}>
      {error && (
        <>
          <ErrorText code={error} />
          <Button
            title={t("Обновить данные", "Деректерді жаңарту")}
            variant="secondary"
            onPress={() => void refresh()}
          />
        </>
      )}
      {offline && (
        <Notice
          tone="orange"
          text={t(
            "Показана сохранённая копия. Для изменений подключитесь к интернету.",
            "Сақталған көшірме көрсетілген. Өзгерту үшін интернетке қосылыңыз.",
          )}
        />
      )}
      {report.status === "returned" && (
        <Notice
          tone="red"
          title={t(
            "Отчёт возвращён на доработку",
            "Есеп толықтыруға қайтарылды",
          )}
          text={
            report.inspector_comment ??
            t(
              "Проверьте записи и отправьте отчёт повторно.",
              "Жазбаларды тексеріп, қайта жіберіңіз.",
            )
          }
        />
      )}
      {report.status === "approved" && (
        <Notice
          title={t(
            "Отчёт принят в единый реестр АТУ",
            "Есеп АТУ бірыңғай тізіліміне қабылданды",
          )}
          text={t(
            "Данные проверены. Редактирование закрыто.",
            "Деректер тексерілді. Өңдеу жабық.",
          )}
        />
      )}
      {["submitted", "in_review"].includes(report.status) && (
        <Notice
          tone="blue"
          title={t("Отчёт на проверке", "Есеп тексерілуде")}
          text={t(
            "Когда проверяющий примет или вернёт отчёт, статус обновится автоматически.",
            "Тексеруші шешім қабылдағанда есеп күйі автоматты түрде жаңарады.",
          )}
        />
      )}
    </View>
  );
}
export function RecordRow({
  record,
  showDate = false,
  last = false,
}: {
  record: WasteRecord;
  showDate?: boolean;
  last?: boolean;
}) {
  const { workspace, language, t } = useApp();
  if (!workspace) return null;
  const item = workspace.catalog.find(
    (w) => w.waste_type_id === record.waste_type_id,
  );
  const method = workspace.methods.find(
    (m) => m.id === record.disposal_method_id,
  );
  const today = record.record_date === localDate();
  const iconName =
    record.unit === "l"
      ? "droplet"
      : item?.category === "organic"
        ? "feather"
        : "package";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item?.[`name_${language}`] ?? t("Отход", "Қалдық")}, ${number(Number(record.amount))} ${record.unit === "l" ? "л" : "кг"}`}
      onPress={() =>
        router.push({ pathname: "/entry", params: { id: record.id } })
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: 68,
        gap: spacing.md,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.pressed : colors.surface,
      })}
    >
      <View
        style={{
          width: layout.iconBox,
          height: layout.iconBox,
          borderRadius: radius.sm,
          backgroundColor: colors.greenSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={iconName} size={18} color={colors.green} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt variant="label" numberOfLines={1}>
          {item?.[`name_${language}`] ?? t("Отход", "Қалдық")}
        </Txt>
        <Txt
          variant="caption"
          numberOfLines={1}
          style={{ color: colors.muted }}
        >
          {showDate
            ? `${today ? t("Сегодня", "Бүгін") : dateLabel(record.record_date, language)} · `
            : ""}
          {method?.[`name_${language}`]}
        </Txt>
        {(record.photo_url || record.ai_recognized) && (
          <Row style={{ gap: spacing.xs, marginTop: 2 }}>
            {record.photo_url && (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 6,
                  backgroundColor: colors.pressed,
                }}
              >
                <Txt variant="eyebrow" style={{ color: colors.muted }}>
                  📷 {t("Фото", "Фото")}
                </Txt>
              </View>
            )}
            {record.ai_recognized && (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 6,
                  backgroundColor: colors.greenSoft,
                }}
              >
                <Txt variant="eyebrow" style={{ color: colors.green }}>
                  AI
                </Txt>
              </View>
            )}
          </Row>
        )}
      </View>
      <View
        style={{
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.sm,
          backgroundColor: colors.pressed,
        }}
      >
        <Txt
          selectable
          variant="label"
          style={{ fontVariant: ["tabular-nums"], color: colors.ink }}
        >
          {number(Number(record.amount))} {record.unit === "l" ? "л" : "кг"}
        </Txt>
      </View>
      <Icon
        name={editable(workspace.report.status) ? "chevron-right" : "lock"}
        size={15}
        color={colors.muted}
      />
    </Pressable>
  );
}
export function EmptyState({
  title,
  description,
  action,
  onPress,
}: {
  title: string;
  description: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: spacing.xxxl }}>
      <Icon name="inbox" color={colors.muted} size={28} />
      <Txt variant="heading" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      <Txt style={{ color: colors.muted, textAlign: "center" }}>
        {description}
      </Txt>
      {action && onPress && <Button title={action} onPress={onPress} />}
    </Card>
  );
}
