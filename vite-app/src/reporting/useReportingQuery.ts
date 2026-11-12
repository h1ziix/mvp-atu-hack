import { useEffect, useState } from "react"

type QueryResult<T> =
  | { state: "loading" }
  | { state: "ready"; data: T }
  | { state: "error"; message: string }

export function useReportingQuery<T>(load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [snapshot, setSnapshot] = useState<{
    load: () => Promise<T>
    attempt: number
    result: QueryResult<T>
  }>()

  useEffect(() => {
    let active = true
    load().then(
      (data) => {
        if (active)
          setSnapshot({ load, attempt, result: { state: "ready", data } })
      },
      (error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить данные."
        if (active)
          setSnapshot({ load, attempt, result: { state: "error", message } })
      }
    )
    return () => {
      active = false
    }
  }, [load, attempt])

  const result: QueryResult<T> =
    snapshot?.load === load && snapshot.attempt === attempt
      ? snapshot.result
      : { state: "loading" }

  return { result, reload: () => setAttempt((value) => value + 1) }
}
