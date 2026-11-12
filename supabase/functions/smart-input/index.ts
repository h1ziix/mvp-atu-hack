import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createHandler } from "../_shared/handler.ts";

Deno.serve(
  createHandler({
    deepseekKey: Deno.env.get("DEEPSEEK_API_KEY"),
    model: Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-v4-flash",
    sessionSecret: Deno.env.get("AI_SESSION_SECRET") ?? "",
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    supabaseKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    allowedOrigins: (
      Deno.env.get("AI_ALLOWED_ORIGINS") ??
      "http://localhost:8081,http://localhost:8083"
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  }),
);
