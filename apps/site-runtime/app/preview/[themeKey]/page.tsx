import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { demoSections } from "@adash/site-templates";
import { TemplatePage } from "@adash/site-components";
import { isThemeKey, resolveTheme, themeVariables, themePresets } from "@adash/site-themes";

export default async function ThemePreview({ params }: { params: Promise<{ themeKey: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { themeKey } = await params;
  if (!isThemeKey(themeKey)) notFound();
  const theme = resolveTheme(themeKey);
  if (!theme) notFound();
  return <div style={themeVariables(theme) as CSSProperties}><div className="preview-toolbar"><Link href="/preview">← All themes</Link><span>ADS-BEV-01 · {themePresets[themeKey].name}</span></div><TemplatePage sections={demoSections["island-fresh-demo"]} context={{ businessName: "Island Fresh Demo", countryName: "Jamaica", currencyCode: "JMD", locale: "en-JM" }} /></div>;
}
