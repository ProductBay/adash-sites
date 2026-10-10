import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright-core";

const env = await readFile(new URL("../.env", import.meta.url), "utf8");
const databaseUrl = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!databaseUrl?.includes("127.0.0.1:55432/adash_sites_dev")) throw Error("Local demo database required");
process.env.DATABASE_URL = databaseUrl;
const db = new PrismaClient();
const secret = "ADS-P5-local-certification-key-2026-10-08";
const path = "/api/internal/v1/sites/control", runtime = `http://island-fresh-demo.localhost:3000`, admin = `http://island-fresh-demo.localhost:3001`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const page = await browser.newPage();
const check = (label, okay) => { console.log(`${okay ? "PASS" : "FAIL"} ${label}`); if (!okay) process.exitCode = 1; };
const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "island-fresh-demo" } });
const priorControl = await db.tenantCommercialControl.findUnique({ where: { tenantId: tenant.id } });
if (priorControl) throw Error("Demo tenant already commercially linked; refusing to replace it");
const priorFeatures = await db.tenantFeature.findMany({ where: { tenantId: tenant.id } });
const auditIds = [];
const requestIds = [];
const customerId = randomUUID(), licenceId = randomUUID();
function signed(body, options = {}) {
  const raw = JSON.stringify(body), timestamp = String(options.timestamp ?? Date.now()), id = options.id ?? randomUUID();
  const signature = createHmac("sha256", secret).update(`${timestamp}.${id}.POST.${path}.${options.signedBody ?? raw}`).digest("hex");
  return { raw, id, headers: { "Content-Type": "application/json", "x-adash-timestamp": timestamp, "x-adash-request-id": id, "x-adash-signature": options.invalid ? "0".repeat(64) : signature } };
}
async function send(body, options) { const request = signed(body, options); const response = await fetch(runtime + path, { method: "POST", headers: request.headers, body: request.raw }); return { status: response.status, body: await response.json(), id: request.id }; }
const base = { action: "sync", tenantId: tenant.id, customerId, licenceId, planKey: "sites-business", status: "ACTIVE", gracePeriodEndsAt: null, entitlements: ["products", "locations", "basic_inventory", "whatsapp_ordering"] };
try {
  check("missing credential rejected", (await fetch(runtime + path, { method: "POST", body: JSON.stringify(base) })).status === 401);
  check("invalid credential rejected", (await send(base, { invalid: true })).status === 401);
  check("expired signature rejected", (await send(base, { timestamp: Date.now() - 600000 })).status === 401);
  check("tampered body rejected", (await send(base, { signedBody: JSON.stringify({ ...base, status: "SUSPENDED" }) })).status === 401);
  const active = await send(base); requestIds.push(active.id); check("signed activation", active.status === 200 && active.body.operationalStatus === "ACTIVE");
  const replay = await send(base, { id: active.id }); check("idempotent request replay", replay.status === 200 && replay.body.requestId === active.id);
  check("request ID body mismatch rejected", (await send({ ...base, status: "SUSPENDED" }, { id: active.id })).status === 409);
  check("wrong customer mapping rejected", (await send({ ...base, customerId: randomUUID() })).status === 409);
  check("wrong licence mapping rejected", (await send({ ...base, licenceId: randomUUID() })).status === 409);
  const suspended = await send({ ...base, status: "SUSPENDED", entitlements: ["products", "locations", "basic_inventory"] }); requestIds.push(suspended.id);
  check("suspension applied", suspended.status === 200 && (await db.tenant.findUnique({ where: { id: tenant.id } }))?.status === "SUSPENDED");
  await page.goto(runtime); check("public site blocked neutrally", await page.getByRole("heading", { name: "This site is temporarily unavailable." }).isVisible() && !(await page.locator("body").innerText()).includes("overdue"));
  await page.goto(`${admin}/login`); check("client login available", await page.getByRole("button", { name: "Sign in" }).isVisible());
  await page.getByLabel("Email").fill("island-fresh-demo@example.test"); await page.getByLabel("Password").fill(process.env.ADASH_DEMO_PASSWORD ?? "DemoOnly-2026!ChangeMe"); await page.getByRole("button", { name: "Sign in" }).click(); await page.waitForURL(`${admin}/dashboard`);
  await page.goto(`${admin}/dashboard`);
  await page.waitForLoadState("networkidle");
  const dashboardBody = await page.locator("body").innerText();
  check("dashboard read-only guidance available", dashboardBody.includes("Publishing and changes are paused"));
  if (!dashboardBody.includes("Publishing and changes are paused")) console.log("Dashboard status diagnostic:", (await db.tenant.findUnique({ where: { id: tenant.id } }))?.status, dashboardBody.slice(0, 350));
  const beforeDraft = (await db.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } })).draftSections;
  await page.goto(`${admin}/dashboard/content`);
  await page.getByLabel("Hero headline").fill(`Suspension denial ${Date.now()}`);
  await page.getByRole("button", { name: "Save draft" }).click().catch(() => {});
  check("suspended client mutation denied", JSON.stringify((await db.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } })).draftSections) === JSON.stringify(beforeDraft));
  const restored = await send({ ...base, entitlements: ["products", "locations", "basic_inventory"] }); requestIds.push(restored.id);
  check("reactivation applied", restored.status === 200 && (await db.tenant.findUnique({ where: { id: tenant.id } }))?.status === "ACTIVE");
  await page.goto(runtime); check("public site restored", await page.getByRole("heading", { name: "This site is temporarily unavailable." }).count() === 0 && (await page.locator("body").innerText()).includes("Island Fresh"));
  check("WhatsApp entitlement removed", (await db.tenantFeature.findUnique({ where: { tenantId_featureKey: { tenantId: tenant.id, featureKey: "whatsapp_ordering" } } }))?.enabled === false && (await fetch(`${runtime}/basket`)).status === 404);
  const logs = await db.auditEvent.findMany({ where: { tenantId: tenant.id, eventType: { startsWith: "platform." } }, orderBy: { createdAt: "desc" }, take: 10 });
  auditIds.push(...logs.filter(log => requestIds.includes(log.metadataJson?.requestId)).map(log => log.id));
  check("Sites audit receipts", auditIds.length >= 3 && logs.some(log => log.eventType === "platform.suspended") && logs.some(log => log.eventType === "platform.reactivated"));
} finally {
  const cleanupAudits = await db.auditEvent.findMany({ where: { tenantId: tenant.id, eventType: { startsWith: "platform." } }, select: { id: true, metadataJson: true } });
  auditIds.push(...cleanupAudits.filter(log => requestIds.includes(log.metadataJson?.requestId)).map(log => log.id));
  await db.$transaction(async tx => {
    await tx.auditEvent.deleteMany({ where: { id: { in: auditIds } } });
    await tx.controlRequest.deleteMany({ where: { requestId: { in: requestIds } } });
    await tx.tenantCommercialControl.deleteMany({ where: { tenantId: tenant.id, externalLicenceId: licenceId } });
    await tx.tenant.update({ where: { id: tenant.id }, data: { status: tenant.status } });
    for (const feature of priorFeatures) await tx.tenantFeature.upsert({ where: { tenantId_featureKey: { tenantId: tenant.id, featureKey: feature.featureKey } }, create: { tenantId: tenant.id, featureKey: feature.featureKey, enabled: feature.enabled }, update: { enabled: feature.enabled } });
  });
  await page.close(); await browser.close(); await db.$disconnect();
}
