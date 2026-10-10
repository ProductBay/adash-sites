import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const themeShape = z.object({
  primary: hex, secondary: hex, accent: hex, background: hex, surface: hex, text: hex,
  mutedText: hex, border: hex, success: hex, warning: hex, error: hex,
  headingFont: z.enum(["editorial", "modern"]), bodyFont: z.enum(["humanist", "modern"]),
  radius: z.enum(["soft", "round", "crisp"]), shadowStyle: z.enum(["soft", "defined", "none"]),
  buttonStyle: z.enum(["pill", "rounded", "square"]), sectionSpacing: z.enum(["airy", "balanced", "compact"]),
  containerWidth: z.enum(["wide", "standard"])
});
export type Theme = z.infer<typeof themeShape>;

export const themePresets = {
  "tropical-fresh": { name: "Tropical Fresh", primary: "#15594A", secondary: "#D7E7D4", accent: "#D68B22", background: "#FAF8EF", surface: "#FFFFFF", text: "#173A31", mutedText: "#53675E", border: "#D6DED4", success: "#236F55", warning: "#966120", error: "#9C3C3C", headingFont: "editorial", bodyFont: "humanist", radius: "round", shadowStyle: "soft", buttonStyle: "pill", sectionSpacing: "airy", containerWidth: "wide" },
  "organic-earth": { name: "Organic Earth", primary: "#4B5F3F", secondary: "#E7E5D7", accent: "#B77242", background: "#F5F2E8", surface: "#FCFBF7", text: "#2D382C", mutedText: "#626B5F", border: "#D9DCCF", success: "#4F754E", warning: "#9B672D", error: "#9C4440", headingFont: "editorial", bodyFont: "humanist", radius: "soft", shadowStyle: "soft", buttonStyle: "rounded", sectionSpacing: "balanced", containerWidth: "standard" },
  "luxury-artisan": { name: "Luxury Artisan", primary: "#392F2C", secondary: "#EEE4DA", accent: "#A36D4F", background: "#F8F4EF", surface: "#FFFDF9", text: "#302724", mutedText: "#70635C", border: "#DCD3CC", success: "#496C54", warning: "#936A35", error: "#9D4440", headingFont: "editorial", bodyFont: "modern", radius: "crisp", shadowStyle: "defined", buttonStyle: "square", sectionSpacing: "airy", containerWidth: "standard" },
  "caribbean-bold": { name: "Caribbean Bold", primary: "#174F66", secondary: "#D9E8E9", accent: "#C76635", background: "#F8F6F0", surface: "#FFFFFF", text: "#173D4C", mutedText: "#516870", border: "#D3E1E2", success: "#2B715A", warning: "#A45E25", error: "#9D4440", headingFont: "modern", bodyFont: "humanist", radius: "round", shadowStyle: "defined", buttonStyle: "pill", sectionSpacing: "balanced", containerWidth: "wide" },
  "modern-minimal": { name: "Modern Minimal", primary: "#273C3B", secondary: "#E6EBE8", accent: "#A57858", background: "#F7F8F5", surface: "#FFFFFF", text: "#24312F", mutedText: "#65716C", border: "#DDE3DF", success: "#3C775D", warning: "#936A35", error: "#9D4440", headingFont: "modern", bodyFont: "modern", radius: "soft", shadowStyle: "none", buttonStyle: "rounded", sectionSpacing: "airy", containerWidth: "wide" }
} as const satisfies Record<string, Theme & { name: string }>;
export type ThemeKey = keyof typeof themePresets;
export const themeKeys = Object.keys(themePresets) as ThemeKey[];
export function isThemeKey(value: string): value is ThemeKey { return Object.hasOwn(themePresets, value); }

export const designTokens = {
  spacing: { xs: "0.5rem", sm: "1rem", md: "1.5rem", lg: "2.5rem", xl: "4rem", xxl: "6.5rem" },
  breakpoints: { mobile: "40rem", tablet: "64rem", desktop: "80rem" },
  typography: { display: "clamp(3.4rem, 8vw, 7.8rem)", heading: "clamp(2.3rem, 4.5vw, 4.7rem)", body: "1rem", label: ".76rem", caption: ".82rem" },
  motion: { quick: "180ms", gentle: "420ms" },
  zIndex: { header: "20", overlay: "40" }
} as const;

export type BrandOverride = { primaryColor?: string | null; secondaryColor?: string | null; accentColor?: string | null; backgroundColor?: string | null; headingFont?: string | null; bodyFont?: string | null };
function safeColor(value: string | null | undefined, fallback: string): string { return value && hex.safeParse(value).success ? value : fallback; }
function luminance(color: string): number {
  const parts = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return .2126 * parts[0] + .7152 * parts[1] + .0722 * parts[2];
}
function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
function safeSurfaceColor(value: string | null | undefined, fallback: string, text: string, muted: string): string {
  const color = safeColor(value, fallback);
  return contrast(color, text) >= 4.5 && contrast(color, muted) >= 4.5 ? color : fallback;
}
function safePrimaryColor(value: string | null | undefined, fallback: string): string {
  const color = safeColor(value, fallback);
  return Math.max(contrast(color, "#FFFFFF"), contrast(color, "#172B26")) >= 4.5 ? color : fallback;
}
function foreground(color: string): string {
  return contrast(color, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#172B26";
}
export function resolveTheme(key: string, brand?: BrandOverride | null): Theme | null {
  if (!isThemeKey(key)) return null;
  const preset = themePresets[key];
  return themeShape.parse({ ...preset,
    primary: safePrimaryColor(brand?.primaryColor, preset.primary), secondary: safeSurfaceColor(brand?.secondaryColor, preset.secondary, preset.text, preset.mutedText),
    accent: safeSurfaceColor(brand?.accentColor, preset.accent, preset.text, preset.mutedText), background: safeSurfaceColor(brand?.backgroundColor, preset.background, preset.text, preset.mutedText),
    headingFont: brand?.headingFont === "editorial" || brand?.headingFont === "modern" ? brand.headingFont : preset.headingFont,
    bodyFont: brand?.bodyFont === "humanist" || brand?.bodyFont === "modern" ? brand.bodyFont : preset.bodyFont
  });
}
export function themeVariables(theme: Theme): Record<string, string> {
  const radius = { soft: ".85rem", round: "1.5rem", crisp: ".25rem" }[theme.radius];
  const buttonRadius = { pill: "99rem", rounded: ".8rem", square: ".2rem" }[theme.buttonStyle];
  const shadow = { soft: "0 24px 70px rgba(26,50,43,.09)", defined: "0 18px 40px rgba(27,35,32,.14)", none: "none" }[theme.shadowStyle];
  return {
    "--theme-primary": theme.primary, "--theme-on-primary": foreground(theme.primary), "--theme-secondary": theme.secondary,
    "--theme-accent": theme.accent, "--theme-background": theme.background, "--theme-surface": theme.surface,
    "--theme-text": theme.text, "--theme-muted": theme.mutedText, "--theme-border": theme.border,
    "--theme-success": theme.success, "--theme-warning": theme.warning, "--theme-error": theme.error,
    "--theme-heading-font": theme.headingFont === "editorial" ? "Georgia, 'Times New Roman', serif" : "Arial, Helvetica, sans-serif",
    "--theme-body-font": theme.bodyFont === "humanist" ? "'Trebuchet MS', Arial, sans-serif" : "Arial, Helvetica, sans-serif",
    "--theme-radius": radius, "--theme-button-radius": buttonRadius, "--theme-shadow": shadow,
    "--theme-section-space": { airy: "6.5rem", balanced: "5rem", compact: "3.5rem" }[theme.sectionSpacing],
    "--theme-container": theme.containerWidth === "wide" ? "80rem" : "72rem"
  };
}
