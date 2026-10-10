import "server-only";
import { PrismaClient, TenantStatus, DomainStatus } from "@prisma/client";
import { featureKeySchema, type FeatureKey } from "@adash/site-config";

const globalPrisma = globalThis as typeof globalThis & { adashPrisma?: PrismaClient };
export const prisma = globalPrisma.adashPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalPrisma.adashPrisma = prisma;

export function normalizeHostname(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/\.$/, "");
  if (!raw || /[\s/@\\?#]/.test(raw)) return null;
  const host = raw.replace(/:\d+$/, "");
  if (host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.split(".").some(label => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
  return host;
}

export type TenantLookup = Pick<PrismaClient, "tenantDomain" | "tenant">;
export async function resolveTenant(hostHeader: string | null, db: TenantLookup = prisma, allowSuspended = false) {
  const hostname = hostHeader && normalizeHostname(hostHeader);
  if (!hostname) return null;
  const allowed: TenantStatus[] = allowSuspended ? [TenantStatus.ACTIVE, TenantStatus.SUSPENDED] : [TenantStatus.ACTIVE];
  const domain = await db.tenantDomain.findUnique({ where: { hostname }, include: { tenant: true } });
  if (domain?.status === DomainStatus.VERIFIED && allowed.includes(domain.tenant.status)) return domain.tenant;

  // A managed subdomain still resolves against an existing tenant slug; no arbitrary tenant ID is accepted.
  const root = process.env.ADASH_SITES_ROOT_DOMAIN;
  const normalizedRoot = root && normalizeHostname(root);
  if (normalizedRoot && hostname.endsWith(`.${normalizedRoot}`)) {
    const slug = hostname.slice(0, -(normalizedRoot.length + 1));
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return db.tenant.findFirst({ where: { slug, status: { in: allowed } } });
    }
  }
  if (process.env.NODE_ENV === "development" && hostname.endsWith(".localhost")) {
    const slug = hostname.slice(0, -".localhost".length);
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return db.tenant.findFirst({ where: { slug, status: { in: allowed } } });
  }
  return null;
}

export function createTenantRepository(tenantId: string, db: PrismaClient = prisma) {
  if (!tenantId) throw new Error("Tenant context required");
  return {
    business: () => db.businessProfile.findUnique({ where: { tenantId } }),
    brand: () => db.brandConfiguration.findUnique({ where: { tenantId } }),
    site: () => db.siteConfiguration.findUnique({ where: { tenantId } }),
    domains: () => db.tenantDomain.findMany({ where: { tenantId } }),
    enabledFeatures: async (): Promise<FeatureKey[]> => {
      const rows = await db.tenantFeature.findMany({ where: { tenantId, enabled: true }, select: { featureKey: true } });
      return rows.flatMap(row => { const parsed = featureKeySchema.safeParse(row.featureKey); return parsed.success ? [parsed.data] : []; });
    },
    hasFeature: async (featureKey: FeatureKey) => Boolean(await db.tenantFeature.findUnique({ where: { tenantId_featureKey: { tenantId, featureKey } }, select: { enabled: true } }).then(row => row?.enabled))
  };
}
