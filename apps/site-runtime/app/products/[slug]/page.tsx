import type { CSSProperties } from "react";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveTenant, createTenantRepository } from "@adash/site-core";
import { catalogue, formatMinor, inventoryAvailability } from "@adash/site-core/catalogue";
import { resolveTheme, themeVariables } from "@adash/site-themes";
import { normalizeWhatsApp } from "@adash/site-core/whatsapp";
import { AddToBasket } from "../../basket-controls";

export const dynamic = "force-dynamic";

export default async function ProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const tenant = await resolveTenant((await headers()).get("host"));
  if (!tenant) notFound();
  const repo = createTenantRepository(tenant.id);
  const [product, business, brand, site, features] = await Promise.all([
    catalogue(tenant.id).publicBySlug((await params).slug), repo.business(), repo.brand(), repo.site(), repo.enabledFeatures()
  ]);
  if (!product || !site?.published || !features.includes("products") || (product.category && !product.category.active)) notFound();
  const theme = resolveTheme(site.themeKey, brand);
  if (!theme) notFound();
  const price = product.prices.find(item => !item.variantId && item.currencyCode === tenant.currencyCode);
  const availability = inventoryAvailability(product);
  const whatsapp = features.includes("whatsapp_ordering") && business?.whatsapp && normalizeWhatsApp(business.whatsapp, tenant.countryCode);

  return <main className="product-detail" style={themeVariables(theme) as CSSProperties}>
    <a href="/products">← Back to products</a>
    <div className="product-detail-grid">
      <div className="product-detail-images">{product.images.map(image => <Image key={image.id} src={image.url} alt={image.altText} width={800} height={800} unoptimized={image.url.startsWith("/media/")} />)}</div>
      <div><p className="eyebrow">{product.category?.name ?? "Collection"}</p><h1>{product.name}</h1><p>{product.description ?? product.shortDescription}</p><p className="product-detail-price">{price ? formatMinor(price.amountMinor, tenant.currencyCode, tenant.locale) : "Price on request"}</p><p>{availability.replaceAll("_", " ").toLowerCase()}</p>{product.variants.length > 0 && <><h2>Options</h2><ul>{product.variants.map(variant => <li key={variant.id}>{variant.name} {variant.size} {variant.prices[0] ? `— ${formatMinor(variant.prices[0].amountMinor, tenant.currencyCode, tenant.locale)}` : ""}</li>)}</ul></>}{whatsapp && !["OUT_OF_STOCK", "UNAVAILABLE"].includes(availability) ? <AddToBasket tenantSlug={tenant.slug} productId={product.id} variants={product.variants.map(variant => ({ id: variant.id, name: variant.name, size: variant.size }))} /> : <a className="action action-primary" href={`mailto:${business?.email ?? ""}?subject=${encodeURIComponent(`Enquiry about ${product.name}`)}`}>Ask about this product</a>}<p>No online checkout yet.</p></div>
    </div>
  </main>;
}
