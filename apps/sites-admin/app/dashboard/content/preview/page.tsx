import type { CSSProperties } from "react";
import Image from "next/image";
import { prisma } from "@adash/site-core";
import { parseSections } from "@adash/site-templates";
import { resolveTheme, themeVariables } from "@adash/site-themes";
import { dashboardContext } from "../../../context";
export default async function ContentPreview() {
  const { tenant } = await dashboardContext("content.read");
  const [site, brand, business] = await Promise.all([prisma.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } }), prisma.brandConfiguration.findUnique({ where: { tenantId: tenant.id } }), prisma.businessProfile.findUnique({ where: { tenantId: tenant.id } })]);
  const sections = parseSections(site.draftSections ?? site.homeSections, site.templateKey);
  const theme = resolveTheme(site.themeKey, brand);
  const imageSource = (src: string) => src.startsWith("/images/") && process.env.NODE_ENV === "development" ? `http://${tenant.slug}.localhost:3000${src}` : src;
  return <main style={theme ? themeVariables(theme) as CSSProperties : undefined}>
    <p className="notice" role="status">PREVIEW MODE — private draft for {business?.displayName ?? tenant.name}. Not visible on the public site.</p>
    <h1>{business?.displayName ?? tenant.name}</h1>
    {sections?.map(section => <section key={section.id} className="panel">
      <p className="eyebrow">{section.type.replace(/([A-Z])/g, " $1")}</p>
      {section.type === "hero" && <><h2>{section.headline}</h2><p>{section.copy}</p>{section.image && <Image src={imageSource(section.image.src)} alt={section.image.alt} width={900} height={450} unoptimized style={{ width: "100%", height: "auto" }} />}</>}
      {section.type === "brandStory" && <><h2>{section.heading}</h2><p>{section.body}</p>{section.image && <Image src={imageSource(section.image.src)} alt={section.image.alt} width={900} height={450} unoptimized style={{ width: "100%", height: "auto" }} />}</>}
      {section.type === "trustStrip" && <p>{section.items.join(" · ")}</p>}
      {section.type === "featureGrid" && section.items.map(item => <p key={item.heading}><strong>{item.heading}</strong> — {item.body}</p>)}
      {section.type === "contactCta" && <><h2>{section.heading}</h2><p>{section.body}</p></>}
      {section.type === "footer" && <p>{section.tagline}</p>}
    </section>)}
  </main>;
}
