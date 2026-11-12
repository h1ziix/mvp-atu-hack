import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui";
import { useApp } from "@/providers/app-provider";
import { colors } from "@/theme";

export default function TabsLayout() {
  const { user, t } = useApp();
  const insets = useSafeAreaInsets();
  if (!user) return null;

  const bottomPad = Math.max(insets.bottom + 8, 22);

  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          height: 60 + bottomPad,
          paddingTop: 8,
          paddingBottom: bottomPad,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: t("Обзор", "Шолу"),
          tabBarIcon: ({ focused }) => (
            <Icon
              name="grid"
              size={19}
              color={focused ? colors.green : colors.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: t("Журнал", "Журнал"),
          tabBarIcon: ({ focused }) => (
            <Icon
              name="list"
              size={19}
              color={focused ? colors.green : colors.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t("Отчёт", "Есеп"),
          tabBarIcon: ({ focused }) => (
            <Icon
              name="pie-chart"
              size={19}
              color={focused ? colors.green : colors.muted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("Моя точка", "Ұйым"),
          tabBarIcon: ({ focused }) => (
            <Icon
              name="user"
              size={19}
              color={focused ? colors.green : colors.muted}
            />
          ),
        }}
      />
    </Tabs>
  );
}
