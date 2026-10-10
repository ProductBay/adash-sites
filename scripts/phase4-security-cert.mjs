import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

const env = await readFile(new URL("../.env", import.meta.url), "utf8");
const databaseUrl = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!databaseUrl?.includes("127.0.0.1:55432/adash_sites_dev")) throw new Error("Security certification requires isolated local database");
process.env.DATABASE_URL = databaseUrl;
const db = new PrismaClient();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const islandUrl = "http://island-fresh-demo.localhost:3001", harbourUrl = "http://harbour-goods-demo.localhost:3001";
const results = [];
const test = (name, okay, detail = "") => { results.push({ name, okay }); console.log(`${okay ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const formData = async (page, button) => page.locator("form").filter({ has: page.getByRole("button", { name: button, exact: true }) }).first().evaluate(form => Object.fromEntries(new FormData(form).entries()));
const post = (context, url, form) => context.request.post(url, { multipart: form, headers: { origin: new URL(url).origin }, maxRedirects: 0 });
const denied = response => response.status() >= 400 || [303, 307, 308].includes(response.status());
async function signIn(context, slug, email = `${slug}@example.test`, password = process.env.ADASH_DEMO_PASSWORD ?? "DemoOnly-2026!ChangeMe") {
  const page = await context.newPage(), origin = `http://${slug}.localhost:3001`;
  await page.goto(`${origin}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${origin}/dashboard`);
  return page;
}
const snapshot = await db.tenant.findMany({ where: { slug: { in: ["island-fresh-demo", "harbour-goods-demo"] } }, include: { site: true, brand: true, mediaAssets: true } });
const island = snapshot.find(t => t.slug === "island-fresh-demo"), harbour = snapshot.find(t => t.slug === "harbour-goods-demo");
if (!island?.site || !harbour?.site || !island.brand || !harbour.brand || !harbour.mediaAssets.length) throw new Error("Fictional tenants incomplete");
const islandSiteBefore = island.site, harbourSiteBefore = harbour.site;
const harbourAsset = harbour.mediaAssets[0];
const harbourAssetBefore = { ...harbourAsset };
const islandProduct = await db.product.findFirstOrThrow({ where: { tenantId: island.id } });
const tempUsers = [];
const publishedVersions = [];
let contextA, contextB;
try {
  contextA = await browser.newContext(); contextB = await browser.newContext();
  const pageA = await signIn(contextA, island.slug), pageB = await signIn(contextB, harbour.slug);
  const islandToken = (await contextA.cookies(islandUrl)).find(c => c.name === "adash_sites_session");
  const harbourToken = (await contextB.cookies(harbourUrl)).find(c => c.name === "adash_sites_session");
  if (!islandToken || !harbourToken) throw new Error("Expected two authenticated sessions");
  await pageA.goto(`${islandUrl}/dashboard/media`);
  const altForm = await formData(pageA, "Save alt text"), deleteForm = await formData(pageA, "Delete unused asset");
  const altResult = await post(contextA, `${islandUrl}/dashboard/media`, { ...altForm, id: harbourAsset.id, altText: "ATTACKED ALT" });
  const altAfter = await db.mediaAsset.findUnique({ where: { id: harbourAsset.id } });
  test("Island cannot edit Harbour media", denied(altResult) && altAfter?.altText === harbourAssetBefore.altText, `HTTP ${altResult.status()}`);
  const deleteResult = await post(contextA, `${islandUrl}/dashboard/media`, { ...deleteForm, id: harbourAsset.id, confirm: "DELETE" });
  test("Island cannot delete Harbour media", denied(deleteResult) && Boolean(await db.mediaAsset.findUnique({ where: { id: harbourAsset.id } })), `HTTP ${deleteResult.status()}`);
  await pageA.goto(`${islandUrl}/dashboard/products/${islandProduct.id}`);
  const attachForm = await formData(pageA, "Add image");
  const attachResult = await post(contextA, `${islandUrl}/dashboard/products/${islandProduct.id}`, { ...attachForm, mediaAssetId: harbourAsset.id });
  const attached = await db.productImage.count({ where: { tenantId: island.id, productId: islandProduct.id, mediaAssetId: harbourAsset.id } });
  test("Island cannot attach Harbour media", denied(attachResult) && attached === 0, `HTTP ${attachResult.status()}`);
  await pageA.goto(`${islandUrl}/dashboard/brand`);
  const brandForms = await pageA.locator("form").evaluateAll(forms => forms.filter(form => form.querySelector('input[name="slot"]')).map(form => Object.fromEntries(new FormData(form).entries())));
  for (const slot of ["logo", "icon"]) {
    const source = brandForms.find(form => form.slot === slot);
    if (!source) throw new Error(`${slot} form missing`);
    const result = await post(contextA, `${islandUrl}/dashboard/brand`, { ...source, mediaAssetId: harbourAsset.id });
    const brand = await db.brandConfiguration.findUniqueOrThrow({ where: { tenantId: island.id } });
    test(`Island cannot assign Harbour ${slot}`, denied(result) && (slot === "logo" ? brand.logoMediaId : brand.iconMediaId) === (slot === "logo" ? island.brand.logoMediaId : island.brand.iconMediaId), `HTTP ${result.status()}`);
  }
  test("cross-tenant media read rejected", (await contextA.request.get(`${harbourUrl}/media/${harbourAsset.id}`)).status() === 404);
  await contextA.addCookies([{ name: islandToken.name, value: islandToken.value, url: harbourUrl, httpOnly: true, sameSite: "Lax" }]);
  await contextB.addCookies([{ name: harbourToken.name, value: harbourToken.value, url: islandUrl, httpOnly: true, sameSite: "Lax" }]);
  const previewAB = await contextA.request.get(`${harbourUrl}/dashboard/content/preview`, { maxRedirects: 0 });
  const previewBA = await contextB.request.get(`${islandUrl}/dashboard/content/preview`, { maxRedirects: 0 });
  test("authenticated Island cannot preview Harbour draft", [303, 307, 308].includes(previewAB.status()) && previewAB.headers().location?.includes("/login"), `HTTP ${previewAB.status()}`);
  test("authenticated Harbour cannot preview Island draft", [303, 307, 308].includes(previewBA.status()) && previewBA.headers().location?.includes("/login"), `HTTP ${previewBA.status()}`);
  await db.siteConfiguration.update({ where: { tenantId: island.id }, data: { draftSections: islandSiteBefore.homeSections } });
  await db.siteConfiguration.update({ where: { tenantId: harbour.id }, data: { draftSections: harbourSiteBefore.homeSections } });
  await pageA.goto(`${islandUrl}/dashboard/publish`);
  await pageB.goto(`${harbourUrl}/dashboard/publish`);
  const publishA = await formData(pageA, "Publish draft now"), publishB = await formData(pageB, "Publish draft now");
  const publishAB = await post(contextA, `${harbourUrl}/dashboard/publish`, publishA);
  const publishBA = await post(contextB, `${islandUrl}/dashboard/publish`, publishB);
  const harbourAfterAttack = await db.siteConfiguration.findUniqueOrThrow({ where: { tenantId: harbour.id } });
  const islandAfterAttack = await db.siteConfiguration.findUniqueOrThrow({ where: { tenantId: island.id } });
  test("authenticated Island cannot publish Harbour", denied(publishAB) && harbourAfterAttack.publicationVersion === harbourSiteBefore.publicationVersion && JSON.stringify(harbourAfterAttack.homeSections) === JSON.stringify(harbourSiteBefore.homeSections), `HTTP ${publishAB.status()}`);
  test("authenticated Harbour cannot publish Island", denied(publishBA) && islandAfterAttack.publicationVersion === islandSiteBefore.publicationVersion && JSON.stringify(islandAfterAttack.homeSections) === JSON.stringify(islandSiteBefore.homeSections), `HTTP ${publishBA.status()}`);
  test("denied publish creates no history", await db.sitePublication.count({ where: { tenantId: harbour.id, version: { gt: harbourSiteBefore.publicationVersion } } }) === 0 && await db.sitePublication.count({ where: { tenantId: island.id, version: { gt: islandSiteBefore.publicationVersion } } }) === 0);
  const rolePassword = `Phase4Role-${randomBytes(12).toString("hex")}`;
  for (const role of ["MANAGER", "CONTENT_EDITOR", "PRODUCT_MANAGER", "STAFF"]) {
    const salt = randomBytes(16);
    const email = `phase4-${role.toLowerCase()}-${Date.now()}@example.test`;
    const user = await db.user.create({ data: { email, passwordHash: `scrypt:${salt.toString("hex")}:${scryptSync(rolePassword, salt, 64).toString("hex")}` } });
    tempUsers.push(user.id);
    await db.tenantMembership.create({ data: { tenantId: island.id, userId: user.id, role, status: "ACTIVE" } });
    const roleContext = await browser.newContext();
    try {
      await signIn(roleContext, island.slug, email, rolePassword);
      const before = (await db.siteConfiguration.findUniqueOrThrow({ where: { tenantId: island.id } })).publicationVersion;
      const response = await post(roleContext, `${islandUrl}/dashboard/publish`, publishA);
      const after = (await db.siteConfiguration.findUniqueOrThrow({ where: { tenantId: island.id } })).publicationVersion;
      const allowed = role === "MANAGER" || role === "CONTENT_EDITOR";
      if (allowed && after > before) publishedVersions.push(after);
      test(`${role} publish permission`, allowed ? after === before + 1 : denied(response) && after === before, `HTTP ${response.status()}, version ${before}→${after}`);
      if (allowed) await db.siteConfiguration.update({ where: { tenantId: island.id }, data: { draftSections: islandSiteBefore.homeSections } });
    } finally { await roleContext.close(); }
  }
  await db.siteConfiguration.update({ where: { tenantId: island.id }, data: { draftSections: islandSiteBefore.homeSections } });
  const ownerBefore = (await db.siteConfiguration.findUniqueOrThrow({ where: { tenantId: island.id } })).publicationVersion;
  const ownerResponse = await post(contextA, `${islandUrl}/dashboard/publish`, publishA);
  const ownerAfter = (await db.siteConfiguration.findUniqueOrThrow({ where: { tenantId: island.id } })).publicationVersion;
  if (ownerAfter > ownerBefore) publishedVersions.push(ownerAfter);
  test("OWNER publish permission", ownerAfter === ownerBefore + 1, `HTTP ${ownerResponse.status()}, version ${ownerBefore}→${ownerAfter}`);
  const history = await db.sitePublication.findMany({ where: { tenantId: island.id, version: { in: publishedVersions } } });
  const publishedAudits = await db.auditEvent.findMany({ where: { tenantId: island.id, eventType: "content.published" }, select: { id: true, metadataJson: true } });
  test("allowed publish history and audit", history.length === publishedVersions.length && publishedVersions.every(version => publishedAudits.some(event => event.metadataJson?.version === version)));
} catch (error) { console.error(error); test("security certification execution", false, String(error).slice(0, 200)); }
finally {
  // Restore only the two fictional sites and records created by this certification.
  try {
    if (publishedVersions.length) {
      await db.sitePublication.deleteMany({ where: { tenantId: island.id, version: { in: publishedVersions } } });
      const audits = await db.auditEvent.findMany({ where: { tenantId: island.id, eventType: "content.published" }, select: { id: true, metadataJson: true } });
      await db.auditEvent.deleteMany({ where: { id: { in: audits.filter(event => publishedVersions.includes(event.metadataJson?.version)).map(event => event.id) } } });
    }
    await db.siteConfiguration.update({ where: { tenantId: island.id }, data: { homeSections: islandSiteBefore.homeSections ?? Prisma.DbNull, draftSections: islandSiteBefore.draftSections ?? Prisma.DbNull, publicationVersion: islandSiteBefore.publicationVersion, published: islandSiteBefore.published, publishedAt: islandSiteBefore.publishedAt } });
    await db.siteConfiguration.update({ where: { tenantId: harbour.id }, data: { homeSections: harbourSiteBefore.homeSections ?? Prisma.DbNull, draftSections: harbourSiteBefore.draftSections ?? Prisma.DbNull, publicationVersion: harbourSiteBefore.publicationVersion, published: harbourSiteBefore.published, publishedAt: harbourSiteBefore.publishedAt } });
    for (const id of tempUsers) { await db.authSession.deleteMany({ where: { userId: id } }); await db.tenantMembership.deleteMany({ where: { userId: id } }); await db.user.delete({ where: { id } }); }
  } catch (error) { console.error("CLEANUP FAILED", error); test("security test cleanup", false); }
  await contextA?.close(); await contextB?.close(); await browser.close(); await db.$disconnect();
}
if (results.some(result => !result.okay)) process.exitCode = 1;
