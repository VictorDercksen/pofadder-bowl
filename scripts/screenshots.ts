/**
 * Visual verification: signs in as each fixture role against the local stack and screenshots
 * every screen at 360 px, 390 px and 1280 px. Also captures the demo and public screens.
 * Reports horizontal overflow and console errors.
 *
 *   npm run dev   (in another terminal, with the local stack + fixtures seeded)
 *   npm run screenshots
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { FIXTURES, FIXTURE_PASSWORD } from "./seed-local-fixtures";

const BASE = process.env.SCREENSHOT_BASE ?? "http://localhost:3000";
const OUT = "screenshots";
const WIDTHS = [360, 390, 1280];
const ROLE_SCREENS: Record<string, string[]> = {
  participant: ["/my-trip", "/game-centre", "/map", "/proof", "/props", "/predictions", "/press", "/recap", "/account"],
  commissioner: ["/review", "/review/members", "/game-centre", "/map", "/proof", "/props", "/predictions", "/press", "/recap", "/account"],
  member: ["/game-centre", "/map", "/props", "/predictions", "/press", "/recap", "/account"],
};
const PUBLIC_SCREENS = ["/teaser", "/login", "/setup", "/demo/game-centre", "/demo/my-trip", "/demo/map", "/demo/proof", "/demo/review", "/demo/props", "/demo/predictions", "/demo/press", "/demo/recap", "/demo/access"];

const problems: string[] = [];

async function checkOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = doc.scrollWidth > doc.clientWidth + 1;
    const offenders: string[] = [];
    if (wide) {
      document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > doc.clientWidth + 1 && r.width > 0 && !el.closest(".leaflet-container")) offenders.push(`${el.tagName.toLowerCase()}.${(el.className && typeof el.className === "string" ? el.className : "").split(" ")[0]}`);
      });
    }
    return { wide, offenders: offenders.slice(0, 5), scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  if (overflow.wide) problems.push(`${label}: horizontal overflow ${overflow.scrollWidth}>${overflow.clientWidth} (${overflow.offenders.join(", ")})`);
}

async function shoot(page: Page, path: string, tag: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 600 ? 800 : 900 });
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (!res || res.status() >= 400) problems.push(`${tag}${path}@${width}: HTTP ${res?.status()}`);
    await page.waitForTimeout(1200);
    const label = `${tag}${path.replace(/\//g, "_") || "_root"}@${width}`;
    await checkOverflow(page, label);
    await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: true });
  }
}

async function signIn(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.getByText("Local development stack").click();
  await page.fill('input[name="email"][type="email"] >> nth=1', email);
  await page.fill('input[name="password"]', FIXTURE_PASSWORD);
  await page.click('button:has-text("Sign in (local only)")');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const consoleErrors: string[] = [];
  for (const [role, screens] of Object.entries(ROLE_SCREENS)) {
    const context = await browser.newContext({ locale: "en-ZA", timezoneId: "Africa/Johannesburg" });
    const page = await context.newPage();
    page.on("console", (m) => m.type() === "error" && !/favicon|hydrat/i.test(m.text()) && consoleErrors.push(`${role}: ${m.text().slice(0, 160)}`));
    page.on("pageerror", (e) => consoleErrors.push(`${role}: pageerror ${e.message.slice(0, 160)}`));
    await signIn(page, FIXTURES[role as keyof typeof FIXTURES].email);
    for (const path of screens) await shoot(page, path, role);
    // Mobile drawer: open it, capture, close with Escape.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${BASE}/game-centre`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.click(".pb-menu-btn");
    await page.waitForTimeout(400);
    const drawerOpen = await page.locator(".pb-drawer.open").count();
    if (!drawerOpen) problems.push(`${role}: mobile drawer did not open`);
    await page.screenshot({ path: `${OUT}/${role}_drawer@390.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    if (await page.locator(".pb-drawer.open").count()) problems.push(`${role}: drawer did not close on Escape`);
    // Keyboard navigation smoke: tab through the game centre and make sure focus moves.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/game-centre`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const focused: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      focused.push(await page.evaluate(() => `${document.activeElement?.tagName}:${(document.activeElement as HTMLElement)?.innerText?.slice(0, 20) ?? ""}`));
    }
    if (new Set(focused).size < 6) problems.push(`${role}: keyboard focus did not advance through the page (${focused.join(" | ")})`);
    await context.close();
  }
  const context = await browser.newContext({ locale: "en-ZA", timezoneId: "Africa/Johannesburg" });
  const page = await context.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`public: pageerror ${e.message.slice(0, 160)}`));
  for (const path of PUBLIC_SCREENS) await shoot(page, path, "public");
  // Demo prop board interaction: tapping a side selects it.
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${BASE}/demo/props`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const btn = page.locator(".pb-prop-sides button[aria-pressed=false]").first();
  await btn.click();
  const after = await btn.getAttribute("aria-pressed");
  if (after !== "true") problems.push("demo prop side did not select on tap");
  await context.close();
  await browser.close();

  console.log(`Screenshots written to ./${OUT}`);
  if (consoleErrors.length) console.log("Console errors:\n  " + Array.from(new Set(consoleErrors)).join("\n  "));
  if (problems.length) {
    console.log("Problems:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  console.log("No overflow or navigation problems detected.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
