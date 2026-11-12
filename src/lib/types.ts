export type Language = "ru" | "kz";
export type ReportStatus =
  "draft" | "submitted" | "in_review" | "returned" | "approved";
export type Category = "organic" | "recyclable" | "special" | "mixed";
export type Unit = "kg" | "l";
export type Recyclability = "yes" | "partial" | "no";
export type MethodCode =
  "DONATE" | "FEED" | "RECYCLE" | "OIL" | "AD" | "COMPOST" | "TBO";
export interface Organization {
  id: string;
  code: string;
  name_ru: string;
  name_kz: string;
  is_laboratory: boolean;
  summary_rule: string;
  building_ru: string;
  building_kz: string;
  qr_code_token: string;
}
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
export interface Method {
  id: string;
  code: MethodCode;
  name_ru: string;
  name_kz: string;
  co2_per_ton: number;
  hierarchy_rank: number;
  has_defra_factor: boolean;
}
export interface CatalogItem {
  waste_type_id: string;
  waste_code: string | null;
  name_ru: string;
  name_kz: string;
  category: Category;
  unit: Unit;
  recyclable: Recyclability;
  recommended_method_id: string;
  recommended_method_code: MethodCode;
  co2_tbo_per_ton: number;
  co2_rec_per_ton: number;
  co2_saving_per_ton: number;
  density_kg_per_l: number;
  is_tara: boolean;
  is_custom: boolean;
}
export interface Report {
  id: string;
  organization_id: string;
  period_month: string;
  status: ReportStatus;
  inspector_comment: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}
export interface WasteRecord {
  id: string;
  report_id: string;
  organization_id: string;
  record_date: string;
  waste_type_id: string;
  amount: number;
  unit: Unit;
  disposal_method_id: string;
  responsible_id: string;
  photo_url: string | null;
  ai_recognized: boolean;
  created_at: string;
}
export interface StatusEvent {
  id: string;
  report_id: string;
  from_status: ReportStatus | null;
  to_status: ReportStatus;
  comment: string | null;
  created_at: string;
}
export interface Workspace {
  organization: Organization;
  catalog: CatalogItem[];
  methods: Method[];
  report: Report;
  records: WasteRecord[];
  history: StatusEvent[];
}
export interface Draft {
  record_date: string;
  waste_type_id: string;
  amount: string;
  disposal_method_id: string;
  photo_url: string | null;
  ai_recognized: boolean;
}
export interface NewWasteType {
  name: string;
  translatedName?: string;
  language: Language;
  category: Category;
  unit: Unit;
  recyclable: Recyclability;
}
