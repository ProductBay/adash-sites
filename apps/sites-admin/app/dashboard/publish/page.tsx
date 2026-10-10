import { prisma } from "@adash/site-core";
import { dashboardContext } from "../../context";
import { publishContent } from "../../actions";
export default async function PublishPage() {
  const { tenant, principal } = await dashboardContext("content.read");
  const [site, history] = await Promise.all([prisma.siteConfiguration.findUniqueOrThrow({ where: { tenantId: tenant.id } }), prisma.sitePublication.findMany({ where: { tenantId: tenant.id }, orderBy: { version: "desc" }, take: 20, include: { publishedBy: { select: { email: true } } } })]);
  const { can } = await import("@adash/site-auth");
  return <main><p className="eyebrow">Release control</p><h1>Publish & site status</h1><section className="panel"><h2>{site.draftSections ? "Unpublished changes" : site.published ? "Published" : "Not published"}</h2><p>Version {site.publicationVersion}. Product pricing and availability update immediately; content drafts require publication.</p><a href="/dashboard/content/preview" target="_blank" rel="noopener noreferrer">Preview draft</a>{site.draftSections && can(principal.role, "content.publish") && <form action={publishContent}><button>Publish draft now</button></form>}</section><section className="panel"><h2>Publish history</h2>{history.length ? <ol>{history.map(item => <li key={item.id}>Version {item.version} · {item.publishedAt.toLocaleString()} · {item.publishedBy.email}</li>)}</ol> : <p>No publication history yet.</p>}</section></main>;
}
