import { describe, expect, it } from "vitest";
import es from "../../i18n/locales/es.json";
import en from "../../i18n/locales/en.json";

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" ? flatten(v as Record<string, unknown>, key) : [key];
  });
}

describe("locale key parity", () => {
  it("es and en have identical key sets", () => {
    const esKeys = flatten(es as Record<string, unknown>).sort();
    const enKeys = flatten(en as Record<string, unknown>).sort();
    expect(esKeys).toEqual(enKeys);
  });
});
