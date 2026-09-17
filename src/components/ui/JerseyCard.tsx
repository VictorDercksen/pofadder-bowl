import type { CSSProperties, ReactNode } from "react";
import { Shield, TeamLogo } from "@/components/ui/Marks";
import { kitFor, kitVars, teamName } from "@/lib/nfl";

/**
 * Layouts for a jersey post.
 * - `classic`: the original wide jersey with the message on the torso.
 * - `post`: full jersey frame with a cream forum post on the torso.
 * - `yoke`: compact jersey header (shoulders, collar, number) with the post hanging below.
 * - `avatar`: forum row, a small jersey on the left and the post on the right.
 * - `torso`: the classic jersey with the message re-weighted as the main block.
 */
export type JerseyVariant = "classic" | "post" | "yoke" | "avatar" | "torso";

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
  /** Timestamp / context line under the message (classic layout, or fallback when `time` is absent). */
  timestamp: string;
  /** Clock time of the post, shown in the byline of the forum layouts. */
  time?: string;
  /** Post kind label ("Check-in", "League comment"), shown as a pill in the forum layouts. */
  kind?: string;
  /** Reaction control or other footer content. */
  reaction?: ReactNode;
  /** Extra footer actions (reply link, permalink). */
  actions?: ReactNode;
  /** Whether to show the captain patch. */
  captain?: boolean;
  label?: string;
  variant?: JerseyVariant;
};

/** Jersey silhouette: cloth, mesh, shoulder yokes, cuffs, seams, hem, collar and sleeve numbers. */
function JerseyShape({ num, sleeveNumbers = true, hem = true }: { num: string; sleeveNumbers?: boolean; hem?: boolean }) {
  return (
    <div className="pb-jersey-shape" aria-hidden="true">
      <span className="pb-jersey-cloth" />
      <span className="pb-jersey-mesh" />
      <span className="pb-jersey-shoulder left" />
      <span className="pb-jersey-shoulder right" />
      <span className="pb-jersey-cuff left" />
      <span className="pb-jersey-cuff right" />
      {hem ? (
        <>
          <span className="pb-jersey-seam left" />
          <span className="pb-jersey-seam right" />
          <span className="pb-jersey-hem" />
        </>
      ) : null}
      <span className="pb-jersey-collar" />
      {sleeveNumbers ? (
        <>
          <span className="pb-jersey-sleeve-num left">{num}</span>
          <span className="pb-jersey-sleeve-num right">{num}</span>
        </>
      ) : null}
    </div>
  );
}

function Insignia({ team, captain }: { team: string | null | undefined; captain: boolean }) {
  return (
    <div className="pb-jersey-insignia">
      <Shield size={18} height={24} />
      {captain ? <span className="pb-captain" aria-label="Captain patch">C</span> : null}
      <TeamLogo code={team} size={40} />
    </div>
  );
}

/** Forum-style post body: byline, heading, message and footer. */
function Post({ team, displayName, num, heading, message, time, kind, timestamp, reaction, actions }: { team: string | null | undefined; displayName: string; num: string; heading: string; message: string; time?: string; kind?: string; timestamp: string; reaction?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="pb-post">
      <div className="pb-post-byline">
        <TeamLogo code={team} size={22} decorative className="pb-post-avatar" />
        <span className="pb-post-author">{displayName}</span>
        <span className="pb-post-number">#{num}</span>
        {kind ? <span className="pb-post-kind">{kind}</span> : null}
        <span className="pb-post-time">{time ?? timestamp}</span>
      </div>
      <b className="pb-post-heading">{heading}</b>
      <p className="pb-post-body">{message}</p>
      <div className="pb-post-foot">
        {reaction}
        {actions}
      </div>
    </div>
  );
}

/**
 * Wide, jersey-shaped feed post: sloped shoulders, set-in sleeves with cuff stripes and
 * sleeve numbers, V collar with NFL shield, chest number, nameplate, team badge, captain
 * patch, mesh texture, stitched seams and hem. The torso carries the message.
 * All text is rendered through React, so user content is always escaped.
 */
export function JerseyCard({ team, displayName, number, heading, message, timestamp, time, kind, reaction, actions, captain = true, label = "POFADDER BOWL · ’26", variant = "classic" }: JerseyCardProps) {
  const kit = kitFor(team);
  const style = kitVars(team) as CSSProperties;
  const num = String(number).padStart(2, "0");
  const sleeveClass = kit.sleeveStyle === "bengal" ? "bengal" : "";
  const ariaLabel = `${team ? teamName(team) : "League"} jersey post by ${displayName}`;
  const post = <Post team={team} displayName={displayName} num={num} heading={heading} message={message} time={time} kind={kind} timestamp={timestamp} reaction={reaction} actions={actions} />;

  if (variant === "avatar") {
    return (
      <article className={`pb-jersey-row ${sleeveClass}`} style={style} aria-label={ariaLabel} tabIndex={0}>
        <div className="pb-jersey pb-jersey--mini" style={style} aria-hidden="true">
          <JerseyShape num={num} sleeveNumbers={false} />
          <div className="pb-jersey-content">
            <span className="pb-kit-number">{num}</span>
            <span className="pb-nameplate">{displayName}</span>
          </div>
        </div>
        {post}
      </article>
    );
  }

  if (variant === "yoke") {
    return (
      <article className={`pb-jersey pb-jersey--yoke ${sleeveClass}`} style={style} aria-label={ariaLabel} tabIndex={0}>
        <div className="pb-jersey-top">
          <JerseyShape num={num} hem={false} />
          <div className="pb-jersey-content">
            <div className="pb-jersey-chest">
              <div className="pb-jersey-chest-left">
                <span className="pb-nameplate">{displayName}</span>
                <span className="pb-kit-number" aria-hidden="true">{num}</span>
              </div>
              <Insignia team={team} captain={captain} />
            </div>
          </div>
        </div>
        {post}
      </article>
    );
  }

  if (variant === "post") {
    return (
      <article className={`pb-jersey pb-jersey--post ${sleeveClass}`} style={style} aria-label={ariaLabel} tabIndex={0}>
        <JerseyShape num={num} />
        <div className="pb-jersey-content">
          <div className="pb-jersey-chest">
            <div className="pb-jersey-chest-left">
              <span className="pb-nameplate">{displayName}</span>
              <span className="pb-kit-number" aria-hidden="true">{num}</span>
            </div>
            <Insignia team={team} captain={captain} />
          </div>
          {post}
          <span className="pb-jersey-label">{label}</span>
        </div>
      </article>
    );
  }

  const torso = variant === "torso";
  return (
    <article className={`pb-jersey ${torso ? "pb-jersey--torso" : ""} ${sleeveClass}`} style={style} aria-label={ariaLabel} tabIndex={0}>
      <JerseyShape num={num} />
      <div className="pb-jersey-content">
        <div className="pb-jersey-chest">
          <div className="pb-jersey-chest-left">
            <span className="pb-nameplate">{displayName}</span>
            <span className="pb-kit-number" aria-hidden="true">{num}</span>
          </div>
          <Insignia team={team} captain={captain} />
        </div>
        <div className="pb-jersey-message">
          {torso && kind ? <span className="pb-jersey-kind">{kind}{time ? ` · ${time}` : ""}</span> : null}
          <b>{heading}</b>
          <p>{message}</p>
          <div className="pb-jersey-foot">
            <span className="pb-jersey-time">{torso ? `${displayName} · #${num}` : timestamp}</span>
            <span className="pb-jersey-foot-actions">
              {reaction}
              {torso ? actions : null}
            </span>
          </div>
        </div>
        <span className="pb-jersey-label">{label}</span>
      </div>
    </article>
  );
}
