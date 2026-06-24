#!/usr/bin/env node
/**
 * End-to-end CRM API smoke test against local dev server.
 */
const API = process.env.API_URL ?? "http://localhost:4000/api/v1";
const ts = Date.now();
const email = `crm-${ts}@test.local`;
const password = "password123";

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed++;
  console.log(`  ✗ ${name}: ${detail}`);
}

async function req(method, path, { token, orgId, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (orgId) headers["X-Organization-Id"] = orgId;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function main() {
  console.log("CRM API smoke test\n");

  // Auth
  const signup = await req("POST", "/auth/signup", {
    body: { email, password, name: "CRM Tester", businessName: `CRM Store ${ts}` },
  });
  if (signup.status !== 201 && signup.status !== 200) {
    fail("POST /auth/signup", `${signup.status} ${JSON.stringify(signup.data)}`);
    process.exit(1);
  }
  ok("POST /auth/signup");

  const login = await req("POST", "/auth/login", {
    body: { email, password },
  });
  if (login.status !== 200 && login.status !== 201) {
    fail("POST /auth/login", `${login.status} ${JSON.stringify(login.data)}`);
    process.exit(1);
  }
  ok("POST /auth/login");

  const token = login.data.accessToken;
  const orgId = login.data.organizations?.[0]?.id;
  if (!token || !orgId) {
    fail("auth tokens", "missing accessToken or orgId");
    process.exit(1);
  }

  const auth = { token, orgId };

  // Customers list
  const list = await req("GET", "/customers", auth);
  list.status === 200 ? ok("GET /customers") : fail("GET /customers", `${list.status}`);

  // Import
  const imp = await req("POST", "/customers/import", {
    ...auth,
    body: {
      rows: [
        { fullName: "Alice Lead", phone: "+8801711111111", status: "NEW_LEAD" },
        { fullName: "Bob Customer", phone: "+8801722222222", status: "CUSTOMER", tags: "vip,wholesale" },
      ],
    },
  });
  imp.status === 201 || imp.status === 200
    ? ok("POST /customers/import")
    : fail("POST /customers/import", `${imp.status} ${JSON.stringify(imp.data)}`);

  const list2 = await req("GET", "/customers?pageSize=50", auth);
  const customers = list2.data?.items ?? list2.data ?? [];
  const ids = (Array.isArray(customers) ? customers : []).map((c) => c.id).filter(Boolean);

  if (ids.length < 2) {
    fail("import customers", `expected >=2, got ${ids.length}`);
  } else {
    ok(`imported ${ids.length} customers`);
  }

  // Tags
  const tag = await req("POST", "/tags", {
    ...auth,
    body: { name: `test-tag-${ts}`, color: "#6366f1" },
  });
  const tagId = tag.data?.id;
  tag.status === 201 || tag.status === 200
    ? ok("POST /tags")
    : fail("POST /tags", `${tag.status} ${JSON.stringify(tag.data)}`);

  // Bulk status update
  const bulk = await req("POST", "/customers/bulk", {
    ...auth,
    body: { customerIds: ids.slice(0, 2), status: "INTERESTED" },
  });
  bulk.status === 201 || bulk.status === 200
    ? ok("POST /customers/bulk (status)")
    : fail("POST /customers/bulk (status)", `${bulk.status} ${JSON.stringify(bulk.data)}`);

  // Bulk tag
  if (tagId) {
    const bulkTag = await req("POST", "/customers/bulk", {
      ...auth,
      body: { customerIds: ids.slice(0, 1), tagId },
    });
    bulkTag.status === 201 || bulkTag.status === 200
      ? ok("POST /customers/bulk (tag)")
      : fail("POST /customers/bulk (tag)", `${bulkTag.status} ${JSON.stringify(bulkTag.data)}`);
  }

  // Customer detail
  const detail = await req("GET", `/customers/${ids[0]}`, auth);
  detail.status === 200 ? ok("GET /customers/:id") : fail("GET /customers/:id", `${detail.status}`);

  // Update
  const upd = await req("PATCH", `/customers/${ids[0]}`, {
    ...auth,
    body: { fullName: "Alice Updated", status: "FOLLOW_UP" },
  });
  upd.status === 200 ? ok("PATCH /customers/:id") : fail("PATCH /customers/:id", `${upd.status}`);

  // Assign self
  const userId = login.data.user?.id;
  const assign = await req("POST", `/customers/${ids[0]}/assign`, {
    ...auth,
    body: { assignedToId: userId },
  });
  assign.status === 201 || assign.status === 200
    ? ok("POST /customers/:id/assign")
    : fail("POST /customers/:id/assign", `${assign.status} ${JSON.stringify(assign.data)}`);

  // Activities
  const acts = await req("GET", `/customers/${ids[0]}/activities`, auth);
  acts.status === 200 ? ok("GET /customers/:id/activities") : fail("activities", `${acts.status}`);

  // Notes
  const note = await req("POST", "/notes", {
    ...auth,
    body: { customerId: ids[0], content: "Test note from CRM smoke test" },
  });
  note.status === 201 || note.status === 200
    ? ok("POST /notes")
    : fail("POST /notes", `${note.status} ${JSON.stringify(note.data)}`);

  // Segments
  const segs = await req("GET", "/segments", auth);
  segs.status === 200 ? ok("GET /segments") : fail("GET /segments", `${segs.status}`);

  // Analytics
  const analytics = await req("GET", "/customers/analytics/summary", auth);
  analytics.status === 200
    ? ok("GET /customers/analytics/summary")
    : fail("analytics", `${analytics.status} ${JSON.stringify(analytics.data)}`);

  // CRM settings
  const crmGet = await req("GET", "/customers/crm-settings", auth);
  crmGet.status === 200 ? ok("GET /customers/crm-settings") : fail("crm-settings get", `${crmGet.status}`);

  const crmPatch = await req("PATCH", "/customers/crm-settings", {
    ...auth,
    body: { autoAssignmentEnabled: true, autoAssignmentStrategy: "ROUND_ROBIN" },
  });
  crmPatch.status === 200
    ? ok("PATCH /customers/crm-settings")
    : fail("crm-settings patch", `${crmPatch.status} ${JSON.stringify(crmPatch.data)}`);

  // Team performance
  const team = await req("GET", "/analytics/team-performance", auth);
  team.status === 200
    ? ok("GET /analytics/team-performance")
    : fail("team-performance", `${team.status} ${JSON.stringify(team.data)}`);

  // Team members
  const members = await req("GET", "/team", auth);
  members.status === 200 ? ok("GET /team") : fail("GET /team", `${members.status}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
