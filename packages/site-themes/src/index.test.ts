import { describe, expect, it } from "vitest";
import { isThemeKey, resolveTheme, themeKeys, themePresets, themeVariables } from "./index";

describe("theme engine", () => {
  it("defines five distinct valid presets", () => {
    expect(themeKeys).toEqual(["tropical-fresh", "organic-earth", "luxury-artisan", "caribbean-bold", "modern-minimal"]);
    expect(new Set(themeKeys.map(key => themePresets[key].primary)).size).toBe(5);
    expect(isThemeKey("unknown")).toBe(false);
    expect(resolveTheme("unknown")).toBeNull();
  });
  it("produces CSS variables from preset and safe brand overrides", () => {
    const theme = resolveTheme("tropical-fresh", { primaryColor: "#123456", accentColor: "bad-value" });
    expect(theme).not.toBeNull();
    if (!theme) return;
    const vars = themeVariables(theme);
    expect(vars["--theme-primary"]).toBe("#123456");
    expect(vars["--theme-accent"]).toBe(themePresets["tropical-fresh"].accent);
    expect(vars["--theme-on-primary"]).toBe("#FFFFFF");
    expect(vars["--theme-radius"]).toBeTruthy();
    expect(vars["--theme-section-space"]).toBeTruthy();
  });
  it("rejects surface overrides that would make text unreadable", () => {
    const theme = resolveTheme("tropical-fresh", { backgroundColor: "#123456", secondaryColor: "#123456" });
    expect(theme?.background).toBe(themePresets["tropical-fresh"].background);
    expect(theme?.secondary).toBe(themePresets["tropical-fresh"].secondary);
  });
  it("falls back on unsafe primary colors and never emits arbitrary CSS", () => {
    const unsafe = resolveTheme("tropical-fresh", { primaryColor: "#777777", accentColor: "url(javascript:alert(1))" });
    expect(unsafe?.primary).toBe(themePresets["tropical-fresh"].primary);
    expect(unsafe?.accent).toBe(themePresets["tropical-fresh"].accent);
    expect(Object.keys(themeVariables(unsafe!))).not.toContain("--theme-arbitrary");
  });
});
