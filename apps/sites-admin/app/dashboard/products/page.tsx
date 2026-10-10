import Link from "next/link";
import { catalogue, formatMinor } from "@adash/site-core/catalogue";
import { dashboardContext } from "../../context";
export default async function Products() {
  const { tenant } = await dashboardContext("product.read", "products");
  const products = await catalogue(tenant.id).products();
  return <main><div className="page-head"><div><p className="eyebrow">Catalogue</p><h1>Products</h1><p>Keep your collection current and easy to explore.</p></div><Link className="button" href="/dashboard/products/new">Add product</Link></div><div className="panel list">{products.length ? products.map(p => <Link className="list-row" key={p.id} href={`/dashboard/products/${p.id}`}><span><strong>{p.name}</strong><small>{p.category?.name ?? "Uncategorized"} · {p.status.toLowerCase()}</small></span><span>{p.prices[0] ? formatMinor(p.prices[0].amountMinor, p.prices[0].currencyCode, tenant.locale) : "No price"} →</span></Link>) : <p>No products yet. Start with one your customers love.</p>}</div></main>;
}
