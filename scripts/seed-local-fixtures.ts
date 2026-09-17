/**
 * LOCAL/DEMO FIXTURES ONLY. Creates four password accounts against the local Supabase stack:
 * participant, commissioner, member and an outsider with no membership. Never run against production.
 *
 *   npm run seed:local-fixtures
 */
import { adminClient, ensureUser, env, leagueAndEvent } from "./lib";

export const FIXTURE_PASSWORD = "pofadder-local-2026";
export const FIXTURES = {
  participant: { email: "victor@local.test", name: "Victor Dercksen" }, // also league admin
  commissioner: { email: "commish@local.test", name: "The Commish" },
  member: { email: "member@local.test", name: "League Member" },
  outsider: { email: "outsider@local.test", name: "Outsider" },
};

export async function seedFixtures() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  if (!/127\.0\.0\.1|localhost/.test(url) && !process.env.ALLOW_REMOTE_FIXTURES) {
    throw new Error("Refusing to seed fixtures against a non-local Supabase URL. Set ALLOW_REMOTE_FIXTURES=1 to override.");
  }
  const admin = adminClient();
  const { league, event } = await leagueAndEvent(admin);
  const ids: Record<keyof typeof FIXTURES, string> = { participant: "", commissioner: "", member: "", outsider: "" };
  for (const key of Object.keys(FIXTURES) as (keyof typeof FIXTURES)[]) {
    ids[key] = await ensureUser(admin, FIXTURES[key].email, FIXTURE_PASSWORD, FIXTURES[key].name);
    await admin.from("profiles").update({ display_name: FIXTURES[key].name, kit_team: key === "participant" ? "nyg" : key === "commissioner" ? "kc" : "cin", kit_number: key === "participant" ? 26 : key === "commissioner" ? 1 : 9 }).eq("id", ids[key]);
  }
  await admin.from("memberships").delete().eq("league_id", league.id).eq("user_id", ids.outsider);
  const rows = [
    { league_id: league.id, user_id: ids.participant, role: "participant" as const, is_commissioner: false, is_admin: true, status: "active" as const, invited_email: FIXTURES.participant.email },
    { league_id: league.id, user_id: ids.commissioner, role: "member" as const, is_commissioner: true, is_admin: false, status: "active" as const, invited_email: FIXTURES.commissioner.email },
    { league_id: league.id, user_id: ids.member, role: "member" as const, is_commissioner: false, is_admin: false, status: "active" as const, invited_email: FIXTURES.member.email },
  ];
  const { error } = await admin.from("memberships").upsert(rows, { onConflict: "league_id,user_id" });
  if (error) throw error;
  const { error: e2 } = await admin.from("events").update({ participant_user_id: ids.participant }).eq("id", event.id);
  if (e2) throw e2;
  await admin.from("location_settings").upsert({ event_id: event.id, user_id: ids.participant, sharing_enabled: true, auto_update: false }, { onConflict: "event_id,user_id" });
  return { ids, league, event };
}

if (process.argv[1] && /seed-local-fixtures/.test(process.argv[1])) {
  seedFixtures()
    .then(({ ids }) => {
      console.log("Local fixtures ready. Password for all:", FIXTURE_PASSWORD);
      for (const [k, v] of Object.entries(FIXTURES)) console.log(`  ${k.padEnd(12)} ${v.email}  ${ids[k as keyof typeof FIXTURES]}`);
      console.log("Sign in locally with the password form at /login?local=1 or use Mailpit at http://127.0.0.1:54324 for magic links.");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
