import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { TeamLogo } from "@/components/ui/Marks";
import { getLeagueContext } from "@/lib/league";
import { teamName } from "@/lib/nfl";

export const dynamic = "force-dynamic";

export default async function LeagueLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getLeagueContext();
  const roleLabel = ctx.role === "admin" ? "ADMIN" : ctx.role === "commissioner" ? "COMMISSIONER" : ctx.role === "participant" ? "PARTICIPANT" : "LEAGUE MEMBER";
  return (
    <AppShell
      role={ctx.role}
      base=""
      badge={<span className="pb-demo" title="Signed-in league view">{roleLabel}</span>}
      account={
        <>
          <Link href="/account" style={{ display: "flex", gap: 9, alignItems: "center", textDecoration: "none" }} aria-label="Account and kit">
            <TeamLogo code={ctx.profile.kit_team} size={36} />
            <span className="name">{ctx.profile.display_name}</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="pb-text-action" type="submit">Sign out</button>
          </form>
        </>
      }
      drawerIdentity={
        <Link href="/account" className="pb-drawer-identity" style={{ textDecoration: "none", color: "inherit" }}>
          <TeamLogo code={ctx.profile.kit_team} size={52} />
          <span style={{ minWidth: 0 }}>
            <b>{ctx.profile.display_name}</b>
            <small>
              {ctx.profile.kit_team ? `${teamName(ctx.profile.kit_team)} · #${String(ctx.profile.kit_number).padStart(2, "0")}` : "No kit yet"} · {roleLabel}
            </small>
          </span>
        </Link>
      }
      drawerFooter={
        <>
          <span>2024 season. 2026 consequences. 23–25 September.</span>
          <form action="/auth/signout" method="post">
            <button className="pb-text-action" type="submit">Sign out</button>
          </form>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
