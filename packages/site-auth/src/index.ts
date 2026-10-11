import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { MembershipRole, MembershipStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@adash/site-core";

export const SESSION_COOKIE = "adash_sites_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 14;
export const permissions = ["product.read", "product.create", "product.update", "product.publish", "product.archive", "product.price.read", "product.price.update", "inventory.read", "inventory.update", "content.read", "content.update", "content.publish", "media.read", "media.manage", "location.read", "location.create", "location.update", "location.delete", "business.read", "business.update", "brand.read", "brand.update", "brand.theme.update", "team.read", "team.manage", "billing.view", "apps.view", "apps.manage"] as const;
export type Permission = typeof permissions[number];
const rolePermissions: Record<MembershipRole, readonly Permission[]> = {
  OWNER: permissions,
  MANAGER: permissions.filter(p => !["team.manage", "billing.view", "apps.manage"].includes(p)),
  PRODUCT_MANAGER: permissions.filter(p => p.startsWith("product.") || p.startsWith("inventory.") || p.startsWith("media.")),
  CONTENT_EDITOR: permissions.filter(p => p.startsWith("content.") || p.startsWith("media.") || p === "brand.read" || p === "brand.update"),
  STAFF: ["product.read", "inventory.read", "business.read", "location.read", "apps.view"]
};
export function can(role: MembershipRole, permission: Permission): boolean { return rolePermissions[role].includes(permission); }
export function hashPassword(password: string): string {
  if (password.length < 12 || password.length > 256) throw new Error("Password must contain 12–256 characters");
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${digest.toString("hex")}`;
}
export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || password.length > 256) return false;
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(hashHex)) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(hashHex, "hex"));
}
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const dummyPasswordHash = hashPassword("a-dash-invalid-placeholder");
export async function signIn(email: string, password: string, db: PrismaClient = prisma) {
  if (email.length > 254 || password.length > 256) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const emailHash = createHash("sha256").update(normalizedEmail).digest("hex");
  const throttle = await db.loginThrottle.findUnique({ where: { emailHash } });
  if (throttle?.lockedUntil && throttle.lockedUntil > new Date()) return null;
  const user = await db.user.findUnique({ where: { email: normalizedEmail } });
  const matches = verifyPassword(password, user?.passwordHash ?? dummyPasswordHash);
  if (!user || !matches) {
    await db.loginThrottle.upsert({ where: { emailHash }, create: { emailHash, failedCount: 1 }, update: { failedCount: { increment: 1 }, lockedUntil: (throttle?.failedCount ?? 0) >= 4 ? new Date(Date.now() + 15 * 60 * 1000) : null } });
    return null;
  }
  await db.loginThrottle.deleteMany({ where: { emailHash } });
  const token = randomBytes(32).toString("base64url");
  await db.authSession.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) } });
  return token;
}
export async function resolveSession(token: string | undefined, db: PrismaClient = prisma) {
  if (!token || token.length > 128) return null;
  const session = await db.authSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  return { userId: session.userId, email: session.user.email, sessionId: session.id };
}
export async function revokeSession(token: string | undefined, db: PrismaClient = prisma) {
  if (token) await db.authSession.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
}
export async function tenantPrincipal(token: string | undefined, tenantId: string, db: PrismaClient = prisma) {
  const identity = await resolveSession(token, db);
  if (!identity) return null;
  const membership = await db.tenantMembership.findUnique({ where: { tenantId_userId: { tenantId, userId: identity.userId } } });
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return null;
  return { ...identity, tenantId, role: membership.role };
}
export const PASSWORD_RESET_GENERIC_MESSAGE = "If an account exists for that email, a password reset link has been sent.";
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_THROTTLE_MS = 60 * 1000;
const resetTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export type PasswordResetMailer = (input: { to: string; resetUrl: string }) => Promise<void>;

export async function requestPasswordReset(input: { tenantId: string; email: string; origin: string; sendEmail: PasswordResetMailer }, db: PrismaClient = prisma, now = new Date()) {
  const accepted = { message: PASSWORD_RESET_GENERIC_MESSAGE } as const;
  if (input.email.length > 254) return accepted;
  const email = input.email.trim().toLowerCase();
  const membership = await db.tenantMembership.findFirst({ where: { tenantId: input.tenantId, status: MembershipStatus.ACTIVE, user: { email } }, select: { user: { select: { id: true, email: true } } } });
  if (!membership) return accepted;
  const recent = await db.passwordResetToken.findFirst({ where: { tenantId: input.tenantId, userId: membership.user.id, createdAt: { gte: new Date(now.getTime() - PASSWORD_RESET_THROTTLE_MS) } }, select: { id: true } });
  if (recent) return accepted;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = resetTokenHash(token);
  const created = await db.$transaction(async tx => {
    await tx.passwordResetToken.deleteMany({ where: { tenantId: input.tenantId, userId: membership.user.id, usedAt: null } });
    return tx.passwordResetToken.create({ data: { tenantId: input.tenantId, userId: membership.user.id, tokenHash, expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS) }, select: { id: true } });
  });
  try {
    const resetUrl = new URL("/reset-password", input.origin);
    resetUrl.searchParams.set("token", token);
    await input.sendEmail({ to: membership.user.email, resetUrl: resetUrl.toString() });
  } catch {
    await db.passwordResetToken.deleteMany({ where: { id: created.id, usedAt: null } });
    console.error("Password reset email delivery failed");
  }
  return accepted;
}

export type ResetPasswordResult = { success: true } | { success: false; error: "invalid" | "expired" | "used" | "mismatch" | "weak" };

export async function resetPassword(input: { tenantId: string; token: string; password: string; confirmPassword: string }, db: PrismaClient = prisma, now = new Date()): Promise<ResetPasswordResult> {
  if (input.password !== input.confirmPassword) return { success: false, error: "mismatch" };
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.token)) return { success: false, error: "invalid" };
  if (input.password.length < 12 || input.password.length > 256) return { success: false, error: "weak" };
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: resetTokenHash(input.token) }, include: { user: { select: { email: true } } } });
  if (!record || record.tenantId !== input.tenantId) return { success: false, error: "invalid" };
  if (record.usedAt) return { success: false, error: "used" };
  if (record.expiresAt <= now) return { success: false, error: "expired" };
  const passwordHash = hashPassword(input.password);
  const emailHash = createHash("sha256").update(record.user.email.trim().toLowerCase()).digest("hex");
  const completed = await db.$transaction(async tx => {
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, tenantId: input.tenantId, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } });
    await tx.authSession.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.loginThrottle.deleteMany({ where: { emailHash } });
    await tx.auditEvent.create({ data: { tenantId: input.tenantId, actorUserId: record.userId, eventType: "auth.password_reset", entityType: "User", entityId: record.userId } });
    return true;
  });
  return completed ? { success: true } : { success: false, error: "used" };
}
export type Principal = NonNullable<Awaited<ReturnType<typeof tenantPrincipal>>>;
export function requirePermission(principal: Principal | null, tenantId: string, permission: Permission): asserts principal is Principal {
  if (!principal || principal.tenantId !== tenantId || !can(principal.role, permission)) throw new Error("Forbidden");
}
