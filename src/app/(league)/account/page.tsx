import Link from "next/link";
import { TitleRow } from "@/components/ui/TitleRow";
import { JerseyCard } from "@/components/ui/JerseyCard";
import { KitForm, SleeperClaim } from "@/components/account/AccountForms";
import { getLeagueContext } from "@/lib/league";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "League access" };

export default async function AccountPage() {
  const ctx = await getLeagueContext();
  const { data: sleeperUsers } = await ctx.supabase.from("sleeper_league_users").select("*").eq("league_id", ctx.league.id).order("display_name");
  const linked = (sleeperUsers ?? []).find((u) => u.sleeper_user_id === ctx.membership.sleeper_user_id);
  const roleLabel = ctx.role === "commissioner" ? "Commissioner" : ctx.role === "participant" ? "Participant" : "League member";

  return (
    <>
      <TitleRow kicker="PRIVATE LEAGUE ACCESS" title="Your seat on the sideline." blurb="One league. Three roles. Everyone gets the right view." tag={roleLabel.toUpperCase()} team={ctx.profile.kit_team} />
      <div className="pb-split">
        <div>
          <div className="pb-panel">
            <h3>Account</h3>
            <p className="pb-small" style={{ marginTop: 8 }}>
              Signed in as <b>{ctx.user.email}</b> · role <b>{roleLabel}</b>
              {ctx.isCommissioner && ctx.isParticipant ? " (also the participant)" : ""} · member since {formatDateTime(ctx.membership.created_at, ctx.event.timezone)}
            </p>
            <p className="pb-small">Roles are set by a commissioner and enforced by the database. There is no role switch here.</p>
            <div className="pb-actions">
              <form action="/auth/signout" method="post">
                <button className="pb-secondary" type="submit">Sign out</button>
              </form>
              {ctx.isCommissioner ? <Link className="pb-secondary" href="/review/members">Members &amp; invites ↗</Link> : null}
            </div>
          </div>
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>Your NFL kit</h3>
            <p className="pb-small" style={{ marginTop: 6 }}>Pick the franchise and number your jersey cards wear on the sideline. Sample kits in the mockup were illustrative.</p>
            <KitForm displayName={ctx.profile.display_name} kitTeam={ctx.profile.kit_team} kitNumber={ctx.profile.kit_number} />
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
        <div>
          <div className="pb-kicker">PREVIEW</div>
          <div className="pb-jersey-feed" style={{ maxWidth: 300 }}>
            <JerseyCard team={ctx.profile.kit_team} displayName={ctx.profile.display_name} number={ctx.profile.kit_number} heading="This is your card" message="Every comment, check-in and call you make shows up wearing this kit." timestamp="Preview · not posted" captain={ctx.isCommissioner} />
          </div>
        </div>
      </div>
    </>
  );
}
