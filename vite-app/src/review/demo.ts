import { canReview, decisionComment } from "./model"
import type { AnalyticsRecord } from "@/analytics/model"
import type { RegistryRecord, WorkspaceSource } from "@/reporting/model"
import type { HistoryEntry, Report, ReportChange, WasteRecord } from "./model"

export const demoInspector = { id: "demo-inspector", name: "Байжанова С. М." }
export const demoPeriod = "2026-11"

function demoReport(
  id: string,
  organization: string,
  submittedBy: string,
  updatedAt: string,
  status: Report["status"] = "submitted"
): Report {
  return {
    id,
    organization,
    submittedBy,
    updatedAt,
    status,
    period: demoPeriod,
    comment: "",
    summaryRule: id === "tpp" ? "tara_plus_bones" : "monthly_by_item",
  }
}

const starterReports = [
  demoReport("tpp", "Кафедра ТПП", "Оспанов Н. Е.", "2026-11-12T05:42:00Z"),
  demoReport("inn", "УГК ATU INN", "Садыкова А. Р.", "2026-11-11T08:15:00Z"),
  {
    ...demoReport(
      "canella",
      "Кофейня ИП «Canella»",
      "Ким А. В.",
      "2026-11-10T09:14:00Z",
      "returned"
    ),
    comment: "Уточните объём отработанного масла.",
  },
  {
    ...demoReport(
      "thipp",
      "Кафедра ТХиПП",
      "Абдрахманова А. К.",
      "2026-11-10T06:13:00Z",
      "approved"
    ),
    comment: "Отчёт проверен и принят в единый реестр.",
  },
]
const mobileReport = demoReport(
  "iskander",
  "Столовая ИП «Искандер»",
  "Касымов Е. Б.",
  ""
)
const demoOrganizations = [...starterReports, mobileReport]

function record(
  id: string,
  wasteCode: string,
  waste: string,
  quantity: number,
  disposal: string,
  co2: number,
  options: { oil?: boolean; tara?: boolean; day?: string } = {}
): WasteRecord {
  return {
    id,
    wasteCode,
    waste,
    quantity,
    disposal,
    co2,
    date: `${demoPeriod}-${options.day ?? "10"}`,
    unit: options.oil ? "l" : "kg",
    weight: options.oil ? Math.round(quantity * 92) / 100 : quantity,
    isTara: options.tara ?? false,
    photo: "",
  }
}

const demoRecords: Record<string, WasteRecord[]> = {
  tpp: [
    record(
      "1",
      "cardboard_packaging",
      "Картонная тара",
      12.5,
      "Переработка",
      0.08,
      { tara: true }
    ),
    record(
      "2",
      "meat_bones",
      "Мясные кости",
      8.2,
      "Анаэробное сбраживание",
      0.073
    ),
    record(
      "3",
      "fish_bones",
      "Рыбные кости",
      4.3,
      "Анаэробное сбраживание",
      0.038,
      { day: "11" }
    ),
    record(
      "4",
      "used_oil",
      "Отработанное фритюрное масло",
      5,
      "На биодизель",
      0.038,
      { oil: true, day: "11" }
    ),
  ],
  inn: [record("1", "food", "Пищевые остатки", 18.4, "Компостирование", 0.19)],
  canella: [
    record(
      "1",
      "used_oil",
      "Отработанное фритюрное масло",
      3.5,
      "На биодизель",
      0.027,
      { oil: true }
    ),
  ],
  thipp: [
    record("1", "peelings", "Овощные очистки", 7.6, "Компостирование", 0.078),
  ],
  iskander: [
    record(
      "1",
      "unsold",
      "Остатки нереализованной продукции",
      21.2,
      "Фудшеринг",
      0
    ),
  ],
}

type DemoWasteType = Pick<
  AnalyticsRecord,
  "category" | "recyclable" | "recommendedCode" | "recommendedLabel"
> & { landfillFactor: number; recommendedFactor: number }

const compost = {
  category: "organic",
  recyclable: "yes",
  recommendedCode: "COMPOST",
  recommendedLabel: "Компостирование",
  landfillFactor: 700.21,
  recommendedFactor: 8.88,
} satisfies DemoWasteType

const bones = {
  ...compost,
  recyclable: "partial",
  recommendedCode: "AD",
  recommendedLabel: "Анаэробное сбраживание (биогаз)",
} satisfies DemoWasteType

const cardboard = {
  category: "recyclable",
  recyclable: "yes",
  recommendedCode: "RECYCLE",
  recommendedLabel: "Раздельный сбор и сдача на переработку",
  landfillFactor: 1164.39,
  recommendedFactor: 6.41,
} satisfies DemoWasteType

const wasteTypes: Record<string, DemoWasteType> = {
  food: compost,
  peelings: compost,
  meat_bones: bones,
  fish_bones: bones,
  cardboard_packaging: cardboard,
  packaging_waste: { ...cardboard, category: "mixed", recyclable: "partial" },
  used_oil: {
    ...compost,
    category: "special",
    recommendedCode: "OIL",
    recommendedLabel: "Сдача масла спецорганизации на биодизель",
    recommendedFactor: 6.41,
  },
  unsold: {
    ...compost,
    recommendedCode: "DONATE",
    recommendedLabel:
      "Безопасная продукция — на фудшеринг, остальное — в компост",
  },
}

const disposalMethods: Record<
  string,
  Pick<AnalyticsRecord, "disposalCode" | "hierarchyRank">
> = {
  Переработка: { disposalCode: "RECYCLE", hierarchyRank: 3 },
  "Анаэробное сбраживание": { disposalCode: "AD", hierarchyRank: 4 },
  "На биодизель": { disposalCode: "OIL", hierarchyRank: 3 },
  Компостирование: { disposalCode: "COMPOST", hierarchyRank: 4 },
  Фудшеринг: { disposalCode: "DONATE", hierarchyRank: 1 },
  "Вывоз ТБО на полигон": { disposalCode: "TBO", hierarchyRank: 5 },
}

const historicalPeriods = ["2026-08", "2026-09", "2026-10"]
const mixedPackaging = record(
  "5",
  "packaging_waste",
  "Смешанные упаковочные отходы",
  4,
  "Вывоз ТБО на полигон",
  4.658,
  { day: "12", tara: true }
)

type DemoRegistryEntry = {
  registry: RegistryRecord
  analytics: AnalyticsRecord
}

function registryRows(
  report: Report,
  period = report.period
): DemoRegistryEntry[] {
  const records = [...(demoRecords[report.id] ?? [])]
  if (report.id === "tpp" && (period === "2026-08" || period === "2026-09")) {
    records.push(mixedPackaging)
  }

  const factor =
    report.id === "iskander"
      ? period === "2026-10"
        ? 1.45
        : 1
      : period === "2026-08"
        ? 0.94
        : period === "2026-09"
          ? 1.07
          : 1

  return records.map((record) => {
    const wasteType = wasteTypes[record.wasteCode]
    const disposal = disposalMethods[record.disposal]
    const quantity = Math.round((record.quantity ?? 0) * factor * 100) / 100
    const weight =
      record.unit === "l" ? Math.round(quantity * 92) / 100 : quantity
    const landfill = (weight * wasteType.landfillFactor) / 1000
    const co2Actual =
      disposal.disposalCode === "TBO"
        ? Math.round(landfill * 1000) / 1000
        : Math.round((record.co2 ?? 0) * factor * 1000) / 1000
    const co2Saved = Math.round(Math.max(0, landfill - co2Actual) * 1000) / 1000

    return {
      registry: {
        ...record,
        id: `${period}-${report.id}-${record.id}`,
        date: `${period}-${record.date.slice(-2)}`,
        organizationId: report.id,
        organization: report.organization,
        summaryRule: report.summaryRule,
        wasteId: record.wasteCode,
        disposalId: record.disposal,
        quantity,
        weight,
        co2: co2Actual,
        co2Saved,
        co2Landfill: Math.round(landfill * 1000) / 1000,
      },
      analytics: {
        month: period,
        organizationId: report.id,
        orgCode: report.id === "inn" ? "atu_inn" : report.id,
        organization: report.organization,
        wasteId: record.wasteCode,
        wasteCode:
          record.wasteCode === "unsold" ? "unsold_food" : record.wasteCode,
        waste: record.waste,
        category: wasteType.category,
        recyclable: wasteType.recyclable,
        disposal: record.disposal,
        ...disposal,
        recommendedCode: wasteType.recommendedCode,
        recommendedLabel: wasteType.recommendedLabel,
        weight,
        co2Actual,
        co2IfTbo: Math.round(landfill * 1000) / 1000,
        co2Saved,
        co2Potential:
          Math.round(
            weight * (wasteType.landfillFactor - wasteType.recommendedFactor)
          ) / 1000,
      },
    }
  })
}

const historicalRegistry = historicalPeriods.flatMap((period) =>
  demoOrganizations.flatMap((report) => registryRows(report, period))
)

function historyFor(report: Report): HistoryEntry[] {
  const submission = {
    id: `${report.id}-submitted`,
    at: new Date(
      Date.parse(report.updatedAt) - (canReview(report.status) ? 0 : 3600000)
    ).toISOString(),
    actor: report.submittedBy,
    from: "draft",
    to: "submitted",
    comment: "Отчёт отправлен на проверку.",
  }
  return canReview(report.status)
    ? [submission]
    : [
        {
          id: `${report.id}-decision`,
          at: report.updatedAt,
          actor: demoInspector.name,
          from: "submitted",
          to: report.status,
          comment: report.comment,
        },
        submission,
      ]
}

export function createDemoSource(): WorkspaceSource & {
  submitFromMobile(): boolean
} {
  const reports = new Map(starterReports.map((report) => [report.id, report]))
  const histories = new Map(
    starterReports.map((report) => [report.id, historyFor(report)])
  )
  const listeners = new Set<(change: ReportChange) => void>()
  let counter = 0

  function approvedEntries() {
    return [
      ...historicalRegistry,
      ...[...reports.values()]
        .filter((report) => report.status === "approved")
        .flatMap((report) => registryRows(report)),
    ]
  }

  function update(
    report: Report,
    from: string,
    actor: string,
    comment: string
  ) {
    reports.set(report.id, report)
    histories.set(report.id, [
      {
        id: `demo-${++counter}`,
        at: report.updatedAt,
        actor,
        from,
        to: report.status,
        comment,
      },
      ...(histories.get(report.id) ?? []),
    ])
    for (const notify of listeners)
      notify(report.status === "submitted" ? { submittedId: report.id } : {})
    return report
  }

  return {
    async submissions(period) {
      return demoOrganizations.map((organization) => ({
        organizationId: organization.id,
        organization: organization.organization,
        status: historicalPeriods.includes(period)
          ? "approved"
          : period === demoPeriod
            ? (reports.get(organization.id)?.status ?? "draft")
            : "draft",
        responsible: organization.submittedBy,
        email: `${organization.id}@atu.example`,
      }))
    },
    async catalog() {
      const records = [...Object.values(demoRecords).flat(), mixedPackaging]
      return {
        organizations: demoOrganizations.map(({ id, organization }) => ({
          id,
          name: organization,
        })),
        wastes: [
          ...new Map(
            records.map((record) => [record.wasteCode, record.waste])
          ).entries(),
        ].map(([id, name]) => ({ id, name })),
        disposals: [...new Set(records.map((record) => record.disposal))].map(
          (name) => ({ id: name, name })
        ),
      }
    },
    async registry(filters) {
      return approvedEntries()
        .map((entry) => entry.registry)
        .filter(
          (record) =>
            record.date >= filters.from &&
            record.date <= filters.to &&
            (!filters.organizationId ||
              filters.organizationId === record.organizationId) &&
            (!filters.wasteId || filters.wasteId === record.wasteId) &&
            (!filters.disposalId || filters.disposalId === record.disposalId)
        )
        .sort(
          (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
        )
    },
    async analytics(fromMonth, toMonth) {
      return approvedEntries()
        .map((entry) => entry.analytics)
        .filter(
          (record) => record.month >= fromMonth && record.month <= toMonth
        )
    },
    async list() {
      return [...reports.values()].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      )
    },
    async detail(id) {
      return {
        records: demoRecords[id] ?? [],
        history: histories.get(id) ?? [],
      }
    },
    async decide(report, decision, input, inspector) {
      const current = reports.get(report.id)
      if (
        !current ||
        !canReview(current.status) ||
        current.updatedAt !== report.updatedAt
      ) {
        throw new Error("Отчёт уже изменился. Откройте актуальную версию.")
      }
      const comment = decisionComment(decision, input)
      return update(
        {
          ...current,
          status: decision,
          updatedAt: new Date().toISOString(),
          comment,
        },
        current.status,
        inspector.name,
        comment
      )
    },
    watch(change, connection) {
      listeners.add(change)
      connection("live")
      return () => {
        listeners.delete(change)
      }
    },
    submitFromMobile() {
      const returned = [...reports.values()]
        .filter((report) => report.status === "returned")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      const report =
        returned ?? (!reports.has(mobileReport.id) ? mobileReport : undefined)
      if (!report) return false
      update(
        {
          ...report,
          updatedAt: new Date().toISOString(),
          status: "submitted",
          comment: "",
        },
        returned ? "returned" : "draft",
        report.submittedBy,
        "Отчёт отправлен на проверку."
      )
      return true
    },
  }
}
