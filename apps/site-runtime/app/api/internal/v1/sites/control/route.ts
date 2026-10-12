import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { countryConfig, featureKeySchema, featureKeys } from "@adash/site-config";
import { normalizeHostname, prisma } from "@adash/site-core";
import { defaultTenantSections } from "@adash/site-templates";
import { commercialStatuses, getEffectiveTenantLicence, operationalStatus } from "@adash/site-core/commercial";

export const dynamic = "force-dynamic";
const identity = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const status = z.enum(commercialStatuses);
const common = z.object({ customerId: identity, licenceId: identity, planKey: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/), status, gracePeriodEndsAt: z.string().datetime().nullable(), entitlements: z.array(featureKeySchema).max(featureKeys.length) });
const syncSchema = common.extend({ action: z.literal("sync"), tenantId: identity });
const provisionSchema = common.extend({ action: z.literal("provision"), businessName: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(63), countryCode: z.enum(["JM", "GY", "TT", "BB"]), templateKey: z.literal("ADS-BEV-01"), themeKey: z.enum(["tropical-fresh", "luxury-artisan", "modern-minimal", "warm-earthy"]), hostname: z.string().min(3).max(253) });
const payload = z.discriminatedUnion("action", [syncSchema, provisionSchema]);

function authenticated(request: Request, body: string) {
  const timestamp = request.headers.get("x-adash-timestamp") ?? "";
  const requestId = request.headers.get("x-adash-request-id") ?? "";
  const signature = request.headers.get("x-adash-signature") ?? "";
  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300_000 || !/^[0-9a-f-]{36}$/i.test(requestId) || !/^[0-9a-f]{64}$/i.test(signature)) return null;
  const input = `${timestamp}.${requestId}.${request.method}.${new URL(request.url).pathname}.${body}`;
  const supplied = Buffer.from(signature, "hex");
  const keys = [process.env.ADASH_INTERNAL_KEY_CURRENT, process.env.ADASH_INTERNAL_KEY_PREVIOUS].filter((key): key is string => Boolean(key && key.length >= 32));
  if (!keys.some(key => timingSafeEqual(createHmac("sha256", key).update(input).digest(), supplied))) return null;
  return requestId;
}

export async function GET(request: Request) {
  if (!authenticated(request, "")) return Response.json({ error: "unauthorized" }, { status: 401 });
  const tenantId = new URL(request.url).searchParams.get("tenantId");
  if (!tenantId || !identity.safeParse(tenantId).success) return Response.json({ error: "invalid tenant" }, { status: 400 });
  const state = await getEffectiveTenantLicence(tenantId);
  if (!state) return Response.json({ error: "not found" }, { status: 404 });
  const [site, domains] = await Promise.all([prisma.siteConfiguration.findUnique({ where: { tenantId }, select: { templateKey: true, themeKey: true, published: true } }), prisma.tenantDomain.findMany({ where: { tenantId }, select: { hostname: true, isPrimary: true, status: true } })]);
  return Response.json({ ...state, site, domains });
}

export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 32_768) return Response.json({ error: "too large" }, { status: 413 });
  const requestId = authenticated(request, body);
  if (!requestId) return Response.json({ error: "unauthorized" }, { status: 401 });
  let parsed: z.infer<typeof payload>;
  try { parsed = payload.parse(JSON.parse(body)); } catch { return Response.json({ error: "invalid request" }, { status: 400 }); }
  const digest = createHash("sha256").update(body).digest("hex");
  const prior = await prisma.controlRequest.findUnique({ where: { requestId } });
  if (prior) return prior.bodyDigest === digest ? Response.json(prior.responseJson) : Response.json({ error: "request ID reused" }, { status: 409 });
  try {
    const result = await prisma.$transaction(async tx => {
      let tenantId: string;
      if (parsed.action === "provision") {
        const hostname = normalizeHostname(parsed.hostname);
        const managedRoot = process.env.ADASH_SITES_ROOT_DOMAIN && normalizeHostname(process.env.ADASH_SITES_ROOT_DOMAIN);
        if (!hostname || hostname !== parsed.hostname.toLowerCase() || !(hostname === `${parsed.slug}.localhost` && process.env.NODE_ENV === "development") && !(managedRoot && hostname === `${parsed.slug}.${managedRoot}`)) throw new Error("Invalid managed hostname");
        const linked = await tx.tenantCommercialControl.findUnique({ where: { externalLicenceId: parsed.licenceId } });
        if (linked) {
          if (linked.externalCustomerId !== parsed.customerId) throw new Error("Licence/customer mismatch");
          tenantId = linked.tenantId;
        } else {
          if (await tx.tenant.findUnique({ where: { slug: parsed.slug } })) throw new Error("Slug already belongs to another tenant");
          const country = countryConfig[parsed.countryCode];
          const tenant = await tx.tenant.create({ data: { slug: parsed.slug, name: parsed.businessName, countryCode: parsed.countryCode, currencyCode: country.currencyCode, locale: country.locale, timezone: country.timezone, status: operationalStatus(parsed.status) } });
          tenantId = tenant.id;
          await tx.tenantDomain.create({ data: { tenantId, hostname, isPrimary: true, status: "VERIFIED", verifiedAt: new Date() } });
          await tx.businessProfile.create({ data: { tenantId, displayName: parsed.businessName, countryCode: parsed.countryCode } });
          await tx.brandConfiguration.create({ data: { tenantId } });
          await tx.siteConfiguration.create({ data: { tenantId, templateKey: parsed.templateKey, themeKey: parsed.themeKey, homeSections: defaultTenantSections(parsed.businessName, parsed.templateKey) as Prisma.InputJsonValue, published: false } });
        }
      } else {
        const tenant = await tx.tenant.findUnique({ where: { id: parsed.tenantId } });
        if (!tenant || tenant.status === "ARCHIVED" && parsed.status !== "ARCHIVED") throw new Error("Tenant not eligible");
        tenantId = tenant.id;
      }
      const existing = await tx.tenantCommercialControl.findUnique({ where: { tenantId } });
      if (existing && (existing.externalCustomerId !== parsed.customerId || existing.externalLicenceId !== parsed.licenceId)) throw new Error("Tenant/customer/licence mismatch");
      const otherLink = await tx.tenantCommercialControl.findUnique({ where: { externalLicenceId: parsed.licenceId } });
      if (otherLink && otherLink.tenantId !== tenantId) throw new Error("Licence linked to another tenant");
      const before = existing?.commercialStatus ?? null;
      await tx.tenantCommercialControl.upsert({ where: { tenantId }, create: { tenantId, externalCustomerId: parsed.customerId, externalLicenceId: parsed.licenceId, planKey: parsed.planKey, commercialStatus: parsed.status, gracePeriodEndsAt: parsed.gracePeriodEndsAt ? new Date(parsed.gracePeriodEndsAt) : null, entitlements: parsed.entitlements, lastRequestId: requestId }, update: { planKey: parsed.planKey, commercialStatus: parsed.status, gracePeriodEndsAt: parsed.gracePeriodEndsAt ? new Date(parsed.gracePeriodEndsAt) : null, entitlements: parsed.entitlements, lastRequestId: requestId } });
      await tx.tenant.update({ where: { id: tenantId }, data: { status: operationalStatus(parsed.status) } });
      for (const featureKey of featureKeys) await tx.tenantFeature.upsert({ where: { tenantId_featureKey: { tenantId, featureKey } }, create: { tenantId, featureKey, enabled: parsed.entitlements.includes(featureKey) }, update: { enabled: parsed.entitlements.includes(featureKey) } });
      const response = { tenantId, commercialStatus: parsed.status, operationalStatus: operationalStatus(parsed.status), entitlements: parsed.entitlements, requestId };
      await tx.controlRequest.create({ data: { tenantId, requestId, bodyDigest: digest, responseJson: response } });
      await tx.auditEvent.create({ data: { tenantId, eventType: before === null ? "platform.activated" : before !== parsed.status ? parsed.status === "SUSPENDED" ? "platform.suspended" : parsed.status === "ARCHIVED" ? "platform.archived" : "platform.reactivated" : "platform.entitlements_updated", entityType: "TenantCommercialControl", entityId: tenantId, metadataJson: { requestId, externalLicenceId: parsed.licenceId, status: parsed.status, planKey: parsed.planKey } } });
      return response;
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "link conflict" }, { status: 409 });
    return Response.json({ error: error instanceof Error ? error.message : "control failed" }, { status: 409 });
  }
}
