import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/providers/app-provider";
import { colors, radius, spacing, typography } from "@/theme";

type SheetOverlayContextValue = {
  activeId: string | null;
  setOverlay: (id: string | null, node: ReactNode | null) => void;
};

const SheetOverlayContext = createContext<SheetOverlayContextValue | null>(
  null,
);

export function useSheetOverlay() {
  return use(SheetOverlayContext);
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  dismissDisabled = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  dismissDisabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useApp();
  const [backdrop] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(420));
  const [overlayState, setOverlayState] = useState<{
    id: string | null;
    node: ReactNode | null;
  }>({ id: null, node: null });

  const setOverlay = useCallback(
    (id: string | null, node: ReactNode | null) => {
      setOverlayState((prev) =>
        prev.id === id && prev.node === node ? prev : { id, node },
      );
    },
    [],
  );

  useEffect(() => {
    if (visible) {
      backdrop.setValue(0);
      translateY.setValue(420);
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdrop, translateY]);

  const close = useCallback(() => {
    if (dismissDisabled) return;
    setOverlayState((prev) =>
      prev.id === null && prev.node === null ? prev : { id: null, node: null },
    );
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 130,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 420,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [backdrop, dismissDisabled, onClose, translateY]);

  const overlayContext = useMemo(
    () => ({ activeId: overlayState.id, setOverlay }),
    [overlayState.id, setOverlay],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !dismissDisabled && g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 65 || g.vy > 0.6) {
            close();
          } else {
            Animated.timing(translateY, {
              toValue: 0,
              duration: 160,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [close, dismissDisabled, translateY],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Animated.View
          renderToHardwareTextureAndroid
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.scrim, opacity: backdrop },
          ]}
        >
          <Pressable
            accessibilityLabel={t("Закрыть", "Жабу")}
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
          style={{
            maxHeight: "86%",
            width: "100%",
            maxWidth: 600,
            alignSelf: "center",
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: colors.border,
            transform: [{ translateY }],
          }}
        >
          <View
            {...panResponder.panHandlers}
            style={{
              paddingTop: spacing.sm,
              paddingBottom: spacing.md,
              paddingHorizontal: spacing.xl,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                width: 40,
                height: 5,
                borderRadius: radius.full,
                backgroundColor: colors.border,
                alignSelf: "center",
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
              <Text
                accessibilityRole="header"
                style={[typography.heading, { flex: 1, color: colors.ink }]}
              >
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Закрыть", "Жабу")}
                disabled={dismissDisabled}
                accessibilityState={{ disabled: dismissDisabled }}
                onPress={close}
                style={({ pressed }) => ({
                  width: 34,
                  height: 34,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.full,
                  backgroundColor: pressed ? colors.border : colors.pressed,
                  opacity: dismissDisabled ? 0.45 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.muted,
                  }}
                >
                  ✕
                </Text>
              </Pressable>
            </View>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => setOverlay(null, null)}
            contentContainerStyle={{
              padding: spacing.xl,
              paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl,
              gap: spacing.lg,
            }}
          >
            <SheetOverlayContext value={overlayContext}>
              {children}
            </SheetOverlayContext>
          </ScrollView>
        </Animated.View>
        {overlayState.node}
      </KeyboardAvoidingView>
    </Modal>
  );
}
