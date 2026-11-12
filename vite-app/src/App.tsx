import { lazy, Suspense, useState, type FormEvent } from "react"
import { ArrowRight, CircleAlert, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  browserSessionKey,
  restoreWebSession,
  useBrowserSession,
} from "@/lib/browserSession"
import { createDemoOperations } from "@/operations/demo"
import { endSession, supabaseOperations } from "@/operations/supabase"
import { createDemoSource, demoInspector, demoPeriod } from "./review/demo"
import type { WorkspaceUser } from "./review/model"
import {
  restoreWorkspace,
  signInWorkspace,
  supabase,
  supabaseReviewSource,
} from "./review/supabase"

const realSource = supabase && supabaseReviewSource(supabase)
const realOperations = supabase && supabaseOperations(supabase)
const demoEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === "true"
const Workspace = lazy(() => import("./Workspace"))
const PointForm = lazy(() => import("@/operations/PointForm"))
const restoreCabinet = (token: string) =>
  supabase ? restoreWorkspace(supabase, token) : Promise.resolve(null)
const restorePointProfile = (token: string) =>
  supabase ? restoreWebSession(supabase, token) : Promise.resolve(null)

export function App() {
  const pointToken = new URLSearchParams(window.location.search).get("point")
  const cabinet = useBrowserSession(
    supabase && pointToken === null ? browserSessionKey("workspace") : null,
    restoreCabinet
  )
  const [demoUser, setDemoUser] = useState<WorkspaceUser | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [demoSource] = useState(() => (demoEnabled ? createDemoSource() : null))
  const [demoOperations] = useState(
    () => demoSource && createDemoOperations(demoSource)
  )
  const user =
    demoUser ??
    (cabinet.session.state === "signed-in" ? cabinet.session.value : null)
  const source = demoUser ? demoSource : realSource
  const operations = demoUser ? demoOperations : realOperations

  function closeSession(token?: string) {
    if (supabase && token && token !== "demo" && token !== "demo-point")
      void endSession(supabase, token)
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError("")
    try {
      const signedInUser = await signInWorkspace(
        supabase,
        String(form.get("email")).trim(),
        String(form.get("password"))
      )
      cabinet.remember(signedInUser, signedInUser.token)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти.")
    } finally {
      setBusy(false)
    }
  }

  if (pointToken !== null) {
    return (
      <Suspense fallback={<p role="status">Загрузка формы…</p>}>
        <PointForm
          pointToken={pointToken}
          operations={
            pointToken.startsWith("demo-") ? demoOperations : realOperations
          }
          onExit={closeSession}
          restoreProfile={
            !supabase || pointToken.startsWith("demo-") ? null : restorePointProfile
          }
        />
      </Suspense>
    )
  }

  if (source && user) {
    return (
      <Suspense
        fallback={
          <main className="grid min-h-svh place-items-center bg-muted/50 p-4">
            <Card role="status">
              <CardContent>Загрузка кабинета…</CardContent>
            </Card>
          </main>
        }
      >
        <Workspace
          source={source}
          operations={operations}
          user={user}
          onExit={() => {
            closeSession(user.token)
            if (demoUser) setDemoUser(null)
            else cabinet.clear()
          }}
          simulateSubmission={
            demoUser ? demoSource?.submitFromMobile : undefined
          }
          initialPeriod={demoUser ? demoPeriod : undefined}
        />
      </Suspense>
    )
  }

  return (
    <main className="grid min-h-svh place-items-center bg-muted/50 p-4 sm:p-8">
      <Card className="w-full max-w-md gap-6 py-6 [--card-spacing:--spacing(6)] sm:py-8 sm:[--card-spacing:--spacing(8)]">
        <CardHeader className="gap-2">
          <div className="mb-3 flex items-center gap-2 font-medium text-primary">
            <img src="/ecovision.svg" alt="" className="size-8" />
            EcoVision · АТУ
          </div>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight">
              Вход в кабинет
            </h1>
          </CardTitle>
          <CardDescription>
            Войдите, чтобы открыть отчёты и аналитику подразделений АТУ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cabinet.session.state === "restoring" ? (
            <p role="status" className="text-sm">
              Восстанавливаем сессию…
            </p>
          ) : cabinet.session.state === "failed" ? (
            <div className="space-y-3">
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>
                  Не удалось проверить сохранённую сессию.
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-2">
                <Button onClick={cabinet.retry}>Повторить</Button>
                <Button variant="outline" onClick={cabinet.clear}>
                  Войти заново
                </Button>
              </div>
            </div>
          ) : supabase ? (
            <form onSubmit={signIn}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="login-email">Рабочая почта</FieldLabel>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="name@atu.edu.kz"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="login-password">Пароль</FieldLabel>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>
                {error && (
                  <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  className="w-full"
                  size="lg"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? "Вход…" : "Войти"}
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Button>
              </FieldGroup>
            </form>
          ) : (
            <Alert role="note">
              <Info aria-hidden="true" />
              <AlertDescription>
                Для входа подключите Supabase по инструкции в README.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        {demoEnabled && cabinet.session.state === "signed-out" && (
          <CardFooter className="flex flex-col gap-2">
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => {
                setDemoUser({
                  ...demoInspector,
                  role: "inspector",
                  token: "demo",
                })
              }}
            >
              Открыть деморежим
            </Button>
            <Button
              className="w-full"
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setDemoUser({
                  id: "demo-admin",
                  name: "Демо-администратор",
                  role: "admin",
                  token: "demo",
                })
              }}
            >
              Открыть демо-админку
            </Button>
          </CardFooter>
        )}
      </Card>
    </main>
  )
}

export default App
