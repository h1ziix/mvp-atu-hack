import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { CircleAlert, TrendingUp } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  monthRange,
  quarterRange,
  type ReportingSource,
} from "@/reporting/model"
import { useReportingQuery } from "@/reporting/useReportingQuery"
import { numberLabel, periodLabel } from "@/review/model"
import { AnalyticsCharts } from "./AnalyticsCharts"
import { buildDashboard, getAnalyticsPeriod } from "./model"

const tonsFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 5 })
const percentFormat = new Intl.NumberFormat("ru-RU", {
  style: "percent",
  maximumFractionDigits: 1,
})

function percent(value: number | null, signed = false) {
  return value === null
    ? "—"
    : `${signed && value > 0 ? "+" : ""}${percentFormat.format(value / 100)}`
}

export default function AnalyticsDashboard({
  source,
  initialPeriod,
}: {
  source: ReportingSource
  initialPeriod: string
}) {
  const [mode, setMode] = useState<"month" | "quarter">("month")
  const [period, setPeriod] = useState(() =>
    getAnalyticsPeriod(initialPeriod, "month")
  )
  const [periodError, setPeriodError] = useState("")
  const { queryFromMonth, toMonth } = period
  const load = useCallback(
    () => source.analytics(queryFromMonth, toMonth),
    [source, queryFromMonth, toMonth]
  )
  const { result, reload } = useReportingQuery(load)
  const rows = result.state === "ready" ? result.data : null
  const dashboard = useMemo(
    () => rows && buildDashboard(rows, period),
    [rows, period]
  )

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const month = String(form.get("month") ?? "")
    const quarter =
      mode === "quarter"
        ? quarterRange(
            String(form.get("year") ?? ""),
            String(form.get("quarter") ?? "")
          )
        : null
    const anchor =
      mode === "month" && monthRange(month) ? month : quarter?.from.slice(0, 7)
    if (!anchor) {
      setPeriodError("Укажите месяц или выберите квартал и год.")
      return
    }
    setPeriodError("")
    const next = getAnalyticsPeriod(anchor, mode)
    if (next.queryFromMonth === queryFromMonth && next.toMonth === toMonth)
      reload()
    setPeriod(next)
  }

  const quarter = Math.ceil(Number(period.fromMonth.slice(5, 7)) / 3)
  const year = period.fromMonth.slice(0, 4)

  return (
    <section aria-labelledby="analytics-title" className="min-w-0 space-y-5">
      <h1
        id="analytics-title"
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        Аналитика отходов
      </h1>
      <Card size="sm">
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={apply}>
            <Field className="w-auto">
              <FieldLabel htmlFor="analytics-mode">Отчётный период</FieldLabel>
              <NativeSelect
                id="analytics-mode"
                value={mode}
                onChange={(event) => {
                  setMode(
                    event.currentTarget.value === "quarter"
                      ? "quarter"
                      : "month"
                  )
                  setPeriodError("")
                }}
              >
                <NativeSelectOption value="month">Месяц</NativeSelectOption>
                <NativeSelectOption value="quarter">Квартал</NativeSelectOption>
              </NativeSelect>
            </Field>
            {mode === "month" ? (
              <Field className="w-auto">
                <FieldLabel htmlFor="analytics-month">Месяц</FieldLabel>
                <Input
                  id="analytics-month"
                  name="month"
                  type="month"
                  defaultValue={period.toMonth}
                  required
                />
              </Field>
            ) : (
              <>
                <Field className="w-24">
                  <FieldLabel htmlFor="analytics-year">Год</FieldLabel>
                  <Input
                    id="analytics-year"
                    name="year"
                    type="number"
                    min={1000}
                    max={9999}
                    defaultValue={year}
                    required
                  />
                </Field>
                <Field className="w-auto">
                  <FieldLabel htmlFor="analytics-quarter">Квартал</FieldLabel>
                  <NativeSelect
                    id="analytics-quarter"
                    name="quarter"
                    defaultValue={quarter}
                  >
                    {[1, 2, 3, 4].map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {value} квартал
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </>
            )}
            <Button type="submit">Показать аналитику</Button>
            {periodError && (
              <FieldError className="w-full">{periodError}</FieldError>
            )}
          </form>
        </CardContent>
      </Card>

      {result.state === "loading" && (
        <div
          role="status"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          <span className="sr-only">Загрузка аналитики…</span>
          {[1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      )}
      {result.state === "error" && (
        <div className="space-y-2">
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
          <Button type="button" variant="outline" onClick={reload}>
            Повторить
          </Button>
        </div>
      )}
      {dashboard && (
        <DashboardResults
          dashboard={dashboard}
          selectedPeriodLabel={
            period.mode === "quarter"
              ? `${quarter} квартал ${year} г.`
              : periodLabel(period.fromMonth)
          }
          comparisonLabel={
            period.mode === "quarter"
              ? "К предыдущему кварталу"
              : "К предыдущему месяцу"
          }
          showQuarterCoverage={period.mode === "quarter"}
        />
      )}
    </section>
  )
}

function MetricCard({
  title,
  value,
  children,
}: {
  title: string
  value: string
  children?: ReactNode
}) {
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h3>{title}</h3>
        </CardTitle>
        <p className="text-xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
      </CardHeader>
      {children && (
        <CardContent className="space-y-1 text-muted-foreground">
          {children}
        </CardContent>
      )}
    </Card>
  )
}

function DashboardResults({
  dashboard,
  selectedPeriodLabel,
  comparisonLabel,
  showQuarterCoverage,
}: {
  dashboard: ReturnType<typeof buildDashboard>
  selectedPeriodLabel: string
  comparisonLabel: string
  showQuarterCoverage: boolean
}) {
  const {
    metrics,
    trend,
    organizations,
    wastes,
    disposals,
    anomalies,
    recommendations,
  } = dashboard
  const kg = (value: number | null) =>
    metrics.hasData ? numberLabel(value, " кг") : "—"

  return (
    <>
      <section aria-labelledby="metrics-title" className="space-y-3">
        <h2 id="metrics-title" className="text-lg font-semibold">
          {selectedPeriodLabel}
        </h2>
        {!metrics.hasData && (
          <p className="text-sm text-muted-foreground">
            За выбранный период нет принятых записей.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard title="Общая масса" value={kg(metrics.weight)}>
            {metrics.hasData && (
              <p>{tonsFormat.format(metrics.weightTons)} т</p>
            )}
            <p className="flex flex-wrap items-center gap-1.5">
              {comparisonLabel}
              <Badge variant="outline">
                {percent(metrics.weightChangePct, true)}
              </Badge>
            </p>
            {metrics.previousOrganizationsWithData > 0 &&
              metrics.organizationsWithData !==
                metrics.previousOrganizationsWithData && (
                <p>
                  Подразделений с данными: {metrics.organizationsWithData}{" "}
                  сейчас, {metrics.previousOrganizationsWithData} ранее.
                </p>
              )}
            {showQuarterCoverage &&
              (metrics.monthsWithData < 3 ||
                metrics.previousMonthsWithData < 3) && (
                <p>
                  Месяцев с данными: {metrics.monthsWithData} из 3 в этом
                  квартале, {metrics.previousMonthsWithData} из 3 в предыдущем.
                </p>
              )}
          </MetricCard>
          <MetricCard
            title="Пригодно к переработке"
            value={percent(metrics.recyclablePct)}
          >
            <p>Направлено вне ТБО: {percent(metrics.divertedPct)}</p>
          </MetricCard>
          <MetricCard
            title="Фактические выбросы CO₂-экв."
            value={kg(metrics.co2Actual)}
          >
            <p>При вывозе на ТБО: {kg(metrics.co2IfTbo)}</p>
          </MetricCard>
          <MetricCard title="Экономия CO₂-экв." value={kg(metrics.co2Saved)}>
            <p>Дополнительно можно сэкономить: {kg(metrics.co2Remaining)}</p>
            <p>Потенциал по справочнику к ТБО: {kg(metrics.co2Potential)}</p>
          </MetricCard>
          <MetricCard
            title="ЦУР 12.3 и ESG"
            value={kg(metrics.recoveredFoodKg)}
          >
            <p>Продуктов передано на фудшеринг</p>
            {metrics.hasData && (
              <p>
                Оценка: {numberLabel(metrics.energyKwh, " кВт·ч")},{" "}
                {numberLabel(metrics.waterM3, " м³ воды")},{" "}
                {numberLabel(metrics.trees, " деревьев·год")}
              </p>
            )}
          </MetricCard>
        </div>
      </section>

      <AnalyticsCharts
        trend={trend}
        organizations={organizations}
        wastes={wastes}
        disposals={disposals}
      />

      <section aria-labelledby="anomalies-title">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="anomalies-title">Отклонения по видам отходов</h2>
            </CardTitle>
            <CardDescription>
              Рост массы более чем на 20% к среднему за предыдущие три месяца.
              Для сравнения нужны принятые данные минимум за два из них.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {anomalies.length === 0 ? (
              <p className="text-muted-foreground">
                В показанном периоде отклонений по этому правилу не обнаружено.
              </p>
            ) : (
              <ul className="grid gap-2 lg:grid-cols-2">
                {anomalies.map((anomaly, index) => (
                  <li
                    key={`${anomaly.month}-${anomaly.organization}-${anomaly.waste}-${index}`}
                  >
                    <Alert
                      role="note"
                      className="h-full border-amber-200 bg-amber-50 p-3"
                    >
                      <TrendingUp
                        className="text-amber-800!"
                        aria-hidden="true"
                      />
                      <AlertTitle>
                        {percent(anomaly.growthPct, true)} ·{" "}
                        {anomaly.organization}
                      </AlertTitle>
                      <AlertDescription className="text-amber-950">
                        {anomaly.waste} · {periodLabel(anomaly.month)} ·{" "}
                        {numberLabel(anomaly.weight, " кг")} против{" "}
                        {numberLabel(anomaly.baselineWeight, " кг")} в среднем (
                        {anomaly.baselineMonths} из 3 мес.).
                      </AlertDescription>
                    </Alert>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="recommendations-title" className="space-y-3">
        <div>
          <h2 id="recommendations-title" className="text-lg font-semibold">
            Рекомендации по подразделениям
          </h2>
          <p className="text-sm text-muted-foreground">
            По данным принятых отчётов и справочника способов утилизации.
          </p>
        </div>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Для рекомендаций нужны принятые записи.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((item) => (
              <Card size="sm" key={item.organizationId}>
                <CardHeader>
                  <CardTitle>
                    <h3>{item.organization}</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-1.5 pl-4">
                    {item.measures.map((measure) => (
                      <li key={measure}>{measure}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>Методика расчёта</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
          <p>
            Коэффициенты для отходов взяты из справочника проекта на основе{" "}
            <a
              href="https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024"
              target="_blank"
              rel="noreferrer"
            >
              UK DEFRA / DESNZ 2024
            </a>
            , раздел Waste disposal. Базовый коэффициент для вывоза пищевых
            отходов на полигон совпадает с{" "}
            <a
              href="https://www.climatiq.io/data/emission-factor/89b77e73-0c23-8908-ad8e-bdf224ebe7d8"
              target="_blank"
              rel="noreferrer"
            >
              данными Climatiq
            </a>{" "}
            после округления до 700,21 кг CO₂-экв. на тонну. Экономия CO₂-экв. =
            масса (т) × (коэффициент ТБО − коэффициент способа).
          </p>
          <p>
            Для{" "}
            <a
              href="https://unstats.un.org/sdgs/metadata?Goal=12&Target=12.3"
              target="_blank"
              rel="noreferrer"
            >
              ЦУР 12.3
            </a>{" "}
            показана масса органических продуктов, переданных на фудшеринг.
            Энергия и вода — оценка следа этой массы по среднемировым данным{" "}
            <a
              href="https://doi.org/10.1016/j.jclepro.2021.129342"
              target="_blank"
              rel="noreferrer"
            >
              Coudard и соавторов
            </a>
            . Эквивалент деревьев сравнивает сэкономленный CO₂-экв. с годовым
            поглощением городских деревьев по{" "}
            <a
              href="https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references#seedlings"
              target="_blank"
              rel="noreferrer"
            >
              методике US EPA
            </a>
            . Эти оценки не являются измерениями кампуса.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
