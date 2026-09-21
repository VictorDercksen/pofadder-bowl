/** Behaviour and mobile checks against a built app and the local fixture database only. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, expect as baseExpect, type Page } from "@playwright/test";
import { adminClient, env } from "./lib";
import { seedFixtures, FIXTURES, FIXTURE_PASSWORD } from "./seed-local-fixtures";
import { TOUR_VERSION } from "../src/lib/tour";

const base = "http://localhost:3001";
const failures: string[] = [];
const expect = baseExpect.configure({ timeout: 20_000 });

async function login(page: Page, role: keyof typeof FIXTURES) {
  await page.goto(`${base}/login`);
  await page.getByLabel("League email", { exact: true }).fill(FIXTURES[role].email);
  await page.getByLabel("Password", { exact: true }).first().fill(FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function main() {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(env("NEXT_PUBLIC_SUPABASE_URL")).hostname), "Local Supabase required");
  const { ids, event, league } = await seedFixtures();
  const admin = adminClient();
  for (const [index, role] of (["participant", "commissioner", "member"] as const).entries()) {
    const sleeper = `88000000000${index}`;
    const imported = await admin.from("sleeper_league_users").upsert({ league_id: league.id, sleeper_user_id: sleeper, display_name: FIXTURES[role].name, team_name: `Test ${role}`, is_owner: true }, { onConflict: "league_id,sleeper_user_id" });
    assert.ok(!imported.error, imported.error?.message);
    await admin.from("memberships").update({ sleeper_user_id: sleeper, sleeper_confirmed: true }).eq("league_id", league.id).eq("user_id", ids[role]);
  }
  await admin.from("profiles").update({ tutorial_completed_at: new Date().toISOString(), tutorial_version: TOUR_VERSION }).in("id", Object.values(ids));
  await admin.from("events").update({ prediction_lock_at: new Date(Date.now() + 3600_000).toISOString(), prediction_reveal_at: new Date(Date.now() + 3600_000).toISOString() }).eq("id", event.id);
  const browser = await chromium.launch();
  mkdirSync("screenshots", { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-ZA", timezoneId: "Africa/Johannesburg" });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => failures.push(error.message));
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await page.request.get(`${base}/teaser`)).ok()) break; } catch { /* server starting */ }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    await page.goto(`${base}/teaser`);
    if (!env("PB_TESTING_RESET", "false").match(/^(true|1|yes|on)$/i)) await expect(page.getByRole("link", { name: "Interactive demo" })).toHaveCount(0);
    console.log("  Teaser omits the demo button in league builds.");
    await login(page, "participant");
    const response = await page.goto(`${base}/press`);
    assert.match(response?.headers()["permissions-policy"] ?? "", /camera=\(self\), microphone=\(self\)/);
    const normal = await page.goto(`${base}/my-trip`);
    assert.match(normal?.headers()["permissions-policy"] ?? "", /camera=\(\)/);
    console.log("  Recording permission policy is scoped to Press Room.");

    const { data: challenge, error } = await admin.from("challenges").select("id").eq("event_id", event.id).eq("sequence", 6).single();
    assert.ok(!error && challenge, error?.message);
    // Re-running this local check replaces only this fixture's proof for challenge six.
    const previous = await admin.from("evidence_submissions").select("id, files:evidence_files(storage_path)").eq("challenge_id", challenge!.id).eq("submitter_id", ids.participant);
    assert.ok(!previous.error, previous.error?.message);
    const paths = previous.data!.flatMap((submission) => submission.files.map((file) => file.storage_path));
    if (paths.length) {
      const removed = await admin.storage.from("evidence").remove(paths);
      assert.ok(!removed.error, removed.error?.message);
    }
    if (previous.data!.length) {
      const cleared = await admin.from("evidence_submissions").delete().in("id", previous.data!.map((submission) => submission.id));
      assert.ok(!cleared.error, cleared.error?.message);
    }
    await page.goto(`${base}/proof/${challenge!.id}`);
    await expect(page.locator('input[type="file"]')).toBeEnabled();
    await page.getByRole("textbox", { name: "Caption", exact: true }).fill("Browser recovery check");
    await page.getByRole("radio", { name: /7/ }).click();
    await expect(page.getByText("Draft saved on this device.", { exact: false })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Caption", exact: true })).toHaveValue("Browser recovery check");
    await expect(page.getByRole("radio", { name: /7/ })).toHaveAttribute("aria-checked", "true");
    const clip = { name: "review.webm", mimeType: "video/webm", buffer: Buffer.alloc(7 * 1024 * 1024, 1) };
    await page.locator('input[type="file"]').setInputFiles(clip);
    let interrupted = false;
    let resumed = false;
    await page.route("**/storage/v1/upload/resumable**", async (route) => {
      const request = route.request();
      if (request.method() === "PATCH") {
        if (!interrupted) { interrupted = true; await route.abort("failed"); return; }
        if (Number(request.headers()["upload-offset"]) > 0) resumed = true;
      }
      await route.continue();
    });
    await page.getByRole("button", { name: "Upload 1 file(s)", exact: true }).click();
    await expect.poll(() => interrupted, { timeout: 30_000 }).toBe(true);
    await page.getByRole("textbox", { name: "Caption", exact: true }).fill("Caption changed during transfer");
    await expect(page.locator(".pb-file .pb-small").filter({ hasText: /· (Uploaded|in private storage)$/ }).first()).toBeVisible({ timeout: 60_000 });
    assert.ok(resumed, "TUS must resume after the accepted chunk");
    await page.getByRole("button", { name: "Submit for review", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start a new version" })).toBeVisible();
    const v1 = await admin.from("evidence_submissions").select("id, version, caption, rating").eq("challenge_id", challenge!.id).order("version", { ascending: false }).limit(1).single();
    assert.equal(v1.data?.caption, "Caption changed during transfer");
    assert.equal(v1.data?.rating, 7);
    await page.getByRole("button", { name: "Start a new version" }).click();
    await expect(page.locator('input[type="file"]')).toBeEnabled();
    await page.locator('input[type="file"]').setInputFiles({ name: "replacement.webm", mimeType: "video/webm", buffer: Buffer.from("replacement") });
    await page.getByRole("button", { name: "Upload 1 file(s)", exact: true }).click();
    await expect(page.getByText("replacement.webm").last()).toBeVisible();
    await expect(page.locator(".pb-file .pb-small").filter({ hasText: /· (Uploaded|in private storage)$/ }).first()).toBeVisible({ timeout: 30_000 });
    const versions = await admin.from("evidence_submissions").select("id, version, files:evidence_files(id)").eq("challenge_id", challenge!.id).order("version");
    assert.equal(versions.data?.length, 2, "starting a new version must not create an extra draft");
    assert.equal(versions.data?.[1].files.length, 1, "replacement must attach to the new version");
    await page.screenshot({ path: "screenshots/review-proof-detail-390.png", fullPage: true });
    console.log("  Ratings and captions recover, TUS resumes, replacement targets the new version.");

    for (const width of [360, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/my-trip", "/proof", "/predictions", "/review", "/game-centre", "/props"]) {
        await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator("h1").first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        if (overflow) failures.push(`${path} overflows at ${width}px`);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `screenshots/review-${path.slice(1)}-${width}.png`, fullPage: true });
      }
    }
    await page.goto(`${base}/my-trip`);
    await page.route("**/my-trip", async (route) => route.request().method() === "POST" ? route.abort("failed") : route.continue());
    const before = await page.getByLabel("Share my location with league members").isChecked();
    await page.getByRole("button", { name: before ? "Pause sharing" : "Resume sharing", exact: true }).click();
    await expect(page.getByText("Your location setting could not be confirmed.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Share my location with league members")).toBeChecked({ checked: before });
    await page.unroute("**/my-trip");
    console.log("  Failed location changes preserve the confirmed setting.");
    await page.goto(`${base}/predictions`);
    await page.getByRole("radio", { name: /8/ }).click();
    await page.getByRole("button", { name: /Save predictions|Save changes/ }).click();
    await expect(page.getByText("Your predictions are saved.", { exact: true })).toBeVisible();
    const minutes = page.getByLabel("Run minutes", { exact: true });
    await minutes.fill((await minutes.inputValue()) === "36" ? "37" : "36");
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
    console.log("  Predictions distinguish saved values from unsaved edits.");
    assert.deepEqual(failures, [], failures.join("\n"));
    console.log("Browser review checks passed. Screenshots are in screenshots/.");
  } catch (error) {
    await page.screenshot({ path: "screenshots/review-failure.png", fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
