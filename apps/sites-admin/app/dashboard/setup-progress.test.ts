import { describe, expect, it } from "vitest";
import { setupProgress } from "./setup-progress";

describe("derived admin setup progress", () => {
  const empty = { business: null, brand: null, site: null, products: [], activeLocations: 0 };

  it("starts empty without persisting a checklist", () => {
    const result = setupProgress(empty);
    expect(result.total).toBe(10);
    expect(result.completed).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.items.every(item => item.status === "NOT STARTED")).toBe(true);
  });

  it("shows partial progress from saved business and catalogue data", () => {
    const result = setupProgress({ ...empty, business: { displayName: "Pilot", email: "pilot@example.test" }, products: [{ status: "DRAFT", images: [] }] });
    expect(result.items.find(item => item.key === "business")?.status).toBe("IN PROGRESS");
    expect(result.items.find(item => item.key === "products")?.status).toBe("COMPLETE");
    expect(result.items.find(item => item.key === "images")?.status).toBe("IN PROGRESS");
    expect(result.ready).toBe(false);
  });

  it("marks completed steps only when corresponding tenant data exists", () => {
    const result = setupProgress({
      business: { displayName: "Pilot", description: "A real business", email: "pilot@example.test", whatsapp: "+5926000000" },
      brand: { logoMediaId: "logo-1", primaryColor: "#123456", secondaryColor: "#234567", accentColor: "#345678" },
      site: { draftSections: [{ type: "hero" }], published: true },
      products: [{ status: "ACTIVE", images: [{ id: "image-1" }] }], activeLocations: 1,
    });
    expect(result.completed).toBe(10);
    expect(result.percentage).toBe(100);
    expect(result.ready).toBe(true);
  });
});
