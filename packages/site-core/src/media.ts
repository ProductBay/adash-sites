import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "./index";

export interface StorageAdapter {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const cwd = process.cwd();
const root = path.resolve(process.env.ADASH_MEDIA_ROOT ?? (/[\\/]apps[\\/](site-runtime|sites-admin)$/.test(cwd) ? path.resolve(cwd, "../..", ".local-media") : path.resolve(cwd, ".local-media")));
function safePath(key: string) {
  if (!/^[a-z0-9-]+\/[a-f0-9-]+\.webp$/.test(key)) throw new Error("Invalid storage key");
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return resolved;
}
export const localStorage: StorageAdapter = {
  async put(key, body) { const target = safePath(key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, body, { flag: "wx" }); },
  get(key) { return readFile(safePath(key)); },
  delete(key) { return unlink(safePath(key)); }
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export async function optimizeUpload(data: Buffer, declaredType: string) {
  if (data.length === 0 || data.length > MAX_UPLOAD_BYTES) throw new Error("Image must be 1 byte to 8 MB");
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(declaredType)) throw new Error("Unsupported image type");
  const processor = sharp(data, { failOn: "error", limitInputPixels: 40_000_000 });
  const info = await processor.metadata();
  const formats: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };
  const expected = formats[info.format ?? ""];
  if (expected !== declaredType || !info.width || !info.height || info.width > 10000 || info.height > 10000) throw new Error("Invalid image data or dimensions");
  const normalized = await processor.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toBuffer({ resolveWithObject: true });
  return { body: normalized.data, width: normalized.info.width, height: normalized.info.height, mimeType: "image/webp" };
}
export function newStorageKey(tenantId: string) { return `${tenantId}/${randomUUID().replaceAll("-", "")}.webp`; }
export function mediaUrl(id: string) { return `/media/${encodeURIComponent(id)}`; }
export async function mediaReferences(tenantId: string, assetId: string) {
  const [products, brand, site] = await Promise.all([
    prisma.productImage.count({ where: { tenantId, mediaAssetId: assetId } }),
    prisma.brandConfiguration.findUnique({ where: { tenantId } }),
    prisma.siteConfiguration.findUnique({ where: { tenantId } })
  ]);
  const url = mediaUrl(assetId);
  return { products, brand: brand?.logoMediaId === assetId || brand?.iconMediaId === assetId || brand?.logoUrl === url || brand?.iconUrl === url,
    content: Boolean(site && (JSON.stringify(site.homeSections).includes(url) || JSON.stringify(site.draftSections).includes(url))) };
}
export async function isPublicMedia(tenantId: string, assetId: string) {
  const [brand, productCount, site] = await Promise.all([
    prisma.brandConfiguration.findUnique({ where: { tenantId } }),
    prisma.productImage.count({ where: { tenantId, mediaAssetId: assetId, product: { status: "ACTIVE" } } }),
    prisma.siteConfiguration.findUnique({ where: { tenantId }, select: { homeSections: true, published: true } })
  ]);
  return Boolean(site?.published && (brand?.logoMediaId === assetId || brand?.iconMediaId === assetId || productCount > 0 || JSON.stringify(site.homeSections).includes(mediaUrl(assetId))));
}
