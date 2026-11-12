import { type ReactNode } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  type TooltipValueType,
} from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { numberLabel, periodLabel } from "@/review/model"

type TrendPoint = { month: string; weight: number | null; co2: number | null }
type OrganizationPoint = {
  name: string
  organic: number
  recyclable: number
  special: number
  mixed: number
}
type WastePoint = { name: string; weight: number }
type DisposalPoint = WastePoint & { rank: number }

type AnalyticsChartsProps = {
  trend: TrendPoint[]
  organizations: OrganizationPoint[]
  wastes: WastePoint[]
  disposals: DisposalPoint[]
}

const trendConfig = {
  weight: { label: "Масса, кг", color: "var(--chart-4)" },
  co2: { label: "Выбросы, кг CO₂-экв.", color: "oklch(0.58 0.14 166)" },
} satisfies ChartConfig

const organizationConfig = {
  organic: { label: "Органические", color: "oklch(0.58 0.14 166)" },
  recyclable: { label: "Вторсырьё", color: "var(--chart-4)" },
  special: { label: "Специальные", color: "oklch(0.64 0.16 52)" },
  mixed: { label: "Смешанные", color: "oklch(0.54 0.17 305)" },
} satisfies ChartConfig

const categories = ["organic", "recyclable", "special", "mixed"] as const
const disposalConfig = {
  weight: { label: "Масса, кг", color: "var(--chart-4)" },
} satisfies ChartConfig
const wasteColors = [
  "var(--chart-4)",
  "oklch(0.58 0.14 166)",
  "oklch(0.64 0.16 52)",
  "oklch(0.54 0.17 305)",
  "oklch(0.62 0.19 7)",
  "oklch(0.58 0.04 245)",
]

const axisNumber = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
})
const monthTick = new Intl.DateTimeFormat("ru-RU", {
  month: "short",
  timeZone: "UTC",
})
const percent = new Intl.NumberFormat("ru-RU", {
  style: "percent",
  maximumFractionDigits: 1,
})

const chartClass =
  "aspect-auto w-full has-[:focus-visible]:rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"

function shortLabel(value: string, limit = 20) {
  return value.length > limit
    ? `${value.slice(0, limit - 1).trimEnd()}…`
    : value
}

function TooltipValue({
  label,
  value,
  suffix = " кг",
  color,
}: {
  label: ReactNode
  value?: TooltipValueType
  suffix?: string
  color?: string
}) {
  return (
    <div className="flex w-full max-w-72 items-center justify-between gap-3">
      <span className="flex min-w-0 items-start gap-1.5 text-muted-foreground">
        {color && (
          <span
            aria-hidden="true"
            className="mt-1 size-2 shrink-0 rounded-xs"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="wrap-anywhere">{label}</span>
      </span>
      <span className="shrink-0 font-medium tabular-nums">
        {numberLabel(typeof value === "number" ? value : null, suffix)}
      </span>
    </div>
  )
}

function ChartCard({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <Card className="@container/chart-card h-full">
        <CardHeader>
          <CardTitle>
            <h2 id={id}>{title}</h2>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          {children ?? (
            <p className="flex min-h-44 items-center justify-center text-center text-sm text-muted-foreground">
              За этот период нет принятых данных.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const hasData = data.some(
    ({ weight, co2 }) => weight !== null || co2 !== null
  )
  return (
    <ChartCard
      id="analytics-trend-title"
      title="Динамика массы и выбросов"
      description="Масса по левой шкале, выбросы CO₂-экв. по правой."
    >
      {hasData ? (
        <>
          <ChartContainer config={trendConfig} className={`${chartClass} h-64`}>
            <LineChart
              accessibilityLayer
              aria-labelledby="analytics-trend-title"
              data={data}
              margin={{ top: 8, right: 5, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                minTickGap={10}
                tickFormatter={(month: string) =>
                  monthTick
                    .format(new Date(`${month}-01T00:00:00Z`))
                    .replace(".", "")
                }
              />
              <YAxis
                yAxisId="weight"
                width={41}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => axisNumber.format(value)}
              />
              <YAxis
                yAxisId="co2"
                orientation="right"
                width={41}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => axisNumber.format(value)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => periodLabel(String(label ?? ""))}
                    formatter={(value, key) => (
                      <TooltipValue
                        label={key === "weight" ? "Масса" : "Выбросы"}
                        value={value}
                        color={
                          key === "weight"
                            ? "var(--color-weight)"
                            : "var(--color-co2)"
                        }
                        suffix={key === "weight" ? " кг" : " кг CO₂-экв."}
                      />
                    )}
                  />
                }
              />
              <Line
                type="monotone"
                yAxisId="weight"
                dataKey="weight"
                stroke="var(--color-weight)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                yAxisId="co2"
                dataKey="co2"
                stroke="var(--color-co2)"
                strokeWidth={2.5}
                strokeDasharray="4 3"
                dot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              <ChartLegend
                content={
                  <ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />
                }
              />
            </LineChart>
          </ChartContainer>
          {data.some(({ weight }) => weight === null) && (
            <p className="mt-2 text-xs text-muted-foreground">
              Разрывы линии показывают месяцы без принятых записей.
            </p>
          )}
        </>
      ) : null}
    </ChartCard>
  )
}

function OrganizationChart({ data }: { data: OrganizationPoint[] }) {
  const hasData = data.some((entry) => categories.some((key) => entry[key] > 0))
  return (
    <ChartCard
      id="analytics-organizations-title"
      title="Отходы по подразделениям"
      description="Масса по категориям, кг. Без полосы — нет принятых записей за период."
    >
      {hasData ? (
        <ChartContainer
          config={organizationConfig}
          className={chartClass}
          style={{ height: Math.max(256, data.length * 32 + 78) }}
        >
          <BarChart
            accessibilityLayer
            aria-labelledby="analytics-organizations-title"
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => axisNumber.format(value)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={119}
              axisLine={false}
              tickLine={false}
              interval={0}
              tickFormatter={(value: string) => shortLabel(value, 18)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const key = categories.find((category) => category === name)
                    return (
                      <TooltipValue
                        label={key ? organizationConfig[key].label : name}
                        value={value}
                        color={key ? `var(--color-${key})` : undefined}
                      />
                    )
                  }}
                />
              }
            />
            {categories.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="categories"
                fill={`var(--color-${key})`}
                maxBarSize={20}
                isAnimationActive={false}
              />
            ))}
            <ChartLegend
              content={
                <ChartLegendContent className="flex-wrap gap-x-3 gap-y-1" />
              }
            />
          </BarChart>
        </ChartContainer>
      ) : null}
    </ChartCard>
  )
}

function WasteChart({ data }: { data: WastePoint[] }) {
  const sorted = data
    .filter(({ weight }) => weight > 0)
    .toSorted((a, b) => b.weight - a.weight)
  const selected = sorted.slice(0, 5)
  const others = sorted.slice(5).reduce((sum, entry) => sum + entry.weight, 0)
  if (others > 0) selected.push({ name: "Прочие виды", weight: others })
  const slices = selected.map((entry, index) => ({
    ...entry,
    fill: wasteColors[index],
  }))
  const total = slices.reduce((sum, slice) => sum + slice.weight, 0)

  return (
    <ChartCard
      id="analytics-wastes-title"
      title="Виды отходов"
      description={
        others > 0
          ? "Пять крупнейших видов и остальные отходы по массе."
          : "Доля по массе за выбранный период."
      }
    >
      {total > 0 ? (
        <div className="grid items-center gap-x-3 @[28rem]/chart-card:grid-cols-[minmax(8rem,1fr)_minmax(0,1.3fr)]">
          <ChartContainer config={{}} className={`${chartClass} h-52 min-w-0`}>
            <PieChart
              accessibilityLayer
              aria-labelledby="analytics-wastes-title"
            >
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name, item) => (
                      <TooltipValue
                        label={name}
                        value={value}
                        color={item.payload?.fill}
                      />
                    )}
                  />
                }
              />
              <Pie
                data={slices}
                dataKey="weight"
                nameKey="name"
                innerRadius="60%"
                outerRadius="88%"
                paddingAngle={slices.length > 1 ? 2 : 0}
                stroke="none"
                isAnimationActive={false}
              />
            </PieChart>
          </ChartContainer>
          <ul className="grid min-w-0 gap-1.5">
            {slices.map(({ name, weight, fill }, index) => (
              <li
                key={index}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-1.5"
              >
                <span
                  className="mt-1 size-2 rounded-xs"
                  style={{ backgroundColor: fill }}
                  aria-hidden="true"
                />
                <span className="wrap-anywhere">{name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {percent.format(weight / total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ChartCard>
  )
}

function DisposalChart({ data }: { data: DisposalPoint[] }) {
  const methods = data
    .filter(({ weight }) => weight > 0)
    .toSorted((a, b) => a.rank - b.rank || b.weight - a.weight)
    .map((method) => ({ ...method, label: `${method.rank} · ${method.name}` }))

  return (
    <ChartCard
      id="analytics-disposal-title"
      title="Способы утилизации"
      description="Масса в кг. Перед названием указан уровень 1–5 по справочнику АТУ."
    >
      {methods.length ? (
        <ChartContainer
          config={disposalConfig}
          className={chartClass}
          style={{ height: Math.max(220, methods.length * 29 + 30) }}
        >
          <BarChart
            accessibilityLayer
            aria-labelledby="analytics-disposal-title"
            data={methods}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => axisNumber.format(value)}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={143}
              axisLine={false}
              tickLine={false}
              interval={0}
              tickFormatter={(value: string) => shortLabel(value, 22)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <TooltipValue
                      label="Масса"
                      value={value}
                      color="var(--color-weight)"
                    />
                  )}
                />
              }
            />
            <Bar
              dataKey="weight"
              fill="var(--color-weight)"
              radius={[0, 4, 4, 0]}
              maxBarSize={21}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      ) : null}
    </ChartCard>
  )
}

export function AnalyticsCharts({
  trend,
  organizations,
  wastes,
  disposals,
}: AnalyticsChartsProps) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
      <TrendChart data={trend} />
      <OrganizationChart data={organizations} />
      <WasteChart data={wastes} />
      <DisposalChart data={disposals} />
    </div>
  )
}
