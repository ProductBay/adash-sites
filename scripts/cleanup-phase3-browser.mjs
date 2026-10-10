import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") throw new Error("Development cleanup only");
const env = await readFile(new URL("../.env", import.meta.url), "utf8");
const databaseUrl = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!databaseUrl?.includes("127.0.0.1:55432/adash_sites_dev")) throw new Error("Cleanup restricted to isolated local database");
process.env.DATABASE_URL = databaseUrl;
const db = new PrismaClient();
try {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "island-fresh-demo" } });
  const products = await db.product.findMany({ where: { tenantId: tenant.id, slug: { startsWith: "phase-three-test-" } }, select: { id: true, slug: true } });
  const locations = await db.businessLocation.findMany({ where: { tenantId: tenant.id, name: "Phase Three Pickup" }, select: { id: true, name: true } });
  console.log(JSON.stringify({ products, locations }, null, 2));
  if (process.argv.includes("--clean")) {
    if (products.length) await db.product.deleteMany({ where: { tenantId: tenant.id, id: { in: products.map(p => p.id) } } });
    if (locations.length) await db.businessLocation.deleteMany({ where: { tenantId: tenant.id, id: { in: locations.map(l => l.id) } } });
    const business = await db.businessProfile.findUnique({ where: { tenantId: tenant.id } });
    if (business?.phone === "+1-876-555-0142") await db.businessProfile.update({ where: { tenantId: tenant.id }, data: { phone: null } });
    const brand = await db.brandConfiguration.findUnique({ where: { tenantId: tenant.id } });
    if (brand?.primaryColor === "#365B46") await db.brandConfiguration.update({ where: { tenantId: tenant.id }, data: { primaryColor: "#15594A", secondaryColor: null, accentColor: "#D68B22" } });
    const site = await db.siteConfiguration.findUnique({ where: { tenantId: tenant.id } });
    if (site?.themeKey === "organic-earth") await db.siteConfiguration.update({ where: { tenantId: tenant.id }, data: { themeKey: "tropical-fresh" } });
    console.log("Cleaned listed browser-test records and restored matching test-only demo settings.");
  }
} finally { await db.$disconnect(); }
