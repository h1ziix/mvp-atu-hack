import {
  useCallback,
  useId,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSheetOverlay } from "./sheet";
import { Icon, Txt } from "./ui";
import { colors, layout, radius, spacing } from "@/theme";

type TriggerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function NativePicker({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const pickerId = useId();
  const [localOpen, setLocalOpen] = useState(false);
  const [rect, setRect] = useState<TriggerRect | null>(null);
  const triggerRef = useRef<ComponentRef<typeof View>>(null);
  const sheetOverlay = useSheetOverlay();
  const setSheetOverlay = sheetOverlay?.setOverlay;
  const open = sheetOverlay ? sheetOverlay.activeId === pickerId : localOpen;
  const selected = options.find((o) => o.value === value) ?? options[0];

  const closeMenu = useCallback(() => {
    setLocalOpen(false);
    setSheetOverlay?.(null, null);
  }, [setSheetOverlay]);

  const renderFloatingMenu = useCallback(
    (box: TriggerRect) => {
      const windowHeight = Dimensions.get("window").height;
      const estimatedMenuHeight = Math.min(options.length * 46 + 8, 260);
      const spaceBelow = windowHeight - (box.y + box.height);
      const openUpward =
        spaceBelow < estimatedMenuHeight + 24 && box.y > estimatedMenuHeight;

      return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={closeMenu}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              position: "absolute",
              left: box.x,
              width: box.width,
              ...(openUpward
                ? { bottom: windowHeight - box.y + 6 }
                : { top: box.y + box.height + 6 }),
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              overflow: "hidden",
              elevation: 8,
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isLast = index === options.length - 1;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onChange(option.value);
                    closeMenu();
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: 46,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.sm,
                    gap: spacing.md,
                    borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                    backgroundColor: pressed
                      ? colors.pressed
                      : isSelected
                        ? colors.greenSoft
                        : colors.surface,
                  })}
                >
                  <Txt
                    variant="body"
                    style={{
                      flex: 1,
                      color: isSelected ? colors.green : colors.ink,
                      fontWeight: isSelected ? "600" : "400",
                    }}
                  >
                    {option.label}
                  </Txt>
                  {isSelected && (
                    <Icon name="check" size={16} color={colors.green} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    },
    [closeMenu, onChange, options, value],
  );

  const openMenu = useCallback(() => {
    if (disabled) return;
    if (open) {
      closeMenu();
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const measured: TriggerRect = {
        x: x || spacing.xl,
        y: y || 200,
        width: width || Dimensions.get("window").width - spacing.xl * 2,
        height: height || layout.touch,
      };
      setRect(measured);
      if (setSheetOverlay) {
        setSheetOverlay(pickerId, renderFloatingMenu(measured));
      } else {
        setLocalOpen(true);
      }
    });
  }, [closeMenu, disabled, open, pickerId, renderFloatingMenu, setSheetOverlay]);

  return (
    <View style={{ gap: spacing.xs }}>
      <Txt variant="label">{label}</Txt>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected?.label ?? ""}`}
          accessibilityState={{ expanded: open, disabled: !!disabled }}
          disabled={disabled}
          onPress={openMenu}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: layout.touch,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: open ? colors.green : colors.border,
            backgroundColor: pressed ? colors.pressed : colors.surface,
            gap: spacing.md,
            opacity: disabled ? 0.5 : 1,
          })}
        >
          <Txt
            variant="body"
            numberOfLines={2}
            style={{ flex: 1, color: colors.ink }}
          >
            {selected?.label ?? "—"}
          </Txt>
          <Icon
            name={open ? "chevron-up" : "chevron-down"}
            size={17}
            color={open ? colors.green : colors.muted}
          />
        </Pressable>
      </View>

      {!sheetOverlay && open && rect && !disabled && (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          statusBarTranslucent
          hardwareAccelerated
          onRequestClose={closeMenu}
        >
          {renderFloatingMenu(rect)}
        </Modal>
      )}
    </View>
  );
}
