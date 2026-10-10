import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright-core";

const env = await readFile(new URL("../.env", import.meta.url), "utf8");
const databaseUrl = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!databaseUrl?.includes("127.0.0.1:55432/adash_sites_dev")) throw new Error("Local demo database required");
process.env.DATABASE_URL = databaseUrl;
const db = new PrismaClient();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const base = "http://island-fresh-demo.localhost:3000";
const check = (name, pass) => { console.log(`${pass ? "PASS" : "FAIL"} ${name}`); if (!pass) process.exitCode = 1; };
let variant;
let enabled;
try {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "island-fresh-demo" } });
  const product = await db.product.findUniqueOrThrow({ where: { tenantId_slug: { tenantId: tenant.id, slug: "citrus-daybreak" } } });
  const feature = await db.tenantFeature.findUniqueOrThrow({ where: { tenantId_featureKey: { tenantId: tenant.id, featureKey: "whatsapp_ordering" } } });
  enabled = feature.enabled;
  variant = await db.productVariant.create({ data: { tenantId: tenant.id, productId: product.id, name: "Phase 4 test option", size: "16 oz" } });
  await page.goto(`${base}/products/citrus-daybreak`);
  await page.getByLabel("Option").selectOption(variant.id);
  await page.getByRole("button", { name: "Add to WhatsApp basket" }).click();
  await page.goto(`${base}/basket`);
  await page.getByLabel("Quantity").fill("3");
  const link = await page.getByRole("link", { name: "Send order inquiry via WhatsApp" }).getAttribute("href");
  const decoded = link && decodeURIComponent(link.split("?text=")[1] ?? "");
  check("tenant number, product, variant, quantity, encoding", Boolean(link?.startsWith("https://wa.me/18765550123?text=") && decoded?.includes("Citrus Daybreak") && decoded?.includes("Phase 4 test option 16 oz") && decoded?.includes("Qty: 3") && link.includes("%0A")));
  check("no checkout/payment/order creation UI", (await page.locator("body").innerText()).includes("does not place or pay for an order"));
  await db.tenantFeature.update({ where: { tenantId_featureKey: { tenantId: tenant.id, featureKey: "whatsapp_ordering" } }, data: { enabled: false } });
  check("feature entitlement blocks basket", (await context.request.get(`${base}/basket`)).status() === 404);
  await page.goto(`${base}/products/citrus-daybreak`);
  check("feature entitlement blocks add action", await page.getByRole("button", { name: "Add to WhatsApp basket" }).count() === 0);
} finally {
  const tenant = await db.tenant.findUnique({ where: { slug: "island-fresh-demo" } });
  if (tenant && enabled !== undefined) await db.tenantFeature.update({ where: { tenantId_featureKey: { tenantId: tenant.id, featureKey: "whatsapp_ordering" } }, data: { enabled } });
  if (variant) await db.productVariant.delete({ where: { id: variant.id } });
  await context.close(); await browser.close(); await db.$disconnect();
}
