import "server-only";
import { TenantStatus, type PrismaClient } from "@prisma/client";
import { featureKeySchema, type FeatureKey } from "@adash/site-config";
import { prisma } from "./index";

export const commercialStatuses = ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE_PERIOD", "SUSPENDED", "CANCELLED", "ARCHIVED"] as const;
export type CommercialStatus = typeof commercialStatuses[number];
export const operationalStatus = (status: CommercialStatus) => status === "ARCHIVED" ? TenantStatus.ARCHIVED : status === "SUSPENDED" || status === "CANCELLED" ? TenantStatus.SUSPENDED : TenantStatus.ACTIVE;

export async function getEffectiveTenantLicence(tenantId: string, db: PrismaClient = prisma) {
  const [tenant, control, rows] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId } }),
    db.tenantCommercialControl.findUnique({ where: { tenantId } }),
    db.tenantFeature.findMany({ where: { tenantId, enabled: true }, select: { featureKey: true } })
  ]);
  if (!tenant) return null;
  const status = (control?.commercialStatus ?? "ACTIVE") as CommercialStatus;
  const entitlements = rows.flatMap(row => { const parsed = featureKeySchema.safeParse(row.featureKey); return parsed.success ? [parsed.data] : []; }) as FeatureKey[];
  return {
    commercialStatus: status,
    technicalStatus: tenant.status,
    operational: tenant.status === TenantStatus.ACTIVE && !["SUSPENDED", "CANCELLED", "ARCHIVED"].includes(status),
    gracePeriodEndsAt: control?.gracePeriodEndsAt ?? null,
    planKey: control?.planKey ?? null,
    entitlements
  };
}
