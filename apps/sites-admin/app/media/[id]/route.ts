import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, tenantPrincipal, can } from "@adash/site-auth";
import { resolveTenant } from "@adash/site-core";
import { mediaAssetForTenant, mediaStorage, MediaObjectMissingError } from "@adash/site-core/media";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await resolveTenant((await headers()).get("host"));
  const principal = tenant && await tenantPrincipal((await cookies()).get(SESSION_COOKIE)?.value, tenant.id);
  if (!tenant || !principal || !can(principal.role, "media.read")) return new Response(null, { status: 404 });
  const asset = await mediaAssetForTenant(tenant.id, (await params).id);
  if (!asset) return new Response(null, { status: 404 });
  try { const body = await mediaStorage.get(asset.storageKey); return new Response(new Uint8Array(body), { headers: { "Content-Type": asset.mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }); }
  catch (error) { return new Response(null, { status: error instanceof MediaObjectMissingError ? 404 : 503 }); }
}
