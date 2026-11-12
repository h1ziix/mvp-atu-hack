import { describe, expect, test } from "bun:test";
import { createHandler, type ServerConfig } from "../_shared/handler.ts";
import { issueSession, verifySession } from "../_shared/session.ts";
const now = Date.parse("2026-11-12T08:00:00Z");
const config: ServerConfig = {
  deepseekKey: "test-provider-key",
  model: "deepseek-v4-flash",
  sessionSecret: "test-session-secret-with-more-than-32-characters",
  supabaseUrl: "https://database.example",
  supabaseKey: "test-anon",
  allowedOrigins: ["http://localhost:8083"],
};
const user = {
  id: "responsible-id",
  organization_id: "org-id",
  role: "responsible",
  email: "test@atu.edu.kz",
};
const catalog = [
  {
    waste_type_id: "peels",
    name_ru: "Очистки овощей",
    name_kz: "Көкөніс қабықтары",
    unit: "kg",
  },
];
const recognition = {
  kind: "existing",
  waste_type_id: "peels",
  amount: 12.5,
  unit: "kg",
  amount_source: "spoken",
  confidence: 0.95,
};
function setup(
  result: unknown = recognition,
  options: {
    active?: boolean;
    providerStatus?: number;
    finish?: string;
    key?: string;
  } = {},
) {
  const calls: { url: string; body?: Record<string, unknown> }[] = [];
  const handler = createHandler(
    { ...config, ...("key" in options ? { deepseekKey: options.key } : {}) },
    async (url, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });
      if (url.includes("authenticate_user"))
        return Response.json(body.p_password === "correct" ? [user] : []);
      if (url.includes("/profiles?"))
        return Response.json(options.active === false ? [] : [{ id: user.id }]);
      if (url.includes("v_organization_waste_catalog"))
        return Response.json(catalog);
      return Response.json(
        {
          choices: [
            {
              message: {
                content:
                  typeof result === "string" ? result : JSON.stringify(result),
              },
              finish_reason: options.finish ?? "stop",
            },
          ],
        },
        { status: options.providerStatus ?? 200 },
      );
    },
    () => now,
  );
  const post = (body: unknown, token?: string, origin?: string) =>
    handler(
      new Request("http://localhost:8787", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify(body),
      }),
    );
  return { handler, post, calls };
}
async function token() {
  return (
    await issueSession(user.id, user.organization_id, config.sessionSecret, now)
  ).token;
}
describe("signed AI session", () => {
  test("validates the current responsible account before issuing a token", async () => {
    const { post } = setup();
    const response = await post({
      task: "session",
      email: user.email,
      password: "correct",
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(
      (await verifySession(body.session.token, config.sessionSecret, now)).org,
    ).toBe(user.organization_id);
  });
  test("rejects incorrect password, forged and expired tokens", async () => {
    const { post } = setup();
    expect(
      (await post({ task: "session", email: user.email, password: "wrong" }))
        .status,
    ).toBe(401);
    expect(
      (await post({ task: "voice", phrase: "test" }, "forged.signature"))
        .status,
    ).toBe(401);
    const old = await issueSession(
      user.id,
      user.organization_id,
      config.sessionSecret,
      now - 5 * 3600000,
    );
    expect(
      (await post({ task: "voice", phrase: "test" }, old.token)).status,
    ).toBe(401);
  });
  test("blocks deactivated accounts even with a signed session", async () => {
    const { post, calls } = setup(recognition, { active: false });
    expect(
      (await post({ task: "voice", phrase: "test" }, await token())).status,
    ).toBe(401);
    expect(calls.some((c) => c.url.includes("deepseek"))).toBe(false);
  });
});
describe("DeepSeek proxy", () => {
  test("requires authentication before making paid calls", async () => {
    const { post, calls } = setup();
    expect((await post({ task: "voice", phrase: "test" })).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  test("uses server catalog, configured model and JSON output", async () => {
    const { post, calls } = setup();
    const response = await post(
      {
        task: "voice",
        phrase: "Очистки овощей 12,5 кг",
        catalog: [{ waste_type_id: "forged" }],
      },
      await token(),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).amount).toBe(12.5);
    const call = calls.find((c) => c.url.includes("deepseek"))!;
    expect(call.body?.model).toBe("deepseek-v4-flash");
    expect(call.body?.response_format).toEqual({ type: "json_object" });
    expect(JSON.stringify(call.body)).toContain("peels");
    expect(JSON.stringify(call.body)).not.toContain("forged");
  });
  test("accepts image content parts but never a remote image URL", async () => {
    const { post, calls } = setup({ kind: "unknown", confidence: 0.2 });
    const auth = await token();
    expect(
      (await post({ task: "photo", image: "data:image/png;base64,YWJj" }, auth))
        .status,
    ).toBe(200);
    const messages = calls.find((c) => c.url.includes("deepseek"))?.body
      ?.messages as { content: unknown }[];
    expect(messages[1].content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "image_url" })]),
    );
    expect(
      (
        await post(
          { task: "photo", image: "https://private.example/photo" },
          auth,
        )
      ).status,
    ).toBe(400);
  });
  test("refuses invented catalog entries and truncated or empty output", async () => {
    for (const [result, finish] of [
      [{ ...recognition, waste_type_id: "invented" }, "stop"],
      ["   ", "stop"],
      [recognition, "length"],
    ] as const) {
      const { post } = setup(result, { finish });
      const response = await post(
        { task: "voice", phrase: "test" },
        await token(),
      );
      expect(response.status).toBe(502);
      expect((await response.json()).error).toBe("ai_response");
    }
  });
  test("keeps provider failures generic and never leaks its secret", async () => {
    const { post } = setup(
      { key: config.deepseekKey },
      { providerStatus: 500 },
    );
    const response = await post(
      { task: "voice", phrase: "test" },
      await token(),
    );
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain(config.deepseekKey!);
  });
  test("missing provider key is a configuration failure, not fake AI", async () => {
    const { post, calls } = setup(recognition, { key: undefined });
    const response = await post(
      { task: "voice", phrase: "test" },
      await token(),
    );
    expect(response.status).toBe(503);
    expect(calls.some((c) => c.url.includes("deepseek"))).toBe(false);
  });
  test("limits user requests and rejects unapproved browser origins", async () => {
    const { post } = setup();
    const auth = await token();
    for (let i = 0; i < 20; i++)
      expect((await post({ task: "voice", phrase: "test" }, auth)).status).toBe(
        200,
      );
    expect((await post({ task: "voice", phrase: "test" }, auth)).status).toBe(
      429,
    );
    expect(
      (
        await post(
          { task: "voice", phrase: "test" },
          auth,
          "https://unapproved.example",
        )
      ).status,
    ).toBe(403);
  });
  test("translation returns validated RU/KZ names", async () => {
    const { post } = setup({
      name_ru: "Чайная заварка",
      name_kz: "Шай қалдығы",
    });
    const response = await post(
      { task: "translate", name: "Чайная заварка", language: "ru" },
      await token(),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).name_kz).toBe("Шай қалдығы");
  });
});
