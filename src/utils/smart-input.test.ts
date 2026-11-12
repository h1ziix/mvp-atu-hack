import { describe, expect, test } from "bun:test";
import { parseRecognition, parseTranslation } from "./smart-input";
const catalog = [
  { waste_type_id: "peels", unit: "kg" as const },
  { waste_type_id: "oil", unit: "l" as const },
];
describe("validated AI suggestions", () => {
  test("accepts a catalog match without inventing weight", () =>
    expect(
      parseRecognition(
        {
          kind: "existing",
          waste_type_id: "peels",
          confidence: 0.9,
          amount: null,
        },
        catalog,
        "photo",
      ),
    ).toEqual({
      kind: "existing",
      waste_type_id: "peels",
      confidence: 0.9,
      amount_source: "none",
    }));
  test("accepts explicitly estimated weight and separately spoken amounts", () => {
    expect(
      parseRecognition(
        {
          kind: "existing",
          waste_type_id: "peels",
          confidence: 0.9,
          amount: 12.5,
          unit: "kg",
          amount_source: "estimate",
        },
        catalog,
        "photo",
      ).amount_source,
    ).toBe("estimate");
    expect(
      parseRecognition(
        {
          kind: "existing",
          waste_type_id: "oil",
          confidence: 0.9,
          amount: 12.5,
          unit: "l",
          amount_source: "spoken",
        },
        catalog,
        "voice",
      ).amount,
    ).toBe(12.5);
  });
  test("rejects hallucinated IDs, wrong units and out-of-range amounts", () => {
    for (const invalid of [
      { waste_type_id: "invented" },
      { unit: "l" },
      { amount: 2001 },
      { amount: 0 },
      { amount: "12" },
      { amount: NaN },
      { amount_source: "spoken" },
      { confidence: 1.2 },
    ])
      expect(() =>
        parseRecognition(
          {
            kind: "existing",
            waste_type_id: "peels",
            confidence: 0.9,
            amount: 12,
            unit: "kg",
            amount_source: "estimate",
            ...invalid,
          },
          catalog,
          "photo",
        ),
      ).toThrow();
  });
  test("new waste suggestions require both names and valid enums", () => {
    const suggestion = {
      name_ru: "Чайная заварка",
      name_kz: "Шай қалдығы",
      category: "organic",
      unit: "kg",
      recyclable: "yes",
    };
    expect(
      parseRecognition(
        { kind: "new", suggestion, confidence: 0.8 },
        catalog,
        "photo",
      ).suggestion?.name_kz,
    ).toBe("Шай қалдығы");
    expect(() =>
      parseRecognition(
        {
          kind: "new",
          suggestion: { ...suggestion, category: "invented" },
          confidence: 0.8,
        },
        catalog,
        "photo",
      ),
    ).toThrow();
    expect(() =>
      parseRecognition(
        {
          kind: "new",
          suggestion: { ...suggestion, name_kz: "" },
          confidence: 0.8,
        },
        catalog,
        "photo",
      ),
    ).toThrow();
  });
  test("unknown image cannot smuggle a weight into the form", () =>
    expect(
      parseRecognition(
        {
          kind: "unknown",
          confidence: 0.1,
          amount: 999,
          waste_type_id: "peels",
        },
        catalog,
        "photo",
      ),
    ).toEqual({ kind: "unknown", confidence: 0.1, amount_source: "none" }));
  test("translation rejects empty and oversized names", () => {
    expect(parseTranslation({ name_ru: "Чай", name_kz: "Шай" }).name_ru).toBe(
      "Чай",
    );
    for (const value of [
      { name_ru: "", name_kz: "Шай" },
      { name_ru: "x".repeat(121), name_kz: "Шай" },
      null,
    ])
      expect(() => parseTranslation(value)).toThrow();
  });
});
