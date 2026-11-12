export interface Claims {
  sub: string;
  org: string;
  exp: number;
}
const encoder = new TextEncoder();
const toBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
function fromBase64(value: string) {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function issueSession(
  sub: string,
  org: string,
  secret: string,
  now = Date.now(),
) {
  const expiresAt = Math.floor(now / 1000) + 4 * 60 * 60;
  const payload = toBase64(
    encoder.encode(JSON.stringify({ sub, org, exp: expiresAt })),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    encoder.encode(payload),
  );
  return {
    token: `${payload}.${toBase64(new Uint8Array(signature))}`,
    expires_at: expiresAt * 1000,
    user_id: sub,
  };
}
export async function verifySession(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<Claims> {
  try {
    if (token.length > 2048) throw new Error();
    const [payload, signature, extra] = token.split(".");
    if (
      !payload ||
      !signature ||
      extra ||
      !(await crypto.subtle.verify(
        "HMAC",
        await key(secret),
        fromBase64(signature),
        encoder.encode(payload),
      ))
    )
      throw new Error();
    const claims = JSON.parse(
      new TextDecoder().decode(fromBase64(payload)),
    ) as Claims;
    if (
      typeof claims.sub !== "string" ||
      !claims.sub ||
      typeof claims.org !== "string" ||
      !claims.org ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= Math.floor(now / 1000)
    )
      throw new Error();
    return claims;
  } catch {
    throw new Error("ai_auth");
  }
}
