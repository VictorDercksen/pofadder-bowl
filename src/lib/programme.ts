import programme from "@/data/league-programme.json";

/** Typed access to the supplied programme (data/league-programme.json). */
export type Programme = typeof programme;
export const PROGRAMME: Programme = programme;

export const STANDINGS = PROGRAMME.standings;
export const ROSTER = PROGRAMME.roster;
export const PENALTIES = PROGRAMME.penalties;
export const PRESS_QUESTIONS = PROGRAMME.pressQuestions;
export const BINGO_PHRASES = PROGRAMME.bingo;
export const TOWN_PINS = PROGRAMME.townPins;
export const CHALLENGES = PROGRAMME.challenges;
export const QUARTERS = PROGRAMME.quarters;
export const EVENT_META = PROGRAMME.event;
