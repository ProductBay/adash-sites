import { readFile, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { PrismaClient } from "@prisma/client";

const env = await readFile(new URL("../.env", import.meta.url), "utf8");
const databaseUrl = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!databaseUrl?.includes("127.0.0.1:55432/adash_sites_dev")) throw new Error("Local demo database required");
process.env.DATABASE_URL = databaseUrl;
const db = new PrismaClient();
const mediaRoot = resolve(".local-media");
try {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "island-fresh-demo" }, include: { brand: true, site: true } });
  const assets = await db.mediaAsset.findMany({ where: { tenantId: tenant.id, originalFilename: { startsWith: "phase4-check-" } } });
  for (const asset of assets) {
    if (!/^phase4-check-\d+\.webp$/.test(asset.originalFilename) || !new RegExp(`^${tenant.id}/[a-f0-9-]+\\.webp$`).test(asset.storageKey)) throw new Error(`Unexpected fixture ${asset.id}`);
    const target = resolve(mediaRoot, asset.storageKey);
    if (!target.startsWith(mediaRoot + sep)) throw new Error(`Unsafe path ${target}`);
    if (JSON.stringify(tenant.site?.homeSections).includes(asset.id) || JSON.stringify(tenant.site?.draftSections).includes(asset.id)) throw new Error(`Fixture in site content ${asset.id}`);
    const attachments = await db.productImage.count({ where: { tenantId: tenant.id, mediaAssetId: asset.id } });
    if (attachments) throw new Error(`Fixture still attached to product ${asset.id}`);
    console.log(`CLEAN ${asset.id} ${asset.originalFilename} ${target}`);
    if (tenant.brand?.logoMediaId === asset.id) await db.brandConfiguration.update({ where: { tenantId: tenant.id }, data: { logoMediaId: null, logoUrl: null } });
    if (tenant.brand?.iconMediaId === asset.id) await db.brandConfiguration.update({ where: { tenantId: tenant.id }, data: { iconMediaId: null, iconUrl: null } });
    await db.mediaAsset.delete({ where: { id: asset.id } });
    await unlink(target);
  }
  console.log(`Removed ${assets.length} generated browser-test media assets.`);
} finally { await db.$disconnect(); }
