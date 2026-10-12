"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@adash/site-core";
import { sectionSchema, parseSectionDocument, upgradeTenantSections, getTemplate } from "@adash/site-templates";
import { dashboardContext, audit } from "../../context";

export type ContentActionState = { success?: string; error?: string };
async function authorize() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin || new URL(origin).host !== h.get("host")) throw new Error("Invalid origin");
  return dashboardContext("content.update");
}

export async function saveHomepageSection(_state: ContentActionState, form: FormData): Promise<ContentActionState> {
  try {
    const { tenant, principal } = await authorize();
    const site = await prisma.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    if (site.updatedAt.toISOString() !== String(form.get("version"))) return { error: "This draft changed. Refresh the page before saving." };
    const existing = upgradeTenantSections(site.draftSections ?? site.homeSections, tenant.name, site.templateKey);
    const payload = String(form.get("section") ?? "");
    if (payload.length > 50000) throw new Error("Section too large");
    const section = sectionSchema.parse(JSON.parse(payload));
    const original = existing.find(item => item.id === section.id);
    if (!original || original.type !== section.type || !getTemplate(site.templateKey)?.supportedSections.some(type => type === section.type)) throw new Error("Unsupported section");
    if (section.type === "hero" && !section.enabled) return { error: "The first impression section must remain visible." };
    // Operational data is always loaded from tenant records, never copied from the editor.
    if (section.type === "featuredProducts" || section.type === "productGrid") section.products = [];
    if (section.type === "locations") section.locations = [];
    if (section.type === "whatsappCta") section.cta = undefined;
    const ids = [...new Set([...JSON.stringify(section).matchAll(/\/media\/([A-Za-z0-9_-]+)/g)].map(match => match[1]))];
    if (ids.length && await prisma.mediaAsset.count({ where: { tenantId: tenant.id, id: { in: ids } } }) !== ids.length) throw new Error("Invalid media ownership");
    const document = existing.map(item => item.id === section.id ? { ...section, order: item.order } : item);
    if (!parseSectionDocument(document, site.templateKey)) throw new Error("Invalid document");
    const changed = await prisma.siteConfiguration.updateMany({ where: { tenantId: tenant.id, updatedAt: site.updatedAt }, data: { draftSections: document as Prisma.InputJsonValue } });
    if (!changed.count) return { error: "This draft changed. Refresh the page before saving." };
    await audit(tenant.id, principal.userId, "content.draft_updated", "SiteConfiguration");
    revalidatePath("/dashboard/content");
    revalidatePath("/dashboard/content/preview");
    return { success: "Draft saved. Preview it before publishing." };
  } catch { return { error: "Unable to save. Check the fields, image selections and links, then try again." }; }
}

export async function upgradeHomepageDraft(_state: ContentActionState, _form: FormData): Promise<ContentActionState> {
  void _state;
  void _form;
  try {
    const { tenant, principal } = await authorize();
    const site = await prisma.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    const sections = upgradeTenantSections(site.draftSections ?? site.homeSections, tenant.name, site.templateKey);
    const changed = await prisma.siteConfiguration.updateMany({ where: { tenantId: tenant.id, updatedAt: site.updatedAt }, data: { draftSections: sections as Prisma.InputJsonValue } });
    if (!changed.count) throw new Error("Draft changed");
    await audit(tenant.id, principal.userId, "content.structure_upgraded", "SiteConfiguration");
    revalidatePath("/dashboard/content");
    return { success: "Homepage sections added to your draft. Existing content is preserved." };
  } catch { return { error: "Unable to upgrade this draft. Refresh and try again." }; }
}
