import "server-only";
import { PrismaClient, ProductStatus, AvailabilityStatus, type Product } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./index";

export const slugSchema = z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const imageUrlSchema = z.string().regex(/^\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|avif)$/);
export const productInput = z.object({
  name: z.string().trim().min(2).max(120), slug: slugSchema,
  shortDescription: z.string().max(220).default(""), description: z.string().max(5000).default(""),
  categoryId: z.string().optional(), featured: z.boolean().default(false), seasonal: z.boolean().default(false),
  trackQuantity: z.boolean().default(false), quantityOnHand: z.number().int().min(0).max(100000000).nullable().default(null),
  lowStockThreshold: z.number().int().min(0).max(100000000).nullable().default(null),
  availabilityStatus: z.nativeEnum(AvailabilityStatus).default(AvailabilityStatus.IN_STOCK)
});
export const priceInput = z.object({ amountMinor: z.bigint().min(0n).max(999999999999n), compareAtMinor: z.bigint().min(0n).max(999999999999n).nullable().default(null), currencyCode: z.string().regex(/^[A-Z]{3}$/) }).refine(p => p.compareAtMinor === null || p.compareAtMinor > p.amountMinor, "Compare price must exceed the current price");
export function currencyDigits(currencyCode: string): number { const digits = new Intl.NumberFormat("en", { style: "currency", currency: currencyCode }).resolvedOptions().maximumFractionDigits; if (digits === undefined) throw new Error("Unsupported currency"); return digits; }
export function parseMoney(value: string, currencyCode: string): bigint {
  const digits = currencyDigits(currencyCode);
  if (!/^\d+(?:\.\d+)?$/.test(value) || value.split(".")[1]?.length > digits) throw new Error("Invalid monetary amount");
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * 10n ** BigInt(digits) + BigInt((fraction.padEnd(digits, "0") || "0"));
  if (amount > 999999999999n) throw new Error("Amount is too large");
  return amount;
}
export function formatMinor(amount: bigint, currencyCode: string, locale: string): string {
  const digits = currencyDigits(currencyCode);
  return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode, currencyDisplay: "code" }).format(Number(amount) / 10 ** digits);
}
export function inventoryAvailability(product: Pick<Product, "inventorySource" | "trackQuantity" | "quantityOnHand" | "lowStockThreshold" | "availabilityStatus">): AvailabilityStatus {
  if (product.inventorySource !== "BASIC") return AvailabilityStatus.UNAVAILABLE;
  if (!product.trackQuantity) return product.availabilityStatus;
  if ((product.quantityOnHand ?? 0) <= 0) return AvailabilityStatus.OUT_OF_STOCK;
  if (product.lowStockThreshold !== null && (product.quantityOnHand ?? 0) <= product.lowStockThreshold) return AvailabilityStatus.LOW_STOCK;
  return product.availabilityStatus === AvailabilityStatus.OUT_OF_STOCK ? AvailabilityStatus.IN_STOCK : product.availabilityStatus;
}
export function catalogue(tenantId: string, db: PrismaClient = prisma) {
  if (!tenantId) throw new Error("Tenant required");
  return {
    products: (publicOnly = false) => db.product.findMany({ where: { tenantId, ...(publicOnly ? { status: ProductStatus.ACTIVE } : {}) }, include: { category: true, images: { orderBy: { sortOrder: "asc" } }, prices: { where: { active: true } }, variants: { where: { active: true }, orderBy: { sortOrder: "asc" } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    productById: (id: string) => db.product.findFirst({ where: { tenantId, id }, include: { category: true, images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] }, prices: true, variants: true } }),
    publicBySlug: (slug: string) => db.product.findFirst({ where: { tenantId, slug, status: ProductStatus.ACTIVE }, include: { category: true, images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] }, prices: { where: { active: true } }, variants: { where: { active: true }, include: { prices: { where: { active: true } } } } } }),
    categories: () => db.productCategory.findMany({ where: { tenantId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    locations: () => db.businessLocation.findMany({ where: { tenantId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
  };
}
