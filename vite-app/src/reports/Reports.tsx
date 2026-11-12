import { useCallback, useMemo, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { Download, Printer } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import type { Operations } from "@/operations/model"
import {
  monthRange,
  quarterRange,
  type DateRange,
  type ReportingSource,
} from "@/reporting/model"
import { useReportingQuery } from "@/reporting/useReportingQuery"
import {
  dateLabel,
  numberLabel,
  periodLabel,
  type WorkspaceUser,
} from "@/review/model"
import { ImportWorkbook } from "./ImportWorkbook"
import { buildSummary, reportTitle, type Summary } from "./model"
import "./print.css"

type Mode = "month" | "quarter" | "year"
type Period = DateRange & { label: string; fileLabel: string }

export default function Reports({
  source,
  operations,
  user,
  initialPeriod,
}: {
  source: ReportingSource
  operations: Operations | null
  user: WorkspaceUser
  initialPeriod: string
}) {
  const [mode, setMode] = useState<Mode>("month")
  const [period, setPeriod] = useState<Period>(() => ({
    ...monthRange(initialPeriod)!,
    label: periodLabel(initialPeriod),
    fileLabel: initialPeriod,
  }))
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const load = useCallback(
    () =>
      source.registry({
        from: period.from,
        to: period.to,
        organizationId: "",
        wasteId: "",
        disposalId: "",
      }),
    [source, period]
  )
  const { result, reload } = useReportingQuery(load)
  const records = result.state === "ready" ? result.data : null
  const summary = useMemo(() => records && buildSummary(records), [records])
  const year = period.from.slice(0, 4)
  const title = `${reportTitle} за ${period.label}`
  const date = dateLabel(new Date().toISOString())

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice("")
    const form = new FormData(event.currentTarget)
    const selectedMonth = String(form.get("month") ?? "")
    const selectedYear = String(form.get("year") ?? "")
    const quarter = String(form.get("quarter") ?? "")
    const range =
      mode === "month"
        ? monthRange(selectedMonth)
        : mode === "quarter"
          ? quarterRange(selectedYear, quarter)
          : /^[1-9]\d{3}$/.test(selectedYear)
            ? { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` }
            : null
    if (!range) {
      setNotice("Проверьте период отчёта.")
      return
    }
    const label =
      mode === "month"
        ? periodLabel(selectedMonth)
        : mode === "quarter"
          ? `${["I", "II", "III", "IV"][Number(quarter) - 1]} квартал ${selectedYear} г.`
          : `${selectedYear} г.`
    const fileLabel =
      mode === "month"
        ? selectedMonth
        : mode === "quarter"
          ? `${selectedYear}-Q${quarter}`
          : selectedYear
    setPeriod({ ...range, label, fileLabel })
  }

  async function exportExcel() {
    if (!summary || busy) return
    setBusy(true)
    setNotice("")
    try {
      const { downloadReport } = await import("./excel")
      downloadReport(summary, period.label, date, period.fileLabel)
    } catch {
      setNotice("Не удалось выгрузить Excel. Попробуйте ещё раз.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="reports-title" className="min-w-0 space-y-5">
      <h1
        id="reports-title"
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        Сводные отчёты
      </h1>
      <Card size="sm">
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={apply}>
            <Field className="w-auto">
              <FieldLabel htmlFor="report-mode">Период отчёта</FieldLabel>
              <NativeSelect
                id="report-mode"
                value={mode}
                onChange={(event) => setMode(event.currentTarget.value as Mode)}
              >
                <NativeSelectOption value="month">Месяц</NativeSelectOption>
                <NativeSelectOption value="quarter">Квартал</NativeSelectOption>
                <NativeSelectOption value="year">Год</NativeSelectOption>
              </NativeSelect>
            </Field>
            {mode === "month" ? (
              <Field className="w-auto">
                <FieldLabel htmlFor="report-month">Месяц</FieldLabel>
                <Input
                  id="report-month"
                  name="month"
                  type="month"
                  defaultValue={period.from.slice(0, 7)}
                  required
                />
              </Field>
            ) : (
              <Field className="w-24">
                <FieldLabel htmlFor="report-year">Год</FieldLabel>
                <Input
                  id="report-year"
                  name="year"
                  type="number"
                  min={1000}
                  max={9999}
                  defaultValue={year}
                  required
                />
              </Field>
            )}
            {mode === "quarter" && (
              <Field className="w-auto">
                <FieldLabel htmlFor="report-quarter">Квартал</FieldLabel>
                <NativeSelect
                  id="report-quarter"
                  name="quarter"
                  defaultValue={Math.ceil(Number(period.from.slice(5, 7)) / 3)}
                >
                  {[1, 2, 3, 4].map((quarter) => (
                    <NativeSelectOption key={quarter} value={quarter}>
                      {quarter} квартал
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Button type="submit">Сформировать</Button>
          </form>
        </CardContent>
      </Card>

      {notice && (
        <Alert variant="destructive">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {result.state === "loading" && (
        <Skeleton
          className="h-48"
          role="status"
          aria-label="Формирование отчёта"
        />
      )}
      {result.state === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{result.message}</AlertDescription>
          <Button type="button" variant="outline" onClick={reload}>
            Повторить
          </Button>
        </Alert>
      )}
      {summary && (
        <Card>
          <CardHeader className="gap-3">
            <CardTitle>
              <h2 className="text-lg font-semibold">{title}</h2>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!summary.records.length || busy}
                onClick={exportExcel}
              >
                <Download aria-hidden="true" /> Скачать Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!summary.records.length}
                onClick={() => window.print()}
              >
                <Printer aria-hidden="true" /> Печать / PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {summary.records.length ? (
              <>
                <div
                  className="overflow-x-auto rounded-md border"
                  tabIndex={0}
                  role="region"
                  aria-label="Предпросмотр сводного отчёта"
                >
                  <SummaryTable summary={summary} />
                </div>
                {createPortal(
                  <article className="atu-print">
                    <header>
                      <p>АО «Алматинский технологический университет»</p>
                      <h1>{title}</h1>
                      <p>Дата формирования: {date}</p>
                    </header>
                    <SummaryTable summary={summary} />
                    <p className="atu-signature">
                      Проверяющий _____________________ / _____________________
                      /
                    </p>
                  </article>,
                  document.body
                )}
              </>
            ) : (
              <p className="text-muted-foreground">
                За выбранный период нет принятых записей.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {operations && user.role !== "management" && (
        <ImportWorkbook operations={operations} token={user.token} />
      )}
    </section>
  )
}

function SummaryTable({ summary }: { summary: Summary }) {
  return (
    <table className="atu-summary-table w-full border-collapse text-left text-xs">
      <thead>
        <tr>
          {[
            "Организация",
            "Вид отходов",
            "Ед. изм.",
            "Количество",
            "Способ утилизации",
            "Масса, кг",
            "Выбросы, кг CO₂-экв.",
            "Экономия, кг CO₂-экв.",
          ].map((column) => (
            <th scope="col" key={column}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      {summary.organizations.map((group) => (
        <tbody key={group.id}>
          {group.items.map((item, index) => (
            <tr key={`${item.waste}-${item.disposal}-${index}`}>
              <td>{group.name}</td>
              <td>{item.waste}</td>
              <td>{item.unit}</td>
              <td className="numeric">{numberLabel(item.quantity)}</td>
              <td>{item.disposal}</td>
              <td className="numeric">{numberLabel(item.weight)}</td>
              <td className="numeric">{numberLabel(item.actual)}</td>
              <td className="numeric">{numberLabel(item.saved)}</td>
            </tr>
          ))}
          {group.taraBones !== null && (
            <tr className="subtotal">
              <th scope="row" colSpan={5}>
                Итого: тара + кости
              </th>
              <td className="numeric">{numberLabel(group.taraBones)}</td>
              <td />
              <td />
            </tr>
          )}
          <tr className="subtotal">
            <th scope="row" colSpan={5}>
              Итого · {group.name}
            </th>
            <td className="numeric">{numberLabel(group.total.weight)}</td>
            <td className="numeric">{numberLabel(group.total.actual)}</td>
            <td className="numeric">{numberLabel(group.total.saved)}</td>
          </tr>
        </tbody>
      ))}
      <tbody>
        <tr className="subtotal grand-total">
          <th scope="row" colSpan={5}>
            Итого по АТУ
          </th>
          <td className="numeric">{numberLabel(summary.total.weight)}</td>
          <td className="numeric">{numberLabel(summary.total.actual)}</td>
          <td className="numeric">{numberLabel(summary.total.saved)}</td>
        </tr>
      </tbody>
    </table>
  )
}
