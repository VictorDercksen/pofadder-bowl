import Link from "next/link";
import type { ReactNode } from "react";
import { Shield, TeamLogo } from "@/components/ui/Marks";
import { LOGO_STRIP } from "@/lib/nfl";
import { NavLinks, type NavItem } from "@/components/shell/NavLinks";
import { NavDrawer } from "@/components/shell/NavDrawer";

export type ShellRole = "participant" | "member" | "commissioner" | "demo" | "guest";

export function navFor(role: ShellRole, base: string): NavItem[] {
  const all: NavItem[] = [
    { n: "01", label: "Game centre", href: `${base}/game-centre` },
    { n: "02", label: "My trip", href: `${base}/my-trip`, roles: ["participant", "commissioner", "demo"] },
    { n: "03", label: "Check-in map", href: `${base}/map` },
    { n: "04", label: "Proof locker", href: `${base}/proof`, roles: ["participant", "commissioner", "demo"] },
    { n: "05", label: "Commissioner", href: `${base}/review`, roles: ["commissioner", "demo"] },
    { n: "06", label: "Punishment Bingo", href: `${base}/bingo` },
    { n: "07", label: "Predictions", href: `${base}/predictions` },
    { n: "08", label: "Press room", href: `${base}/press` },
    { n: "09", label: "Final whistle", href: `${base}/recap` },
    { n: "10", label: "League access", href: role === "demo" ? `${base}/access` : `${base}/account` },
  ];
  return all.filter((item) => !item.roles || item.roles.includes(role));
}

export function AppShell({
  role,
  base,
  account,
  badge,
  drawerIdentity,
  drawerFooter,
  children,
  footerNote,
}: {
  role: ShellRole;
  base: string;
  account?: ReactNode;
  badge?: ReactNode;
  /** Member insignia block shown at the top of the mobile drawer. */
  drawerIdentity?: ReactNode;
  drawerFooter?: ReactNode;
  children: ReactNode;
  footerNote?: string;
}) {
  const items = navFor(role, base);
  return (
    <div className="pb">
      <header className="pb-top">
        <NavDrawer items={items} identity={drawerIdentity ?? <div className="pb-brand" style={{ color: "#f4f0e6" }}>POFADDER BOWL ’26</div>} footer={drawerFooter} />
        <Link href={role === "demo" ? "/demo" : "/game-centre"} className="pb-brand" style={{ textDecoration: "none" }}>
          <Shield />
          <div>
            POFADDER BOWL ’26<small>SHOW US YOUR TD’S · GAME CENTRE</small>
          </div>
        </Link>
        {badge}
        <div className="pb-account">{account}</div>
      </header>
      <div className="pb-badge-strip">
        <div className="pb-badge-strip-label">
          THE LEAGUE LOCKER ROOM<small>32 FRANCHISES. ONE PUNISHMENT.</small>
        </div>
        <div className="pb-badge-teams" aria-hidden="true">
          {LOGO_STRIP.map((code) => (
            <TeamLogo key={code} code={code} decorative size={31} className="" />
          ))}
        </div>
      </div>
      <div className="pb-shell">
        <nav className="pb-sidebar" aria-label="Game Centre screens">
          <div className="pb-side-label">THE PROGRAMME</div>
          <NavLinks items={items} />
          <div className="pb-sidebar-note">
            2024 season.
            <br />
            2026 consequences.
            <br />
            <br />
            23–25 SEPTEMBER
          </div>
        </nav>
        <main className="pb-content" id="main">
          {children}
        </main>
      </div>
      <footer className="pb-bottom">
        <span>POFADDER BOWL 2026 · UNOFFICIAL FANTASY LEAGUE</span>
        <span>{footerNote ?? "Team marks: ESPN · Not affiliated with or sponsored by the NFL"}</span>
      </footer>
    </div>
  );
}
