import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { AnalyticsRecord } from "@/analytics/model"
import type { WorkspaceSource } from "@/reporting/model"
import {
  canReview,
  decisionComment,
  isReviewStatus,
  reviewStatuses,
} from "./model"
import type { Report, WasteRecord, WorkspaceUser } from "./model"

type Row = Record<string, unknown>
type Query = PromiseLike<{
  data: Row[] | null
  error: { message: string } | null
}>

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabase =
  url && key && /^https?:\/\//i.test(url) ? createClient(url, key) : null

function row(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {}
}

function text(...values: unknown[]) {
  return (
    values.find(
      (value): value is string =>
        typeof value === "string" && value.trim() !== ""
    ) ?? ""
  )
}

function numeric(...values: unknown[]) {
  for (const value of values) {
    if (
      typeof value !== "number" &&
      (typeof value !== "string" || !value.trim())
    )
      continue
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}

function profileName(profile: Row) {
  return text(profile.full_name_ru, profile.full_name_kz)
}

const wasteColumns =
  "id, record_date, waste_code, waste_name_ru, waste_name_kz, is_tara, amount, unit, weight_kg, disposal_name_ru, disposal_name_kz, co2_actual_kg, photo_url"

const analyticsColumns =
  "period_month, organization_id, org_code, org_name_ru, org_name_kz, waste_type_id, waste_code, waste_name_ru, waste_name_kz, category, recyclable, disposal_code, disposal_name_ru, disposal_name_kz, hierarchy_rank, recommended_method_code, recommended_label_ru, recommended_label_kz, weight_kg, co2_actual_kg, co2_if_tbo_kg, co2_saved_actual_kg, co2_potential_saving_kg"

function analyticsNumber(record: Row, column: string) {
  const value = numeric(record[column])
  if (value === null) {
    throw new Error(`В записи реестра отсутствует показатель ${column}.`)
  }
  return value
}

function analyticsFromRow(record: Row): AnalyticsRecord {
  const { category, recyclable } = record
  if (
    (category !== "organic" &&
      category !== "recyclable" &&
      category !== "special" &&
      category !== "mixed") ||
    (recyclable !== "yes" && recyclable !== "partial" && recyclable !== "no")
  ) {
    throw new Error("В записи реестра указана неизвестная категория отходов.")
  }

  return {
    month: text(record.period_month),
    organizationId: text(record.organization_id),
    orgCode: text(record.org_code),
    organization: text(record.org_name_ru, record.org_name_kz),
    wasteId: text(record.waste_type_id),
    wasteCode: text(record.waste_code),
    waste: text(record.waste_name_ru, record.waste_name_kz),
    category,
    recyclable,
    disposalCode: text(record.disposal_code),
    disposal: text(record.disposal_name_ru, record.disposal_name_kz),
    hierarchyRank: analyticsNumber(record, "hierarchy_rank"),
    recommendedCode: text(record.recommended_method_code),
    recommendedLabel: text(
      record.recommended_label_ru,
      record.recommended_label_kz
    ),
    weight: analyticsNumber(record, "weight_kg"),
    co2Actual: analyticsNumber(record, "co2_actual_kg"),
    co2IfTbo: analyticsNumber(record, "co2_if_tbo_kg"),
    co2Saved: analyticsNumber(record, "co2_saved_actual_kg"),
    co2Potential: analyticsNumber(record, "co2_potential_saving_kg"),
  }
}

function wasteFromRow(record: Row): WasteRecord {
  return {
    id: text(record.id),
    date: text(record.record_date),
    waste: text(record.waste_name_ru, record.waste_name_kz),
    wasteCode: text(record.waste_code),
    isTara: record.is_tara === true,
    quantity: numeric(record.amount),
    unit: text(record.unit),
    weight: numeric(record.weight_kg),
    disposal: text(record.disposal_name_ru, record.disposal_name_kz),
    co2: numeric(record.co2_actual_kg),
    photo: text(record.photo_url),
  }
}

const pageSize = 500

async function readPages(
  message: string,
  query: (from: number, to: number) => Query
) {
  const rows: Row[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1)
    if (error) throw new Error(`${message}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

function reportFromRow(report: Row): Report {
  const organization = row(report.organizations)
  if (!isReviewStatus(report.status))
    throw new Error("Неизвестный статус отчёта.")
  return {
    id: text(report.id),
    organization:
      text(organization.name_ru, organization.name_kz, organization.name) ||
      "Организация не указана",
    summaryRule: text(organization.summary_rule),
    submittedBy: profileName(row(report.profiles)),
    period: text(report.period_month),
    status: report.status,
    updatedAt: text(report.updated_at),
    comment: text(report.inspector_comment),
  }
}

export async function signInWorkspace(
  client: SupabaseClient,
  email: string,
  password: string
): Promise<WorkspaceUser> {
  const credentials = { p_email: email, p_password: password }
  let result = await client.rpc("w4_sign_in", credentials).maybeSingle()
  if (result.error?.code === "PGRST202" || result.error?.code === "42883") {
    result = await client.rpc("authenticate_user", credentials).maybeSingle()
  }
  const { data, error } = result
  if (error)
    throw new Error(
      "Не удалось войти. Проверьте подключение к системе и попробуйте снова."
    )
  const profile = row(data)
  const id = text(profile.id)
  if (!id) throw new Error("Проверьте почту и пароль.")
  const { role } = profile
  if (role !== "inspector" && role !== "management" && role !== "admin") {
    if (profile.token)
      await client.rpc("w4_sign_out", { p_token: profile.token })
    throw new Error("Ответственные входят по ссылке своей точки.")
  }
  return {
    id,
    name:
      profileName(profile) ||
      (role === "inspector"
        ? "Проверяющий"
        : role === "admin"
          ? "Администратор"
          : "Руководство"),
    role,
    token: text(profile.token) || undefined,
  }
}

export function supabaseReviewSource(client: SupabaseClient): WorkspaceSource {
  let subscription = 0

  async function options(
    table: "organizations" | "waste_types" | "disposal_methods"
  ) {
    const values = await readPages(
      "Не удалось загрузить справочник",
      (from, to) =>
        client
          .from(table)
          .select("id, name_ru")
          .order("name_ru")
          .order("id")
          .range(from, to)
    )
    return values.map((value) => ({
      id: text(value.id),
      name: text(value.name_ru),
    }))
  }

  return {
    async submissions(period) {
      const submissions = await readPages(
        "Не удалось проверить сдачу отчётов",
        (from, to) =>
          client
            .from("v_non_submitted_organizations")
            .select(
              "organization_id, org_name_ru, status, responsible_name_ru, responsible_email"
            )
            .eq("period_month", period)
            .order("org_name_ru")
            .order("organization_id")
            .range(from, to)
      )
      if (submissions.length) {
        return submissions.map((entry) => ({
          organizationId: text(entry.organization_id),
          organization: text(entry.org_name_ru),
          status: isReviewStatus(entry.status) ? entry.status : "draft",
          responsible: text(entry.responsible_name_ru),
          email: text(entry.responsible_email),
        }))
      }

      // The view has no rows for months absent from the reports table.
      const organizations = await readPages(
        "Не удалось загрузить подразделения",
        (from, to) =>
          client
            .from("organizations")
            .select(
              "id, name_ru, profiles!profiles_organization_id_fkey(full_name_ru, full_name_kz, email)"
            )
            .eq("is_active", true)
            .eq("profiles.role", "responsible")
            .eq("profiles.is_active", true)
            .order("id", { referencedTable: "profiles" })
            .order("name_ru")
            .order("id")
            .range(from, to)
      )
      return organizations.map((entry) => {
        const responsible = row(
          Array.isArray(entry.profiles) ? entry.profiles[0] : null
        )
        return {
          organizationId: text(entry.id),
          organization: text(entry.name_ru),
          status: "draft",
          responsible: profileName(responsible),
          email: text(responsible.email),
        }
      })
    },

    async catalog() {
      const [organizations, wastes, disposals] = await Promise.all([
        options("organizations"),
        options("waste_types"),
        options("disposal_methods"),
      ])
      return { organizations, wastes, disposals }
    },

    async registry(filters) {
      const records = await readPages(
        "Не удалось загрузить реестр",
        (from, to) => {
          let query = client
            .from("v_approved_registry")
            .select(
              `${wasteColumns}, organization_id, org_name_ru, summary_rule, waste_type_id, disposal_method_id, co2_saved_actual_kg, co2_if_tbo_kg`
            )
            .gte("record_date", filters.from)
            .lte("record_date", filters.to)
          if (filters.organizationId)
            query = query.eq("organization_id", filters.organizationId)
          if (filters.wasteId)
            query = query.eq("waste_type_id", filters.wasteId)
          if (filters.disposalId)
            query = query.eq("disposal_method_id", filters.disposalId)
          return query
            .order("record_date", { ascending: false })
            .order("id")
            .range(from, to)
        }
      )
      return records.map((record) => ({
        ...wasteFromRow(record),
        organizationId: text(record.organization_id),
        organization: text(record.org_name_ru),
        summaryRule: text(record.summary_rule),
        wasteId: text(record.waste_type_id),
        disposalId: text(record.disposal_method_id),
        co2Saved: numeric(record.co2_saved_actual_kg),
        co2Landfill: numeric(record.co2_if_tbo_kg),
      }))
    },

    async analytics(fromMonth, toMonth) {
      const records = await readPages(
        "Не удалось загрузить данные для аналитики",
        (from, to) =>
          client
            .from("v_approved_registry")
            .select(analyticsColumns)
            .gte("period_month", fromMonth)
            .lte("period_month", toMonth)
            .order("period_month")
            .order("id")
            .range(from, to)
      )
      return records.map(analyticsFromRow)
    },

    async list() {
      const reports = await readPages(
        "Не удалось загрузить очередь",
        (from, to) =>
          client
            .from("reports")
            .select(
              "id, period_month, status, updated_at, inspector_comment, organizations(name_ru, name_kz, summary_rule), profiles!reports_submitted_by_fkey(full_name_ru, full_name_kz)"
            )
            .in("status", reviewStatuses)
            .order("updated_at", { ascending: false })
            .order("id")
            .range(from, to)
      )
      return reports.map(reportFromRow)
    },

    async detail(id) {
      const [records, events] = await Promise.all([
        readPages("Не удалось загрузить взвешивания", (from, to) =>
          client
            .from("v_enriched_waste_records")
            .select(wasteColumns)
            .eq("report_id", id)
            .order("record_date")
            .order("id")
            .range(from, to)
        ),
        readPages("Не удалось загрузить историю статусов", (from, to) =>
          client
            .from("status_history")
            .select(
              "id, from_status, to_status, created_at, comment, changed_by, profiles!status_history_changed_by_fkey(full_name_ru, full_name_kz)"
            )
            .eq("report_id", id)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to)
        ),
      ])
      return {
        records: records.map(wasteFromRow),
        history: events.map((event) => ({
          id: text(event.id),
          at: text(event.created_at),
          actor:
            profileName(row(event.profiles)) ||
            (event.changed_by ? "Пользователь недоступен" : ""),
          from: text(event.from_status),
          to: text(event.to_status),
          comment: text(event.comment),
        })),
      }
    },

    async decide(report, decision, input, inspector) {
      if (!canReview(report.status))
        throw new Error("Этот отчёт уже не на проверке.")
      const comment = decisionComment(decision, input)
      const { data, error } = await client
        .from("reports")
        .update({
          status: decision,
          inspector_comment: comment,
          reviewed_by: inspector.id,
        })
        .eq("id", report.id)
        .eq("status", report.status)
        .eq("updated_at", report.updatedAt)
        .select("id, updated_at")
        .maybeSingle()
      if (error)
        throw new Error(`Не удалось сохранить решение: ${error.message}`)
      if (!data)
        throw new Error(
          "Отчёт уже изменился. Откройте актуальную версию и проверьте её снова."
        )
      return {
        ...report,
        status: decision,
        updatedAt: data.updated_at,
        comment,
      }
    },

    watch(change, connection) {
      const channel = client
        .channel(`web-reports-watch:${++subscription}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reports" },
          (event) => {
            const next = row(event.new)
            const old = row(event.old)
            const id = text(next.id)
            change(
              next.status === "submitted" && old.status !== "submitted" && id
                ? { submittedId: id }
                : {}
            )
          }
        )
        .subscribe((status) => {
          connection(status === "SUBSCRIBED" ? "live" : "offline")
        })
      return () => {
        void client.removeChannel(channel)
      }
    },
  }
}
