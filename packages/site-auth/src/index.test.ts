import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
vi.mock("server-only", () => ({}));
import { can, hashPassword, verifyPassword, signIn, resolveSession, revokeSession, tenantPrincipal, requirePermission, type Principal, type Permission } from "./index";

describe("authentication and authorization", () => {
  it("hashes passwords with random salts and rejects wrong credentials", () => {
    const first = hashPassword("correct horse battery");
    const second = hashPassword("correct horse battery");
    expect(first).not.toBe(second);
    expect(verifyPassword("correct horse battery", first)).toBe(true);
    expect(verifyPassword("wrong password", first)).toBe(false);
    expect(verifyPassword("anything", "malformed")).toBe(false);
  });
  it("keeps owner, product manager, content editor and staff capabilities distinct", () => {
    expect(can("OWNER", "team.manage")).toBe(true);
    expect(can("MANAGER", "billing.view")).toBe(false);
    expect(can("PRODUCT_MANAGER", "product.price.update")).toBe(true);
    expect(can("PRODUCT_MANAGER", "brand.update")).toBe(false);
    expect(can("CONTENT_EDITOR", "product.price.update")).toBe(false);
    expect(can("STAFF", "inventory.update")).toBe(false);
  });
  it("rejects every cross-tenant business, catalogue, inventory, location and brand permission", () => {
    const principal = { userId: "user-a", email: "a@example.test", sessionId: "session-a", tenantId: "tenant-a", role: "OWNER" } as Principal;
    const keys: Permission[] = ["product.read", "product.update", "product.price.update", "inventory.update", "business.update", "location.update", "brand.update", "brand.theme.update"];
    for (const key of keys) expect(() => requirePermission(principal, "tenant-b", key)).toThrow("Forbidden");
    expect(() => requirePermission(principal, "tenant-a", "brand.update")).not.toThrow();
  });
  it("requires an active membership in the requested tenant", async () => {
    const passwordHash = hashPassword("correct horse battery");
    let storedTokenHash = "";
    let revokedAt: Date | null = null;
    const db = {
      user: { findUnique: vi.fn(async () => ({ id: "user-a", email: "a@example.test", passwordHash })) },
      loginThrottle: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => null), deleteMany: vi.fn(async () => null) },
      authSession: {
        create: vi.fn(async ({ data }: { data: { tokenHash: string } }) => { storedTokenHash = data.tokenHash; }),
        findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => where.tokenHash === storedTokenHash ? { id: "session", userId: "user-a", user: { email: "a@example.test" }, expiresAt: new Date(Date.now() + 10000), revokedAt } : null),
        updateMany: vi.fn(async () => { revokedAt = new Date(); })
      },
      tenantMembership: { findUnique: vi.fn(async ({ where }: { where: { tenantId_userId: { tenantId: string } } }) => where.tenantId_userId.tenantId === "tenant-a" ? { role: "OWNER", status: "ACTIVE" } : null) }
    } as unknown as PrismaClient;
    expect(await signIn("a@example.test", "incorrect", db)).toBeNull();
    const token = await signIn("a@example.test", "correct horse battery", db);
    expect(token).toBeTruthy();
    expect((await resolveSession(token!, db))?.userId).toBe("user-a");
    expect((await tenantPrincipal(token!, "tenant-a", db))?.role).toBe("OWNER");
    expect(await tenantPrincipal(token!, "tenant-b", db)).toBeNull();
    expect(() => requirePermission(null, "tenant-b", "brand.update")).toThrow("Forbidden");
    await revokeSession(token!, db);
    expect(await resolveSession(token!, db)).toBeNull();
  });
  it("enforces persistent login lockout before password verification", async () => {
    const userLookup = vi.fn();
    const db = { loginThrottle: { findUnique: vi.fn(async () => ({ failedCount: 5, lockedUntil: new Date(Date.now() + 60000) })) }, user: { findUnique: userLookup } } as unknown as PrismaClient;
    expect(await signIn("owner@example.test", "some password", db)).toBeNull();
    expect(userLookup).not.toHaveBeenCalled();
  });
  it("does not grant tenant access to suspended memberships", async () => {
    const token = "session-token";
    const db = {
      authSession: { findUnique: vi.fn(async () => ({ id: "session", userId: "user-a", user: { email: "a@example.test" }, expiresAt: new Date(Date.now() + 10000), revokedAt: null })) },
      tenantMembership: { findUnique: vi.fn(async () => ({ role: "OWNER", status: "SUSPENDED" })) }
    } as unknown as PrismaClient;
    expect(await tenantPrincipal(token, "tenant-a", db)).toBeNull();
  });
});
