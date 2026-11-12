import { Stack } from "expo-router";
import { colors, typography } from "@/theme";

export function TabStack({ title }: { title: string }) {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.green,
        headerTitleStyle: { color: colors.ink, ...typography.heading },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
