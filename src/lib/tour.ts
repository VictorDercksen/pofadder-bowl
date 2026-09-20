/**
 * First-run tutorial: the guided tour every member walks through once, scoped to what their
 * role can see. Pure so the step lists can be unit tested; the overlay lives in
 * src/components/tour/TutorialTour.tsx and the completion flag in profiles.tutorial_completed_at.
 */
import type { Role } from "@/lib/roles";

/** Bump when the tour changes enough that everyone should see it again. */
export const TOUR_VERSION = 1;

export type TourStep = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  /** Screen the step lives on. The tour navigates there before it highlights anything. Null keeps the current screen. */
  href: string | null;
  /** `data-tour` anchors to spotlight; the first visible one wins. Empty means a centred card. */
  targets: string[];
  /** Open the phone navigation drawer for this step (the drawer holds the name, kit and Sleeper block and the programme). Desktop shows the same things in the header and sidebar, so it is left alone there. */
  menu?: boolean;
};

const step = (id: string, kicker: string, title: string, body: string, href: string | null = null, targets: string[] = [], menu = false): TourStep => ({ id, kicker, title, body, href, targets, ...(menu ? { menu } : {}) });

const welcome = (role: Role, participant: boolean): TourStep[] => [
  step(
    "welcome",
    "FIRST DOWN",
    participant ? "Welcome to your own away game." : "Welcome to the Pofadder Bowl.",
    participant
      ? "You finished last in the 2024 season. From 23 to 25 September you travel Malmesbury → Pofadder → Malmesbury, run 10 km and complete ten proof challenges while the league watches. This tour shows every screen you will need on the road. Two minutes."
      : `Victor finished last in the 2024 season. From 23 to 25 September he travels Malmesbury → Pofadder → Malmesbury, runs 10 km and completes ten proof challenges while the league watches. This tour walks through every screen ${role === "member" ? "you" : "your role"} can see. Two minutes.`,
  ),
  step("header", "YOUR COLOURS", "Your kit and your Sleeper team.", "Your name, your franchise badge with its number and your confirmed Sleeper team ride together, next to your role. Tap the block to open League access. On a desktop it sits top right; on a phone, at the top of the Menu.", null, ["drawer-identity", "header-account", "menu"], true),
  step("nav", "THE PROGRAMME", "Every screen has a number.", "The rundown lists the screens your role can open, in broadcast order. On a desktop it sits on the left; on a phone, Menu opens it. The number turns into a tumbling football while a screen loads.", null, ["drawer-nav", "nav", "menu"], true),
];

const participantBlock: TourStep[] = [
  step("my-trip", "SCREEN 02", "My trip. Your next play.", "The phone card is the trip at a glance: the quarter you are in, the next challenge, how many uploads are in draft, in review or flagged, and the return bus countdown. Your full game plan sits alongside, quarter by quarter.", "/my-trip", ["trip-phone"]),
  step("location", "CONSENT FIRST", "Share your position when you choose.", "Check-ins are off until you switch sharing on. Each check-in posts to the sideline and extends the route on the map. Pause sharing whenever you like; the league only ever sees what you share, and the map is not proof of the run.", "/my-trip", ["location-sharing"]),
  step("proof", "SCREEN 04", "The proof locker.", "Ten plays, one hundred points. Open a challenge, add photos or clips and submit. Unfinished drafts stay on this device until you send them, and large clips upload in chunks straight to private storage, so a weak signal does not cost you the file.", "/proof", ["proof-list"]),
  step("proof-flow", "THE WHISTLE", "Draft, submitted, approved.", "The commissioner reviews every submission. Approved puts the points on the board. Flagged sends it back with a note, and your fix goes in as a new version. Approved evidence is never overwritten.", "/proof", ["proof-flow"]),
];

const commissionerBlock: TourStep[] = [
  step("review", "SCREEN 05", "Under review.", "Submitted proof lands in this queue with its version number. Open one, watch the evidence and approve or flag it. Every decision is recorded with your name and shows on the sideline.", "/review", ["review-queue"]),
  step("review-tools", "THE SCOREBOARD SIDE", "Penalties, results, certificate.", "Flag a penalty, enter the official results (the league's predictions resolve against them) and issue the certificate that closes the event. Locked props wait for you to settle them on the prop board; the queue count shows here.", "/review", ["review-tools"]),
];

const adminBlock: TourStep[] = [
  step("members", "SCREEN 11", "The roster.", "Invite by email, set roles, pick the event participant and import the Sleeper league so members can confirm their teams. Roles live in the database and row-level security enforces them; the screens only decide what to show.", "/review/members", ["admin-roster"]),
  step("member-view", "SEE WHAT THEY SEE", "View as league member.", "This switch hides your own screens and shows exactly what a plain member gets. Use it to check a screen before the league does. It only ever removes capabilities; exit from the banner at the top. On a phone the switch sits at the foot of the Menu.", "/review/members", ["member-view", "menu"], true),
  step("tour-test", "THIS TOUR", "Test the tour for any role.", "Members see their tour once, on first sign-in, and can replay it from League access. This panel runs the member, participant, commissioner or admin version for you without marking anything.", "/review/members", ["tour-test"]),
];

const leagueBlock = (participant: boolean): TourStep[] => [
  step("game-centre", "SCREEN 01", "Game centre. The broadcast.", "The scoreboard shows approved points only, the quarter we are in and who is up against the consequences. Points appear the moment the commissioner approves proof.", "/game-centre", ["scoreboard"]),
  step("live", "LAST KNOWN POSITION", "The latest check-in.", "Time, age and accuracy of the last shared position. Stale means older than 30 minutes. It is a check-in, not live tracking; open the map for the whole route.", "/game-centre", ["live-map"]),
  step("next-drive", "NEXT DRIVE", "What is up next, and the bus.", "The next item on the itinerary with its points, plus the countdown to the return bus from KLK Garage. There is no second bus.", "/game-centre", ["next-drive"]),
  step("sideline", "THE LOCKER ROOM", "The sideline feed.", "Every check-in, submission and decision posts here as a jersey card in the author's kit. The card in the spotlight is yours: your franchise, your name, your number. It is a preview, nothing is posted. Add your own take, reply, and hit No sympathy on anyone else's. It updates live.", "/game-centre", ["sideline-preview", "sideline"]),
  step("map", "SCREEN 03", "Check-in map.", "The route line grows from Malmesbury to Pofadder and back, oldest to newest. The orange pin is the latest check-in; town pins are references only. The history alongside shows capture time, receive time and accuracy.", "/map", ["map-panel"]),
  ...(participant
    ? []
    : [step("your-pin", "YOUR PIN", "Put yourself on the map.", "Share my location drops one pin in your kit colours where you are, so the league sees who is watching from where. Press it again to move the pin, Remove to take it off. One pin, only when you press the button: no tracking, no history, no feed post.", "/map", ["member-location"])]),
  step(
    "league-pins",
    "WHERE THE LEAGUE IS",
    "Everyone who shared, in one list.",
    participant
      ? "League members can drop a pin of their own in their kit colours. They show here and on the map with place, time and age; a pin older than six hours fades. Pins only: your check-ins stay the one route on the map."
      : "Every shared pin with its place, time and age, yours marked. A pin older than six hours fades on the map. Pins only: Victor’s check-ins stay the one route.",
    "/map",
    ["league-pins"],
  ),
  step("map-fullscreen", "THE BIG SCREEN", "Fullscreen, with everything on.", "The expand button takes the map to the whole screen and frames everything at once: the route, every check-in, the itinerary venues and all the members’ pins, with a legend. Scroll or pinch to zoom, Fit everything to reframe, Escape or the collapse button to come back.", "/map", ["map-fullscreen"]),
  ...(participant
    ? []
    : [
        step("proof-view", "SCREEN 04", "The proof locker, read-only.", "Ten plays, one hundred points. Every play shows its status; open one to see the submitted photos, clips and exports and the commissioner’s call. Drafts stay private until Victor submits them, and nothing you open here changes the review.", "/proof", ["proof-list"]),
        step("proof-view-flow", "THE WHISTLE", "Submitted, approved, flagged.", "Submitted proof waits for the commissioner. Approved puts the points on the scoreboard the moment the call is made. Flagged sends it back for a new version, with the reason on record.", "/proof", ["proof-flow"]),
      ]),
  step("props", "SCREEN 06", "The prop board.", "Over/unders on the trip itself. Pick a side on each prop before it locks; the others' picks stay hidden until then. The commissioner settles each prop once it is decided, and the standings alongside update live.", "/props", ["prop-board"]),
  step("predictions", "SCREEN 07", "Call it before kickoff.", "Seven calls: the 10 km finish time, the rib rating, the final score, when the daylight sign photo lands, how many versions get flagged, the distance on the trace and the speech length. The slip locks at departure and stays hidden from the others until reveal. Closest call takes the points once the official results are in.", "/predictions", ["prediction-slip"]),
  step(
    "press",
    "SCREEN 08",
    "Face the press.",
    participant
      ? "Two press conferences, midday and sunset. Prompts open on a timer; answer each in text, with a photo or a clip. Answers go through review like any other proof."
      : "Two press conferences, midday and sunset. Prompts open on a timer and Victor answers on camera. Answers go through review before they count, then they appear here for everyone.",
    "/press",
    ["press-room"],
  ),
  step("recap", "SCREEN 09", "Final whistle.", "The recap builds itself from approved evidence, real check-ins and confirmed results. Once the commissioner issues the certificate, and the participant consents, a public version can be shared outside the league.", "/recap", ["certificate"]),
  step("account", "SCREEN 10", "League access.", "Your kit, your Sleeper team and a password so you never wait for an email link again. You can replay this tour from here at any time.", "/account", ["tour-replay"]),
  step("done", "FULL TIME", "That is the rundown.", participant ? "Pack the bag. Check in, get the proof, survive the group chat. No appeals." : "Kickoff is 23 September. Until then, predictions and the prop board are open. Enjoy the away game."),
];

/**
 * Steps for an effective role. Commissioners and admins who are also the event participant
 * get the participant screens too, because their menu shows them.
 */
export function tourStepsFor(role: Role, isParticipant: boolean = role === "participant"): TourStep[] {
  const participant = role === "participant" || isParticipant;
  const steps = [...welcome(role, participant)];
  if (role === "admin" || role === "commissioner") steps.push(...commissionerBlock);
  if (role === "admin") steps.push(...adminBlock);
  if (participant) steps.push(...participantBlock);
  steps.push(...leagueBlock(participant));
  return steps;
}

/** Id of the step a run is on (clamped to the last step), or null without a run. Lets screens react to a step, like the sideline's preview card. */
export function currentStepId(run: { role: Role; participant: boolean; step: number } | null): string | null {
  if (!run) return null;
  const steps = tourStepsFor(run.role, run.participant);
  return steps[Math.min(Math.max(0, run.step), steps.length - 1)]?.id ?? null;
}

export type Rect = { top: number; left: number; width: number; height: number };
/** `top` anchors the card's top edge, `bottom` its bottom edge (distance from the viewport bottom), so a card taller than the estimate grows away from the target. */
export type CardPlacement = { top?: number; bottom?: number; left: number; placement: "below" | "above" | "right" | "left" | "sheet" | "top" | "centre" };

/** Viewports narrower than this get the full-width card (phones and small tablets). */
export const SHEET_MAX_WIDTH = 700;

/**
 * Where the tour card goes relative to the spotlighted element. Below the target when it
 * fits, else above, else (on a wide screen) beside it, else a sheet at the bottom or the
 * top of the screen, whichever covers less of the target; a missing target centres the card
 * (a bottom sheet on phones). Phones always get the full-width card. `card.height` should
 * be the rendered height so the card never lands on the thing it describes.
 */
export function placeCard(target: Rect | null, card: { width: number; height: number }, viewport: { width: number; height: number }, gap = 14): CardPlacement {
  const phone = viewport.width < SHEET_MAX_WIDTH;
  const sheetLeft = Math.max(gap, (viewport.width - card.width) / 2);
  if (!target) return phone ? { bottom: gap, left: sheetLeft, placement: "sheet" } : { left: sheetLeft, placement: "centre" };
  const left = phone ? sheetLeft : Math.min(Math.max(gap, target.left + target.width / 2 - card.width / 2), viewport.width - card.width - gap);
  const targetBottom = target.top + target.height;
  const below = targetBottom + gap;
  if (below + card.height <= viewport.height - gap) return { top: below, left, placement: "below" };
  if (target.top - gap - card.height >= gap) return { bottom: viewport.height - (target.top - gap), left, placement: "above" };
  if (!phone) {
    const top = Math.max(gap, Math.min(target.top, viewport.height - card.height - gap));
    if (target.left + target.width + gap + card.width <= viewport.width - gap) return { top, left: target.left + target.width + gap, placement: "right" };
    if (target.left - gap - card.width >= gap) return { top, left: target.left - gap - card.width, placement: "left" };
  }
  // Neither side fits. A target taller than the free zone was scrolled so its head shows;
  // keep the card at the bottom. Otherwise take the sheet that hides less of the target.
  const room = viewport.height - card.height - gap * 2;
  if (target.height > room) return { bottom: gap, left: sheetLeft, placement: "sheet" };
  const coverBottom = Math.max(0, targetBottom - (viewport.height - card.height - gap));
  const coverTop = Math.max(0, gap + card.height - target.top);
  return coverTop < coverBottom ? { top: gap, left: sheetLeft, placement: "top" } : { bottom: gap, left: sheetLeft, placement: "sheet" };
}

/**
 * How far the window should scroll (positive is down) so the target sits in the free zone:
 * below the sticky header and, on phones, above the bottom sheet. A target that fits is
 * centred in the zone unless it is already inside it (on a wide screen the target and the
 * card below it are centred together when both fit); a taller one gets its head at the top
 * of the zone so the card only covers its tail. Zero means leave the page alone.
 */
export function scrollOffset(target: Rect, card: { height: number }, viewport: { width: number; height: number }, headerHeight: number, gap = 14): number {
  const phone = viewport.width < SHEET_MAX_WIDTH;
  const zoneTop = Math.max(0, headerHeight) + gap;
  const zoneBottom = phone ? viewport.height - card.height - gap * 2 : viewport.height - gap;
  const zone = zoneBottom - zoneTop;
  const targetBottom = target.top + target.height;
  if (target.height > zone) return Math.round(target.top - zoneTop);
  const inside = target.top >= zoneTop && targetBottom <= zoneBottom;
  const withCard = target.height + gap + card.height;
  if (!phone && withCard <= zone) {
    // Room for both: leave them when the card already fits below or above, else centre the pair.
    if (inside && (targetBottom + gap + card.height <= viewport.height - gap || target.top - gap - card.height >= gap)) return 0;
    return Math.round(target.top - (zoneTop + (zone - withCard) / 2));
  }
  if (inside) return 0;
  return Math.round(target.top - (zoneTop + (zone - target.height) / 2));
}
