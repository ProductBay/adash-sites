import { headers } from "next/headers";
import { resolveTenant } from "@adash/site-core";
import { isPublicMedia, mediaAssetForTenant, mediaStorage, MediaObjectMissingError } from "@adash/site-core/media";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await resolveTenant((await headers()).get("host"));
  if (!tenant) return new Response(null, { status: 404 });
  const asset = await mediaAssetForTenant(tenant.id, (await params).id);
  if (!asset || !await isPublicMedia(tenant.id, asset.id)) return new Response(null, { status: 404 });
  try { const body = await mediaStorage.get(asset.storageKey); return new Response(new Uint8Array(body), { headers: { "Content-Type": asset.mimeType, "Cache-Control": "public, max-age=60, must-revalidate", "X-Content-Type-Options": "nosniff" } }); }
  catch (error) { return new Response(null, { status: error instanceof MediaObjectMissingError ? 404 : 503 }); }
}
