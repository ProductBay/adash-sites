import { describe, expect, it } from "vitest";
import { applyCatalogueFilters, canServeCatalogue, parseCatalogueFilters, type CatalogueViewProduct } from "./catalogue-view";

const products: CatalogueViewProduct[] = [
  { name: "Mango Gold", shortDescription: "Fresh juice", category: { slug: "juice", name: "Juice", active: true }, availability: "IN_STOCK", featured: true, seasonal: false, price: 500n },
  { name: "Sorrel Spice", shortDescription: "Holiday favourite", category: { slug: "seasonal", name: "Seasonal", active: true }, availability: "OUT_OF_STOCK", featured: false, seasonal: true, price: 700n },
  { name: "Hidden Draft Category", shortDescription: "Should not show", category: { slug: "hidden", name: "Hidden", active: false }, availability: "IN_STOCK", featured: false, seasonal: false, price: 200n },
  { name: "Custom Blend", shortDescription: null, category: null, availability: "PREORDER", featured: false, seasonal: false, price: null }
];

describe("public catalogue view", () => {
  it("fails closed for unpublished, unentitled, unresolved or inactive tenants", () => {
    expect(canServeCatalogue({ tenantActive: true, published: true, productsEnabled: true, themeResolved: true })).toBe(true);
    expect(canServeCatalogue({ tenantActive: true, published: false, productsEnabled: true, themeResolved: true })).toBe(false);
    expect(canServeCatalogue({ tenantActive: true, published: true, productsEnabled: false, themeResolved: true })).toBe(false);
    expect(canServeCatalogue({ tenantActive: true, published: true, productsEnabled: true, themeResolved: false })).toBe(false);
  });
  it("validates URL state and safely defaults unknown values", () => {
    expect(parseCatalogueFilters({ q: "  mango ", category: "juice", availability: "available", sort: "price-desc" })).toEqual({ q: "mango", category: "juice", availability: "available", sort: "price-desc" });
    expect(parseCatalogueFilters({ category: "../bad", availability: "sold-out", sort: "internal" })).toEqual({ q: "", category: "", availability: "all", sort: "featured" });
  });
  it("searches names, descriptions and category names", () => {
    expect(applyCatalogueFilters([...products], { q: "fresh", category: "", availability: "all", sort: "featured" }).map(p => p.name)).toEqual(["Mango Gold"]);
    expect(applyCatalogueFilters([...products], { q: "seasonal", category: "", availability: "all", sort: "featured" }).map(p => p.name)).toEqual(["Sorrel Spice"]);
  });
  it("filters represented active categories and availability", () => {
    expect(applyCatalogueFilters([...products], { q: "", category: "juice", availability: "all", sort: "featured" }).map(p => p.name)).toEqual(["Mango Gold"]);
    expect(applyCatalogueFilters([...products], { q: "", category: "", availability: "available", sort: "featured" }).map(p => p.name)).toEqual(["Mango Gold", "Custom Blend"]);
    expect(applyCatalogueFilters([...products], { q: "", category: "hidden", availability: "all", sort: "featured" })).toEqual([]);
  });
  it("sorts featured, name and price while keeping unpriced products safe", () => {
    const active = products.filter(product => product.category?.active !== false);
    expect(applyCatalogueFilters([...active], { q: "", category: "", availability: "all", sort: "name" }).map(p => p.name)).toEqual(["Custom Blend", "Mango Gold", "Sorrel Spice"]);
    expect(applyCatalogueFilters([...active], { q: "", category: "", availability: "all", sort: "price-asc" }).map(p => p.name)).toEqual(["Mango Gold", "Sorrel Spice", "Custom Blend"]);
    expect(applyCatalogueFilters([...active], { q: "nothing", category: "", availability: "all", sort: "featured" })).toEqual([]);
  });
});
