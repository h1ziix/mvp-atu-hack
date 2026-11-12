import { useCallback, useState, type FormEvent } from "react"
import { ChevronLeft, ChevronRight, CircleAlert } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { dateLabel, numberLabel, total } from "@/review/model"
import {
  dateRange,
  monthRange,
  quarterRange,
  type CatalogOption,
  type RegistryFilters,
  type RegistryRecord,
  type ReportingSource,
} from "./model"
import { useReportingQuery } from "./useReportingQuery"

type PeriodMode = "month" | "quarter" | "range"

export function Registry({
  source,
  initialPeriod,
}: {
  source: ReportingSource
  initialPeriod: string
}) {
  const initialRange = monthRange(initialPeriod)!
  const [mode, setMode] = useState<PeriodMode>("month")
  const [filters, setFilters] = useState<RegistryFilters>({
    ...initialRange,
    organizationId: "",
    wasteId: "",
    disposalId: "",
  })
  const [periodError, setPeriodError] = useState("")
  const loadCatalog = useCallback(() => source.catalog(), [source])
  const loadRecords = useCallback(
    () => source.registry(filters),
    [source, filters]
  )
  const catalog = useReportingQuery(loadCatalog)
  const records = useReportingQuery(loadRecords)
  const options =
    catalog.result.state === "ready" ? catalog.result.data : undefined

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? "")
    const range =
      mode === "month"
        ? monthRange(value("month"))
        : mode === "quarter"
          ? quarterRange(value("year"), value("quarter"))
          : dateRange(value("from"), value("to"))
    if (!range) {
      setPeriodError(
        "Проверьте период. Дата начала должна быть не позже даты окончания."
      )
      return
    }
    setPeriodError("")
    setFilters({
      ...range,
      organizationId: value("organization"),
      wasteId: value("waste"),
      disposalId: value("disposal"),
    })
  }

  return (
    <section aria-labelledby="registry-title" className="min-w-0 space-y-5">
      <h1
        id="registry-title"
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        Единый реестр
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Фильтры</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={apply} className="space-y-4">
            <FieldGroup className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="period-mode">Период</FieldLabel>
                <NativeSelect
                  id="period-mode"
                  className="w-full"
                  value={mode}
                  onChange={(event) => {
                    setMode(event.currentTarget.value as PeriodMode)
                    setPeriodError("")
                  }}
                >
                  <NativeSelectOption value="month">Месяц</NativeSelectOption>
                  <NativeSelectOption value="quarter">
                    Квартал
                  </NativeSelectOption>
                  <NativeSelectOption value="range">
                    Диапазон дат
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              {mode === "month" && (
                <Field>
                  <FieldLabel htmlFor="registry-month">Месяц</FieldLabel>
                  <Input
                    id="registry-month"
                    name="month"
                    type="month"
                    defaultValue={filters.from.slice(0, 7)}
                    required
                  />
                </Field>
              )}
              {mode === "quarter" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="registry-year">Год</FieldLabel>
                    <Input
                      id="registry-year"
                      name="year"
                      type="number"
                      min={1000}
                      max={9999}
                      defaultValue={filters.from.slice(0, 4)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="registry-quarter">Квартал</FieldLabel>
                    <NativeSelect
                      id="registry-quarter"
                      name="quarter"
                      className="w-full"
                      defaultValue={String(
                        Math.ceil(Number(filters.from.slice(5, 7)) / 3)
                      )}
                    >
                      {[1, 2, 3, 4].map((quarter) => (
                        <NativeSelectOption key={quarter} value={quarter}>
                          {quarter} квартал
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </>
              )}
              {mode === "range" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="registry-from">Дата с</FieldLabel>
                    <Input
                      id="registry-from"
                      name="from"
                      type="date"
                      defaultValue={filters.from}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="registry-to">Дата по</FieldLabel>
                    <Input
                      id="registry-to"
                      name="to"
                      type="date"
                      defaultValue={filters.to}
                      required
                    />
                  </Field>
                </>
              )}
            </FieldGroup>
            {periodError && <FieldError>{periodError}</FieldError>}
            <FieldGroup className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CatalogSelect
                name="organization"
                label="Организация"
                options={options?.organizations}
              />
              <CatalogSelect
                name="waste"
                label="Вид отходов"
                options={options?.wastes}
              />
              <CatalogSelect
                name="disposal"
                label="Способ утилизации"
                options={options?.disposals}
              />
              <Button type="submit" className="justify-self-start">
                Применить фильтры
              </Button>
            </FieldGroup>
          </form>
          {catalog.result.state === "error" && (
            <LoadError
              message={catalog.result.message}
              retry={catalog.reload}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Принятые записи</h2>
          </CardTitle>
          <p className="text-muted-foreground">
            {dateLabel(filters.from)} — {dateLabel(filters.to)}
          </p>
        </CardHeader>
        <CardContent>
          {records.result.state === "loading" && (
            <div role="status">
              <span className="sr-only">Загрузка реестра…</span>
              <Skeleton className="h-40" />
            </div>
          )}
          {records.result.state === "error" && (
            <LoadError
              message={records.result.message}
              retry={records.reload}
            />
          )}
          {records.result.state === "ready" &&
            (records.result.data.length ? (
              <RegistryTable records={records.result.data} />
            ) : (
              <p className="text-sm text-muted-foreground">
                По выбранным фильтрам нет принятых записей.
              </p>
            ))}
        </CardContent>
      </Card>
    </section>
  )
}

function CatalogSelect({
  name,
  label,
  options,
}: {
  name: string
  label: string
  options?: CatalogOption[]
}) {
  return (
    <Field>
      <FieldLabel htmlFor={`registry-${name}`}>{label}</FieldLabel>
      <NativeSelect
        id={`registry-${name}`}
        name={name}
        className="w-full"
        disabled={!options}
      >
        <NativeSelectOption value="">Все</NativeSelectOption>
        {options?.map((option) => (
          <NativeSelectOption key={option.id} value={option.id}>
            {option.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  )
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="space-y-2 py-2">
      <Alert variant="destructive">
        <CircleAlert aria-hidden="true" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button type="button" variant="outline" onClick={retry}>
        Повторить
      </Button>
    </div>
  )
}

const pageSize = 25
const tonsFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 5 })

function RegistryTable({ records }: { records: RegistryRecord[] }) {
  const [page, setPage] = useState(1)
  const pageCount = Math.ceil(records.length / pageSize)
  const start = (page - 1) * pageSize
  const visible = records.slice(start, start + pageSize)
  const mass = total(records, "weight")

  return (
    <div className="space-y-3">
      <div
        className="overflow-x-auto rounded-md border focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&_[data-slot=table-container]]:overflow-visible"
        tabIndex={0}
        role="region"
        aria-label="Таблица единого реестра"
      >
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead scope="col">Дата</TableHead>
              <TableHead scope="col">Организация</TableHead>
              <TableHead scope="col">Вид отходов</TableHead>
              <TableHead scope="col">Способ утилизации</TableHead>
              <TableHead scope="col" className="text-right">
                Масса
              </TableHead>
              <TableHead scope="col" className="text-right">
                Выбросы CO₂-экв.
              </TableHead>
              <TableHead scope="col" className="text-right">
                Экономия CO₂-экв.
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{dateLabel(record.date)}</TableCell>
                <TableCell className="min-w-32 whitespace-normal">
                  {record.organization}
                </TableCell>
                <TableCell className="min-w-28 whitespace-normal">
                  {record.waste}
                </TableCell>
                <TableCell className="min-w-28 whitespace-normal">
                  {record.disposal}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberLabel(record.weight, " кг")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberLabel(record.co2, " кг")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberLabel(record.co2Saved, " кг")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableHead scope="row" colSpan={4}>
                Итого по фильтрам · записей: {records.length}
              </TableHead>
              <TableCell className="text-right tabular-nums">
                {numberLabel(mass, " кг")}
                {mass !== null && (
                  <span className="block text-muted-foreground">
                    {tonsFormat.format(mass / 1000)} т
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {numberLabel(total(records, "co2"), " кг")}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {numberLabel(total(records, "co2Saved"), " кг")}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      {pageCount > 1 && (
        <nav
          aria-label="Страницы реестра"
          className="flex items-center justify-end gap-2"
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Предыдущая страница"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span aria-live="polite">
            {page} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Следующая страница"
            disabled={page === pageCount}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  )
}
