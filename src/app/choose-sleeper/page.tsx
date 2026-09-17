import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield } from "@/components/ui/Marks";
import { SleeperPicker } from "@/components/sleeper/SleeperPicker";
import { getLeagueContextRaw, homeFor } from "@/lib/league";
import { SET_PASSWORD_PATH } from "@/lib/password-gate";
import { sleeperAvatarUrl } from "@/lib/sleeper";

export const metadata = { title: "Confirm your Sleeper team" };
export const dynamic = "force-dynamic";

/** Sign-on step one: confirm which Sleeper manager you are. Step two is the franchise kit. */
export default async function ChooseSleeperPage() {
  const ctx = await getLeagueContextRaw();
  if (!ctx.hasPassword) redirect(SET_PASSWORD_PATH);
  const afterConfirm = ctx.profile.kit_team ? homeFor(ctx) : "/choose-team";
  if (ctx.membership.sleeper_user_id) redirect(afterConfirm);
  const [{ data: users }, { data: links }, { data: profiles }] = await Promise.all([
    ctx.supabase.from("sleeper_league_users").select("*").eq("league_id", ctx.league.id).order("team_name"),
    ctx.supabase.from("memberships").select("user_id, sleeper_user_id").eq("league_id", ctx.league.id).not("sleeper_user_id", "is", null),
    ctx.supabase.from("profiles").select("id, display_name"),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const takenBy = new Map((links ?? []).filter((l) => l.sleeper_user_id && l.user_id !== ctx.user.id).map((l) => [l.sleeper_user_id as string, names.get(l.user_id) ?? "another member"]));
  const choices = (users ?? []).map((u) => ({ id: u.sleeper_user_id, teamName: u.team_name, displayName: u.display_name, username: u.username, avatarUrl: sleeperAvatarUrl(u.avatar), takenBy: takenBy.get(u.sleeper_user_id) ?? null, isOwner: u.is_owner }));

  return (
    <div className="pb">
      <main className="pb-content" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="pb-title-row">
          <div>
            <div className="pb-kicker">WELCOME TO THE LEAGUE, {ctx.profile.display_name.toUpperCase()}</div>
            <h1>Confirm your Sleeper team.</h1>
            <p>Sleeper hosts the league but offers no sign-in, so tell us which manager you are. Your team name rides in the header from here on. Teams already confirmed by other members are locked.</p>
          </div>
          <div className="pb-title-identity">
            <Shield size={49} height={62} />
          </div>
        </div>
        {choices.length === 0 ? (
          <div className="pb-panel">
            <h3>Nothing to pick from yet</h3>
            <p className="pb-small" style={{ marginTop: 6 }}>The commissioner has not imported the Sleeper league. You can carry on and confirm your team later under League access.</p>
            <div className="pb-actions">
              <Link className="pb-primary" href={afterConfirm}>Continue</Link>
            </div>
          </div>
        ) : (
          <SleeperPicker choices={choices} current={null} afterConfirm={afterConfirm} />
        )}
      </main>
    </div>
  );
}
