import { headers } from "next/headers";
import { resolveTenant, createTenantRepository } from "@adash/site-core";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Offline() { const tenant = await resolveTenant((await headers()).get("host")); if (!tenant) notFound(); const business = await createTenantRepository(tenant.id).business(); return <main className="offline-page"><p className="eyebrow">{business?.displayName ?? tenant.name}</p><h1>You’re currently offline.</h1><p>Some live information, including prices and availability, may not be current. Please reconnect to continue.</p><a className="action action-primary" href="/">Try again</a></main>; }
