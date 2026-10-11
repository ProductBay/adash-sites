import Image from "next/image";
import { prisma } from "@adash/site-core";
import { mediaReferences } from "@adash/site-core/media";
import { dashboardContext } from "../../context";
import { deleteMedia, updateMediaAlt, uploadMedia } from "../../media-actions";
import { AdminHelpPanel } from "../help";

export default async function MediaLibrary() {
  const { tenant } = await dashboardContext("media.read");
  const assets = await prisma.mediaAsset.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const references = await Promise.all(assets.map(asset => mediaReferences(tenant.id, asset.id)));
  return <main><p className="eyebrow">Your assets</p><h1>Media library</h1><p>Upload images once, then select them for products and branding. Images are optimized to WebP.</p><AdminHelpPanel section="media" />
    <form action={uploadMedia} className="panel"><h2>Upload image</h2><label>Image (PNG, JPEG, WebP or AVIF; 8 MB maximum)<input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/avif" required /><small className="field-help">Choose a sharp, well-lit image. Avoid screenshots and text-heavy graphics.</small></label><label>Alt text<input name="altText" maxLength={180} placeholder="Describe the image" /><small className="field-help">Describe what a person would see, for example “Three bottled juices on a wooden counter.”</small></label><button>Upload image</button></form>
    {!assets.length && <div className="panel empty-state"><h2>No media uploaded yet</h2><p>Start by uploading your logo and your best product photos. You can also use this library for business and promotional site images.</p></div>}<div className="media-grid">{assets.map((asset, index) => <article className="panel" key={asset.id}><Image src={`/media/${asset.id}`} alt={asset.altText || "Uploaded image"} width={320} height={240} unoptimized style={{ width: "100%", height: "auto" }} /><p><strong>{asset.originalFilename}</strong> · {asset.width} × {asset.height}</p><p className="hint">Asset ID: <code>{asset.id}</code></p><p className="hint">Used by {references[index].products} product image(s){references[index].brand ? ", brand" : ""}{references[index].content ? ", content" : ""}</p><form action={updateMediaAlt}><input type="hidden" name="id" value={asset.id} /><label>Alt text<input name="altText" defaultValue={asset.altText} maxLength={180} /></label><button className="secondary">Save alt text</button></form>{!references[index].products && !references[index].brand && !references[index].content && <form action={deleteMedia}><input type="hidden" name="id" value={asset.id} /><label>Type DELETE to remove<input name="confirm" pattern="DELETE" required /></label><button className="secondary">Delete unused asset</button></form>}</article>)}</div>
  </main>;
}
