import { redirect } from "next/navigation";
import { Shield } from "@/components/ui/Marks";
import { TeamPicker } from "@/components/account/TeamPicker";
import { getLeagueContextRaw, homeFor } from "@/lib/league";
import { SET_PASSWORD_PATH } from "@/lib/password-gate";

export const metadata = { title: "Choose your franchise" };
export const dynamic = "force-dynamic";

/** First sign-in: claim a franchise. Teams already worn by another member are locked. */
export default async function ChooseTeamPage() {
  const ctx = await getLeagueContextRaw();
  if (!ctx.hasPassword) redirect(SET_PASSWORD_PATH);
  if (ctx.profile.kit_team) redirect(homeFor(ctx));
  const { data: claimed } = await ctx.supabase.rpc("claimed_kits");
  return (
    <div className="pb">
      <main className="pb-content" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="pb-title-row">
          <div>
            <div className="pb-kicker">WELCOME TO THE LEAGUE, {ctx.profile.display_name.toUpperCase()}</div>
            <h1>Pick your franchise.</h1>
            <p>Your team badge and kit colours travel with everything you do here: posts, props, predictions and calls. One franchise per member. Taken kits are locked.</p>
          </div>
          <div className="pb-title-identity">
            <Shield size={49} height={62} />
          </div>
        </div>
        <TeamPicker claimed={(claimed ?? []).map((c) => ({ team: c.kit_team, by: c.display_name, mine: c.user_id === ctx.user.id }))} initialNumber={ctx.profile.kit_number || 0} />
      </main>
    </div>
  );
}
