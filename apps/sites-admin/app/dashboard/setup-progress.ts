export type SetupStatus = "NOT STARTED" | "IN PROGRESS" | "COMPLETE";

export type SetupInput = {
  business: { displayName?: string | null; description?: string | null; email?: string | null; phone?: string | null; whatsapp?: string | null } | null;
  brand: { logoUrl?: string | null; logoMediaId?: string | null; primaryColor?: string | null; secondaryColor?: string | null; accentColor?: string | null } | null;
  site: { themeKey?: string | null; draftSections?: unknown; homeSections?: unknown; published?: boolean } | null;
  products: { status: string; images: { id: string }[] }[];
  activeLocations: number;
};

export function setupProgress(input: SetupInput) {
  const { business, brand, site, products, activeLocations } = input;
  const businessFields = [business?.displayName, business?.description, business?.email, business?.phone, business?.whatsapp].filter(Boolean).length;
  const contactFields = [business?.email, business?.phone, business?.whatsapp].filter(Boolean).length;
  const hasLogo = Boolean(brand?.logoUrl || brand?.logoMediaId);
  const colors = [brand?.primaryColor, brand?.secondaryColor, brand?.accentColor].filter(Boolean).length;
  const hasContent = Boolean(site?.draftSections || site?.homeSections);
  const hasProductImage = products.some(product => product.images.length > 0);
  const ready = Boolean(business?.displayName && business?.description && hasLogo && products.length && hasProductImage && hasContent);
  const state = (complete: boolean, started: boolean): SetupStatus => complete ? "COMPLETE" : started ? "IN PROGRESS" : "NOT STARTED";
  const items = [
    { key: "business", label: "Business details", href: "/dashboard/business", status: state(Boolean(business?.displayName && business?.description && contactFields), businessFields > 0), detail: "Introduce your business and how to reach you." },
    { key: "logo", label: "Logo", href: "/dashboard/brand", status: state(hasLogo, false), detail: "Choose an uploaded logo for your site." },
    { key: "theme", label: "Brand colours and theme", href: "/dashboard/brand", status: state(colors === 3, colors > 0), detail: "Save a preset or your own accessible colours." },
    { key: "products", label: "Products", href: "/dashboard/products", status: state(products.length > 0, false), detail: "Add at least one product to your catalogue." },
    { key: "images", label: "Product images", href: "/dashboard/products", status: state(hasProductImage, products.length > 0), detail: "Attach a clear image to a product." },
    { key: "locations", label: "Location", href: "/dashboard/locations", status: state(activeLocations > 0, false), detail: "Add a shop, pickup point, or service location." },
    { key: "contact", label: "Contact and WhatsApp", href: "/dashboard/business", status: state(contactFields >= 2, contactFields > 0), detail: "Give customers a reliable way to contact you." },
    { key: "content", label: "Website content", href: "/dashboard/content", status: state(hasContent, false), detail: "Write your headline, story, and contact invitation." },
    { key: "preview", label: "Preview readiness", href: "/dashboard/content/preview", status: state(ready, hasContent || products.length > 0), detail: "Review your draft before publishing." },
    { key: "publish", label: "Publication", href: "/dashboard/publish", status: state(Boolean(site?.published), hasContent), detail: "Publish only when your content is ready." },
  ] as const;
  const completed = items.filter(item => item.status === "COMPLETE").length;
  return { items, completed, total: items.length, percentage: Math.round(completed / items.length * 100), ready };
}
