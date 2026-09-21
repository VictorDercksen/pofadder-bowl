import "server-only";

/** Log the operation and error code, never row contents, credentials or personal data. */
export function checkQuery(error: { code?: string } | null | undefined, operation: string): void {
  if (!error) return;
  console.error("League data request failed", { operation, code: error.code ?? "unknown" });
  throw new Error(`Could not load ${operation}. Please retry.`);
}
