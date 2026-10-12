import type { CSSProperties } from "react";
import { createTenantRepository } from "@adash/site-core";
import { hydrateTenantHomepage } from "@adash/site-core/homepage";
import { parseSectionDocument } from "@adash/site-templates";
import { TemplatePage } from "@adash/site-components";
import { countryConfig, type CountryCode } from "@adash/site-config";
import { resolveTheme, themeVariables } from "@adash/site-themes";
import { dashboardContext } from "../../../context";
import "../../../../../site-runtime/app/style.css";

export default async function ContentPreview() {
  const { tenant } = await dashboardContext("content.read");
  const repository = createTenantRepository(tenant.id);
  const [site, brand, business, features] = await Promise.all([repository.site(), repository.brand(), repository.business(), repository.enabledFeatures()]);
  if (!site || !business) throw new Error("Site configuration unavailable");
  const theme = resolveTheme(site.themeKey, brand);
  const sections = parseSectionDocument(site.draftSections ?? site.homeSections, site.templateKey) ?? [];
  const hydrated = await hydrateTenantHomepage(tenant, sections, features, business);
  const countryName = countryConfig[tenant.countryCode as CountryCode]?.name ?? tenant.countryCode;
  return <div style={theme ? themeVariables(theme) as CSSProperties : undefined}>
    <p className="notice" role="status">PREVIEW MODE — private draft for {business.displayName}. Not visible on the public site.</p>
    <TemplatePage sections={hydrated.sections} context={{ businessName: business.displayName, countryName, currencyCode: tenant.currencyCode, locale: tenant.locale, logoUrl: brand?.logoUrl, productsEnabled: features.includes("products"), whatsappBasket: Boolean(hydrated.whatsappHref), contact: { email: business.email, phone: business.phone, whatsappHref: hydrated.whatsappHref } }} />
  </div>;
}
