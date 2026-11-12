import seed from "./seed.json";
import type {
  CatalogItem,
  Method,
  Organization,
  ReportStatus,
  User,
  Workspace,
} from "@/lib/types";

export const organizations = seed.organizations.map((o) => ({
  ...o,
  id: `demo-${o.code}`,
})) as Organization[];
const profiles = [
  [
    "iskander",
    "iskander",
    "Искандеров Марат Болатович",
    "Ескендіров Марат Болатұлы",
  ],
  [
    "canella",
    "canella",
    "Ахметова Динара Сериковна",
    "Ахметова Динара Серікқызы",
  ],
  [
    "atu_inn",
    "atuinn",
    "Касымова Айгуль Талгатовна",
    "Қасымова Айгүл Талғатқызы",
  ],
  ["tpp", "tpp", "Оспанов Нурлан Ерланович", "Оспанов Нұрлан Ерланұлы"],
  [
    "thipp",
    "thipp",
    "Сулейменова Жанна Кайратовна",
    "Сүлейменова Жанна Қайратқызы",
  ],
];
export const demoUsers: User[] = profiles.map(([code, login, ru, kz]) => {
  const org = organizations.find((o) => o.code === code)!;
  return {
    id: `demo-user-${code}`,
    email: `${login}@atu.edu.kz`,
    full_name_ru: ru,
    full_name_kz: kz,
    role: "responsible",
    organization_id: org.id,
    org_code: code,
    org_name_ru: org.name_ru,
    org_name_kz: org.name_kz,
  };
});
const canteen = [
  "veg_peels",
  "meat_trimmings",
  "hall_food_waste",
  "unsold_food",
  "used_oil",
  "cardboard_packaging",
];
const templates: Record<string, string[]> = {
  iskander: canteen,
  atu_inn: canteen,
  canella: ["coffee_grounds", "cardboard_packaging", "leftover_food"],
  tpp: ["packaging_waste", "meat_bones", "fish_bones"],
  thipp: [
    "eggshell",
    "sucrose",
    "pet_bottle_oil",
    "glass_bottle",
    "bakery_samples",
    "confectionery_samples",
    "fruit_veg_waste",
    "aluminum_cans",
  ],
};
const base: Record<string, number> = {
  hall_food_waste: 24.5,
  veg_peels: 18,
  unsold_food: 8.4,
  meat_trimmings: 6.2,
  used_oil: 7.5,
  cardboard_packaging: 6.5,
  coffee_grounds: 9.4,
  leftover_food: 4.2,
  packaging_waste: 3.5,
  meat_bones: 5.8,
  fish_bones: 3.1,
  eggshell: 2.4,
  sucrose: 1.8,
  pet_bottle_oil: 1.5,
  glass_bottle: 2.9,
  bakery_samples: 4.6,
  confectionery_samples: 3.7,
  fruit_veg_waste: 5.1,
  aluminum_cans: 1.2,
};
export function createDemoWorkspace(user: User, month: string): Workspace {
  const organization = organizations.find((o) => o.code === user.org_code)!;
  const methods = seed.disposal_methods.map((m) => ({
    ...m,
    id: `demo-method-${m.code}`,
  })) as Method[];
  const catalog = templates[user.org_code].map((code) => {
    const wt = seed.waste_types.find((w) => w.code === code)!;
    return {
      ...wt,
      waste_code: code,
      waste_type_id: `demo-waste-${code}`,
      recommended_method_id: `demo-method-${wt.recommended_method_code}`,
      co2_saving_per_ton: wt.co2_tbo_per_ton - wt.co2_rec_per_ton,
      is_custom: false,
    } as CatalogItem;
  });
  const status: ReportStatus =
    month < "2026-11"
      ? "approved"
      : month === "2026-11"
        ? ((
            {
              canella: "returned",
              atu_inn: "submitted",
              thipp: "approved",
            } as Record<string, ReportStatus>
          )[user.org_code] ?? "draft")
        : "draft";
  const reportId = `${organization.id}-${month}`;
  const comment =
    status === "returned"
      ? "Уточните массу картонной тары за 06.11 и приложите накладную сдачи вторсырья."
      : null;
  const report = {
    id: reportId,
    organization_id: organization.id,
    period_month: month,
    status,
    inspector_comment: comment,
    submitted_at: status === "draft" ? null : `${month}-10T10:00:00Z`,
    reviewed_at: ["returned", "approved"].includes(status)
      ? `${month}-11T06:45:00Z`
      : null,
    created_at: `${month}-01T04:00:00Z`,
  };
  const factor = (
    {
      "2026-08": 0.78,
      "2026-09": 1.05,
      "2026-10": 1.24,
      "2026-11": 0.65,
    } as Record<string, number>
  )[month];
  const records = !factor
    ? []
    : [2, 4, 6, 8, 10].flatMap((day) =>
        catalog.map((item, i) => ({
          id: `${reportId}-${day}-${i}`,
          report_id: reportId,
          organization_id: organization.id,
          record_date: `${month}-${String(day).padStart(2, "0")}`,
          waste_type_id: item.waste_type_id,
          amount: Number(
            (
              (base[item.waste_code!] ?? 4) *
              factor *
              (0.9 + day * 0.025) *
              (user.org_code === "atu_inn" ? 0.65 : 1)
            ).toFixed(2),
          ),
          unit: item.unit,
          disposal_method_id:
            [2, 6].includes(day) &&
            !["used_oil", "cardboard_packaging"].includes(item.waste_code!)
              ? "demo-method-TBO"
              : item.recommended_method_id,
          responsible_id: user.id,
          photo_url: null,
          ai_recognized: day === 10,
          created_at: `${month}-${String(day).padStart(2, "0")}T07:${String(i * 5).padStart(2, "0")}:00Z`,
        })),
      );
  const history: Workspace["history"] = [
    {
      id: `${reportId}-created`,
      report_id: reportId,
      from_status: null,
      to_status: "draft",
      comment: null,
      created_at: report.created_at,
    },
  ];
  if (status !== "draft")
    history.push({
      id: `${reportId}-submitted`,
      report_id: reportId,
      from_status: "draft",
      to_status: "submitted",
      comment: null,
      created_at: report.submitted_at!,
    });
  if (status === "approved" || status === "returned")
    history.push({
      id: `${reportId}-reviewed`,
      report_id: reportId,
      from_status: "submitted",
      to_status: status,
      comment,
      created_at: report.reviewed_at!,
    });
  return { organization, methods, catalog, report, records, history };
}
