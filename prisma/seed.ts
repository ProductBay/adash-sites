import { PrismaClient, DomainStatus, TenantStatus, Prisma } from "@prisma/client";
import { countryConfig } from "../packages/site-config/src/index";
import { demoSections } from "../packages/site-templates/src/demo";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

if (process.env.NODE_ENV !== "development") throw new Error("Development seed requires NODE_ENV=development");
const db = new PrismaClient();
const demos = [
  { slug: "island-fresh-demo", name: "Island Fresh Demo", country: countryConfig.JM, domain: "island-fresh-demo.localhost", primaryColor: "#15594A", accentColor: "#D68B22", theme: "tropical-fresh", whatsapp: "+18765550123", features: ["products", "basic_inventory", "locations", "testimonials", "whatsapp_ordering"] },
  { slug: "harbour-goods-demo", name: "Harbour Goods Demo", country: countryConfig.GY, domain: "harbour-goods-demo.localhost", primaryColor: "#392F2C", accentColor: "#A36D4F", theme: "luxury-artisan", whatsapp: "+5925550123", features: ["products", "basic_inventory", "locations", "testimonials", "analytics", "whatsapp_ordering"] }
] as const;
const demoProducts = {
  "island-fresh-demo": [
    { slug: "citrus-daybreak", name: "Citrus Daybreak", description: "A bright, fruit-forward bottle for slow mornings.", image: "/images/citrus-bottles.webp", price: 85000n, featured: true, quantity: 24 },
    { slug: "mango-glow", name: "Mango Glow", description: "Sunshine-inspired flavor with a mellow finish.", image: "/images/citrus-mango.webp", price: 95000n, featured: true, quantity: 12 },
    { slug: "market-set", name: "The Market Set", description: "A sample selection for sharing or gifting.", image: "/images/citrus-slices.webp", price: 290000n, featured: false, quantity: 0 }
  ],
  "harbour-goods-demo": [
    { slug: "house-cold-brew", name: "House Cold Brew", description: "A smooth coffee ritual, ready when you are.", image: "/images/coffee-bottle.webp", price: 120000n, featured: true, quantity: 18 },
    { slug: "morning-roast", name: "Morning Roast", description: "A rounded, comforting cup for your everyday pause.", image: "/images/coffee-cup.webp", price: 240000n, featured: true, quantity: 9 },
    { slug: "counter-pairing", name: "The Counter Pairing", description: "Coffee and a little something from the bake counter.", image: "/images/coffee-pastry.webp", price: 160000n, featured: false, quantity: 0 }
  ]
} as const;

async function main() {
  for (const demo of demos) {
    const tenant = await db.tenant.upsert({ where: { slug: demo.slug }, update: { name: demo.name, status: TenantStatus.ACTIVE }, create: { slug: demo.slug, name: demo.name, status: TenantStatus.ACTIVE, countryCode: demo.country.countryCode, currencyCode: demo.country.currencyCode, locale: demo.country.locale, timezone: demo.country.timezone } });
    await db.tenantDomain.upsert({ where: { hostname: demo.domain }, update: { status: DomainStatus.VERIFIED, verifiedAt: new Date() }, create: { tenantId: tenant.id, hostname: demo.domain, isPrimary: true, status: DomainStatus.VERIFIED, verifiedAt: new Date() } });
    await db.businessProfile.upsert({ where: { tenantId: tenant.id }, update: { displayName: demo.name, whatsapp: demo.whatsapp }, create: { tenantId: tenant.id, displayName: demo.name, countryCode: demo.country.countryCode, whatsapp: demo.whatsapp } });
    await db.brandConfiguration.upsert({ where: { tenantId: tenant.id }, update: { primaryColor: demo.primaryColor, accentColor: demo.accentColor }, create: { tenantId: tenant.id, primaryColor: demo.primaryColor, accentColor: demo.accentColor } });
    const homeSections = demoSections[demo.slug] as Prisma.InputJsonValue;
    await db.siteConfiguration.upsert({ where: { tenantId: tenant.id }, update: { templateKey: "ADS-BEV-01", themeKey: demo.theme, homeSections, siteTitle: demo.name, published: true }, create: { tenantId: tenant.id, templateKey: "ADS-BEV-01", themeKey: demo.theme, homeSections, siteTitle: demo.name, published: true, publishedAt: new Date() } });
    for (const featureKey of demo.features) await db.tenantFeature.upsert({ where: { tenantId_featureKey: { tenantId: tenant.id, featureKey } }, update: { enabled: true }, create: { tenantId: tenant.id, featureKey, enabled: true } });
    const category = await db.productCategory.upsert({ where: { tenantId_slug: { tenantId: tenant.id, slug: "collection" } }, update: {}, create: { tenantId: tenant.id, slug: "collection", name: demo.slug === "island-fresh-demo" ? "Bottled drinks" : "Coffee & pairings" } });
    for (const item of demoProducts[demo.slug]) {
      const storageKey = `${tenant.id}/${createHash("sha256").update(item.image).digest("hex")}.webp`;
      const source = path.resolve("apps/site-runtime/public", `.${item.image}`);
      const body = await sharp(await readFile(source)).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      const metadata = await sharp(body).metadata();
      const target = path.resolve(".local-media", storageKey);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);
      await db.mediaAsset.upsert({ where: { storageKey }, update: {}, create: { tenantId: tenant.id, kind: "PRODUCT", storageKey, mimeType: "image/webp", originalFilename: path.basename(item.image), sizeBytes: body.length, width: metadata.width!, height: metadata.height!, altText: item.name } });
      const product = await db.product.upsert({ where: { tenantId_slug: { tenantId: tenant.id, slug: item.slug } }, update: {}, create: { tenantId: tenant.id, categoryId: category.id, slug: item.slug, name: item.name, shortDescription: item.description, description: item.description, status: "ACTIVE", featured: item.featured, trackQuantity: true, quantityOnHand: item.quantity, lowStockThreshold: 4, publishedAt: new Date() } });
      if (!await db.productPrice.count({ where: { tenantId: tenant.id, productId: product.id } })) await db.productPrice.create({ data: { tenantId: tenant.id, productId: product.id, currencyCode: demo.country.currencyCode, amountMinor: item.price } });
      if (!await db.productImage.count({ where: { tenantId: tenant.id, productId: product.id } })) await db.productImage.create({ data: { tenantId: tenant.id, productId: product.id, url: item.image, altText: item.name, isPrimary: true } });
    }
    if (!await db.businessLocation.count({ where: { tenantId: tenant.id } })) await db.businessLocation.create({ data: { tenantId: tenant.id, name: demo.slug === "island-fresh-demo" ? "Kingston demo shop" : "Georgetown demo counter", city: demo.slug === "island-fresh-demo" ? "Kingston" : "Georgetown", countryCode: demo.country.countryCode, type: "STORE" } });
    const email = `${demo.slug}@example.test`;
    const password = process.env.ADASH_DEMO_PASSWORD ?? "DemoOnly-2026!ChangeMe";
    const salt = randomBytes(16);
    const passwordHash = `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
    const user = await db.user.upsert({ where: { email }, update: {}, create: { email, passwordHash } });
    await db.tenantMembership.upsert({ where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } }, update: {}, create: { tenantId: tenant.id, userId: user.id, role: "OWNER", status: "ACTIVE" } });
  }
}
main().finally(() => db.$disconnect());
