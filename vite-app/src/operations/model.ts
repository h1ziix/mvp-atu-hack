import type { Status } from "@/review/model"

export type Organization = {
  id: string
  code: string
  name_ru: string
  org_type_ru: string
  building_ru: string
  qr_code_token: string
  is_active: boolean
}

export type Profile = {
  id: string
  email: string
  full_name_ru: string
  role: string
  organization_id: string | null
  is_active: boolean
}

export type NewOrganization = Pick<
  Organization,
  "code" | "name_ru" | "org_type_ru" | "building_ru"
> & {
  name_kz?: string
  org_type_kz?: string
  building_kz?: string
  template_id: string
  is_laboratory: boolean
  summary_rule: string
}

export type NewResponsible = Pick<Profile, "email" | "full_name_ru"> & {
  full_name_kz?: string
  organization_id: string
  password: string
}

export type WasteOption = {
  id: string
  code: string | null
  name_ru: string
  unit: "kg" | "l"
}
export type DisposalOption = { id: string; code: string; name_ru: string }
export type ImportCatalog = {
  organizations: Organization[]
  wastes: WasteOption[]
  disposals: DisposalOption[]
  assignments: { organization_id: string; waste_type_id: string }[]
}

export type Measurement = {
  date: string
  waste_id: string
  disposal_id: string
  amount: number
}
export type ImportRow = Measurement & {
  line: number
  organization_id: string
  unit: WasteOption["unit"]
}

export type Point = {
  organization: Organization
  wastes: WasteOption[]
  disposals: DisposalOption[]
}

export type PointMonth = {
  status: Status
  comment: string | null
  records: {
    id: string
    record_date: string
    waste_name_ru: string
    amount: number
    unit: string
  }[]
}

export interface Operations {
  organizations(): Promise<Organization[]>
  profiles(): Promise<Profile[]>
  createOrganization(token: string, input: NewOrganization): Promise<void>
  createResponsible(token: string, input: NewResponsible): Promise<void>
  importCatalog(): Promise<ImportCatalog>
  importRows(token: string, rows: ImportRow[]): Promise<number>
  point(token: string): Promise<Point>
  pointLogin(point: Point, email: string, password: string): Promise<string>
  pointMonth(point: Point, month: string): Promise<PointMonth>
  pointAdd(token: string, point: Point, input: Measurement): Promise<void>
  pointSubmit(token: string, point: Point, month: string): Promise<void>
}

export function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Almaty" }).format(
    new Date()
  )
}

export const roleLabel: Record<string, string> = {
  responsible: "Ответственный",
  inspector: "Проверяющий",
  admin: "Администратор",
  management: "Руководство",
}
