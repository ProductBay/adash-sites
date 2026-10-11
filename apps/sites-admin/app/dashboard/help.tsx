import Link from "next/link";

export const help = {
  overview: { title: "Start with the essentials", purpose: "Your overview tracks the real setup of this site. Nothing here needs a separate checkbox.", next: "Add your business details, then your brand and first product.", tips: ["You can return to any step at any time.", "A preview is private; publishing is a separate action."], href: "/dashboard/business", action: "Add business details" },
  business: { title: "Make it easy to find and contact you", purpose: "These details appear wherever customers need your business identity or contact information.", next: "Add a short, accurate description and at least one reliable contact method.", tips: ["Use a monitored email address and a phone number with country code.", "For WhatsApp, use the number customers can actually message."], href: "/dashboard/brand", action: "Next: Brand & theme" },
  brand: { title: "Build a consistent visual identity", purpose: "Choose a theme and colours, then select uploaded images for your logo and app icon.", next: "Save a theme preset, upload your logo in Media, and select it here.", tips: ["Use a transparent, high-quality logo if available.", "The preview shows representative content; check the real site preview too."], href: "/dashboard/media", action: "Upload a logo" },
  products: { title: "Build a clear catalogue", purpose: "Products tell visitors what you offer. You can save details first, then add price, options, and images.", next: "Add one product with a useful description, price, and clear image.", tips: ["Draft products are private; active products appear on the website.", "Bright, clear photos make the catalogue much more useful."], href: "/dashboard/products/new", action: "Add a product" },
  categories: { title: "Help customers browse", purpose: "Categories group similar products in your catalogue.", next: "Add a short category name, then assign it to products.", tips: ["Use names customers recognize, such as Drinks or Gift Sets.", "Keep URL names short, lowercase, and unique."], href: "/dashboard/products", action: "Review products" },
  content: { title: "Tell your story", purpose: "The homepage introduces your business and guides visitors toward products and contact.", next: "Write a clear headline and story, save a draft, then preview it.", tips: ["Write in your own voice; avoid claims you cannot verify.", "Saving a draft does not publish it."], href: "/dashboard/content/preview", action: "Preview draft" },
  locations: { title: "Show where customers can find you", purpose: "Add shops, pickup points, offices, retailers, or distributors. A store welcomes shoppers; a pickup point is for collecting orders.", next: "Add a location name, address, and clear hours before marking it visible.", tips: ["Office means business administration; retailer sells your goods; distributor supplies other sellers.", "If you do not receive visitors, do not publish a private address."], href: "/dashboard/business", action: "Review contact details" },
  media: { title: "Keep your images in one place", purpose: "Upload assets once and reuse them across products, brand, and content.", next: "Upload a sharp image and describe it for people using screen readers.", tips: ["PNG, JPEG, WebP, and AVIF are supported, up to 8 MB each.", "For product photos, aim for at least 1200 pixels on the long side when possible; this is a quality suggestion, not an upload requirement."], href: "/dashboard/products", action: "Use images in products" },
  publish: { title: "Review before you go live", purpose: "Content drafts require an explicit publish action. Product price and stock changes update immediately.", next: "Check the preview, contact details, images, and publication status.", tips: ["Preview the site on a phone as well as a larger screen.", "Do not publish placeholder or unapproved content."], href: "/dashboard/content/preview", action: "Preview draft" },
} as const;
export type HelpKey = keyof typeof help;

export const helpExtras: Record<HelpKey, { need: string; mistake: string }> = {
  overview: { need: "Your business name, contact details, brand assets, and first products.", mistake: "Trying to publish before checking the private preview." },
  business: { need: "Your public name, a short description, and contact details you monitor.", mistake: "Entering a personal address or an unmonitored contact number." },
  brand: { need: "Your logo and the colours you want customers to associate with you.", mistake: "Choosing colours that make text hard to read." },
  products: { need: "Product names, descriptions, accurate prices, availability, and photos.", mistake: "Publishing a product without checking price and stock." },
  categories: { need: "A few short group names that fit your products.", mistake: "Creating too many near-identical categories." },
  content: { need: "A headline, a concise story, real images, and a clear invitation to contact you.", mistake: "Leaving placeholder copy in a draft you later publish." },
  locations: { need: "A public address or pickup point, phone number, and current opening hours.", mistake: "Displaying a private address or outdated hours." },
  media: { need: "Your logo, business photos, product photos, and optional promotional images.", mistake: "Uploading blurry photos or images with important text embedded." },
  publish: { need: "A complete draft and time to review it on phone and desktop.", mistake: "Assuming a saved content draft is already live." },
};

export function AdminHelpPanel({ section }: { section: HelpKey }) {
  const item = help[section];
  return <section className="admin-help-panel" aria-label={`${item.title} guide`}><div><p className="eyebrow">A little guidance</p><h2>{item.title}</h2><p>{item.purpose}</p><p><strong>What you’ll need:</strong> {helpExtras[section].need}</p><p><strong>Next:</strong> {item.next}</p></div><details><summary>Helpful tips and example</summary><ul>{item.tips.map(tip => <li key={tip}>{tip}</li>)}</ul><p><strong>Avoid:</strong> {helpExtras[section].mistake}</p><Link href={item.href}>{item.action} →</Link></details></section>;
}
