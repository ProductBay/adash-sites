import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { S3Client } from "@aws-sdk/client-s3";
vi.mock("server-only", () => ({}));
import { createS3MediaStorage, localStorage, MAX_UPLOAD_BYTES, MediaObjectMissingError, MediaStorageConfigurationError, newStorageKey, optimizeUpload, putWithRollback, selectMediaStorage } from "./media";

function fakeS3() {
  const objects = new Map<string, Uint8Array>();
  const send = vi.fn(async (command: { constructor: { name: string }; input: { Key?: string; Body?: Uint8Array } }) => {
    const key = String(command.input.Key);
    if (command.constructor.name === "PutObjectCommand") { objects.set(key, command.input.Body!); return {}; }
    if (command.constructor.name === "GetObjectCommand") {
      const body = objects.get(key);
      if (!body) throw Object.assign(new Error("missing"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });
      return { Body: { transformToByteArray: async () => body } };
    }
    if (command.constructor.name === "HeadObjectCommand") {
      if (!objects.has(key)) throw Object.assign(new Error("missing"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
      return {};
    }
    if (command.constructor.name === "DeleteObjectCommand") { objects.delete(key); return {}; }
    throw new Error("Unexpected command");
  });
  return { objects, send, client: { send } as unknown as S3Client };
}

const s3Environment = {
  ADASH_MEDIA_DRIVER: "s3", ADASH_MEDIA_BUCKET: "sites-staging", ADASH_MEDIA_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  ADASH_MEDIA_REGION: "auto", ADASH_MEDIA_ACCESS_KEY_ID: "test-access", ADASH_MEDIA_SECRET_ACCESS_KEY: "test-secret"
};

describe("secure image upload parsing", () => {
  it("rejects fake extension, HTML, JavaScript, corrupt image, oversized input and SVG", async () => {
    const fakeJpeg = Buffer.from("not really a JPEG");
    await expect(optimizeUpload(fakeJpeg, "image/jpeg")).rejects.toThrow();
    await expect(optimizeUpload(Buffer.from("<html><script>alert(1)</script></html>"), "image/jpeg")).rejects.toThrow();
    await expect(optimizeUpload(Buffer.from("console.log('x')"), "image/png")).rejects.toThrow();
    await expect(optimizeUpload(Buffer.from([0xff, 0xd8, 0x00, 0x00]), "image/jpeg")).rejects.toThrow();
    await expect(optimizeUpload(Buffer.alloc(MAX_UPLOAD_BYTES + 1), "image/jpeg")).rejects.toThrow("8 MB");
    const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#006644" } }).png().toBuffer();
    const gif = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#006644" } }).gif().toBuffer();
    await expect(optimizeUpload(gif, "image/gif")).rejects.toThrow("not supported");
    await expect(optimizeUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/svg+xml")).rejects.toThrow();
    await expect(optimizeUpload(png, "image/jpeg")).resolves.toMatchObject({ mimeType: "image/webp" });
    await expect(optimizeUpload(png, "application/octet-stream")).resolves.toMatchObject({ mimeType: "image/webp" });
  });
  it("preserves transparency when normalizing PNG to WebP", async () => {
    const source = await sharp({ create: { width: 24, height: 24, channels: 4, background: { r: 20, g: 80, b: 40, alpha: 0 } } }).png().toBuffer();
    const result = await optimizeUpload(source, "image/png");
    const metadata = await sharp(result.body).metadata();
    const pixel = await sharp(result.body).ensureAlpha().raw().toBuffer();
    expect(metadata.hasAlpha).toBe(true);
    expect(pixel[3]).toBe(0);
  });
  it("accepts genuine PNG, JPEG and WebP, normalizing each to a bounded WebP", async () => {
    for (const format of ["png", "jpeg", "webp"] as const) {
      const source = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#dd9a32" } }).toFormat(format).toBuffer();
      const result = await optimizeUpload(source, `image/${format}`);
      expect(result.mimeType).toBe("image/webp");
      expect(result.width).toBe(32);
      expect(result.height).toBe(24);
      expect((await sharp(result.body).metadata()).format).toBe("webp");
    }
  });
  it("reports whether a local media object is available without reading its contents", async () => {
    const key = newStorageKey("media-storage-test");
    expect(await localStorage.exists(key)).toBe(false);
    await localStorage.put(key, Buffer.from("test object"));
    try {
      expect(await localStorage.exists(key)).toBe(true);
    } finally {
      await localStorage.delete(key);
    }
    expect(await localStorage.exists(key)).toBe(false);
  });
  it("puts, gets, checks and deletes objects through the S3-compatible provider", async () => {
    const fake = fakeS3();
    const storage = createS3MediaStorage(s3Environment, fake.client);
    const key = "tenant-a/0123456789abcdef0123456789abcdef.webp";
    await storage.put(key, Buffer.from("durable image"));
    expect(await storage.exists(key)).toBe(true);
    expect((await storage.get(key)).toString()).toBe("durable image");
    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
    await expect(storage.get(key)).rejects.toBeInstanceOf(MediaObjectMissingError);
  });
  it("fails clearly when S3 configuration is missing or invalid", async () => {
    expect(() => createS3MediaStorage({ ADASH_MEDIA_BUCKET: "only-a-bucket" })).toThrow(MediaStorageConfigurationError);
    expect(() => createS3MediaStorage({ ...s3Environment, ADASH_MEDIA_ENDPOINT: "http://insecure.example" })).toThrow("HTTPS");
    await expect(selectMediaStorage({ NODE_ENV: "production", ADASH_MEDIA_DRIVER: "s3" }).exists("tenant/key.webp")).rejects.toBeInstanceOf(MediaStorageConfigurationError);
  });
  it("removes the uploaded object when MediaAsset creation fails", async () => {
    const fake = fakeS3();
    const storage = createS3MediaStorage(s3Environment, fake.client);
    const key = "tenant-a/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp";
    await expect(putWithRollback(storage, key, Buffer.from("image"), async () => { throw new Error("database unavailable"); })).rejects.toThrow("database unavailable");
    expect(await storage.exists(key)).toBe(false);
  });
});
