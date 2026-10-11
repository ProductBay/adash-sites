import "server-only";
import { headers } from "next/headers";
import { normalizeHostname, resolveTenant } from "@adash/site-core";

export function validatedOrigin(input: { host: string | null; origin?: string | null; forwardedProto?: string | null; production: boolean }): string | null {
  const host = input.host?.trim().toLowerCase();
  if (!host || !/^[a-z0-9.-]+(?::\d{1,5})?$/.test(host) || !normalizeHostname(host)) return null;
  const protocol = input.forwardedProto?.split(",")[0].trim().toLowerCase() || (input.production ? "https" : "http");
  if (input.production ? protocol !== "https" : !["http", "https"].includes(protocol)) return null;
  const trusted = `${protocol}://${host}`;
  if (input.origin) {
    try { if (new URL(input.origin).origin !== trusted) return null; } catch { return null; }
  }
  return trusted;
}

export async function trustedTenantRequest(requireOrigin = false) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const tenant = await resolveTenant(host, undefined, true);
  if (!tenant) return null;
  const originHeader = requestHeaders.get("origin");
  if (requireOrigin && !originHeader) return null;
  const origin = validatedOrigin({ host, origin: originHeader, forwardedProto: requestHeaders.get("x-forwarded-proto"), production: process.env.NODE_ENV === "production" });
  return origin ? { tenant, origin } : null;
}
