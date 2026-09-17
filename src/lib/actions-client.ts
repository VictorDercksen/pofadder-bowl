/**
 * Client-side wrapper for server action calls. A dropped connection makes the action's
 * promise reject with "Failed to fetch"; unhandled, that throws inside a transition and
 * Next replaces the whole page with its error boundary. This turns it into an ordinary
 * failed result so the component can show a message and keep its state.
 */
export const NETWORK_FAILURE = "The request did not reach the league. Check your signal and try again.";

export async function callAction<T>(run: () => Promise<T>): Promise<T | { ok: false; message: string }> {
  try {
    return await run();
  } catch {
    return { ok: false, message: NETWORK_FAILURE };
  }
}
