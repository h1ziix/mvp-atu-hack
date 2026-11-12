import { read, SSF, utils, writeFileXLSX } from "xlsx"
import type { ImportCatalog, ImportRow } from "@/operations/model"
import { today } from "@/operations/model"
import { dateRange } from "@/reporting/model"
import { reportTitle, unitLabel, type Summary } from "./model"

type Cell = string | number | null
const headings = [
  "Дата",
  "Организация",
  "Вид отходов",
  "Ед. изм.",
  "Количество",
  "Способ утилизации",
]
const reportColumns = [
  "Организация",
  "Вид отходов",
  "Ед. изм.",
  "Количество",
  "Способ утилизации",
  "Масса, кг",
  "Выбросы, кг CO₂-экв.",
  "Экономия, кг CO₂-экв.",
]

function sheet(rows: Cell[][], widths: number[]) {
  const ws = utils.aoa_to_sheet(rows)
  ws["!cols"] = widths.map((wch) => ({ wch }))
  for (const cell of Object.values(ws))
    if (cell?.t === "n") cell.z = "#,##0.###"
  return ws
}

export function downloadReport(
  summary: Summary,
  period: string,
  date: string,
  fileLabel: string
) {
  const workbook = utils.book_new()
  const rows: Cell[][] = [
    [`${reportTitle} за ${period}`],
    ["Дата формирования", date],
    [],
    reportColumns,
  ]
  for (const group of summary.organizations) {
    rows.push(
      ...group.items.map((item) => [
        group.name,
        item.waste,
        item.unit,
        item.quantity,
        item.disposal,
        item.weight,
        item.actual,
        item.saved,
      ])
    )
    rows.push([
      group.name,
      "Итого по организации",
      null,
      null,
      null,
      group.total.weight,
      group.total.actual,
      group.total.saved,
    ])
    if (group.taraBones !== null)
      rows.push([
        group.name,
        "Итого: тара + кости",
        null,
        null,
        null,
        group.taraBones,
      ])
  }
  rows.push([
    "Итого по АТУ",
    null,
    null,
    null,
    null,
    summary.total.weight,
    summary.total.actual,
    summary.total.saved,
  ])
  const summarySheet = sheet(rows, [42, 44, 11, 15, 42, 15, 25, 25])
  summarySheet["!merges"] = [utils.decode_range("A1:H1")]
  utils.book_append_sheet(
    workbook,
    summarySheet,
    "Сводный отчёт по организациям"
  )

  const details = summary.records.map((record) => [
    record.date,
    record.organization,
    record.waste,
    unitLabel(record.unit),
    record.quantity,
    record.disposal,
    record.weight,
    record.co2,
    record.co2Saved,
  ])
  const detailsSheet = sheet(
    [
      [
        ...headings,
        "Масса, кг",
        "Выбросы, кг CO₂-экв.",
        "Экономия, кг CO₂-экв.",
      ],
      ...details,
    ],
    [14, 44, 44, 11, 15, 42, 15, 25, 25]
  )
  detailsSheet["!autofilter"] = { ref: `A1:I${details.length + 1}` }
  utils.book_append_sheet(workbook, detailsSheet, "Детальный реестр")
  utils.book_append_sheet(
    workbook,
    sheet(
      [
        [
          "Организация",
          "Масса, кг",
          "Выбросы, кг CO₂-экв.",
          "Экономия, кг CO₂-экв.",
          "Сценарий ТБО, кг CO₂-экв.",
        ],
        ...summary.organizations.map(({ name, total }) => [
          name,
          total.weight,
          total.actual,
          total.saved,
          total.landfill,
        ]),
        [
          "Итого по АТУ",
          summary.total.weight,
          summary.total.actual,
          summary.total.saved,
          summary.total.landfill,
        ],
      ],
      [44, 15, 25, 25, 29]
    ),
    "Экологический расчёт CO₂"
  )
  writeFileXLSX(workbook, `АТУ-отчёт-${fileLabel}.xlsx`, { compression: true })
}

export function downloadTemplate(catalog: ImportCatalog) {
  const workbook = utils.book_new()
  utils.book_append_sheet(
    workbook,
    sheet([headings], [18, 42, 44, 11, 15, 42]),
    "Импорт"
  )
  utils.book_append_sheet(
    workbook,
    sheet(
      [
        ["Раздел", "Код", "Название", "Ед. изм."],
        ...catalog.organizations.map((item) => [
          "Организация",
          item.code,
          item.name_ru,
        ]),
        ...catalog.wastes.map((item) => [
          "Вид отходов",
          item.code,
          item.name_ru,
          unitLabel(item.unit),
        ]),
        ...catalog.disposals.map((item) => [
          "Способ утилизации",
          item.code,
          item.name_ru,
        ]),
      ],
      [23, 26, 58, 12]
    ),
    "Справочники"
  )
  writeFileXLSX(workbook, "АТУ-шаблон-импорта.xlsx", { compression: true })
}

const aliases = {
  date: [
    "дата",
    "дата взвешивания",
    "дата лабораторного занятия",
    "дата учёта",
  ],
  organization: [
    "организация",
    "подразделение",
    "наименование организации",
    "код организации",
  ],
  waste: [
    "вид отходов",
    "вид отхода",
    "наименование отходов",
    "наименование отхода",
    "код отхода",
    "отходы",
  ],
  unit: [
    "ед. изм.",
    "ед. изм",
    "единица измерения",
    "ед. измерения",
    "единица",
  ],
  amount: [
    "количество",
    "кол-во",
    "масса",
    "вес",
    "объём",
    "количество отходов",
    "количество, кг",
    "масса, кг",
  ],
  disposal: [
    "способ утилизации",
    "метод утилизации",
    "утилизация",
    "код способа утилизации",
  ],
}

const key = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ")
const lookup = <T extends { id: string; code: string | null; name_ru: string }>(
  items: T[],
  value: unknown
) => {
  const label = key(value)
  if (!label) return undefined
  const matches = items.filter(
    (item) => key(item.code) === label || key(item.name_ru) === label
  )
  return matches.length === 1 ? matches[0] : undefined
}

function dateCell(value: unknown, date1904: boolean): string {
  if (typeof value === "number") {
    const d = SSF.parse_date_code(value, { date1904 })
    return d
      ? [d.y, d.m, d.d].map((part) => String(part).padStart(2, "0")).join("-")
      : ""
  }
  const valueText = String(value ?? "").trim()
  const local = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(valueText)
  return local
    ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`
    : valueText
}

export type ImportPreview = {
  rows: ImportRow[]
  errors: string[]
  fileName: string
  sheetName: string
}

export async function parseImport(
  file: File,
  catalog: ImportCatalog,
  defaultOrg: string
): Promise<ImportPreview> {
  if (!/\.xlsx$/i.test(file.name) || file.size > 10 * 1024 * 1024)
    throw new Error("Выберите файл .xlsx размером до 10 МБ.")
  const book = read(await file.arrayBuffer(), { type: "array" })
  const names = ["Импорт", "Детальный реестр", ...book.SheetNames].filter(
    (name) => book.Sheets[name]
  )
  for (const name of new Set(names)) {
    const table = utils.sheet_to_json<unknown[]>(book.Sheets[name], {
      header: 1,
      defval: null,
      blankrows: true,
      range: 0,
    })
    const findColumns = (row: unknown[]) =>
      Object.fromEntries(
        Object.entries(aliases).map(([column, labels]) => [
          column,
          row.findIndex((value) =>
            labels.some((label) => key(label) === key(value))
          ),
        ])
      ) as Record<keyof typeof aliases, number>
    const header = table.findIndex((row) => {
      const cols = findColumns(row)
      return (
        cols.date >= 0 &&
        cols.waste >= 0 &&
        cols.amount >= 0 &&
        cols.disposal >= 0
      )
    })
    if (header < 0) continue
    const cols = findColumns(table[header])
    const lines = table
      .slice(header + 1)
      .map((cells, i) => ({ cells, line: i + header + 2 }))
      .filter(({ cells }) => cells.some((value) => key(value)))
    if (!lines.length) throw new Error("На листе нет строк для импорта.")
    if (lines.length > 2000)
      throw new Error("Разделите файл на части по 2000 строк.")
    const rows: ImportRow[] = []
    const errors: string[] = []
    const maxDate = today()
    for (const { cells, line } of lines) {
      const date = dateCell(
        cells[cols.date],
        Boolean(book.Workbook?.WBProps?.date1904)
      )
      const org = key(cells[cols.organization])
        ? lookup(catalog.organizations, cells[cols.organization])
        : catalog.organizations.find((item) => item.id === defaultOrg)
      const waste = lookup(catalog.wastes, cells[cols.waste])
      const method = lookup(catalog.disposals, cells[cols.disposal])
      const amount = Number(
        String(cells[cols.amount] ?? "")
          .trim()
          .replace(/\s/g, "")
          .replace(",", ".")
      )
      const unit = key(cells[cols.unit])
      const issues: string[] = []
      if (!dateRange(date, date) || date < "2000-01-01" || date > maxDate)
        issues.push("неверная дата")
      if (!org) issues.push("организация не найдена")
      if (!waste) issues.push("вид отходов не найден")
      if (!method) issues.push("способ утилизации не найден")
      if (
        !Number.isFinite(amount) ||
        amount < 0.01 ||
        amount > 2000 ||
        Math.abs(Math.round(amount * 100) / 100 - amount) > 1e-9
      )
        issues.push(
          "количество должно быть от 0,01 до 2000 с точностью до сотых"
        )
      if (
        waste &&
        unit &&
        unit !== waste.unit &&
        unit !== unitLabel(waste.unit)
      )
        issues.push("единица отличается от справочника")
      if (
        org &&
        waste &&
        !catalog.assignments.some(
          (item) =>
            item.organization_id === org.id && item.waste_type_id === waste.id
        )
      )
        issues.push("этот вид отходов не назначен организации")
      if (issues.length || !org || !waste || !method)
        errors.push(`Строка ${line}: ${issues.join("; ")}.`)
      else
        rows.push({
          line,
          date,
          organization_id: org.id,
          waste_id: waste.id,
          disposal_id: method.id,
          amount,
          unit: waste.unit,
        })
    }
    return { rows, errors, fileName: file.name, sheetName: name }
  }
  throw new Error(
    "Не найден лист с колонками «Дата», «Вид отходов», «Количество» и «Способ утилизации». Используйте шаблон АТУ."
  )
}
