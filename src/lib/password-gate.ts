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

/** Where the gate sends an account without a password. */
export const SET_PASSWORD_PATH = "/set-password";
