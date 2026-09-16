/**
 * Trusted admin step: makes an email address the first commissioner of the configured league.
 *
 *   npm run bootstrap:commissioner -- --email you@example.com [--name "Display Name"] [--participant]
 *
 * Requires SUPABASE_SECRET_KEY (server-only). Sends a Supabase invite email if the user does not
 * exist yet; otherwise just upgrades the membership. Never run from the browser or CI logs.
 */
import { adminClient, arg, env, leagueAndEvent } from "./lib";

async function main() {
  const email = (arg("email") ?? "").toLowerCase();
  if (!email) {
    console.error("Usage: npm run bootstrap:commissioner -- --email you@example.com [--name Name] [--participant]");
    process.exit(1);
  }
  const name = arg("name");
  const makeParticipant = process.argv.includes("--participant");
  const admin = adminClient();
  const { league, event } = await leagueAndEvent(admin);

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (!userId) {
    const redirectTo = `${env("NEXT_PUBLIC_APP_ORIGIN", "http://localhost:3000")}/auth/confirm?next=/home`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: name ? { display_name: name } : undefined });
    if (error || !data.user) throw new Error(`invite failed: ${error?.message}`);
    userId = data.user.id;
    console.log(`Invited ${email} (check the inbox for the sign-in link).`);
  } else console.log(`User ${email} already exists.`);

  const { error } = await admin.from("memberships").upsert(
    { league_id: league.id, user_id: userId, role: makeParticipant ? "participant" : "member", is_commissioner: true, status: "active", invited_email: email },
    { onConflict: "league_id,user_id" },
  );
  if (error) throw error;
  console.log(`${email} is now an active commissioner of "${league.name}".`);

  if (makeParticipant) {
    const { error: e2 } = await admin.from("events").update({ participant_user_id: userId }).eq("id", event.id);
    if (e2) throw e2;
    console.log(`${email} is also the participant for "${event.name}".`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
