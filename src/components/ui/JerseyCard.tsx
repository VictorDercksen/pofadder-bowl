import type { CSSProperties, ReactNode } from "react";
import { Shield, TeamLogo } from "@/components/ui/Marks";
import { kitFor, kitVars, teamName } from "@/lib/nfl";

export type JerseyCardProps = {
  /** NFL franchise code, e.g. "nyg", "kc", "cin"; null shows the league kit. */
  team: string | null | undefined;
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
 * Wide, jersey-shaped feed post: sloped shoulders, set-in sleeves with cuff stripes and
 * sleeve numbers, V collar with NFL shield, chest number, nameplate, team badge, captain
 * patch, mesh texture, stitched seams and hem. The torso carries the message.
 * All text is rendered through React, so user content is always escaped.
 */
export function JerseyCard({ team, displayName, number, heading, message, timestamp, reaction, captain = true, label = "POFADDER BOWL · ’26" }: JerseyCardProps) {
  const kit = kitFor(team);
  const style = kitVars(team) as CSSProperties;
  const num = String(number).padStart(2, "0");
  const sleeveClass = kit.sleeveStyle === "bengal" ? "bengal" : "";
  return (
    <article className={`pb-jersey ${sleeveClass}`} style={style} aria-label={`${team ? teamName(team) : "League"} jersey post by ${displayName}`} tabIndex={0}>
      <div className="pb-jersey-shape" aria-hidden="true">
        <span className="pb-jersey-cloth" />
        <span className="pb-jersey-mesh" />
        <span className="pb-jersey-shoulder left" />
        <span className="pb-jersey-shoulder right" />
        <span className="pb-jersey-cuff left" />
        <span className="pb-jersey-cuff right" />
        <span className="pb-jersey-seam left" />
        <span className="pb-jersey-seam right" />
        <span className="pb-jersey-hem" />
        <span className="pb-jersey-collar" />
        <span className="pb-jersey-sleeve-num left">{num}</span>
        <span className="pb-jersey-sleeve-num right">{num}</span>
      </div>
      <div className="pb-jersey-content">
        <div className="pb-jersey-chest">
          <div className="pb-jersey-chest-left">
            <span className="pb-nameplate">{displayName}</span>
            <span className="pb-kit-number" aria-hidden="true">{num}</span>
          </div>
          <div className="pb-jersey-insignia">
            <Shield size={18} height={24} />
            {captain ? <span className="pb-captain" aria-label="Captain patch">C</span> : null}
            <TeamLogo code={team} size={40} />
          </div>
        </div>
        <div className="pb-jersey-message">
          <b>{heading}</b>
          <p>{message}</p>
          <div className="pb-jersey-foot">
            <span className="pb-jersey-time">{timestamp}</span>
            {reaction}
          </div>
        </div>
        <span className="pb-jersey-label">{label}</span>
      </div>
    </article>
  );
}
