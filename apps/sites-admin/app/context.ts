import "server-only";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { resolveTenant, prisma, createTenantRepository } from "@adash/site-core";
import { SESSION_COOKIE, tenantPrincipal, can, type Permission } from "@adash/site-auth";
import { featureKeySchema } from "@adash/site-config";

export async function dashboardContext(permission?: Permission, feature?: string) {
  const tenant = await resolveTenant((await headers()).get("host"), undefined, true);
  if (!tenant) notFound();
  const principal = await tenantPrincipal((await cookies()).get(SESSION_COOKIE)?.value, tenant.id);
  if (!principal) redirect("/login");
  if (permission && !can(principal.role, permission)) notFound();
  if (tenant.status === "SUSPENDED" && permission && !permission.endsWith(".read") && permission !== "billing.view" && permission !== "apps.view") notFound();
  if (feature) {
    const key = featureKeySchema.parse(feature);
    if (!await createTenantRepository(tenant.id).hasFeature(key)) notFound();
  }
  return { tenant, principal };
}

export async function audit(tenantId: string, actorUserId: string, eventType: string, entityType: string, entityId?: string, metadataJson?: Record<string, string | number | boolean | null>) {
  await prisma.auditEvent.create({ data: { tenantId, actorUserId, eventType, entityType, entityId, metadataJson } });
}
