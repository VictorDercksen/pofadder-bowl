import type { CSSProperties, ReactNode } from "react";
import { Shield, TeamLogo } from "@/components/ui/Marks";
import { kitFor, teamName } from "@/lib/nfl";

export type JerseyCardProps = {
  /** NFL franchise code, e.g. "nyg", "kc", "cin". */
  team: string;
  /** Nameplate text (upper-cased by CSS). */
  displayName: string;
  /** Kit number 0..99. */
  number: number | string;
  /** Bold heading on the torso. */
  heading: string;
  /** Message body (rendered as text, never HTML). */
  message: string;
  /** Timestamp / context line under the message. */
  timestamp: string;
  /** Reaction control or other footer content. */
  reaction?: ReactNode;
  /** Whether to show the captain patch. */
  captain?: boolean;
  label?: string;
};

/**
 * Jersey-shaped feed card: sleeves, collar, team badge, NFL shield, captain patch,
 * nameplate, big number, kit colours and a readable message on the torso.
 * Text content is rendered through React, so user content is always escaped.
 */
export function JerseyCard({ team, displayName, number, heading, message, timestamp, reaction, captain = true, label = "POFADDER BOWL · ’26" }: JerseyCardProps) {
  const kit = kitFor(team);
  const style = {
    "--kit": kit.body,
    "--kit-deep": kit.shadow,
    "--kit-accent": kit.accent,
    "--kit-number": kit.number ?? "#fff9ed",
    "--kit-text": kit.text ?? "#fff9ed",
  } as CSSProperties;
  const num = String(number).padStart(2, "0");
  const sleeveClass = kit.sleeveStyle === "bengal" ? "pb-sleeve bengal" : "pb-sleeve";
  return (
    <article className="pb-jersey" style={style} aria-label={`${teamName(team)} jersey card for ${displayName}`} tabIndex={0}>
      <div className="pb-jersey-body" aria-hidden="true" />
      <span className="pb-collar" aria-hidden="true" />
      <span className={sleeveClass} aria-hidden="true" />
      <span className={`${sleeveClass} right`} aria-hidden="true" />
      <span className="pb-sleeve-number" aria-hidden="true">{num}</span>
      <span className="pb-sleeve-number right" aria-hidden="true">{num}</span>
      <div className="pb-jersey-insignia">
        <TeamLogo code={team} size={28} />
        <Shield size={18} height={24} />
        {captain ? <span className="pb-captain" aria-label="Captain patch">C</span> : <span aria-hidden="true" style={{ width: 22 }} />}
      </div>
      <div className="pb-nameplate">{displayName}</div>
      <span className="pb-kit-number" aria-hidden="true">{num}</span>
      <div className="pb-jersey-message">
        <b>{heading}</b>
        <p>{message}</p>
        <span className="pb-jersey-time">{timestamp}</span>
        {reaction}
      </div>
      <span className="pb-jersey-label">{label}</span>
    </article>
  );
}
