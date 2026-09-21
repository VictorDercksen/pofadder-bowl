import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { MemberViewToggle } from "@/components/shell/MemberViewToggle";
import { TeamLogo } from "@/components/ui/Marks";
import { IconButton } from "@/components/ui/IconButton";
import { DrawerIdentity } from "@/components/shell/DrawerIdentity";
import { SleeperTeamChip } from "@/components/sleeper/SleeperTeam";
import { TutorialTour } from "@/components/tour/TutorialTour";
import { describeRole, getLeagueContext, homeFor } from "@/lib/league";
import { loadClaimedTeams } from "@/lib/roster";
import { sleeperAvatarUrl } from "@/lib/sleeper";
import { testingResetEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LeagueLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getLeagueContext();
  const teams = await loadClaimedTeams(ctx);
  const testing = testingResetEnabled();
  const roleLabel = describeRole(ctx);
  const toggle = ctx.canViewAsMember ? <MemberViewToggle viewing={ctx.viewingAsMember} /> : null;
  const sleeper = ctx.sleeper;
  const chip = sleeper ? <SleeperTeamChip teamName={sleeper.teamName} displayName={sleeper.displayName} username={sleeper.username} avatarUrl={sleeperAvatarUrl(sleeper.avatar)} /> : null;
  return (
    <AppShell
      role={ctx.role}
      base=""
      teams={teams}
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
            <IconButton icon="signout" label="Sign out" type="submit" small />
          </form>
        </>
      }
      drawerIdentity={
        <DrawerIdentity
          href="/account"
          name={ctx.profile.display_name}
          kitTeam={ctx.profile.kit_team}
          kitNumber={ctx.profile.kit_number}
          roleLabel={roleLabel}
          sleeper={sleeper ? { teamName: sleeper.teamName, displayName: sleeper.displayName, avatarUrl: sleeperAvatarUrl(sleeper.avatar) } : null}
        />
      }
      drawerFooter={
        <>
          <span>2024 season. 2026 consequences. 23–25 September.</span>
          <span className="pb-icon-row">
            {ctx.canViewAsMember ? <MemberViewToggle viewing={ctx.viewingAsMember} tone="gold" /> : null}
            <form action="/auth/signout" method="post">
              <IconButton icon="signout" label="Sign out" type="submit" tone="gold" />
            </form>
          </span>
        </>
      }
    >
      {testing ? (
        <div className="pb-demo-banner pb-testing-banner" role="status">
          <span>TESTING · Dummy data only. Admins can reset the event from Review → Members.</span>
        </div>
      ) : null}
      {ctx.viewingAsMember ? (
        <div className="pb-demo-banner pb-member-banner" role="status">
          <span>LEAGUE MEMBER VIEW · This is what the league sees. Your own screens (My trip, Commissioner) are hidden and the proof locker is read-only until you exit.</span>
          <MemberViewToggle viewing tone="orange" />
        </div>
      ) : null}
      {children}
      {/* First-run tour: auto-starts while the profile flag is null (strictly null: undefined means the column is not migrated yet). */}
      <TutorialTour role={ctx.role} isParticipant={ctx.isParticipant} autoStart={ctx.profile.tutorial_completed_at === null} home={homeFor(ctx)} />
    </AppShell>
  );
}
