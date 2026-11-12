import type { AnalyticsRecord } from "@/analytics/model"
import type { ReviewSource, Status, WasteRecord } from "@/review/model"
import { periodLabel } from "@/review/model"

export type CatalogOption = { id: string; name: string }

export type Catalog = {
  organizations: CatalogOption[]
  wastes: CatalogOption[]
  disposals: CatalogOption[]
}

export type DateRange = { from: string; to: string }

export type RegistryFilters = DateRange & {
  organizationId: string
  wasteId: string
  disposalId: string
}

export type RegistryRecord = WasteRecord & {
  organizationId: string
  organization: string
  summaryRule?: string
  wasteId: string
  disposalId: string
  co2Saved: number | null
  co2Landfill?: number | null
}

export type Submission = {
  organizationId: string
  organization: string
  status: Status
  responsible: string
  email: string
}

export interface ReportingSource {
  submissions(period: string): Promise<Submission[]>
  catalog(): Promise<Catalog>
  registry(filters: RegistryFilters): Promise<RegistryRecord[]>
  analytics(fromMonth: string, toMonth: string): Promise<AnalyticsRecord[]>
}

export type WorkspaceSource = ReviewSource & ReportingSource

export function currentMonth() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
  }).format(new Date())
}

function endOfMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return `${month}-${day}`
}

export function monthRange(month: string): DateRange | null {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) return null
  return { from: `${month}-01`, to: endOfMonth(month) }
}

export function quarterRange(year: string, quarter: string): DateRange | null {
  if (!/^[1-9]\d{3}$/.test(year) || !/^[1-4]$/.test(quarter)) return null
  const end = Number(quarter) * 3
  const startMonth = String(end - 2).padStart(2, "0")
  const endMonth = String(end).padStart(2, "0")
  return {
    from: `${year}-${startMonth}-01`,
    to: endOfMonth(`${year}-${endMonth}`),
  }
}

function validDate(value: string) {
  const month = monthRange(value.slice(0, 7))
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    month !== null &&
    value >= month.from &&
    value <= month.to
  )
}

export function dateRange(from: string, to: string): DateRange | null {
  return validDate(from) && validDate(to) && from <= to ? { from, to } : null
}

export function reminderLink(submission: Submission, period: string) {
  const email = submission.email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  const address = encodeURIComponent(email).replace("%40", "@")
  const subject = `Напоминание о сдаче отчёта АТУ · ${periodLabel(period)}`
  const body = `Здравствуйте!\r\n\r\nПожалуйста, отправьте отчёт по учёту пищевых отходов за период «${periodLabel(period)}» для подразделения «${submission.organization}».\r\n\r\nСпасибо!`
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
