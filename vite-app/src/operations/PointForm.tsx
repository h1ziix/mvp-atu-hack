import { useCallback, useState, type FormEvent } from "react"
import { ArrowRight, Eye, EyeOff, Leaf, LogOut, MapPin } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useReportingQuery } from "@/reporting/useReportingQuery"
import type { Operations, Point } from "./model"
import { PointEntries } from "./PointEntries"

export default function PointForm({
  operations,
  pointToken,
  onExit,
}: {
  operations: Operations | null
  pointToken: string
  onExit: (token: string) => void
}) {
  const load = useCallback(() => {
    if (!operations)
      return Promise.reject(
        new Error("Подключение к кабинету АТУ не настроено.")
      )
    if (!pointToken || pointToken.length > 150)
      return Promise.reject(new Error("Проверьте ссылку на точку."))
    return operations.point(pointToken)
  }, [operations, pointToken])
  const { result, reload } = useReportingQuery(load)
  const [token, setToken] = useState("")
  const point = result.state === "ready" ? result.data : null

  return (
    <main className="min-h-svh bg-[#f2f4fa] px-3 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 dark:bg-background">
      <div
        className={token ? "mx-auto max-w-xl space-y-4" : "mx-auto max-w-md"}
      >
        <header
          className={
            token
              ? "rounded-3xl bg-[#191b36] px-5 py-4 text-white"
              : "rounded-3xl bg-[#191b36] px-6 pt-6 pb-12 text-white"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#d9dcff] text-[#242e7a]">
                <Leaf className="size-[18px]" aria-hidden="true" />
              </span>
              АТУ · Экомониторинг
            </div>
            {token && (
              <Button
                type="button"
                variant="ghost"
                className="h-11 gap-2 px-2.5 text-sm text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  onExit(token)
                  setToken("")
                }}
              >
                <LogOut aria-hidden="true" /> Выйти
              </Button>
            )}
          </div>
          <h1 className="mt-4 text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
            {point?.organization.name_ru ?? "Форма точки АТУ"}
          </h1>
          {point?.organization.building_ru && (
            <p className="mt-2 flex items-start gap-2 text-sm text-[#cbd0eb]">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {point.organization.building_ru}
            </p>
          )}
        </header>
        {result.state === "loading" && (
          <Card className="relative mx-2 -mt-7 rounded-2xl">
            <CardContent role="status" aria-label="Загрузка точки">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        )}
        {result.state === "error" && (
          <Card className="relative mx-2 -mt-7 rounded-2xl">
            <CardContent className="space-y-3">
              <Alert variant="destructive">
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
              <Button
                type="button"
                className="h-11 px-4 text-sm"
                onClick={reload}
              >
                Повторить
              </Button>
            </CardContent>
          </Card>
        )}
        {operations &&
          point &&
          (token ? (
            <PointEntries operations={operations} point={point} token={token} />
          ) : (
            <PointSignIn
              operations={operations}
              point={point}
              onSignIn={setToken}
            />
          ))}
      </div>
    </main>
  )
}

function PointSignIn({
  operations,
  point,
  onSignIn,
}: {
  operations: Operations
  point: Point
  onSignIn: (token: string) => void
}) {
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError("")
    try {
      onSignIn(
        await operations.pointLogin(
          point,
          String(form.get("email")).trim(),
          String(form.get("password"))
        )
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="relative mx-2 -mt-7 rounded-2xl shadow-sm [--card-spacing:--spacing(5)]">
      <CardHeader className="gap-1.5">
        <h2 className="text-2xl leading-tight font-semibold tracking-tight">
          Вход в форму
        </h2>
        <p className="text-sm text-muted-foreground">
          Используйте рабочую почту, привязанную к этой точке.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={login} aria-busy={busy}>
          <Field className="gap-1.5">
            <FieldLabel className="text-sm" htmlFor="point-email">
              Рабочая почта
            </FieldLabel>
            <Input
              id="point-email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="name@atu.edu.kz"
              className="h-12 rounded-xl px-3 text-base md:text-base"
              required
            />
          </Field>
          <Field className="gap-1.5">
            <FieldLabel className="text-sm" htmlFor="point-password">
              Пароль
            </FieldLabel>
            <div className="relative">
              <Input
                id="point-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                className="h-12 rounded-xl pr-12 pl-3 text-base md:text-base"
                required
              />
              <Button
                type="button"
                size="icon-lg"
                variant="ghost"
                className="absolute inset-y-0 right-0.5 my-auto size-11 rounded-lg text-muted-foreground"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </Button>
            </div>
          </Field>
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            disabled={busy}
            className="h-12 w-full gap-2 rounded-xl text-base"
          >
            {busy ? "Входим…" : "Войти в форму"}
            <ArrowRight aria-hidden="true" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
