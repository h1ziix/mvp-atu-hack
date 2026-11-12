import { TabStack } from "@/components/tab-stack";
import { useApp } from "@/providers/app-provider";
export default function Layout() {
  const { t } = useApp();
  return <TabStack title={t("Журнал", "Журнал")} />;
}
