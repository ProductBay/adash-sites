"use client";
import Image from "next/image";
import { useActionState, useState } from "react";
import { setBrandMedia, type BrandMediaState } from "../../media-actions";
type Asset = { id: string; filename: string; available: boolean };
const initialState: BrandMediaState = {};
function MediaPreview({ asset }: { asset: Asset }) {
  const [failed, setFailed] = useState(false);
  if (!asset.available || failed) return <div className="media-unavailable" role="status"><strong>Image unavailable — upload again</strong><span>The selection is retained until you choose a replacement.</span></div>;
  return <Image src={`/media/${asset.id}`} alt={asset.filename} width={120} height={120} unoptimized onError={() => setFailed(true)} style={{ objectFit: "contain", maxWidth: "100%" }} />;
}
export function BrandMediaSelector({ slot, selectedId, assets }: { slot: "logo" | "icon"; selectedId: string; assets: Asset[] }) {
  const [state, action, pending] = useActionState(setBrandMedia, initialState);
  const current = assets.find(asset => asset.id === selectedId);
  const label = slot === "logo" ? "logo" : "app icon";
  return <form action={action} className="panel" aria-busy={pending}>
    <h2>{slot === "logo" ? "Logo" : "PWA icon"}</h2>
    <p className="field-help">{slot === "logo" ? "A transparent PNG or WebP is ideal. Upload it in Media first." : "Choose a simple square mark that stays recognizable at a small size."}</p>
    <h3>Current {label}</h3>
    {current ? <><MediaPreview key={current.id} asset={current} /><p>{current.filename}</p></> : selectedId ? <div className="media-unavailable" role="status">Image unavailable — upload again</div> : <p>None / fallback</p>}
    <input type="hidden" name="slot" value={slot} />
    <label>Select uploaded image<select name="mediaAssetId" defaultValue={selectedId} key={selectedId} disabled={pending}><option value="">None / fallback</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.filename}{asset.available ? "" : " — unavailable"}</option>)}</select></label>
    <button disabled={pending}>{pending ? "Saving..." : `Save ${slot}`}</button>
    {!pending && state.success && <p className="notice" role="status">✓ {state.success}</p>}
    {!pending && state.error && <p className="notice" role="alert">{state.error}</p>}
  </form>;
}
