import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../packages/site-core/src/index";
import { upgradeTenantSections } from "../packages/site-templates/src/index";

async function main() {
  const args = process.argv.slice(2);
  const tenantId = args.find(arg => arg.startsWith("--tenant="))?.slice(9);
  if (!tenantId || !args.includes("--staging-confirm") || process.env.ADASH_DEPLOYMENT_ENV !== "staging") throw new Error("Requires a tenant ID, --staging-confirm and ADASH_DEPLOYMENT_ENV=staging");
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, include: { domains: true, business: true, site: true } });
  if (!tenant.domains.some(domain => domain.hostname.endsWith(".staging.adash.technology"))) throw new Error("Tenant must have a staging hostname");
  const site = tenant.site;
  if (!site || site.templateKey !== "ADS-BEV-01") throw new Error("ADS-BEV-01 configuration required");
  const current = site.draftSections ?? site.homeSections;
  const sections = upgradeTenantSections(current, tenant.business?.displayName ?? tenant.name, site.templateKey);
  const added = sections.length - (Array.isArray(current) ? current.length : 0);
  if (!args.includes("--apply")) { console.log(JSON.stringify({ tenantId, missingSections: added, mode: "dry-run", published: "unchanged" })); return; }
  if (!added) { console.log(JSON.stringify({ tenantId, missingSections: 0, result: "already upgraded" })); return; }
  await prisma.$transaction(async tx => {
    const result = await tx.siteConfiguration.updateMany({ where: { tenantId, updatedAt: site.updatedAt }, data: { draftSections: sections as Prisma.InputJsonValue } });
    if (!result.count) throw new Error("Draft changed; rerun after review");
    await tx.auditEvent.create({ data: { tenantId, eventType: "content.structure_upgraded", entityType: "SiteConfiguration", metadataJson: { added, stagingOnly: true } } });
  });
  console.log(JSON.stringify({ tenantId, added, result: "draft upgraded", autoPublished: false }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Upgrade failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
