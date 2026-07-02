import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { LanguageSelector } from "../../components/settings/LanguageSelector";

afterEach(async () => {
  await i18n.changeLanguage("es");
  vi.restoreAllMocks();
});

describe("LanguageSelector", () => {
  it("changes the language when a new option is selected", async () => {
    const spy = vi.spyOn(i18n, "changeLanguage");
    const user = userEvent.setup();
    render(<LanguageSelector />);
    // The select shows the current language label; switch to English.
    await user.selectOptions(screen.getByRole("combobox"), "en");
    expect(spy).toHaveBeenCalledWith("en");
  });
});
