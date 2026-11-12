import { useCallback, useState, type FormEvent } from "react"
import { Plus, QrCode } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useReportingQuery } from "@/reporting/useReportingQuery"
import { roleLabel, type Operations, type Organization } from "./model"

type Editor = "organization" | "profile"

export default function Admin({
  operations,
  token,
}: {
  operations: Operations
  token?: string
}) {
  const load = useCallback(async () => {
    const [organizations, profiles] = await Promise.all([
      operations.organizations(),
      operations.profiles(),
    ])
    return { organizations, profiles }
  }, [operations])
  const { result, reload } = useReportingQuery(load)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [tab, setTab] = useState("orgs")
  const [qr, setQr] = useState<Organization[] | null>(null)
  const [message, setMessage] = useState("")
  const data = result.state === "ready" ? result.data : null
  const active = data?.organizations.filter(({ is_active }) => is_active) ?? []
  const orgNames = new Map(
    data?.organizations.map(({ id, name_ru }) => [id, name_ru])
  )

  return (
    <section aria-labelledby="admin-title" className="min-w-0 space-y-5">
      <h1
        id="admin-title"
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        Администрирование
      </h1>
      {!token && (
        <Alert role="note">
          <AlertDescription>
            Чтобы добавлять организации и пользователей, примените миграцию W4 и
            войдите повторно.
          </AlertDescription>
        </Alert>
      )}
      {message && (
        <p role="status" className="text-green-700">
          {message}
        </p>
      )}
      {result.state === "loading" && (
        <p role="status">Загрузка организаций и пользователей…</p>
      )}
      {result.state === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{result.message}</AlertDescription>
          <Button type="button" variant="outline" onClick={reload}>
            Повторить
          </Button>
        </Alert>
      )}
      {data && (
        <Tabs
          value={tab}
          onValueChange={(value) =>
            setTab(value === "profiles" ? "profiles" : "orgs")
          }
        >
          <TabsList aria-label="Управление справочниками">
            <TabsTrigger value="orgs">Организации</TabsTrigger>
            <TabsTrigger value="profiles">Пользователи</TabsTrigger>
          </TabsList>
          <TabsContent value="orgs">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Организации АТУ</h2>
                </CardTitle>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    disabled={!token || !active.length}
                    onClick={() => setEditor("organization")}
                  >
                    <Plus aria-hidden="true" /> Подключить новую организацию
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!active.length}
                    onClick={() => setQr(active)}
                  >
                    <QrCode aria-hidden="true" /> Все QR-коды
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table aria-label="Организации АТУ">
                    <TableHeader>
                      <TableRow>
                        {[
                          "Организация",
                          "Тип",
                          "Корпус / адрес",
                          "Ответственные",
                          "Статус",
                          "QR",
                        ].map((label) => (
                          <TableHead key={label}>{label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.organizations.map((org) => (
                        <TableRow key={org.id}>
                          <TableCell className="min-w-36 whitespace-normal">
                            <p className="font-medium">{org.name_ru}</p>
                            <p className="text-muted-foreground">{org.code}</p>
                          </TableCell>
                          <TableCell>{org.org_type_ru}</TableCell>
                          <TableCell className="min-w-36 whitespace-normal">
                            {org.building_ru}
                          </TableCell>
                          <TableCell className="min-w-32 whitespace-normal">
                            {data.profiles
                              .filter(
                                (profile) =>
                                  profile.organization_id === org.id &&
                                  profile.role === "responsible" &&
                                  profile.is_active
                              )
                              .map((profile) => profile.full_name_ru)
                              .join(", ") || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {org.is_active ? "Активна" : "Неактивна"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!org.is_active}
                              onClick={() => setQr([org])}
                              aria-label={`QR-код: ${org.name_ru}`}
                            >
                              QR-код
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="profiles">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Пользователи АТУ</h2>
                </CardTitle>
                <div className="pt-2">
                  <Button
                    type="button"
                    disabled={!token || !active.length}
                    onClick={() => setEditor("profile")}
                  >
                    <Plus aria-hidden="true" /> Добавить ответственного
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table aria-label="Пользователи АТУ">
                    <TableHeader>
                      <TableRow>
                        {[
                          "ФИО",
                          "Рабочая почта",
                          "Роль",
                          "Организация",
                          "Статус",
                        ].map((label) => (
                          <TableHead key={label}>{label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.profiles.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>{profile.full_name_ru}</TableCell>
                          <TableCell>{profile.email}</TableCell>
                          <TableCell>
                            {roleLabel[profile.role] ?? profile.role}
                          </TableCell>
                          <TableCell>
                            {profile.organization_id
                              ? (orgNames.get(profile.organization_id) ?? "—")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {profile.is_active ? "Активен" : "Неактивен"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {editor && token && (
        <EditDialog
          editor={editor}
          operations={operations}
          token={token}
          organizations={active}
          onClose={() => setEditor(null)}
          onSaved={(message) => {
            setEditor(null)
            setMessage(message)
            reload()
          }}
        />
      )}
      {qr && <QRDialog organizations={qr} onClose={() => setQr(null)} />}
    </section>
  )
}

function EditDialog({
  editor,
  operations,
  token,
  organizations,
  onClose,
  onSaved,
}: {
  editor: Editor
  operations: Operations
  token: string
  organizations: Organization[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const orgEditor = editor === "organization"

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const value = (key: string) => String(data.get(key) ?? "").trim()
    setError("")
    setBusy(true)
    try {
      if (orgEditor) {
        await operations.createOrganization(token, {
          code: value("code"),
          name_ru: value("name_ru"),
          name_kz: value("name_kz"),
          org_type_ru: value("org_type_ru"),
          org_type_kz: value("org_type_kz"),
          building_ru: value("building_ru"),
          building_kz: value("building_kz"),
          template_id: value("organization"),
          is_laboratory: data.has("lab"),
          summary_rule: value("summary_rule"),
        })
        onSaved("Организация подключена. Её QR-код доступен в реестре.")
      } else {
        await operations.createResponsible(token, {
          email: value("email"),
          full_name_ru: value("full_name_ru"),
          full_name_kz: value("full_name_kz"),
          organization_id: value("organization"),
          password: String(data.get("password") ?? ""),
        })
        onSaved("Ответственный добавлен и привязан к организации.")
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось сохранить."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {orgEditor ? "Подключить организацию" : "Добавить ответственного"}
          </DialogTitle>
          <DialogDescription>
            {orgEditor
              ? "Выберите действующую точку, чтобы скопировать её список видов отходов."
              : "Укажите организацию, в которой сотрудник будет вести учёт."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div className="grid gap-3 sm:grid-cols-2">
            {orgEditor ? (
              <>
                <FormInput name="name_ru" label="Название" />
                <FormInput
                  name="name_kz"
                  label="Название на казахском"
                  optional
                />
                <FormInput name="org_type_ru" label="Тип организации" />
                <FormInput
                  name="org_type_kz"
                  label="Тип на казахском"
                  optional
                />
                <FormInput name="building_ru" label="Корпус / адрес" />
                <FormInput
                  name="building_kz"
                  label="Адрес на казахском"
                  optional
                />
                <FormInput
                  name="code"
                  label="Код (латиница)"
                  pattern="[a-z][a-z0-9_]{1,39}"
                  placeholder="buffet_3"
                />
                <Field>
                  <FieldLabel htmlFor="summary_rule">Правило итогов</FieldLabel>
                  <NativeSelect
                    id="summary_rule"
                    name="summary_rule"
                    className="w-full"
                  >
                    <NativeSelectOption value="monthly_by_item">
                      За месяц по видам
                    </NativeSelectOption>
                    <NativeSelectOption value="daily_and_monthly">
                      За день и месяц
                    </NativeSelectOption>
                    <NativeSelectOption value="tara_plus_bones">
                      Тара + кости
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
              </>
            ) : (
              <>
                <FormInput name="full_name_ru" label="ФИО" />
                <FormInput
                  name="full_name_kz"
                  label="ФИО на казахском"
                  optional
                />
                <FormInput
                  name="email"
                  label="Рабочая почта"
                  type="email"
                  autoComplete="off"
                />
                <FormInput
                  name="password"
                  label={
                    token === "demo"
                      ? "Пароль для демо"
                      : "Пароль (от 8 символов)"
                  }
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  defaultValue={token === "demo" ? "atu2026" : undefined}
                  readOnly={token === "demo"}
                />
              </>
            )}
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="edit-organization">
                {orgEditor ? "Шаблон видов отходов" : "Организация"}
              </FieldLabel>
              <NativeSelect
                id="edit-organization"
                name="organization"
                className="w-full"
                defaultValue=""
                required
              >
                <NativeSelectOption value="" disabled>
                  Выберите организацию
                </NativeSelectOption>
                {organizations.map((org) => (
                  <NativeSelectOption key={org.id} value={org.id}>
                    {org.name_ru}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {orgEditor && (
              <label className="flex items-center gap-2">
                <input type="checkbox" name="lab" /> Учебная лаборатория
              </label>
            )}
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Сохраняем…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FormInput({
  name,
  label,
  optional,
  ...props
}: {
  name: string
  label: string
  optional?: boolean
} & React.ComponentProps<typeof Input>) {
  return (
    <Field>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        maxLength={200}
        required={!optional}
        {...props}
      />
    </Field>
  )
}

function pointUrl(org: Organization) {
  const base = org.qr_code_token.startsWith("demo-")
    ? window.location.href
    : import.meta.env.VITE_PUBLIC_WEB_URL || window.location.href
  const url = new URL(base)
  url.hash = ""
  url.searchParams.set("point", org.qr_code_token)
  return url.href
}

function QRDialog({
  organizations,
  onClose,
}: {
  organizations: Organization[]
  onClose: () => void
}) {
  const load = useCallback(async () => {
    const { toDataURL } = await import("qrcode")
    return Promise.all(
      organizations.map(async (org) => {
        const url = pointUrl(org)
        return {
          org,
          url,
          image: await toDataURL(url, {
            width: 384,
            margin: 4,
            errorCorrectionLevel: "M",
          }),
        }
      })
    )
  }, [organizations])
  const { result } = useReportingQuery(load)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>QR-коды организаций</DialogTitle>
          <DialogDescription>
            Отсканируйте QR-код камерой телефона, чтобы открыть форму выбранной
            точки.
          </DialogDescription>
        </DialogHeader>
        {result.state === "ready" &&
          result.data.some(({ url }) =>
            ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
          ) && (
            <p className="text-muted-foreground">
              Для сканирования с телефона откройте кабинет по адресу, доступному
              в сети телефона.
            </p>
          )}
        {result.state === "loading" && <p role="status">Создание QR-кодов…</p>}
        {result.state === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}
        {result.state === "ready" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.map(({ org, url, image }) => (
              <Card size="sm" key={org.id}>
                <CardHeader>
                  <CardTitle>{org.name_ru}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <img
                    className="mx-auto w-full max-w-44 rounded border"
                    src={image}
                    alt={`QR-код: ${org.name_ru}`}
                  />
                  <div className="flex flex-wrap gap-1">
                    <a
                      className={buttonVariants({ variant: "outline" })}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть форму
                    </a>
                    <a
                      className={buttonVariants({ variant: "ghost" })}
                      href={image}
                      download={`atu-${org.code}-qr.png`}
                    >
                      Скачать PNG
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
