import { useCallback, useState } from "react"
import { Upload } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Operations } from "@/operations/model"
import { useReportingQuery } from "@/reporting/useReportingQuery"
import { dateLabel, numberLabel } from "@/review/model"
import type { ImportPreview } from "./excel"
import { unitLabel } from "./model"

export function ImportWorkbook({
  operations,
  token,
}: {
  operations: Operations
  token?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>Импорт старых таблиц</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {open ? (
          <ImportForm operations={operations} token={token} />
        ) : (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            <Upload aria-hidden="true" /> Импортировать Excel
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function ImportForm({
  operations,
  token,
}: {
  operations: Operations
  token?: string
}) {
  const load = useCallback(() => operations.importCatalog(), [operations])
  const { result, reload } = useReportingQuery(load)
  const catalog = result.state === "ready" ? result.data : null
  const [file, setFile] = useState<File | null>(null)
  const [org, setOrg] = useState("")
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await action()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось обработать файл."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Используйте названия или коды из справочника. Если в таблице нет
        организации, выберите её здесь. Записи сохранятся в черновик или
        возвращённый отчёт за соответствующий месяц.
      </p>
      {!token && (
        <Alert role="note">
          <AlertDescription>
            Для сохранения записей примените миграцию W4 и войдите повторно.
          </AlertDescription>
        </Alert>
      )}
      {result.state === "loading" && (
        <p role="status">Загрузка справочников…</p>
      )}
      {result.state === "error" && (
        <div className="space-y-2">
          <Alert variant="destructive">
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
          <Button type="button" variant="outline" onClick={reload}>
            Повторить
          </Button>
        </div>
      )}
      {catalog && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="import-file">Файл Excel</FieldLabel>
              <Input
                id="import-file"
                type="file"
                accept=".xlsx"
                disabled={busy}
                onChange={(event) => {
                  setFile(event.currentTarget.files?.[0] ?? null)
                  setPreview(null)
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="import-org">
                Организация для строк без названия
              </FieldLabel>
              <NativeSelect
                id="import-org"
                className="w-full"
                value={org}
                disabled={busy}
                onChange={(event) => {
                  setOrg(event.currentTarget.value)
                  setPreview(null)
                }}
              >
                <NativeSelectOption value="">Взять из файла</NativeSelectOption>
                {catalog.organizations.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.name_ru}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const { downloadTemplate } = await import("./excel")
                  downloadTemplate(catalog)
                })
              }
            >
              Скачать шаблон
            </Button>
            <Button
              type="button"
              disabled={busy || !file}
              onClick={() =>
                void run(async () => {
                  if (!file) return
                  setPreview(null)
                  const { parseImport } = await import("./excel")
                  setPreview(await parseImport(file, catalog, org))
                })
              }
            >
              Проверить файл
            </Button>
          </div>
          {preview && (
            <div className="space-y-3 border-t pt-3">
              <p className="font-medium">
                {preview.fileName} · {preview.sheetName} · строк готово:{" "}
                {preview.rows.length}
              </p>
              {preview.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <p>Исправьте ошибки в файле и проверьте его снова.</p>
                    <ul className="max-h-40 overflow-y-auto">
                      {preview.errors.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {preview.rows.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <Table aria-label="Предпросмотр импорта">
                    <TableHeader>
                      <TableRow>
                        {[
                          "Строка",
                          "Дата",
                          "Организация",
                          "Отходы",
                          "Количество",
                          "Утилизация",
                        ].map((name) => (
                          <TableHead key={name}>{name}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.slice(0, 10).map((item) => (
                        <TableRow key={item.line}>
                          <TableCell>{item.line}</TableCell>
                          <TableCell>{dateLabel(item.date)}</TableCell>
                          <TableCell>
                            {
                              catalog.organizations.find(
                                ({ id }) => id === item.organization_id
                              )?.name_ru
                            }
                          </TableCell>
                          <TableCell>
                            {
                              catalog.wastes.find(
                                ({ id }) => id === item.waste_id
                              )?.name_ru
                            }
                          </TableCell>
                          <TableCell>
                            {numberLabel(
                              item.amount,
                              ` ${unitLabel(item.unit)}`
                            )}
                          </TableCell>
                          <TableCell>
                            {
                              catalog.disposals.find(
                                ({ id }) => id === item.disposal_id
                              )?.name_ru
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {preview.rows.length > 10 && (
                <p className="text-muted-foreground">
                  Показаны первые 10 строк.
                </p>
              )}
              <Button
                type="button"
                disabled={
                  busy ||
                  !token ||
                  preview.errors.length > 0 ||
                  !preview.rows.length
                }
                onClick={() =>
                  void run(async () => {
                    if (!token) return
                    const saved = await operations.importRows(
                      token,
                      preview.rows
                    )
                    const skipped = preview.rows.length - saved
                    setPreview(null)
                    setMessage(
                      `Сохранено строк: ${saved}. Совпадающих строк пропущено: ${skipped}.`
                    )
                  })
                }
              >
                Сохранить в черновики
              </Button>
            </div>
          )}
        </>
      )}
      {busy && <p role="status">Обработка файла…</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <p role="status" className="text-green-700">
          {message}
        </p>
      )}
    </div>
  )
}
