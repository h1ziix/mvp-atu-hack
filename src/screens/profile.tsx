import { useState } from "react";
import { View } from "react-native";
import { useApp } from "@/providers/app-provider";
import {
  ErrorText,
  Group,
  ListRow,
  ModeTabs,
  Notice,
  Screen,
  SectionTitle,
  Txt,
  useConfirm,
} from "@/components/ui";
import { WorkspaceGate } from "@/components/workspace";
import { backendConfigured } from "@/lib/supabase";
import { colors, spacing } from "@/theme";

export default function ProfileScreen() {
  const {
    workspace: w,
    user,
    language,
    setLanguage,
    t,
    logout,
    offline,
  } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const { confirm, dialog } = useConfirm();
  if (!w || !user) return <WorkspaceGate>{null}</WorkspaceGate>;
  async function signOut() {
    if (
      !(await confirm(
        t("Выйти из аккаунта?", "Аккаунттан шығу керек пе?"),
        t(
          "Записи и черновик сохранятся. Вы сможете войти снова.",
          "Жазбалар мен жоба сақталады. Қайта кіре аласыз.",
        ),
        t("Выйти", "Шығу"),
      ))
    )
      return;
    setLeaving(true);
    try {
      await logout();
    } catch {
      setError("storage");
      setLeaving(false);
    }
  }
  return (
    <WorkspaceGate>
      <Screen>
        <View style={{ gap: spacing.xs }}>
          <Txt variant="heading">{w.organization[`name_${language}`]}</Txt>
          <Txt style={{ color: colors.muted }}>
            {w.organization[`building_${language}`]}
          </Txt>
        </View>
        <View style={{ gap: spacing.sm }}>
          <SectionTitle title={t("Ответственное лицо", "Жауапты тұлға")} />
          <Group>
            <ListRow
              icon="user"
              title={user[`full_name_${language}`]}
              detail={user.email}
              last
            />
          </Group>
        </View>
        <View style={{ gap: spacing.sm }}>
          <SectionTitle title={t("Язык приложения", "Қолданба тілі")} />
          <ModeTabs
            value={language}
            onChange={setLanguage}
            options={[
              { value: "ru", label: "Русский" },
              { value: "kz", label: "Қазақша" },
            ]}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <SectionTitle title={t("Данные", "Деректер")} />
          <Group>
            <ListRow
              icon={backendConfigured ? "cloud" : "inbox"}
              title={
                backendConfigured
                  ? t("Общая база АТУ", "АТУ ортақ базасы")
                  : t("Демонстрационный режим", "Демонстрациялық режим")
              }
              detail={
                backendConfigured
                  ? offline
                    ? t(
                        "Нет связи. Доступна сохранённая копия.",
                        "Байланыс жоқ. Сақталған көшірме қолжетімді.",
                      )
                    : t(
                        "Записи и статусы обновляются между устройствами.",
                        "Жазбалар мен күйлер құрылғылар арасында жаңарады.",
                      )
                  : t(
                      "Изменения хранятся только на этом устройстве.",
                      "Өзгерістер тек осы құрылғыда сақталады.",
                    )
              }
              last
            />
          </Group>
        </View>
        {w.organization.is_laboratory && (
          <Notice
            text={t(
              "В форме указывается дата лабораторного занятия.",
              "Формада зертханалық сабақ күні көрсетіледі.",
            )}
          />
        )}
        <ErrorText code={error} />
        <Group>
          <ListRow
            icon="log-out"
            title={t("Выйти из аккаунта", "Аккаунттан шығу")}
            destructive
            loading={leaving}
            onPress={() => void signOut()}
            last
          />
        </Group>
        <Txt
          variant="caption"
          style={{ color: colors.muted, textAlign: "center" }}
        >
          EcoVision · ATU · 1.0
        </Txt>
      </Screen>
      {dialog}
    </WorkspaceGate>
  );
}
