import { useCallback, useState, type FormEvent } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { monthRange, currentMonth } from "@/reporting/model"
import { useReportingQuery } from "@/reporting/useReportingQuery"
import { dateLabel, numberLabel, statusLabel } from "@/review/model"
import { unitLabel } from "@/reports/model"
import { today, type Operations, type Point } from "./model"

export default function PointForm({
  operations,
  pointToken,
  onExit,
}: {
  operations: Operations | null
  pointToken: string
  onExit: (token: string) => void
}) {
  const load = useCallback(() => {
    if (!operations)
      return Promise.reject(
        new Error("Подключение к кабинету АТУ не настроено.")
      )
    if (!pointToken || pointToken.length > 150)
      return Promise.reject(new Error("Проверьте ссылку на точку."))
    return operations.point(pointToken)
  }, [operations, pointToken])
  const { result, reload } = useReportingQuery(load)
  const [token, setToken] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const point = result.state === "ready" ? result.data : null

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!operations || !point || busy) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError("")
    try {
      setToken(
        await operations.pointLogin(
          point,
          String(form.get("email")).trim(),
          String(form.get("password"))
        )
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-6">
      <div className="mx-auto max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1 className="text-xl font-semibold">
                {point?.organization.name_ru ?? "Форма точки АТУ"}
              </h1>
            </CardTitle>
            {point && (
              <CardDescription>
                {point.organization.building_ru}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {result.state === "loading" && <p role="status">Загрузка точки…</p>}
            {result.state === "error" && (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
                <Button type="button" variant="outline" onClick={reload}>
                  Повторить
                </Button>
              </div>
            )}
            {point &&
              (token ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onExit(token)
                    setToken("")
                  }}
                >
                  Выйти
                </Button>
              ) : (
                <form className="space-y-3" onSubmit={login}>
                  <Field>
                    <FieldLabel htmlFor="point-email">Рабочая почта</FieldLabel>
                    <Input
                      id="point-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="point-password">Пароль</FieldLabel>
                    <Input
                      id="point-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </Field>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" disabled={busy}>
                    {busy ? "Входим…" : "Войти в форму"}
                  </Button>
                </form>
              ))}
          </CardContent>
        </Card>
        {operations && point && token && (
          <PointEntries operations={operations} point={point} token={token} />
        )}
      </div>
    </main>
  )
}

function PointEntries({
  operations,
  point,
  token,
}: {
  operations: Operations
  point: Point
  token: string
}) {
  const [month, setMonth] = useState(currentMonth)
  const [wasteId, setWasteId] = useState(point.wastes[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const load = useCallback(
    () => operations.pointMonth(point, month),
    [operations, point, month]
  )
  const { result, reload } = useReportingQuery(load)
  const data = result.state === "ready" ? result.data : null
  const canEdit = data?.status === "draft" || data?.status === "returned"
  const waste = point.wastes.find(({ id }) => id === wasteId)
  const range = monthRange(month)!
  const lastDate = range.to < today() ? range.to : today()

  async function run(action: () => Promise<void>, notice: string) {
    if (busy) return
    setBusy(true)
    setMessage("")
    setError("")
    try {
      await action()
      setMessage(notice)
      reload()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось сохранить."
      )
      reload()
    } finally {
      setBusy(false)
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    void run(async () => {
      await operations.pointAdd(token, point, {
        date: String(values.get("date")),
        waste_id: wasteId,
        disposal_id: String(values.get("disposal")),
        amount: Number(values.get("amount")),
      })
      const amount = form.elements.namedItem("amount")
      if (amount instanceof HTMLInputElement) amount.value = ""
    }, "Запись добавлена.")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Учёт отходов</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field className="w-auto">
            <FieldLabel htmlFor="point-month">Отчётный месяц</FieldLabel>
            <Input
              id="point-month"
              type="month"
              value={month}
              max={currentMonth()}
              disabled={busy}
              onChange={(event) => {
                if (monthRange(event.currentTarget.value)) {
                  setMonth(event.currentTarget.value)
                  setMessage("")
                  setError("")
                }
              }}
            />
          </Field>
          {data && <Badge variant="outline">{statusLabel(data.status)}</Badge>}
        </div>
        {result.state === "loading" && <p role="status">Загрузка записей…</p>}
        {result.state === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{result.message}</AlertDescription>
            <Button type="button" variant="outline" onClick={reload}>
              Повторить
            </Button>
          </Alert>
        )}
        {data?.comment && (
          <Alert role="note">
            <AlertDescription>
              Комментарий проверяющего: {data.comment}
            </AlertDescription>
          </Alert>
        )}
        {canEdit &&
          waste &&
          point.disposals.length > 0 &&
          lastDate >= range.from && (
            <form
              key={month}
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={add}
            >
              <Field>
                <FieldLabel htmlFor="point-date">Дата взвешивания</FieldLabel>
                <Input
                  id="point-date"
                  name="date"
                  type="date"
                  min={range.from}
                  max={lastDate}
                  defaultValue={lastDate}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="point-waste">Вид отходов</FieldLabel>
                <NativeSelect
                  id="point-waste"
                  className="w-full"
                  value={wasteId}
                  onChange={(event) => setWasteId(event.currentTarget.value)}
                >
                  {point.wastes.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.name_ru}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="point-amount">
                  Количество, {unitLabel(waste.unit)}
                </FieldLabel>
                <Input
                  id="point-amount"
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="2000"
                  step="0.01"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="point-disposal">
                  Способ утилизации
                </FieldLabel>
                <NativeSelect
                  id="point-disposal"
                  name="disposal"
                  className="w-full"
                  defaultValue=""
                  required
                >
                  <NativeSelectOption value="" disabled>
                    Выберите способ
                  </NativeSelectOption>
                  {point.disposals.map((item) => (
                    <NativeSelectOption key={item.id} value={item.id}>
                      {item.name_ru}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Button
                type="submit"
                className="justify-self-start"
                disabled={busy}
              >
                Добавить запись
              </Button>
            </form>
          )}
        {data && !data.records.length && (
          <p className="text-muted-foreground">
            За этот месяц записей пока нет.
          </p>
        )}
        {!!data?.records.length && (
          <ul className="divide-y rounded-md border">
            {data.records.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span>
                  {item.waste_name_ru}{" "}
                  <span className="text-muted-foreground">
                    · {dateLabel(item.record_date)}
                  </span>
                </span>
                <span className="font-medium">
                  {numberLabel(Number(item.amount), ` ${unitLabel(item.unit)}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canEdit && !!data?.records.length && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(
                () => operations.pointSubmit(token, point, month),
                "Отчёт отправлен на проверку."
              )
            }
          >
            Отправить на проверку
          </Button>
        )}
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
      </CardContent>
    </Card>
  )
}
