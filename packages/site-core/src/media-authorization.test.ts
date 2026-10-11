import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
vi.mock("server-only", () => ({}));
import { isPublicMedia, mediaAssetForTenant } from "./media";

describe("media tenant and publication authorization", () => {
  it("scopes admin asset lookup to both tenant and asset id", async () => {
    const findFirst = vi.fn(async ({ where }: { where: { tenantId: string; id: string } }) => where.tenantId === "tenant-a" && where.id === "asset-a" ? { id: "asset-a", tenantId: "tenant-a", storageKey: "tenant-a/key.webp" } : null);
    const db = { mediaAsset: { findFirst } } as unknown as PrismaClient;
    expect(await mediaAssetForTenant("tenant-a", "asset-a", db)).toMatchObject({ id: "asset-a" });
    expect(await mediaAssetForTenant("tenant-a", "asset-b", db)).toBeNull();
    expect(findFirst).toHaveBeenLastCalledWith({ where: { tenantId: "tenant-a", id: "asset-b" } });
  });

  it("denies private, unpublished and cross-tenant public media", async () => {
    const db = {
      brandConfiguration: { findUnique: vi.fn(async ({ where }: { where: { tenantId: string } }) => where.tenantId === "tenant-b" ? { logoMediaId: "asset-b" } : { logoMediaId: null }) },
      productImage: { count: vi.fn(async () => 0) },
      siteConfiguration: { findUnique: vi.fn(async ({ where }: { where: { tenantId: string } }) => ({ published: where.tenantId === "tenant-b", homeSections: [] })) }
    } as unknown as PrismaClient;
    expect(await isPublicMedia("tenant-a", "asset-b", db)).toBe(false);
    expect(await isPublicMedia("tenant-b", "asset-b", db)).toBe(true);
    expect(await isPublicMedia("tenant-b", "arbitrary-bucket-key", db)).toBe(false);
  });
});
