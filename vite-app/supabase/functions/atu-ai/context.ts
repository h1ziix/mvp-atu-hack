import {
  buildDashboard,
  getAnalyticsPeriod,
  type AnalyticsRecord,
} from "../_shared/analytics.ts"

export type DbRows = <T>(path: string, query: URLSearchParams) => Promise<T[]>

type ApprovedRecord = {
  period_month: string
  organization_id: string
  org_code: string
  org_name_ru: string
  waste_type_id: string
  waste_code: string | null
  waste_name_ru: string
  category: AnalyticsRecord["category"]
  recyclable: AnalyticsRecord["recyclable"]
  disposal_code: string
  disposal_name_ru: string
  hierarchy_rank: number
  recommended_method_code: string | null
  recommended_label_ru: string | null
  weight_kg: number
  co2_actual_kg: number
  co2_if_tbo_kg: number
  co2_saved_actual_kg: number
  co2_potential_saving_kg: number
}

const approvedColumns = [
  "period_month",
  "organization_id",
  "org_code",
  "org_name_ru",
  "waste_type_id",
  "waste_code",
  "waste_name_ru",
  "category",
  "recyclable",
  "disposal_code",
  "disposal_name_ru",
  "hierarchy_rank",
  "recommended_method_code",
  "recommended_label_ru",
  "weight_kg",
  "co2_actual_kg",
  "co2_if_tbo_kg",
  "co2_saved_actual_kg",
  "co2_potential_saving_kg",
].join(",")

function analyticsRow(row: ApprovedRecord): AnalyticsRecord {
  return {
    month: row.period_month,
    organizationId: row.organization_id,
    orgCode: row.org_code,
    organization: row.org_name_ru,
    wasteId: row.waste_type_id,
    wasteCode: row.waste_code ?? "",
    waste: row.waste_name_ru,
    category: row.category,
    recyclable: row.recyclable,
    disposalCode: row.disposal_code,
    disposal: row.disposal_name_ru,
    hierarchyRank: Number(row.hierarchy_rank),
    recommendedCode: row.recommended_method_code ?? "",
    recommendedLabel: row.recommended_label_ru ?? "",
    weight: Number(row.weight_kg),
    co2Actual: Number(row.co2_actual_kg),
    co2IfTbo: Number(row.co2_if_tbo_kg),
    co2Saved: Number(row.co2_saved_actual_kg),
    co2Potential: Number(row.co2_potential_saving_kg),
  }
}

export async function analyticsContext(
  rows: DbRows,
  month: string,
  mode: "month" | "quarter"
) {
  const period = getAnalyticsPeriod(month, mode)
  const pageSize = 500
  const records: AnalyticsRecord[] = []
  for (let offset = 0; ; offset += pageSize) {
    if (offset >= 12000)
      throw new Error("Слишком много записей. Выберите месяц.")
    const page = await rows<ApprovedRecord>(
      "v_approved_registry",
      new URLSearchParams([
        ["select", approvedColumns],
        ["period_month", "gte." + period.queryFromMonth],
        ["period_month", "lte." + period.toMonth],
        ["order", "period_month,id"],
        ["limit", String(pageSize)],
        ["offset", String(offset)],
      ])
    )
    records.push(...page.map(analyticsRow))
    if (page.length < pageSize) break
  }
  const dashboard = buildDashboard(records, period)
  const visible = records.filter(({ month }) => month >= period.trendFromMonth)
  const orgs = new Map<string, AnalyticsRecord[]>()
  for (const record of visible) {
    const group = orgs.get(record.organizationId) ?? []
    group.push(record)
    orgs.set(record.organizationId, group)
  }
  if (orgs.size > 20) throw new Error("В периоде больше 20 организаций.")
  return {
    fromMonth: period.fromMonth,
    toMonth: period.toMonth,
    historyFromMonth: period.trendFromMonth,
    organizations: [...orgs.entries()].map(([id, entries]) => {
      const name = entries[0].organization
      const current = entries.filter(({ month }) => month >= period.fromMonth)
      const observations = new Map<
        string,
        { waste: string; disposal: string; kg: number }
      >()
      for (const record of current.length ? current : entries) {
        const key = record.wasteId + ":" + record.disposalCode
        const item = observations.get(key) ?? {
          waste: record.waste,
          disposal: record.disposal,
          kg: 0,
        }
        item.kg += record.weight
        observations.set(key, item)
      }
      return {
        id,
        name,
        usingHistory: !current.length,
        streams: [...observations.values()]
          .sort((a, b) => b.kg - a.kg)
          .slice(0, 8)
          .map((item) => ({ ...item, kg: Number(item.kg.toFixed(2)) })),
        catalogMeasures:
          dashboard.recommendations.find((item) => item.organizationId === id)
            ?.measures ?? [],
        anomalies: dashboard.anomalies
          .filter((item) => item.organizationId === id)
          .slice(0, 4)
          .map(({ waste, month, growthPct, baselineMonths }) => ({
            waste,
            month,
            growthPct: Math.round(growthPct),
            baselineMonths,
          })),
      }
    }),
  }
}

export async function pointCatalog(rows: DbRows, org: string) {
  const [wastes, methods] = await Promise.all([
    rows<{
      waste_type_id: string
      name_ru: string
      name_kz: string
      unit: string
    }>(
      "v_organization_waste_catalog",
      new URLSearchParams({
        select: "waste_type_id,name_ru,name_kz,unit",
        organization_id: "eq." + org,
        limit: "500",
      })
    ),
    rows<{ id: string; name_ru: string; name_kz: string }>(
      "disposal_methods",
      new URLSearchParams({
        select: "id,name_ru,name_kz",
        is_active: "eq.true",
        limit: "50",
      })
    ),
  ])
  return { wastes, methods }
}
