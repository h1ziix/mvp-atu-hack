export type Category = "organic" | "recyclable" | "special" | "mixed"
export type AnalyticsMode = "month" | "quarter"

export type AnalyticsRecord = {
  month: string
  organizationId: string
  orgCode: string
  organization: string
  wasteId: string
  wasteCode: string
  waste: string
  category: Category
  recyclable: "yes" | "partial" | "no"
  disposalCode: string
  disposal: string
  hierarchyRank: number
  recommendedCode: string
  recommendedLabel: string
  weight: number
  co2Actual: number
  co2IfTbo: number
  co2Saved: number
  co2Potential: number
}

export type AnalyticsPeriod = {
  mode: AnalyticsMode
  fromMonth: string
  toMonth: string
  previousFromMonth: string
  previousToMonth: string
  trendFromMonth: string
  queryFromMonth: string
}

export type Anomaly = {
  month: string
  organizationId: string
  wasteId: string
  organization: string
  waste: string
  weight: number
  baselineWeight: number
  baselineMonths: number
  growthPct: number
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number)
  const index = year * 12 + monthNumber - 1 + offset
  const shiftedYear = String(Math.floor(index / 12)).padStart(4, "0")
  const shiftedMonth = String((index % 12) + 1).padStart(2, "0")
  return `${shiftedYear}-${shiftedMonth}`
}

export function getAnalyticsPeriod(
  anchorMonth: string,
  mode: AnalyticsMode
): AnalyticsPeriod {
  const quarterOffset = (Number(anchorMonth.slice(5)) - 1) % 3
  const fromMonth =
    mode === "quarter" ? shiftMonth(anchorMonth, -quarterOffset) : anchorMonth
  const toMonth = mode === "quarter" ? shiftMonth(fromMonth, 2) : anchorMonth
  const trendFromMonth = shiftMonth(toMonth, mode === "quarter" ? -5 : -3)

  return {
    mode,
    fromMonth,
    toMonth,
    previousFromMonth: shiftMonth(fromMonth, mode === "quarter" ? -3 : -1),
    previousToMonth: shiftMonth(fromMonth, -1),
    trendFromMonth,
    queryFromMonth: shiftMonth(trendFromMonth, -3),
  }
}

function sum(
  records: readonly AnalyticsRecord[],
  value: (record: AnalyticsRecord) => number
) {
  return records.reduce((total, record) => total + value(record), 0)
}

function inMonths(month: string, from: string, to: string) {
  return month >= from && month <= to
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, "ru")
}

function monthSeries(
  records: readonly AnalyticsRecord[],
  fromMonth: string,
  toMonth: string
) {
  const totals = new Map<string, { weight: number; co2: number }>()
  for (const record of records) {
    const current = totals.get(record.month) ?? { weight: 0, co2: 0 }
    current.weight += record.weight
    current.co2 += record.co2Actual
    totals.set(record.month, current)
  }
  const trend: { month: string; weight: number | null; co2: number | null }[] =
    []
  for (let month = fromMonth; month <= toMonth; month = shiftMonth(month, 1)) {
    const current = totals.get(month)
    trend.push({
      month,
      weight: current?.weight ?? null,
      co2: current?.co2 ?? null,
    })
  }
  return trend
}

function organizationSeries(
  selected: readonly AnalyticsRecord[],
  visible: readonly AnalyticsRecord[]
) {
  const groups = new Map<string, { name: string } & Record<Category, number>>()
  for (const record of visible) {
    if (!groups.has(record.organizationId)) {
      groups.set(record.organizationId, {
        name: record.organization,
        organic: 0,
        recyclable: 0,
        special: 0,
        mixed: 0,
      })
    }
  }
  for (const record of selected) {
    const group = groups.get(record.organizationId)
    if (group) group[record.category] += record.weight
  }
  return [...groups.values()].sort(byName)
}

function wasteSeries(records: readonly AnalyticsRecord[]) {
  const groups = new Map<string, { name: string; weight: number }>()
  for (const record of records) {
    const group = groups.get(record.wasteId) ?? {
      name: record.waste,
      weight: 0,
    }
    group.weight += record.weight
    groups.set(record.wasteId, group)
  }
  return [...groups.values()].sort(
    (a, b) => b.weight - a.weight || byName(a, b)
  )
}

const disposalLabels: Record<string, string> = {
  DONATE: "Фудшеринг",
  FEED: "Корм животным",
  RECYCLE: "Переработка вторсырья",
  OIL: "Масло на биодизель",
  AD: "Анаэробное сбраживание",
  COMPOST: "Компостирование",
  TBO: "Полигон ТБО",
}

function disposalSeries(records: readonly AnalyticsRecord[]) {
  const groups = new Map<
    string,
    { name: string; weight: number; rank: number }
  >()
  for (const record of records) {
    const group = groups.get(record.disposalCode) ?? {
      name: disposalLabels[record.disposalCode] ?? record.disposal,
      weight: 0,
      rank: record.hierarchyRank,
    }
    group.weight += record.weight
    groups.set(record.disposalCode, group)
  }
  return [...groups.values()].sort((a, b) => a.rank - b.rank || byName(a, b))
}

function detectAnomalies(
  records: readonly AnalyticsRecord[],
  period: AnalyticsPeriod
) {
  const histories = new Map<
    string,
    {
      organizationId: string
      wasteId: string
      organization: string
      waste: string
      months: Map<string, number>
    }
  >()
  for (const record of records) {
    const key = JSON.stringify([record.organizationId, record.wasteId])
    const history = histories.get(key) ?? {
      organizationId: record.organizationId,
      wasteId: record.wasteId,
      organization: record.organization,
      waste: record.waste,
      months: new Map<string, number>(),
    }
    // Store hundredths of a kilogram so an exact 20% rise stays below the alert threshold.
    const weight = Math.round(record.weight * 100)
    history.months.set(
      record.month,
      (history.months.get(record.month) ?? 0) + weight
    )
    histories.set(key, history)
  }

  const anomalies: Anomaly[] = []
  for (const {
    organizationId,
    wasteId,
    organization,
    waste,
    months,
  } of histories.values()) {
    for (const [month, weight] of months) {
      if (!inMonths(month, period.trendFromMonth, period.toMonth)) continue
      const baseline = [1, 2, 3]
        .map((offset) => months.get(shiftMonth(month, -offset)))
        .filter((value): value is number => value !== undefined)
      if (baseline.length < 2) continue
      const baselineSum = baseline.reduce((total, value) => total + value, 0)
      if (baselineSum <= 0 || weight * 5 * baseline.length <= baselineSum * 6)
        continue
      const average = baselineSum / baseline.length
      anomalies.push({
        month,
        organizationId,
        wasteId,
        organization,
        waste,
        weight: weight / 100,
        baselineWeight: average / 100,
        baselineMonths: baseline.length,
        growthPct: (weight / average - 1) * 100,
      })
    }
  }
  return anomalies.sort(
    (a, b) =>
      b.month.localeCompare(a.month) ||
      b.growthPct - a.growthPct ||
      a.organization.localeCompare(b.organization, "ru") ||
      a.waste.localeCompare(b.waste, "ru")
  )
}

const priorityMeasures: Record<
  string,
  { code: string; key: string; label: string }
> = {
  meat_bones: {
    code: "AD",
    key: "bones",
    label:
      "Собирайте мясные и рыбные кости отдельно для анаэробного сбраживания.",
  },
  fish_bones: {
    code: "AD",
    key: "bones",
    label:
      "Собирайте мясные и рыбные кости отдельно для анаэробного сбраживания.",
  },
  used_oil: {
    code: "OIL",
    key: "oil",
    label:
      "Собирайте фритюрное масло в закрытые ёмкости и сдавайте на биодизель.",
  },
  cardboard_packaging: {
    code: "RECYCLE",
    key: "cardboard",
    label: "Отделяйте сухой чистый картон и передавайте его на переработку.",
  },
  unsold_food: {
    code: "DONATE",
    key: "donation",
    label:
      "Корректируйте объём партий по остаткам и передавайте безопасную нереализованную продукцию через фудшеринг.",
  },
}

function recommendationFor(record: AnalyticsRecord) {
  if (!record.recommendedCode || record.recommendedCode === "TBO") return null
  const preferred = priorityMeasures[record.wasteCode]
  if (preferred?.code === record.recommendedCode) {
    return { key: preferred.key, label: preferred.label, priority: 0 }
  }
  if (!record.recommendedLabel) return null
  return {
    key: record.wasteId,
    label: `${record.waste} → ${record.recommendedLabel}`,
    priority: 1,
  }
}

function recommendationsFor(records: readonly AnalyticsRecord[]) {
  const organizations = new Map<
    string,
    {
      organizationId: string
      organization: string
      measures: Map<string, { label: string; priority: number; weight: number }>
    }
  >()
  for (const record of records) {
    const current = organizations.get(record.organizationId) ?? {
      organizationId: record.organizationId,
      organization: record.organization,
      measures: new Map<
        string,
        { label: string; priority: number; weight: number }
      >(),
    }
    const recommendation = recommendationFor(record)
    if (recommendation) {
      const { key, label, priority } = recommendation
      const weight = (current.measures.get(key)?.weight ?? 0) + record.weight
      current.measures.set(key, { label, priority, weight })
    }
    organizations.set(record.organizationId, current)
  }
  return [...organizations.values()]
    .sort((a, b) => a.organization.localeCompare(b.organization, "ru"))
    .map(({ organizationId, organization, measures }) => ({
      organizationId,
      organization,
      measures: [...measures.values()]
        .sort((a, b) => a.priority - b.priority || b.weight - a.weight)
        .slice(0, 4)
        .map(({ label }) => label),
    }))
    .filter(({ measures }) => measures.length > 0)
}

// Coudard et al. (2021) global avoidable consumer food waste resource footprint:
// 4e18 joules and 82e9 m³ over 344e9 kilograms. https://doi.org/10.1016/j.jclepro.2021.129342
const energyKwhPerKg = 4e18 / 344e9 / 3.6e6
const waterM3PerKg = 82e9 / 344e9
// EPA annual sequestration for an urban tree grown for ten years (0.060 metric tons).
const annualTreeCo2Kg = 60

export function buildDashboard(
  records: readonly AnalyticsRecord[],
  period: AnalyticsPeriod
) {
  const selected = records.filter(({ month }) =>
    inMonths(month, period.fromMonth, period.toMonth)
  )
  const previous = records.filter(({ month }) =>
    inMonths(month, period.previousFromMonth, period.previousToMonth)
  )
  const visible = records.filter(({ month }) =>
    inMonths(month, period.trendFromMonth, period.toMonth)
  )
  const weight = sum(selected, (record) => record.weight)
  const priorWeight = previous.length
    ? sum(previous, (record) => record.weight)
    : null
  const recyclableWeight = sum(selected, (record) =>
    record.recyclable !== "no" ? record.weight : 0
  )
  const divertedWeight = sum(selected, (record) =>
    record.disposalCode !== "TBO" ? record.weight : 0
  )
  const co2Saved = sum(selected, (record) => record.co2Saved)
  const recoveredFoodKg = sum(selected, (record) =>
    record.disposalCode === "DONATE" && record.category === "organic"
      ? record.weight
      : 0
  )

  return {
    metrics: {
      hasData: selected.length > 0,
      weight,
      weightTons: weight / 1000,
      priorWeight,
      weightChangePct:
        selected.length > 0 && priorWeight !== null && priorWeight > 0
          ? (weight / priorWeight - 1) * 100
          : null,
      monthsWithData: new Set(selected.map(({ month }) => month)).size,
      previousMonthsWithData: new Set(previous.map(({ month }) => month)).size,
      organizationsWithData: new Set(
        selected.map(({ organizationId }) => organizationId)
      ).size,
      previousOrganizationsWithData: new Set(
        previous.map(({ organizationId }) => organizationId)
      ).size,
      recyclablePct: weight > 0 ? (recyclableWeight / weight) * 100 : null,
      divertedPct: weight > 0 ? (divertedWeight / weight) * 100 : null,
      co2Actual: sum(selected, (record) => record.co2Actual),
      co2IfTbo: sum(selected, (record) => record.co2IfTbo),
      co2Saved,
      co2Potential: sum(selected, (record) => record.co2Potential),
      co2Remaining: sum(selected, (record) => {
        if (
          !record.recommendedCode ||
          record.recommendedCode === record.disposalCode
        )
          return 0
        return Math.max(
          0,
          record.co2Actual - (record.co2IfTbo - record.co2Potential)
        )
      }),
      recoveredFoodKg,
      energyKwh: recoveredFoodKg * energyKwhPerKg,
      waterM3: recoveredFoodKg * waterM3PerKg,
      trees: co2Saved / annualTreeCo2Kg,
    },
    trend: monthSeries(visible, period.trendFromMonth, period.toMonth),
    organizations: organizationSeries(selected, visible),
    wastes: wasteSeries(selected),
    disposals: disposalSeries(selected),
    anomalies: detectAnomalies(records, period),
    recommendations: recommendationsFor(visible),
  }
}

export type DashboardData = ReturnType<typeof buildDashboard>
