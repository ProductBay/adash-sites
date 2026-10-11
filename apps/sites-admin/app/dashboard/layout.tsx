import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, can, revokeSession } from "@adash/site-auth";
import { dashboardContext } from "../context";
import { AdminHelpDrawer } from "./help-drawer";
import { AdminNavigation } from "./admin-navigation";
import { AdminPlatformFooter } from "./admin-platform-footer";

async function logout() {
  "use server";
  const jar = await cookies();
  await revokeSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { tenant, principal } = await dashboardContext();
  const links = [
    ["/dashboard", "Overview", true],
    ["/dashboard/products", "Products", can(principal.role, "product.read")],
    ["/dashboard/categories", "Categories", can(principal.role, "product.read")],
    ["/dashboard/content", "Content", can(principal.role, "content.read")],
    ["/dashboard/locations", "Locations", can(principal.role, "location.read")],
    ["/dashboard/business", "Business", can(principal.role, "business.read")],
    ["/dashboard/brand", "Brand & theme", can(principal.role, "brand.read")],
    ["/dashboard/media", "Media", can(principal.role, "media.read")],
    ["/dashboard/publish", "Publish", can(principal.role, "content.read")]
  ] as const;
  const visibleLinks = links.filter(([, , show]) => show).map(([href, label]) => ({ href, label }));

  return <div className="dashboard">
    <AdminNavigation tenantName={tenant.name} email={principal.email} role={principal.role} links={visibleLinks} logout={logout} />
    <div className="workspace">
      {tenant.status === "SUSPENDED" && <div role="status" className="panel"><strong>Site temporarily unavailable</strong><p>Your information remains available to review. Publishing and changes are paused. Please contact A’Dash support for restoration.</p></div>}
      {children}<AdminPlatformFooter /><AdminHelpDrawer />
    </div>
  </div>;
}
