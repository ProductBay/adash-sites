import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, can, revokeSession } from "@adash/site-auth";
import { dashboardContext } from "../context";

async function logout() { "use server"; const jar = await cookies(); await revokeSession(jar.get(SESSION_COOKIE)?.value); jar.delete(SESSION_COOKIE); redirect("/login"); }
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { tenant, principal } = await dashboardContext();
  const links = [
    ["/dashboard", "Overview", true], ["/dashboard/products", "Products", can(principal.role, "product.read")],
    ["/dashboard/categories", "Categories", can(principal.role, "product.read")], ["/dashboard/content", "Content", can(principal.role, "content.read")],
    ["/dashboard/locations", "Locations", can(principal.role, "location.read")], ["/dashboard/business", "Business", can(principal.role, "business.read")],
    ["/dashboard/brand", "Brand & theme", can(principal.role, "brand.read")],
    ["/dashboard/media", "Media", can(principal.role, "media.read")],
    ["/dashboard/publish", "Publish", can(principal.role, "content.read")]
  ] as const;
  return <div className="dashboard"><aside className="sidebar"><Link className="brandmark" href="/dashboard">A’DASH <span>SITES</span></Link><p>{tenant.name}</p><nav aria-label="Dashboard">{links.filter(([, , show]) => show).map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav><small className="nav-hint">Swipe the menu for more →</small><div className="account"><small>{principal.email} · {principal.role.replaceAll("_", " ")}</small><form action={logout}><button className="text-button">Log out</button></form></div></aside><div className="workspace">{tenant.status === "SUSPENDED" && <div role="status" className="panel"><strong>Site temporarily unavailable</strong><p>Your information remains available to review. Publishing and changes are paused. Please contact A’Dash support for restoration.</p></div>}{children}</div></div>;
}
