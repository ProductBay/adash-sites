import { describe, expect, it } from "vitest";
import { initialColor, isHexColor, normalizeHex } from "./color-value";

describe("brand color values", () => {
  it("normalizes valid values to uppercase and supplies a leading hash", () => {
    expect(normalizeHex(" 4b5f3f ")).toBe("#4B5F3F");
    expect(isHexColor(normalizeHex("#e7e5d7"))).toBe(true);
  });

  it("accepts only complete six-digit HEX values", () => {
    expect(isHexColor("#B77242")).toBe(true);
    expect(isHexColor("#FFF")).toBe(false);
    expect(isHexColor("#GGGGGG")).toBe(false);
    expect(isHexColor("B77242")).toBe(false);
  });

  it("uses the preset fallback when a saved override is empty or invalid", () => {
    expect(initialColor("", "#15594A")).toEqual({ text: "#15594A", valid: "#15594A" });
    expect(initialColor("bad", "#D68B22")).toEqual({ text: "#D68B22", valid: "#D68B22" });
  });
});
