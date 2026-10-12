import { prisma, createTenantRepository } from "@adash/site-core";
import { hydrateTenantHomepage } from "@adash/site-core/homepage";
import { mediaStorage } from "@adash/site-core/media";
import { parseSectionDocument, upgradeTenantSections } from "@adash/site-templates";
import { dashboardContext } from "../../context";
import { AdminHelpPanel } from "../help";
import { HomepageBuilder } from "./builder";

export default async function Content() {
  const { tenant } = await dashboardContext("content.read");
  const repository = createTenantRepository(tenant.id);
  const [site, business, features, assets] = await Promise.all([
    repository.site(), repository.business(), repository.enabledFeatures(),
    prisma.mediaAsset.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  if (!site || !business) throw new Error("Site configuration unavailable");
  const existing = parseSectionDocument(site.draftSections ?? site.homeSections, site.templateKey) ?? [];
  const sections = upgradeTenantSections(site.draftSections ?? site.homeSections, business.displayName, site.templateKey);
  const hydrated = await hydrateTenantHomepage(tenant, sections.map(section => ({ ...section, enabled: true })), features, business);
  const ready = new Set(hydrated.sections.map(section => section.id));
  const media = await Promise.all(assets.map(async asset => ({ id: asset.id, filename: asset.originalFilename, alt: asset.altText, available: await mediaStorage.exists(asset.storageKey).catch(() => false) })));
  const statuses = Object.fromEntries(sections.map(section => [section.id, ready.has(section.id) ? "Ready" : section.type === "featuredProducts" ? "Waiting for featured products" : section.type === "productGrid" ? "Waiting for products" : section.type === "locations" ? "Waiting for locations" : section.type === "whatsappCta" ? "Needs WhatsApp and plan access" : "Needs content or plan access"]));
  return <main><p className="eyebrow">Your site</p><h1>Site content</h1><p>Edit a section, save a private draft, preview, then publish when ready.</p><AdminHelpPanel section="content" />{site.draftSections && <p className="notice">You have unpublished changes.</p>}
    <HomepageBuilder sections={sections} version={site.updatedAt.toISOString()} media={media} statuses={statuses} missing={existing.length < sections.length} />
    <section className="panel"><h2>Ready to publish?</h2><a href="/dashboard/content/preview" target="_blank" rel="noopener noreferrer">Preview draft</a><p><a href="/dashboard/publish">Publish status and history</a></p></section>
  </main>;
}
