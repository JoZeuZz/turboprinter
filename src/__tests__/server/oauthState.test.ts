import { afterEach, describe, expect, it, vi } from "vitest";
import {
  issueOauthState,
  consumeOauthState,
  OAUTH_STATE_TTL_MS,
} from "../../server/oauthState";

afterEach(() => vi.useRealTimers());

describe("issueOauthState / consumeOauthState", () => {
  it("accepts a freshly issued state exactly once", () => {
    const state = issueOauthState();
    expect(consumeOauthState(state)).toBe(true);
  });

  it("rejects a second use of the same state (one-time use)", () => {
    const state = issueOauthState();
    expect(consumeOauthState(state)).toBe(true);
    expect(consumeOauthState(state)).toBe(false);
  });

  it("rejects an unknown or garbage state string", () => {
    expect(consumeOauthState("not-a-real-state")).toBe(false);
    expect(consumeOauthState("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(consumeOauthState(undefined)).toBe(false);
    expect(consumeOauthState(null)).toBe(false);
    expect(consumeOauthState(42)).toBe(false);
    expect(consumeOauthState({})).toBe(false);
  });

  it("rejects a state past its TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T10:00:00Z"));
    const state = issueOauthState();
    vi.setSystemTime(new Date(Date.now() + OAUTH_STATE_TTL_MS + 1000));
    expect(consumeOauthState(state)).toBe(false);
  });

  it("accepts a state right at the TTL boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T10:00:00Z"));
    const state = issueOauthState();
    vi.setSystemTime(new Date(Date.now() + OAUTH_STATE_TTL_MS));
    expect(consumeOauthState(state)).toBe(true);
  });
});
