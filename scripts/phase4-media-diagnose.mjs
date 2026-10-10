import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const env = await readFile(new URL("../.env", import.meta.url), "utf8");
const databaseUrl = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!databaseUrl?.includes("127.0.0.1:55432/adash_sites_dev")) throw new Error("Local database required");
process.env.DATABASE_URL = databaseUrl;
const db = new PrismaClient();
try {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "island-fresh-demo" }, include: { site: true, brand: true } });
  const assets = await db.mediaAsset.findMany({ where: { tenantId: tenant.id, originalFilename: { startsWith: "phase4-check-" } } });
  for (const asset of assets) {
    const path = resolve(".local-media", asset.storageKey);
    let bytes = 0;
    try { bytes = (await stat(path)).size; } catch {}
    const products = await db.productImage.findMany({ where: { mediaAssetId: asset.id, tenantId: tenant.id }, include: { product: true } });
    console.log(JSON.stringify({ id: asset.id, filename: asset.originalFilename, key: asset.storageKey, bytes, products: products.map(image => ({ status: image.product.status, id: image.productId })), logo: tenant.brand?.logoMediaId === asset.id, icon: tenant.brand?.iconMediaId === asset.id, published: tenant.site?.published }));
  }
} finally { await db.$disconnect(); }
