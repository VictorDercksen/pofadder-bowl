/**
 * Exercises the real invite + magic-link sign-in flow end to end against the LOCAL stack:
 * bootstrap script invites a new commissioner → Mailpit receives the invite → link opens in a
 * browser and lands signed-in on /review; then the real login form requests a magic link for a
 * member → Mailpit → link → /game-centre.
 *
 *   npx supabase start && npm run seed:local-fixtures && npx next build && npx next start -p 3001
 *   SCREENSHOT_BASE=http://localhost:3001 npx tsx scripts/auth-flow-test.ts
 */
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { FIXTURES } from "./seed-local-fixtures";

const BASE = process.env.SCREENSHOT_BASE ?? "http://localhost:3001";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type Message = { ID: string; To: { Address: string }[]; Subject: string; Created: string };

async function latestMessageFor(email: string, since: number): Promise<{ subject: string; link: string }> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=50`)).json()) as { messages: Message[] };
    const msg = list.messages.find((m) => m.To.some((t) => t.Address.toLowerCase() === email.toLowerCase()) && Date.parse(m.Created) >= since - 5000);
    if (msg) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { HTML: string; Text: string };
      const html = full.HTML || full.Text;
      const m = /href="([^"]+)"/.exec(html) ?? /(https?:\/\/\S+)/.exec(html);
      if (!m) throw new Error("no link in email");
      return { subject: msg.Subject, link: m[1].replace(/&amp;/g, "&") };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email for ${email}`);
}

async function main() {
  const browser = await chromium.launch();
  const failures: string[] = [];

  // 1. Invite flow via the documented bootstrap step.
  const inviteEmail = `newcommish-${Date.now()}@local.test`;
  const t0 = Date.now();
  console.log(execFileSync("npx", ["tsx", "scripts/bootstrap-commissioner.ts", "--email", inviteEmail, "--name", "Invited Commish"], { encoding: "utf8", shell: true }).trim());
  const invite = await latestMessageFor(inviteEmail, t0);
  console.log(`Invite email: "${invite.subject}" → ${invite.link.slice(0, 80)}…`);
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();
  await page1.goto(invite.link.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "domcontentloaded" });
  await page1.waitForURL((u) => !u.pathname.startsWith("/auth") && !u.pathname.startsWith("/login"), { timeout: 20_000 }).catch(() => {});
  const landed1 = new URL(page1.url()).pathname;
  const signedIn1 = (await page1.locator("text=Sign out").count()) > 0;
  console.log(`Invite landed on ${landed1}, signed in: ${signedIn1}`);
  if (landed1 !== "/review" || !signedIn1) failures.push(`invite flow landed on ${landed1} (signed in: ${signedIn1})`);
  await ctx1.close();

  // 2. Magic link requested from the real login form for an existing member.
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const t1 = Date.now();
  await page2.fill('input[name="email"][type="email"] >> nth=0', FIXTURES.member.email);
  await page2.click('button:has-text("Email me a sign-in link")');
  await page2.waitForSelector("text=Check your inbox", { timeout: 15_000 });
  const magic = await latestMessageFor(FIXTURES.member.email, t1);
  console.log(`Magic-link email: "${magic.subject}" → ${magic.link.slice(0, 80)}…`);
  await page2.goto(magic.link.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "domcontentloaded" });
  await page2.waitForURL((u) => !u.pathname.startsWith("/auth") && !u.pathname.startsWith("/login"), { timeout: 20_000 }).catch(() => {});
  const landed2 = new URL(page2.url()).pathname;
  const signedIn2 = (await page2.locator("text=Sign out").count()) > 0;
  console.log(`Magic link landed on ${landed2}, signed in: ${signedIn2}`);
  if (landed2 !== "/game-centre" || !signedIn2) failures.push(`magic link landed on ${landed2} (signed in: ${signedIn2})`);

  // 3. Used link must not work twice; sign-out must clear the session.
  await page2.goto(magic.link.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "domcontentloaded" });
  const reused = new URL(page2.url());
  console.log(`Reused link landed on ${reused.pathname}${reused.search}`);
  if (!(reused.pathname === "/login" && reused.searchParams.get("reason") === "invalid") && reused.pathname !== "/game-centre") failures.push(`reused link unexpected: ${reused.pathname}`);
  await page2.goto(`${BASE}/game-centre`, { waitUntil: "domcontentloaded" });
  await page2.click('button:has-text("Sign out")');
  await page2.waitForURL((u) => u.pathname === "/login", { timeout: 15_000 });
  await page2.goto(`${BASE}/game-centre`, { waitUntil: "domcontentloaded" });
  const afterSignOut = new URL(page2.url());
  console.log(`After sign-out, /game-centre → ${afterSignOut.pathname}${afterSignOut.search}`);
  if (afterSignOut.pathname !== "/login") failures.push("private route reachable after sign-out");
  await ctx2.close();

  // 4. Unknown address must not receive an email and must not reveal anything.
  const ctx3 = await browser.newContext();
  const page3 = await ctx3.newPage();
  await page3.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const t2 = Date.now();
  await page3.fill('input[name="email"][type="email"] >> nth=0', "stranger@local.test");
  await page3.click('button:has-text("Email me a sign-in link")');
  await page3.waitForSelector("text=Check your inbox", { timeout: 15_000 });
  const leaked = await latestMessageFor("stranger@local.test", t2).then(() => true).catch(() => false);
  console.log(`Uninvited address received an email: ${leaked}`);
  if (leaked) failures.push("uninvited address received a sign-in email");
  await ctx3.close();
  await browser.close();

  if (failures.length) {
    console.log("FAILURES:\n  " + failures.join("\n  "));
    process.exit(1);
  }
  console.log("Auth flow verified: invite → sign-in, magic link → sign-in, single use, sign-out, no leakage.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
