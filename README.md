# A’Dash Sites foundation

This npm workspace has a public Next.js runtime (`apps/site-runtime`), tenant-authorized client dashboard (`apps/sites-admin`), tenant-scoped data access (`packages/site-core`), country and feature configuration (`packages/site-config`), session authentication (`packages/site-auth`), and reusable template/theme/component packages. The only tenant data is fictional development seed data.

## Local setup

1. Use Node 20 or newer and a local PostgreSQL database.
2. Copy `.env.example` to `.env` and set a local `DATABASE_URL`.
3. Run `npm install`, `npm run db:generate`, `npx prisma migrate deploy`, and `npm run db:seed` with `NODE_ENV=development`.
4. Run `npm run dev --workspace @adash/site-runtime` and optionally `npm run dev --workspace @adash/sites-admin`.
5. Open `http://island-fresh-demo.localhost:3000` and `http://harbour-goods-demo.localhost:3000` for the two independent public tenants. Their dashboards are at the same hostnames on port 3001, e.g. `http://island-fresh-demo.localhost:3001/dashboard`.

The development seed creates one owner per tenant: `island-fresh-demo@example.test` and `harbour-goods-demo@example.test`. The development-only default password is `DemoOnly-2026!ChangeMe`; set `ADASH_DEMO_PASSWORD` **before the first seed** to choose another. Re-seeding does not reset existing user passwords. These fictional credentials must never be used for a real tenant.

On this Windows development machine, an isolated PostgreSQL 18 cluster was initialized under `.local-postgres/data` and uses port `55432`. The ignored `.env` points to `adash_sites_dev` there. If the cluster is stopped, start it with `pg_ctl -D .local-postgres/data -l .local-postgres/server.log -o "-p 55432 -h 127.0.0.1" start` before running the apps or Prisma commands. This cluster is local development data; it is not production infrastructure.

## Isolation contract

The runtime resolves the normalized `Host` header on the server. Verified domains are looked up first. An active tenant can also be reached by its slug under `ADASH_SITES_ROOT_DOMAIN`, or by `<slug>.localhost` only in development. Unknown and inactive hosts return 404. Custom domains must be normalized before writing to `TenantDomain.hostname`, verified before activation, and globally unique. Never use query strings or client-supplied tenant IDs as tenant identity.

After resolution, pass `tenant.id` into `createTenantRepository` or `catalogue`; their methods scope queries by that ID. Feature checks are server-side. Every dashboard mutation resolves the host tenant, validates the session and active membership, checks a central role permission, and then scopes record reads/writes to that tenant. The browser cannot choose a tenant ID. Server actions check request origin against the host, in addition to Next.js's built-in action protections.

The schema uses restrictive foreign keys to prevent accidental tenant deletion. Tenant ownership fields should not be changed after creation. Database credentials are required for runtime and seed operations.

## ADS-P2 · ADS-BEV-01

The template registry and Zod section contracts live in `packages/site-templates`. A published tenant selects `ADS-BEV-01` with `SiteConfiguration.templateKey`, a preset with `themeKey`, and an ordered `homeSections` JSON array. `draftSections` holds unpublished copy. Each section has `id`, `type`, `enabled`, `order`, and type-specific content. Invalid or unknown sections are logged and skipped; a missing valid hero makes the site unavailable. Tenant configuration is read through `createTenantRepository`, and the runtime filters product, location, testimonial, and WhatsApp sections against server-side feature entitlements.

`packages/site-themes` provides five presets and CSS variable generation. Brand color overrides are restricted to three hex tokens and checked for text contrast; unsafe choices are rejected in the dashboard and fall back to preset values at runtime. `packages/site-components` contains the server-rendered component library. Normal tenant pages now hydrate product and location sections from PostgreSQL, including status, category, pricing, inventory and image data. Preview routes retain fictional fixture content only for development. Images currently use approved local `/images/` references; media uploading remains deferred.

The two fictional seed tenants use the same template with different section copy, imagery, brand colors, and theme presets. Re-run `npm run db:seed` after changing demo fixtures in `packages/site-templates/src/demo.ts`. The seed is development-only and will replace those demo tenants' template section JSON.

In development, visit `/preview` on `localhost:3000` for links to all five theme presets. `/preview/[themeKey]` renders the complete demo composition and returns 404 outside development. With the runtime running, `npm run visual:check` captures tenant screenshots at mobile, tablet, desktop, and wide sizes, plus preset screenshots, into ignored `.browser-preview/`. It requires a local Chrome installation; set `CHROME_PATH` if Chrome is elsewhere.

The generated demo photos are saved as optimized WebP files under `apps/site-runtime/public/images/`. `scripts/create-demo-crops.mjs` derives six product and ingredient crops from the two still-life originals. Both originals are generic, unbranded imagery made for the template preview; no customer asset is included.

## ADS-P3 · Authentication and client operations

Users are global; `TenantMembership` controls access to a particular tenant. Roles are `OWNER`, `MANAGER`, `PRODUCT_MANAGER`, `CONTENT_EDITOR`, and `STAFF`. `packages/site-auth` maps roles to permission keys. Passwords use salted scrypt; sessions use opaque random tokens stored only as SHA-256 hashes in PostgreSQL. The admin cookie is HTTP-only, host-only, SameSite=Lax, and Secure in production. Logout revokes the database session. Sign-in attempts have a persisted per-email lockout after repeated failures. `User.passwordHash` is nullable so external identity providers can be integrated later, but no OAuth provider is configured now.

Products, categories, variants, prices, images, basic inventory, business details, locations, content, and brand/theme settings are edited in the dashboard. Prices are entered as decimal strings and parsed to integer minor units using `Intl.NumberFormat` currency digits; no floating-point amount is stored. The inventory service currently supports `BASIC`; `INVENTRA` is reserved but returns unavailable until a provider exists. Product prices, stock, availability, business details, locations, and brand/theme saves take effect immediately. Site copy is saved as a typed draft, privately previewed, and published separately. The site template and layout are never editable in the dashboard.

Local checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npx prisma migrate status`, and `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`. With both development servers running, `node scripts/phase3-browser-check.mjs`, `node scripts/phase3-content-check.mjs`, `node scripts/phase3-entitlement-check.mjs`, and `node scripts/phase3-responsive-check.mjs` exercise the workflows. `node scripts/phase3-db-check.mjs` checks tenant and audit invariants. `node scripts/cleanup-phase3-browser.mjs --clean` removes only generated browser-test records from the isolated local database and restores matching test-only demo settings. Browser screenshots go to ignored `.browser-preview/`.

This phase does not include checkout, online payments, Inventra, production provisioning, or deployment. Before production use, review remaining dependency advisories, add operational recovery/monitoring for authentication, and configure a production admin domain and real client onboarding.

## ADS-P4 · PWA, media, WhatsApp and publishing

Each published tenant serves its own `/manifest.webmanifest`, generated from current business, brand, site and theme data. PNG app icons at `/app-icon/192` and `/app-icon/512` derive from its selected media asset or a tenant-safe initial fallback. Unknown tenants get 404. Browser installation needs HTTPS in production and must be tested on the production origin; `.localhost` supports local service-worker testing, not final install certification.

The public service worker caches immutable Next static resources by origin and an `/offline` shell. It does not cache dashboard, API, login, media, icon, price, inventory or authentication responses. Online navigations use the network; offline navigation falls back to a tenant-safe message instead of stale product data.

The `StorageAdapter` in `packages/site-core/src/media.ts` stores optimized WebP files under ignored `.local-media/`, shared by both Next apps. Set `ADASH_MEDIA_ROOT` to an absolute shared path if they run from different working directories. This filesystem adapter is for local/single-host development; production requires object storage and backups. Upload accepts JPEG, PNG, WebP and AVIF up to 8 MB, parses images, limits dimensions/pixels, rotates, resizes to at most 2000 × 2000, and strips source metadata through re-encoding. `MAX_UPLOAD_BYTES` is the future plan-limit integration point; no commercial quota is enforced yet. Admin media routes require tenant membership. Public media is served only when referenced by an active product, current brand or published content. Deletion of referenced assets is blocked.

`/dashboard/media` uploads, lists, updates alt text and deletes unused assets. Product editing selects media with multiple associations, primary selection, ordering and alt text. Brand editing selects logo and app icon. Content editing selects hero and story images into a private draft. Product price, stock and business/brand settings change immediately; section copy and images require publishing. `/dashboard/content/preview` requires active membership and shows the private draft. `/dashboard/publish` shows status/history. Publishing commits a versioned snapshot, checksum and audit event in one transaction.

`whatsapp_ordering` is a server-side entitlement. The public product page offers a WhatsApp basket only when entitled and configured with a valid tenant number. The basket stores only IDs and quantities per tenant in browser local storage; current product/price/availability are read from the public server catalogue. WhatsApp opens a prefilled inquiry, not an order or payment. Jamaica and Guyana national formats are supported alongside valid international `+` numbers.

Phase 4 remains local-only. No customer production tenant, checkout, payments, Inventra, new template family, push or deployment is performed.
