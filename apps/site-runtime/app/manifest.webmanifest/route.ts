import { headers } from "next/headers";
import { resolveTenant, createTenantRepository } from "@adash/site-core";
import { resolveTheme } from "@adash/site-themes";
export const dynamic = "force-dynamic";
export async function GET() {
  const tenant = await resolveTenant((await headers()).get("host"));
  if (!tenant) return new Response(null, { status: 404 });
  const repo = createTenantRepository(tenant.id);
  const [business, brand, site] = await Promise.all([repo.business(), repo.brand(), repo.site()]);
  if (!business || !site?.published) return new Response(null, { status: 404 });
  const theme = resolveTheme(site.themeKey, brand);
  const color = theme?.primary ?? "#202923";
  const icons = [192, 512].map(size => ({ src: `/app-icon/${size}?v=${brand?.updatedAt.getTime() ?? 0}`, sizes: `${size}x${size}`, type: "image/png", purpose: "any maskable" }));
  return Response.json({ name: business.displayName, short_name: business.shortName || business.displayName.slice(0, 24), description: site.siteDescription || business.description || business.displayName, start_url: "/", scope: "/", display: "standalone", theme_color: color, background_color: theme?.background ?? "#ffffff", icons }, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } });
}
