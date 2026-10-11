import "server-only";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp, { type Metadata } from "sharp";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "./index";

export interface MediaStorage {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const cwd = process.cwd();
const root = path.resolve(process.env.ADASH_MEDIA_ROOT ?? (/[\\/]apps[\\/](site-runtime|sites-admin)$/.test(cwd) ? path.resolve(cwd, "../..", ".local-media") : path.resolve(cwd, ".local-media")));
function validateStorageKey(key: string) {
  if (!/^[a-z0-9-]+\/[a-f0-9-]+\.webp$/.test(key)) throw new Error("Invalid storage key");
  return key;
}
function safePath(key: string) {
  const resolved = path.resolve(root, validateStorageKey(key));
  if (!resolved.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return resolved;
}
export const localStorage: MediaStorage = {
  async put(key, body) { const target = safePath(key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, body, { flag: "wx" }); },
  get(key) { return readFile(safePath(key)); },
  delete(key) { return unlink(safePath(key)); },
  async exists(key) { try { await access(safePath(key)); return true; } catch { return false; } }
};

export class MediaStorageConfigurationError extends Error {
  constructor(message = "Media storage is not configured") { super(message); this.name = "MediaStorageConfigurationError"; }
}
export class MediaObjectMissingError extends Error {
  constructor() { super("Media object is missing"); this.name = "MediaObjectMissingError"; }
}
export class MediaStorageUnavailableError extends Error {
  constructor() { super("Media storage is unavailable"); this.name = "MediaStorageUnavailableError"; }
}

type S3StorageConfig = { bucket: string; endpoint: string; region: string; accessKeyId: string; secretAccessKey: string };
type MediaEnvironment = Partial<Record<"NODE_ENV" | "ADASH_MEDIA_DRIVER" | "ADASH_MEDIA_BUCKET" | "ADASH_MEDIA_ENDPOINT" | "ADASH_MEDIA_REGION" | "ADASH_MEDIA_ACCESS_KEY_ID" | "ADASH_MEDIA_SECRET_ACCESS_KEY", string>>;

function missingObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NotFound" || candidate.name === "NoSuchKey" || candidate.$metadata?.httpStatusCode === 404;
}

export class S3MediaStorage implements MediaStorage {
  constructor(private readonly config: S3StorageConfig, private readonly client: S3Client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  })) {}

  async put(key: string, body: Buffer) {
    validateStorageKey(key);
    try { await this.client.send(new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: body, ContentType: "image/webp" })); }
    catch { throw new MediaStorageUnavailableError(); }
  }
  async get(key: string) {
    validateStorageKey(key);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
      if (!result.Body) throw new MediaObjectMissingError();
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (error instanceof MediaObjectMissingError || missingObject(error)) throw new MediaObjectMissingError();
      throw new MediaStorageUnavailableError();
    }
  }
  async delete(key: string) {
    validateStorageKey(key);
    try { await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key })); }
    catch { throw new MediaStorageUnavailableError(); }
  }
  async exists(key: string) {
    validateStorageKey(key);
    try { await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key })); return true; }
    catch (error) { if (missingObject(error)) return false; throw new MediaStorageUnavailableError(); }
  }
}

export function createS3MediaStorage(environment: MediaEnvironment = process.env, client?: S3Client): S3MediaStorage {
  const bucket = environment.ADASH_MEDIA_BUCKET?.trim();
  const endpoint = environment.ADASH_MEDIA_ENDPOINT?.trim();
  const region = environment.ADASH_MEDIA_REGION?.trim();
  const accessKeyId = environment.ADASH_MEDIA_ACCESS_KEY_ID?.trim();
  const secretAccessKey = environment.ADASH_MEDIA_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !endpoint || !region || !accessKeyId || !secretAccessKey) throw new MediaStorageConfigurationError("S3 media storage configuration is incomplete");
  try { const parsed = new URL(endpoint); if (parsed.protocol !== "https:") throw new Error(); } catch { throw new MediaStorageConfigurationError("S3 media endpoint must be a valid HTTPS URL"); }
  const config = { bucket, endpoint, region, accessKeyId, secretAccessKey };
  return new S3MediaStorage(config, client ?? new S3Client({ endpoint, region, credentials: { accessKeyId, secretAccessKey } }));
}

class UnconfiguredMediaStorage implements MediaStorage {
  constructor(private readonly message = "Media storage is not configured") {}
  private failure(): never { throw new MediaStorageConfigurationError(this.message); }
  async put(): Promise<void> { this.failure(); }
  async get(): Promise<Buffer> { return this.failure(); }
  async delete(): Promise<void> { this.failure(); }
  async exists(): Promise<boolean> { return this.failure(); }
}

export function selectMediaStorage(environment: MediaEnvironment = process.env): MediaStorage {
  const driver = environment.ADASH_MEDIA_DRIVER?.trim().toLowerCase();
  if (driver === "s3") {
    try { return createS3MediaStorage(environment); }
    catch (error) { return new UnconfiguredMediaStorage(error instanceof Error ? error.message : undefined); }
  }
  if (driver === "local" || (!driver && environment.NODE_ENV !== "production")) return localStorage;
  return new UnconfiguredMediaStorage();
}

export const mediaStorage = selectMediaStorage();
export const mediaStorageDriver = process.env.ADASH_MEDIA_DRIVER?.trim().toLowerCase() || (process.env.NODE_ENV === "production" ? "unconfigured" : "local");
export const mediaStorageInitialized = !(mediaStorage instanceof UnconfiguredMediaStorage);
console.info(`Media storage driver: ${mediaStorageDriver}`);
console.info(`Media storage provider initialized: ${mediaStorageInitialized ? "yes" : "no"}`);

export async function putWithRollback<T>(storage: MediaStorage, key: string, body: Buffer, createRecord: () => Promise<T>): Promise<T> {
  await storage.put(key, body);
  try { return await createRecord(); }
  catch (error) { await storage.delete(key).catch(() => {}); throw error; }
}

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
export function mediaAssetForTenant(tenantId: string, assetId: string, db: PrismaClient = prisma) {
  return db.mediaAsset.findFirst({ where: { tenantId, id: assetId } });
}
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
export async function isPublicMedia(tenantId: string, assetId: string, db: PrismaClient = prisma) {
  const [brand, productCount, site] = await Promise.all([
    db.brandConfiguration.findUnique({ where: { tenantId } }),
    db.productImage.count({ where: { tenantId, mediaAssetId: assetId, product: { status: "ACTIVE" } } }),
    db.siteConfiguration.findUnique({ where: { tenantId }, select: { homeSections: true, published: true } })
  ]);
  return Boolean(site?.published && (brand?.logoMediaId === assetId || brand?.iconMediaId === assetId || productCount > 0 || JSON.stringify(site.homeSections).includes(mediaUrl(assetId))));
}
