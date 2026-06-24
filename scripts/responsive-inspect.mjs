#!/usr/bin/env node
/**
 * Responsive overflow inspector — visits each page at mobile/tablet/desktop widths.
 */
import { chromium } from "playwright";

const BASE = process.env.WEB_URL ?? "http://localhost:3010";
const API = process.env.API_URL ?? "http://localhost:4000/api/v1";
const VIEWPORTS = [
  { name: "320", width: 320, height: 568 },
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
];

const PUBLIC_PAGES = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password?token=test",
];

const AUTH_PAGES = [
  "/dashboard",
  "/inbox",
  "/customers",
  "/knowledge",
  "/analytics",
  "/settings",
  "/settings/team",
  "/settings/channels",
  "/settings/tags",
  "/onboarding",
];

async function getAuthToken() {
  const email = `responsive-${Date.now()}@test.local`;
  const res = await fetch(`${API}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password123",
      name: "Responsive Test",
      businessName: "Test Store BD",
    }),
  });
  const data = await res.json();
  if (!data.accessToken) throw new Error("Signup failed: " + JSON.stringify(data));
  return {
    accessToken: data.accessToken,
    orgId: data.organization?.id ?? data.organizations?.[0]?.id,
  };
}

async function checkPage(page, path, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const url = `${BASE}${path}`;
  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(500);
    const status = response?.status() ?? 0;
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
      const clientW = doc.clientWidth;
      const scrollH = doc.scrollHeight;
      const clientH = doc.clientHeight;
      const overflowing = [];
      document.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > clientW + 2 || r.left < -2) {
          const tag = el.tagName.toLowerCase();
          const cls = (el.className && typeof el.className === "string") ? el.className.slice(0, 60) : "";
          if (["script", "style", "svg", "path"].includes(tag)) return;
          overflowing.push(`${tag}${cls ? "." + cls.split(" ")[0] : ""} right=${Math.round(r.right)}`);
        }
      });
      return {
        hOverflow: scrollW > clientW + 1,
        hDiff: scrollW - clientW,
        vOverflow: scrollH > clientH + 1,
        scrollW,
        clientW,
        topOverflow: overflowing.slice(0, 5),
      };
    });
    return { path, viewport: viewport.name, status, ...overflow, ok: status < 400 && !overflow.hOverflow };
  } catch (e) {
    return { path, viewport: viewport.name, status: 0, ok: false, error: String(e) };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const issues = [];

  console.log("=== PUBLIC PAGES ===\n");
  for (const path of PUBLIC_PAGES) {
    for (const vp of VIEWPORTS) {
      const r = await checkPage(page, path, vp);
      const flag = r.ok ? "OK" : "ISSUE";
      console.log(`[${flag}] ${vp.name}px ${path} status=${r.status} hDiff=${r.hDiff ?? "?"} ${r.error ?? ""}`);
      if (!r.ok) issues.push(r);
    }
  }

  console.log("\n=== AUTHENTICATED PAGES ===\n");
  let auth;
  try {
    auth = await getAuthToken();
  } catch (e) {
    console.error("Auth setup failed:", e);
    await browser.close();
    process.exit(1);
  }

  await page.goto(BASE);
  await page.evaluate(
    ({ token, orgId }) => {
      localStorage.setItem(
        "torio-auth",
        JSON.stringify({
          state: {
            accessToken: token,
            refreshToken: "test",
            user: { id: "1", email: "t@test.local", name: "Test" },
            organizations: [{ id: orgId, name: "Test Store", slug: "test", role: "OWNER", onboardingCompleted: true }],
            currentOrganizationId: orgId,
          },
          version: 0,
        }),
      );
    },
    auth,
  );

  for (const path of AUTH_PAGES) {
    for (const vp of VIEWPORTS) {
      const r = await checkPage(page, path, vp);
      const flag = r.ok ? "OK" : "ISSUE";
      console.log(`[${flag}] ${vp.name}px ${path} status=${r.status} hDiff=${r.hDiff ?? "?"} top=${JSON.stringify(r.topOverflow ?? [])}`);
      if (!r.ok) issues.push(r);
    }
  }

  // Customer detail — need a customer id
  try {
    const custRes = await fetch(`${API}/customers?pageSize=1`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "X-Organization-Id": auth.orgId,
      },
    });
    const custData = await custRes.json();
    const custId = custData.items?.[0]?.id;
    if (custId) {
      for (const vp of VIEWPORTS) {
        const r = await checkPage(page, `/customers/${custId}`, vp);
        console.log(`[${r.ok ? "OK" : "ISSUE"}] ${vp.name}px /customers/${custId} hDiff=${r.hDiff ?? "?"}`);
        if (!r.ok) issues.push(r);
      }
    }
  } catch {}

  await browser.close();

  console.log(`\n=== SUMMARY: ${issues.length} issues ===`);
  issues.forEach((i) => console.log(JSON.stringify(i)));
  process.exit(issues.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
