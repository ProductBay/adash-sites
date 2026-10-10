import { prisma } from "@adash/site-core";
import { parseSections } from "@adash/site-templates";
import { dashboardContext } from "../../context";
import { saveContent } from "../../actions";
export default async function Content() {
  const { tenant } = await dashboardContext("content.read");
  const [site, assets] = await Promise.all([prisma.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } }), prisma.mediaAsset.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 100 })]);
  const sections = parseSections(site.draftSections ?? site.homeSections, site.templateKey);
  const hero = sections?.find(s => s.type === "hero"); const trust = sections?.find(s => s.type === "trustStrip"); const story = sections?.find(s => s.type === "brandStory"); const features = sections?.find(s => s.type === "featureGrid"); const contact = sections?.find(s => s.type === "contactCta"); const footer = sections?.find(s => s.type === "footer");
  return <main><p className="eyebrow">Your site</p><h1>Site content</h1><p>Save changes as a private draft, preview, then publish when ready.</p>{site.draftSections && <p className="notice">You have unpublished changes.</p>}
    <form className="panel" action={saveContent}><h2>First impression</h2><label>Hero headline<input name="headline" defaultValue={hero?.type === "hero" ? hero.headline : ""} required /></label><label>Hero supporting copy<textarea name="heroCopy" defaultValue={hero?.type === "hero" ? hero.copy : ""} /></label><label>New hero image<select name="heroMediaId"><option value="">Keep current image</option>{assets.map(a => <option key={a.id} value={a.id}>{a.originalFilename}</option>)}</select></label>{trust?.type === "trustStrip" && <label>Trust highlights, one per line<textarea name="trustItems" defaultValue={trust.items.join("\n")} /></label>}
      <h2>Your story</h2><label>Story heading<input name="storyHeading" defaultValue={story?.type === "brandStory" ? story.heading : ""} /></label><label>Brand story<textarea name="story" defaultValue={story?.type === "brandStory" ? story.body : ""} /></label><label>New story image<select name="storyMediaId"><option value="">Keep current image</option>{assets.map(a => <option key={a.id} value={a.id}>{a.originalFilename}</option>)}</select></label>
      {features?.type === "featureGrid" && <><h2>What makes you different</h2>{features.items.map((item, index) => <div key={index} className="split"><label>Feature {index + 1} heading<input name={`feature${index}Heading`} defaultValue={item.heading} /></label><label>Feature {index + 1} copy<textarea name={`feature${index}Body`} defaultValue={item.body} /></label></div>)}</>}
      {contact?.type === "contactCta" && <><h2>Invitation to connect</h2><label>Contact heading<input name="contactHeading" defaultValue={contact.heading} /></label><label>Contact copy<textarea name="contactBody" defaultValue={contact.body ?? ""} /></label></>}
      <h2>Final note</h2><label>Footer copy<textarea name="footer" defaultValue={footer?.type === "footer" ? footer.tagline : ""} /></label><button>Save draft</button></form>
    <section className="panel"><h2>Ready to publish?</h2><p>Product prices and stock save immediately. Content remains private until published.</p><a href="/dashboard/content/preview" target="_blank" rel="noopener noreferrer">Preview draft →</a><p><a href="/dashboard/publish">View publish status and history →</a></p></section>
  </main>;
}
