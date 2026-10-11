import "server-only";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { prisma } from "./index";

export interface MediaStorage {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const cwd = process.cwd();
const root = path.resolve(process.env.ADASH_MEDIA_ROOT ?? (/[\\/]apps[\\/](site-runtime|sites-admin)$/.test(cwd) ? path.resolve(cwd, "../..", ".local-media") : path.resolve(cwd, ".local-media")));
function safePath(key: string) {
  if (!/^[a-z0-9-]+\/[a-f0-9-]+\.webp$/.test(key)) throw new Error("Invalid storage key");
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return resolved;
}
export const localStorage: MediaStorage = {
  async put(key, body) { const target = safePath(key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, body, { flag: "wx" }); },
  get(key) { return readFile(safePath(key)); },
  delete(key) { return unlink(safePath(key)); },
  async exists(key) { try { await access(safePath(key)); return true; } catch { return false; } }
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export class MediaUploadError extends Error {
  constructor(public readonly code: "size" | "unsupported" | "unreadable" | "dimensions", message: string) {
    super(message);
    this.name = "MediaUploadError";
  }
}
export async function optimizeUpload(data: Buffer, declaredType: string) {
  if (data.length === 0 || data.length > MAX_UPLOAD_BYTES) throw new MediaUploadError("size", "Image exceeds the 8 MB limit");
  // Browser MIME data is only a hint. Sharp's decoded format is authoritative.
  void declaredType;
  const processor = sharp(data, { failOn: "error", limitInputPixels: 40_000_000 });
  let info: Metadata;
  try {
    info = await processor.metadata();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/pixel limit/i.test(message)) throw new MediaUploadError("dimensions", "Image exceeds the 40 million pixel limit");
    throw new MediaUploadError("unreadable", "That image could not be read");
  }
  if (!(["jpeg", "png", "webp", "avif"] as Array<string | undefined>).includes(info.format)) {
    throw new MediaUploadError("unsupported", "This image format is not supported");
  }
  if (!info.width || !info.height || info.width > 10000 || info.height > 10000) {
    throw new MediaUploadError("dimensions", "Image dimensions must not exceed 10,000 × 10,000 pixels");
  }
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
