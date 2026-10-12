import "server-only";
import { prisma } from "./index";
import { catalogue, currencyDigits, inventoryAvailability } from "./catalogue";
import { mediaStorage } from "./media";
import { normalizeWhatsApp } from "./whatsapp";
import { hydrateHomepageSections, type ProductPreview, type SiteSection } from "@adash/site-templates";
import type { FeatureKey } from "@adash/site-config";

export async function hydrateTenantHomepage(tenant: { id: string; currencyCode: string; countryCode: string }, sections: SiteSection[], features: FeatureKey[], business: { whatsapp: string | null; instagramUrl?: string | null; facebookUrl?: string | null; tiktokUrl?: string | null }) {
  const [products, locations, assets] = await Promise.all([
    catalogue(tenant.id).publicProducts(), catalogue(tenant.id).locations(),
    prisma.mediaAsset.findMany({ where: { tenantId: tenant.id }, select: { id: true, storageKey: true } })
  ]);
  const available = new Set((await Promise.all(assets.map(async asset => await mediaStorage.exists(asset.storageKey).catch(() => false) ? asset.id : null))).filter(Boolean));
  const imageAvailable = (src: string) => !src.startsWith("/media/") || available.has(src.slice(7));
  // Strip missing objects before rendering, without changing the stored draft or publication.
  function clean(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(clean).filter(item => item !== undefined);
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.src === "string" && !imageAvailable(record.src)) return undefined;
      return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, clean(item)]).filter(([, item]) => item !== undefined));
    }
    return value;
  }
  const cards: ProductPreview[] = products.map(product => {
    const price = product.prices.find(item => !item.variantId && item.currencyCode === tenant.currencyCode);
    const image = product.images.find(item => imageAvailable(item.url));
    return { id: product.id, name: product.name, description: product.shortDescription ?? undefined,
      image: image ? { src: image.url, alt: image.altText || product.name } : undefined,
      price: price ? Number(price.amountMinor) / 10 ** currencyDigits(tenant.currencyCode) : null,
      comparePrice: price?.compareAtMinor ? Number(price.compareAtMinor) / 10 ** currencyDigits(tenant.currencyCode) : undefined,
      available: !["OUT_OF_STOCK", "UNAVAILABLE"].includes(inventoryAvailability(product)), featured: product.featured,
      badge: product.seasonal ? "Seasonal" : undefined, cta: { label: "View details", href: `/products/${product.slug}` },
      category: product.category ? { key: product.category.slug, name: product.category.name } : undefined };
  });
  const number = features.includes("whatsapp_ordering") && business.whatsapp ? normalizeWhatsApp(business.whatsapp, tenant.countryCode) : null;
  const whatsappHref = number ? `https://wa.me/${number.slice(1)}` : null;
  const socialLinks = ([["Instagram", business.instagramUrl], ["Facebook", business.facebookUrl], ["TikTok", business.tiktokUrl]] as const).filter(([, href]) => Boolean(href)).map(([label, href]) => ({ label, href: href! }));
  const prepared = (clean(sections) as SiteSection[]).map(section => {
    if (section.type === "socialGallery") return { ...section, cta: section.cta ?? socialLinks[0] };
    if (section.type === "footer") return { ...section, links: [...section.links, ...socialLinks.filter(link => !section.links.some(existing => existing.href === link.href))].slice(0, 8) };
    return section;
  });
  const publicLocations = locations.filter(location => location.active).map(location => ({
    name: location.name, address: [location.addressLine1, location.city, location.region].filter(Boolean).join(", "),
    hours: location.openingHoursJson && typeof location.openingHoursJson === "object" && !Array.isArray(location.openingHoursJson) && "note" in location.openingHoursJson ? String(location.openingHoursJson.note ?? "") : undefined
  }));
  return { sections: hydrateHomepageSections(prepared, features, cards, publicLocations, whatsappHref), whatsappHref };
}
