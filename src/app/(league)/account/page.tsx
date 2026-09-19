import Link from "next/link";
import { TitleRow } from "@/components/ui/TitleRow";
import { KitForm, PasswordForm, SleeperClaim } from "@/components/account/AccountForms";
import { TeamPicker } from "@/components/account/TeamPicker";
import { SleeperTeamCard } from "@/components/sleeper/SleeperTeam";
import { TourReplayButton } from "@/components/tour/TourButtons";
import { getLeagueContext } from "@/lib/league";
import { sleeperAvatarUrl } from "@/lib/sleeper";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "League access" };

export default async function AccountPage() {
  const ctx = await getLeagueContext();
  const [{ data: sleeperUsers }, { data: claimed }, { data: links }] = await Promise.all([
    ctx.supabase.from("sleeper_league_users").select("*").eq("league_id", ctx.league.id).order("display_name"),
    ctx.supabase.rpc("claimed_kits"),
    ctx.supabase.from("memberships").select("user_id, sleeper_user_id").eq("league_id", ctx.league.id).not("sleeper_user_id", "is", null),
  ]);
  const takenBy = new Set((links ?? []).filter((l) => l.user_id !== ctx.user.id).map((l) => l.sleeper_user_id));
  const roleLabel = ctx.role === "admin" ? "Admin" : ctx.role === "commissioner" ? "Commissioner" : ctx.role === "participant" ? "Participant" : "League member";

  return (
    <>
      <TitleRow kicker="PRIVATE LEAGUE ACCESS" title="Your seat on the sideline." blurb="One league. Three roles. Everyone gets the right view." tag={roleLabel.toUpperCase()} team={ctx.profile.kit_team} />
      <div>
        <div>
          <div className="pb-panel" data-tour="account-panel">
            <h3>Account</h3>
            <p className="pb-small" style={{ marginTop: 8 }}>
              Signed in as <b>{ctx.user.email ?? "your league email"}</b> · role <b>{roleLabel}</b>
              {ctx.isAdmin ? " (admin also referees as commissioner)" : ""}{ctx.isParticipant && ctx.role !== "participant" ? " · also the participant" : ""} · member since {formatDateTime(ctx.membership.created_at, ctx.event.timezone)}
            </p>
            <p className="pb-small">Roles are set by a commissioner and enforced by the database. There is no role switch here.</p>
            <div className="pb-actions">
              <form action="/auth/signout" method="post">
                <button className="pb-secondary" type="submit">Sign out</button>
              </form>
              {ctx.isAdmin ? <Link className="pb-secondary" href="/review/members">League admin ↗</Link> : null}
            </div>
          </div>
          <div className="pb-panel" style={{ marginTop: 18 }} data-tour="tour-replay">
            <h3>The tour</h3>
            <p className="pb-small" style={{ marginTop: 6 }}>
              The guided walk through every screen your role can see.{" "}
              {ctx.profile.tutorial_completed_at ? `Last taken ${formatDateTime(ctx.profile.tutorial_completed_at, ctx.event.timezone)}.` : "Not taken yet."}
            </p>
            <div className="pb-actions">
              <TourReplayButton role={ctx.role} isParticipant={ctx.isParticipant} persist={ctx.profile.tutorial_completed_at === null} />
            </div>
          </div>
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>Password</h3>
            <p className="pb-small" style={{ marginTop: 6 }}>Email links expire and sometimes land in the wrong browser. Set a password once and sign in with it from any device; the email link keeps working as a backup.</p>
            <PasswordForm />
          </div>
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>Sleeper team</h3>
            <p className="pb-small" style={{ marginTop: 6 }}>
              The league lives on Sleeper, but Sleeper’s API is read-only and has no sign-in for third-party apps. Confirm which team is yours; it rides in the header next to your kit.
            </p>
            {ctx.sleeper ? (
              <div style={{ marginTop: 12 }}>
                <SleeperTeamCard teamName={ctx.sleeper.teamName} displayName={ctx.sleeper.displayName} username={ctx.sleeper.username} avatarUrl={sleeperAvatarUrl(ctx.sleeper.avatar)} confirmed={ctx.membership.sleeper_confirmed} />
              </div>
            ) : null}
            {(sleeperUsers ?? []).length === 0 ? <p className="pb-small" style={{ marginTop: 10 }}>The commissioner has not imported the Sleeper league yet.</p> : <SleeperClaim users={(sleeperUsers ?? []).map((u) => ({ id: u.sleeper_user_id, label: `${u.team_name ?? u.display_name} · @${u.username ?? u.display_name}`, taken: takenBy.has(u.sleeper_user_id) }))} current={ctx.membership.sleeper_user_id} />}
          </div>
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>Your NFL kit</h3>
            <p className="pb-small" style={{ marginTop: 6 }}>Your nameplate and number. The franchise you claimed is yours for the league; taken kits are locked.</p>
            <KitForm displayName={ctx.profile.display_name} kitNumber={ctx.profile.kit_number} />
            <div style={{ marginTop: 18 }}>
              <TeamPicker claimed={(claimed ?? []).map((c) => ({ team: c.kit_team, by: c.display_name, mine: c.user_id === ctx.user.id }))} initialNumber={ctx.profile.kit_number} current={ctx.profile.kit_team} afterClaim="/account" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
