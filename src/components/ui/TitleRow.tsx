import type { ReactNode } from "react";
import { TeamLogo } from "@/components/ui/Marks";

export function TitleRow({ kicker, title, blurb, tag, team = "nyg", identity }: { kicker: string; title: string; blurb?: ReactNode; tag?: string; team?: string | null; identity?: ReactNode }) {
  return (
    <div className="pb-title-row">
      <div>
        <div className="pb-kicker">{kicker}</div>
        <h1>{title}</h1>
        {blurb ? <p>{blurb}</p> : null}
      </div>
      <div className="pb-title-identity">
        {identity ?? <TeamLogo code={team} decorative size={49} />}
        {tag ? <span className="pb-tag">{tag}</span> : null}
      </div>
    </div>
  );
}

export function Status({ children, tone = "ok" }: { children: ReactNode; tone?: "ok" | "warn" | "error" }) {
  if (!children) return null;
  const border = tone === "error" ? "#b3392a" : tone === "warn" ? "var(--pb-orange)" : "var(--pb-green)";
  return (
    <div className="pb-status" role="status" aria-live="polite" style={{ borderLeftColor: border }}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="pb-drop" style={{ padding: "26px 18px" }}>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
