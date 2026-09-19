import { redirect } from "next/navigation";
import { Shield } from "@/components/ui/Marks";
import { PasswordForm } from "@/components/account/AccountForms";
import { getLeagueContextRaw } from "@/lib/league";

export const metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

/**
 * Sign-on gate, step zero: every member sets a password before anything else. The email link
 * that brought them here is the last one they need; after this they sign in with the password.
 */
export default async function SetPasswordPage() {
  const ctx = await getLeagueContextRaw();
  if (ctx.hasPassword) redirect("/home");
  return (
    <div className="pb">
      <main className="pb-content" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="pb-title-row">
          <div>
            <div className="pb-kicker">WELCOME TO THE LEAGUE, {ctx.profile.display_name.toUpperCase()}</div>
            <h1>Set your password.</h1>
            <p>You are in. Pick a password now and you will never wait for another sign-in email: next time it is your league email and this password, from any device.</p>
          </div>
          <div className="pb-title-identity">
            <Shield size={49} height={62} />
          </div>
        </div>
        <div className="pb-panel">
          <h3>Password for {ctx.user.email ?? "your league email"}</h3>
          <p className="pb-small" style={{ marginTop: 6 }}>At least 8 characters. You can change it later under League access.</p>
          <PasswordForm afterSave="/home" label="Set password and continue" />
          <div className="pb-actions" style={{ marginTop: 18 }}>
            <form action="/auth/signout" method="post">
              <button className="pb-secondary" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
