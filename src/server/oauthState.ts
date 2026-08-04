// CSRF state verification for OAuth callbacks (YouTube, TikTok). Both flows
// redirect back to this server with a `state` query param that must match
// one we issued, or an attacker can bind their own account as the active
// channel via a forged callback request (see advisor-plans/004).
//
// Single-instance, in-memory store: does not survive a restart and isn't
// shared across processes. Acceptable for this app's single-instance
// deployment; would need a shared store (e.g. Redis) if that ever changes.
import crypto from "crypto";

const oauthStates = new Map<string, number>();
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Issues a new one-time state token, valid for OAUTH_STATE_TTL_MS. */
export function issueOauthState(): string {
  const state = crypto.randomBytes(24).toString("hex");
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  return state;
}

/**
 * Validates and consumes a state token: true only if it was issued by
 * `issueOauthState`, hasn't been used before, and hasn't expired. Consumes
 * the token either way (one-time use), so a replayed value always fails.
 */
export function consumeOauthState(state: unknown): boolean {
  if (typeof state !== "string" || !oauthStates.has(state)) return false;
  const expiry = oauthStates.get(state)!;
  oauthStates.delete(state);
  return Date.now() <= expiry;
}
