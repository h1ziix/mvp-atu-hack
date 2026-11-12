import { Tabs } from "expo-router";
import { Icon } from "@/components/ui";
import { useApp } from "@/providers/app-provider";
import { colors, typography } from "@/theme";

export default function WebTabsLayout() {
  const { user, t } = useApp();
  if (!user) return null;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: typography.caption,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: t("Обзор", "Шолу"),
          tabBarIcon: ({ color }) => (
            <Icon name="grid" color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: t("Журнал", "Журнал"),
          tabBarIcon: ({ color }) => (
            <Icon name="list" color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t("Отчёт", "Есеп"),
          tabBarIcon: ({ color }) => (
            <Icon name="pie-chart" color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("Моя точка", "Ұйым"),
          tabBarIcon: ({ color }) => (
            <Icon name="map-pin" color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
