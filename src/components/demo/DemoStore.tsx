"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { toast } from "@/lib/toast-store";
import type { ToastTone } from "@/lib/toasts";
import { PRESS_QUESTIONS, PROPS } from "@/lib/programme";
import type { PropSide } from "@/lib/props";
import { formatRating } from "@/lib/rating";

/** In-memory demo state mirroring the approved mockup. Never persisted, never sent anywhere. */
export type DemoState = {
  points: number;
  sharing: boolean;
  online: boolean;
  checkin: string;
  attached: boolean;
  submitted: boolean;
  review: "Pending review" | "Approved" | "Flagged · needs more proof";
  reaction: boolean;
  comments: string[];
  prediction: { h: number; m: number; rating: number; finalScore: number; flags: number } | null;
  question: number;
  recorded: boolean;
  /** Prop sequence -> chosen side. */
  picks: Record<number, PropSide>;
  /** Feedback for the last action, shown as a snack by DemoProvider. */
  message: string;
  tone: ToastTone;
  /** Bumps on every action so the same message can be shown twice in a row. */
  seq: number;
};

export type DemoAction =
  | { type: "toggleSharing" }
  | { type: "toggleOnline" }
  | { type: "checkin" }
  | { type: "attach" }
  | { type: "draft" }
  | { type: "submit" }
  | { type: "approve" }
  | { type: "flag"; note: string }
  | { type: "react" }
  | { type: "comment"; text: string }
  | { type: "predict"; h: number; m: number; rating: number; finalScore: number; flags: number }
  | { type: "question" }
  | { type: "record" }
  | { type: "answer" }
  | { type: "pick"; sequence: number; side: PropSide }
  | { type: "notify"; text: string }
  | { type: "clear" };

export const DEMO_PROPS = PROPS;
export const DEMO_QUESTIONS = PRESS_QUESTIONS;

const initial: DemoState = {
  points: 35,
  sharing: true,
  online: true,
  checkin: "10:18",
  attached: false,
  submitted: false,
  review: "Pending review",
  reaction: false,
  comments: [],
  prediction: null,
  question: 0,
  recorded: false,
  picks: { 1: "over", 3: "yes", 5: "under" },
  message: "",
  tone: "ok",
  seq: 0,
};

/** Every action starts from an "ok" tone; branches that refuse something mark themselves "warn". */
function reducer(s: DemoState, a: DemoAction): DemoState {
  const next = step({ ...s, tone: "ok" }, a);
  return { ...next, seq: s.seq + 1 };
}

function step(s: DemoState, a: DemoAction): DemoState {
  switch (a.type) {
    case "clear":
      return { ...s, message: "" };
    case "notify":
      return { ...s, message: a.text };
    case "toggleSharing":
      return { ...s, sharing: !s.sharing, message: s.sharing ? "Sharing paused. Your last check-in remains timestamped." : "Sample location sharing enabled." };
    case "toggleOnline":
      return { ...s, online: !s.online, message: s.online ? "Offline state preview. New evidence stays in drafts." : "Connected example restored." };
    case "checkin":
      if (!s.sharing) return { ...s, tone: "warn", message: "Resume sharing before creating a check-in." };
      if (!s.online) return { ...s, tone: "warn", message: "Offline example: reconnect before sharing a fresh check-in." };
      return { ...s, checkin: "10:35", message: "Sample check-in updated to 10:35. No device location was requested." };
    case "attach":
      return { ...s, attached: true, message: "Sample interview clips attached. No real files were uploaded." };
    case "draft":
      return { ...s, message: "Draft saved in this preview. Nothing has been sent." };
    case "submit":
      if (!s.attached) return { ...s, tone: "warn", message: "Attach the sample clips before submitting." };
      if (!s.online) return { ...s, tone: "warn", message: "You’re in the offline example. Save a draft or reconnect in My trip." };
      return { ...s, submitted: true, points: s.review === "Approved" ? 35 : s.points, review: "Pending review", message: "Sample proof submitted. Open Commissioner to approve or flag it." };
    case "approve":
      if (s.review === "Approved") return { ...s, tone: "warn", message: "This challenge has already been approved. Points were not added twice." };
      return { ...s, review: "Approved", points: 45, submitted: true, message: "Approved. Game centre now shows 45 / 100 points." };
    case "flag":
      if (!a.note.trim()) return { ...s, tone: "warn", message: "Add a review note so Victor knows what needs fixing." };
      return { ...s, review: "Flagged · needs more proof", points: 35, submitted: true, message: "Flagged: " + a.note };
    case "react":
      return { ...s, reaction: !s.reaction };
    case "comment":
      if (!a.text.trim()) return { ...s, tone: "warn", message: "Write a comment first." };
      return { ...s, comments: [a.text.trim(), ...s.comments], message: "Demo comment added to the local feed." };
    case "predict":
      return { ...s, prediction: { h: a.h, m: a.m, rating: a.rating, finalScore: a.finalScore, flags: a.flags }, message: `Prediction saved for this preview: ${a.h} h ${a.m} m, ribs ${formatRating(a.rating)} / 10, ${a.finalScore} / 100, ${a.flags} flag(s). Editable until kickoff.` };
    case "question":
      return { ...s, question: (s.question + 1) % DEMO_QUESTIONS.length, recorded: false };
    case "record":
      return { ...s, recorded: true, message: "Sample answer attached. No camera or microphone was accessed." };
    case "answer":
      return { ...s, message: "Sample press-room answer submitted for review." };
    case "pick":
      return { ...s, picks: { ...s.picks, [a.sequence]: a.side }, message: `Demo pick saved: prop ${a.sequence}, ${a.side}. In the league game picks lock when the bus reaches Pofadder.` };
  }
}

const Ctx = createContext<{ state: DemoState; dispatch: (a: DemoAction) => void } | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  const { message, tone, seq } = state;
  // Action feedback goes to the shared snackbar (src/components/ui/Toaster.tsx), like the real league screens.
  useEffect(() => {
    if (seq > 0 && message) toast(message, tone);
  }, [message, tone, seq]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemo outside DemoProvider");
  return v;
}
