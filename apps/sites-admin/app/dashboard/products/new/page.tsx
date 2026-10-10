import { catalogue } from "@adash/site-core/catalogue";
import { dashboardContext } from "../../../context";
import { ProductForm } from "../form";
export default async function NewProduct() { const { tenant } = await dashboardContext("product.create", "products"); const categories = await catalogue(tenant.id).categories(); return <main><p className="eyebrow">Catalogue</p><h1>New product</h1><p>Start with the essentials. You can add a price and image after saving.</p><ProductForm categories={categories} /></main>; }
