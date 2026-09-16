import Image from "next/image";
import { NFL_SHIELD_SRC, teamLogoSrc, teamName } from "@/lib/nfl";

/** NFL shield (design reference mark; unofficial fantasy league, no sponsorship implied). */
export function Shield({ className = "pb-nfl-mark", size = 35, height }: { className?: string; size?: number; height?: number }) {
  return <Image className={className} src={NFL_SHIELD_SRC} alt="NFL shield" width={size} height={height ?? Math.round(size * 1.257)} />;
}

export function TeamLogo({ code, decorative = false, className = "pb-team-logo", size = 36 }: { code: string; decorative?: boolean; className?: string; size?: number }) {
  return <Image className={className} src={teamLogoSrc(code)} alt={decorative ? "" : teamName(code)} width={size} height={size} />;
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
