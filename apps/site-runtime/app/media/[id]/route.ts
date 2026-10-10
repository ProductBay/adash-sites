import { headers } from "next/headers";
import { resolveTenant, prisma } from "@adash/site-core";
import { isPublicMedia, localStorage } from "@adash/site-core/media";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await resolveTenant((await headers()).get("host"));
  if (!tenant) return new Response(null, { status: 404 });
  const asset = await prisma.mediaAsset.findFirst({ where: { id: (await params).id, tenantId: tenant.id } });
  if (!asset || !await isPublicMedia(tenant.id, asset.id)) return new Response(null, { status: 404 });
  try { const body = await localStorage.get(asset.storageKey); return new Response(new Uint8Array(body), { headers: { "Content-Type": asset.mimeType, "Cache-Control": "public, max-age=60, must-revalidate", "X-Content-Type-Options": "nosniff" } }); }
  catch { return new Response(null, { status: 404 }); }
}
