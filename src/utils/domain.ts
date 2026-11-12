import type {
  CatalogItem,
  Draft,
  Language,
  Method,
  ReportStatus,
  WasteRecord,
} from "@/lib/types";

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const months = {
  ru: [
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь",
  ],
  kz: [
    "қаңтар",
    "ақпан",
    "наурыз",
    "сәуір",
    "мамыр",
    "маусым",
    "шілде",
    "тамыз",
    "қыркүйек",
    "қазан",
    "қараша",
    "желтоқсан",
  ],
};
const russianDateMonths = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
// Explicit names also work in Hermes and browsers without Kazakh Intl locale data.
export function monthLabel(month: string, language: Language): string {
  const name = months[language][Number(month.slice(5, 7)) - 1];
  return `${name} ${month.slice(0, 4)}`;
}
export function monthShortLabel(month: string, language: Language): string {
  return months[language][Number(month.slice(5, 7)) - 1].slice(0, 3);
}
export function dateLabel(date: string, language: Language): string {
  const names = language === "ru" ? russianDateMonths : months.kz;
  return `${Number(date.slice(8, 10))} ${names[Number(date.slice(5, 7)) - 1]}`;
}
export function timestampLabel(timestamp: string, language: Language): string {
  const date = new Date(timestamp);
  return `${dateLabel(localDate(date), language)}, ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function number(value: number, digits = 1): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}
export function editable(status: ReportStatus) {
  return status === "draft" || status === "returned";
}
export function decimal(text: string) {
  return Number(text.replace(",", ".").trim());
}
export function validateDraft(
  draft: Draft,
  period: string,
  today = localDate(),
): string | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.record_date) ||
    Number.isNaN(Date.parse(draft.record_date)) ||
    localDate(new Date(`${draft.record_date}T12:00:00`)) !== draft.record_date
  )
    return "date";
  if (draft.record_date > today) return "future";
  if (draft.record_date.slice(0, 7) !== period) return "period";
  const amount = decimal(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 2000) return "amount";
  if (!draft.waste_type_id || !draft.disposal_method_id) return "required";
  return null;
}
export function isDuplicate(
  draft: Draft,
  records: WasteRecord[],
  excludeId?: string,
) {
  return records.some(
    (r) =>
      r.id !== excludeId &&
      r.record_date === draft.record_date &&
      r.waste_type_id === draft.waste_type_id,
  );
}
export function recordWeight(record: WasteRecord, catalog: CatalogItem[]) {
  const item = catalog.find((w) => w.waste_type_id === record.waste_type_id);
  return (
    Number(record.amount) *
    (record.unit === "l" ? Number(item?.density_kg_per_l ?? 0.92) : 1)
  );
}
export function totals(
  records: WasteRecord[],
  catalog: CatalogItem[],
  methods: Method[],
) {
  return records.reduce(
    (sum, record) => {
      const item = catalog.find(
        (w) => w.waste_type_id === record.waste_type_id,
      );
      const method = methods.find((m) => m.id === record.disposal_method_id);
      const kg = recordWeight(record, catalog);
      const saving =
        item && method && method.code !== "TBO"
          ? (kg / 1000) *
            Math.max(
              0,
              Number(item.co2_tbo_per_ton) - Number(method.co2_per_ton),
            )
          : 0;
      return {
        kg: sum.kg + kg,
        liters: sum.liters + (record.unit === "l" ? Number(record.amount) : 0),
        co2: sum.co2 + saving,
        diverted: sum.diverted + (method && method.code !== "TBO" ? kg : 0),
        tara: sum.tara + (item?.is_tara ? kg : 0),
        bones: sum.bones + (!item?.is_tara ? kg : 0),
      };
    },
    { kg: 0, liters: 0, co2: 0, diverted: 0, tara: 0, bones: 0 },
  );
}
export function orgFromQr(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const known: Record<string, string> = {
    iskander: "iskander",
    "iskander@atu.edu.kz": "iskander",
    "0dc40177-003a-4576-b986-9f989e6c5c9e": "iskander",
    canella: "canella",
    "canella@atu.edu.kz": "canella",
    "b9bc1678-dde4-4651-b7c4-66cd7f9f015c": "canella",
    atu_inn: "atu_inn",
    atuinn: "atu_inn",
    "atu-inn": "atu_inn",
    "atuinn@atu.edu.kz": "atu_inn",
    "93ffb4ab-5643-4dd4-84e3-9f8c8fc163d7": "atu_inn",
    tpp: "tpp",
    "tpp@atu.edu.kz": "tpp",
    "754125a5-a047-4f2f-8a78-a2e2ed61b80b": "tpp",
    thipp: "thipp",
    "thipp@atu.edu.kz": "thipp",
    "7617739b-c7e8-48a9-a456-31d2e457fa69": "thipp",
  };
  const resolveToken = (token: string | null | undefined): string | null => {
    if (!token) return null;
    const normalized = token
      .trim()
      .toLowerCase()
      .replace(/^atu-qr-/, "")
      .replace(/^demo-/, "");
    return known[normalized] ?? null;
  };
  const direct = resolveToken(raw);
  if (direct) return direct;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const key of [
        "org",
        "code",
        "org_code",
        "qr",
        "qr_code_token",
        "token",
        "organization_id",
        "id",
        "email",
      ]) {
        const hit =
          typeof parsed[key] === "string"
            ? resolveToken(parsed[key] as string)
            : null;
        if (hit) return hit;
      }
    } catch {
      /* Ignore malformed JSON */
    }
  }
  try {
    const url = new URL(raw);
    for (const param of [
      "org",
      "qr",
      "code",
      "token",
      "point",
      "organization_id",
      "id",
      "email",
    ]) {
      const hit = resolveToken(url.searchParams.get(param));
      if (hit) return hit;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    for (const seg of segments.reverse()) {
      const hit = resolveToken(seg);
      if (hit) return hit;
    }
  } catch {
    /* A QR may contain a token instead of a URL. */
  }
  return null;
}
const words: Record<string, number> = {
  ноль: 0,
  один: 1,
  одна: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  сто: 100,
  бір: 1,
  екі: 2,
  үш: 3,
  төрт: 4,
  бес: 5,
  алты: 6,
  жеті: 7,
  сегіз: 8,
  тоғыз: 9,
  он: 10,
  жиырма: 20,
};
export function parseVoice(phrase: string, catalog: CatalogItem[]) {
  const text = phrase.toLocaleLowerCase().replace(/ё/g, "е");
  const numeric = text.match(/\d+(?:[.,]\d+)?/);
  const values = text
    .split(/\s+/)
    .map((w) => words[w])
    .filter((v) => v !== undefined);
  const amount = numeric
    ? decimal(numeric[0])
    : values.length
      ? values.reduce((a, b) => a + b, 0) +
        (/половин|жарым/.test(text) ? 0.5 : 0)
      : undefined;
  const ranked = catalog
    .map((item) => {
      const tokens = `${item.name_ru} ${item.name_kz}`
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      return {
        item,
        score: tokens.reduce(
          (sum, token) =>
            sum +
            (text.includes(token.slice(0, Math.max(4, token.length - 2)))
              ? 1
              : 0),
          0,
        ),
      };
    })
    .sort((a, b) => b.score - a.score);
  return { item: ranked[0]?.score > 0 ? ranked[0].item : undefined, amount };
}
