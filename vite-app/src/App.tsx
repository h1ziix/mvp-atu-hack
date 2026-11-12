import { lazy, Suspense, useState, type FormEvent } from "react"
import { ArrowRight, CircleAlert, Info, Leaf } from "lucide-react"
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
import { createDemoOperations } from "@/operations/demo"
import { endSession, supabaseOperations } from "@/operations/supabase"
import { createDemoSource, demoInspector, demoPeriod } from "./review/demo"
import type { WorkspaceUser } from "./review/model"
import {
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

export function App() {
  const [user, setUser] = useState<WorkspaceUser | null>(null)
  const [demo, setDemo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [demoSource] = useState(() => (demoEnabled ? createDemoSource() : null))
  const [demoOperations] = useState(
    () => demoSource && createDemoOperations(demoSource)
  )
  const source = demo ? demoSource : realSource
  const operations = demo ? demoOperations : realOperations
  const pointToken = new URLSearchParams(window.location.search).get("point")

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
      setUser(
        await signInWorkspace(
          supabase,
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

  if (pointToken !== null) {
    return (
      <Suspense fallback={<p role="status">Загрузка формы…</p>}>
        <PointForm
          pointToken={pointToken}
          operations={
            pointToken.startsWith("demo-") ? demoOperations : realOperations
          }
          onExit={closeSession}
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
            setUser(null)
            setDemo(false)
          }}
          simulateSubmission={demo ? demoSource?.submitFromMobile : undefined}
          initialPeriod={demo ? demoPeriod : undefined}
        />
      </Suspense>
    )
  }

  return (
    <main className="grid min-h-svh place-items-center bg-muted/50 p-4 sm:p-8">
      <Card className="w-full max-w-md gap-6 py-6 [--card-spacing:--spacing(6)] sm:py-8 sm:[--card-spacing:--spacing(8)]">
        <CardHeader className="gap-2">
          <div className="mb-3 flex items-center gap-2 font-medium text-primary">
            <span className="grid size-8 place-items-center rounded-md bg-primary/10">
              <Leaf className="size-4" aria-hidden="true" />
            </span>
            АТУ · Экомониторинг
          </div>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight">
              Кабинет АТУ
            </h1>
          </CardTitle>
          <CardDescription>
            Войдите, чтобы открыть отчёты и аналитику подразделений АТУ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {supabase ? (
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
        {demoEnabled && (
          <CardFooter className="flex flex-col gap-2">
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => {
                setDemo(true)
                setUser({ ...demoInspector, role: "inspector", token: "demo" })
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
                setDemo(true)
                setUser({
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
