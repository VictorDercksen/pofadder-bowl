import Image from "next/image";
import { NFL_SHIELD_SRC, teamLogoSrc, teamName } from "@/lib/nfl";

/** NFL shield (design reference mark; unofficial fantasy league, no sponsorship implied). */
export function Shield({ className = "pb-nfl-mark", size = 35, height }: { className?: string; size?: number; height?: number }) {
  return <Image className={className} src={NFL_SHIELD_SRC} alt="NFL shield" width={size} height={height ?? Math.round(size * 1.257)} />;
}

/** Franchise badge. A member without a kit shows the league shield. */
export function TeamLogo({ code, decorative = false, className = "pb-team-logo", size = 36 }: { code: string | null | undefined; decorative?: boolean; className?: string; size?: number }) {
  const c = code ?? "nfl";
  return <Image className={className} src={teamLogoSrc(c)} alt={decorative ? "" : c === "nfl" ? "No kit chosen" : teamName(c)} width={size} height={size} />;
}

/** A member's insignia: badge + name, used wherever a member appears. */
export function MemberBadge({ code, name, number, size = 26, muted = false }: { code: string | null | undefined; name: string; number?: number | null; size?: number; muted?: boolean }) {
  return (
    <span className="pb-member" style={muted ? { color: "var(--pb-muted)" } : undefined}>
      <TeamLogo code={code} decorative size={size} className="pb-member-logo" />
      <span className="pb-member-name">{name}</span>
      {number != null ? <span className="pb-member-number">#{String(number).padStart(2, "0")}</span> : null}
    </span>
  );
}

export function LeaguePatch({ small = false }: { small?: boolean }) {
  return (
    <span className="pb-league-patch" aria-label="Pofadder Bowl 2026 league patch" style={small ? { minWidth: 30, fontSize: 14, padding: 4 } : undefined}>
      PB<small>2026</small>
    </span>
  );
}

export function PbShield() {
  return <span className="pb-shield" aria-hidden="true">PB</span>;
}
