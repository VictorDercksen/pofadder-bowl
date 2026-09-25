/**
 * Resolution of the prop board and the predictions opens only when a commissioner presses
 * "Resolve props and predictions" on Review (events.resolution_opened_at, written by
 * set_resolution_open). There is no timed opening. Until then settle_prop and resolve_predictions
 * refuse and other members' slips stay hidden; this helper only decides what the screens show.
 */
export function isResolutionOpen(openedAtIso: string | null | undefined): boolean {
  return typeof openedAtIso === "string" && Number.isFinite(Date.parse(openedAtIso));
}
