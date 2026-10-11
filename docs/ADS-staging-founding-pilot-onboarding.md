# Staging-only founding-pilot licence exception

This is an operational record for Supabase project `xnbeszlxpjfuuecegyok` only. It is **not** a production migration or authorization to apply the exception to production.

On 2026-10-10, staging `public.client_licences` gained:

- `pilot_mode boolean NOT NULL DEFAULT false`
- `pilot_classification text`
- nullable `proposal_id` and `agreement_id`, protected by `client_licences_pilot_guard`

The guard preserves required proposal and agreement links for every non-pilot licence. A pilot licence must have no proposal or agreement links, classification `Founding Pilot`, platform `adash-sites`, plan `sites-starter`, commercial status `TRIAL`, `ACTIVE`, or `SUSPENDED`, billing status `WAIVED`, zero `amount_minor` and `recurring_fee`, no billing frequency, and `auto_renew = false`. The existing foreign keys remain in place.

The Sabrena staging pilot has one commercial customer identity, one `service_requests` row, and one `client_licences` row (`2b5b4a47-b447-4434-b40a-ac23f5b1ab0c`). No proposal or agreement was fabricated. The existing `sites-control` function was not redeployed.

On 2026-10-10, after the user explicitly ended retries of the failing control-plane transport path and a fresh zero-record check, Sabrena was created directly in the isolated Render Sites staging database. This was **manual staging pilot creation**, not `sites-control` provisioning. Tenant ID: `cmv39nxev0000dms8kwmmg7t9`. The verified primary domain is `sabrenas-tropical-blend.staging.adash.technology`. The tenant is `ACTIVE`, the commercial control is `TRIAL`, and the site is unpublished. The starter entitlements are products, locations, and testimonials. Sites and commercial audit events explicitly identify manual staging reconciliation after control-plane transport failure.

The existing commercial licence is linked to this tenant with `sites_sync_status = healthy`, while billing remains waived at zero and no proposal or agreement exists. The Sites owner `sabrinatropicalblend@gmail.com` has one ACTIVE OWNER membership. Its temporary password is stored only in a Windows DPAPI-protected file at `C:\tmp\sabrena-sites-owner-password.dpapi`. Authentication through the existing Sites auth implementation passed and the test session was revoked. The canonical hostname did not resolve in DNS during the access check, so browser login there remains unverified until routing is configured.

Production was not changed. This staging-only schema exception must not be treated as a replacement for the paid-production agreement workflow.
