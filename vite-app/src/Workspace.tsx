import { lazy, Suspense } from "react"
import { Leaf, LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { currentMonth, type WorkspaceSource } from "@/reporting/model"
import { Registry } from "@/reporting/Registry"
import { SubmissionBoard } from "@/reporting/SubmissionBoard"
import ReviewWorkspace from "@/review/ReviewWorkspace"
import type { WorkspaceUser } from "@/review/model"
import type { Operations } from "@/operations/model"

const AnalyticsDashboard = lazy(() => import("@/analytics/AnalyticsDashboard"))
const Reports = lazy(() => import("@/reports/Reports"))
const Admin = lazy(() => import("@/operations/Admin"))

export default function Workspace({
  source,
  operations,
  user,
  onExit,
  simulateSubmission,
  initialPeriod = currentMonth(),
}: {
  source: WorkspaceSource
  operations: Operations | null
  user: WorkspaceUser
  onExit: () => void
  simulateSubmission?: () => boolean
  initialPeriod?: string
}) {
  const canReview = user.role === "inspector"
  const isAdmin = user.role === "admin"
  const canMonitor = canReview || isAdmin
  return (
    <Tabs
      defaultValue={isAdmin ? "admin" : canReview ? "review" : "analytics"}
      className="min-h-svh gap-0 bg-muted/30"
    >
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-14 w-full max-w-[100rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <Leaf className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm leading-tight font-semibold">
              АТУ · Экомониторинг
            </span>
          </div>
          <div className="order-last flex w-full sm:order-none sm:w-auto">
            <TabsList
              aria-label="Разделы кабинета"
              className="h-auto! min-h-8 w-full flex-wrap sm:w-auto"
            >
              {canReview && (
                <TabsTrigger value="review" className="min-h-7 sm:px-3">
                  Проверка
                </TabsTrigger>
              )}
              {canMonitor && (
                <TabsTrigger value="submissions" className="min-h-7 sm:px-3">
                  Контроль сдачи
                </TabsTrigger>
              )}
              <TabsTrigger value="registry" className="min-h-7 sm:px-3">
                Единый реестр
              </TabsTrigger>
              <TabsTrigger value="analytics" className="min-h-7 sm:px-3">
                Аналитика
              </TabsTrigger>
              <TabsTrigger value="reports" className="min-h-7 sm:px-3">
                Сводные отчёты
              </TabsTrigger>
              {isAdmin && operations && (
                <TabsTrigger value="admin" className="min-h-7 sm:px-3">
                  Администрирование
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Avatar aria-hidden="true" title={user.name}>
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="sr-only max-w-48 leading-tight lg:not-sr-only lg:grid">
              <span className="truncate text-sm font-medium" title={user.name}>
                {user.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {isAdmin
                  ? "Администратор"
                  : canReview
                    ? "Проверяющий"
                    : "Руководство"}
              </span>
            </div>
            <Button
              type="button"
              size="icon-lg"
              variant="ghost"
              onClick={onExit}
              aria-label="Выйти"
              title="Выйти"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[100rem] p-4 sm:p-6">
        {canReview && (
          <TabsContent value="review">
            <ReviewWorkspace
              source={source}
              inspector={user}
              simulateSubmission={simulateSubmission}
            />
          </TabsContent>
        )}
        {canMonitor && (
          <TabsContent value="submissions">
            <SubmissionBoard source={source} initialPeriod={initialPeriod} />
          </TabsContent>
        )}
        <TabsContent value="registry">
          <Registry source={source} initialPeriod={initialPeriod} />
        </TabsContent>
        <TabsContent value="analytics">
          <Suspense fallback={<p role="status">Загрузка аналитики…</p>}>
            <AnalyticsDashboard source={source} initialPeriod={initialPeriod} />
          </Suspense>
        </TabsContent>
        <TabsContent value="reports">
          <Suspense fallback={<p role="status">Загрузка отчётов…</p>}>
            <Reports
              source={source}
              operations={operations}
              user={user}
              initialPeriod={initialPeriod}
            />
          </Suspense>
        </TabsContent>
        {isAdmin && operations && (
          <TabsContent value="admin">
            <Suspense
              fallback={<p role="status">Загрузка администрирования…</p>}
            >
              <Admin operations={operations} token={user.token} />
            </Suspense>
          </TabsContent>
        )}
      </main>
    </Tabs>
  )
}
