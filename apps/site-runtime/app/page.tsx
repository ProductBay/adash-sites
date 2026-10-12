import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { createTenantRepository, resolveTenant } from "@adash/site-core";
import { hydrateTenantHomepage } from "@adash/site-core/homepage";
import { countryConfig, type CountryCode } from "@adash/site-config";
import { getTemplate, parseSections } from "@adash/site-templates";
import { resolveTheme, themeVariables } from "@adash/site-themes";
import { TemplatePage } from "@adash/site-components";
import { normalizeWhatsApp } from "@adash/site-core/whatsapp";
import { TenantStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

async function loadSite() {
  const tenant = await resolveTenant((await headers()).get("host"));
  if (!tenant) return null;
  const repository = createTenantRepository(tenant.id);
  const [business, brand, site, features] = await Promise.all([repository.business(), repository.brand(), repository.site(), repository.enabledFeatures()]);
  if (!business || !site?.published || !getTemplate(site.templateKey)) return null;
  const theme = resolveTheme(site.themeKey, brand);
  if (!theme) return null;
  const sections = parseSections(site.homeSections, site.templateKey, message => console.warn(`Tenant ${tenant.id}: ${message}`));
  if (!sections) return null;
  const countryName = tenant.countryCode in countryConfig ? countryConfig[tenant.countryCode as CountryCode].name : tenant.countryCode;
  const whatsapp = features.includes("whatsapp_ordering") && business.whatsapp ? normalizeWhatsApp(business.whatsapp, tenant.countryCode) : null;
  const hydrated = await hydrateTenantHomepage(tenant, sections, features, business);
  return { tenant, business, brand, site, theme, sections: hydrated.sections, countryName, whatsapp, productsEnabled: features.includes("products") };
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
  return <div style={themeVariables(site.theme) as CSSProperties}><TemplatePage sections={site.sections} context={{ businessName: site.business.displayName, countryName: site.countryName, currencyCode: site.tenant.currencyCode, locale: site.tenant.locale, logoUrl: site.brand?.logoUrl, whatsappBasket: Boolean(site.whatsapp), productsEnabled: site.productsEnabled, contact: { email: site.business.email, phone: site.business.phone, whatsappHref } }} /></div>;
}
