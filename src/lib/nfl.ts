import teams from "@/data/nfl-teams.json";

export type TeamCode = string;

export type Team = { code: TeamCode; name: string; file: string; source: string };

export const NFL_TEAMS: Team[] = teams as Team[];
export const TEAM_BY_CODE: Record<string, Team> = Object.fromEntries(NFL_TEAMS.map((t) => [t.code, t]));

export function teamName(code: string): string {
  return TEAM_BY_CODE[code]?.name ?? "NFL team";
}

export function teamLogoSrc(code: string): string {
  return `/nfl/${TEAM_BY_CODE[code]?.file ?? "nfl.png"}`;
}

export const NFL_SHIELD_SRC = "/nfl/nfl.png";

/** Kit colours: body, shadow, accent, number/text. The three approved sample kits plus sensible palettes for the rest. */
export type Kit = { body: string; shadow: string; accent: string; number?: string; text?: string; sleeveStyle?: "stripes" | "bengal" };

export const KITS: Record<string, Kit> = {
  nyg: { body: "#073493", shadow: "#032666", accent: "#bd202d" },
  kc: { body: "#b70e24", shadow: "#8e0818", accent: "#ffb81c", number: "#fff8e7" },
  cin: { body: "#171a19", shadow: "#070807", accent: "#f15b24", number: "#fff9ec", sleeveStyle: "bengal" },
  buf: { body: "#00338d", shadow: "#00215c", accent: "#c60c30" },
  mia: { body: "#008e97", shadow: "#006269", accent: "#fc4c02" },
  ne: { body: "#002244", shadow: "#00132a", accent: "#c60c30" },
  nyj: { body: "#125740", shadow: "#0b3a2a", accent: "#ffffff" },
  bal: { body: "#241773", shadow: "#150d47", accent: "#9e7c0c" },
  cle: { body: "#311d00", shadow: "#1d1100", accent: "#ff3c00" },
  pit: { body: "#101820", shadow: "#05080c", accent: "#ffb612" },
  hou: { body: "#03202f", shadow: "#01131c", accent: "#a71930" },
  ind: { body: "#002c5f", shadow: "#001a3a", accent: "#ffffff" },
  jax: { body: "#006778", shadow: "#00434e", accent: "#9f792c" },
  ten: { body: "#0c2340", shadow: "#061527", accent: "#4b92db" },
  den: { body: "#fb4f14", shadow: "#c23a0b", accent: "#002244" },
  lv: { body: "#000000", shadow: "#000000", accent: "#a5acaf" },
  lac: { body: "#0080c6", shadow: "#005a8c", accent: "#ffc20e" },
  dal: { body: "#003594", shadow: "#002266", accent: "#869397" },
  phi: { body: "#004c54", shadow: "#002f35", accent: "#a5acaf" },
  wsh: { body: "#5a1414", shadow: "#3a0c0c", accent: "#ffb612" },
  chi: { body: "#0b162a", shadow: "#050b16", accent: "#c83803" },
  det: { body: "#0076b6", shadow: "#00527f", accent: "#b0b7bc" },
  gb: { body: "#203731", shadow: "#12211d", accent: "#ffb612" },
  min: { body: "#4f2683", shadow: "#33195a", accent: "#ffc62f" },
  atl: { body: "#a71930", shadow: "#72101f", accent: "#000000" },
  car: { body: "#0085ca", shadow: "#005c8c", accent: "#101820" },
  no: { body: "#101820", shadow: "#05080c", accent: "#d3bc8d" },
  tb: { body: "#d50a0a", shadow: "#960707", accent: "#ff7900" },
  ari: { body: "#97233f", shadow: "#68172b", accent: "#ffb612" },
  lar: { body: "#003594", shadow: "#002266", accent: "#ffa300" },
  sf: { body: "#aa0000", shadow: "#760000", accent: "#b3995d" },
  sea: { body: "#002244", shadow: "#00132a", accent: "#69be28" },
};

export function kitFor(code: string): Kit {
  return KITS[code] ?? KITS.nyg;
}

/** Codes shown in the franchise logo strip (order from the approved mockup). */
export const LOGO_STRIP: string[] = ["nyg", "kc", "cin", "phi", "gb", "buf", "sf", "dal", "bal", "det", "sea", "pit"];
