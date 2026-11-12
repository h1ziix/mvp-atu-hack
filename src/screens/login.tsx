import { useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Brand,
  Button,
  Card,
  ErrorText,
  Field,
  Group,
  IconButton,
  ListRow,
  ModeTabs,
  Row,
  Screen,
  Txt,
} from "@/components/ui";
import { demoUsers, organizations } from "@/data/demo";
import { backendConfigured } from "@/lib/supabase";
import { useApp } from "@/providers/app-provider";
import { colors, radius, spacing } from "@/theme";
import { orgFromQr } from "@/utils/domain";

export default function LoginScreen() {
  const { user } = useApp();
  const params = useLocalSearchParams<{ org?: string; qr?: string }>();
  const code = orgFromQr(params.org ?? params.qr ?? "");
  if (user) return null;
  return (
    <LoginForm
      key={code ?? "login"}
      emailForQr={demoUsers.find((u) => u.org_code === code)?.email}
    />
  );
}
function LoginForm({ emailForQr }: { emailForQr?: string }) {
  const { login, language, setLanguage, t } = useApp();
  const [mode, setMode] = useState<"demo" | "email">(
    emailForQr ? "email" : "demo",
  );
  const [email, setEmail] = useState(emailForQr ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  async function enter(mail = email, pass = password) {
    if (busy) return;
    setBusy(mail);
    setError(null);
    try {
      await login(mail, pass);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "credentials"
          ? "credentials"
          : "network",
      );
    } finally {
      setBusy(null);
    }
  }
  const labels = [
    [
      t("Столовая «Искандер»", "«Искандер» асханасы"),
      t("Корпуса 1 и 2 · Главная демо-точка", "1 және 2-корпус · Негізгі демо"),
      t("Черновик", "Жоба"),
    ],
    [
      t("Кофейня Canella", "Canella кофеханасы"),
      t("Главный корпус · Кофейня", "Бас корпус · Кофехана"),
      t("Возврат", "Қайтарылды"),
    ],
    [
      "ATU INN",
      t("Учебно-гостиничный комплекс", "Оқу-қонақ үй кешені"),
      t("Отправлено", "Жіберілді"),
    ],
    [
      t("Кафедра ТПП", "ТӨТ кафедрасы"),
      t("Учебная лаборатория · Тара + кости", "Оқу зертханасы · Ыдыс + сүйек"),
      t("Лаб.", "Зертх."),
    ],
    [
      t("Кафедра ТХиПП", "НӨӨТ кафедрасы"),
      t("Учебная лаборатория · 8 видов", "Оқу зертханасы · 8 түр"),
      t("Принято", "Қабылданды"),
    ],
  ];
  return (
    <Screen>
      <Row style={{ justifyContent: "space-between", paddingTop: spacing.sm }}>
        <Brand small />
        <Row
          style={{
            backgroundColor: colors.pressed,
            borderRadius: radius.sm,
            padding: 2,
            gap: 2,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {(["ru", "kz"] as const).map((lang) => (
            <Pressable
              key={lang}
              accessibilityRole="button"
              onPress={() => setLanguage(lang)}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.sm - 2,
                backgroundColor:
                  language === lang ? colors.surface : "transparent",
              }}
            >
              <Txt
                variant="caption"
                style={{
                  fontWeight: "600",
                  color: language === lang ? colors.ink : colors.muted,
                }}
              >
                {lang === "ru" ? "RU" : "KZ"}
              </Txt>
            </Pressable>
          ))}
        </Row>
      </Row>

      <View style={{ gap: spacing.xs }}>
        <Txt variant="title">
          {t("Вход в систему учёта", "Есеп жүйесіне кіру")}
        </Txt>
        <Txt variant="body" style={{ color: colors.muted }}>
          {t(
            "Выберите подразделение АТУ для быстрого входа или авторизуйтесь по почте.",
            "Жылдам кіру үшін АТУ бөлімшесін таңдаңыз немесе поштамен кіріңіз.",
          )}
        </Txt>
      </View>

      <ModeTabs
        value={mode}
        onChange={setMode}
        options={[
          { value: "demo", label: t("Быстрый демо-вход", "Демо-кіру") },
          { value: "email", label: t("По почте", "Поштамен") },
        ]}
      />
      <ErrorText code={error} />
      {mode === "demo" ? (
        <View style={{ gap: spacing.sm }}>
          <Group>
            {demoUsers.map((demo, i) => (
              <ListRow
                key={demo.id}
                title={labels[i][0]}
                detail={labels[i][1]}
                value={labels[i][2]}
                icon={
                  organizations.find((o) => o.code === demo.org_code)
                    ?.is_laboratory
                    ? "thermometer"
                    : "coffee"
                }
                loading={busy === demo.email}
                disabled={!!busy}
                onPress={() => void enter(demo.email, "atu2026")}
                last={i === demoUsers.length - 1}
              />
            ))}
          </Group>
        </View>
      ) : (
        <Card style={{ gap: spacing.lg }}>
          <Field
            label={t("Электронная почта", "Электрондық пошта")}
            placeholder="iskander@atu.edu.kz"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            editable={!busy}
          />
          <Field
            label={t("Пароль", "Құпиясөз")}
            placeholder={t("Введите пароль", "Құпиясөзді енгізіңіз")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            editable={!busy}
            onSubmitEditing={() => void enter()}
            right={
              <IconButton
                name={showPassword ? "eye-off" : "eye"}
                color={colors.muted}
                label={
                  showPassword
                    ? t("Скрыть пароль", "Құпиясөзді жасыру")
                    : t("Показать пароль", "Құпиясөзді көрсету")
                }
                onPress={() => setShowPassword((v) => !v)}
              />
            }
          />
          <Button
            title={t("Войти в точку", "Жүйеге кіру")}
            disabled={!email.trim() || !password || !!busy}
            loading={!!busy}
            onPress={() => void enter()}
          />
        </Card>
      )}
      <Button
        title={t("Сканировать QR-код точки", "Ұйымның QR-кодын сканерлеу")}
        icon="maximize"
        variant="secondary"
        disabled={!!busy}
        onPress={() => router.push("/scan")}
      />
      <Txt
        variant="caption"
        style={{ color: colors.muted, textAlign: "center" }}
      >
        {backendConfigured
          ? t(
              "Подключено к единой базе Supabase · Realtime активен",
              "Бірыңғай Supabase базасына қосылған · Realtime белсенді",
            )
          : t(
              "Деморежим · Данные сохраняются на этом устройстве",
              "Демо · Деректер осы құрылғыда сақталады",
            )}
      </Txt>
    </Screen>
  );
}
