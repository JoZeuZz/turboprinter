import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../../i18n";

beforeEach(async () => {
  localStorage.clear();
});

afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("es");
});

describe("i18n init", () => {
  it("translates to Spanish after switching language to es", async () => {
    await i18n.changeLanguage("es");
    expect(i18n.t("common.save")).toBe("Guardar");
  });

  it("translates to English after switching language to en", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.save")).toBe("Save");
  });

  it("has es as fallback language and supports both es and en", () => {
    expect(i18n.options.fallbackLng).toContain("es");
    expect(i18n.options.supportedLngs).toEqual(
      expect.arrayContaining(["es", "en"])
    );
  });
});
