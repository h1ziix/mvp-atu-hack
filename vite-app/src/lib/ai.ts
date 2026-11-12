import { FunctionsHttpError } from "@supabase/supabase-js"
import { supabase } from "@/review/supabase"
import type {
  AiAnalysis,
  AiMeasurement,
  PaperScan,
} from "../../supabase/functions/_shared/aiContracts"

export type {
  AiAnalysis,
  AiMeasurement,
  PaperRow,
  PaperScan,
} from "../../supabase/functions/_shared/aiContracts"

export function hasAiSession(token?: string): token is string {
  return Boolean(
    supabase &&
    token &&
    /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(token)
  )
}

async function call<T>(token: string, request: Record<string, string>) {
  if (!supabase || !hasAiSession(token))
    throw new Error("Войдите в аккаунт АТУ.")
  const { data, error } = await supabase.functions.invoke<T>("atu-ai", {
    body: { ...request, token },
  })
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    if (typeof body?.error === "string") throw new Error(body.error)
  }
  if (error || !data) throw new Error("ИИ пока недоступен. Попробуйте ещё раз.")
  return data
}

async function imageData(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size < 1 ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Выберите фото JPEG, PNG или WebP размером до 5 МБ.")
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Не удалось прочитать фото."))
    reader.readAsDataURL(file)
  })
}

export const requestAiAnalysis = (
  token: string,
  anchor: string,
  mode: string
) => call<AiAnalysis>(token, { action: "analysis", anchor, mode })

export const recognizeWastePhoto = async (token: string, file: File) =>
  call<AiMeasurement>(token, { action: "photo", image: await imageData(file) })

export const recognizeMeasurement = (token: string, transcript: string) =>
  call<AiMeasurement>(token, { action: "voice", transcript })

export const scanPaperForm = async (
  token: string,
  organizationId: string,
  file: File
) =>
  call<PaperScan>(token, {
    action: "ocr",
    organizationId,
    image: await imageData(file),
  })
