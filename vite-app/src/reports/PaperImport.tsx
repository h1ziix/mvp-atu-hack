import { useState } from "react"
import { ScanLine } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { scanPaperForm, type PaperRow, type PaperScan } from "@/lib/ai"
import type { ImportCatalog, Operations } from "@/operations/model"

const fields = [
  ["date", "Дата", "ГГГГ-ММ-ДД"],
  ["waste", "Вид отходов", ""],
  ["amount", "Количество", ""],
  ["unit", "Единица", "кг / л"],
  ["disposal", "Утилизация", ""],
] as const

export function PaperImport({
  catalog,
  operations,
  token,
}: {
  catalog: ImportCatalog
  operations: Operations
  token: string
}) {
  const [org, setOrg] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [scan, setScan] = useState<PaperScan | null>(null)
  const [busy, setBusy] = useState("")
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState("")

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label)
    setErrors([])
    setMessage("")
    try {
      await action()
    } catch (reason) {
      setErrors([
        reason instanceof Error
          ? reason.message
          : "Не удалось обработать бланк.",
      ])
    } finally {
      setBusy("")
    }
  }

  function edit(index: number, key: keyof PaperRow, value: string) {
    setScan(
      (current) =>
        current && {
          ...current,
          rows: current.rows.map((row, i) =>
            i === index ? { ...row, [key]: value } : row
          ),
        }
    )
  }

  const allowed = new Set(
    catalog.assignments
      .filter(({ organization_id }) => organization_id === org)
      .map(({ waste_type_id }) => waste_type_id)
  )

  return (
    <section
      className="space-y-3 border-t pt-4"
      aria-labelledby="paper-import-title"
    >
      <h3
        id="paper-import-title"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <ScanLine className="size-4 text-primary" aria-hidden="true" />{" "}
        Распознать бумажный бланк
      </h3>
      <p className="text-muted-foreground">
        Выберите организацию и фото одной страницы. Можно распознать до 20 строк
        за раз.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="paper-org">Организация</FieldLabel>
          <NativeSelect
            id="paper-org"
            className="w-full"
            value={org}
            disabled={!!busy}
            onChange={(event) => {
              setOrg(event.currentTarget.value)
              setScan(null)
              setErrors([])
            }}
          >
            <NativeSelectOption value="">
              Выберите организацию
            </NativeSelectOption>
            {catalog.organizations.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name_ru}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="paper-image">Фото бланка</FieldLabel>
          <Input
            id="paper-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!!busy}
            onChange={(event) => {
              setFile(event.currentTarget.files?.[0] ?? null)
              setScan(null)
              setErrors([])
            }}
          />
        </Field>
      </div>
      <Button
        type="button"
        disabled={!!busy || !file || !org}
        onClick={() => {
          if (!file || !org) return
          void run("Распознаём бланк…", async () => {
            setScan(null)
            setScan(await scanPaperForm(token, org, file))
          })
        }}
      >
        Распознать фото
      </Button>
      {scan && (
        <div className="space-y-3">
          <p>Сверьте каждую строку с бланком и заполните пустые поля.</p>
          {scan.incomplete && (
            <p className="text-amber-700 dark:text-amber-300">
              Часть бланка могла не распознаться. Сверьте количество строк.
            </p>
          )}
          <datalist id="paper-wastes">
            {catalog.wastes
              .filter(({ id }) => allowed.has(id))
              .map((w) => (
                <option key={w.id} value={w.name_ru} />
              ))}
          </datalist>
          <datalist id="paper-methods">
            {catalog.disposals.map((item) => (
              <option key={item.id} value={item.name_ru} />
            ))}
          </datalist>
          <div className="space-y-2">
            {scan.rows.map((row, index) => (
              <fieldset
                key={index}
                className="grid gap-2 rounded-lg border p-2 sm:grid-cols-2 lg:grid-cols-5"
              >
                <legend className="px-1">Строка {index + 1}</legend>
                {fields.map(([key, label, placeholder]) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`paper-${index}-${key}`}>
                      {label}
                    </FieldLabel>
                    <Input
                      id={`paper-${index}-${key}`}
                      list={
                        key === "waste"
                          ? "paper-wastes"
                          : key === "disposal"
                            ? "paper-methods"
                            : undefined
                      }
                      value={row[key]}
                      placeholder={placeholder}
                      disabled={!!busy}
                      onChange={(event) =>
                        edit(index, key, event.currentTarget.value)
                      }
                    />
                  </Field>
                ))}
              </fieldset>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!!busy}
            onClick={() =>
              void run("Проверяем и сохраняем…", async () => {
                const { validatePaperRows } = await import("./excel")
                const preview = validatePaperRows(scan.rows, catalog, org)
                if (preview.errors.length) {
                  setErrors(preview.errors)
                  return
                }
                const saved = await operations.importRows(token, preview.rows)
                setScan(null)
                setMessage(
                  `Сохранено в черновики: ${saved}. Совпадающих строк пропущено: ${preview.rows.length - saved}.`
                )
              })
            }
          >
            Сохранить строки в черновики
          </Button>
        </div>
      )}
      {busy && <p role="status">{busy}</p>}
      {message && <p role="status">{message}</p>}
      {!!errors.length && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="space-y-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}
