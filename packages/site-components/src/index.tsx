import Image from "next/image";
import type { ReactNode } from "react";
import type { ProductPreview, SiteSection } from "@adash/site-templates";
import { formatCurrency } from "@adash/site-templates";

type Of<T extends SiteSection["type"]> = Extract<SiteSection, { type: T }>;
type ImageData = { src: string; alt: string };
type Context = { businessName: string; countryName: string; currencyCode: string; locale: string; logoUrl?: string | null; whatsappBasket?: boolean; contact?: { email?: string | null; phone?: string | null; whatsappHref?: string | null } };

function Picture({ image, className = "", priority = false, sizes = "(max-width: 640px) 100vw, 50vw" }: { image?: ImageData; className?: string; priority?: boolean; sizes?: string }) {
  if (!image) return <div className={`picture-placeholder ${className}`} aria-hidden="true"><span>✳</span></div>;
  return <div className={`picture ${className}`}><Image src={image.src} alt={image.alt} fill priority={priority} sizes={sizes} className="picture-img" unoptimized={image.src.startsWith("/media/")} /></div>;
}

function Action({ cta, tone = "primary" }: { cta?: { label: string; href: string }; tone?: "primary" | "outline" | "text" }) {
  if (!cta) return null;
  const external = cta.href.startsWith("https://");
  return <a className={`action action-${tone}`} href={cta.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{cta.label}<span aria-hidden="true">↗</span></a>;
}

export function SectionHeading({ eyebrow, heading, body, align = "left" }: { eyebrow?: string; heading: string; body?: string; align?: "left" | "center" }) {
  return <div className={`section-heading section-heading-${align}`}>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{heading}</h2>{body && <p className="section-intro">{body}</p>}</div>;
}

export function HeroProduct({ section, businessName }: { section: Of<"hero">; businessName: string }) {
  return <section id={section.id} className="hero-section" aria-label={`${businessName} introduction`}>
    <div className="hero-shell"><div className="hero-copy"><p className="eyebrow">{section.eyebrow ?? businessName}</p><h1>{section.headline}</h1>{section.copy && <p className="hero-intro">{section.copy}</p>}<div className="hero-actions"><Action cta={section.primaryCta} /><Action cta={section.secondaryCta} tone="text" /></div>{section.badges.length > 0 && <ul className="hero-badges">{section.badges.map(badge => <li key={badge}>{badge}</li>)}</ul>}</div><Picture image={section.image} priority className="hero-visual" sizes="(max-width: 800px) 100vw, 55vw" /></div>
    <div className="hero-bottom"><span>01 / A considered kind of everyday</span><span>Discover more ↓</span></div>
  </section>;
}

export function TrustStrip({ section }: { section: Of<"trustStrip"> }) {
  if (!section.items.length) return null;
  return <section id={section.id} className="trust-strip" aria-label="Brand highlights"><div className="container trust-inner">{section.items.map((item, index) => <div className="trust-item" key={`${item}-${index}`}><span aria-hidden="true" className="trust-spark">✳</span>{item}</div>)}</div></section>;
}

export function ProductCard({ product, currencyCode, locale }: { product: ProductPreview; currencyCode: string; locale: string }) {
  return <article className="product-card"><div className="product-media"><Picture image={product.image} sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 26vw" />{product.badge && <span className="product-badge">{product.badge}</span>}{!product.available && <span className="product-unavailable">Currently unavailable</span>}</div><div className="product-info"><div><p className="product-category">{product.category?.name ?? product.size ?? "The collection"}</p><h3>{product.name}</h3></div><p className="product-price">{product.price === null ? "Price on request" : formatCurrency(product.price, currencyCode, locale)}{product.comparePrice && <del>{formatCurrency(product.comparePrice, currencyCode, locale)}</del>}</p></div>{product.description && <p className="product-description">{product.description}</p>}{product.cta && <Action cta={product.cta} tone="text" />}</article>;
}

export function ProductCardSkeleton() {
  return <div className="product-card product-skeleton" aria-hidden="true"><div className="product-media" /><div className="skeleton-line" /><div className="skeleton-line skeleton-short" /></div>;
}

export function ProductGrid({ section, context }: { section: Of<"productGrid"> | Of<"featuredProducts">; context: Context }) {
  const groups = new Map<string, ProductPreview[]>();
  for (const product of section.products) { const name = product.category?.name ?? "Other favourites"; groups.set(name, [...(groups.get(name) ?? []), product]); }
  return <section id={section.id} className="section products-section"><div className="container"><div className="section-top"><SectionHeading eyebrow={section.eyebrow} heading={section.heading} body={section.body} /><span className="section-number">THE COLLECTION / {String(section.order).padStart(2, "0")}</span></div>{section.products.length ? section.type === "productGrid" ? [...groups].map(([name, products]) => <div key={name} className="product-group"><h3>{name}</h3><div className="product-grid">{products.map(product => <ProductCard key={product.id} product={product} currencyCode={context.currencyCode} locale={context.locale} />)}</div></div>) : <div className="product-grid">{section.products.map(product => <ProductCard key={product.id} product={product} currencyCode={context.currencyCode} locale={context.locale} />)}</div> : <p className="empty-state">The collection is being prepared.</p>}</div></section>;
}
export function FeaturedProducts(props: { section: Of<"featuredProducts">; context: Context }) { return <ProductGrid {...props} />; }

export function BrandStory({ section }: { section: Of<"brandStory"> }) {
  return <section id={section.id} className="section story-section"><div className={`container story-grid story-${section.imageSide}`}><Picture image={section.image} className="story-image" /><div className="story-copy"><SectionHeading eyebrow={section.eyebrow} heading={section.heading} body={section.body} /><Action cta={section.cta} tone="outline" />{section.highlights?.length ? <dl className="story-highlights">{section.highlights.map(item => <div key={item.label}><dt>{item.value}</dt><dd>{item.label}</dd></div>)}</dl> : null}</div></div></section>;
}

export function FeatureCard({ item, index }: { item: Of<"featureGrid">["items"][number]; index: number }) {
  return <article className="feature-card"><span className="feature-index">0{index + 1}</span><span className="feature-symbol" aria-hidden="true">{item.symbol}</span><h3>{item.heading}</h3><p>{item.body}</p></article>;
}
export function FeatureGrid({ section }: { section: Of<"featureGrid"> }) {
  return <section id={section.id} className="section feature-section"><div className="container"><SectionHeading eyebrow={section.eyebrow} heading={section.heading} body={section.body} /><div className="feature-grid">{section.items.map((item, index) => <FeatureCard key={`${item.heading}-${index}`} item={item} index={index} />)}</div></div></section>;
}

export function IngredientCard({ item }: { item: Of<"ingredientShowcase">["items"][number] }) {
  return <article className="ingredient-card"><Picture image={item.image} className="ingredient-media" /><div className="ingredient-copy">{item.badge && <span className="ingredient-badge">{item.badge}</span>}<h3>{item.name}</h3><p>{item.description}</p>{item.origin && <p className="ingredient-origin">Origin: {item.origin}</p>}{item.benefit && <p className="ingredient-benefit">{item.benefit}</p>}</div></article>;
}
export function IngredientShowcase({ section }: { section: Of<"ingredientShowcase"> }) {
  return <section id={section.id} className={`section ingredient-section ingredient-${section.layout}`}><div className="container"><SectionHeading eyebrow={section.eyebrow} heading={section.heading} body={section.body} align="center" /><div className="ingredient-grid">{section.items.map(item => <IngredientCard key={item.name} item={item} />)}</div></div></section>;
}

export function PromoBanner({ section }: { section: Of<"promoBanner"> }) { return <section id={section.id} className="section promo-section"><div className="container promo-inner"><SectionHeading eyebrow={section.eyebrow} heading={section.heading} body={section.body} /><Action cta={section.cta} /></div></section>; }
export function WhatsAppCTA({ section }: { section: Of<"whatsappCta"> }) { return <PromoBanner section={{ ...section, type: "promoBanner" }} />; }
export function ContactCTA({ section, context }: { section: Of<"contactCta">; context: Context }) {
  const email = context.contact?.email;
  const phone = context.contact?.phone;
  const whatsappHref = context.contact?.whatsappHref;
  const phoneHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;
  return <section id={section.id} className="section contact-section" aria-labelledby={`${section.id}-heading`}>
    <div className="container contact-shell">
      <div className="contact-topline"><span className="eyebrow">{section.eyebrow ?? "Let’s connect"}</span><span className="contact-index">A conversation starts here <span aria-hidden="true">↗</span></span></div>
      <div className="contact-layout">
        <div className="contact-intro"><h2 id={`${section.id}-heading`}>{section.heading}</h2><p>{section.body || `Questions, ideas, or something special in mind? We’d love to hear from you.`}</p><div className="contact-rule"><span aria-hidden="true">✳</span><span>Made for real conversations</span></div></div>
        <div className="contact-card"><div className="contact-card-top"><span className="contact-card-number">01 / GET IN TOUCH</span><span className="contact-card-spark" aria-hidden="true">✳</span></div><h3>Let’s talk about what you need.</h3><p>Whether it’s a product question, an order enquiry, or a collaboration, choose the way that works for you.</p><div className="contact-actions">
          {whatsappHref && <a className="contact-action contact-action-primary" href={whatsappHref} target="_blank" rel="noopener noreferrer"><span><strong>WhatsApp us</strong><small>Start a conversation</small></span><span aria-hidden="true">↗</span></a>}
          {email && <a className="contact-action contact-action-secondary" href={`mailto:${email}`}><span><strong>Email us</strong><small>{email}</small></span><span aria-hidden="true">↗</span></a>}
          {!email && !whatsappHref && phoneHref && <a className="contact-action contact-action-primary" href={phoneHref}><span><strong>Call us</strong><small>{phone}</small></span><span aria-hidden="true">↗</span></a>}
          {!email && !whatsappHref && !phoneHref && section.cta && <Action cta={section.cta} />}
        </div>{context.whatsappBasket && <a className="contact-basket" href="/basket">Already picked your favourites? Review your WhatsApp basket <span aria-hidden="true">→</span></a>}</div>
      </div>
      {(email || phone) && <div className="contact-bottom"><span>CONTACT DETAILS</span>{phone && phoneHref && <a href={phoneHref}>{phone}</a>}{email && <a href={`mailto:${email}`}>{email}</a>}<span className="contact-bottom-note">We’ll confirm availability and next steps directly.</span></div>}
    </div>
  </section>;
}

export function TestimonialCard({ quote }: { quote: Of<"testimonials">["quotes"][number] }) { return <figure className="quote-card"><span aria-hidden="true" className="quote-mark">“</span><blockquote>{quote.quote}</blockquote><figcaption><strong>{quote.name}</strong>{quote.detail && <span>{quote.detail}</span>}</figcaption></figure>; }
export function TestimonialCarousel({ section }: { section: Of<"testimonials"> }) {
  return <section id={section.id} className="section testimonial-section"><div className="container"><SectionHeading eyebrow={section.eyebrow} heading={section.heading} body={section.body} /><div className="testimonial-track" tabIndex={section.quotes.length > 1 ? 0 : undefined} aria-label="Customer comments; scroll horizontally for more">{section.quotes.map((quote, index) => <TestimonialCard key={`${quote.name}-${index}`} quote={quote} />)}</div></div></section>;
}
export function LocationPreview({ section }: { section: Of<"locations"> }) {
  return <section id={section.id} className="section locations-section"><div className="container"><SectionHeading eyebrow={section.eyebrow} heading={section.heading} body={section.body} /><div className="location-grid">{section.locations.map(location => <article className="location-card" key={location.name}><span className="location-pin" aria-hidden="true">⌖</span><h3>{location.name}</h3><p>{location.address}</p>{location.hours && <p>{location.hours}</p>}{location.href && <Action cta={{ label: "Directions", href: location.href }} tone="text" />}</article>)}</div></div></section>;
}
export function SocialGallery({ section }: { section: Of<"socialGallery"> }) {
  return <section id={section.id} className="section social-section"><div className="container"><div className="section-top"><SectionHeading eyebrow={section.eyebrow} heading={section.heading} body={section.body} /><Action cta={section.cta} tone="text" /></div><div className="social-grid">{section.images.map((image, index) => <Picture key={`${image.src}-${index}`} image={image} sizes="(max-width: 640px) 45vw, 25vw" />)}</div></div></section>;
}
export function PremiumFooter({ section, context }: { section: Of<"footer">; context: Context }) {
  return <footer id={section.id} className="site-footer"><div className="container footer-main"><div><p className="footer-label">GOOD THINGS, MADE WITH CARE</p><h2>{context.businessName}</h2><p>{section.tagline ?? `Made in ${context.countryName}.`}</p></div><nav aria-label="Footer navigation"><span>Explore</span>{section.links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</nav></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} {context.businessName}</span><span>Powered by A’Dash Sites</span></div></footer>;
}

export function SiteHeader({ businessName, sections, logoUrl, whatsappBasket }: { businessName: string; sections: SiteSection[]; logoUrl?: string | null; whatsappBasket?: boolean }) {
  const has = (type: SiteSection["type"]) => sections.find(section => section.type === type)?.id;
  return <header className="site-header"><div className="container header-inner"><a className="wordmark" href="#top" aria-label={`${businessName}, back to top`}>{logoUrl ? <Image src={logoUrl} alt="" width={40} height={40} className="wordmark-logo" unoptimized={logoUrl.startsWith("/media/")} /> : <span className="wordmark-symbol" aria-hidden="true">✳</span>}{businessName}</a><nav aria-label="Main navigation"><a href="#top">Home</a>{has("featuredProducts") && <a href={`#${has("featuredProducts")}`}>Collection</a>}{has("brandStory") && <a href={`#${has("brandStory")}`}>Our story</a>}{has("ingredientShowcase") && <a href={`#${has("ingredientShowcase")}`}>What goes in</a>}{whatsappBasket && <a href="/basket">Basket</a>}</nav>{has("contactCta") || has("locations") ? <a className="header-cta" href={`#${has("contactCta") ?? has("locations")}`}>Get in touch <span aria-hidden="true">↗</span></a> : null}</div></header>;
}

export function TemplatePage({ sections, context }: { sections: SiteSection[]; context: Context }) {
  const rendered: ReactNode[] = [];
  for (const section of sections) {
    let content: ReactNode = null;
    switch (section.type) {
      case "hero": content = <HeroProduct section={section} businessName={context.businessName} />; break;
      case "trustStrip": content = <TrustStrip section={section} />; break;
      case "featuredProducts": content = <FeaturedProducts section={section} context={context} />; break;
      case "brandStory": content = <BrandStory section={section} />; break;
      case "featureGrid": content = <FeatureGrid section={section} />; break;
      case "ingredientShowcase": content = <IngredientShowcase section={section} />; break;
      case "productGrid": content = <ProductGrid section={section} context={context} />; break;
      case "promoBanner": content = <PromoBanner section={section} />; break;
      case "whatsappCta": content = <WhatsAppCTA section={section} />; break;
      case "testimonials": content = <TestimonialCarousel section={section} />; break;
      case "locations": content = <LocationPreview section={section} />; break;
      case "socialGallery": content = <SocialGallery section={section} />; break;
      case "contactCta": content = <ContactCTA section={section} context={context} />; break;
      case "footer": content = <PremiumFooter section={section} context={context} />; break;
    }
    rendered.push(<div key={section.id}>{content}</div>);
  }
  return <div id="top" className="template-page"><a className="skip-link" href="#main">Skip to content</a><SiteHeader businessName={context.businessName} logoUrl={context.logoUrl} whatsappBasket={context.whatsappBasket} sections={sections} /><main id="main">{rendered}</main></div>;
}
