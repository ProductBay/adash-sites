import { z } from "zod";
import type { FeatureKey } from "@adash/site-config";

const image = z.object({ src: z.string().regex(/^\/(?:images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|avif)|media\/[A-Za-z0-9_-]+)$/), alt: z.string().min(1) });
const link = z.object({ label: z.string().min(1).max(80), href: z.string().regex(/^(#[a-z][a-z0-9-]*|https:\/\/[^\s]+)$/i) });
const base = { id: z.string().regex(/^[a-z][a-z0-9-]*$/), enabled: z.boolean(), order: z.number().int().nonnegative() };
const heading = { eyebrow: z.string().max(90).optional(), heading: z.string().min(1).max(180), body: z.string().max(700).optional() };
const product = z.object({
  id: z.string().min(1), name: z.string().min(1), description: z.string().max(220).optional(), image: image.optional(),
  price: z.number().nonnegative().nullable(), comparePrice: z.number().nonnegative().optional(), size: z.string().max(40).optional(),
  badge: z.string().max(35).optional(), available: z.boolean().default(true), featured: z.boolean().default(false),
  cta: link.optional(), variants: z.array(z.object({ name: z.string().min(1), size: z.string().optional(), price: z.number().nonnegative() })).max(8).optional(),
  category: z.object({ key: z.string(), name: z.string() }).optional()
});
export type ProductPreview = z.infer<typeof product>;
export type ProductVariantPreview = NonNullable<ProductPreview["variants"]>[number];
export type ProductBadge = NonNullable<ProductPreview["badge"]>;
export type ProductCategoryPreview = NonNullable<ProductPreview["category"]>;

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("hero"), eyebrow: z.string().max(90).optional(), headline: z.string().min(1).max(180), copy: z.string().max(450).optional(), image: image.optional(), primaryCta: link.optional(), secondaryCta: link.optional(), badges: z.array(z.string().max(35)).max(4).default([]) }),
  z.object({ ...base, type: z.literal("trustStrip"), items: z.array(z.string().min(1).max(80)).max(6) }),
  z.object({ ...base, type: z.literal("featuredProducts"), ...heading, products: z.array(product).max(8) }),
  z.object({ ...base, type: z.literal("brandStory"), ...heading, image: image.optional(), cta: link.optional(), imageSide: z.enum(["left", "right"]).default("left"), highlights: z.array(z.object({ value: z.string(), label: z.string() })).max(4).optional() }),
  z.object({ ...base, type: z.literal("featureGrid"), ...heading, items: z.array(z.object({ symbol: z.string().max(4), heading: z.string().min(1), body: z.string().max(180) })).max(8) }),
  z.object({ ...base, type: z.literal("ingredientShowcase"), ...heading, layout: z.enum(["cards", "editorial"]).default("cards"), items: z.array(z.object({ name: z.string().min(1), description: z.string().max(180), image: image.optional(), origin: z.string().max(80).optional(), benefit: z.string().max(80).optional(), badge: z.string().max(35).optional() })).max(8) }),
  z.object({ ...base, type: z.literal("productGrid"), ...heading, products: z.array(product).max(16) }),
  z.object({ ...base, type: z.literal("promoBanner"), ...heading, cta: link.optional() }),
  z.object({ ...base, type: z.literal("whatsappCta"), ...heading, cta: link.optional() }),
  z.object({ ...base, type: z.literal("testimonials"), ...heading, quotes: z.array(z.object({ quote: z.string().min(1).max(400), name: z.string().min(1), detail: z.string().max(80).optional() })).max(8) }),
  z.object({ ...base, type: z.literal("locations"), ...heading, locations: z.array(z.object({ name: z.string().min(1), address: z.string().max(180), hours: z.string().max(80).optional(), href: z.string().url().optional() })).max(8) }),
  z.object({ ...base, type: z.literal("socialGallery"), ...heading, images: z.array(image).max(8), cta: link.optional() }),
  z.object({ ...base, type: z.literal("contactCta"), ...heading, cta: link.optional() }),
  z.object({ ...base, type: z.literal("footer"), tagline: z.string().max(200).optional(), links: z.array(link).max(8).default([]) })
]);
export type SiteSection = z.infer<typeof sectionSchema>;
export type SectionType = SiteSection["type"];

export const templateRegistry = {
  "ADS-BEV-01": {
    key: "ADS-BEV-01", name: "Tropical Commerce", industry: "food-beverage", description: "An editorial storefront for food and beverage brands.",
    version: "1.0.0", status: "active", defaultTheme: "tropical-fresh",
    supportedSections: ["hero", "trustStrip", "featuredProducts", "brandStory", "featureGrid", "ingredientShowcase", "productGrid", "promoBanner", "whatsappCta", "testimonials", "locations", "socialGallery", "contactCta", "footer"] as const
  }
} as const;
export type TemplateKey = keyof typeof templateRegistry;

export function getTemplate(key: string) { return templateRegistry[key as TemplateKey] ?? null; }
export function parseSectionDocument(input: unknown, templateKey: string, onInvalid: (message: string) => void = () => {}): SiteSection[] | null {
  const template = getTemplate(templateKey);
  if (!template || !Array.isArray(input)) return null;
  const ids = new Set<string>();
  const sections: SiteSection[] = [];
  for (const item of input) {
    const result = sectionSchema.safeParse(item);
    if (!result.success || !template.supportedSections.some(type => type === result.data.type)) { onInvalid("Invalid or unsupported section skipped"); continue; }
    if (ids.has(result.data.id)) { onInvalid("Duplicate section id skipped"); continue; }
    ids.add(result.data.id);
    sections.push(result.data);
  }
  sections.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return sections.some(section => section.type === "hero" && section.enabled) ? sections : null;
}
export function parseSections(input: unknown, templateKey: string, onInvalid: (message: string) => void = () => {}): SiteSection[] | null {
  return parseSectionDocument(input, templateKey, onInvalid)?.filter(section => section.enabled) ?? null;
}

export function formatCurrency(value: number, currencyCode: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode, currencyDisplay: "code" }).format(value);
}

const sectionEntitlements: Partial<Record<SectionType, FeatureKey>> = {
  featuredProducts: "products", productGrid: "products", whatsappCta: "whatsapp_ordering",
  locations: "locations", testimonials: "testimonials"
};
export function entitledSections(sections: readonly SiteSection[], enabledFeatures: readonly FeatureKey[]): SiteSection[] {
  const enabled = new Set(enabledFeatures);
  return sections.filter(section => {
    const required = sectionEntitlements[section.type];
    return !required || enabled.has(required);
  });
}

export { demoSections } from "./demo";

export const sectionLabels: Record<SectionType, string> = {
  hero: "First impression", trustStrip: "Highlights", featuredProducts: "Featured products", brandStory: "Our story",
  featureGrid: "What makes us different", ingredientShowcase: "Ingredients and flavours", productGrid: "Product collection",
  promoBanner: "Promotion", whatsappCta: "WhatsApp", testimonials: "Customer comments", locations: "Locations",
  socialGallery: "Image gallery", contactCta: "Contact", footer: "Footer"
};

export function defaultTenantSections(businessName: string, templateKey = "ADS-BEV-01"): SiteSection[] {
  const template = getTemplate(templateKey);
  if (!template) throw new Error("Unsupported template");
  return template.supportedSections.map((type, order) => {
    const base = { id: type.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`), type, order, enabled: ["hero", "contactCta", "footer"].includes(type) };
    const title = { heading: sectionLabels[type] };
    switch (type) {
      case "hero": return sectionSchema.parse({ ...base, headline: businessName.slice(0, 180), badges: [] });
      case "trustStrip": return sectionSchema.parse({ ...base, items: [] });
      case "featuredProducts": case "productGrid": return sectionSchema.parse({ ...base, ...title, products: [] });
      case "brandStory": return sectionSchema.parse({ ...base, ...title, body: "", highlights: [] });
      case "featureGrid": case "ingredientShowcase": return sectionSchema.parse({ ...base, ...title, items: [] });
      case "testimonials": return sectionSchema.parse({ ...base, ...title, quotes: [] });
      case "locations": return sectionSchema.parse({ ...base, ...title, locations: [] });
      case "socialGallery": return sectionSchema.parse({ ...base, ...title, images: [] });
      case "footer": return sectionSchema.parse({ ...base, links: [] });
      default: return sectionSchema.parse({ ...base, ...title });
    }
  });
}

export function upgradeTenantSections(input: unknown, businessName: string, templateKey: string): SiteSection[] {
  const existing = parseSectionDocument(input, templateKey);
  if (Array.isArray(input) && input.length && (!existing || existing.length !== input.length)) throw new Error("Existing content must be repaired before upgrading");
  const preserved = existing ?? [];
  const ids = new Set(preserved.map(section => section.id));
  const missing = defaultTenantSections(businessName, templateKey).filter(section => !preserved.some(item => item.type === section.type));
  const maxOrder = Math.max(-1, ...preserved.map(section => section.order));
  const combined = [...preserved, ...missing.map((section, index) => {
    let id = section.id;
    while (ids.has(id)) id += "-new";
    ids.add(id);
    return { ...section, id, order: maxOrder + index + 1 };
  })];
  const supported = getTemplate(templateKey)!.supportedSections;
  return combined.sort((a, b) => supported.indexOf(a.type) - supported.indexOf(b.type) || a.order - b.order).map((section, order) => ({ ...section, order }));
}

export function sectionHasContent(section: SiteSection): boolean {
  if (!section.enabled) return false;
  switch (section.type) {
    case "hero": return Boolean(section.headline.trim());
    case "trustStrip": return section.items.some(item => item.trim());
    case "featuredProducts": case "productGrid": return section.products.length > 0;
    case "featureGrid": return section.items.filter(item => item.heading.trim() && item.body.trim()).length >= 3;
    case "ingredientShowcase": return section.items.some(item => item.name.trim() && item.description.trim());
    case "testimonials": return section.quotes.some(item => item.quote.trim() && item.name.trim());
    case "locations": return section.locations.some(item => item.name.trim() && item.address.trim());
    case "socialGallery": return section.images.length > 0;
    case "whatsappCta": return Boolean(section.cta);
    case "brandStory": case "promoBanner": return Boolean(section.heading.trim() && section.body?.trim());
    case "contactCta": return Boolean(section.heading.trim());
    case "footer": return true;
  }
}

export function hydrateHomepageSections(sections: SiteSection[], features: readonly FeatureKey[], products: ProductPreview[], locations: Extract<SiteSection, {type: "locations"}>["locations"], whatsappHref: string | null): SiteSection[] {
  const hydrated = sections.map(section => {
    if (section.type === "trustStrip") return { ...section, items: section.items.filter(item => item.trim()) };
    if (section.type === "featureGrid") return { ...section, items: section.items.filter(item => item.heading.trim() && item.body.trim()) };
    if (section.type === "ingredientShowcase") return { ...section, items: section.items.filter(item => item.name.trim() && item.description.trim()) };
    if (section.type === "testimonials") return { ...section, quotes: section.quotes.filter(item => item.name.trim() && item.quote.trim()) };
    if (section.type === "featuredProducts") return { ...section, products: products.filter(product => product.featured).slice(0, 8) };
    if (section.type === "productGrid") return { ...section, products: products.slice(0, 16) };
    if (section.type === "locations") return { ...section, locations: locations.filter(item => item.name.trim() && item.address.trim()).slice(0, 8) };
    if (section.type === "whatsappCta") return { ...section, cta: whatsappHref ? { label: "Chat on WhatsApp", href: whatsappHref } : undefined };
    return section;
  });
  return entitledSections(hydrated, features).filter(sectionHasContent);
}
