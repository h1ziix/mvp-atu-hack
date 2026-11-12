import { describe, expect, test } from "bun:test";
import { createDemoWorkspace, demoUsers } from "../data/demo";
import type { Draft, WasteRecord } from "../lib/types";
import {
  dateLabel,
  monthLabel,
  editable,
  isDuplicate,
  orgFromQr,
  parseVoice,
  recordWeight,
  totals,
  validateDraft,
} from "./domain";

const user = demoUsers[0];
const w = createDemoWorkspace(user, "2026-11");
const draft: Draft = {
  record_date: "2026-11-12",
  waste_type_id: w.catalog[0].waste_type_id,
  amount: "12,5",
  disposal_method_id: w.catalog[0].recommended_method_id,
  photo_url: null,
  ai_recognized: false,
};
describe("validation and report locks", () => {
  test("accepts decimal commas and valid dates", () =>
    expect(validateDraft(draft, "2026-11", "2026-11-12")).toBeNull());
  test.each(["0", "-1", "2000.1", "Infinity", "NaN", ""])(
    "rejects amount %s",
    (amount) =>
      expect(validateDraft({ ...draft, amount }, "2026-11", "2026-11-12")).toBe(
        "amount",
      ),
  );
  test("accepts the upper bound", () =>
    expect(
      validateDraft({ ...draft, amount: "2000" }, "2026-11", "2026-11-12"),
    ).toBeNull());
  test("rejects future, invalid and out-of-period dates", () => {
    expect(
      validateDraft(
        { ...draft, record_date: "2026-11-13" },
        "2026-11",
        "2026-11-12",
      ),
    ).toBe("future");
    expect(
      validateDraft(
        { ...draft, record_date: "2026-02-30" },
        "2026-02",
        "2026-11-12",
      ),
    ).toBe("date");
    expect(
      validateDraft(
        { ...draft, record_date: "2026-10-12" },
        "2026-11",
        "2026-11-12",
      ),
    ).toBe("period");
  });
  test("only draft and returned reports can be edited", () => {
    expect(editable("draft")).toBe(true);
    expect(editable("returned")).toBe(true);
    for (const status of ["submitted", "in_review", "approved"] as const)
      expect(editable(status)).toBe(false);
  });
  test("duplicate detection excludes the edited record", () => {
    const record = { ...draft, id: "r1", amount: 12.5 } as WasteRecord;
    expect(isDuplicate(draft, [record])).toBe(true);
    expect(isDuplicate(draft, [record], "r1")).toBe(false);
  });
});
describe("organization templates and calculations", () => {
  test("provides all five expected organization catalogs and statuses", () => {
    const expected = [
      [6, "draft"],
      [3, "returned"],
      [6, "submitted"],
      [3, "draft"],
      [8, "approved"],
    ];
    demoUsers.forEach((u, i) => {
      const data = createDemoWorkspace(u, "2026-11");
      expect([data.catalog.length, data.report.status]).toEqual(expected[i]);
      expect(data.methods.length).toBe(7);
      expect(data.records.length).toBe(data.catalog.length * 5);
    });
  });
  test("oil liters convert to mass and are tracked separately", () => {
    const oil = w.catalog.find((c) => c.unit === "l")!;
    const record = {
      ...w.records[0],
      waste_type_id: oil.waste_type_id,
      amount: 10,
      unit: "l",
      disposal_method_id: oil.recommended_method_id,
    } as WasteRecord;
    expect(recordWeight(record, w.catalog)).toBeCloseTo(9.2);
    const sum = totals([record], w.catalog, w.methods);
    expect(sum.kg).toBeCloseTo(9.2);
    expect(sum.liters).toBe(10);
    expect(sum.co2).toBeCloseTo((9.2 / 1000) * (700.21 - 6.41));
  });
  test("landfill records produce zero actual savings", () => {
    const record = {
      ...w.records[0],
      amount: 1000,
      disposal_method_id: "demo-method-TBO",
    };
    expect(totals([record], w.catalog, w.methods).co2).toBe(0);
    record.disposal_method_id = "demo-method-DONATE";
    expect(totals([record], w.catalog, w.methods).co2).toBeCloseTo(700.21);
  });
  test("TPP tara and bones add up to total mass", () => {
    const data = createDemoWorkspace(demoUsers[3], "2026-11");
    const sum = totals(data.records, data.catalog, data.methods);
    expect(sum.tara).toBeGreaterThan(0);
    expect(sum.bones).toBeGreaterThan(0);
    expect(sum.kg).toBeCloseTo(sum.tara + sum.bones);
  });
});
describe("QR and speech parsing", () => {
  test("supports org links, tokens and ATU INN spelling", () => {
    expect(orgFromQr("https://example.com/?org=iskander")).toBe("iskander");
    expect(orgFromQr("atu-qr-atuinn")).toBe("atu_inn");
    expect(orgFromQr("exp://localhost:8081/--/?qr=atu-qr-canella")).toBe(
      "canella",
    );
    expect(orgFromQr("unrelated-qr")).toBeNull();
  });
  test("Russian and Kazakh number words fill the correct waste type", () => {
    const ru = parseVoice(
      "Очистки овощей двенадцать с половиной килограмм",
      w.catalog,
    );
    expect(ru.item?.waste_code).toBe("veg_peels");
    expect(ru.amount).toBe(12.5);
    const kz = parseVoice(
      "Көкөніс қабықтары он екі жарым килограмм",
      w.catalog,
    );
    expect(kz.item?.waste_code).toBe("veg_peels");
    expect(kz.amount).toBe(12.5);
    expect(parseVoice("Очистки овощей 12,5 кг", w.catalog).amount).toBe(12.5);
  });
  test("unknown phrases do not silently choose a waste type", () =>
    expect(parseVoice("непонятная фраза", w.catalog).item).toBeUndefined());
});

// Month names cannot rely on the device shipping Kazakh Intl data.
test("formats Kazakh dates without Intl locale support", () => {
  expect(monthLabel("2026-11", "kz")).toBe("қараша 2026");
  expect(dateLabel("2026-11-12", "kz")).toBe("12 қараша");
  expect(dateLabel("2026-11-12", "ru")).toBe("12 ноября");
});
