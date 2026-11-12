import type { RegistryRecord } from "@/reporting/model"

type Totals = {
  weight: number
  actual: number
  saved: number
  landfill: number
}
export type SummaryItem = Totals & {
  waste: string
  unit: string
  disposal: string
  quantity: number
}
export type SummaryGroup = {
  id: string
  name: string
  items: SummaryItem[]
  total: Totals
  taraBones: number | null
}

function totals(): Totals {
  return { weight: 0, actual: 0, saved: 0, landfill: 0 }
}

function add(target: Totals, record: RegistryRecord) {
  target.weight += record.weight ?? 0
  target.actual += record.co2 ?? 0
  target.saved += record.co2Saved ?? 0
  target.landfill += record.co2Landfill ?? 0
}

export function unitLabel(unit: string) {
  return unit === "kg" ? "кг" : unit === "l" ? "л" : unit
}

export function buildSummary(records: RegistryRecord[]) {
  const groups = new Map<
    string,
    { group: SummaryGroup; items: Map<string, SummaryItem> }
  >()
  const total = totals()
  for (const record of records) {
    let entry = groups.get(record.organizationId)
    if (!entry) {
      entry = {
        group: {
          id: record.organizationId,
          name: record.organization,
          total: totals(),
          items: [],
          taraBones: record.summaryRule === "tara_plus_bones" ? 0 : null,
        },
        items: new Map(),
      }
      groups.set(record.organizationId, entry)
    }
    const key = JSON.stringify([record.wasteId, record.unit, record.disposalId])
    let item = entry.items.get(key)
    if (!item) {
      item = {
        waste: record.waste,
        unit: unitLabel(record.unit),
        disposal: record.disposal,
        quantity: 0,
        ...totals(),
      }
      entry.items.set(key, item)
    }
    item.quantity += record.quantity ?? 0
    add(item, record)
    add(entry.group.total, record)
    add(total, record)
    if (
      entry.group.taraBones !== null &&
      (record.isTara ||
        record.wasteCode === "meat_bones" ||
        record.wasteCode === "fish_bones")
    ) {
      entry.group.taraBones += record.weight ?? 0
    }
  }
  const organizations = Array.from(groups.values(), ({ group, items }) => ({
    ...group,
    items: [...items.values()].sort(
      (a, b) =>
        a.waste.localeCompare(b.waste, "ru") ||
        a.disposal.localeCompare(b.disposal, "ru")
    ),
  })).sort((a, b) => a.name.localeCompare(b.name, "ru"))
  return { organizations, total, records }
}

export type Summary = ReturnType<typeof buildSummary>

export const reportTitle =
  "Таблица учёта пищевых отходов в университетском комплексе АО «АТУ»"
