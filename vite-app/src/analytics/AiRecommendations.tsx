import { useState } from "react"
import {
  Activity,
  Building2,
  History,
  ListChecks,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requestAiAnalysis, type AiAnalysis } from "@/lib/ai"
import type { AnalyticsPeriod } from "./model"

export function AiRecommendations({
  token,
  period,
}: {
  token: string
  period: AnalyticsPeriod
}) {
  const [result, setResult] = useState<AiAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function generate() {
    setBusy(true)
    setError("")
    try {
      setResult(await requestAiAnalysis(token, period.fromMonth, period.mode))
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось получить рекомендации."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="space-y-4 rounded-2xl border border-indigo-200/80 bg-linear-to-b from-indigo-50 to-slate-50 p-3 sm:p-5 dark:border-indigo-400/25 dark:from-indigo-950/40 dark:to-background"
      aria-labelledby="ai-analysis-title"
      aria-busy={busy}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 px-1 py-1">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2
              id="ai-analysis-title"
              className="text-xl font-semibold tracking-tight sm:text-2xl"
            >
              ИИ-рекомендации
            </h2>
            <p className="text-sm text-muted-foreground">
              DeepSeek анализирует принятые отчёты и предлагает меры по каждой
              организации.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <Button
            type="button"
            className="h-10 w-full gap-2 rounded-lg px-4 text-sm sm:w-auto"
            disabled={busy}
            onClick={() => void generate()}
          >
            {busy ? (
              <Loader2
                className="motion-safe:animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            {busy
              ? "Анализируем отчёты…"
              : result
                ? "Обновить рекомендации"
                : "Получить рекомендации"}
          </Button>
        </div>
      </div>
      {busy && (
        <span role="status" className="sr-only">
          Готовим рекомендации по выбранному периоду.
        </span>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result?.organizations.length === 0 && (
        <p
          role="status"
          className="rounded-lg bg-card p-3 text-sm text-muted-foreground"
        >
          За этот период нет принятых записей для анализа.
        </p>
      )}
      {!!result?.organizations.length && (
        <div className="grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {result.organizations.map((item) => (
            <Card
              key={item.id}
              className="min-w-0 gap-3 rounded-xl shadow-sm ring-indigo-200/60 dark:ring-indigo-400/25"
            >
              <CardHeader className="gap-2">
                <CardTitle>
                  <div className="flex items-start gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200">
                      <Building2 className="size-4" aria-hidden="true" />
                    </span>
                    <h3 className="pt-1 text-base leading-snug font-semibold wrap-anywhere">
                      {item.name}
                    </h3>
                  </div>
                </CardTitle>
                {item.usingHistory && (
                  <CardDescription>
                    <Badge
                      variant="secondary"
                      className="h-auto max-w-full gap-1.5 py-0.5 whitespace-normal"
                    >
                      <History className="size-3 shrink-0" aria-hidden="true" />{" "}
                      По предыдущим принятым отчётам
                    </Badge>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2.5">
                <ul className="space-y-2.5">
                  {item.measures.map(({ action, check }, index) => (
                    <li
                      key={index}
                      className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-400/20 dark:bg-indigo-400/5"
                    >
                      <div className="flex items-start gap-2">
                        <ListChecks
                          className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-300"
                          aria-hidden="true"
                        />
                        <p className="text-sm leading-snug font-semibold wrap-anywhere">
                          {action}
                        </p>
                      </div>
                      <div className="flex items-start gap-2 rounded-lg bg-card p-2.5">
                        <Activity
                          className="mt-0.5 size-4 shrink-0 text-teal-700 dark:text-teal-300"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-teal-800 dark:text-teal-200">
                            Что измерить
                          </p>
                          <p className="text-sm leading-snug wrap-anywhere text-muted-foreground">
                            {check}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {item.anomalyNote && (
                  <aside className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
                    <TrendingUp
                      className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold">
                        Как проверить отклонение
                      </h4>
                      <p className="mt-1 text-sm leading-snug wrap-anywhere">
                        {item.anomalyNote}
                      </p>
                    </div>
                  </aside>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
