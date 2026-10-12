import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("server-only", () => ({}));
import { createTenantRepository, normalizeHostname, resolveTenant, type TenantLookup } from "./index";
import { countryConfig, featureKeys } from "@adash/site-config";

process.env.DATABASE_URL = "postgresql://localhost:5432/test";
process.env.ADASH_SITES_ROOT_DOMAIN = "sites.adash.technology";

const tenantA = { id: "tenant-a", slug: "island-fresh-demo", status: "ACTIVE", name: "Island Fresh Demo" };
const tenantB = { id: "tenant-b", slug: "harbour-goods-demo", status: "ACTIVE", name: "Harbour Goods Demo" };

function lookup() {
  const tenantDomain = { findUnique: vi.fn(async ({ where }: { where: { hostname: string } }) => {
    const map = new Map([
      ["island.example.com", { status: "VERIFIED", tenant: tenantA }],
      ["harbour.example.com", { status: "VERIFIED", tenant: tenantB }],
      ["pending.example.com", { status: "PENDING", tenant: tenantB }]
    ]);
    return map.get(where.hostname) ?? null;
  }) };
  const tenant = { findFirst: vi.fn(async ({ where }: { where: { slug: string } }) =>
    [tenantA, tenantB].find(item => item.slug === where.slug) ?? null) };
  return { tenantDomain, tenant } as unknown as TenantLookup;
}

describe("tenant hostname resolution", () => {
  it("normalizes casing, trailing dots, and ports", () => {
    expect(normalizeHostname("CLIENT.EXAMPLE.COM")).toBe("client.example.com");
    expect(normalizeHostname("client.example.com:3000")).toBe("client.example.com");
    expect(normalizeHostname("CLIENT.EXAMPLE.COM.")).toBe("client.example.com");
    expect(normalizeHostname("client.example.com/path")).toBeNull();
  });
  it("resolves two verified custom domains independently", async () => {
    const db = lookup();
    expect((await resolveTenant("ISLAND.EXAMPLE.COM:3000", db))?.id).toBe("tenant-a");
    expect((await resolveTenant("harbour.example.com", db))?.id).toBe("tenant-b");
  });
  it("fails closed for unknown and unverified custom hosts", async () => {
    const db = lookup();
    expect(await resolveTenant("unknown.example.com", db)).toBeNull();
    expect(await resolveTenant("pending.example.com", db)).toBeNull();
  });
  it("resolves managed subdomains only under the configured root", async () => {
    const db = lookup();
    expect((await resolveTenant("island-fresh-demo.sites.adash.technology", db))?.id).toBe("tenant-a");
    expect(await resolveTenant("island-fresh-demo.other.example", db)).toBeNull();
  });
  it("allows localhost subdomains only in development", async () => {
    const db = lookup();
    vi.stubEnv("NODE_ENV", "development");
    expect((await resolveTenant("island-fresh-demo.localhost:3000", db))?.id).toBe("tenant-a");
    vi.stubEnv("NODE_ENV", "production");
    expect(await resolveTenant("island-fresh-demo.localhost:3000", db)).toBeNull();
    vi.unstubAllEnvs();
  });
  it("does not use query strings to select a tenant", async () => {
    expect(await resolveTenant("unknown.example.com?tenant=tenant-a", lookup())).toBeNull();
  });
});

describe("tenant scoped repository", () => {
  it("binds owned configuration and feature reads to the selected tenant", async () => {
    const businessFind = vi.fn(async ({ where }: { where: { tenantId: string } }) => ({ tenantId: where.tenantId }));
    const siteFind = vi.fn(async ({ where }: { where: { tenantId: string } }) => ({ tenantId: where.tenantId }));
    const featuresFind = vi.fn(async ({ where }: { where: { tenantId: string } }) => [{ featureKey: where.tenantId === "tenant-a" ? "locations" : "products" }]);
    const db = { businessProfile: { findUnique: businessFind }, siteConfiguration: { findUnique: siteFind }, tenantFeature: { findMany: featuresFind } } as unknown as PrismaClient;
    const a = createTenantRepository("tenant-a", db);
    const b = createTenantRepository("tenant-b", db);
    expect((await a.business())?.tenantId).toBe("tenant-a");
    expect((await b.site())?.tenantId).toBe("tenant-b");
    expect(await a.enabledFeatures()).toEqual(["locations"]);
    expect(await b.enabledFeatures()).toEqual(["products"]);
    expect(businessFind).toHaveBeenCalledWith({ where: { tenantId: "tenant-a" } });
    expect(siteFind).toHaveBeenCalledWith({ where: { tenantId: "tenant-b" } });
  });
  it("checks entitlements inside the bound tenant", async () => {
    const findUnique = vi.fn(async ({ where }: { where: { tenantId_featureKey: { tenantId: string; featureKey: string } } }) => ({ enabled: where.tenantId_featureKey.tenantId === "tenant-a" }));
    const db = { tenantFeature: { findUnique } } as unknown as PrismaClient;
    expect(await createTenantRepository("tenant-a", db).hasFeature("products")).toBe(true);
    expect(await createTenantRepository("tenant-b", db).hasFeature("products")).toBe(false);
    expect(findUnique).toHaveBeenCalledWith({ where: { tenantId_featureKey: { tenantId: "tenant-b", featureKey: "products" } }, select: { enabled: true } });
  });
});

it("defines the initial markets and entitlement vocabulary", () => {
  expect(Object.values(countryConfig).map(({ countryCode, currencyCode, locale, phonePrefix }) => [countryCode, currencyCode, locale, phonePrefix])).toEqual([
    ["GY", "GYD", "en-GY", "+592"], ["JM", "JMD", "en-JM", "+1-876"],
    ["TT", "TTD", "en-TT", "+1-868"], ["BB", "BBD", "en-BB", "+1-246"]
  ]);
  expect(featureKeys).toEqual(["products", "whatsapp_ordering", "locations", "testimonials", "basic_inventory", "inventra", "commerce", "payments", "delivery", "analytics", "white_label"]);
});
