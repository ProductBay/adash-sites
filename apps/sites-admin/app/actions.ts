"use server";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@adash/site-core";
import { productInput, priceInput, parseMoney, imageUrlSchema, slugSchema } from "@adash/site-core/catalogue";
import { isThemeKey, resolveTheme, themePresets } from "@adash/site-themes";
import { parseSectionDocument, sectionSchema } from "@adash/site-templates";
import { normalizeWhatsApp } from "@adash/site-core/whatsapp";
import { mediaUrl } from "@adash/site-core/media";
import { dashboardContext as resolveContext, audit } from "./context";
import type { Permission } from "@adash/site-auth";

async function dashboardContext(permission?: Permission, feature?: string) {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new Error("Invalid request origin");
  return resolveContext(permission, feature);
}

const val = (f: FormData, key: string) => String(f.get(key) ?? "").trim();
const optional = (f: FormData, key: string) => val(f, key) || null;
const checked = (f: FormData, key: string) => f.get(key) === "on";
const intOrNull = (f: FormData, key: string) => val(f, key) === "" ? null : Number(val(f, key));
function problem(error: unknown): never { if (error instanceof z.ZodError) throw new Error(error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")); throw error; }

export async function saveProduct(form: FormData) {
  const { tenant, principal } = await dashboardContext("product.update", "products");
  const id = optional(form, "id");
  if (!id) { const { can } = await import("@adash/site-auth"); if (!can(principal.role, "product.create")) throw new Error("Forbidden"); }
  const input = productInput.safeParse({ name: val(form, "name"), slug: val(form, "slug"), shortDescription: val(form, "shortDescription"), description: val(form, "description"), categoryId: optional(form, "categoryId") ?? undefined, featured: checked(form, "featured"), seasonal: checked(form, "seasonal"), trackQuantity: checked(form, "trackQuantity"), quantityOnHand: intOrNull(form, "quantityOnHand"), lowStockThreshold: intOrNull(form, "lowStockThreshold"), availabilityStatus: val(form, "availabilityStatus") });
  if (!input.success) problem(input.error);
  if (input.data.categoryId && !await prisma.productCategory.findFirst({ where: { tenantId: tenant.id, id: input.data.categoryId } })) notFound();
  const existing = id ? await prisma.product.findFirst({ where: { id, tenantId: tenant.id } }) : null;
  if (id && !existing) notFound();
  if ((existing && (existing.trackQuantity !== input.data.trackQuantity || existing.quantityOnHand !== input.data.quantityOnHand || existing.lowStockThreshold !== input.data.lowStockThreshold || existing.availabilityStatus !== input.data.availabilityStatus)) || (!existing && (input.data.trackQuantity || input.data.quantityOnHand !== null || input.data.lowStockThreshold !== null || input.data.availabilityStatus !== "IN_STOCK"))) await dashboardContext("inventory.update", "basic_inventory");
  const product = await prisma.product.upsert({ where: { id: existing?.id ?? "__new__" }, create: { ...input.data, tenantId: tenant.id }, update: input.data });
  await audit(tenant.id, principal.userId, existing ? "product.updated" : "product.created", "Product", product.id, { oldName: existing?.name ?? null, newName: product.name });
  if (existing && (existing.quantityOnHand !== product.quantityOnHand || existing.lowStockThreshold !== product.lowStockThreshold || existing.availabilityStatus !== product.availabilityStatus || existing.trackQuantity !== product.trackQuantity)) await audit(tenant.id, principal.userId, "inventory.changed", "Product", product.id, { oldQuantity: existing.quantityOnHand, newQuantity: product.quantityOnHand, oldAvailability: existing.availabilityStatus, newAvailability: product.availabilityStatus });
  revalidatePath("/dashboard/products");
  redirect(`/dashboard/products/${product.id}`);
}

export async function setProductStatus(form: FormData) {
  const status = z.nativeEnum(ProductStatus).parse(val(form, "status"));
  const { tenant, principal } = await dashboardContext(status === "ARCHIVED" ? "product.archive" : "product.publish", "products");
  const id = val(form, "id");
  const result = await prisma.product.updateMany({ where: { id, tenantId: tenant.id }, data: { status, publishedAt: status === "ACTIVE" ? new Date() : null } });
  if (!result.count) notFound();
  await audit(tenant.id, principal.userId, status === "ARCHIVED" ? "product.archived" : status === "DRAFT" ? "product.unpublished" : "product.published", "Product", id, { status });
  revalidatePath("/dashboard/products");
}

export async function savePrice(form: FormData) {
  const { tenant, principal } = await dashboardContext("product.price.update", "products");
  const productId = val(form, "productId");
  if (!await prisma.product.findFirst({ where: { tenantId: tenant.id, id: productId } })) notFound();
  const input = priceInput.safeParse({ currencyCode: tenant.currencyCode, amountMinor: parseMoney(val(form, "amount"), tenant.currencyCode), compareAtMinor: optional(form, "compareAt") ? parseMoney(val(form, "compareAt"), tenant.currencyCode) : null });
  if (!input.success) problem(input.error);
  const old = await prisma.productPrice.findFirst({ where: { tenantId: tenant.id, productId, variantId: null, active: true } });
  await prisma.$transaction(async tx => {
    await tx.productPrice.updateMany({ where: { tenantId: tenant.id, productId, variantId: null, active: true }, data: { active: false } });
    await tx.productPrice.create({ data: { ...input.data, tenantId: tenant.id, productId } });
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: principal.userId, eventType: "product.price_changed", entityType: "Product", entityId: productId, metadataJson: { before: old?.amountMinor.toString() ?? null, after: input.data.amountMinor.toString() } } });
  });
  revalidatePath("/dashboard/products");
}

export async function saveCategory(form: FormData) {
  const { tenant, principal } = await dashboardContext("product.update", "products");
  const input = z.object({ name: z.string().trim().min(2).max(100), slug: slugSchema, description: z.string().max(500), sortOrder: z.number().int().min(0).max(10000), active: z.boolean() }).parse({ name: val(form, "name"), slug: val(form, "slug"), description: val(form, "description"), sortOrder: Number(val(form, "sortOrder") || 0), active: checked(form, "active") });
  const id = optional(form, "id");
  const old = id ? await prisma.productCategory.findFirst({ where: { tenantId: tenant.id, id } }) : null;
  if (id && !old) notFound();
  const category = await prisma.productCategory.upsert({ where: { id: old?.id ?? "__new__" }, create: { ...input, tenantId: tenant.id }, update: input });
  await audit(tenant.id, principal.userId, old ? "category.updated" : "category.created", "ProductCategory", category.id);
  revalidatePath("/dashboard/categories");
}

export async function saveVariant(form: FormData) {
  const { tenant, principal } = await dashboardContext("product.update", "products");
  const productId = val(form, "productId");
  if (!await prisma.product.findFirst({ where: { tenantId: tenant.id, id: productId } })) notFound();
  const data = z.object({ name: z.string().trim().min(1).max(80), size: z.string().max(40), unit: z.string().max(40), sku: z.string().max(80) }).parse({ name: val(form, "name"), size: val(form, "size"), unit: val(form, "unit"), sku: val(form, "sku") });
  const id = optional(form, "id");
  const old = id ? await prisma.productVariant.findFirst({ where: { tenantId: tenant.id, productId, id } }) : null;
  if (id && !old) notFound();
  const variant = await prisma.productVariant.upsert({ where: { id: old?.id ?? "__new__" }, create: { tenantId: tenant.id, productId, ...data, sku: data.sku || null }, update: { ...data, sku: data.sku || null, active: checked(form, "active") } });
  await audit(tenant.id, principal.userId, old ? "product.variant_updated" : "product.variant_created", "ProductVariant", variant.id);
  revalidatePath(`/dashboard/products/${productId}`);
}

export async function saveVariantPrice(form: FormData) {
  const { tenant, principal } = await dashboardContext("product.price.update", "products");
  const productId = val(form, "productId");
  const variantId = val(form, "variantId");
  const variant = await prisma.productVariant.findFirst({ where: { tenantId: tenant.id, productId, id: variantId } });
  if (!variant) notFound();
  const input = priceInput.parse({ currencyCode: tenant.currencyCode, amountMinor: parseMoney(val(form, "amount"), tenant.currencyCode), compareAtMinor: optional(form, "compareAt") ? parseMoney(val(form, "compareAt"), tenant.currencyCode) : null });
  const old = await prisma.productPrice.findFirst({ where: { tenantId: tenant.id, productId, variantId, active: true } });
  await prisma.$transaction(async tx => {
    await tx.productPrice.updateMany({ where: { tenantId: tenant.id, productId, variantId, active: true }, data: { active: false } });
    await tx.productPrice.create({ data: { ...input, tenantId: tenant.id, productId, variantId } });
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: principal.userId, eventType: "product.price_changed", entityType: "ProductVariant", entityId: variantId, metadataJson: { before: old?.amountMinor.toString() ?? null, after: input.amountMinor.toString() } } });
  });
  revalidatePath(`/dashboard/products/${productId}`);
}

export async function saveImage(form: FormData) {
  const { tenant, principal } = await dashboardContext("product.update", "products");
  const productId = val(form, "productId");
  if (!await prisma.product.findFirst({ where: { tenantId: tenant.id, id: productId } })) notFound();
  const url = imageUrlSchema.parse(val(form, "url"));
  const altText = z.string().min(1).max(180).parse(val(form, "altText"));
  const image = await prisma.productImage.create({ data: { tenantId: tenant.id, productId, url, altText, isPrimary: true } });
  await audit(tenant.id, principal.userId, "product.image_added", "ProductImage", image.id);
  revalidatePath(`/dashboard/products/${productId}`);
}

export async function saveBusiness(form: FormData) {
  const { tenant, principal } = await dashboardContext("business.update");
  const text = z.string().max(500);
  const url = z.union([z.literal(""), z.string().url().startsWith("https://")]);
  const phone = z.string().max(50).regex(/^[+()0-9 .-]*$/);
  const data = { displayName: z.string().trim().min(2).max(120).parse(val(form, "displayName")), shortName: text.parse(val(form, "shortName")), description: z.string().max(2000).parse(val(form, "description")), email: z.union([z.literal(""), z.string().email()]).parse(val(form, "email")), phone: phone.parse(val(form, "phone")), whatsapp: phone.parse(val(form, "whatsapp")), addressLine1: text.parse(val(form, "addressLine1")), addressLine2: text.parse(val(form, "addressLine2")), city: text.parse(val(form, "city")), region: text.parse(val(form, "region")), postalCode: text.parse(val(form, "postalCode")), websiteUrl: url.parse(val(form, "websiteUrl")), instagramUrl: url.parse(val(form, "instagramUrl")), facebookUrl: url.parse(val(form, "facebookUrl")), tiktokUrl: url.parse(val(form, "tiktokUrl")) };
  const whatsapp = data.whatsapp ? normalizeWhatsApp(data.whatsapp, tenant.countryCode) : null;
  if (data.whatsapp && !whatsapp) throw new Error("Enter a valid international WhatsApp number, or a supported national number");
  await prisma.businessProfile.update({ where: { tenantId: tenant.id }, data: { ...data, whatsapp } });
  await audit(tenant.id, principal.userId, "business.updated", "BusinessProfile");
  revalidatePath("/dashboard/business");
}

export async function saveLocation(form: FormData) {
  const id = optional(form, "id");
  const { tenant, principal } = await dashboardContext(id ? "location.update" : "location.create", "locations");
  const input = z.object({ name: z.string().trim().min(2).max(100), type: z.enum(["STORE", "PICKUP", "OFFICE", "RETAILER", "DISTRIBUTOR"]), addressLine1: z.string().max(180), addressLine2: z.string().max(180), city: z.string().max(100), region: z.string().max(100), postalCode: z.string().max(40), phone: z.string().max(80), active: z.boolean() }).parse({ name: val(form, "name"), type: val(form, "type"), addressLine1: val(form, "addressLine1"), addressLine2: val(form, "addressLine2"), city: val(form, "city"), region: val(form, "region"), postalCode: val(form, "postalCode"), phone: val(form, "phone"), active: checked(form, "active") });
  const hours = z.string().max(180).parse(val(form, "hours"));
  const old = id ? await prisma.businessLocation.findFirst({ where: { id, tenantId: tenant.id } }) : null;
  if (id && !old) notFound();
  const location = await prisma.businessLocation.upsert({ where: { id: old?.id ?? "__new__" }, create: { ...input, tenantId: tenant.id, countryCode: tenant.countryCode, openingHoursJson: { note: hours } }, update: { ...input, openingHoursJson: { note: hours } } });
  await audit(tenant.id, principal.userId, old ? "location.updated" : "location.created", "BusinessLocation", location.id);
  revalidatePath("/dashboard/locations");
}

export async function deleteLocation(form: FormData) {
  const { tenant, principal } = await dashboardContext("location.delete", "locations");
  if (val(form, "confirm") !== "DELETE") throw new Error("Confirm deletion");
  const id = val(form, "id");
  const result = await prisma.businessLocation.deleteMany({ where: { tenantId: tenant.id, id } });
  if (!result.count) notFound();
  await audit(tenant.id, principal.userId, "location.deleted", "BusinessLocation", id);
  revalidatePath("/dashboard/locations");
}

export async function saveBrand(form: FormData) {
  const { tenant, principal } = await dashboardContext("brand.update");
  await dashboardContext("brand.theme.update");
  const themeKey = val(form, "themeKey");
  if (!isThemeKey(themeKey)) throw new Error("Unsupported theme");
  const color = z.union([z.literal(""), z.string().regex(/^#[0-9A-Fa-f]{6}$/)]);
  const colors = { primaryColor: color.parse(val(form, "primaryColor")) || null, secondaryColor: color.parse(val(form, "secondaryColor")) || null, accentColor: color.parse(val(form, "accentColor")) || null };
  const resolved = resolveTheme(themeKey, colors);
  if (!resolved || (colors.primaryColor && resolved.primary.toLowerCase() !== colors.primaryColor.toLowerCase()) || (colors.secondaryColor && resolved.secondary.toLowerCase() !== colors.secondaryColor.toLowerCase()) || (colors.accentColor && resolved.accent.toLowerCase() !== colors.accentColor.toLowerCase())) throw new Error("Colors do not meet contrast requirements");
  const old = await prisma.brandConfiguration.findUnique({ where: { tenantId: tenant.id } });
  const site = await prisma.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } });
  await prisma.$transaction(async tx => {
    await tx.brandConfiguration.update({ where: { tenantId: tenant.id }, data: colors });
    await tx.siteConfiguration.update({ where: { tenantId: tenant.id }, data: { themeKey } });
    if (site.themeKey !== themeKey) await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: principal.userId, eventType: "brand.theme_changed", entityType: "SiteConfiguration", metadataJson: { before: site.themeKey, after: themeKey } } });
    if (old?.primaryColor !== colors.primaryColor || old?.secondaryColor !== colors.secondaryColor || old?.accentColor !== colors.accentColor) await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: principal.userId, eventType: "brand.colors_changed", entityType: "BrandConfiguration", metadataJson: { oldPrimary: old?.primaryColor ?? null, newPrimary: colors.primaryColor, oldSecondary: old?.secondaryColor ?? null, newSecondary: colors.secondaryColor, oldAccent: old?.accentColor ?? null, newAccent: colors.accentColor } } });
  });
  revalidatePath("/dashboard/brand");
}

export async function resetBrand(form: FormData) {
  if (val(form, "confirm") !== "RESET") throw new Error("Confirm reset");
  const { tenant, principal } = await dashboardContext("brand.theme.update");
  await dashboardContext("brand.update");
  const site = await prisma.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } });
  const preset = themePresets[isThemeKey(site.themeKey) ? site.themeKey : "tropical-fresh"];
  await prisma.brandConfiguration.update({ where: { tenantId: tenant.id }, data: { primaryColor: preset.primary, secondaryColor: preset.secondary, accentColor: preset.accent } });
  await audit(tenant.id, principal.userId, "brand.reset", "BrandConfiguration");
  revalidatePath("/dashboard/brand");
}

export async function saveContent(form: FormData) {
  const { tenant, principal } = await dashboardContext("content.update");
  const site = await prisma.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } });
  const sections = parseSectionDocument(site.draftSections ?? site.homeSections, site.templateKey);
  if (!sections) throw new Error("Site content unavailable");
  const imageFor = async (field: string) => { const id = optional(form, field); if (!id) return undefined; const asset = await prisma.mediaAsset.findFirst({ where: { tenantId: tenant.id, id } }); if (!asset) notFound(); return { src: mediaUrl(asset.id), alt: asset.altText || asset.originalFilename }; };
  const heroImage = await imageFor("heroMediaId");
  const storyImage = await imageFor("storyMediaId");
  const updated = sections.map(section => {
    if (!section.enabled) return section;
    if (section.type === "hero") return { ...section, headline: z.string().min(1).max(180).parse(val(form, "headline")), copy: z.string().max(450).parse(val(form, "heroCopy")), image: heroImage ?? section.image };
    if (section.type === "trustStrip") return { ...section, items: z.array(z.string().min(1).max(80)).max(6).parse(val(form, "trustItems").split("\n").map(item => item.trim()).filter(Boolean)) };
    if (section.type === "brandStory") return { ...section, heading: z.string().min(1).max(180).parse(val(form, "storyHeading")), body: z.string().max(700).parse(val(form, "story")), image: storyImage ?? section.image };
    if (section.type === "featureGrid") return { ...section, items: section.items.map((item, index) => ({ ...item, heading: z.string().min(1).max(180).parse(val(form, `feature${index}Heading`)), body: z.string().max(180).parse(val(form, `feature${index}Body`)) })) };
    if (section.type === "contactCta") return { ...section, heading: z.string().min(1).max(180).parse(val(form, "contactHeading")), body: z.string().max(700).parse(val(form, "contactBody")) };
    if (section.type === "footer") return { ...section, tagline: z.string().max(200).parse(val(form, "footer")) };
    return section;
  });
  const validated = z.array(sectionSchema).parse(updated);
  await prisma.siteConfiguration.update({ where: { tenantId: tenant.id }, data: { draftSections: validated as Prisma.InputJsonValue } });
  await audit(tenant.id, principal.userId, "content.draft_updated", "SiteConfiguration");
  revalidatePath("/dashboard/content");
}

export async function publishContent() {
  const { tenant, principal } = await dashboardContext("content.publish");
  const site = await prisma.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } });
  const sections = parseSectionDocument(site.draftSections, site.templateKey);
  if (!sections) throw new Error("No valid draft to publish");
  const referencedIds = [...new Set([...JSON.stringify(sections).matchAll(/\/media\/([A-Za-z0-9_-]+)/g)].map(match => match[1]))];
  if (referencedIds.length && await prisma.mediaAsset.count({ where: { tenantId: tenant.id, id: { in: referencedIds } } }) !== referencedIds.length) throw new Error("Draft includes media not owned by this tenant");
  const version = site.publicationVersion + 1;
  const checksum = createHash("sha256").update(JSON.stringify(sections)).digest("hex");
  try {
    await prisma.$transaction(async tx => {
      const updated = await tx.siteConfiguration.updateMany({ where: { tenantId: tenant.id, publicationVersion: site.publicationVersion, updatedAt: site.updatedAt }, data: { homeSections: sections as Prisma.InputJsonValue, draftSections: Prisma.DbNull, published: true, publishedAt: new Date(), publicationVersion: version } });
      if (!updated.count) throw new Error("Draft changed; refresh before publishing");
      await tx.sitePublication.create({ data: { tenantId: tenant.id, publishedByUserId: principal.userId, version, sections: sections as Prisma.InputJsonValue, checksum } });
      await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: principal.userId, eventType: "content.published", entityType: "SiteConfiguration", metadataJson: { version, checksum } } });
    });
  } catch (error) { await audit(tenant.id, principal.userId, "content.publish_failed", "SiteConfiguration", undefined, { version }); throw error; }
  revalidatePath("/dashboard/content");
}
