import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { validatedOrigin } from "./trusted-origin";

describe("trusted password-reset origins", () => {
  it("accepts a matching HTTPS admin origin", () => {
    expect(validatedOrigin({ host: "shop-admin.staging.adash.technology", origin: "https://shop-admin.staging.adash.technology", forwardedProto: "https", production: true })).toBe("https://shop-admin.staging.adash.technology");
  });
  it("rejects hostile origins, malformed hosts, and non-HTTPS production requests", () => {
    expect(validatedOrigin({ host: "shop-admin.staging.adash.technology", origin: "https://evil.example", forwardedProto: "https", production: true })).toBeNull();
    expect(validatedOrigin({ host: "evil.example/path", origin: "https://evil.example", forwardedProto: "https", production: true })).toBeNull();
    expect(validatedOrigin({ host: "shop-admin.staging.adash.technology", origin: "http://shop-admin.staging.adash.technology", forwardedProto: "http", production: true })).toBeNull();
  });
});
