import { useEffect, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

export type SessionProfile = {
  id: string
  full_name_ru: string
  role: string
  organization_id: string | null
}

export async function restoreWebSession(client: SupabaseClient, token: string) {
  const { data, error } = await client
    .rpc("w4_restore_session", { p_token: token })
    .maybeSingle<SessionProfile>()
  if (error) throw new Error("Не удалось проверить сессию. Попробуйте ещё раз.")
  return data
}

export function browserSessionKey(scope: string) {
  return `atu:session:${import.meta.env.VITE_SUPABASE_URL}:${scope}`
}

function readToken(key: string | null) {
  if (!key) return null
  try {
    const token = localStorage.getItem(key)
    return token && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(token)
      ? token
      : null
  } catch {
    return null
  }
}

function saveToken(key: string | null, token?: string) {
  if (!key) return
  try {
    if (token) localStorage.setItem(key, token)
    else localStorage.removeItem(key)
  } catch {
    // The active session still works when browser storage is unavailable.
  }
}

type Session<T> =
  | { state: "signed-out" }
  | { state: "restoring" | "failed"; token: string }
  | { state: "signed-in"; value: T }

export function useBrowserSession<T>(
  key: string | null,
  restore: ((token: string) => Promise<T | null>) | null
) {
  const [session, setSession] = useState<Session<T>>(() => {
    const token = readToken(key)
    return token ? { state: "restoring", token } : { state: "signed-out" }
  })

  useEffect(() => {
    if (!restore || session.state !== "restoring") return
    const { token } = session
    let active = true
    void restore(token).then(
      (value) => {
        if (!active) return
        if (value !== null) {
          setSession({ state: "signed-in", value })
        } else {
          if (readToken(key) === token) saveToken(key)
          setSession({ state: "signed-out" })
        }
      },
      () => {
        if (active) setSession({ state: "failed", token })
      }
    )
    return () => {
      active = false
    }
  }, [key, restore, session])

  return {
    session,
    remember(value: T, token?: string) {
      saveToken(key, token)
      setSession({ state: "signed-in", value })
    },
    clear() {
      saveToken(key)
      setSession({ state: "signed-out" })
    },
    retry() {
      if (session.state === "failed")
        setSession({ state: "restoring", token: session.token })
    },
  }
}
