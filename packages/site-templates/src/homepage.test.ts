import { describe, expect, it } from "vitest";
import { defaultTenantSections, getTemplate, hydrateHomepageSections, parseSectionDocument, sectionHasContent, sectionSchema, upgradeTenantSections, type ProductPreview, type SiteSection } from "./index";

describe("premium tenant homepage", () => {
  it("parses the full registry structure without customer facts or demo media", () => {
    const sections = defaultTenantSections("A real business");
    expect(sections.map(section => section.type)).toEqual(getTemplate("ADS-BEV-01")!.supportedSections);
    expect(parseSectionDocument(sections, "ADS-BEV-01")).toHaveLength(14);
    expect(JSON.stringify(sections)).not.toMatch(/\/images\/|\/media\/|wa.me|demo/i);
    for (const section of sections) {
      if (section.type === "featuredProducts" || section.type === "productGrid") expect(section.products).toEqual([]);
      if (section.type === "testimonials") expect(section.quotes).toEqual([]);
      if (section.type === "locations") expect(section.locations).toEqual([]);
      if (section.type === "ingredientShowcase") expect(section.items).toEqual([]);
    }
  });
  it("adds missing structures while preserving saved copy, images and hidden sections", () => {
    const existing = defaultTenantSections("Original business").filter(section => ["hero", "brandStory", "contactCta", "footer"].includes(section.type));
    const story = existing.find(section => section.type === "brandStory")!;
    if (story.type === "brandStory") { story.body = "Real founder story"; story.image = { src: "/media/asset-owned", alt: "Founder" }; }
    const updated = upgradeTenantSections(existing, "New business name", "ADS-BEV-01");
    for (const section of existing) expect(updated.find(item => item.id === section.id)).toMatchObject({ ...section, order: expect.any(Number) });
    expect(updated).toHaveLength(14);
    expect(upgradeTenantSections(updated, "Another name", "ADS-BEV-01")).toEqual(updated);
    expect(() => upgradeTenantSections([{ type: "broken" }], "Business", "ADS-BEV-01")).toThrow();
  });
  it("hides every empty optional collection and incomplete promotion", () => {
    for (const section of defaultTenantSections("Business")) {
      const active = { ...section, enabled: true } as SiteSection;
      if (["trustStrip","featuredProducts","brandStory","featureGrid","ingredientShowcase","productGrid","promoBanner","whatsappCta","testimonials","locations","socialGallery"].includes(section.type)) expect(sectionHasContent(active)).toBe(false);
    }
  });
  it("hydrates featured and collection products and active location inputs without snapshots", () => {
    const sections = defaultTenantSections("Business").map(section => ({ ...section, enabled: true }));
    const products: ProductPreview[] = [{id:"one",name:"Real product",price:10,featured:true,available:true},{id:"two",name:"Other real product",price:20,featured:false,available:true}];
    const hydrated = hydrateHomepageSections(sections, ["products","locations","whatsapp_ordering"], products, [{name:"Real shop",address:"Real address"}], "https://wa.me/5921234567");
    expect(hydrated.find(section => section.type === "featuredProducts")).toMatchObject({products:[products[0]]});
    expect(hydrated.find(section => section.type === "productGrid")).toMatchObject({products});
    expect(hydrated.find(section => section.type === "locations")).toMatchObject({locations:[{name:"Real shop",address:"Real address"}]});
    expect(hydrated.some(section => section.type === "whatsappCta")).toBe(true);
    const denied = hydrateHomepageSections(sections, [], products, [{name:"Shop",address:"Address"}], "https://wa.me/5921234567");
    expect(denied.some(section => ["featuredProducts","productGrid","locations","whatsappCta"].includes(section.type))).toBe(false);
    expect(hydrateHomepageSections(sections, ["whatsapp_ordering"], [], [], null).some(section => section.type === "whatsappCta")).toBe(false);
  });
  it("keeps multiple gallery and ingredient images and rejects excess gallery images", () => {
    const images = [{src:"/media/one",alt:"One"},{src:"/media/two",alt:"Two"}];
    const gallery = sectionSchema.parse({id:"gallery",type:"socialGallery",enabled:true,order:1,heading:"Our images",images});
    const ingredients = sectionSchema.parse({id:"ingredients",type:"ingredientShowcase",enabled:true,order:2,heading:"Our ingredients",items:images.map((image,index)=>({name:`Ingredient ${index}`,description:"Real ingredient",image}))});
    expect(sectionHasContent(gallery)).toBe(true);
    expect(sectionHasContent(ingredients)).toBe(true);
    expect(gallery).toMatchObject({images});
    expect(ingredients).toMatchObject({items:[{image:images[0]},{image:images[1]}]});
    expect(sectionSchema.safeParse({...gallery,images:Array.from({length:9},()=>images[0])}).success).toBe(false);
  });
});
