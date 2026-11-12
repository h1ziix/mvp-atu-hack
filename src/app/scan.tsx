import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Button, Card, Notice, Row, Screen, Txt } from "@/components/ui";
import { demoUsers } from "@/data/demo";
import { useApp } from "@/providers/app-provider";
import { orgFromQr } from "@/utils/domain";
import { colors, radius, spacing } from "@/theme";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const { login, t } = useApp();

  async function handleQrData(data: string) {
    if (scanned || signingIn) return;
    const org = orgFromQr(data);
    if (!org) {
      setError(true);
      return;
    }
    setScanned(true);
    setError(false);
    const target = demoUsers.find((u) => u.org_code === org);
    if (!target) {
      router.replace({ pathname: "/", params: { org } });
      return;
    }
    setSigningIn(target.org_name_ru);
    try {
      await login(target.email, "atu2026");
    } catch {
      router.replace({ pathname: "/", params: { org } });
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Txt variant="heading">
          {t("Наведите камеру на QR-код", "Камераны QR-кодқа бағыттаңыз")}
        </Txt>
        <Txt style={{ color: colors.muted }}>
          {t(
            "Отсканируйте QR-код подразделения на веб-панели или табличке точки для мгновенного входа.",
            "Жылдам кіру үшін веб-панельдегі немесе ұйымдағы QR-кодты сканерлеңіз.",
          )}
        </Txt>
      </View>

      {signingIn ? (
        <Card
          style={{
            minHeight: 240,
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.md,
          }}
        >
          <ActivityIndicator size="large" color={colors.green} />
          <Txt variant="label" style={{ textAlign: "center" }}>
            {t("Входим в подразделение…", "Ұйымға кіруде…")}
          </Txt>
          <Txt
            variant="caption"
            style={{ color: colors.muted, textAlign: "center" }}
          >
            {signingIn}
          </Txt>
        </Card>
      ) : permission?.granted ? (
        <View
          style={{
            height: 320,
            borderRadius: radius.lg,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            position: "relative",
          }}
        >
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={
              scanned ? undefined : ({ data }) => void handleQrData(data)
            }
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 200,
                height: 200,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: colors.white,
                backgroundColor: "transparent",
              }}
            />
          </View>
        </View>
      ) : (
        <Card style={{ gap: spacing.md }}>
          <Notice
            tone="orange"
            text={t(
              "Разрешите доступ к камере для сканирования QR-кода подразделения.",
              "Ұйымның QR-кодын сканерлеу үшін камераға рұқсат беріңіз.",
            )}
          />
          <Button
            title={t("Разрешить камеру", "Камераға рұқсат беру")}
            icon="camera"
            onPress={() => void requestPermission().catch(() => setError(true))}
          />
        </Card>
      )}

      {error && (
        <Notice
          tone="red"
          text={t(
            "Код не распознан. Проверьте, что в QR-коде указан код точки (iskander, canella, atu_inn, tpp, thipp).",
            "Код танылмады. QR-кодта ұйым коды көрсетілгенін тексеріңіз.",
          )}
        />
      )}

      <Row style={{ gap: spacing.sm }}>
        <Button
          title={t("Вернуться ко входу", "Кіруге оралу")}
          variant="secondary"
          disabled={!!signingIn}
          onPress={() => router.replace("/")}
          style={{ flex: 1 }}
        />
      </Row>
    </Screen>
  );
}
