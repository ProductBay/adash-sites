import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@adash/site-core";
import { createS3MediaStorage, localStorage } from "@adash/site-core/media";

const args = new Set(process.argv.slice(2));
const tenantArgument = [...args].find(value => value.startsWith("--tenant="));
const tenantId = tenantArgument?.slice("--tenant=".length);
const all = args.has("--all");

async function main() {
  if (!args.has("--staging-confirm") || process.env.ADASH_DEPLOYMENT_ENV === "production") throw new Error("This utility is staging-only; pass --staging-confirm outside production");
  if (process.env.ADASH_MEDIA_DRIVER !== "s3") throw new Error("ADASH_MEDIA_DRIVER must be s3");
  if (all === Boolean(tenantId)) throw new Error("Choose exactly one of --all or --tenant=<tenant-id>");

  const destination = createS3MediaStorage();
  const assets = await prisma.mediaAsset.findMany({ where: tenantId ? { tenantId } : undefined, orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }] });
  const report = { inspected: assets.length, migrated: [] as string[], alreadyPresent: [] as string[], missingSource: [] as string[], conflicts: [] as string[] };

  for (const asset of assets) {
    if (!await localStorage.exists(asset.storageKey)) { report.missingSource.push(asset.id); continue; }
    const source = await localStorage.get(asset.storageKey);
    if (await destination.exists(asset.storageKey)) {
      const existing = await destination.get(asset.storageKey);
      const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
      if (existing.length === source.length && existing.length === asset.sizeBytes && digest(existing) === digest(source)) report.alreadyPresent.push(asset.id);
      else report.conflicts.push(asset.id);
      continue;
    }
    await destination.put(asset.storageKey, source);
    report.migrated.push(asset.id);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().finally(() => prisma.$disconnect());
