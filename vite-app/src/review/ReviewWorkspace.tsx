import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  LockKeyhole,
  RefreshCw,
  Smartphone,
  Undo2,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  canReview,
  dateLabel,
  decisionComment,
  numberLabel,
  periodLabel,
  photoLink,
  statusLabel,
  total,
  tppSubtotal,
} from "./model"
import type {
  Connection,
  Decision,
  Inspector,
  Report,
  ReportDetail,
  ReviewSource,
  ReviewStatus,
  WasteRecord,
} from "./model"

type QueueFilter = "pending" | Decision

const filters: { id: QueueFilter; label: string }[] = [
  { id: "pending", label: "На проверке" },
  { id: "returned", label: "На доработке" },
  { id: "approved", label: "Принятые" },
]

function matches(report: Report, filter: QueueFilter) {
  return filter === "pending"
    ? canReview(report.status)
    : report.status === filter
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function ReportBadge({
  status,
  isNew = false,
}: {
  status: ReviewStatus
  isNew?: boolean
}) {
  if (isNew && status === "submitted") return <Badge>Новый на проверке</Badge>
  return (
    <Badge variant={canReview(status) ? "secondary" : "outline"}>
      {statusLabel(status)}
    </Badge>
  )
}

function useQueue(source: ReviewSource) {
  const [reports, setReports] = useState<Report[] | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")
  const [connection, setConnection] = useState<Connection>("connecting")
  const revision = useRef(0)

  const refresh = useCallback(async () => {
    const current = ++revision.current
    try {
      const next = await source.list()
      if (current !== revision.current) return
      setReports(next)
      setError("")
      setNewIds((previous) => {
        const submitted = new Set(
          next
            .filter((report) => report.status === "submitted")
            .map((report) => report.id)
        )
        return new Set([...previous].filter((id) => submitted.has(id)))
      })
    } catch (reason) {
      if (current === revision.current)
        setError(errorMessage(reason, "Не удалось загрузить очередь."))
    }
  }, [source])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void refresh()
    })
    const unsubscribe = source.watch(
      ({ submittedId }) => {
        if (!active) return
        if (submittedId)
          setNewIds((previous) => new Set(previous).add(submittedId))
        void refresh()
      },
      (state) => {
        if (!active) return
        setConnection(state)
        if (state === "live") void refresh()
      }
    )
    return () => {
      active = false
      unsubscribe()
    }
  }, [source, refresh])

  return {
    reports,
    error,
    connection,
    newIds,
    refresh,
    markRead(id: string) {
      setNewIds((previous) => {
        if (!previous.has(id)) return previous
        const next = new Set(previous)
        next.delete(id)
        return next
      })
    },
    applyDecision(report: Report) {
      revision.current++
      setReports(
        (previous) =>
          previous?.map((item) => (item.id === report.id ? report : item)) ?? [
            report,
          ]
      )
      void refresh()
    },
  }
}

export default function ReviewWorkspace({
  source,
  inspector,
  simulateSubmission,
}: {
  source: ReviewSource
  inspector: Inspector
  simulateSubmission?: () => boolean
}) {
  const queue = useQueue(source)
  const [filter, setFilter] = useState<QueueFilter>("pending")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const visible =
    queue.reports?.filter((report) => matches(report, filter)) ?? []
  const selected =
    visible.find((report) => report.id === selectedId) ?? visible[0]
  const connectionLabel = simulateSubmission
    ? "Деморежим"
    : {
        live: "Обновляется автоматически",
        connecting: "Подключение…",
        offline: "Автообновление недоступно",
      }[queue.connection]

  function onDecided(report: Report, decision: Decision) {
    queue.applyDecision(report)
    setFilter(decision)
    setSelectedId(report.id)
    setNotice(
      decision === "approved"
        ? "Отчёт принят в единый реестр."
        : "Отчёт возвращён на доработку."
    )
  }

  return (
    <section aria-labelledby="review-title" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          id="review-title"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Проверка отчётов
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            role="status"
            className="gap-1.5 bg-background"
          >
            <span
              className={
                queue.connection === "live"
                  ? "size-1.5 rounded-full bg-emerald-600"
                  : "size-1.5 rounded-full bg-amber-500"
              }
              aria-hidden="true"
            />
            {connectionLabel}
          </Badge>
          <Button
            type="button"
            size="icon-lg"
            variant="outline"
            className="bg-background"
            aria-label="Обновить очередь"
            title="Обновить очередь"
            onClick={() => void queue.refresh()}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
      </div>

      {simulateSubmission && (
        <Alert
          role="note"
          className="flex flex-wrap items-center justify-between gap-2 p-2 pl-3"
        >
          <AlertDescription>
            Изменения в деморежиме действуют до перезагрузки страницы.
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (simulateSubmission()) {
                setFilter("pending")
                setSelectedId(null)
                setNotice("Отчёт поступил в очередь.")
              } else {
                setNotice("Сейчас нет отчётов для повторной отправки.")
              }
            }}
          >
            <Smartphone data-icon="inline-start" aria-hidden="true" />
            Имитировать отправку с телефона
          </Button>
        </Alert>
      )}

      <div role="status" className={notice ? undefined : "sr-only"}>
        {notice && (
          <Alert role="presentation" className="p-3">
            <Check aria-hidden="true" />
            <AlertTitle>{notice}</AlertTitle>
          </Alert>
        )}
      </div>
      {queue.error && (
        <Alert variant="destructive" className="p-3">
          <CircleAlert aria-hidden="true" />
          <AlertDescription className="wrap-anywhere">
            {queue.error}
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        className="gap-4"
        value={filter}
        onValueChange={(value) => {
          const next = filters.find(({ id }) => id === value)
          if (!next) return
          setFilter(next.id)
          setSelectedId(null)
          setNotice("")
        }}
      >
        <TabsList aria-label="Статус отчёта" className="max-w-full self-start">
          {filters.map(({ id, label }) => (
            <TabsTrigger key={id} value={id} className="sm:px-3">
              {label}
              {queue.reports && (
                <Badge variant="outline" className="h-4 px-1 tabular-nums">
                  {queue.reports.filter((report) => matches(report, id)).length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={filter} key={filter}>
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)]">
            <section aria-labelledby="queue-title">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>
                    <h2 id="queue-title">
                      {filter === "pending" ? "Очередь проверки" : "Отчёты"}
                    </h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {queue.reports === null && !queue.error && (
                    <div role="status" className="space-y-2">
                      <span className="sr-only">Загрузка отчётов…</span>
                      <Skeleton className="h-14" />
                      <Skeleton className="h-14" />
                    </div>
                  )}
                  {queue.reports && visible.length === 0 && (
                    <p className="pb-2 text-muted-foreground">
                      Отчётов в этом разделе пока нет.
                    </p>
                  )}
                  {visible.length > 0 && (
                    <ul className="space-y-1">
                      {visible.map((report) => (
                        <li key={report.id}>
                          <Button
                            type="button"
                            variant={
                              selected?.id === report.id ? "secondary" : "ghost"
                            }
                            aria-pressed={selected?.id === report.id}
                            className="grid h-auto w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] justify-items-start gap-x-2 gap-y-0.5 px-2 py-2 text-left whitespace-normal"
                            onClick={() => {
                              setSelectedId(report.id)
                              queue.markRead(report.id)
                              setNotice("")
                            }}
                          >
                            <span className="min-w-0 wrap-anywhere">
                              {report.organization}
                            </span>
                            <ChevronRight
                              className="text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="col-span-2 text-muted-foreground">
                              {periodLabel(report.period)}
                            </span>
                            <span className="col-span-2 mt-1">
                              <ReportBadge
                                status={report.status}
                                isNew={queue.newIds.has(report.id)}
                              />
                            </span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </section>

            {selected ? (
              <Details
                key={`${selected.id}:${selected.updatedAt}`}
                report={selected}
                source={source}
                inspector={inspector}
                onDecided={onDecided}
                onError={queue.refresh}
                onInteract={() => setSelectedId(selected.id)}
              />
            ) : (
              <Card>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>Выберите отчёт в очереди</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}

function Details({
  report,
  source,
  inspector,
  onDecided,
  onError,
  onInteract,
}: {
  report: Report
  source: ReviewSource
  inspector: Inspector
  onDecided: (report: Report, decision: Decision) => void
  onError: () => void
  onInteract: () => void
}) {
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [comment, setComment] = useState("")
  const [decisionError, setDecisionError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    source.detail(report.id).then(
      (data) => {
        if (active) {
          setDetail(data)
          setError("")
        }
      },
      (reason) => {
        if (active) setError(errorMessage(reason, "Не удалось открыть отчёт."))
      }
    )
    return () => {
      active = false
    }
  }, [source, report.id, retry])

  async function decide(decision: Decision) {
    if (saving) return
    setDecisionError("")
    let validated: string
    try {
      validated = decisionComment(decision, comment)
    } catch (reason) {
      setDecisionError(errorMessage(reason, "Заполните комментарий."))
      document.getElementById("review-comment")?.focus()
      return
    }
    setSaving(true)
    try {
      onDecided(
        await source.decide(report, decision, validated, inspector),
        decision
      )
    } catch (reason) {
      setDecisionError(errorMessage(reason, "Не удалось сохранить решение."))
      onError()
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      className="min-w-0"
      aria-labelledby="detail-title"
      onFocusCapture={onInteract}
    >
      <Card>
        <CardHeader className="gap-1.5">
          <span className="text-xs font-medium text-primary">
            {periodLabel(report.period)}
          </span>
          <CardAction>
            <ReportBadge status={report.status} />
          </CardAction>
          <CardTitle>
            <h2
              id="detail-title"
              className="text-xl leading-tight font-semibold tracking-tight"
            >
              {report.organization}
            </h2>
          </CardTitle>
          <CardDescription>
            {report.submittedBy && `Ответственный: ${report.submittedBy} · `}
            Обновлён {dateLabel(report.updatedAt, true)}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="space-y-2">
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertDescription className="wrap-anywhere">
                  {error}
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("")
                  setRetry((current) => current + 1)
                }}
              >
                Повторить
              </Button>
            </div>
          )}
          {!detail && !error && (
            <div role="status" className="space-y-2">
              <span className="sr-only">Загрузка данных отчёта…</span>
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-28" />
            </div>
          )}
          {detail && (
            <div className="space-y-4">
              <Separator />
              <section className="space-y-3" aria-labelledby="records-title">
                <h3 id="records-title" className="text-sm font-semibold">
                  Взвешивания
                </h3>
                <dl className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Записей", value: detail.records.length },
                    {
                      label: "Общая масса",
                      value: numberLabel(
                        total(detail.records, "weight"),
                        " кг"
                      ),
                    },
                    {
                      label: "Фактический CO₂-экв.",
                      value: numberLabel(total(detail.records, "co2"), " кг"),
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-md bg-muted px-2 py-2 sm:px-3"
                    >
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-semibold tabular-nums sm:text-lg">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <RecordTable
                  records={detail.records}
                  subtotal={tppSubtotal(report.summaryRule, detail.records)}
                />
              </section>

              <Separator />
              <section className="space-y-3" aria-labelledby="decision-title">
                <h3 id="decision-title" className="text-sm font-semibold">
                  Решение по отчёту
                </h3>
                {canReview(report.status) ? (
                  <>
                    <Field data-invalid={Boolean(decisionError)}>
                      <FieldLabel htmlFor="review-comment">
                        Комментарий проверяющего
                      </FieldLabel>
                      <Textarea
                        id="review-comment"
                        value={comment}
                        disabled={saving}
                        aria-invalid={Boolean(decisionError)}
                        aria-describedby={
                          decisionError
                            ? "comment-hint comment-error"
                            : "comment-hint"
                        }
                        onChange={(event) => {
                          setComment(event.target.value)
                          setDecisionError("")
                        }}
                        placeholder="Укажите, что нужно исправить, или добавьте замечание…"
                        rows={3}
                      />
                      <FieldDescription id="comment-hint">
                        Комментарий обязателен при возврате.
                      </FieldDescription>
                      {decisionError && (
                        <FieldError id="comment-error">
                          {decisionError}
                        </FieldError>
                      )}
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void decide("returned")}
                      >
                        <Undo2 data-icon="inline-start" aria-hidden="true" />
                        Вернуть на доработку
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        disabled={saving}
                        onClick={() => void decide("approved")}
                      >
                        <Check data-icon="inline-start" aria-hidden="true" />
                        {saving ? "Сохранение…" : "Принять отчёт"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Alert role="note" className="p-3">
                    {report.status === "approved" ? (
                      <LockKeyhole aria-hidden="true" />
                    ) : (
                      <Undo2 aria-hidden="true" />
                    )}
                    <AlertTitle>
                      {report.status === "approved"
                        ? "Отчёт принят. Редактирование закрыто."
                        : "Отчёт возвращён ответственному на доработку."}
                    </AlertTitle>
                    {report.comment && (
                      <AlertDescription className="wrap-anywhere whitespace-pre-wrap">
                        {report.comment}
                      </AlertDescription>
                    )}
                  </Alert>
                )}
              </section>

              <Separator />
              <section className="space-y-3" aria-labelledby="history-title">
                <h3 id="history-title" className="text-sm font-semibold">
                  История изменений
                </h3>
                {detail.history.length === 0 ? (
                  <p className="text-muted-foreground">
                    История изменений пока пуста.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {detail.history.map((event) => (
                      <li key={event.id} className="flex items-start gap-2.5">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                          <Clock3 className="size-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium">
                            {event.from
                              ? `${statusLabel(event.from)} → ${statusLabel(event.to)}`
                              : statusLabel(event.to)}
                          </p>
                          <p className="text-muted-foreground">
                            {dateLabel(event.at, true)}
                            {event.actor && ` · ${event.actor}`}
                          </p>
                          {event.comment && (
                            <p className="mt-1 wrap-anywhere whitespace-pre-wrap">
                              {event.comment}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}
        </CardContent>
      </Card>
    </article>
  )
}

function RecordTable({
  records,
  subtotal,
}: {
  records: WasteRecord[]
  subtotal: number | null | undefined
}) {
  if (!records.length)
    return (
      <p className="text-muted-foreground">В отчёте нет записей взвешиваний.</p>
    )

  return (
    <div
      className="overflow-x-auto rounded-md border focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&_[data-slot=table-container]]:overflow-visible"
      tabIndex={0}
      role="region"
      aria-label="Таблица взвешиваний"
    >
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead scope="col">Дата</TableHead>
            <TableHead scope="col">Вид отхода</TableHead>
            <TableHead scope="col" className="text-right">
              Количество
            </TableHead>
            <TableHead scope="col" className="text-right">
              Масса, кг
            </TableHead>
            <TableHead scope="col">Утилизация</TableHead>
            <TableHead scope="col" className="text-right">
              CO₂-экв., кг
            </TableHead>
            <TableHead scope="col" className="text-center">
              Фото
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const url = photoLink(record.photo)
            const unit = { kg: "кг", l: "л" }[record.unit] ?? record.unit

            return (
              <TableRow key={record.id}>
                <TableCell>{dateLabel(record.date)}</TableCell>
                <TableCell className="min-w-24 whitespace-normal">
                  {record.waste || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberLabel(record.quantity, unit ? ` ${unit}` : "")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberLabel(record.weight)}
                </TableCell>
                <TableCell className="min-w-24 whitespace-normal">
                  {record.disposal || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberLabel(record.co2)}
                </TableCell>
                <TableCell className="text-center">
                  {url ? (
                    <a
                      className={buttonVariants({
                        variant: "ghost",
                        size: "icon-sm",
                      })}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Открыть фото: ${record.waste}`}
                    >
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        {subtotal !== undefined && (
          <TableFooter>
            <TableRow>
              <TableHead scope="row" colSpan={3}>
                Итого: тара + кости
              </TableHead>
              <TableCell className="text-right tabular-nums">
                {numberLabel(subtotal, " кг")}
              </TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  )
}
