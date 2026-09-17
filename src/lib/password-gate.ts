/**
 * Password gate. Pure so it can be unit tested.
 *
 * Every member must hold a password so sign-in stops depending on email links after the first
 * one. Two signals say whether the account has one:
 *  - `rpc`: `has_password` from the league_context RPC (reads auth.users; the truth). Undefined
 *    until migration 20260917000900 is applied, or on the legacy per-table path.
 *  - `metadata`: `user_metadata.has_password` from the verified JWT claims, written by the
 *    setPassword action so the gate clears even before the migration is pushed.
 * The RPC wins whenever it answers; the metadata flag only ever fills the gap.
 */
export function resolveHasPassword(rpc: unknown, metadata: unknown): boolean {
  if (typeof rpc === "boolean") return rpc;
  return metadataHasPassword(metadata);
}

/** True when the claims' user_metadata carries `has_password: true`. */
export function metadataHasPassword(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return (metadata as Record<string, unknown>).has_password === true;
}

/**
 * True when the verified JWT itself proves a password exists: the metadata flag, or an `amr`
 * entry saying this session was opened with a password (so one must exist).
 */
export function claimsHaveSetPassword(claims: { user_metadata?: unknown; amr?: unknown } | null | undefined): boolean {
  if (!claims) return false;
  if (metadataHasPassword(claims.user_metadata)) return true;
  const amr = claims.amr;
  if (!Array.isArray(amr)) return false;
  return amr.some((e) => e === "password" || (e && typeof e === "object" && (e as { method?: unknown }).method === "password"));
}

/** GoTrue refuses to set a password equal to the current one; that reply proves one exists. */
export function isSamePasswordError(error: { code?: string; message: string }): boolean {
  return error.code === "same_password" || /same password|different from the old/i.test(error.message);
}

/** GoTrue with "secure password change" on wants a recent sign-in before a password change. */
export function isReauthenticationError(error: { code?: string; message: string }): boolean {
  return error.code === "reauthentication_needed" || /reauthenticat/i.test(error.message);
}

/** Where the gate sends an account without a password. */
export const SET_PASSWORD_PATH = "/set-password";
