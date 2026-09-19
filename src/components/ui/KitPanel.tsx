import type { CSSProperties, ReactNode } from "react";
import { TeamLogo } from "@/components/ui/Marks";
import { kitVars } from "@/lib/nfl";

/**
 * A block themed with a member's kit: team-colour yoke stripe, badge watermark and
 * accent rule. Used for bingo cards, prediction slips, press prompts and proof panels.
 */
export function KitPanel({ team, name, kicker, children, className = "", dark = false, tour }: { team: string | null | undefined; name?: string; kicker?: string; children: ReactNode; className?: string; dark?: boolean; /** Anchor for the first-run tour spotlight. */ tour?: string }) {
  return (
    <section className={`pb-kit-panel ${dark ? "dark" : ""} ${className}`.trim()} style={kitVars(team) as CSSProperties} data-tour={tour}>
      <div className="pb-kit-yoke" aria-hidden="true" />
      <div className="pb-kit-head">
        <TeamLogo code={team} size={34} decorative />
        <div>
          {kicker ? <div className="pb-kicker" style={{ marginBottom: 2 }}>{kicker}</div> : null}
          {name ? <div className="pb-kit-name">{name}</div> : null}
        </div>
      </div>
      <TeamLogo code={team} size={160} decorative className="pb-kit-watermark" />
      <div className="pb-kit-body">{children}</div>
    </section>
  );
}
