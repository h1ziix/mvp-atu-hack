export type Category = "organic" | "recyclable" | "special" | "mixed";
export type Recyclability = "yes" | "partial" | "no";
export type Unit = "kg" | "l";
export interface User {
  id: string;
  email: string;
  full_name_ru: string;
  full_name_kz: string;
  role: "responsible";
  organization_id: string;
  org_code: string;
  org_name_ru: string;
  org_name_kz: string;
}
export interface CatalogItem {
  waste_type_id: string;
  name_ru: string;
  name_kz: string;
  unit: Unit;
}

export type SmartTask = "photo" | "voice" | "translate";
export interface AiSession {
  token: string;
  expires_at: number;
  user_id: string;
}
export interface NewWasteSuggestion {
  name_ru: string;
  name_kz: string;
  category: Category;
  unit: Unit;
  recyclable: Recyclability;
}
export interface Recognition {
  kind: "existing" | "new" | "unknown";
  waste_type_id?: string;
  suggestion?: NewWasteSuggestion;
  amount?: number;
  unit?: Unit;
  amount_source: "estimate" | "scale_display" | "spoken" | "none";
  confidence: number;
}
export interface Translation {
  name_ru: string;
  name_kz: string;
}
export interface SessionResponse {
  user: User;
  session: AiSession;
}
