export type ReviewStatus = "submitted" | "in_review" | "returned" | "approved"
export type Status = ReviewStatus | "draft"
export type Decision = "returned" | "approved"
export type Connection = "connecting" | "live" | "offline"

export type Inspector = { id: string; name: string }
export type WorkspaceUser = Inspector & {
  role: "inspector" | "management" | "admin"
  token?: string
}

export type Report = {
  id: string
  organization: string
  summaryRule: string
  period: string
  submittedBy: string
  status: ReviewStatus
  updatedAt: string
  comment: string
}

export type WasteRecord = {
  id: string
  date: string
  waste: string
  wasteCode: string
  isTara: boolean
  quantity: number | null
  unit: string
  weight: number | null
  disposal: string
  co2: number | null
  photo: string
}

export type HistoryEntry = {
  id: string
  at: string
  actor: string
  from: string
  to: string
  comment: string
}

export type ReportDetail = { records: WasteRecord[]; history: HistoryEntry[] }
export type ReportChange = { submittedId?: string }

export interface ReviewSource {
  list(): Promise<Report[]>
  detail(id: string): Promise<ReportDetail>
  decide(
    report: Report,
    decision: Decision,
    comment: string,
    inspector: Inspector
  ): Promise<Report>
  watch(
    change: (change: ReportChange) => void,
    connection: (state: Connection) => void
  ): () => void
}

export const statusLabels: Record<Status, string> = {
  draft: "Черновик",
  submitted: "На проверке",
  in_review: "В работе",
  returned: "На доработке",
  approved: "Принят",
}

export const reviewStatuses = [
  "submitted",
  "in_review",
  "returned",
  "approved",
] as const

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return reviewStatuses.some((status) => status === value)
}

export function canReview(status: ReviewStatus) {
  return status === "submitted" || status === "in_review"
}

export function statusLabel(status: string) {
  return statusLabels[status as Status] ?? (status || "—")
}

export function decisionComment(decision: Decision, input: string) {
  const comment = input.trim()
  if (decision === "returned" && !comment) {
    throw new Error("Укажите, что нужно исправить перед повторной отправкой.")
  }
  return comment || "Отчёт проверен и принят в единый реестр."
}

export function total<K extends string>(
  records: readonly Record<K, number | null>[],
  field: K
) {
  if (records.some((record) => record[field] === null)) return null
  return records.reduce((sum, record) => sum + (record[field] ?? 0), 0)
}

export function tppSubtotal(summaryRule: string, records: WasteRecord[]) {
  if (summaryRule !== "tara_plus_bones") return undefined
  const relevant = records.filter(
    ({ isTara, wasteCode }) =>
      isTara || wasteCode === "meat_bones" || wasteCode === "fish_bones"
  )
  return total(relevant, "weight")
}

const numberFormat = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 3,
})
const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Almaty",
})
const timestampFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Almaty",
})
const monthFormat = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

export function numberLabel(value: number | null, suffix = "") {
  return value === null ? "—" : `${numberFormat.format(value)}${suffix}`
}

export function dateLabel(value: string, withTime = false) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : (withTime ? timestampFormat : dateFormat).format(date)
}

export function periodLabel(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(value)) return value || "—"
  const label = monthFormat.format(
    new Date(`${value.slice(0, 7)}-01T00:00:00Z`)
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function photoLink(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null
  } catch {
    return null
  }
}
