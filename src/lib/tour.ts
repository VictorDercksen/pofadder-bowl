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
};

const step = (id: string, kicker: string, title: string, body: string, href: string | null = null, targets: string[] = []): TourStep => ({ id, kicker, title, body, href, targets });

const welcome = (role: Role, participant: boolean): TourStep[] => [
  step(
    "welcome",
    "FIRST DOWN",
    participant ? "Welcome to your own away game." : "Welcome to the Pofadder Bowl.",
    participant
      ? "You finished last in the 2024 season. From 23 to 25 September you travel Malmesbury → Pofadder → Malmesbury, run 14 km and complete ten proof challenges while the league watches. This tour shows every screen you will need on the road. Two minutes."
      : `Victor finished last in the 2024 season. From 23 to 25 September he travels Malmesbury → Pofadder → Malmesbury, runs 14 km and completes ten proof challenges while the league watches. This tour walks through every screen ${role === "member" ? "you" : "your role"} can see. Two minutes.`,
  ),
  step("header", "YOUR COLOURS", "Your kit and your Sleeper team.", "Your franchise badge and your confirmed Sleeper team ride up here, next to your role. Tap them to open League access. On a phone they sit at the top of the Menu.", null, ["header-account", "menu"]),
  step("nav", "THE PROGRAMME", "Every screen has a number.", "The rundown on the left lists the screens your role can open, in broadcast order. On a phone, Menu opens the same list. The number turns into a tumbling football while a screen loads.", null, ["nav", "menu"]),
];

const participantBlock: TourStep[] = [
  step("my-trip", "SCREEN 02", "My trip. Your next play.", "The phone card is the trip at a glance: the quarter you are in, the next challenge, how many uploads are in draft, in review or flagged, and the return bus countdown. Your full game plan sits alongside, quarter by quarter.", "/my-trip", ["trip-phone"]),
  step("location", "CONSENT FIRST", "Share your position when you choose.", "Check-ins are off until you switch sharing on. Each check-in posts to the sideline and extends the route on the map. Pause sharing whenever you like; the league only ever sees what you share, and the map is not proof of the run.", "/my-trip", ["location-sharing"]),
  step("proof", "SCREEN 04", "The proof locker.", "Ten plays, one hundred points. Open a challenge, add photos or clips and submit. Unfinished drafts stay on this device until you send them, and large clips upload in chunks straight to private storage, so a weak signal does not cost you the file.", "/proof", ["proof-list"]),
  step("proof-flow", "THE WHISTLE", "Draft, submitted, approved.", "The commissioner reviews every submission. Approved puts the points on the board. Flagged sends it back with a note, and your fix goes in as a new version. Approved evidence is never overwritten.", "/proof", ["proof-flow"]),
];

const commissionerBlock: TourStep[] = [
  step("review", "SCREEN 05", "Under review.", "Submitted proof lands in this queue with its version number. Open one, watch the evidence and approve or flag it. Every decision is recorded with your name and shows on the sideline.", "/review", ["review-queue"]),
  step("review-tools", "THE SCOREBOARD SIDE", "Penalties, results, certificate.", "Flag a penalty, enter the official results (the league's predictions resolve against them) and issue the certificate that closes the event. Bingo incidents proposed by members wait for your confirmation on the bingo screen.", "/review", ["review-tools"]),
];

const adminBlock: TourStep[] = [
  step("members", "SCREEN 11", "The roster.", "Invite by email, set roles, pick the event participant and import the Sleeper league so members can confirm their teams. Roles live in the database and row-level security enforces them; the screens only decide what to show.", "/review/members", ["admin-roster"]),
  step("member-view", "SEE WHAT THEY SEE", "View as league member.", "This switch hides your own screens and shows exactly what a plain member gets. Use it to check a screen before the league does. It only ever removes capabilities; exit from the banner at the top.", "/review/members", ["member-view", "menu"]),
  step("tour-test", "THIS TOUR", "Test the tour for any role.", "Members see their tour once, on first sign-in, and can replay it from League access. This panel runs the member, participant, commissioner or admin version for you without marking anything.", "/review/members", ["tour-test"]),
];

const leagueBlock = (participant: boolean): TourStep[] => [
  step("game-centre", "SCREEN 01", "Game centre. The broadcast.", "The scoreboard shows approved points only, the quarter we are in and who is up against the consequences. Points appear the moment the commissioner approves proof.", "/game-centre", ["scoreboard"]),
  step("live", "LAST KNOWN POSITION", "The latest check-in.", "Time, age and accuracy of the last shared position. Stale means older than 30 minutes. It is a check-in, not live tracking; open the map for the whole route.", "/game-centre", ["live-map"]),
  step("next-drive", "NEXT DRIVE", "What is up next, and the bus.", "The next item on the itinerary with its points, plus the countdown to the return bus from KLK Garage. There is no second bus.", "/game-centre", ["next-drive"]),
  step("sideline", "THE LOCKER ROOM", "The sideline feed.", "Every check-in, submission and decision posts here as a jersey card in the author's kit. Add your own take, reply, and hit No sympathy on anyone else's. It updates live.", "/game-centre", ["sideline"]),
  step("map", "SCREEN 03", "Check-in map.", "The route line grows from Malmesbury to Pofadder and back, oldest to newest. The orange pin is the latest check-in; town pins are references only. The history alongside shows capture time, receive time and accuracy.", "/map", ["map-panel"]),
  step("bingo", "SCREEN 06", "Punishment Bingo.", "Your own shuffled card, fixed for the event. Tap a square to propose an incident. Once the commissioner confirms it, everyone holding that square gets it marked. Rows, columns, diagonals and full house win; first to complete a line takes it.", "/bingo", ["bingo-card"]),
  step("predictions", "SCREEN 07", "Call it before kickoff.", "Predict the 14 km time, the meal rating and the complaint count. The slip locks at departure and stays hidden from the others until reveal. Closest call takes the points once the official results are in.", "/predictions", ["prediction-slip"]),
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
  step("done", "FULL TIME", "That is the rundown.", participant ? "Pack the bag. Check in, get the proof, survive the group chat. No appeals." : "Kickoff is 23 September. Until then, predictions are open and the bingo cards are dealt. Enjoy the away game."),
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

export type Rect = { top: number; left: number; width: number; height: number };
/** `top` anchors the card's top edge, `bottom` its bottom edge (distance from the viewport bottom), so a card taller than the estimate grows away from the target. */
export type CardPlacement = { top?: number; bottom?: number; left: number; placement: "below" | "above" | "sheet" | "centre" };

/**
 * Where the tour card goes relative to the spotlighted element. Below the target when it
 * fits, else above, else a bottom sheet; a missing target centres the card. Narrow
 * viewports always get the bottom sheet so the card never covers the whole phone. The
 * height is an estimate: placements that could overflow anchor by the bottom edge instead.
 */
export function placeCard(target: Rect | null, card: { width: number; height: number }, viewport: { width: number; height: number }, gap = 14): CardPlacement {
  const sheetLeft = Math.max(gap, (viewport.width - card.width) / 2);
  if (viewport.width < 700) return { bottom: gap, left: sheetLeft, placement: "sheet" };
  if (!target) return { left: sheetLeft, placement: "centre" };
  const left = Math.min(Math.max(gap, target.left + target.width / 2 - card.width / 2), viewport.width - card.width - gap);
  const below = target.top + target.height + gap;
  if (below + card.height <= viewport.height - gap) return { top: below, left, placement: "below" };
  if (target.top - gap - card.height >= gap) return { bottom: viewport.height - (target.top - gap), left, placement: "above" };
  return { bottom: gap, left: sheetLeft, placement: "sheet" };
}
