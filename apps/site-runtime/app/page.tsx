import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { createTenantRepository, resolveTenant } from "@adash/site-core";
import { catalogue, inventoryAvailability, currencyDigits } from "@adash/site-core/catalogue";
import { countryConfig, type CountryCode } from "@adash/site-config";
import { entitledSections, getTemplate, parseSections } from "@adash/site-templates";
import { resolveTheme, themeVariables } from "@adash/site-themes";
import { TemplatePage } from "@adash/site-components";
import { normalizeWhatsApp } from "@adash/site-core/whatsapp";
import { TenantStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

async function loadSite() {
  const tenant = await resolveTenant((await headers()).get("host"));
  if (!tenant) return null;
  const repository = createTenantRepository(tenant.id);
  const [business, brand, site, features, products, locations] = await Promise.all([repository.business(), repository.brand(), repository.site(), repository.enabledFeatures(), catalogue(tenant.id).products(true), catalogue(tenant.id).locations()]);
  if (!business || !site?.published || !getTemplate(site.templateKey)) return null;
  const theme = resolveTheme(site.themeKey, brand);
  if (!theme) return null;
  const sections = parseSections(site.homeSections, site.templateKey, message => console.warn(`Tenant ${tenant.id}: ${message}`));
  if (!sections) return null;
  const countryName = tenant.countryCode in countryConfig ? countryConfig[tenant.countryCode as CountryCode].name : tenant.countryCode;
  const whatsapp = features.includes("whatsapp_ordering") && business.whatsapp ? normalizeWhatsApp(business.whatsapp, tenant.countryCode) : null;
  const publicProducts = products.filter(p => !p.category || p.category.active).map(p => {
    const price = p.prices.find(price => !price.variantId && price.currencyCode === tenant.currencyCode);
    const image = p.images[0];
    return { id: p.id, name: p.name, description: p.shortDescription ?? undefined, image: image ? { src: image.url, alt: image.altText } : undefined, price: price ? Number(price.amountMinor) / 10 ** currencyDigits(tenant.currencyCode) : null, comparePrice: price?.compareAtMinor ? Number(price.compareAtMinor) / 10 ** currencyDigits(tenant.currencyCode) : undefined, available: !["OUT_OF_STOCK", "UNAVAILABLE"].includes(inventoryAvailability(p)), featured: p.featured, badge: p.seasonal ? "Seasonal" : undefined, cta: { label: "View details", href: `/products/${p.slug}` }, category: p.category ? { key: p.category.slug, name: p.category.name } : undefined };
  });
  const hydrated = sections.map(section => {
    if (section.type === "featuredProducts") return { ...section, products: publicProducts.filter(p => p.featured).slice(0, 8) };
    if (section.type === "productGrid") return { ...section, products: publicProducts.slice(0, 16) };
    if (section.type === "locations") return { ...section, locations: locations.filter(l => l.active).slice(0, 8).map(l => ({ name: l.name, address: [l.addressLine1, l.city, l.region].filter(Boolean).join(", "), hours: l.openingHoursJson && typeof l.openingHoursJson === "object" && !Array.isArray(l.openingHoursJson) && "note" in l.openingHoursJson ? String(l.openingHoursJson.note ?? "") : undefined })) };
    if (section.type === "contactCta") return { ...section, body: section.body?.includes("demo contact section") ? "Have a question, a collaboration in mind, or a special request? Reach out and let’s make something good happen." : section.body };
    if (section.type === "socialGallery") return { ...section, cta: business.instagramUrl ? { label: "Instagram", href: business.instagramUrl } : business.facebookUrl ? { label: "Facebook", href: business.facebookUrl } : business.tiktokUrl ? { label: "TikTok", href: business.tiktokUrl } : section.cta };
    if (section.type === "whatsappCta") return { ...section, cta: whatsapp ? { label: "Chat on WhatsApp", href: `https://wa.me/${whatsapp.slice(1)}` } : undefined };
    if (section.type === "footer") return { ...section, links: [...section.links, ...([ ["Instagram", business.instagramUrl], ["Facebook", business.facebookUrl], ["TikTok", business.tiktokUrl] ] as const).filter(([, href]) => Boolean(href)).map(([label, href]) => ({ label, href: href! }))].slice(0, 8) };
    return section;
  });
  return { tenant, business, brand, site, theme, sections: entitledSections(hydrated, features).filter(section => section.type !== "whatsappCta" || Boolean(whatsapp)), countryName, whatsapp };
}

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadSite();
  if (!site) return { title: "Site unavailable", robots: { index: false, follow: false } };
  return { title: site.site.siteTitle ?? site.business.displayName, description: site.site.siteDescription ?? site.business.description ?? `${site.business.displayName} in ${site.countryName}`, applicationName: site.business.shortName || site.business.displayName, themeColor: site.theme.primary, appleWebApp: { capable: true, title: site.business.shortName || site.business.displayName, statusBarStyle: "default" } };
}

export default async function Home() {
  const resolved = await resolveTenant((await headers()).get("host"), undefined, true);
  if (resolved?.status === TenantStatus.SUSPENDED) return <main className="suspension-page"><div><p className="eyebrow">Temporarily unavailable</p><h1>This site is temporarily unavailable.</h1><p>Please check back shortly.</p></div></main>;
  const site = await loadSite();
  if (!site) notFound();
  const whatsappHref = site.whatsapp ? `https://wa.me/${site.whatsapp.slice(1)}?text=${encodeURIComponent(`Hi ${site.business.displayName}, I'd like to get in touch.`)}` : null;
  return <div style={themeVariables(site.theme) as CSSProperties}><TemplatePage sections={site.sections} context={{ businessName: site.business.displayName, countryName: site.countryName, currencyCode: site.tenant.currencyCode, locale: site.tenant.locale, logoUrl: site.brand?.logoUrl, whatsappBasket: Boolean(site.whatsapp), contact: { email: site.business.email, phone: site.business.phone, whatsappHref } }} /></div>;
}
