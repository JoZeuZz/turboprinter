import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../../i18n";

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("es");
});

afterEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("es");
});

describe("i18n init", () => {
  it("defaults to Spanish", () => {
    expect(i18n.language).toMatch(/^es/);
    expect(i18n.t("common.save")).toBe("Guardar");
  });

  it("switches to English", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.save")).toBe("Save");
  });
});
