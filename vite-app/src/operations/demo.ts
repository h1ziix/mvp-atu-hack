import type { ReportingSource } from "@/reporting/model"
import type {
  ImportRow,
  Operations,
  Organization,
  PointMonth,
  Profile,
} from "./model"

const organizationCodes: Record<string, string> = {
  tpp: "tpp",
  thipp: "thipp",
  inn: "atu_inn",
  canella: "canella",
  iskander: "iskander",
}

type DemoState = {
  organizations: Organization[]
  profiles: Profile[]
  rows: ImportRow[]
  submitted: string[]
}

const storageKey = "atu-demo-w4"

export function createDemoOperations(source: ReportingSource): Operations {
  let state: DemoState = {
    organizations: [],
    profiles: [],
    rows: [],
    submitted: [],
  }
  function readState() {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) state = JSON.parse(saved) as DemoState
    } catch {
      /* The demo also runs without browser storage. */
    }
    return state
  }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      /* Keep this tab usable. */
    }
  }
  const orgList = async () => [
    ...(await source.catalog()).organizations.map(({ id, name }) => ({
      id,
      code: organizationCodes[id] ?? id,
      name_ru: name,
      org_type_ru:
        id === "tpp" || id === "thipp" ? "Учебная лаборатория" : "Общепит",
      building_ru: "Кампус АТУ",
      qr_code_token: `demo-${id}`,
      is_active: true,
    })),
    ...readState().organizations,
  ]
  const importCatalog: Operations["importCatalog"] = async () => {
    const { wastes, disposals } = await source.catalog()
    const organizations = await orgList()
    return {
      organizations,
      wastes: wastes.map(({ id, name }) => ({
        id,
        code: id,
        name_ru: name,
        unit: id === "used_oil" ? "l" : "kg",
      })),
      disposals: disposals.map(({ id, name }) => ({
        id,
        code: id,
        name_ru: name,
      })),
      assignments: organizations.flatMap(({ id }) =>
        wastes.map((waste) => ({
          organization_id: id,
          waste_type_id: waste.id,
        }))
      ),
    }
  }
  const pointMonth: Operations["pointMonth"] = async (point, month) => {
    const { rows, submitted } = readState()
    const org = point.organization.id
    const records: PointMonth["records"] = rows
      .filter(
        (row) => row.organization_id === org && row.date.startsWith(month)
      )
      .map((row, index) => ({
        id: String(index),
        record_date: row.date,
        waste_name_ru:
          point.wastes.find(({ id }) => id === row.waste_id)?.name_ru ??
          row.waste_id,
        amount: row.amount,
        unit: row.unit,
      }))
    return {
      status: submitted.includes(`${org}:${month}`) ? "submitted" : "draft",
      comment: null,
      records,
    }
  }
  return {
    organizations: orgList,
    async profiles() {
      const base = await source.submissions("2026-11")
      return [
        ...base.map(({ organizationId, responsible, email }) => ({
          id: organizationId,
          email,
          full_name_ru: responsible,
          role: "responsible",
          organization_id: organizationId,
          is_active: true,
        })),
        ...readState().profiles,
      ]
    },
    async createOrganization(_token, input) {
      if ((await orgList()).some(({ code }) => code === input.code))
        throw new Error("Организация с таким кодом уже существует.")
      const id = `new-${input.code}`
      const { code, name_ru, org_type_ru, building_ru } = input
      readState().organizations.push({
        id,
        code,
        name_ru,
        org_type_ru,
        building_ru,
        qr_code_token: `demo-${id}`,
        is_active: true,
      })
      persist()
    },
    async createResponsible(_token, input) {
      const email = input.email.toLowerCase()
      if (
        (await this.profiles()).some(
          (profile) => profile.email.toLowerCase() === email
        )
      )
        throw new Error("Пользователь с такой почтой уже существует.")
      readState().profiles.push({
        id: `demo-user-${email}`,
        email,
        full_name_ru: input.full_name_ru,
        role: "responsible",
        organization_id: input.organization_id,
        is_active: true,
      })
      persist()
    },
    importCatalog,
    async importRows(_token, batch) {
      const { rows, submitted } = readState()
      if (
        batch.some((item) =>
          submitted.includes(`${item.organization_id}:${item.date.slice(0, 7)}`)
        )
      )
        throw new Error("Один из отчётов уже отправлен на проверку.")
      let inserted = 0
      for (const item of batch) {
        if (
          rows.some(
            (row) =>
              row.organization_id === item.organization_id &&
              row.date === item.date &&
              row.waste_id === item.waste_id &&
              row.disposal_id === item.disposal_id &&
              row.amount === item.amount
          )
        )
          continue
        rows.push(item)
        inserted++
      }
      persist()
      return inserted
    },
    async point(token) {
      const catalog = await importCatalog()
      const organization = catalog.organizations.find(
        (item) => item.qr_code_token === token
      )
      if (!organization)
        throw new Error("Демо-точка не найдена в этом браузере.")
      return {
        organization,
        wastes: catalog.wastes,
        disposals: catalog.disposals,
      }
    },
    async pointLogin(point, email, password) {
      if (
        password !== "atu2026" ||
        !(await this.profiles()).some(
          (profile) =>
            profile.email === email &&
            profile.organization_id === point.organization.id
        )
      )
        throw new Error(
          "Введите почту ответственного за эту демо-точку и пароль atu2026."
        )
      return "demo-point"
    },
    pointMonth,
    async pointAdd(_token, point, input) {
      const { rows, submitted } = readState()
      if (
        submitted.includes(`${point.organization.id}:${input.date.slice(0, 7)}`)
      )
        throw new Error("Отчёт уже отправлен.")
      const waste = point.wastes.find(({ id }) => id === input.waste_id)
      if (!waste) throw new Error("Вид отходов не найден.")
      rows.push({
        ...input,
        line: rows.length + 1,
        unit: waste.unit,
        organization_id: point.organization.id,
      })
      persist()
    },
    async pointSubmit(_token, point, month) {
      if (!(await pointMonth(point, month)).records.length)
        throw new Error("Сначала добавьте запись за этот месяц.")
      readState().submitted.push(`${point.organization.id}:${month}`)
      persist()
    },
  }
}
