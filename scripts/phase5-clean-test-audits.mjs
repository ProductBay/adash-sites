import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
const env = await readFile(new URL("../.env", import.meta.url), "utf8");
const databaseUrl = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!databaseUrl?.includes("127.0.0.1:55432/adash_sites_dev")) throw Error("Local demo database required");
process.env.DATABASE_URL = databaseUrl;
const db = new PrismaClient();
try {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "island-fresh-demo" } });
  if (await db.tenantCommercialControl.findUnique({ where: { tenantId: tenant.id } })) throw Error("Tenant has a commercial link; refusing cleanup");
  const rows = await db.auditEvent.findMany({ where: { tenantId: tenant.id, actorUserId: null, eventType: { startsWith: "platform." } }, select: { id: true, eventType: true, metadataJson: true } });
  const candidates = rows.filter(row => /^[0-9a-f-]{36}$/i.test(String(row.metadataJson?.externalLicenceId)) && /^[0-9a-f-]{36}$/i.test(String(row.metadataJson?.requestId)));
  console.log(JSON.stringify(candidates.map(row => ({ id: row.id, eventType: row.eventType, requestId: row.metadataJson.requestId }))));
  if (process.argv.includes("--apply") && candidates.length) { await db.auditEvent.deleteMany({ where: { id: { in: candidates.map(row => row.id) } } }); console.log(`Removed ${candidates.length} isolated Phase 5 test audit records.`); }
} finally { await db.$disconnect(); }
