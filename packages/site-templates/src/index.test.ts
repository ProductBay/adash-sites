import { describe, expect, it } from "vitest";
import { demoSections, entitledSections, formatCurrency, getTemplate, parseSectionDocument, parseSections, sectionSchema } from "./index";

describe("ADS-BEV-01 registry and composition", () => {
  it("registers an active reusable food and beverage template", () => {
    expect(getTemplate("ADS-BEV-01")).toMatchObject({ industry: "food-beverage", status: "active", version: "1.0.0" });
    expect(getTemplate("unknown")).toBeNull();
  });
  it("validates both complete fictional demo configurations", () => {
    for (const sections of Object.values(demoSections)) {
      expect(sections.every(section => sectionSchema.safeParse(section).success)).toBe(true);
      expect(parseSections(sections, "ADS-BEV-01")?.[0]?.type).toBe("hero");
    }
  });
  it("orders sections, skips disabled sections and rejects duplicate IDs", () => {
    const sections = demoSections["island-fresh-demo"];
    const reordered = [{ ...sections[1], order: 4 }, { ...sections[0], order: 2 }, { ...sections[2], id: "highlights", order: 3 }, ...sections.slice(3).map(section => section.id === "all-products" ? { ...section, enabled: false } : section)];
    const warnings: string[] = [];
    const result = parseSections(reordered, "ADS-BEV-01", message => warnings.push(message));
    expect(result?.[0]?.id).toBe("hero");
    expect(result?.some(section => section.id === "all-products")).toBe(false);
    expect(parseSectionDocument(reordered, "ADS-BEV-01")?.some(section => section.id === "all-products")).toBe(true);
    expect(warnings).toContain("Duplicate section id skipped");
  });
  it("skips an invalid section without crashing the page", () => {
    const warnings: string[] = [];
    const result = parseSections([demoSections["island-fresh-demo"][0], { id: "bad", type: "futureSection", enabled: true, order: 1 }], "ADS-BEV-01", message => warnings.push(message));
    expect(result).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(parseSections([], "ADS-BEV-01")).toBeNull();
    expect(parseSections(demoSections["island-fresh-demo"], "not-registered")).toBeNull();
    expect(sectionSchema.safeParse({ ...demoSections["island-fresh-demo"][0], image: { src: "/images/../secret.png", alt: "Invalid path" } }).success).toBe(false);
  });
  it("requires server feature entitlements for gated sections", () => {
    const sections = parseSections(demoSections["island-fresh-demo"], "ADS-BEV-01") ?? [];
    const filtered = entitledSections(sections, ["locations"]);
    expect(filtered.some(section => section.type === "featuredProducts")).toBe(false);
    expect(filtered.some(section => section.type === "testimonials")).toBe(false);
    expect(filtered.some(section => section.type === "locations")).toBe(true);
  });
});

it("formats prices from tenant currency and locale", () => {
  expect(formatCurrency(850, "JMD", "en-JM")).toContain("850");
  expect(formatCurrency(1200, "GYD", "en-GY")).toContain("1,200");
  expect(formatCurrency(850, "JMD", "en-JM")).not.toEqual(formatCurrency(850, "GYD", "en-GY"));
});
