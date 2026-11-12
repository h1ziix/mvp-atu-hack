import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { SymbolView } from "expo-symbols";
import { Sheet } from "./sheet";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layout, radius, spacing, typography } from "@/theme";
import { useApp } from "@/providers/app-provider";
import type { ReportStatus } from "@/lib/types";
export { Sheet } from "./sheet";

export function Txt({
  variant = "body",
  style,
  ...props
}: TextProps & { variant?: keyof typeof typography }) {
  return (
    <Text
      style={[{ color: colors.ink }, typography[variant], style]}
      {...props}
    />
  );
}
export function Icon({
  name,
  size = 20,
  color = colors.ink,
}: {
  name: ComponentProps<typeof Feather>["name"];
  size?: number;
  color?: string;
}) {
  if (Platform.OS === "web")
    return <Feather name={name} size={size} color={color} />;
  const symbol = symbolNames[name] ?? { ios: "circle", android: "circle" };
  return (
    <SymbolView
      name={symbol}
      tintColor={color}
      size={size}
      style={{ width: size, height: size }}
    />
  );
}
export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Feather>["name"];
  style?: StyleProp<ViewStyle>;
}) {
  const color =
    variant === "primary"
      ? colors.white
      : variant === "danger"
        ? colors.red
        : variant === "secondary"
          ? colors.ink
          : colors.green;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{
        disabled: !!disabled || !!loading,
        busy: !!loading,
      }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor:
            variant === "primary"
              ? colors.green
              : variant === "secondary"
                ? colors.pressed
                : variant === "danger"
                  ? colors.redSoft
                  : "transparent",
          borderWidth: variant === "secondary" || variant === "danger" ? 1 : 0,
          borderColor:
            variant === "danger" ? colors.red : colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : icon ? (
        <Icon name={icon} color={color} size={17} />
      ) : null}
      <Txt
        variant="label"
        style={{ color, textAlign: "center", flexShrink: 1 }}
      >
        {title}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  color = colors.ink,
}: {
  name: ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: layout.touch,
        minHeight: layout.touch,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Icon name={name} color={color} />
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}
export function Field({
  label,
  right,
  ...props
}: ComponentProps<typeof TextInput> & { label: string; right?: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Txt variant="label">{label}</Txt>
      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          {...props}
          style={[
            styles.input,
            right ? { paddingRight: layout.touch + spacing.sm } : undefined,
            props.multiline && { minHeight: 96, textAlignVertical: "top" },
            props.style,
          ]}
        />
        {right && (
          <View
            style={{
              position: "absolute",
              right: 2,
              top: 0,
              bottom: 0,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {right}
          </View>
        )}
      </View>
    </View>
  );
}
export function Chip({
  title,
  selected,
  onPress,
  disabled,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.green : colors.surface,
          borderColor: selected ? colors.green : colors.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Txt
        variant="caption"
        style={{
          fontWeight: "600",
          color: selected ? colors.white : colors.ink,
        }}
      >
        {title}
      </Txt>
    </Pressable>
  );
}
export function LanguageSwitch() {
  const { language, setLanguage } = useApp();
  return (
    <Row style={{ gap: 0 }}>
      {(["ru", "kz"] as const).map((lang) => (
        <Pressable
          key={lang}
          accessibilityRole="button"
          accessibilityLabel={lang === "ru" ? "Русский язык" : "Қазақ тілі"}
          accessibilityState={{ selected: language === lang }}
          onPress={() => setLanguage(lang)}
          style={({ pressed }) => ({
            minHeight: Platform.OS === "ios" ? 44 : layout.touch,
            minWidth: Platform.OS === "ios" ? 44 : layout.touch,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.sm,
            backgroundColor:
              language === lang ? colors.greenSoft : "transparent",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Txt
            variant="caption"
            style={{
              color: language === lang ? colors.green : colors.muted,
              fontWeight: language === lang ? "700" : "400",
            }}
          >
            {lang === "ru" ? "РУС" : "ҚАЗ"}
          </Txt>
        </Pressable>
      ))}
    </Row>
  );
}
export function Brand({ small }: { small?: boolean }) {
  return (
    <Row style={{ gap: spacing.sm }}>
      <View
        style={{
          width: small ? 32 : 44,
          height: small ? 32 : 44,
          backgroundColor: colors.green,
          borderRadius: radius.sm,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="feather" color={colors.lime} size={small ? 20 : 26} />
      </View>
      <View>
        <Txt variant={small ? "label" : "heading"}>
          EcoVision
          <Txt variant="caption" style={{ color: colors.green }}>
            {" "}
            / ATU
          </Txt>
        </Txt>
        {!small && (
          <Txt variant="eyebrow" style={{ color: colors.muted }}>
            Алматинский технологический университет
          </Txt>
        )}
      </View>
    </Row>
  );
}
export const statusNames: Record<ReportStatus, [string, string]> = {
  draft: ["Черновик", "Жоба"],
  submitted: ["Отправлено", "Жіберілді"],
  in_review: ["На проверке", "Тексерілуде"],
  returned: ["На доработку", "Толықтыру қажет"],
  approved: ["Принято", "Қабылданды"],
};
const statusPalette = {
  draft: [colors.muted, colors.pressed],
  submitted: [colors.blue, colors.blueSoft],
  in_review: [colors.orange, colors.orangeSoft],
  returned: [colors.red, colors.redSoft],
  approved: [colors.emerald, colors.emeraldSoft],
};
export function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useApp();
  const [fg, bg] = statusPalette[status];
  return (
    <Row
      style={{
        alignSelf: "flex-start",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: status === "draft" ? colors.border : bg,
      }}
    >
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }}
      />
      <Txt variant="caption" style={{ color: fg, fontWeight: "600" }}>
        {t(...statusNames[status])}
      </Txt>
    </Row>
  );
}
export function Notice({
  title,
  text,
  tone = "green",
}: {
  title?: string;
  text: string;
  tone?: "green" | "red" | "orange" | "blue" | "emerald";
}) {
  const fg = colors[tone];
  const bg = colors[`${tone}Soft`];
  return (
    <View
      style={{
        padding: spacing.lg,
        gap: spacing.xs,
        borderRadius: radius.md,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {title && (
        <Txt variant="label" style={{ color: fg }}>
          {title}
        </Txt>
      )}
      <Txt selectable variant="caption" style={{ color: fg }}>
        {text}
      </Txt>
    </View>
  );
}
export function Screen({
  children,
  refreshing,
  onRefresh,
  footer,
  compactFooter,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  compactFooter?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const topPad =
    headerHeight === 0 ? Math.max(insets.top, spacing.lg) + spacing.md : spacing.xl;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={colors.green}
            />
          ) : undefined
        }
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: topPad,
          paddingBottom: compactFooter
            ? spacing.xl
            : spacing.xxxl + insets.bottom,
          gap: spacing.xl,
          width: "100%",
          maxWidth: layout.contentWidth,
          alignSelf: "center",
        }}
      >
        {children}
      </ScrollView>
      {footer && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            paddingBottom: compactFooter
              ? 0
              : Math.max(insets.bottom, spacing.md) + spacing.xs,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: layout.contentWidth,
              alignSelf: "center",
              paddingHorizontal: spacing.xl,
              paddingTop: compactFooter ? spacing.sm : spacing.md,
              paddingBottom: compactFooter ? spacing.sm : spacing.xs,
              gap: compactFooter ? spacing.xs : spacing.sm,
            }}
          >
            {footer}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
export function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Row style={{ justifyContent: "space-between", gap: spacing.sm }}>
      <Txt accessibilityRole="header" variant="heading" style={{ flex: 1 }}>
        {title}
      </Txt>
      {action && onPress && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ minHeight: layout.touch, justifyContent: "center" }}
        >
          <Txt
            variant="caption"
            style={{ color: colors.green, fontWeight: "600" }}
          >
            {action} →
          </Txt>
        </Pressable>
      )}
    </Row>
  );
}
export function useConfirm() {
  const { t } = useApp();
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    action: string;
    resolve: (v: boolean) => void;
  } | null>(null);
  function close(result: boolean) {
    dialog?.resolve(result);
    setDialog(null);
  }
  if (Platform.OS !== "web")
    return {
      confirm: (title: string, message: string, action: string) =>
        new Promise<boolean>((resolve) =>
          Alert.alert(
            title,
            message,
            [
              {
                text: t("Отмена", "Бас тарту"),
                style: "cancel",
                onPress: () => resolve(false),
              },
              {
                text: action,
                style:
                  action === t("Удалить", "Жою") ? "destructive" : "default",
                onPress: () => resolve(true),
              },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
          ),
        ),
      dialog: null,
    };
  return {
    confirm: (title: string, message: string, action: string) =>
      new Promise<boolean>((resolve) =>
        setDialog({ title, message, action, resolve }),
      ),
    dialog: (
      <Sheet
        visible={!!dialog}
        title={dialog?.title ?? ""}
        onClose={() => close(false)}
      >
        <Txt>{dialog?.message}</Txt>
        <Button title={dialog?.action ?? ""} onPress={() => close(true)} />
        <Button
          title={t("Отмена", "Бас тарту")}
          variant="ghost"
          onPress={() => close(false)}
        />
      </Sheet>
    ),
  };
}
export function ErrorText({ code }: { code: string | null }) {
  const { t } = useApp();
  if (!code) return null;
  const messages: Record<string, [string, string]> = {
    credentials: [
      "Проверьте почту и пароль. Доступ есть только у ответственного лица.",
      "Пошта мен құпиясөзді тексеріңіз. Тек жауапты тұлға кіре алады.",
    ],
    network: [
      "Не удалось подключиться. Проверьте интернет и повторите. Черновик сохранён на устройстве.",
      "Қосылу мүмкін болмады. Интернетті тексеріп, қайталаңыз. Жоба құрылғыда сақталған.",
    ],
    storage: [
      "Не удалось сохранить данные на устройстве. Проверьте свободное место.",
      "Деректер сақталмады. Құрылғыдағы бос орынды тексеріңіз.",
    ],
    amount: [
      "Введите число больше 0 и не больше 2000.",
      "0-ден үлкен, 2000-нан аспайтын сан енгізіңіз.",
    ],
    future: [
      "Дата взвешивания не может быть в будущем.",
      "Өлшеу күні болашақта болмауы тиіс.",
    ],
    date: [
      "Укажите существующую дату в формате ГГГГ-ММ-ДД.",
      "Күнді ЖЖЖЖ-АА-КК пішімінде енгізіңіз.",
    ],
    period: [
      "Дата должна входить в выбранный отчётный месяц.",
      "Күн таңдалған есепті айда болуы тиіс.",
    ],
    required: [
      "Заполните все обязательные поля.",
      "Барлық міндетті өрістерді толтырыңыз.",
    ],
    locked: [
      "Отчёт заблокирован. Обновите данные и проверьте его статус.",
      "Есеп бұғатталған. Деректерді жаңартып, күйін тексеріңіз.",
    ],
    empty: [
      "Добавьте хотя бы одно взвешивание перед отправкой.",
      "Жібермес бұрын кемінде бір өлшем қосыңыз.",
    ],
  };
  return (
    <Notice tone="red" text={t(...(messages[code] ?? messages.network))} />
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: layout.touch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderCurve: "continuous",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    borderCurve: "continuous",
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  input: {
    minHeight: layout.touch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    ...typography.body,
    color: colors.ink,
  },
  chip: {
    maxWidth: "100%",
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
  },
});

const symbolNames: Partial<
  Record<
    ComponentProps<typeof Feather>["name"],
    ComponentProps<typeof SymbolView>["name"]
  >
> = {
  feather: { ios: "leaf", android: "eco" },
  grid: { ios: "square.grid.2x2", android: "dashboard" },
  list: { ios: "list.bullet", android: "list" },
  "pie-chart": { ios: "chart.pie", android: "pie_chart" },
  "map-pin": { ios: "mappin.and.ellipse", android: "location_on" },
  calendar: { ios: "calendar", android: "calendar_today" },
  "chevron-down": { ios: "chevron.down", android: "expand_more" },
  "chevron-up": { ios: "chevron.up", android: "expand_less" },
  "chevron-right": { ios: "chevron.right", android: "chevron_right" },
  "arrow-right": { ios: "arrow.right", android: "arrow_forward" },
  "arrow-up-right": { ios: "arrow.up.right", android: "north_east" },
  plus: { ios: "plus", android: "add" },
  check: { ios: "checkmark", android: "check" },
  x: { ios: "xmark", android: "close" },
  camera: { ios: "camera", android: "photo_camera" },
  mic: { ios: "mic", android: "mic" },
  sliders: { ios: "scalemass", android: "scale" },
  image: { ios: "photo", android: "image" },
  "trash-2": { ios: "trash", android: "delete" },
  "log-out": { ios: "rectangle.portrait.and.arrow.right", android: "logout" },
  send: { ios: "paperplane", android: "send" },
  "check-circle": { ios: "checkmark.circle", android: "check_circle" },
  "alert-circle": { ios: "exclamationmark.circle", android: "error" },
  coffee: { ios: "cup.and.saucer", android: "coffee" },
  thermometer: { ios: "testtube.2", android: "science" },
  package: { ios: "shippingbox", android: "inventory_2" },
  droplet: { ios: "drop", android: "water_drop" },
  lock: { ios: "lock", android: "lock" },
  inbox: { ios: "tray", android: "inbox" },
  globe: { ios: "globe", android: "public" },
  sun: { ios: "sun.max", android: "light_mode" },
  wind: { ios: "wind", android: "air" },
  layers: { ios: "square.stack.3d.up", android: "layers" },
  maximize: { ios: "qrcode.viewfinder", android: "qr_code_scanner" },
  loader: { ios: "arrow.triangle.2.circlepath", android: "progress_activity" },
  zap: { ios: "bolt", android: "bolt" },
  user: { ios: "person", android: "person" },
  search: { ios: "magnifyingglass", android: "search" },
  eye: { ios: "eye", android: "visibility" },
  "eye-off": { ios: "eye.slash", android: "visibility_off" },
  info: { ios: "info.circle", android: "info" },
  cloud: { ios: "cloud", android: "cloud" },
};

export function Group({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          borderCurve: "continuous",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function ListRow({
  title,
  detail,
  value,
  icon,
  onPress,
  selected,
  disabled,
  loading,
  last,
  destructive,
}: {
  title: string;
  detail?: string;
  value?: string;
  icon?: ComponentProps<typeof Feather>["name"];
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  last?: boolean;
  destructive?: boolean;
}) {
  const content = (
    <>
      {icon && (
        <View
          style={{
            width: layout.iconBox,
            height: layout.iconBox,
            borderRadius: radius.sm,
            backgroundColor: destructive
              ? colors.redSoft
              : selected
                ? colors.greenSoft
                : colors.pressed,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={icon}
            size={18}
            color={
              destructive
                ? colors.red
                : selected
                  ? colors.green
                  : colors.ink
            }
          />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt
          variant="label"
          style={destructive ? { color: colors.red } : undefined}
        >
          {title}
        </Txt>
        {detail && (
          <Txt variant="caption" style={{ color: colors.muted }}>
            {detail}
          </Txt>
        )}
      </View>
      {value && (
        <Txt
          selectable
          variant="label"
          style={{
            fontVariant: ["tabular-nums"],
            flexShrink: 1,
            textAlign: "right",
            color: colors.ink,
          }}
        >
          {value}
        </Txt>
      )}
      {loading ? (
        <ActivityIndicator color={colors.green} />
      ) : selected ? (
        <Icon name="check" color={colors.green} size={18} />
      ) : onPress ? (
        <Icon name="chevron-right" color={colors.muted} size={16} />
      ) : null}
    </>
  );
  const base: ViewStyle = {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${detail ? `, ${detail}` : ""}${value ? `, ${value}` : ""}`}
      accessibilityState={{
        disabled: !!disabled || !!loading,
        ...(selected !== undefined ? { selected } : {}),
        busy: !!loading,
      }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        base,
        {
          backgroundColor: pressed
            ? colors.pressed
            : selected
              ? colors.greenSoft
              : colors.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={base}>{content}</View>
  );
}
export function ModeTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        backgroundColor: colors.pressed,
        borderRadius: radius.sm,
        padding: spacing.xs,
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            aria-selected={active}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 38,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.sm - 2,
              backgroundColor: active
                ? colors.surface
                : pressed
                  ? colors.border
                  : "transparent",
              borderWidth: active ? 1 : 0,
              borderColor: colors.border,
            })}
          >
            <Txt
              variant="label"
              style={{
                color: active ? colors.ink : colors.muted,
                textAlign: "center",
              }}
            >
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
