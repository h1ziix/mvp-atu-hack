import { useCallback, useState, type FormEvent } from "react"
import { CircleAlert, Mail } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { Status } from "@/review/model"
import { monthRange, reminderLink, type ReportingSource } from "./model"
import { useReportingQuery } from "./useReportingQuery"

const boardStatus: Record<Status, { label: string; color: string }> = {
  approved: {
    label: "Сдали",
    color: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  submitted: {
    label: "На проверке",
    color: "border-blue-200 bg-blue-50 text-blue-800",
  },
  in_review: {
    label: "На проверке",
    color: "border-blue-200 bg-blue-50 text-blue-800",
  },
  returned: {
    label: "На доработке",
    color: "border-red-200 bg-red-50 text-red-800",
  },
  draft: { label: "Не сдали", color: "bg-muted text-muted-foreground" },
}

export function SubmissionBoard({
  source,
  initialPeriod,
}: {
  source: ReportingSource
  initialPeriod: string
}) {
  const [period, setPeriod] = useState(initialPeriod)
  const [error, setError] = useState("")
  const load = useCallback(() => source.submissions(period), [source, period])
  const { result, reload } = useReportingQuery(load)

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const month = String(new FormData(event.currentTarget).get("month"))
    if (!monthRange(month)) {
      setError("Укажите месяц в формате ГГГГ-ММ.")
      return
    }
    setError("")
    if (month === period) reload()
    else setPeriod(month)
  }

  return (
    <section aria-labelledby="submissions-title" className="space-y-5">
      <h1
        id="submissions-title"
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        Контроль сдачи
      </h1>
      <Card size="sm">
        <CardContent>
          <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
            <Field className="w-auto">
              <FieldLabel htmlFor="submission-period">Месяц</FieldLabel>
              <Input
                id="submission-period"
                name="month"
                type="month"
                defaultValue={initialPeriod}
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "submission-period-error" : undefined}
              />
            </Field>
            <Button type="submit">Показать статусы</Button>
            {error && (
              <FieldError id="submission-period-error" className="w-full">
                {error}
              </FieldError>
            )}
          </form>
        </CardContent>
      </Card>

      {result.state === "loading" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status">
          <span className="sr-only">Загрузка статусов…</span>
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}
      {result.state === "error" && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
      {result.state === "ready" &&
        (result.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Нет активных подразделений.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {result.data.map((submission) => {
              const status = boardStatus[submission.status]
              const email =
                submission.status === "draft"
                  ? reminderLink(submission, period)
                  : null
              return (
                <article key={submission.organizationId}>
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>
                        <h2>{submission.organization}</h2>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Badge variant="outline" className={status.color}>
                        {status.label}
                      </Badge>
                      {submission.responsible && (
                        <p className="text-muted-foreground">
                          Ответственный: {submission.responsible}
                        </p>
                      )}
                    </CardContent>
                    {submission.status === "draft" && (
                      <CardFooter className="mt-auto">
                        {email ? (
                          <a
                            href={email}
                            className={buttonVariants({ variant: "outline" })}
                            title="Открыть письмо в почтовом приложении"
                          >
                            <Mail data-icon="inline-start" aria-hidden="true" />
                            Подготовить напоминание
                          </a>
                        ) : (
                          <p className="text-muted-foreground">
                            Почта ответственного не указана.
                          </p>
                        )}
                      </CardFooter>
                    )}
                  </Card>
                </article>
              )
            })}
          </div>
        ))}
    </section>
  )
}
