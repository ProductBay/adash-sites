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
