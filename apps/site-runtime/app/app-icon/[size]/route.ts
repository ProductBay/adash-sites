import { headers } from "next/headers";
import sharp from "sharp";
import { resolveTenant, createTenantRepository, prisma } from "@adash/site-core";
import { localStorage } from "@adash/site-core/media";
import { resolveTheme } from "@adash/site-themes";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (size !== 192 && size !== 512) return new Response(null, { status: 404 });
  const tenant = await resolveTenant((await headers()).get("host"));
  if (!tenant) return new Response(null, { status: 404 });
  const repo = createTenantRepository(tenant.id);
  const [business, brand, site] = await Promise.all([repo.business(), repo.brand(), repo.site()]);
  if (!business || !site?.published) return new Response(null, { status: 404 });
  let image: Buffer | null = null;
  if (brand?.iconMediaId) {
    const asset = await prisma.mediaAsset.findFirst({ where: { id: brand.iconMediaId, tenantId: tenant.id } });
    if (asset) image = await localStorage.get(asset.storageKey).catch(() => null);
  }
  const theme = resolveTheme(site.themeKey, brand);
  const color = theme?.primary ?? "#202923";
  const letter = (business.shortName || business.displayName).trim().slice(0, 1).toUpperCase().replace(/[^A-Z0-9]/g, "") || "•";
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" rx="${size / 5}" fill="${color}"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${size / 2}">${letter}</text></svg>`);
  const png = image ? await sharp(image).resize(size, size, { fit: "contain", background: color }).png().toBuffer() : await sharp(svg).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600, must-revalidate", "X-Content-Type-Options": "nosniff" } });
}
