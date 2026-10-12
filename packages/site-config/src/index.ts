import { z } from "zod";

export const countryConfig = {
  GY: { countryCode: "GY", name: "Guyana", currencyCode: "GYD", locale: "en-GY", phonePrefix: "+592", timezone: "America/Guyana" },
  JM: { countryCode: "JM", name: "Jamaica", currencyCode: "JMD", locale: "en-JM", phonePrefix: "+1-876", timezone: "America/Jamaica" },
  TT: { countryCode: "TT", name: "Trinidad and Tobago", currencyCode: "TTD", locale: "en-TT", phonePrefix: "+1-868", timezone: "America/Port_of_Spain" },
  BB: { countryCode: "BB", name: "Barbados", currencyCode: "BBD", locale: "en-BB", phonePrefix: "+1-246", timezone: "America/Barbados" }
} as const;
export type CountryCode = keyof typeof countryConfig;

export const featureKeys = ["products", "whatsapp_ordering", "locations", "testimonials", "basic_inventory", "inventra", "commerce", "payments", "delivery", "analytics", "white_label"] as const;
export const featureKeySchema = z.enum(featureKeys);
export type FeatureKey = z.infer<typeof featureKeySchema>;

// Entitlements are granted by the platform control plane, not tenant content forms.
export function showPoweredByAdash(features: readonly FeatureKey[]): boolean {
  return !features.includes("white_label");
}

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ADASH_SITES_ROOT_DOMAIN: z.string().min(1).optional()
});
export function getServerEnv() {
  return envSchema.parse({ DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, ADASH_SITES_ROOT_DOMAIN: process.env.ADASH_SITES_ROOT_DOMAIN });
}
