/* eslint-disable @typescript-eslint/no-explicit-any -- focused in-memory Prisma test double */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
vi.mock("server-only", () => ({}));
import { hashPassword, PASSWORD_RESET_GENERIC_MESSAGE, PASSWORD_RESET_TTL_MS, requestPasswordReset, resetPassword, signIn, verifyPassword } from "./index";

type Token = { id: string; tenantId: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null; createdAt: Date };

function memoryDb() {
  const state = {
    user: { id: "user-a", email: "owner@example.test", passwordHash: hashPassword("old password value") },
    tokens: [] as Token[], sessions: [{ userId: "user-a", revokedAt: null as Date | null }], throttle: true, audits: [] as unknown[]
  };
  const passwordResetToken = {
    findFirst: vi.fn(async ({ where }: any) => state.tokens.find(token => token.tenantId === where.tenantId && token.userId === where.userId && token.createdAt >= where.createdAt.gte) ?? null),
    deleteMany: vi.fn(async ({ where }: any) => {
      const before = state.tokens.length;
      state.tokens = state.tokens.filter(token => !((where.id === undefined || token.id === where.id) && (where.tenantId === undefined || token.tenantId === where.tenantId) && (where.userId === undefined || token.userId === where.userId) && (where.usedAt === undefined || token.usedAt === where.usedAt)));
      return { count: before - state.tokens.length };
    }),
    create: vi.fn(async ({ data }: any) => { const token = { id: `token-${state.tokens.length + 1}`, usedAt: null, createdAt: new Date(), ...data } as Token; state.tokens.push(token); return { id: token.id }; }),
    findUnique: vi.fn(async ({ where }: any) => { const token = state.tokens.find(item => item.tokenHash === where.tokenHash); return token ? { ...token, user: { email: state.user.email } } : null; }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      let count = 0;
      for (const token of state.tokens) {
        const matches = (where.id === undefined || token.id === where.id) && (where.tenantId === undefined || token.tenantId === where.tenantId) && (where.userId === undefined || token.userId === where.userId) && (where.usedAt === undefined || token.usedAt === where.usedAt) && (where.expiresAt?.gt === undefined || token.expiresAt > where.expiresAt.gt);
        if (matches) { token.usedAt = data.usedAt; count++; }
      }
      return { count };
    })
  };
  const db: any = {
    tenantMembership: { findFirst: vi.fn(async ({ where }: any) => where.tenantId === "tenant-a" && where.user.email === state.user.email ? { user: { id: state.user.id, email: state.user.email } } : null) },
    passwordResetToken,
    user: { findUnique: vi.fn(async ({ where }: any) => where.email === state.user.email ? state.user : null), update: vi.fn(async ({ data }: any) => { state.user.passwordHash = data.passwordHash; }) },
    authSession: { create: vi.fn(async ({ data }: any) => { state.sessions.push({ userId: data.userId, revokedAt: null }); }), updateMany: vi.fn(async ({ data }: any) => { for (const session of state.sessions) session.revokedAt = data.revokedAt; return { count: state.sessions.length }; }) },
    loginThrottle: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => null), deleteMany: vi.fn(async () => { state.throttle = false; return { count: 1 }; }) },
    auditEvent: { create: vi.fn(async ({ data }: any) => { state.audits.push(data); return data; }) },
  };
  db.$transaction = vi.fn(async (work: (tx: any) => Promise<unknown>) => work(db));
  return { db: db as PrismaClient, state };
}

async function issue(db: PrismaClient, now = new Date("2026-10-11T12:00:00Z")) {
  let token = "";
  const sendEmail = vi.fn(async ({ resetUrl }: { resetUrl: string }) => { token = new URL(resetUrl).searchParams.get("token") ?? ""; });
  const response = await requestPasswordReset({ tenantId: "tenant-a", email: " OWNER@example.test ", origin: "https://shop-admin.staging.adash.technology", sendEmail }, db, now);
  return { token, sendEmail, response, now };
}

describe("tenant password reset", () => {
  it("uses the same generic response for unknown email without creating or sending", async () => {
    const { db, state } = memoryDb();
    const sendEmail = vi.fn();
    const result = await requestPasswordReset({ tenantId: "tenant-a", email: "unknown@example.test", origin: "https://shop-admin.staging.adash.technology", sendEmail }, db);
    expect(result.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE);
    expect(state.tokens).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("creates a 60-minute tenant-bound token and stores only its SHA-256 hash", async () => {
    const { db, state } = memoryDb();
    const { token, sendEmail, response, now } = await issue(db);
    expect(response.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(state.tokens[0].tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(state.tokens)).not.toContain(token);
    expect(state.tokens[0].tenantId).toBe("tenant-a");
    expect(state.tokens[0].expiresAt.getTime()).toBe(now.getTime() + PASSWORD_RESET_TTL_MS);
  });

  it("throttles repeated requests and removes the token when email delivery fails", async () => {
    const { db, state } = memoryDb();
    const first = await issue(db);
    await requestPasswordReset({ tenantId: "tenant-a", email: state.user.email, origin: "https://shop-admin.staging.adash.technology", sendEmail: vi.fn() }, db, new Date(first.now.getTime() + 30_000));
    expect(state.tokens).toHaveLength(1);
    const failing = memoryDb();
    const operationalLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await requestPasswordReset({ tenantId: "tenant-a", email: failing.state.user.email, origin: "https://shop-admin.staging.adash.technology", sendEmail: vi.fn(async () => { throw new Error("provider failure"); }) }, failing.db, first.now);
    expect(failing.state.tokens).toHaveLength(0);
    expect(operationalLog).toHaveBeenCalledWith("Password reset email delivery failed");
    operationalLog.mockRestore();
  });

  it("rejects malformed, mismatched, weak, expired, used, and cross-tenant attempts", async () => {
    const { db, state } = memoryDb();
    const { token, now } = await issue(db);
    expect(await resetPassword({ tenantId: "tenant-a", token: "bad", password: "new password value", confirmPassword: "new password value" }, db, now)).toEqual({ success: false, error: "invalid" });
    expect(await resetPassword({ tenantId: "tenant-a", token, password: "new password value", confirmPassword: "different value" }, db, now)).toEqual({ success: false, error: "mismatch" });
    expect(await resetPassword({ tenantId: "tenant-a", token, password: "too-short", confirmPassword: "too-short" }, db, now)).toEqual({ success: false, error: "weak" });
    expect(await resetPassword({ tenantId: "tenant-b", token, password: "new password value", confirmPassword: "new password value" }, db, now)).toEqual({ success: false, error: "invalid" });
    expect(await resetPassword({ tenantId: "tenant-a", token, password: "new password value", confirmPassword: "new password value" }, db, new Date(now.getTime() + PASSWORD_RESET_TTL_MS + 1))).toEqual({ success: false, error: "expired" });
    state.tokens[0].usedAt = now;
    expect(await resetPassword({ tenantId: "tenant-a", token, password: "new password value", confirmPassword: "new password value" }, db, now)).toEqual({ success: false, error: "used" });
  });

  it("updates the password once, revokes sessions, clears throttle, and records an audit", async () => {
    const { db, state } = memoryDb();
    const oldHash = state.user.passwordHash;
    const { token, now } = await issue(db);
    const result = await resetPassword({ tenantId: "tenant-a", token, password: "new password value", confirmPassword: "new password value" }, db, now);
    expect(result).toEqual({ success: true });
    expect(verifyPassword("old password value", state.user.passwordHash)).toBe(false);
    expect(verifyPassword("new password value", state.user.passwordHash)).toBe(true);
    expect(state.user.passwordHash).not.toBe(oldHash);
    expect(state.sessions.every(session => session.revokedAt)).toBe(true);
    expect(state.throttle).toBe(false);
    expect(state.audits).toContainEqual(expect.objectContaining({ tenantId: "tenant-a", eventType: "auth.password_reset" }));
    expect(await signIn(state.user.email, "old password value", db)).toBeNull();
    expect(await signIn(state.user.email, "new password value", db)).toBeTruthy();
    expect(await resetPassword({ tenantId: "tenant-a", token, password: "another password", confirmPassword: "another password" }, db, now)).toEqual({ success: false, error: "used" });
  });

  it("does not issue a reset for the same user through another tenant", async () => {
    const { db, state } = memoryDb();
    const sendEmail = vi.fn();
    await requestPasswordReset({ tenantId: "tenant-b", email: state.user.email, origin: "https://other-admin.staging.adash.technology", sendEmail }, db);
    expect(state.tokens).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
