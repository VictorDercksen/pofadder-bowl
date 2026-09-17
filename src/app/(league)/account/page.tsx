import Link from "next/link";
import { TitleRow } from "@/components/ui/TitleRow";
import { KitForm, SleeperClaim } from "@/components/account/AccountForms";
import { TeamPicker } from "@/components/account/TeamPicker";
import { getLeagueContext } from "@/lib/league";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "League access" };

export default async function AccountPage() {
  const ctx = await getLeagueContext();
  const [{ data: sleeperUsers }, { data: claimed }] = await Promise.all([
    ctx.supabase.from("sleeper_league_users").select("*").eq("league_id", ctx.league.id).order("display_name"),
    ctx.supabase.rpc("claimed_kits"),
  ]);
  const linked = (sleeperUsers ?? []).find((u) => u.sleeper_user_id === ctx.membership.sleeper_user_id);
  const roleLabel = ctx.role === "admin" ? "Admin" : ctx.role === "commissioner" ? "Commissioner" : ctx.role === "participant" ? "Participant" : "League member";

  return (
    <>
      <TitleRow kicker="PRIVATE LEAGUE ACCESS" title="Your seat on the sideline." blurb="One league. Three roles. Everyone gets the right view." tag={roleLabel.toUpperCase()} team={ctx.profile.kit_team} />
      <div>
        <div>
          <div className="pb-panel">
            <h3>Account</h3>
            <p className="pb-small" style={{ marginTop: 8 }}>
              Signed in as <b>{ctx.user.email}</b> · role <b>{roleLabel}</b>
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
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>Your NFL kit</h3>
            <p className="pb-small" style={{ marginTop: 6 }}>Your nameplate and number. The franchise you claimed is yours for the league; taken kits are locked.</p>
            <KitForm displayName={ctx.profile.display_name} kitNumber={ctx.profile.kit_number} />
            <div style={{ marginTop: 18 }}>
              <TeamPicker claimed={(claimed ?? []).map((c) => ({ team: c.kit_team, by: c.display_name, mine: c.user_id === ctx.user.id }))} initialNumber={ctx.profile.kit_number} current={ctx.profile.kit_team} afterClaim="/account" />
            </div>
          </div>
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>Sleeper identity</h3>
            <p className="pb-small" style={{ marginTop: 6 }}>
              The league lives on Sleeper, but Sleeper’s API is read-only and has no sign-in for third-party apps. Link your Sleeper account here; a commissioner confirms it. Status:{" "}
              <b>{linked ? `${linked.display_name}${linked.team_name ? ` · ${linked.team_name}` : ""} · ${ctx.membership.sleeper_confirmed ? "confirmed" : "awaiting confirmation"}` : "not linked"}</b>
            </p>
            {(sleeperUsers ?? []).length === 0 ? <p className="pb-small">The commissioner has not imported the Sleeper league yet.</p> : <SleeperClaim users={(sleeperUsers ?? []).map((u) => ({ id: u.sleeper_user_id, label: `${u.display_name}${u.team_name ? ` · ${u.team_name}` : ""}` }))} current={ctx.membership.sleeper_user_id} confirmed={ctx.membership.sleeper_confirmed} />}
          </div>
        </div>
      </div>
    </>
  );
}
