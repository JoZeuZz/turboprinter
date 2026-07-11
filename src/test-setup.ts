import "@testing-library/jest-dom";
import { beforeAll } from "vitest";
import i18n from "./i18n";

// jsdom reports navigator.language as "en-US", which the i18next browser
// language detector picks up ahead of the "es" fallback. Force Spanish so
// component tests see the app's actual default locale deterministically.
beforeAll(async () => {
  await i18n.changeLanguage("es");
});
