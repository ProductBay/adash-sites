import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
const env = await readFile(new URL("../.env", import.meta.url), "utf8");
const databaseUrl = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!databaseUrl?.includes("127.0.0.1:55432/adash_sites_dev")) throw new Error("Database check restricted to isolated local database");
process.env.DATABASE_URL = databaseUrl;
const db = new PrismaClient();
let failures = 0;
const check = (name, pass) => { console.log(`${pass ? "PASS" : "FAIL"} ${name}`); if (!pass) failures++; };
try {
  const tenants = await db.tenant.findMany({ where: { slug: { in: ["island-fresh-demo", "harbour-goods-demo"] } }, include: { site: true, brand: true, memberships: true, products: { include: { category: true, variants: true, prices: true, images: true } }, locations: true } });
  check("two fictional tenants", tenants.length === 2);
  check("different themes", new Set(tenants.map(t => t.site?.themeKey)).size === 2);
  check("theme attack did not change Harbour", tenants.find(t => t.slug === "harbour-goods-demo")?.site?.themeKey === "luxury-artisan" && tenants.find(t => t.slug === "harbour-goods-demo")?.brand?.primaryColor === "#392F2C");
  const harbour = tenants.find(t => t.slug === "harbour-goods-demo");
  check("Harbour prices and locations unchanged", harbour?.products.find(p => p.slug === "house-cold-brew")?.prices.find(price => price.active)?.amountMinor === 120000n && harbour.locations.length === 1);
  check("active owner memberships", tenants.every(t => t.memberships.some(m => m.role === "OWNER" && m.status === "ACTIVE")));
  check("distinct catalogue and locations", tenants.every(t => t.products.length >= 3 && t.locations.length >= 1) && tenants[0]?.products[0]?.name !== tenants[1]?.products[0]?.name);
  check("product children tenant-bound", tenants.every(t => t.products.every(p => p.tenantId === t.id && (!p.category || p.category.tenantId === t.id) && p.variants.every(v => v.tenantId === t.id) && p.prices.every(price => price.tenantId === t.id) && p.images.every(image => image.tenantId === t.id))));
  check("only basic inventory active", tenants.every(t => t.products.every(p => p.inventorySource === "BASIC")));
  const events = await db.auditEvent.groupBy({ by: ["eventType"], _count: true });
  console.log("Audit event types:", events.map(e => `${e.eventType}=${e._count}`).join(", "));
  check("audit events persisted", events.some(e => e.eventType === "product.created") && events.some(e => e.eventType === "product.price_changed") && events.some(e => e.eventType === "brand.updated"));
} finally { await db.$disconnect(); }
if (failures) process.exitCode = 1;
