import { useCallback, useState, type FormEvent } from "react"
import {
  CalendarDays,
  Check,
  ClipboardList,
  MessageSquare,
  Plus,
  Send,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { currentMonth, monthRange } from "@/reporting/model"
import { useReportingQuery } from "@/reporting/useReportingQuery"
import {
  dateLabel,
  numberLabel,
  statusLabel,
  type Status,
} from "@/review/model"
import { unitLabel } from "@/reports/model"
import { today, type Operations, type Point, type PointMonth } from "./model"

const inputClass = "h-12 min-w-0 rounded-xl px-3 text-base md:text-base"
const selectClass =
  "w-full min-w-0 [&_select]:h-12 [&_select]:rounded-xl [&_select]:pr-10 [&_select]:pl-3 [&_select]:text-base [&_svg]:right-3 [&_svg]:size-4"

const statusColor: Record<Status, string> = {
  draft: "border-border bg-muted text-foreground",
  submitted:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200",
  in_review:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200",
  returned:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
  approved:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200",
}

function formatTotals(records: PointMonth["records"]) {
  const totals = new Map<string, number>()
  for (const { amount, unit } of records) {
    totals.set(unit, (totals.get(unit) ?? 0) + Number(amount))
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([unit, total]) => numberLabel(total, " " + unitLabel(unit)))
    .join(" · ")
}

export function PointEntries({
  operations,
  point,
  token,
}: {
  operations: Operations
  point: Point
  token: string
}) {
  const [month, setMonth] = useState(currentMonth)
  const [date, setDate] = useState(today)
  const [wasteId, setWasteId] = useState(point.wastes[0]?.id ?? "")
  const [disposalId, setDisposalId] = useState("")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const load = useCallback(
    () => operations.pointMonth(point, month),
    [operations, point, month]
  )
  const { result, reload } = useReportingQuery(load)
  const data = result.state === "ready" ? result.data : null
  const canEdit = data?.status === "draft" || data?.status === "returned"
  const waste = point.wastes.find(({ id }) => id === wasteId)
  const range = monthRange(month)!
  const todayDate = today()
  const lastDate = range.to < todayDate ? range.to : todayDate
  const records = data?.records ?? []

  async function run(action: () => Promise<void>, notice: string) {
    if (busy) return
    setBusy(true)
    setMessage("")
    setError("")
    try {
      await action()
      setMessage(notice)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось сохранить."
      )
    } finally {
      reload()
      setBusy(false)
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      await operations.pointAdd(token, point, {
        date,
        waste_id: wasteId,
        disposal_id: disposalId,
        amount: Number(amount),
      })
      setAmount("")
    }, "Взвешивание добавлено.")
  }

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CalendarDays
                className="size-5 text-primary"
                aria-hidden="true"
              />
              Отчёт за месяц
            </h2>
            {data && (
              <Badge
                variant="outline"
                className={"h-7 px-2.5 text-xs " + statusColor[data.status]}
              >
                {statusLabel(data.status)}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field className="max-w-52 min-w-0 flex-1 basis-36 gap-1.5">
              <FieldLabel htmlFor="point-month" className="text-sm">
                Отчётный месяц
              </FieldLabel>
              <Input
                id="point-month"
                type="month"
                value={month}
                max={currentMonth()}
                disabled={busy}
                className={inputClass}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  const nextRange = monthRange(value)
                  if (!nextRange || value > currentMonth()) return
                  setMonth(value)
                  setDate(nextRange.to < todayDate ? nextRange.to : todayDate)
                  setAmount("")
                  setMessage("")
                  setError("")
                }}
              />
            </Field>
            {!!records.length && (
              <div className="min-h-12 rounded-xl bg-primary/5 px-3 py-1.5">
                <p className="text-xs text-muted-foreground">Итого за месяц</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatTotals(records)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {result.state === "loading" && (
        <div role="status" aria-label="Загрузка записей">
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      )}
      {result.state === "error" && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">
            {result.message}
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            className="h-11 text-sm"
            onClick={reload}
          >
            Повторить
          </Button>
        </Alert>
      )}
      {data?.comment && (
        <Alert role="note" className="rounded-xl bg-card p-3">
          <MessageSquare className="size-4 text-primary" aria-hidden="true" />
          <AlertDescription className="text-sm">
            <strong className="text-foreground">
              Комментарий проверяющего
            </strong>
            <p className="break-words whitespace-pre-wrap">{data.comment}</p>
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert
          role="status"
          className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200"
        >
          <Check aria-hidden="true" />
          <AlertDescription className="text-sm text-inherit">
            {message}
          </AlertDescription>
        </Alert>
      )}

      {canEdit &&
        waste &&
        point.disposals.length > 0 &&
        lastDate >= range.from && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <h2 className="text-lg font-semibold">Новое взвешивание</h2>
            </CardHeader>
            <CardContent>
              <form className="space-y-3.5" onSubmit={add} aria-busy={busy}>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="point-waste" className="text-sm">
                    Вид отходов
                  </FieldLabel>
                  <NativeSelect
                    id="point-waste"
                    className={selectClass}
                    value={wasteId}
                    disabled={busy}
                    onChange={(event) => {
                      setWasteId(event.currentTarget.value)
                      setAmount("")
                    }}
                  >
                    {point.wastes.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.name_ru}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field className="min-w-0 gap-1.5">
                    <FieldLabel htmlFor="point-date" className="text-sm">
                      Дата
                    </FieldLabel>
                    <Input
                      id="point-date"
                      type="date"
                      min={range.from}
                      max={lastDate}
                      value={date}
                      onChange={(event) => setDate(event.currentTarget.value)}
                      className={inputClass}
                      disabled={busy}
                      required
                    />
                  </Field>
                  <Field className="min-w-0 gap-1.5">
                    <FieldLabel htmlFor="point-amount" className="text-sm">
                      Количество, {unitLabel(waste.unit)}
                    </FieldLabel>
                    <Input
                      id="point-amount"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max="2000"
                      step="0.01"
                      placeholder="0,00"
                      value={amount}
                      onChange={(event) => setAmount(event.currentTarget.value)}
                      className={inputClass}
                      disabled={busy}
                      required
                    />
                  </Field>
                </div>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="point-disposal" className="text-sm">
                    Способ утилизации
                  </FieldLabel>
                  <NativeSelect
                    id="point-disposal"
                    className={selectClass}
                    value={disposalId}
                    onChange={(event) =>
                      setDisposalId(event.currentTarget.value)
                    }
                    disabled={busy}
                    required
                  >
                    <NativeSelectOption value="" disabled>
                      Выберите способ
                    </NativeSelectOption>
                    {point.disposals.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.name_ru}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Button
                  type="submit"
                  className="h-12 w-full gap-2 rounded-xl text-base"
                  disabled={busy}
                >
                  <Plus aria-hidden="true" /> Добавить запись
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      {canEdit && !!records.length && (
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full gap-2 rounded-xl bg-card text-base"
          disabled={busy}
          onClick={() =>
            void run(
              () => operations.pointSubmit(token, point, month),
              "Отчёт отправлен на проверку."
            )
          }
        >
          <Send aria-hidden="true" /> Отправить на проверку
        </Button>
      )}
      {data && <PointJournal records={records} />}
    </>
  )
}

function PointJournal({ records }: { records: PointMonth["records"] }) {
  const byDate = new Map<string, PointMonth["records"]>()
  for (const record of records) {
    const day = byDate.get(record.record_date)
    if (day) day.push(record)
    else byDate.set(record.record_date, [record])
  }
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ClipboardList className="size-5 text-primary" aria-hidden="true" />
          Журнал взвешиваний
        </h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {byDate.size === 0 && (
          <p className="text-sm text-muted-foreground">
            За этот месяц записей пока нет.
          </p>
        )}
        {[...byDate.entries()]
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, dayRecords]) => (
            <div key={date} className="overflow-hidden rounded-xl border">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-muted/70 px-3 py-2 text-sm">
                <time dateTime={date} className="font-medium">
                  {dateLabel(date)}
                </time>
                <span className="text-xs text-muted-foreground">
                  За день · {formatTotals(dayRecords)}
                </span>
              </div>
              <ul className="divide-y">
                {dayRecords.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 break-words">
                      {item.waste_name_ru}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {numberLabel(
                        Number(item.amount),
                        " " + unitLabel(item.unit)
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </CardContent>
    </Card>
  )
}
