import Link from "next/link";
import { prisma } from "@adash/site-core";
import { dashboardContext } from "../context";
export default async function Overview() {
  const { tenant } = await dashboardContext();
  const [products, locations, site, brand] = await Promise.all([prisma.product.findMany({ where: { tenantId: tenant.id }, include: { images: true } }), prisma.businessLocation.count({ where: { tenantId: tenant.id, active: true } }), prisma.siteConfiguration.findUnique({ where: { tenantId: tenant.id } }), prisma.brandConfiguration.findUnique({ where: { tenantId: tenant.id } })]);
  const active = products.filter(p => p.status === "ACTIVE").length;
  const draft = products.filter(p => p.status === "DRAFT").length;
  const out = products.filter(p => p.trackQuantity && (p.quantityOnHand ?? 0) === 0).length;
  return <main><p className="eyebrow">Your workspace</p><h1>Good to see you, {tenant.name}.</h1><p className="lede">A clear view of what your site needs today.</p><div className="stats"><article><strong>{products.length}</strong><span>Products</span></article><article><strong>{active}</strong><span>Live products</span></article><article><strong>{draft}</strong><span>Drafts</span></article><article><strong>{locations}</strong><span>Locations</span></article></div><section className="panel"><h2>Needs attention</h2><ul>{out > 0 && <li>{out} product{out > 1 ? "s are" : " is"} out of stock</li>}{draft > 0 && <li>{draft} product{draft > 1 ? "s are" : " is"} not published</li>}{products.filter(p => !p.images.length).length > 0 && <li>{products.filter(p => !p.images.length).length} product images missing</li>}{!brand?.logoUrl && <li>Add a brand logo when it is ready</li>}{!out && !draft && products.every(p => p.images.length) && brand?.logoUrl && <li>All caught up.</li>}</ul><Link href="/dashboard/products">Review products →</Link></section><section className="panel"><h2>Your site</h2><p>{site?.published ? "Published" : "Not published"} · {site?.themeKey?.replaceAll("-", " ")}</p><Link href="/dashboard/brand">Review branding →</Link></section></main>;
}
