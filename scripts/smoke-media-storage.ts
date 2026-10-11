import "server-only";
import { randomUUID } from "node:crypto";
import { mediaStorage, mediaStorageDriver, mediaStorageInitialized } from "@adash/site-core/media";

async function main() {
  if (mediaStorageDriver !== "s3" || !mediaStorageInitialized) throw new Error("S3 media storage is not initialized");
  const key = `media-smoke/${randomUUID().replaceAll("-", "")}.webp`;
  const body = Buffer.from("A'Dash Sites R2 smoke test");
  const result = { put: "FAIL", existsAfterPut: "FAIL", get: "FAIL", delete: "FAIL", existsAfterDelete: "FAIL" };
  try {
    await mediaStorage.put(key, body); result.put = "PASS";
    if (await mediaStorage.exists(key)) result.existsAfterPut = "PASS";
    const restored = await mediaStorage.get(key);
    if (restored.length > 0 && restored.equals(body)) result.get = "PASS";
    await mediaStorage.delete(key); result.delete = "PASS";
    if (!await mediaStorage.exists(key)) result.existsAfterDelete = "PASS";
  } finally {
    await mediaStorage.delete(key).catch(() => {});
  }
  console.log(JSON.stringify(result));
  if (Object.values(result).some(value => value !== "PASS")) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Media storage smoke test failed");
  process.exitCode = 1;
});
