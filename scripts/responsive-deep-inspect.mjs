#!/usr/bin/env node
/**
 * Deep responsive inspection: interactive states, touch targets, layout metrics.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = process.env.WEB_URL ?? "http://localhost:3010";
const API = process.env.API_URL ?? "http://localhost:4000/api/v1";
const OUT = path.join(process.cwd(), ".responsive-screenshots");

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
];

async function setupAuth(page) {
  const email = `deep-${Date.now()}@test.local`;
  const res = await fetch(`${API}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", name: "Deep Test", businessName: "Deep Store" }),
  });
  const data = await res.json();
  const token = data.accessToken;
  const orgId = data.organization?.id;

  // Import test customers
  await fetch(`${API}/customers/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Organization-Id": orgId,
    },
    body: JSON.stringify({
      rows: [
        { fullName: "Rahim Ahmed", phone: "+8801712345678", status: "NEW_LEAD" },
        { fullName: "Fatima Khan", phone: "+8801898765432", status: "CUSTOMER" },
      ],
    }),
  });

  await page.goto(BASE);
  await page.evaluate(
    ({ token, orgId }) => {
      localStorage.setItem(
        "torio-auth",
        JSON.stringify({
          state: {
            accessToken: token,
            refreshToken: "test",
            user: { id: "1", email: "t@test.local", name: "Deep Test", emailVerified: false },
            organizations: [{ id: orgId, name: "Deep Store", slug: "deep", role: "OWNER", onboardingCompleted: true }],
            currentOrganizationId: orgId,
          },
          version: 0,
        }),
      );
    },
    { token, orgId },
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const custRes = await fetch(`${API}/customers?pageSize=1`, {
    headers: { Authorization: `Bearer ${token}`, "X-Organization-Id": orgId },
  });
  const custData = await custRes.json();
  return { token, orgId, customerId: custData.items?.[0]?.id };
}

async function auditPage(page, name, vp, extra = {}) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  const metrics = await page.evaluate(() => {
    const header = document.querySelector("header");
    const main = document.querySelector("main");
    const smallTargets = [];
    document.querySelectorAll("button, a, input[type=checkbox], [role=button]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40)) {
        const label = el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 20) || el.tagName;
        smallTargets.push(`${label}(${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    });
    const doc = document.documentElement;
    return {
      hOverflow: doc.scrollWidth > doc.clientWidth + 1,
      hDiff: doc.scrollWidth - doc.clientWidth,
      headerH: header?.getBoundingClientRect().height ?? 0,
      mainTop: main?.getBoundingClientRect().top ?? 0,
      mainH: main?.getBoundingClientRect().height ?? 0,
      viewportH: window.innerHeight,
      smallTargets: smallTargets.slice(0, 8),
      clipped: Array.from(document.querySelectorAll("*")).filter((el) => {
        const s = getComputedStyle(el);
        if (s.overflow !== "hidden" && s.overflowX !== "hidden") return false;
        const r = el.getBoundingClientRect();
        return r.width > 50 && el.scrollWidth > el.clientWidth + 4;
      }).slice(0, 5).map((el) => `${el.tagName}.${String(el.className).split(" ")[0]}`),
    };
  });
  const shot = path.join(OUT, `${name}-${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: false });
  return { name, vp: vp.name, ...metrics, ...extra, shot };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  const auth = await setupAuth(page);
  const results = [];

  const scenarios = [
    { name: "dashboard", url: "/dashboard" },
    { name: "customers", url: "/customers" },
    { name: "customer-detail", url: `/customers/${auth.customerId}` },
    { name: "inbox-list", url: "/inbox" },
    { name: "settings", url: "/settings" },
    { name: "settings-team", url: "/settings/team" },
    { name: "settings-channels", url: "/settings/channels" },
    { name: "settings-tags", url: "/settings/tags" },
    { name: "knowledge", url: "/knowledge" },
    { name: "onboarding", url: "/onboarding" },
  ];

  for (const vp of VIEWPORTS) {
    for (const s of scenarios) {
      await page.goto(`${BASE}${s.url}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      results.push(await auditPage(page, s.name, vp));
    }

    // Inbox chat view
    await page.goto(`${BASE}/inbox`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const conv = page.locator('button.w-full.min-h-\\[72px\\]').first();
    if (await conv.count()) {
      await conv.click().catch(() => {});
      await page.waitForTimeout(600);
      results.push(await auditPage(page, "inbox-chat", vp));

      // Open customer sheet on mobile/tablet
      if (vp.width < 1280) {
        const profileBtn = page.locator('[aria-label="Customer profile"]');
        if (await profileBtn.count()) {
          await profileBtn.click();
          await page.waitForTimeout(400);
          results.push(await auditPage(page, "inbox-customer-sheet", vp));
          await page.keyboard.press("Escape");
        }
      }
    }

    // Mobile nav drawer
    if (vp.width < 1024) {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      const menu = page.locator('[aria-label="Open navigation menu"]');
      if (await menu.count()) {
        await menu.click();
        await page.waitForTimeout(400);
        results.push(await auditPage(page, "mobile-nav-drawer", vp));
        await page.keyboard.press("Escape");
      }
    }
  }

  // Auth pages at 375
  for (const p of ["/auth/login", "/auth/signup", "/auth/forgot-password"]) {
    await page.goto(`${BASE}${p}`);
    await page.waitForTimeout(300);
    results.push(await auditPage(page, p.replace(/\//g, "-").slice(1), { name: "375", width: 375, height: 812 }));
  }

  await browser.close();

  console.log("\n=== DEEP RESPONSIVE AUDIT ===\n");
  const problems = [];
  for (const r of results) {
    const flags = [];
    if (r.hOverflow) flags.push(`H-OVERFLOW +${r.hDiff}px`);
    if (r.smallTargets?.length) flags.push(`SMALL-TARGETS: ${r.smallTargets.join(", ")}`);
    if (r.clipped?.length) flags.push(`CLIPPED: ${r.clipped.join(", ")}`);
    if (r.mainTop > r.headerH + 2) flags.push(`MAIN-GAP header=${r.headerH} mainTop=${r.mainTop}`);
    const status = flags.length ? "ISSUE" : "OK";
    console.log(`[${status}] ${r.vp ?? "375"}px ${r.name}: ${flags.join(" | ") || "clean"}`);
    if (flags.length) problems.push(r);
  }
  console.log(`\nScreenshots: ${OUT}`);
  console.log(`Problems: ${problems.length}`);
  problems.forEach((p) => console.log(JSON.stringify(p, null, 0)));
}

main().catch(console.error);
