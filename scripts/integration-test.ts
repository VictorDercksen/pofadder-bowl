/**
 * Integration tests against the LOCAL Supabase stack: RLS isolation across four accounts,
 * scoring idempotency, prediction locking, bingo wins and the storage policies.
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
  await admin.from("bingo_incidents").delete().eq("event_id", event.id);
  await admin.from("bingo_wins").delete().eq("event_id", event.id);
  await admin.from("bingo_cards").delete().eq("event_id", event.id);
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
    for (const table of ["events", "challenges", "activity_posts", "checkins", "evidence_submissions", "memberships"] as const) {
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
    assert.equal((await participant.rpc("my_event_role", { p_event: event.id })).data, "participant");
    assert.equal((await commissioner.rpc("my_event_role", { p_event: event.id })).data, "commissioner");
  });
  await test("member cannot self-promote membership", async () => {
    const { data, error } = await member.from("memberships").update({ is_commissioner: true }).eq("user_id", ids.member).select();
    assert.ok(error || (data?.length ?? 0) === 0, "update should be denied or affect no rows");
    const { data: m } = await admin.from("memberships").select("is_commissioner").eq("user_id", ids.member).single();
    assert.equal(m?.is_commissioner, false);
  });
  await test("member cannot call commissioner RPCs", async () => {
    const { error } = await member.rpc("set_member_role", { p_league: league.id, p_user: ids.member, p_role: "member", p_is_commissioner: true, p_status: "active" });
    assert.ok(error, "set_member_role should fail for member");
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
    const { data: again } = await participant.rpc("record_checkin", args);
    assert.equal(again?.id, data?.id, "duplicate client id must not create a second check-in");
    const { data: visible } = await member.from("checkins").select("id").eq("event_id", event.id);
    assert.equal(visible?.length, 1);
    const { data: removed } = await participant.rpc("remove_checkins", { p_event: event.id });
    assert.equal(removed, 1);
    const { data: after } = await member.from("checkins").select("id").eq("event_id", event.id);
    assert.equal(after?.length, 0, "removed check-ins must not be visible");
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
    const { error } = await member.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 5400, p_meal_rating: 8, p_complaint_count: 12 });
    assert.ok(!error, error?.message);
    const { error: e2 } = await commissioner.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 6000, p_meal_rating: 7, p_complaint_count: 20 });
    assert.ok(!e2, e2?.message);
    const { data: hidden } = await participant.from("predictions_revealed").select("user_id").eq("event_id", event.id);
    assert.equal(hidden?.length ?? 0, 0, "others' predictions must be hidden before reveal");
    const { data: base } = await participant.from("predictions").select("user_id").eq("event_id", event.id);
    assert.equal(base?.length ?? 0, 0, "base table must not leak before reveal");
    const past = new Date(Date.now() - 60_000).toISOString();
    await admin.from("events").update({ prediction_lock_at: past }).eq("id", event.id);
    const { error: locked } = await member.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 1, p_meal_rating: 1, p_complaint_count: 1 });
    assert.ok(locked && /locked/.test(locked.message));
    const { error: outErr } = await outsider.rpc("upsert_prediction", { p_event: event.id, p_run_seconds: 1, p_meal_rating: 1, p_complaint_count: 1 });
    assert.ok(outErr);
  });
  await test("resolution awards closest/exact with ties sharing", async () => {
    await admin.from("events").update({ prediction_reveal_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", event.id);
    const { error: re } = await commissioner.from("official_results").upsert({ event_id: event.id, run_seconds: 5700, meal_rating: 8, complaint_count: 16 }, { onConflict: "event_id" });
    assert.ok(!re, re?.message);
    const { data: n, error } = await commissioner.rpc("resolve_predictions", { p_event: event.id });
    assert.ok(!error, error?.message);
    const { data: awards } = await member.from("prediction_awards").select("*").eq("event_id", event.id);
    const run = awards!.filter((a) => a.category === "run");
    assert.equal(run.length, 2, "tie on run (both 300 s off) shares points");
    assert.equal(awards!.filter((a) => a.category === "meal").length, 1);
    assert.equal(awards!.filter((a) => a.category === "complaints").length, 2, "tie on complaints (both 4 off)");
    assert.equal(n, 5);
    const { data: revealed } = await participant.from("predictions_revealed").select("user_id").eq("event_id", event.id);
    assert.equal(revealed?.length, 2, "predictions visible after reveal");
    const { error: memberResolve } = await member.rpc("resolve_predictions", { p_event: event.id });
    assert.ok(memberResolve);
  });

  console.log("\nPunishment Bingo");
  await test("cards are stable per member with the free centre; layouts hidden from others", async () => {
    const { data: a } = await member.rpc("ensure_bingo_card", { p_event: event.id });
    const { data: b } = await member.rpc("ensure_bingo_card", { p_event: event.id });
    assert.deepEqual(a?.layout, b?.layout);
    assert.equal(a?.layout[12], 12, "cell 12 is the free square");
    assert.equal(new Set(a?.layout).size, 25);
    await participant.rpc("ensure_bingo_card", { p_event: event.id });
    const { data: visible } = await member.from("bingo_cards").select("user_id").eq("event_id", event.id);
    assert.equal(visible?.length, 1, "member sees only their own card");
    const { error } = await outsider.rpc("ensure_bingo_card", { p_event: event.id });
    assert.ok(error);
  });
  await test("member proposes, commissioner confirms, wins detected once, no client marking", async () => {
    const { data: card } = await member.rpc("ensure_bingo_card", { p_event: event.id });
    const { data: squares } = await member.from("bingo_squares").select("*").eq("event_id", event.id);
    // Force a row-0 line for the member: confirm the squares at cells 0..4 of their layout.
    const rowPositions = card!.layout.slice(0, 5).filter((p) => p !== 12);
    const { error: direct } = await member.from("bingo_incidents").insert({ event_id: event.id, square_id: squares![0].id, status: "confirmed" });
    assert.ok(direct, "members cannot insert incidents directly");
    for (const pos of rowPositions) {
      const sq = squares!.find((s) => s.position === pos)!;
      const { data: inc, error } = await member.rpc("propose_bingo_incident", { p_event: event.id, p_square: sq.id, p_note: "seen it" });
      assert.ok(!error && inc, error?.message);
      const { error: me } = await member.rpc("decide_bingo_incident", { p_incident: inc!.id, p_confirm: true });
      assert.ok(me, "member cannot confirm");
      const { error: ce } = await commissioner.rpc("decide_bingo_incident", { p_incident: inc!.id, p_confirm: true });
      assert.ok(!ce, ce?.message);
      await commissioner.rpc("decide_bingo_incident", { p_incident: inc!.id, p_confirm: true }); // idempotent replay
    }
    const { data: wins } = await member.from("bingo_wins").select("*").eq("event_id", event.id).eq("user_id", ids.member);
    assert.equal(wins?.length, 1, `expected exactly one line win, got ${wins?.length}`);
    assert.equal(wins?.[0].line_key, "row0");
    const { data: lb } = await member.rpc("bingo_leaderboard", { p_event: event.id });
    const mine = lb?.find((r) => r.user_id === ids.member);
    assert.equal(mine?.lines, 1);
    assert.ok(mine?.first_line_at);
    const { data: dup } = await admin.from("bingo_wins").select("*").eq("event_id", event.id);
    const keys = new Set(dup?.map((w) => `${w.user_id}:${w.line_key}`));
    assert.equal(keys.size, dup?.length, "no duplicate wins");
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
