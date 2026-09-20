/**
 * Integration tests against the LOCAL Supabase stack: RLS isolation across four accounts,
 * scoring idempotency, prediction locking, prop picks and settlement, and the storage policies.
 *
 *   npx supabase start && npm run db:reset && npm run test:integration
 */
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { env } from "./lib";
import { seedFixtures, FIXTURES, FIXTURE_PASSWORD } from "./seed-local-fixtures";

type Client = SupabaseClient<Database>;
const results: { name: string; ok: boolean; detail?: string }[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, detail: (err as Error).message });
    console.log(`  ✗ ${name}\n      ${(err as Error).message}`);
  }
}

async function signIn(email: string): Promise<Client> {
  const c = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: FIXTURE_PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
}

async function main() {
  console.log("Seeding local fixtures…");
  const { ids, event, league } = await seedFixtures();
  const admin = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), { auth: { persistSession: false } });
  // Fresh state for repeatable runs.
  await admin.from("evidence_submissions").delete().eq("event_id", event.id);
  await admin.from("prop_picks").delete().eq("event_id", event.id);
  await admin.from("predictions").delete().eq("event_id", event.id);
  await admin.from("prediction_awards").delete().eq("event_id", event.id);
  await admin.from("checkins").delete().eq("event_id", event.id);
  await admin.from("activity_posts").delete().eq("event_id", event.id);
  await admin.from("events").update({ prediction_lock_at: "2026-09-23T17:15:00Z", prediction_reveal_at: "2026-09-23T17:15:00Z" }).eq("id", event.id);

  const participant = await signIn(FIXTURES.participant.email);
  const commissioner = await signIn(FIXTURES.commissioner.email);
  const member = await signIn(FIXTURES.member.email);
  const outsider = await signIn(FIXTURES.outsider.email);
  const anon = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));

  console.log("\nRole and membership isolation");
  await test("anonymous cannot read events or challenges", async () => {
    const { data } = await anon.from("events").select("id");
    assert.equal(data?.length ?? 0, 0);
    const { data: c } = await anon.from("challenges").select("id");
    assert.equal(c?.length ?? 0, 0);
  });
  await test("non-member sees no league data", async () => {
    for (const table of ["events", "challenges", "activity_posts", "checkins", "member_locations", "evidence_submissions", "memberships"] as const) {
      const { data } = await outsider.from(table).select("*");
      assert.equal(data?.length ?? 0, 0, `${table} leaked to outsider`);
    }
    const { data: role } = await outsider.rpc("my_event_role", { p_event: event.id });
    assert.equal(role, null);
  });
  await test("member sees challenges and roles resolve correctly", async () => {
    const { data } = await member.from("challenges").select("id");
    assert.equal(data?.length, 10);
    assert.equal((await member.rpc("my_event_role", { p_event: event.id })).data, "member");
    assert.equal((await participant.rpc("my_event_role", { p_event: event.id })).data, "admin");
    assert.equal((await commissioner.rpc("my_event_role", { p_event: event.id })).data, "commissioner");
  });
  await test("member cannot self-promote membership", async () => {
    const { data, error } = await member.from("memberships").update({ is_commissioner: true }).eq("user_id", ids.member).select();
    assert.ok(error || (data?.length ?? 0) === 0, "update should be denied or affect no rows");
    const { data: m } = await admin.from("memberships").select("is_commissioner").eq("user_id", ids.member).single();
    assert.equal(m?.is_commissioner, false);
  });
  await test("only admins administer roles; commissioners cannot", async () => {
    const { error } = await member.rpc("set_member_role", { p_league: league.id, p_user: ids.member, p_role: "member", p_is_commissioner: true, p_status: "active" });
    assert.ok(error, "set_member_role should fail for member");
    const { error: ce } = await commissioner.rpc("set_member_role", { p_league: league.id, p_user: ids.member, p_role: "member", p_is_commissioner: true, p_status: "active" });
    assert.ok(ce && /admin/.test(ce.message), "commissioner must not change roles");
    const { error: cp } = await commissioner.rpc("set_event_participant", { p_event: event.id, p_user: ids.member });
    assert.ok(cp, "commissioner must not set the participant");
    const { error: ae } = await participant.rpc("set_member_role", { p_league: league.id, p_user: ids.member, p_role: "member", p_is_commissioner: false, p_status: "active" });
    assert.ok(!ae, ae?.message);
    const { error: self } = await participant.rpc("set_member_role", { p_league: league.id, p_user: ids.participant, p_role: "participant", p_is_commissioner: true, p_status: "active", p_is_admin: false });
    assert.ok(self && /own admin/.test(self.message), "admin cannot remove own admin access");
    const { error: rules } = await commissioner.from("prediction_rules").update({ run_points: 99 }).eq("event_id", event.id);
    const { data: r } = await admin.from("prediction_rules").select("run_points").eq("event_id", event.id).single();
    assert.ok(rules || r?.run_points === 10, "commissioner must not edit prediction rules");
  });
  await test("member cannot create evidence submissions", async () => {
    const { data: ch } = await member.from("challenges").select("id").eq("sequence", 1).single();
    const { error } = await member.rpc("create_submission", { p_event: event.id, p_challenge: ch!.id, p_caption: "nope" });
    assert.ok(error, "member should not create submissions");
  });
  await test("member cannot record check-ins; participant needs consent", async () => {
    const args = { p_event: event.id, p_latitude: -29.1286, p_longitude: 19.3947, p_captured_at: new Date().toISOString(), p_client_id: "client-test-0001", p_accuracy_m: 12 };
    const { error } = await member.rpc("record_checkin", args);
    assert.ok(error);
    await admin.from("location_settings").update({ sharing_enabled: false }).eq("user_id", ids.participant);
    const { error: e2 } = await participant.rpc("record_checkin", args);
    assert.ok(e2 && /paused/.test(e2.message));
    await admin.from("location_settings").update({ sharing_enabled: true }).eq("user_id", ids.participant);
    const { data, error: e3 } = await participant.rpc("record_checkin", args);
    assert.ok(!e3 && data?.id, e3?.message);
    assert.equal(data?.place_label, "In Pofadder", "check-in must be labelled from the settlements gazetteer");
    const { data: post } = await member.from("activity_posts").select("body").eq("ref_checkin_id", data!.id).single();
    assert.ok(post?.body.startsWith("In Pofadder"), `feed post should carry the place label, got ${post?.body}`);
    const { data: far } = await participant.rpc("pb_place_label", { p_latitude: -33.3708, p_longitude: 18.72714 });
    assert.equal(far, "10 km N of Malmesbury");
    const { data: gazetteer } = await member.from("settlements").select("geonames_id").limit(1);
    assert.equal(gazetteer?.length, 1, "members read the settlements table");
    const { data: again } = await participant.rpc("record_checkin", args);
    assert.equal(again?.id, data?.id, "duplicate client id must not create a second check-in");
    const { data: visible } = await member.from("checkins").select("id").eq("event_id", event.id);
    assert.equal(visible?.length, 1);
    const { data: removed } = await participant.rpc("remove_checkins", { p_event: event.id });
    assert.equal(removed, 1);
    const { data: after } = await member.from("checkins").select("id").eq("event_id", event.id);
    assert.equal(after?.length, 0, "removed check-ins must not be visible");
  });

  await test("members share one upserted pin; outsiders cannot; pins are readable and removable", async () => {
    await admin.from("member_locations").delete().eq("event_id", event.id);
    const { data: first, error } = await member.rpc("share_member_location", { p_event: event.id, p_latitude: -33.3708, p_longitude: 18.72714, p_captured_at: new Date().toISOString(), p_accuracy_m: 15 });
    assert.ok(!error && first?.user_id === ids.member, error?.message);
    assert.equal(first?.place_label, "10 km N of Malmesbury", "member pin must be labelled from the gazetteer");
    const { data: moved } = await member.rpc("share_member_location", { p_event: event.id, p_latitude: -29.1286, p_longitude: 19.3947, p_captured_at: new Date().toISOString() });
    assert.equal(moved?.place_label, "In Pofadder");
    const { data: rows } = await participant.rpc("event_member_locations", { p_event: event.id });
    assert.equal(rows?.length, 1, "one pin per member, upserted");
    assert.equal(rows?.[0].display_name, FIXTURES.member.name);
    assert.equal(rows?.[0].kit_team, "cin", "the reader joins the profile for the kit");
    const { error: outsiderErr } = await outsider.rpc("share_member_location", { p_event: event.id, p_latitude: -33, p_longitude: 18, p_captured_at: new Date().toISOString() });
    assert.ok(outsiderErr, "outsider must not share a pin");
    const { data: outsiderRows } = await outsider.rpc("event_member_locations", { p_event: event.id });
    assert.equal(outsiderRows?.length ?? 0, 0, "outsider must not read pins");
    const { error: directWrite } = await member.from("member_locations").update({ latitude: 0 }).eq("user_id", ids.member);
    const { data: unchanged } = await member.from("member_locations").select("latitude").eq("user_id", ids.member).single();
    assert.ok(directWrite || unchanged?.latitude !== 0, "direct table writes must be refused");
    const { data: cleared } = await member.rpc("clear_member_location", { p_event: event.id });
    assert.equal(cleared, true);
    const { data: after } = await member.rpc("event_member_locations", { p_event: event.id });
    assert.equal(after?.length, 0, "a cleared pin must disappear");
  });

  console.log("\nEvidence pipeline and scoring idempotency");
  const { data: challenge2 } = await participant.from("challenges").select("*").eq("sequence", 2).single();
  let submissionId = "";
  let submissionV2 = "";
  await test("participant creates a draft and cannot submit without files", async () => {
    const { data, error } = await participant.rpc("create_submission", { p_event: event.id, p_challenge: challenge2!.id, p_caption: "watch export" });
    assert.ok(!error && data, error?.message);
    submissionId = data!.id;
    assert.equal(data!.version, 1);
    const { error: e2 } = await participant.rpc("submit_submission", { p_submission: submissionId });
    assert.ok(e2 && /attach at least/.test(e2.message));
  });
  await test("storage: participant uploads into own folder, member cannot upload, member can sign a read URL", async () => {
    const path = `${event.id}/${ids.participant}/${submissionId}/test.gpx`;
    const body = new Blob(["<gpx/>"], { type: "application/gpx+xml" });
    const { error } = await participant.storage.from("evidence").upload(path, body, { contentType: "application/gpx+xml" });
    assert.ok(!error, error?.message);
    const bad = await member.storage.from("evidence").upload(`${event.id}/${ids.member}/${submissionId}/x.gpx`, body, { contentType: "application/gpx+xml" });
    assert.ok(bad.error, "member upload must be rejected");
    const wrongFolder = await participant.storage.from("evidence").upload(`${event.id}/${ids.member}/${submissionId}/y.gpx`, body, { contentType: "application/gpx+xml" });
    assert.ok(wrongFolder.error, "upload outside own folder must be rejected");
    const { data: signed, error: se } = await member.storage.from("evidence").createSignedUrl(path, 60);
    assert.ok(!se && signed?.signedUrl, se?.message);
    const { error: oe } = await outsider.storage.from("evidence").createSignedUrl(path, 60);
    assert.ok(oe, "outsider must not sign URLs");
    const { error: fe } = await participant.from("evidence_files").insert({ submission_id: submissionId, storage_path: path, mime_type: "application/gpx+xml", byte_size: 6, kind: "gps", original_name: "test.gpx" });
    assert.ok(!fe, fe?.message);
    const { error: mf } = await member.from("evidence_files").insert({ submission_id: submissionId, storage_path: path + "2", mime_type: "application/gpx+xml", byte_size: 6, kind: "gps" });
    assert.ok(mf, "member cannot attach files");
  });
  await test("storage: signed upload URL path (browser small-file route) works for the participant only", async () => {
    const path = `${event.id}/${ids.participant}/${submissionId}/signed.png`;
    const { data: signed, error } = await participant.storage.from("evidence").createSignedUploadUrl(path);
    assert.ok(!error && signed?.token, error?.message);
    const { error: up } = await participant.storage.from("evidence").uploadToSignedUrl(path, signed!.token, new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), { contentType: "image/png" });
    assert.ok(!up, up?.message);
    const { data: listed } = await participant.storage.from("evidence").list(`${event.id}/${ids.participant}/${submissionId}`, { search: "signed.png" });
    assert.equal(listed?.length, 1);
    const { error: memberSigned } = await member.storage.from("evidence").createSignedUploadUrl(`${event.id}/${ids.member}/${submissionId}/m.png`);
    assert.ok(memberSigned, "member must not obtain a signed upload URL");
  });
  await test("submit → approve is idempotent and score derives from approved state", async () => {
    const { error } = await participant.rpc("submit_submission", { p_submission: submissionId });
    assert.ok(!error, error?.message);
    const key = `test-key-${Date.now()}`;
    const first = await commissioner.rpc("review_submission", { p_submission: submissionId, p_version: 1, p_decision: "approved", p_idempotency_key: key });
    assert.ok(!first.error, first.error?.message);
    const second = await commissioner.rpc("review_submission", { p_submission: submissionId, p_version: 1, p_decision: "approved", p_idempotency_key: key });
    assert.ok(!second.error);
    assert.equal(second.data?.id, first.data?.id, "same key must return the same decision");
    const third = await commissioner.rpc("review_submission", { p_submission: submissionId, p_version: 1, p_decision: "approved", p_idempotency_key: key + "-other" });
    assert.ok(third.error, "re-approving an approved submission with a new key must fail");
    const { data: score } = await member.from("event_scores").select("*").eq("event_id", event.id).single();
    assert.equal(score?.approved_points, 25);
    const { count } = await admin.from("review_decisions").select("*", { count: "exact", head: true }).eq("submission_id", submissionId).eq("decision", "approved");
    assert.equal(count, 1, "exactly one approval recorded");
  });
  await test("concurrent approvals of the same version award once", async () => {
    const { data: ch } = await participant.from("challenges").select("*").eq("sequence", 1).single();
    const { data: sub } = await participant.rpc("create_submission", { p_event: event.id, p_challenge: ch!.id });
    const path = `${event.id}/${ids.participant}/${sub!.id}/sign.png`;
    await participant.storage.from("evidence").upload(path, new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), { contentType: "image/png" });
    await participant.from("evidence_files").insert({ submission_id: sub!.id, storage_path: path, mime_type: "image/png", byte_size: 4, kind: "photo" });
    await participant.rpc("submit_submission", { p_submission: sub!.id });
    const attempts = await Promise.all(Array.from({ length: 5 }, (_, i) => commissioner.rpc("review_submission", { p_submission: sub!.id, p_version: 1, p_decision: "approved", p_idempotency_key: `race-${Date.now()}-${i}` })));
    const okCount = attempts.filter((a) => !a.error).length;
    assert.equal(okCount, 1, `expected exactly one success, got ${okCount}`);
    const { data: score } = await member.from("event_scores").select("*").eq("event_id", event.id).single();
    assert.equal(score?.approved_points, 30);
  });
  await test("flag requires a reason; member cannot review", async () => {
    const { error } = await commissioner.rpc("review_submission", { p_submission: submissionId, p_version: 1, p_decision: "flagged", p_idempotency_key: `flag-${Date.now()}` });
    assert.ok(error && /reason/.test(error.message));
    const { error: me } = await member.rpc("review_submission", { p_submission: submissionId, p_version: 1, p_decision: "approved", p_idempotency_key: `member-${Date.now()}` });
    assert.ok(me);
  });
  await test("new version approval explicitly supersedes the old one, score unchanged", async () => {
    const { data: v2 } = await participant.rpc("create_submission", { p_event: event.id, p_challenge: challenge2!.id, p_caption: "better export" });
    assert.equal(v2?.version, 2);
    submissionV2 = v2!.id;
    const path = `${event.id}/${ids.participant}/${submissionV2}/test2.gpx`;
    await participant.storage.from("evidence").upload(path, new Blob(["<gpx/>"]), { contentType: "application/gpx+xml" });
    await participant.from("evidence_files").insert({ submission_id: submissionV2, storage_path: path, mime_type: "application/gpx+xml", byte_size: 6, kind: "gps" });
    await participant.rpc("submit_submission", { p_submission: submissionV2 });
    const { error } = await commissioner.rpc("review_submission", { p_submission: submissionV2, p_version: 2, p_decision: "approved", p_idempotency_key: `v2-${Date.now()}` });
    assert.ok(!error, error?.message);
    const { data: old } = await admin.from("evidence_submissions").select("status").eq("id", submissionId).single();
    assert.equal(old?.status, "superseded");
    const { data: decisions } = await admin.from("review_decisions").select("decision").eq("submission_id", submissionId);
    assert.ok(decisions?.some((d) => d.decision === "superseded"), "supersede decision recorded");
    const { data: score } = await member.from("event_scores").select("*").eq("event_id", event.id).single();
    assert.equal(score?.approved_points, 30, "points not double counted across versions");
    const { error: staleErr } = await commissioner.rpc("review_submission", { p_submission: submissionV2, p_version: 1, p_decision: "flagged", p_reason: "x", p_idempotency_key: `stale-${Date.now()}` });
    assert.ok(staleErr && /version mismatch/.test(staleErr.message));
  });
  await test("participant cannot edit or delete approved evidence", async () => {
    const { data } = await participant.from("evidence_submissions").update({ caption: "hacked" }).eq("id", submissionV2).select();
    assert.equal(data?.length ?? 0, 0);
    const { data: del } = await participant.from("evidence_submissions").delete().eq("id", submissionV2).select();
    assert.equal(del?.length ?? 0, 0);
    const { error } = await participant.storage.from("evidence").remove([`${event.id}/${ids.participant}/${submissionV2}/test2.gpx`]);
    const { data: still } = await participant.storage.from("evidence").list(`${event.id}/${ids.participant}/${submissionV2}`);
    assert.ok(error || (still?.length ?? 0) === 1, "approved object must not be deletable");
  });

  console.log("\nPrediction locking");
  await test("member can save before lock, others hidden before reveal, locked after departure", async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    await admin.from("events").update({ prediction_lock_at: future, prediction_reveal_at: future }).eq("id", event.id);
    const { error } = await member.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 5400, p_meal_rating: 8, p_final_score: 70, p_sign_photo_minutes: 560, p_flag_count: 1, p_run_distance_km: 10.2, p_speech_seconds: 90 });
    assert.ok(!error, error?.message);
    const { error: e2 } = await commissioner.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 6000, p_meal_rating: 7, p_final_score: 90, p_sign_photo_minutes: 600, p_flag_count: 2, p_run_distance_km: 10.6, p_speech_seconds: 150 });
    // Earlier deploys send three or four arguments; the shim overloads must accept them (the four-argument one ignores the count).
    const { error: e3 } = await commissioner.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 6000, p_meal_rating: 7, p_complaint_count: 20 });
    assert.ok(!e3, e3?.message);
    const { error: e4 } = await commissioner.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 6000, p_meal_rating: 7 });
    assert.ok(!e4, e4?.message);
    // The shims write null for the new calls; put the commissioner's full slip back.
    const { error: e5 } = await commissioner.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 6000, p_meal_rating: 7, p_final_score: 90, p_sign_photo_minutes: 600, p_flag_count: 2, p_run_distance_km: 10.6, p_speech_seconds: 150 });
    assert.ok(!e5, e5?.message);
    assert.ok(!e2, e2?.message);
    const { data: hidden } = await participant.from("predictions_revealed").select("user_id").eq("event_id", event.id);
    assert.equal(hidden?.length ?? 0, 0, "others' predictions must be hidden before reveal");
    const { data: base } = await participant.from("predictions").select("user_id").eq("event_id", event.id);
    assert.equal(base?.length ?? 0, 0, "base table must not leak before reveal");
    const past = new Date(Date.now() - 60_000).toISOString();
    await admin.from("events").update({ prediction_lock_at: past }).eq("id", event.id);
    const { error: locked } = await member.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 1, p_meal_rating: 1, p_final_score: 1, p_sign_photo_minutes: 1, p_flag_count: 1, p_run_distance_km: 1, p_speech_seconds: 1 });
    assert.ok(locked && /locked/.test(locked.message));
    const { error: outErr } = await outsider.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 1, p_meal_rating: 1, p_final_score: 1, p_sign_photo_minutes: 1, p_flag_count: 1, p_run_distance_km: 1, p_speech_seconds: 1 });
    assert.ok(outErr);
  });
  await test("resolution awards closest/exact with ties sharing", async () => {
    await admin.from("events").update({ prediction_reveal_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", event.id);
    const { error: re } = await commissioner.from("official_results").upsert({ event_id: event.id, run_seconds: 5700, meal_rating: 8, final_score: 85, sign_photo_minutes: 575, flag_count: 2, run_distance_km: 10.35, speech_seconds: 121 }, { onConflict: "event_id" });
    assert.ok(!re, re?.message);
    const { data: n, error } = await commissioner.rpc("resolve_predictions", { p_event: event.id });
    assert.ok(!error, error?.message);
    const { data: awards } = await member.from("prediction_awards").select("*").eq("event_id", event.id);
    const run = awards!.filter((a) => a.category === "run");
    assert.equal(run.length, 2, "tie on run (both 300 s off) shares points");
    assert.equal(awards!.filter((a) => a.category === "meal").length, 1);
    assert.equal(awards!.filter((a) => a.category === "complaints").length, 0, "the complaint count is no longer scored");
    assert.equal(awards!.find((a) => a.category === "final_score")?.user_id, ids.commissioner, "closest final score");
    assert.equal(awards!.find((a) => a.category === "sign_photo")?.user_id, ids.member, "closest sign photo time");
    assert.equal(awards!.find((a) => a.category === "flags")?.user_id, ids.commissioner, "exact flag count");
    assert.equal(awards!.find((a) => a.category === "distance")?.user_id, ids.member, "closest distance");
    assert.equal(awards!.find((a) => a.category === "speech")?.user_id, ids.commissioner, "closest speech length");
    assert.equal(n, 8);
    const { data: revealed } = await participant.from("predictions_revealed").select("user_id").eq("event_id", event.id);
    assert.equal(revealed?.length, 2, "predictions visible after reveal");
    const { error: memberResolve } = await member.rpc("resolve_predictions", { p_event: event.id });
    assert.ok(memberResolve);
  });

  console.log("\nProp board");
  await test("members pick a side until the prop locks; other picks stay hidden until then", async () => {
    // Open the board for this run.
    await admin.from("props").update({ locks_at: "2099-01-01T00:00:00Z", result: null, settled_by: null, settled_at: null }).eq("event_id", event.id);
    const { data: props } = await member.from("props").select("*").eq("event_id", event.id).order("sequence");
    assert.ok(props && props.length >= 2, "props seeded");
    const ou = props!.find((p) => p.kind === "over_under")!;
    const yn = props!.find((p) => p.kind === "yes_no")!;
    const { error: direct } = await member.from("prop_picks").insert({ event_id: event.id, prop_id: ou.id, user_id: ids.member, side: "over" });
    assert.ok(direct, "members cannot insert picks directly");
    const { error: e1 } = await member.rpc("upsert_prop_pick", { p_prop: ou.id, p_side: "over" });
    assert.ok(!e1, e1?.message);
    const { error: e2 } = await member.rpc("upsert_prop_pick", { p_prop: ou.id, p_side: "under" });
    assert.ok(!e2, "a pick can be changed before lock");
    const { error: bad } = await member.rpc("upsert_prop_pick", { p_prop: ou.id, p_side: "yes" });
    assert.ok(bad, "side must fit the prop kind");
    const { error: e3 } = await participant.rpc("upsert_prop_pick", { p_prop: ou.id, p_side: "over" });
    assert.ok(!e3, e3?.message);
    const { error: e4 } = await member.rpc("upsert_prop_pick", { p_prop: yn.id, p_side: "yes" });
    assert.ok(!e4, e4?.message);
    const { error: out } = await outsider.rpc("upsert_prop_pick", { p_prop: ou.id, p_side: "over" });
    assert.ok(out, "outsider cannot pick");
    const { data: visible } = await member.from("prop_picks").select("user_id").eq("event_id", event.id).eq("prop_id", ou.id);
    assert.equal(visible?.length, 1, "only own pick visible before lock");
    const { error: early } = await commissioner.rpc("settle_prop", { p_prop: ou.id, p_result: "under" });
    assert.ok(early, "cannot settle before lock");
  });
  await test("commissioner settles locked props; leaderboard scores one point per correct call; void scores nothing", async () => {
    await admin.from("props").update({ locks_at: "2026-09-23T17:15:00Z" }).eq("event_id", event.id);
    const { data: props } = await member.from("props").select("*").eq("event_id", event.id).order("sequence");
    const ou = props!.find((p) => p.kind === "over_under")!;
    const yn = props!.find((p) => p.kind === "yes_no")!;
    const { error: late } = await member.rpc("upsert_prop_pick", { p_prop: ou.id, p_side: "over" });
    assert.ok(late, "no picks after lock");
    const { data: visible } = await member.from("prop_picks").select("user_id").eq("event_id", event.id).eq("prop_id", ou.id);
    assert.equal(visible?.length, 2, "all picks visible after lock");
    const { error: me } = await member.rpc("settle_prop", { p_prop: ou.id, p_result: "under" });
    assert.ok(me, "member cannot settle");
    const { error: wrongKind } = await commissioner.rpc("settle_prop", { p_prop: ou.id, p_result: "yes" });
    assert.ok(wrongKind, "result must fit the prop kind");
    const { error: s1 } = await commissioner.rpc("settle_prop", { p_prop: ou.id, p_result: "under" });
    assert.ok(!s1, s1?.message);
    await commissioner.rpc("settle_prop", { p_prop: ou.id, p_result: "under" }); // idempotent replay
    const { error: s2 } = await commissioner.rpc("settle_prop", { p_prop: yn.id, p_result: "void" });
    assert.ok(!s2, s2?.message);
    const { data: lb } = await member.rpc("prop_leaderboard", { p_event: event.id });
    const mine = lb?.find((r) => r.user_id === ids.member);
    const theirs = lb?.find((r) => r.user_id === ids.participant);
    assert.equal(mine?.correct, 1);
    assert.equal(mine?.wrong, 0, "void prop is not counted");
    assert.equal(theirs?.correct, 0);
    assert.equal(theirs?.wrong, 1);
    assert.equal(lb?.[0].user_id, ids.member, "leader first");
    const { data: posts } = await member.from("activity_posts").select("kind, body").eq("event_id", event.id).eq("kind", "prop");
    assert.equal(posts?.length, 2, "one feed post per settlement");
    // Re-settling corrects the result and re-scores.
    const { error: s3 } = await commissioner.rpc("settle_prop", { p_prop: ou.id, p_result: "over" });
    assert.ok(!s3, s3?.message);
    const { data: lb2 } = await member.rpc("prop_leaderboard", { p_event: event.id });
    assert.equal(lb2?.find((r) => r.user_id === ids.participant)?.correct, 1);
    assert.equal(lb2?.[0].user_id, ids.participant, "corrected leader first");
  });

  console.log("\nKits");
  await test("a franchise can be claimed by only one member; direct column edits are blocked", async () => {
    await admin.from("profiles").update({ kit_team: null }).in("id", [ids.member, ids.commissioner]);
    const { error: e1 } = await member.rpc("claim_kit", { p_team: "phi", p_number: 7 });
    assert.ok(!e1, e1?.message);
    const { error: e2 } = await commissioner.rpc("claim_kit", { p_team: "phi", p_number: 1 });
    assert.ok(e2 && /already worn/.test(e2.message), "second claim of the same franchise must fail");
    const { error: e3 } = await commissioner.rpc("claim_kit", { p_team: "kc", p_number: 1 });
    assert.ok(!e3, e3?.message);
    const { error: e4 } = await member.rpc("claim_kit", { p_team: "xyz", p_number: 1 });
    assert.ok(e4, "unknown franchise must fail");
    const { data: direct } = await member.from("profiles").update({ kit_team: "kc" }).eq("id", ids.member).select();
    assert.equal(direct?.length ?? 0, 0, "kit_team must not be editable directly");
    const { data: claimed } = await member.rpc("claimed_kits");
    assert.ok(claimed?.some((c) => c.kit_team === "kc") && claimed?.some((c) => c.kit_team === "phi"));
    const { error: out } = await outsider.rpc("claim_kit", { p_team: "buf", p_number: 1 });
    assert.ok(out, "non-member cannot claim a kit");
    await member.rpc("claim_kit", { p_team: "cin", p_number: 9 });
  });

  console.log("\nSleeper teams");
  await test("a Sleeper team can be confirmed by only one member; direct column edits are blocked", async () => {
    const managers = [
      { league_id: league.id, sleeper_user_id: "900000000001", display_name: "Fixture One", username: "fixture_one", team_name: "Fixture FC", avatar: null, is_owner: false, season: "2024" },
      { league_id: league.id, sleeper_user_id: "900000000002", display_name: "Fixture Two", username: "fixture_two", team_name: "Fixture United", avatar: null, is_owner: false, season: "2024" },
    ];
    const { error: seed } = await admin.from("sleeper_league_users").upsert(managers, { onConflict: "league_id,sleeper_user_id" });
    assert.ok(!seed, seed?.message);
    await admin.from("memberships").update({ sleeper_user_id: null, sleeper_confirmed: false }).eq("league_id", league.id).in("user_id", [ids.member, ids.commissioner]);
    try {
      const { error: e1 } = await member.rpc("claim_sleeper_identity", { p_league: league.id, p_sleeper_user_id: "900000000001" });
      assert.ok(!e1, e1?.message);
      const { error: e2 } = await commissioner.rpc("claim_sleeper_identity", { p_league: league.id, p_sleeper_user_id: "900000000001" });
      assert.ok(e2 && /already taken/.test(e2.message), "second claim of the same Sleeper team must fail");
      const { error: e3 } = await commissioner.rpc("claim_sleeper_identity", { p_league: league.id, p_sleeper_user_id: "900000000002" });
      assert.ok(!e3, e3?.message);
      const { error: e4 } = await member.rpc("claim_sleeper_identity", { p_league: league.id, p_sleeper_user_id: "900000000009" });
      assert.ok(e4, "a manager outside the imported league must fail");
      const { error: e5 } = await participant.rpc("confirm_sleeper_link", { p_league: league.id, p_user: ids.participant, p_confirmed: true, p_sleeper_user_id: "900000000002" });
      assert.ok(e5 && /already taken/.test(e5.message), "an admin link to a taken team must fail too");
      const { data: direct } = await member.from("memberships").update({ sleeper_user_id: "900000000002" }).eq("user_id", ids.member).select();
      assert.equal(direct?.length ?? 0, 0, "sleeper_user_id must not be editable directly");
      const { error: out } = await outsider.rpc("claim_sleeper_identity", { p_league: league.id, p_sleeper_user_id: "900000000002" });
      assert.ok(out, "non-member cannot confirm a Sleeper team");
      const { data: mine } = await member.from("memberships").select("sleeper_user_id, sleeper_confirmed").eq("user_id", ids.member).single();
      assert.equal(mine?.sleeper_user_id, "900000000001");
      assert.equal(mine?.sleeper_confirmed, true);
    } finally {
      await admin.from("memberships").update({ sleeper_user_id: null, sleeper_confirmed: false }).eq("league_id", league.id).in("user_id", [ids.member, ids.commissioner]);
      await admin.from("sleeper_league_users").delete().eq("league_id", league.id).in("sleeper_user_id", managers.map((m) => m.sleeper_user_id));
    }
  });

  console.log("\nFeed");
  await test("comments and one reaction per member; outsider excluded", async () => {
    const { data: post, error } = await member.from("activity_posts").insert({ event_id: event.id, author_id: ids.member, kind: "comment", heading: "From the locker room", body: "<b>no sympathy</b>" }).select().single();
    assert.ok(!error && post, error?.message);
    const { error: sys } = await member.from("activity_posts").insert({ event_id: event.id, author_id: ids.member, kind: "decision", heading: "fake", body: "fake" });
    assert.ok(sys, "members cannot forge decision posts");
    const { error: r1 } = await participant.from("reactions").insert({ post_id: post!.id, user_id: ids.participant });
    assert.ok(!r1, r1?.message);
    const { error: r2 } = await participant.from("reactions").insert({ post_id: post!.id, user_id: ids.participant });
    assert.ok(r2, "second reaction must violate the primary key");
    const { error: spoof } = await participant.from("reactions").insert({ post_id: post!.id, user_id: ids.member });
    assert.ok(spoof, "cannot react as someone else");
    const { data: seen } = await outsider.from("activity_posts").select("id").eq("event_id", event.id);
    assert.equal(seen?.length ?? 0, 0);
  });

  console.log("\nCertificate");
  await test("certificate pending until issued; public recap needs both consents", async () => {
    const { data: pub0 } = await anon.rpc("public_certificate", { p_league_slug: league.slug, p_event_slug: event.slug });
    assert.equal(pub0, null);
    const { error: me } = await member.rpc("issue_certificate", { p_event: event.id, p_is_public: true });
    assert.ok(me);
    const { data: cert, error } = await commissioner.rpc("issue_certificate", { p_event: event.id, p_is_public: true });
    assert.ok(!error && cert?.status === "issued", error?.message);
    assert.equal((cert!.summary as { approved_points: number }).approved_points, 30);
    const { data: pub1 } = await anon.rpc("public_certificate", { p_league_slug: league.slug, p_event_slug: event.slug });
    assert.equal(pub1, null, "no participant consent yet");
    await participant.rpc("set_certificate_consent", { p_event: event.id, p_consent: true });
    const { data: pub2 } = await anon.rpc("public_certificate", { p_league_slug: league.slug, p_event_slug: event.slug });
    assert.ok(pub2 && (pub2 as { participant: string }).participant === FIXTURES.participant.name);
    await participant.rpc("set_certificate_consent", { p_event: event.id, p_consent: false });
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} integration checks passed.`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
