import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider, useApp } from "@/providers/app-provider";
import { IconButton } from "@/components/ui";
import { colors, typography } from "@/theme";

function RootNavigator() {
  const { hydrated, user, t } = useApp();
  if (!hydrated)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.green} />
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.green,
          headerTitleStyle: { color: colors.ink, ...typography.heading },
          headerShadowVisible: false,
        }}
      >
        <Stack.Protected guard={!user}>
          <Stack.Screen
            name="index"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="scan"
            options={{ title: t("QR-код организации", "Ұйымның QR-коды") }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="entry"
            options={{
              title: t("Запись отходов", "Қалдық жазбасы"),
              presentation: "modal",
              headerLeft: () => (
                <IconButton
                  name="x"
                  label={t("Закрыть форму", "Форманы жабу")}
                  onPress={() => {
                    if (router.canGoBack()) router.back();
                    else router.replace("/(tabs)");
                  }}
                />
              ),
            }}
          />
        </Stack.Protected>
      </Stack>
    </View>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
