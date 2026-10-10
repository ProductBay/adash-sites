import Link from "next/link";
import { notFound } from "next/navigation";
import { themeKeys, themePresets } from "@adash/site-themes";
export const dynamic = "force-dynamic";
export default function PreviewIndex() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="preview-index"><p className="eyebrow">A’Dash Sites / ADS-P2</p><h1>Theme previews</h1><p>Development-only ADS-BEV-01 previews with fictional content.</p><div className="preview-list">{themeKeys.map(key => <Link key={key} href={`/preview/${key}`}><span className="preview-swatch" style={{ background: themePresets[key].primary }} />{themePresets[key].name}<span aria-hidden="true">↗</span></Link>)}</div></main>;
}
