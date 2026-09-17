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
  /** Post heading; omit for plain comments, which read as a forum reply. */
  heading?: string;
  /** Message body (rendered as text, never HTML). */
  message: string;
  /** Clock time of the post, right-aligned in the byline. */
  time: string;
  /** Post kind label ("Check-in", "League comment"), shown as a pill in the byline. */
  kind?: string;
  /** Reaction control in the post footer. */
  reaction?: ReactNode;
  /** Extra footer actions (reply link, permalink). */
  actions?: ReactNode;
  /** Whether to show the captain patch. */
  captain?: boolean;
  label?: string;
};

/**
 * Wide, jersey-shaped feed post: sloped shoulders, set-in sleeves with cuff stripes and
 * sleeve numbers, V collar with NFL shield, nameplate, chest number, team badge, captain
 * patch, mesh texture, stitched seams and hem. The torso carries a forum post: byline,
 * heading, message at reading size and a footer with the reaction and actions.
 * All text is rendered through React, so user content is always escaped.
 */
export function JerseyCard({ team, displayName, number, heading, message, time, kind, reaction, actions, captain = true, label = "POFADDER BOWL · ’26" }: JerseyCardProps) {
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
        <div className="pb-post">
          <div className="pb-post-byline">
            <TeamLogo code={team} size={22} decorative className="pb-post-avatar" />
            <span className="pb-post-author">{displayName}</span>
            <span className="pb-post-number">#{num}</span>
            {kind ? <span className="pb-post-kind">{kind}</span> : null}
            <span className="pb-post-time">{time}</span>
          </div>
          {heading ? <b className="pb-post-heading">{heading}</b> : null}
          <p className="pb-post-body">{message}</p>
          {reaction || actions ? (
            <div className="pb-post-foot">
              {reaction}
              {actions}
            </div>
          ) : null}
        </div>
        <span className="pb-jersey-label">{label}</span>
      </div>
    </article>
  );
}
