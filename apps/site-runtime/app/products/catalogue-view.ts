export type CatalogueFilters = {
  q: string;
  category: string;
  availability: "all" | "available";
  sort: "featured" | "name" | "price-asc" | "price-desc";
};

export type CatalogueViewProduct = {
  name: string;
  shortDescription: string | null;
  category: { slug: string; name: string; active: boolean } | null;
  availability: string;
  featured: boolean;
  seasonal: boolean;
  price: bigint | null;
};

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function parseCatalogueFilters(input: Record<string, string | string[] | undefined>): CatalogueFilters {
  const rawQuery = (first(input.q) ?? "").trim().slice(0, 80);
  const rawCategory = first(input.category) ?? "";
  const rawAvailability = first(input.availability);
  const rawSort = first(input.sort);
  return {
    q: rawQuery,
    category: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawCategory) ? rawCategory : "",
    availability: rawAvailability === "available" ? "available" : "all",
    sort: rawSort === "name" || rawSort === "price-asc" || rawSort === "price-desc" ? rawSort : "featured"
  };
}

export function isAvailable(availability: string) {
  return availability !== "OUT_OF_STOCK" && availability !== "UNAVAILABLE";
}

export function applyCatalogueFilters<T extends CatalogueViewProduct>(products: T[], filters: CatalogueFilters): T[] {
  const query = filters.q.toLocaleLowerCase();
  const filtered = products.filter(product => {
    if (product.category && !product.category.active) return false;
    if (filters.category && product.category?.slug !== filters.category) return false;
    if (filters.availability === "available" && !isAvailable(product.availability)) return false;
    return !query || [product.name, product.shortDescription ?? "", product.category?.name ?? ""].some(value => value.toLocaleLowerCase().includes(query));
  });
  return filtered.sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    if (filters.sort.startsWith("price")) {
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      const direction = filters.sort === "price-asc" ? 1 : -1;
      return a.price === b.price ? a.name.localeCompare(b.name) : a.price < b.price ? -direction : direction;
    }
    return Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name);
  });
}

export function canServeCatalogue(input: { tenantActive: boolean; published: boolean; productsEnabled: boolean; themeResolved: boolean }) {
  return input.tenantActive && input.published && input.productsEnabled && input.themeResolved;
}
