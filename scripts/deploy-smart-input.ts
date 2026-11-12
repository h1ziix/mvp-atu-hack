import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ref =
  process.env.SUPABASE_PROJECT_REF ??
  (projectUrl ? new URL(projectUrl).hostname.split(".")[0] : "");
if (!/^[a-z0-9]{20}$/.test(ref))
  throw new Error(
    "Set EXPO_PUBLIC_SUPABASE_URL or SUPABASE_PROJECT_REF for the target project.",
  );
const cli = async (args: string[]) => {
  const child = Bun.spawn(["bunx", "supabase@3.1.0", ...args], {
    cwd: root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await child.exited;
  if (code !== 0)
    throw new Error(
      "Supabase command failed. Check CLI login and project permissions.",
    );
};
// Filter empty secrets so a key already configured in Dashboard is never cleared.
const allowed = new Set([
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "AI_SESSION_SECRET",
  "AI_ALLOWED_ORIGINS",
]);
const source = await readFile(join(root, "supabase/.env.local"), "utf8").catch(
  () => "",
);
const lines = source.split(/\r?\n/).filter((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  return !!m && allowed.has(m[1]) && !!m[2].trim().replace(/^['"]|['"]$/g, "");
});
if (lines.length) {
  const dir = await mkdtemp(join(tmpdir(), "atu-edge-secrets-"));
  try {
    const file = join(dir, "secrets.env");
    await writeFile(file, lines.join("\n") + "\n", { mode: 0o600 });
    await cli([
      "secrets",
      "set",
      `--remote=${ref}`,
      "--env-file",
      file,
      "--yes",
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
await cli([
  "functions",
  "deploy",
  "smart-input",
  `--remote=${ref}`,
  "--use-api",
  "--yes",
]);
console.log(
  `Edge Function deployed: https://${ref}.supabase.co/functions/v1/smart-input`,
);
