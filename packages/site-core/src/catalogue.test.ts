import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
vi.mock("server-only", () => ({}));
import { catalogue, currencyDigits, formatMinor, inventoryAvailability, parseMoney, priceInput, productInput } from "./catalogue";

describe("catalogue safety", () => {
  it("parses exact minor units across currency scales", () => {
    expect(currencyDigits("JMD")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(currencyDigits("KWD")).toBe(3);
    expect(parseMoney("0", "JMD")).toBe(0n);
    expect(parseMoney("1234.50", "JMD")).toBe(123450n);
    expect(parseMoney("1.234", "KWD")).toBe(1234n);
    expect(() => parseMoney("1.234", "JMD")).toThrow();
    expect(() => parseMoney("1e6", "JMD")).toThrow();
    expect(formatMinor(123450n, "JMD", "en-JM")).toContain("1,234.50");
    expect(priceInput.safeParse({ amountMinor: 100n, compareAtMinor: 90n, currencyCode: "JMD" }).success).toBe(false);
  });
  it("validates product input and abstracts basic inventory", () => {
    expect(productInput.safeParse({ name: "Test", slug: "test-product" }).success).toBe(true);
    expect(productInput.safeParse({ name: "Test", slug: "../escape" }).success).toBe(false);
    const product = { inventorySource: "BASIC" as const, trackQuantity: true, quantityOnHand: 0, lowStockThreshold: 3, availabilityStatus: "IN_STOCK" as const };
    expect(inventoryAvailability(product)).toBe("OUT_OF_STOCK");
    expect(inventoryAvailability({ ...product, quantityOnHand: 2 })).toBe("LOW_STOCK");
    expect(inventoryAvailability({ ...product, inventorySource: "INVENTRA" })).toBe("UNAVAILABLE");
  });
  it("always scopes reads to the bound tenant", async () => {
    const findMany = vi.fn(async (args: { where: Record<string, unknown> }) => { void args; return []; });
    const findFirst = vi.fn(async (args: { where: Record<string, unknown> }) => { void args; return null; });
    const db = { product: { findMany, findFirst }, productCategory: { findMany }, businessLocation: { findMany } } as unknown as PrismaClient;
    await catalogue("tenant-a", db).products(true);
    await catalogue("tenant-a", db).publicProducts();
    await catalogue("tenant-a", db).productById("tenant-b-product");
    await catalogue("tenant-a", db).publicBySlug("other-product");
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: "tenant-a", status: "ACTIVE" });
    expect(findMany.mock.calls[1][0].where).toEqual({ tenantId: "tenant-a", status: "ACTIVE", OR: [{ categoryId: null }, { category: { active: true } }] });
    expect(findFirst.mock.calls[0][0].where).toEqual({ tenantId: "tenant-a", id: "tenant-b-product" });
    expect(findFirst.mock.calls[1][0].where).toEqual({ tenantId: "tenant-a", slug: "other-product", status: "ACTIVE" });
  });
});
