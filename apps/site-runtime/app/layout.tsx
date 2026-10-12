import type { ReactNode } from "react";
import "./style.css";
import { PwaRegistration } from "./pwa-registration";
import { headers } from "next/headers";
import { resolveTenant, createTenantRepository } from "@adash/site-core";
import { showPoweredByAdash } from "@adash/site-config";
import { PoweredByAdashBadge } from "@adash/site-components";

export default async function Layout({ children }: { children: ReactNode }) {
  const tenant = await resolveTenant((await headers()).get("host"));
  let showBadge = false;
  if (tenant) {
    const repository = createTenantRepository(tenant.id);
    const [site, features] = await Promise.all([repository.site(), repository.enabledFeatures()]);
    showBadge = Boolean(site?.published && showPoweredByAdash(features));
  }
  return <html lang="en"><head><link rel="manifest" href="/manifest.webmanifest" /></head><body>{children}{showBadge && <PoweredByAdashBadge />}<PwaRegistration /></body></html>;
}
