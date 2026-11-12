import { useState } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "@/providers/app-provider";
import { colors, layout, radius, spacing } from "@/theme";
import { dateLabel, localDate, monthLabel } from "@/utils/domain";
import { Icon, Sheet, Txt } from "./ui";

export function DatePicker({
  value,
  month,
  onChange,
  label,
  disabled,
}: {
  value: string;
  month: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { language, t } = useApp();
  const start = new Date(`${month}-01T12:00:00`);
  const offset = (start.getDay() + 6) % 7;
  const count = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
  ).getDate();
  const today = localDate();
  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <Txt variant="label">{label}</Txt>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            minHeight: layout.touch,
            borderWidth: 1,
            borderColor: open ? colors.green : colors.border,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.sm,
            backgroundColor: pressed ? colors.pressed : colors.surface,
            gap: spacing.md,
            opacity: disabled ? 0.5 : 1,
          })}
        >
          <Icon name="calendar" size={17} color={colors.green} />
          <Txt style={{ flex: 1 }}>
            {value === today ? t("Сегодня, ", "Бүгін, ") : ""}
            {dateLabel(value, language)}
          </Txt>
          <Icon name="chevron-down" size={17} color={colors.muted} />
        </Pressable>
      </View>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={monthLabel(month, language)}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginHorizontal: -spacing.sm,
          }}
        >
          {(language === "ru"
            ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
            : ["Дс", "Сс", "Ср", "Бс", "Жм", "Сб", "Жс"]
          ).map((day) => (
            <View
              key={day}
              style={{
                width: "14.2857%",
                alignItems: "center",
                paddingVertical: spacing.md,
              }}
            >
              <Txt variant="caption" style={{ color: colors.muted }}>
                {day}
              </Txt>
            </View>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <View key={`empty-${i}`} style={{ width: "14.2857%" }} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={date}
                accessibilityState={{
                  disabled: date > today,
                  selected: value === date,
                }}
                disabled={date > today}
                onPress={() => {
                  onChange(date);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  width: "14.2857%",
                  minHeight: layout.touch,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: radius.sm,
                  backgroundColor:
                    value === date ? colors.green : "transparent",
                  opacity: date > today ? 0.25 : pressed ? 0.5 : 1,
                })}
              >
                <Txt
                  style={{ color: value === date ? colors.white : colors.ink }}
                >
                  {i + 1}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}
