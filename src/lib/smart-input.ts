import type { AiSession, Recognition, SessionResponse } from "./smart-types";
import type { CatalogItem, Language, User } from "./types";
import {
  object,
  parseRecognition,
  parseTranslation,
} from "../utils/smart-input";
import { readSmartSession, writeSmartSession } from "./smart-session-store";

const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
export const smartEndpoint = (
  process.env.EXPO_PUBLIC_SMART_INPUT_URL ||
  (projectUrl ? `${projectUrl}/functions/v1/smart-input` : "")
).replace(/\/$/, "");
export const smartConfigured = Boolean(smartEndpoint);
async function post(
  payload: unknown,
  token?: string,
  signal?: AbortSignal,
  timeout = 42000,
) {
  if (!smartConfigured) throw new Error("ai_config");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new Error("ai_cancelled");
  signal?.addEventListener("abort", abort);
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetch(smartEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const code = object(body).error;
      throw new Error(
        typeof code === "string" && code.startsWith("ai_")
          ? code
          : "ai_unavailable",
      );
    }
    return body;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(signal?.aborted ? "ai_cancelled" : "ai_timeout");
    if (error instanceof Error && /^ai_[a-z_]+$/.test(error.message))
      throw error;
    throw new Error("ai_unavailable");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export async function startSmartSession(
  user: User,
  email: string,
  password: string,
) {
  if (!smartConfigured) return;
  const data = (await post(
    { task: "session", email, password },
    undefined,
    undefined,
    10000,
  )) as SessionResponse;
  if (
    data.user?.id !== user.id ||
    data.user?.organization_id !== user.organization_id ||
    data.session?.user_id !== user.id ||
    typeof data.session.token !== "string" ||
    data.session.token.length > 2048 ||
    !Number.isFinite(data.session.expires_at) ||
    data.session.expires_at <= Date.now()
  )
    throw new Error("ai_auth");
  await writeSmartSession(JSON.stringify(data.session));
}
export function clearSmartSession() {
  return writeSmartSession(null);
}
async function token(user: User) {
  try {
    const saved = await readSmartSession();
    if (saved) {
      const session = JSON.parse(saved) as AiSession;
      if (session.user_id === user.id && session.expires_at > Date.now() + 5000)
        return session.token;
    }
  } catch {}
  try {
    await startSmartSession(user, user.email, "atu2026");
    const refreshed = await readSmartSession();
    if (refreshed) {
      const session = JSON.parse(refreshed) as AiSession;
      if (session.user_id === user.id && session.expires_at > Date.now() + 5000)
        return session.token;
    }
  } catch {}
  throw new Error("ai_auth");
}
export async function recognizePhoto(
  image: string,
  user: User,
  catalog: CatalogItem[],
  signal?: AbortSignal,
): Promise<Recognition> {
  const result = await post(
    { task: "photo", image },
    await token(user),
    signal,
  );
  return parseRecognition(result, catalog, "photo");
}
export async function recognizePhrase(
  phrase: string,
  user: User,
  catalog: CatalogItem[],
  signal?: AbortSignal,
): Promise<Recognition> {
  const result = await post(
    { task: "voice", phrase },
    await token(user),
    signal,
  );
  return parseRecognition(result, catalog, "voice");
}
export async function translateWaste(
  name: string,
  language: Language,
  user: User,
  signal?: AbortSignal,
) {
  return parseTranslation(
    await post(
      { task: "translate", name, language },
      await token(user),
      signal,
    ),
  );
}
