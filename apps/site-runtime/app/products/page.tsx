import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TenantStatus } from "@prisma/client";
import { catalogue, formatMinor, inventoryAvailability } from "@adash/site-core/catalogue";
import { createTenantRepository, resolveTenant } from "@adash/site-core";
import { resolveTheme, themeVariables } from "@adash/site-themes";
import { SiteHeader } from "@adash/site-components";
import { applyCatalogueFilters, canServeCatalogue, isAvailable, parseCatalogueFilters } from "./catalogue-view";
import { CatalogueProductImage } from "./product-image";

export const dynamic = "force-dynamic";

async function catalogueContext() {
  const tenant = await resolveTenant((await headers()).get("host"));
  if (!tenant) return null;
  const repository = createTenantRepository(tenant.id);
  const [business, brand, site, features, products] = await Promise.all([
    repository.business(), repository.brand(), repository.site(), repository.enabledFeatures(), catalogue(tenant.id).publicProducts()
  ]);
  const theme = site ? resolveTheme(site.themeKey, brand) : null;
  if (!business || !site || !theme || !canServeCatalogue({ tenantActive: tenant.status === TenantStatus.ACTIVE, published: site.published, productsEnabled: features.includes("products"), themeResolved: true })) return null;
  return { tenant, business, brand, site, features, theme, products };
}

export async function generateMetadata(): Promise<Metadata> {
  const context = await catalogueContext();
  if (!context) return { title: "Products unavailable", robots: { index: false, follow: false } };
  return {
    title: `Products | ${context.business.displayName}`,
    description: context.site.siteDescription || `Explore products from ${context.business.displayName}.`,
    applicationName: context.business.shortName || context.business.displayName
  };
}

export async function generateViewport(): Promise<Viewport> {
  const context = await catalogueContext();
  return { themeColor: context?.theme.primary };
}

function filterHref(filters: ReturnType<typeof parseCatalogueFilters>, changes: Partial<ReturnType<typeof parseCatalogueFilters>>) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.availability !== "all") params.set("availability", next.availability);
  if (next.sort !== "featured") params.set("sort", next.sort);
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolved = await resolveTenant((await headers()).get("host"), undefined, true);
  if (resolved?.status === TenantStatus.SUSPENDED) return <main className="suspension-page"><div><p className="eyebrow">Temporarily unavailable</p><h1>This site is temporarily unavailable.</h1><p>Please check back shortly.</p></div></main>;
  const context = await catalogueContext();
  if (!context) notFound();
  const filters = parseCatalogueFilters(await searchParams);
  const prepared = context.products.map(product => {
    const price = product.prices.find(item => !item.variantId && item.currencyCode === context.tenant.currencyCode);
    return { ...product, availability: inventoryAvailability(product), price: price?.amountMinor ?? null, comparePrice: price?.compareAtMinor ?? null, primaryImage: product.images[0] };
  });
  const products = applyCatalogueFilters(prepared, filters);
  const categories = [...new Map(prepared.filter(product => product.category?.active).map(product => [product.category!.slug, product.category!])).values()];
  const hasFilters = Boolean(filters.q || filters.category || filters.availability !== "all" || filters.sort !== "featured");

  return <div id="top" className="catalogue-page" style={themeVariables(context.theme) as CSSProperties}>
    <a className="skip-link" href="#catalogue-results">Skip to products</a>
    <SiteHeader businessName={context.business.displayName} sections={[]} logoUrl={context.brand?.logoUrl} whatsappBasket={context.features.includes("whatsapp_ordering")} productsEnabled homeHref="/" currentPath="/products" />
    <main>
      <section className="catalogue-hero"><div className="container"><p className="eyebrow">Our collection</p><h1>Products</h1><p>Explore what is available and find the right fit for you.</p></div></section>
      <section className="catalogue-shell container" aria-labelledby="catalogue-results-title">
        <form className="catalogue-controls" action="/products" method="get" role="search">
          <label className="catalogue-search">Search products<input type="search" name="q" defaultValue={filters.q} maxLength={80} placeholder="Search by name, description or category" /></label>
          {filters.category && <input type="hidden" name="category" value={filters.category} />}
          {filters.availability !== "all" && <input type="hidden" name="availability" value={filters.availability} />}
          <label>Sort by<select name="sort" defaultValue={filters.sort}><option value="featured">Featured</option><option value="name">Name A–Z</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option></select></label>
          <button type="submit">Apply</button>
        </form>
        <div className="catalogue-filter-group"><span id="category-filter-label">Category</span><div className="filter-chips" aria-labelledby="category-filter-label"><a href={filterHref(filters, { category: "" })} aria-current={!filters.category ? "true" : undefined}>All</a>{categories.map(category => <a key={category.slug} href={filterHref(filters, { category: category.slug })} aria-current={filters.category === category.slug ? "true" : undefined}>{category.name}</a>)}</div></div>
        <div className="catalogue-filter-group"><span id="availability-filter-label">Availability</span><div className="filter-chips" aria-labelledby="availability-filter-label"><a href={filterHref(filters, { availability: "all" })} aria-current={filters.availability === "all" ? "true" : undefined}>All</a><a href={filterHref(filters, { availability: "available" })} aria-current={filters.availability === "available" ? "true" : undefined}>Available</a></div></div>
        <div className="catalogue-result-bar"><h2 id="catalogue-results-title">{products.length} {products.length === 1 ? "product" : "products"}</h2>{hasFilters && <a href="/products">Clear filters</a>}</div>
        <div id="catalogue-results">
          {!prepared.length ? <div className="catalogue-empty"><h2>No products are available to view right now.</h2><p>Please check back soon.</p></div> : !products.length ? <div className="catalogue-empty"><h2>No products match these filters.</h2><a className="action action-outline" href="/products">Clear filters <span aria-hidden="true">→</span></a></div> : <div className="catalogue-grid">{products.map(product => <article className="product-card catalogue-card" key={product.id}>
            <div className="product-media"><CatalogueProductImage src={product.primaryImage?.url} alt={product.primaryImage?.altText || product.name} /><div className="catalogue-badges">{product.featured && <span>Featured</span>}{product.seasonal && <span>Seasonal</span>}</div>{!isAvailable(product.availability) && <span className="product-unavailable">Currently unavailable</span>}</div>
            <div className="product-info"><div><p className="product-category">{product.category?.name ?? "The collection"}</p><h3>{product.name}</h3></div><p className="product-price">{product.price === null ? "Price on request" : formatMinor(product.price, context.tenant.currencyCode, context.tenant.locale)}{product.comparePrice && <del>{formatMinor(product.comparePrice, context.tenant.currencyCode, context.tenant.locale)}</del>}</p></div>
            {product.shortDescription && <p className="product-description">{product.shortDescription}</p>}
            <p className="catalogue-availability"><strong>Availability:</strong> {product.availability.replaceAll("_", " ").toLocaleLowerCase()}</p>
            <a className="action action-text" href={`/products/${product.slug}`}>View product <span aria-hidden="true">→</span></a>
          </article>)}</div>}
        </div>
      </section>
    </main>
    <footer className="catalogue-footer"><div className="container"><strong>{context.business.displayName}</strong><a href="/">Back to home</a></div></footer>
  </div>;
}
