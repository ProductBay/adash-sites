import { notFound } from "next/navigation";
import { catalogue, formatMinor } from "@adash/site-core/catalogue";
import { dashboardContext } from "../../../context";
import { savePrice, saveVariant, saveVariantPrice, setProductStatus } from "../../../actions";
import { ProductForm } from "../form";
import { prisma } from "@adash/site-core";
import { attachProductMedia, detachProductMedia, updateProductImage } from "../../../media-actions";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await dashboardContext("product.read", "products");
  const { id } = await params;
  const repo = catalogue(tenant.id);
  const [product, categories, assets] = await Promise.all([repo.productById(id), repo.categories(), prisma.mediaAsset.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 100 })]);
  if (!product) notFound();
  return <main>
    <p className="eyebrow">Catalogue / {product.status.toLowerCase()}</p><h1>{product.name}</h1><p>Edit the details your customers see.</p>
    <ProductForm product={product} categories={categories} />
    <div className="split">
      <section className="panel"><h2>Pricing</h2>{product.prices.filter(p => p.active && !p.variantId).map(p => <p key={p.id}>Current: {formatMinor(p.amountMinor, p.currencyCode, tenant.locale)}</p>)}
        <form action={savePrice}><input type="hidden" name="productId" value={id} /><label>Price ({tenant.currencyCode})<input name="amount" inputMode="decimal" required placeholder="0.00" /></label><label>Compare price, optional<input name="compareAt" inputMode="decimal" /></label><button>Save price</button></form>
      </section>
      <section className="panel"><h2>Publishing</h2><p>Current state: {product.status.toLowerCase()}</p>{["ACTIVE", "DRAFT", "ARCHIVED"].map(status => <form key={status} action={setProductStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><button className="secondary">{status === "ACTIVE" ? "Publish" : status === "DRAFT" ? "Unpublish" : "Archive"}</button></form>)}</section>
    </div>
    <div className="split">
      <section className="panel"><h2>Variants</h2>{product.variants.map(v => <div key={v.id} className="compact-form"><h3>{v.name} {v.size}</h3>
        <form action={saveVariant}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="productId" value={id} /><label>Name<input name="name" defaultValue={v.name} required /></label><label>Size<input name="size" defaultValue={v.size ?? ""} /></label><label>Unit<input name="unit" defaultValue={v.unit ?? ""} /></label><label>SKU<input name="sku" defaultValue={v.sku ?? ""} /></label><label className="check"><input name="active" type="checkbox" defaultChecked={v.active} />Active</label><button className="secondary">Update variant</button></form>
        {product.prices.filter(p => p.variantId === v.id && p.active).map(p => <p key={p.id}>{formatMinor(p.amountMinor, p.currencyCode, tenant.locale)}</p>)}
        <form action={saveVariantPrice}><input type="hidden" name="productId" value={id} /><input type="hidden" name="variantId" value={v.id} /><label>Variant price<input name="amount" inputMode="decimal" required /></label><button className="secondary">Save variant price</button></form>
      </div>)}<h3>Add an option</h3><form action={saveVariant}><input type="hidden" name="productId" value={id} /><label>Name<input name="name" required /></label><label>Size<input name="size" /></label><label>Unit<input name="unit" /></label><label>SKU<input name="sku" /></label><button>Add variant</button></form></section>
      <section className="panel"><h2>Images</h2>{product.images.map(i => <div key={i.id} className="compact-form"><form action={updateProductImage}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="productId" value={id} /><label>Alt text<input name="altText" defaultValue={i.altText} required /></label><label>Order<input name="sortOrder" type="number" min="0" max="1000" defaultValue={i.sortOrder} /></label><label className="check"><input type="checkbox" name="isPrimary" defaultChecked={i.isPrimary} />Primary image</label><button className="secondary">Save image</button></form><form action={detachProductMedia}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="productId" value={id} /><button className="secondary">Remove association</button></form></div>)}<p>Select an uploaded image, or visit <a href="/dashboard/media">Media</a> to upload one.</p><form action={attachProductMedia}><input type="hidden" name="productId" value={id} /><label>Media image<select name="mediaAssetId" required><option value="">Choose image</option>{assets.map(a => <option key={a.id} value={a.id}>{a.originalFilename} — {a.altText}</option>)}</select></label><button>Add image</button></form></section>
    </div>
  </main>;
}
