import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { localStorage, MAX_UPLOAD_BYTES, newStorageKey, optimizeUpload } from "./media";

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
});
