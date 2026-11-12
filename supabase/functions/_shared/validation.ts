import type { Recognition, Translation } from "./types.ts";
import type { CatalogItem, Unit } from "./types.ts";

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("ai_response");
  return value as Record<string, unknown>;
}
function name(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 120)
    throw new Error("ai_response");
  return value.trim();
}
export function parseTranslation(value: unknown): Translation {
  const data = object(value);
  return { name_ru: name(data.name_ru), name_kz: name(data.name_kz) };
}
export function parseRecognition(
  value: unknown,
  catalog: Pick<CatalogItem, "waste_type_id" | "unit">[],
  task: "photo" | "voice",
): Recognition {
  const data = object(value);
  if (
    !["existing", "new", "unknown"].includes(String(data.kind)) ||
    typeof data.confidence !== "number" ||
    !Number.isFinite(data.confidence) ||
    data.confidence < 0 ||
    data.confidence > 1
  )
    throw new Error("ai_response");
  const result: Recognition = {
    kind: data.kind as Recognition["kind"],
    confidence: data.confidence,
    amount_source: "none",
  };
  if (result.kind === "unknown") return result;
  let unit: Unit;
  if (result.kind === "existing") {
    const selected = catalog.find(
      (c) => c.waste_type_id === data.waste_type_id,
    );
    if (!selected) throw new Error("ai_response");
    result.waste_type_id = selected.waste_type_id;
    unit = selected.unit;
  } else {
    const suggestion = object(data.suggestion);
    if (
      !["organic", "recyclable", "special", "mixed"].includes(
        String(suggestion.category),
      ) ||
      !["kg", "l"].includes(String(suggestion.unit)) ||
      !["yes", "partial", "no"].includes(String(suggestion.recyclable))
    )
      throw new Error("ai_response");
    result.suggestion = {
      ...parseTranslation(suggestion),
      category: suggestion.category as NonNullable<
        Recognition["suggestion"]
      >["category"],
      unit: suggestion.unit as Unit,
      recyclable: suggestion.recyclable as NonNullable<
        Recognition["suggestion"]
      >["recyclable"],
    };
    unit = result.suggestion.unit;
  }
  // An amount without a matching unit and an explicit source must never enter the form.
  const sources = task === "photo" ? ["estimate", "scale_display"] : ["spoken"];
  if (data.amount !== undefined && data.amount !== null) {
    if (
      typeof data.amount !== "number" ||
      !Number.isFinite(data.amount) ||
      data.amount <= 0 ||
      data.amount > 2000 ||
      data.unit !== unit ||
      !sources.includes(String(data.amount_source))
    )
      throw new Error("ai_response");
    result.amount = data.amount;
    result.unit = unit;
    result.amount_source = data.amount_source as Recognition["amount_source"];
  }
  return result;
}
