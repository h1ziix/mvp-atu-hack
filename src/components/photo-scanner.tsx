import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Row, Txt } from "./ui";
import { colors, radius, spacing } from "@/theme";

const PHOTO_HEIGHT = 180;

export function PhotoPreviewWithScanner({
  uri,
  scanning,
  disabled,
  onCancelScan,
  onRemovePhoto,
  t,
}: {
  uri: string;
  scanning: boolean;
  disabled?: boolean;
  onCancelScan: () => void;
  onRemovePhoto: () => void;
  t: (ru: string, kz: string) => string;
}) {
  const [scanY] = useState(() => new Animated.Value(8));
  const [pulse] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    if (!scanning) {
      scanY.stopAnimation();
      pulse.stopAnimation();
      return;
    }
    scanY.setValue(8);
    pulse.setValue(0.55);

    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: PHOTO_HEIGHT - 12,
          duration: 1450,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanY, {
          toValue: 8,
          duration: 1450,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    sweep.start();
    glow.start();
    return () => {
      sweep.stop();
      glow.stop();
    };
  }, [pulse, scanY, scanning]);

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{
          width: "100%",
          height: PHOTO_HEIGHT,
          borderRadius: radius.md,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: scanning ? colors.green : colors.border,
          position: "relative",
          backgroundColor: colors.pressed,
        }}
      >
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel={t("Фото отходов", "Қалдықтар фотосы")}
        />

        {scanning && (
          <View style={[StyleSheet.absoluteFill, styles.scrim]}>
            {/* Pulsing viewfinder corners */}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { margin: 12, opacity: pulse },
              ]}
            >
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </Animated.View>

            {/* Sweeping laser line + glow */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.laserContainer,
                { transform: [{ translateY: scanY }] },
              ]}
            >
              <View style={styles.laserGlow} />
              <View style={styles.laserLine} />
            </Animated.View>

            {/* Bottom status bar inside photo */}
            <View style={styles.hudBar}>
              <Row style={{ gap: spacing.sm, flex: 1 }}>
                <Animated.View
                  style={[styles.liveDot, { opacity: pulse }]}
                />
                <Txt
                  variant="caption"
                  numberOfLines={1}
                  style={{ color: colors.white, fontWeight: "600", flex: 1 }}
                >
                  {t("Идёт анализ фото…", "Фото талдануда…")}
                </Txt>
              </Row>
              <Pressable
                accessibilityRole="button"
                onPress={onCancelScan}
                style={({ pressed }) => [
                  styles.cancelPill,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Txt
                  variant="caption"
                  style={{ color: colors.white, fontWeight: "600" }}
                >
                  {t("Отмена", "Болдырмау")}
                </Txt>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {!scanning && (
        <Row style={{ justifyContent: "space-between" }}>
          <Txt variant="caption" style={{ color: colors.muted }}>
            {t("Фото прикреплено к записи", "Фото жазбаға тіркелді")}
          </Txt>
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onRemovePhoto}
          >
            <Txt
              variant="caption"
              style={{ color: colors.red, fontWeight: "600" }}
            >
              {t("Удалить фото", "Фотоны жою")}
            </Txt>
          </Pressable>
        </Row>
      )}
    </View>
  );
}

const CORNER_SIZE = 22;
const CORNER_WIDTH = 3;
const SCAN_COLOR = "#60A5FA";

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: "rgba(9, 9, 11, 0.34)",
    justifyContent: "flex-end",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: SCAN_COLOR,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 6,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 6,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 6,
  },
  laserContainer: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    height: 18,
    justifyContent: "center",
  },
  laserGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(59, 130, 246, 0.32)",
  },
  laserLine: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "#93C5FD",
  },
  hudBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(9, 9, 11, 0.68)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SCAN_COLOR,
  },
  cancelPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
});
