import { useMemo, useState } from "react";
import { Pressable, SectionList, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "@/providers/app-provider";
import { Button, Icon, ModeTabs, Row, Txt } from "@/components/ui";
import {
  EmptyState,
  PeriodPicker,
  RecordRow,
  ReportNotice,
  WorkspaceGate,
} from "@/components/workspace";
import { colors, layout, radius, spacing, typography } from "@/theme";
import { dateLabel, editable, localDate, number, totals } from "@/utils/domain";
import type { WasteRecord } from "@/lib/types";

export default function JournalScreen() {
  const { workspace: w, language, t, loading, refresh } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"month" | "today">("month");
  const sections = useMemo(() => {
    if (!w) return [];
    const ids = new Set(
      w.catalog
        .filter((item) =>
          item[`name_${language}`]
            .toLowerCase()
            .includes(query.toLowerCase().trim()),
        )
        .map((item) => item.waste_type_id),
    );
    const records = w.records
      .filter(
        (r) =>
          ids.has(r.waste_type_id) &&
          (filter === "month" || r.record_date === localDate()),
      )
      .sort(
        (a, b) =>
          b.record_date.localeCompare(a.record_date) ||
          b.created_at.localeCompare(a.created_at),
      );
    const groups = new Map<string, WasteRecord[]>();
    for (const record of records)
      groups.set(record.record_date, [
        ...(groups.get(record.record_date) ?? []),
        record,
      ]);
    return [...groups].map(([date, data]) => ({ date, data }));
  }, [w, language, query, filter]);
  const count = sections.reduce((n, s) => n + s.data.length, 0);
  return (
    <WorkspaceGate>
      <SectionList
        sections={sections}
        keyExtractor={(record) => record.id}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        stickySectionHeadersEnabled={false}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: spacing.xxxl,
          width: "100%",
          maxWidth: layout.contentWidth,
          alignSelf: "center",
        }}
        refreshing={loading}
        onRefresh={() => void refresh()}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            <PeriodPicker />
            <ReportNotice />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                minHeight: layout.touch,
                backgroundColor: colors.surface,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Icon name="search" size={17} color={colors.muted} />
              <TextInput
                accessibilityLabel={t("Поиск записей", "Жазбаларды іздеу")}
                placeholder={t(
                  "Поиск по виду отхода…",
                  "Қалдық түрі бойынша іздеу…",
                )}
                placeholderTextColor={colors.placeholder}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                autoCorrect={false}
                style={{
                  ...typography.body,
                  flex: 1,
                  color: colors.ink,
                  paddingVertical: spacing.xs,
                }}
              />
              {query.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("Очистить поиск", "Іздеуді тазарту")}
                  onPress={() => setQuery("")}
                  style={{ padding: spacing.xs }}
                >
                  <Icon name="x" size={16} color={colors.muted} />
                </Pressable>
              )}
            </View>
            <Row style={{ justifyContent: "space-between", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <ModeTabs
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "month", label: t("Весь месяц", "Бүкіл ай") },
                    { value: "today", label: t("Сегодня", "Бүгін") },
                  ]}
                />
              </View>
              {w && editable(w.report.status) && (
                <Button
                  title={t("Запись", "Жазба")}
                  icon="plus"
                  onPress={() => router.push("/entry")}
                  style={{ minHeight: 46, paddingHorizontal: spacing.md }}
                />
              )}
            </Row>
            <Txt variant="caption" style={{ color: colors.muted }}>
              {t("Записей в списке: ", "Тізімдегі жазбалар: ")}
              {count}
            </Txt>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
              paddingVertical: spacing.sm,
              paddingTop: spacing.lg,
            }}
          >
            <Txt accessibilityRole="header" variant="label" style={{ flex: 1 }}>
              {section.date === localDate()
                ? t("Сегодня", "Бүгін")
                : dateLabel(section.date, language)}
            </Txt>
            <View
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.full,
                backgroundColor: colors.pressed,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Txt
                variant="caption"
                style={{ color: colors.muted, fontWeight: "600" }}
              >
                {w ? number(totals(section.data, w.catalog, w.methods).kg) : 0}{" "}
                кг
              </Txt>
            </View>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <View
              style={{
                overflow: "hidden",
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderTopWidth: first ? 1 : 0,
                borderBottomWidth: last ? 1 : 0,
                borderColor: colors.border,
                borderTopLeftRadius: first ? radius.md : 0,
                borderTopRightRadius: first ? radius.md : 0,
                borderBottomLeftRadius: last ? radius.md : 0,
                borderBottomRightRadius: last ? radius.md : 0,
              }}
            >
              <RecordRow record={item} last={last} />
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={
              query || filter === "today"
                ? t("Ничего не найдено", "Ештеңе табылмады")
                : t("За этот месяц записей нет", "Бұл айда жазба жоқ")
            }
            description={
              query || filter === "today"
                ? t(
                    "Измените запрос или покажите весь месяц.",
                    "Сұрауды өзгертіңіз немесе бүкіл айды көрсетіңіз.",
                  )
                : t("Добавьте первое взвешивание.", "Алғашқы өлшемді қосыңыз.")
            }
            action={
              query || filter === "today"
                ? t("Сбросить фильтры", "Сүзгілерді тазарту")
                : undefined
            }
            onPress={() => {
              setQuery("");
              setFilter("month");
            }}
          />
        }
      />
    </WorkspaceGate>
  );
}
