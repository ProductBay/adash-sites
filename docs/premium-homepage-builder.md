# ADS-BEV-01 homepage editing

The template registry defines the supported sections. Content uses one collapsible editor per section, the existing section schema, and private drafts. Save never publishes. Preview and public rendering share tenant product/location hydration and content visibility rules.

New tenants receive all section structures, with optional sections disabled and no invented products, claims, ingredients, statistics, testimonials or locations. Existing tenants can use **Add missing homepage sections** in Content. This preserves saved copy, media references, and enabled flags and places sections in template order.

Products, featured products and locations come from active tenant records. WhatsApp comes from Business details and requires the WhatsApp entitlement. Empty optional sections are hidden. Gallery and ingredient images use tenant-owned `/media/<asset-id>` references; unavailable objects are excluded or shown with a fallback.

## Staging upgrade utility

An alternative to the authenticated Content action is `scripts/upgrade-premium-homepage.ts`. Run under server conditions (`NODE_OPTIONS=--conditions=react-server`) with the isolated staging database environment and `ADASH_DEPLOYMENT_ENV=staging`.

Dry run:

```sh
npx tsx scripts/upgrade-premium-homepage.ts --tenant=cmv39nxev0000dms8kwmmg7t9 --staging-confirm
```

Review its missing-section count; add `--apply` to create the expanded draft. The script also checks the tenant has a staging hostname, uses optimistic concurrency, records an audit and is safe to rerun. It never changes the published document, branding, products, media or locations.

The upgrade has not been run for Sabrena during source implementation. Run only after staging release and review, then configure the new sections, preview and publish through the admin.
