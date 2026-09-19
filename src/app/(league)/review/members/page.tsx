import Link from "next/link";
import { TitleRow } from "@/components/ui/TitleRow";
import { InviteForm, MemberRow, SleeperImport } from "@/components/review/MemberAdmin";
import { TourTestPanel } from "@/components/tour/TourButtons";
import { requireAdmin } from "@/lib/league";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Members & invites" };

export default async function MembersPage() {
  const ctx = await requireAdmin();
  const [{ data: memberships }, { data: profiles }, { data: sleeperUsers }] = await Promise.all([
    ctx.supabase.from("memberships").select("*").eq("league_id", ctx.league.id).order("created_at"),
    ctx.supabase.from("profiles").select("id, display_name, kit_team, kit_number"),
    ctx.supabase.from("sleeper_league_users").select("*").eq("league_id", ctx.league.id).order("display_name"),
  ]);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const participantId = ctx.event.participant_user_id;

  return (
    <>
      <TitleRow kicker="LEAGUE ADMIN" title="The roster." blurb="Invite-only. Roles live in the database and are enforced by RLS. Only admins can invite or change roles; commissioners referee." tag="ADMIN ONLY" identity={<span className="pb-official-patch">LEAGUE<br />OFFICIAL</span>} />
      <p className="pb-small" style={{ marginBottom: 12 }}>
        <Link href="/review" className="pb-text-action">← Back to review</Link>
      </p>
      <div className="pb-split">
        <div className="pb-panel" data-tour="admin-roster">
          <h3>Members</h3>
          <p className="pb-small">
            Participant for this event: <b>{participantId ? (byId.get(participantId)?.display_name ?? participantId) : "not set"}</b>. Only an active member with the participant role can be selected.
          </p>
          {(memberships ?? []).map((m) => (
            <MemberRow
              key={m.id}
              membership={{ user_id: m.user_id, role: m.role, is_commissioner: m.is_commissioner, is_admin: m.is_admin, status: m.status, invited_email: m.invited_email, sleeper_user_id: m.sleeper_user_id, sleeper_confirmed: m.sleeper_confirmed, created: formatDateTime(m.created_at, ctx.event.timezone) }}
              profile={byId.get(m.user_id) ?? null}
              isSelf={m.user_id === ctx.user.id}
              isEventParticipant={m.user_id === participantId}
              sleeperUsers={(sleeperUsers ?? []).map((u) => ({ id: u.sleeper_user_id, label: `${u.display_name}${u.team_name ? ` · ${u.team_name}` : ""}` }))}
            />
          ))}
        </div>
        <div>
          <div className="pb-panel">
            <h3>Invite a member</h3>
            <p className="pb-small">Sends a Supabase invite email. Public sign-up is disabled; only invited addresses can sign in.</p>
            <InviteForm />
          </div>
          <div className="pb-panel" style={{ marginTop: 18 }}>
            <h3>Sleeper league</h3>
            <p className="pb-small">
              League id <b>{ctx.league.sleeper_league_id ?? "not set"}</b>. Sleeper has no sign-in for third-party apps; this import lets members claim their Sleeper identity for you to confirm. {sleeperUsers?.length ?? 0} managers imported.
            </p>
            <SleeperImport />
            {(sleeperUsers ?? []).length ? (
              <ul className="pb-list-plain" style={{ marginTop: 10, fontSize: 12 }}>
                {(sleeperUsers ?? []).map((u) => (
                  <li key={u.sleeper_user_id} style={{ padding: "4px 0", borderBottom: "1px solid var(--pb-line)" }}>
                    {u.display_name}
                    {u.team_name ? ` · ${u.team_name}` : ""}
                    {u.is_owner ? " · Sleeper commissioner" : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="pb-panel" style={{ marginTop: 18 }} data-tour="tour-test">
            <h3>First-run tour</h3>
            <p className="pb-small">Every member walks through the tour once at first sign-in and can replay it from League access. Run any role’s version here; test runs never mark anything.</p>
            <TourTestPanel isParticipant={ctx.isParticipant} />
          </div>
        </div>
      </div>
    </>
  );
}
