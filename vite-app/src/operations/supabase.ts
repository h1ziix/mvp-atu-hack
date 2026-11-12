import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  DisposalOption,
  Operations,
  Organization,
  PointMonth,
  WasteOption,
} from "./model"

type Result<T> = {
  data: T | null
  error: { message: string; code?: string } | null
}
const orgColumns =
  "id,code,name_ru,org_type_ru,building_ru,qr_code_token,is_active"

function read<T>({ data, error }: Result<T>): T {
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883")
      throw new Error(
        "Для этой операции подключите миграцию W4 и войдите повторно."
      )
    throw new Error(error.message)
  }
  return data as T
}

async function pages<T>(
  request: (from: number, to: number) => PromiseLike<Result<T[]>>
) {
  const rows: T[] = []
  const size = 500
  for (let from = 0; ; from += size) {
    const page = read(await request(from, from + size - 1)) ?? []
    rows.push(...page)
    if (page.length < size) return rows
  }
}

export async function endSession(client: SupabaseClient, token: string) {
  await client.rpc("w4_sign_out", { p_token: token })
}

export function supabaseOperations(client: SupabaseClient): Operations {
  const organizations = () =>
    pages<Organization>((from, to) =>
      client
        .from("organizations")
        .select(orgColumns)
        .order("name_ru")
        .order("id")
        .range(from, to)
    )
  const disposals = () =>
    pages<DisposalOption>((from, to) =>
      client
        .from("disposal_methods")
        .select("id,code,name_ru")
        .eq("is_active", true)
        .order("name_ru")
        .order("id")
        .range(from, to)
    )
  return {
    organizations,
    profiles: () =>
      pages((from, to) =>
        client
          .from("profiles")
          .select("id,email,full_name_ru,role,organization_id,is_active")
          .order("full_name_ru")
          .order("id")
          .range(from, to)
      ),
    async createOrganization(token, input) {
      read(
        await client.rpc("w4_create_organization", {
          p_token: token,
          p_fields: input,
        })
      )
    },
    async createResponsible(token, input) {
      read(
        await client.rpc("w4_create_responsible", {
          p_token: token,
          p_fields: input,
        })
      )
    },
    async importCatalog() {
      const [orgs, wastes, methods, assignments] = await Promise.all([
        organizations(),
        pages<WasteOption>((from, to) =>
          client
            .from("waste_types")
            .select("id,code,name_ru,unit")
            .eq("is_active", true)
            .order("id")
            .range(from, to)
        ),
        disposals(),
        pages<{ organization_id: string; waste_type_id: string }>((from, to) =>
          client
            .from("organization_waste_types")
            .select("organization_id,waste_type_id")
            .order("organization_id")
            .order("waste_type_id")
            .range(from, to)
        ),
      ])
      return {
        organizations: orgs.filter(({ is_active }) => is_active),
        wastes,
        disposals: methods,
        assignments,
      }
    },
    async importRows(token, rows) {
      return read(
        await client.rpc("w4_import", { p_token: token, p_rows: rows })
      ) as number
    },
    async point(token) {
      const organization = read(
        await client
          .from("organizations")
          .select(orgColumns)
          .eq("qr_code_token", token)
          .eq("is_active", true)
          .maybeSingle()
      ) as Organization | null
      if (!organization)
        throw new Error("Точка не найдена или больше не действует.")
      const [rows, methods] = await Promise.all([
        pages<{
          waste_type_id: string
          waste_code: string | null
          name_ru: string
          unit: "kg" | "l"
        }>((from, to) =>
          client
            .from("v_organization_waste_catalog")
            .select("waste_type_id,waste_code,name_ru,unit")
            .eq("organization_id", organization.id)
            .order("sort_order")
            .order("waste_type_id")
            .range(from, to)
        ),
        disposals(),
      ])
      return {
        organization,
        wastes: rows.map(
          ({ waste_type_id: id, waste_code: code, name_ru, unit }) => ({
            id,
            code,
            name_ru,
            unit,
          })
        ),
        disposals: methods,
      }
    },
    async pointLogin(point, email, password) {
      const session = read<{
        role: string
        organization_id: string
        token: string
      } | null>(
        await client
          .rpc("w4_sign_in", { p_email: email, p_password: password })
          .maybeSingle()
      )
      if (!session) throw new Error("Проверьте почту и пароль.")
      if (
        session.role !== "responsible" ||
        session.organization_id !== point.organization.id
      ) {
        await endSession(client, session.token)
        throw new Error("Ваш аккаунт не привязан к этой точке.")
      }
      return session.token
    },
    async pointMonth(point, month) {
      const org = point.organization.id
      const [report, records] = await Promise.all([
        client
          .from("reports")
          .select("status,inspector_comment")
          .eq("organization_id", org)
          .eq("period_month", month)
          .maybeSingle(),
        pages<PointMonth["records"][number]>((from, to) =>
          client
            .from("v_enriched_waste_records")
            .select("id,record_date,waste_name_ru,amount,unit")
            .eq("organization_id", org)
            .eq("period_month", month)
            .order("record_date", { ascending: false })
            .order("id")
            .range(from, to)
        ),
      ])
      const value = read(report)
      return {
        status: value?.status ?? "draft",
        comment: value?.inspector_comment ?? null,
        records,
      }
    },
    async pointAdd(token, point, input) {
      read(
        await client.rpc("w4_point_add", {
          p_token: token,
          p_point: point.organization.qr_code_token,
          p_date: input.date,
          p_waste: input.waste_id,
          p_method: input.disposal_id,
          p_amount: input.amount,
        })
      )
    },
    async pointSubmit(token, point, month) {
      read(
        await client.rpc("w4_point_submit", {
          p_token: token,
          p_point: point.organization.qr_code_token,
          p_month: month,
        })
      )
    },
  }
}
