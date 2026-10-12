import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./index", () => ({ prisma: { mediaAsset: { findMany: vi.fn(async () => [{ id: "available", storageKey: "tenant-a/good.webp" }, { id: "missing", storageKey: "tenant-a/missing.webp" }]) } } }));
vi.mock("./media", () => ({ mediaStorage: { exists: vi.fn(async (key: string) => key === "tenant-a/good.webp") } }));
vi.mock("./catalogue", () => ({
  catalogue: vi.fn(() => ({ publicProducts: async () => [], locations: async () => [{ name: "Closed", addressLine1: "Address", active: false }, { name: "Open", addressLine1: "Real address", city: "Town", active: true }] })),
  currencyDigits: () => 2, inventoryAvailability: () => "IN_STOCK"
}));
import { defaultTenantSections } from "@adash/site-templates";
import { hydrateTenantHomepage } from "./homepage";
import { prisma } from "./index";

describe("tenant homepage hydration", () => {
  it("retains available tenant images, removes lost and foreign images, and hydrates active locations", async () => {
    const sections = defaultTenantSections("Business").map(section => ({ ...section, enabled: true }));
    const gallery = sections.find(section => section.type === "socialGallery")!;
    if (gallery.type === "socialGallery") gallery.images = [{src:"/media/available",alt:"Available"},{src:"/media/missing",alt:"Missing"},{src:"/media/foreign",alt:"Foreign"}];
    const result = await hydrateTenantHomepage({id:"tenant-a",countryCode:"GY",currencyCode:"GYD"}, sections, ["locations"], {whatsapp:null});
    expect(result.sections.find(section => section.type === "socialGallery")).toMatchObject({images:[{src:"/media/available",alt:"Available"}]});
    expect(result.sections.find(section => section.type === "locations")).toMatchObject({locations:[{name:"Open",address:"Real address, Town"}]});
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{tenantId:"tenant-a"}}));
  });
  it("hides malformed WhatsApp and unpublished product snapshot content", async () => {
    const sections = defaultTenantSections("Business").map(section => ({ ...section, enabled: true }));
    const productGrid = sections.find(section => section.type === "productGrid")!;
    if(productGrid.type === "productGrid") productGrid.products = [{id:"stale",name:"Stale snapshot",price:1,available:true,featured:true}];
    const result = await hydrateTenantHomepage({id:"tenant-a",countryCode:"GY",currencyCode:"GYD"}, sections, ["products","whatsapp_ordering"], {whatsapp:"invalid"});
    expect(result.whatsappHref).toBeNull();
    expect(result.sections.some(section => section.type === "whatsappCta" || section.type === "productGrid")).toBe(false);
  });
});
