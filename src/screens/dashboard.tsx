import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "@/providers/app-provider";
import {
  Button,
  Card,
  Group,
  Icon,
  Row,
  Screen,
  SectionTitle,
  Txt,
} from "@/components/ui";
import {
  EmptyState,
  PeriodPicker,
  RecordRow,
  ReportNotice,
  WorkspaceGate,
} from "@/components/workspace";
import { colors, radius, spacing } from "@/theme";
import { editable, localDate, number, totals } from "@/utils/domain";

export default function DashboardScreen() {
  const { user, workspace: w, language, t, loading, refresh } = useApp();
  if (!w) return <WorkspaceGate>{null}</WorkspaceGate>;
  const sum = totals(w.records, w.catalog, w.methods);
  const todaysRecords = w.records.filter((r) => r.record_date === localDate());
  const daily = totals(todaysRecords, w.catalog, w.methods);
  const recent = [...w.records]
    .sort(
      (a, b) =>
        b.record_date.localeCompare(a.record_date) ||
        b.created_at.localeCompare(a.created_at),
    )
    .slice(0, 4);
  const canEdit = editable(w.report.status);
  const divertedPct = sum.kg ? Math.round((sum.diverted / sum.kg) * 100) : 0;

  return (
    <WorkspaceGate>
      <Screen refreshing={loading} onRefresh={() => void refresh()}>
        <Card style={{ gap: spacing.md }}>
          <Row style={{ alignItems: "flex-start" }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.sm,
                backgroundColor: colors.greenSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name={w.organization.is_laboratory ? "thermometer" : "coffee"}
                size={20}
                color={colors.green}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt variant="heading" numberOfLines={2}>
                {w.organization[`name_${language}`]}
              </Txt>
              <Txt variant="caption" style={{ color: colors.muted }}>
                {user?.[`full_name_${language}`]} ·{" "}
                {w.organization[`building_${language}`]}
              </Txt>
            </View>
          </Row>
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.border,
            }}
          />
          <PeriodPicker />
        </Card>

        <ReportNotice />

        {canEdit && (
          <Button
            title={t("Новое взвешивание", "Жаңа өлшем қосу")}
            icon="plus"
            onPress={() => router.push("/entry")}
          />
        )}

        <View style={{ gap: spacing.md }}>
          <Row style={{ alignItems: "stretch", gap: spacing.md }}>
            <Card style={{ flex: 1, gap: spacing.xs, padding: spacing.lg }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt variant="caption" style={{ color: colors.muted }}>
                  {t("За месяц", "Ай бойынша")}
                </Txt>
                <Icon name="layers" size={16} color={colors.green} />
              </Row>
              <Row style={{ alignItems: "baseline", gap: spacing.xs }}>
                <Txt selectable variant="title">
                  {number(sum.kg)}
                </Txt>
                <Txt variant="caption" style={{ color: colors.muted }}>
                  кг
                </Txt>
              </Row>
              <Txt variant="caption" style={{ color: colors.muted }}>
                {t(`Записей: ${w.records.length}`, `Жазбалар: ${w.records.length}`)}
              </Txt>
            </Card>

            <Card style={{ flex: 1, gap: spacing.xs, padding: spacing.lg }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt variant="caption" style={{ color: colors.muted }}>
                  {t("Сегодня", "Бүгін")}
                </Txt>
                <Icon name="sun" size={16} color={colors.blue} />
              </Row>
              <Row style={{ alignItems: "baseline", gap: spacing.xs }}>
                <Txt selectable variant="title">
                  {number(daily.kg)}
                </Txt>
                <Txt variant="caption" style={{ color: colors.muted }}>
                  кг
                </Txt>
              </Row>
              <Txt variant="caption" style={{ color: colors.muted }}>
                {t(
                  `Взвешиваний: ${todaysRecords.length}`,
                  `Өлшемдер: ${todaysRecords.length}`,
                )}
              </Txt>
            </Card>
          </Row>

          <Row style={{ alignItems: "stretch", gap: spacing.md }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate("/(tabs)/report")}
              style={{ flex: 1 }}
            >
              <Card style={{ flex: 1, gap: spacing.xs, padding: spacing.lg }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt variant="caption" style={{ color: colors.muted }}>
                    {t("Вне полигона", "Полигоннан тыс")}
                  </Txt>
                  <Icon name="pie-chart" size={16} color={colors.green} />
                </Row>
                <Txt selectable variant="title">
                  {divertedPct}%
                </Txt>
                <Txt variant="caption" style={{ color: colors.muted }}>
                  {t("На переработку", "Қайта өңдеуге")}
                </Txt>
              </Card>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate("/(tabs)/report")}
              style={{ flex: 1 }}
            >
              <Card
                style={{
                  flex: 1,
                  gap: spacing.xs,
                  padding: spacing.lg,
                  backgroundColor: colors.emeraldSoft,
                  borderColor: "#A7F3D0",
                }}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt variant="caption" style={{ color: colors.emerald }}>
                    {t("Экономия CO₂", "CO₂ үнемдеу")}
                  </Txt>
                  <Icon name="feather" size={16} color={colors.emerald} />
                </Row>
                <Row style={{ alignItems: "baseline", gap: spacing.xs }}>
                  <Txt
                    selectable
                    variant="title"
                    style={{ color: colors.emerald }}
                  >
                    {number(sum.co2)}
                  </Txt>
                  <Txt variant="caption" style={{ color: colors.emerald }}>
                    кг
                  </Txt>
                </Row>
                <Txt variant="caption" style={{ color: colors.emerald }}>
                  {t("Отчёт и детали →", "Есеп пен егжей-тегжей →")}
                </Txt>
              </Card>
            </Pressable>
          </Row>
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionTitle
            title={t("Последние записи", "Соңғы жазбалар")}
            action={t("Журнал", "Журнал")}
            onPress={() => router.navigate("/(tabs)/journal")}
          />
          {recent.length ? (
            <Group>
              {recent.map((record, i) => (
                <RecordRow
                  key={record.id}
                  record={record}
                  showDate
                  last={i === recent.length - 1}
                />
              ))}
            </Group>
          ) : (
            <EmptyState
              title={t(
                "Запишите первое взвешивание",
                "Алғашқы өлшемді жазыңыз",
              )}
              description={t(
                "Дата и рекомендуемый способ утилизации подставятся автоматически.",
                "Күн мен ұсынылған кәдеге жарату тәсілі автоматты толтырылады.",
              )}
              action={canEdit ? t("Добавить запись", "Жазба қосу") : undefined}
              onPress={() => router.push("/entry")}
            />
          )}
        </View>
      </Screen>
    </WorkspaceGate>
  );
}
