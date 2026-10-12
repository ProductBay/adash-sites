import { describe, expect, it } from "vitest";
import { featureKeySchema, showPoweredByAdash } from "./index";
describe("platform attribution policy", () => {
  it("shows attribution for founding/free/starter entitlements", () => {
    expect(showPoweredByAdash([])).toBe(true);
    expect(showPoweredByAdash(["products", "locations", "testimonials"])).toBe(true);
  });
  it("allows platform-granted white labeling", () => {
    expect(featureKeySchema.parse("white_label")).toBe("white_label");
    expect(showPoweredByAdash(["products", "white_label"])).toBe(false);
  });
});
