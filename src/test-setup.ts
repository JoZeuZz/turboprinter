import "@testing-library/jest-dom";
import { beforeAll, vi } from "vitest";
import i18n from "./i18n";

// jsdom does not implement ResizeObserver. Components that measure their own
// box (VideoPreview) observe on mount, so every render throws without this.
// The stub is inert: no callback is ever invoked, so components fall back to
// their default dimensions, which is what the existing assertions expect.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// jsdom reports navigator.language as "en-US", which the i18next browser
// language detector picks up ahead of the "es" fallback. Force Spanish so
// component tests see the app's actual default locale deterministically.
beforeAll(async () => {
  await i18n.changeLanguage("es");
});
