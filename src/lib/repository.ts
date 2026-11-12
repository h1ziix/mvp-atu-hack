import { createDemoWorkspace, demoUsers } from "@/data/demo";
import { uploadPhotoIfNeeded } from "./photo";
import { supabase } from "./supabase";
import { readJSON, writeJSON } from "./storage";
import type {
  CatalogItem,
  Draft,
  NewWasteType,
  Report,
  User,
  WasteRecord,
  Workspace,
} from "./types";
import { decimal, editable, validateDraft } from "@/utils/domain";

export const workspaceKey = (user: User, month: string) =>
  `workspace:v1:${supabase ? "remote" : "demo"}:${user.organization_id}:${month}`;
export async function authenticate(
  email: string,
  password: string,
): Promise<User> {
  if (!supabase) {
    const user = demoUsers.find((u) => u.email === email.toLowerCase().trim());
    if (!user || password !== "atu2026") throw new Error("credentials");
    return user;
  }
  const { data, error } = await supabase.rpc("authenticate_user", {
    p_email: email.trim(),
    p_password: password,
  });
  if (error) throw error;
  const user = data?.[0];
  if (!user || user.role !== "responsible" || !user.organization_id)
    throw new Error("credentials");
  return user as User;
}
export async function loadWorkspace(
  user: User,
  month: string,
): Promise<Workspace> {
  if (!supabase) {
    const workspace =
      (await readJSON<Workspace>(workspaceKey(user, month))) ??
      createDemoWorkspace(user, month);
    const custom =
      (await readJSON<CatalogItem[]>(`catalog:${user.organization_id}`)) ?? [];
    workspace.catalog = [
      ...workspace.catalog.filter(
        (item) => !custom.some((c) => c.waste_type_id === item.waste_type_id),
      ),
      ...custom,
    ];
    return workspace;
  }
  const orgId = user.organization_id;
  const [org, catalog, methods, reportResult] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).single(),
    supabase
      .from("v_organization_waste_catalog")
      .select("*")
      .eq("organization_id", orgId)
      .order("sort_order"),
    supabase
      .from("disposal_methods")
      .select("*")
      .eq("is_active", true)
      .order("hierarchy_rank"),
    supabase
      .from("reports")
      .select("*")
      .eq("organization_id", orgId)
      .eq("period_month", month)
      .maybeSingle(),
  ]);
  for (const result of [org, catalog, methods, reportResult])
    if (result.error) throw result.error;
  let report = reportResult.data as Report | null;
  if (!report) {
    const periodEnd = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0,
    ).getDate();
    const result = await supabase.from("reports").upsert(
      {
        organization_id: orgId,
        period_month: month,
        period_start: `${month}-01`,
        period_end: `${month}-${periodEnd}`,
        submitted_by: user.id,
      },
      { onConflict: "organization_id,period_month", ignoreDuplicates: true },
    );
    if (result.error) throw result.error;
    const created = await supabase
      .from("reports")
      .select("*")
      .eq("organization_id", orgId)
      .eq("period_month", month)
      .single();
    if (created.error) throw created.error;
    report = created.data as Report;
  }
  const records: WasteRecord[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase
      .from("waste_records")
      .select("*")
      .eq("report_id", report.id)
      .order("created_at")
      .order("id")
      .range(offset, offset + 999);
    if (result.error) throw result.error;
    records.push(...(result.data as WasteRecord[]));
    if (result.data.length < 1000) break;
  }
  const history = await supabase
    .from("status_history")
    .select("*")
    .eq("report_id", report.id)
    .order("created_at");
  if (history.error) throw history.error;
  return {
    organization: org.data,
    catalog: catalog.data ?? [],
    methods: methods.data ?? [],
    report,
    records,
    history: history.data ?? [],
  } as Workspace;
}
export async function saveRecord(
  user: User,
  workspace: Workspace,
  draft: Draft,
  id?: string,
): Promise<WasteRecord> {
  if (!editable(workspace.report.status)) throw new Error("locked");
  const invalid = validateDraft(draft, workspace.report.period_month);
  if (invalid) throw new Error(invalid);
  const item = workspace.catalog.find(
    (w) => w.waste_type_id === draft.waste_type_id,
  );
  if (
    !item ||
    !workspace.methods.some((m) => m.id === draft.disposal_method_id)
  )
    throw new Error("required");
  const uploadedPhotoUrl = supabase
    ? await uploadPhotoIfNeeded(draft.photo_url, user.organization_id)
    : draft.photo_url;
  const payload = {
    report_id: workspace.report.id,
    organization_id: user.organization_id,
    record_date: draft.record_date,
    waste_type_id: draft.waste_type_id,
    amount: decimal(draft.amount),
    unit: item.unit,
    disposal_method_id: draft.disposal_method_id,
    responsible_id: user.id,
    photo_url: uploadedPhotoUrl,
    ai_recognized: draft.ai_recognized,
  };
  if (!supabase)
    return {
      ...payload,
      id: id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      created_at:
        workspace.records.find((r) => r.id === id)?.created_at ??
        new Date().toISOString(),
    };
  const status = await supabase
    .from("reports")
    .select("status")
    .eq("id", workspace.report.id)
    .single();
  if (status.error) throw status.error;
  if (!editable(status.data.status)) throw new Error("locked");
  const result = id
    ? await supabase
        .from("waste_records")
        .update(payload)
        .eq("id", id)
        .eq("report_id", workspace.report.id)
        .select()
        .single()
    : await supabase.from("waste_records").insert(payload).select().single();
  if (result.error) throw result.error;
  return result.data as WasteRecord;
}
export async function deleteRecord(workspace: Workspace, id: string) {
  if (!editable(workspace.report.status)) throw new Error("locked");
  if (!supabase) return;
  const status = await supabase
    .from("reports")
    .select("status")
    .eq("id", workspace.report.id)
    .single();
  if (status.error) throw status.error;
  if (!editable(status.data.status)) throw new Error("locked");
  const result = await supabase
    .from("waste_records")
    .delete()
    .eq("id", id)
    .eq("report_id", workspace.report.id)
    .select("id")
    .single();
  if (result.error) throw result.error;
}
export async function addWasteType(
  user: User,
  input: NewWasteType,
  workspace: Workspace,
): Promise<CatalogItem> {
  if (!editable(workspace.report.status)) throw new Error("locked");
  if (!input.name.trim()) throw new Error("required");
  const methodCode =
    input.category === "special"
      ? "OIL"
      : input.category === "recyclable" || input.category === "mixed"
        ? "RECYCLE"
        : "COMPOST";
  // Untranslated names are preserved verbatim until a translation is supplied.
  const nameRu =
    input.language === "ru"
      ? input.name.trim()
      : input.translatedName?.trim() || input.name.trim();
  const nameKz =
    input.language === "kz"
      ? input.name.trim()
      : input.translatedName?.trim() || input.name.trim();
  if (supabase) {
    const result = await supabase.rpc("add_organization_waste_type", {
      p_organization_id: user.organization_id,
      p_name_ru: nameRu,
      p_name_kz: nameKz,
      p_category: input.category,
      p_unit: input.unit,
      p_recyclable: input.recyclable,
      p_recommended_method_code: methodCode,
    });
    if (result.error) throw result.error;
    const catalog = await supabase
      .from("v_organization_waste_catalog")
      .select("*")
      .eq("organization_id", user.organization_id)
      .eq("waste_type_id", result.data)
      .single();
    if (catalog.error) throw catalog.error;
    return catalog.data as CatalogItem;
  }
  const existing = workspace.catalog.find(
    (w) => w.name_ru.toLowerCase() === nameRu.toLowerCase(),
  );
  if (existing) return existing;
  const baseline =
    input.category === "organic" || input.category === "special"
      ? 700.21
      : input.category === "mixed"
        ? 1164.39
        : 8.88;
  const recommended = workspace.methods.find((m) => m.code === methodCode)!;
  return {
    waste_type_id: `custom-${Date.now()}`,
    waste_code: null,
    name_ru: nameRu,
    name_kz: nameKz,
    category: input.category,
    unit: input.unit,
    recyclable: input.recyclable,
    recommended_method_id: recommended.id,
    recommended_method_code: methodCode,
    co2_tbo_per_ton: baseline,
    co2_rec_per_ton: recommended.co2_per_ton,
    co2_saving_per_ton: baseline - recommended.co2_per_ton,
    density_kg_per_l: input.unit === "l" ? 0.92 : 1,
    is_tara: ["recyclable", "mixed"].includes(input.category),
    is_custom: true,
  };
}
export async function submitReport(
  user: User,
  workspace: Workspace,
): Promise<Report> {
  if (!editable(workspace.report.status)) throw new Error("locked");
  if (!workspace.records.length) throw new Error("empty");
  if (!supabase)
    return {
      ...workspace.report,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    };
  const result = await supabase
    .from("reports")
    .update({ status: "submitted", submitted_by: user.id })
    .eq("id", workspace.report.id)
    .in("status", ["draft", "returned"])
    .select()
    .single();
  if (result.error) throw result.error;
  return result.data as Report;
}
export async function cacheWorkspace(user: User, workspace: Workspace) {
  if (!supabase)
    await writeJSON(
      `catalog:${user.organization_id}`,
      workspace.catalog.filter((item) => item.is_custom),
    );
  await writeJSON(workspaceKey(user, workspace.report.period_month), workspace);
}
