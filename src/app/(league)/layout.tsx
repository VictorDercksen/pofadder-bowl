import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { MemberViewToggle } from "@/components/shell/MemberViewToggle";
import { TeamLogo } from "@/components/ui/Marks";
import { SleeperTeamChip } from "@/components/sleeper/SleeperTeam";
import { TutorialTour } from "@/components/tour/TutorialTour";
import { describeRole, getLeagueContext, homeFor } from "@/lib/league";
import { teamName } from "@/lib/nfl";
import { sleeperAvatarUrl } from "@/lib/sleeper";

export const dynamic = "force-dynamic";

export default async function LeagueLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getLeagueContext();
  const roleLabel = describeRole(ctx);
  const toggle = ctx.canViewAsMember ? <MemberViewToggle viewing={ctx.viewingAsMember} /> : null;
  const sleeper = ctx.sleeper;
  const chip = sleeper ? <SleeperTeamChip teamName={sleeper.teamName} displayName={sleeper.displayName} username={sleeper.username} avatarUrl={sleeperAvatarUrl(sleeper.avatar)} /> : null;
  return (
    <AppShell
      role={ctx.role}
      base=""
      badge={
        <span className="pb-role-badge">
          <span className={`pb-demo ${ctx.viewingAsMember ? "on" : ""}`} title={ctx.viewingAsMember ? "You are seeing what a league member sees" : "Signed-in league view"}>
            {roleLabel}
          </span>
          {toggle}
        </span>
      }
      account={
        <>
          <Link href="/account" style={{ display: "flex", gap: 9, alignItems: "center", textDecoration: "none" }} aria-label="Account, kit and Sleeper team">
            <TeamLogo code={ctx.profile.kit_team} size={36} />
            {chip ?? <span className="name">{ctx.profile.display_name}</span>}
          </Link>
          {chip ? null : (
            <Link href={ctx.sleeperImported ? "/choose-sleeper" : "/account"} className="pb-sl-chip pb-sl-chip-empty" title="No Sleeper team confirmed yet">
              <span className="pb-sl-avatar pb-sl-avatar-fallback" style={{ width: 24, height: 24, fontSize: 11 }} aria-hidden="true">S</span>
              <span className="pb-sl-chip-text"><b>No Sleeper team</b><small>{ctx.sleeperImported ? "Confirm yours" : "Awaiting import"}</small></span>
            </Link>
          )}
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
            {chip ? <span className="pb-drawer-sleeper">{chip}</span> : null}
          </span>
        </Link>
      }
      drawerFooter={
        <>
          <span>2024 season. 2026 consequences. 23–25 September.</span>
          {toggle}
          <form action="/auth/signout" method="post">
            <button className="pb-text-action" type="submit">Sign out</button>
          </form>
        </>
      }
    >
      {ctx.viewingAsMember ? (
        <div className="pb-demo-banner pb-member-banner" role="status">
          <span>LEAGUE MEMBER VIEW · This is what the league sees. Your own screens (My trip, Proof locker, Commissioner) are hidden until you exit.</span>
          <MemberViewToggle viewing />
        </div>
      ) : null}
      {children}
      {/* First-run tour: auto-starts while the profile flag is null (strictly null: undefined means the column is not migrated yet). */}
      <TutorialTour role={ctx.role} isParticipant={ctx.isParticipant} autoStart={ctx.profile.tutorial_completed_at === null} home={homeFor(ctx)} />
    </AppShell>
  );
}
