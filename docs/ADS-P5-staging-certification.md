# ADS-P5 isolated staging certification

Status: staging Supabase project `adash-sites-staging` (`xnbeszlxpjfuuecegyok`) was created on 2026-10-09 in West US (Oregon), matching the production `ADash` project's region. The `sites-control` Edge Function was deployed to **this staging reference only** with `--use-api`; an unauthenticated POST returned 401. No staging commercial migration, Sites deployment, or end-to-end certification has yet been performed.

## Isolation gate

Record the **staging** Supabase project reference, API URL, database host, and Sites deployment URL before any write. Confirm the reference differs from the production `ADash` project and the staging database contains only fictional test customers. Never rely on a CLI linked-project default. Do not run `supabase db push` against this repository: it could apply unrelated pending migrations. Apply only `A-Dash-Technology/supabase/migrations/20261008153000_sites_control_plane.sql` to the explicitly verified staging database, after backing up staging and reviewing its migration history. Deploy only `sites-control` with an explicit staging project reference. Keep production credentials out of all staging processes.

## Required configuration

| Component | Name | Purpose |
| --- | --- | --- |
| A-Dash-Technology staging browser app | `VITE_SUPABASE_URL` | Staging Supabase API URL only. |
| A-Dash-Technology staging browser app | `VITE_SUPABASE_ANON_KEY` | Staging publishable/anon key only. Never use service role here. |
| A-Dash-Technology staging browser app | `VITE_ADASH_SITES_MANAGED_HOST_SUFFIX` | Public staging managed hostname root; must match the Edge/Sites roots. This is configuration, not a secret. |
| Supabase staging Edge runtime | `SUPABASE_URL` | Staging API URL; normally supplied by Supabase. |
| Supabase staging Edge runtime | `SUPABASE_ANON_KEY` | Staging anon key; normally supplied by Supabase. |
| Supabase staging Edge runtime | `SUPABASE_SERVICE_ROLE_KEY` | Staging service-role secret; server only. |
| Supabase staging Edge runtime | `ADASH_SITES_INTERNAL_URL` | HTTPS origin of the **staging** Sites runtime, without the control path. |
| Supabase staging Edge runtime | `ADASH_SITES_INTERNAL_KEY` | Random HMAC secret, at least 32 bytes; same value as Sites current key. |
| Supabase staging Edge runtime | `ADASH_SITES_MANAGED_HOST_SUFFIX` | Staging managed hostname root; required for non-local provisioning. |
| A’Dash Sites staging runtime and admin | `DATABASE_URL` | Separate staging PostgreSQL URL, never production or local development. |
| A’Dash Sites staging runtime | `ADASH_INTERNAL_KEY_CURRENT` | Same HMAC secret as Edge runtime. |
| A’Dash Sites staging runtime | `ADASH_INTERNAL_KEY_PREVIOUS` | Optional previous HMAC secret during rotation only. |
| A’Dash Sites staging runtime | `ADASH_SITES_ROOT_DOMAIN` | Staging managed hostname root, not production. |
| A’Dash Sites staging runtime and admin | `NODE_ENV` | `production` for the deployed staging apps. |

The staging operator additionally needs a Supabase access token scoped to the staging project, staging database credentials for the migration, a staging admin user with `app_metadata.role=admin`, and fictional customers with existing `client_licences` records. These are operator credentials, not browser environment variables. Do not put HMAC, database, or service-role secrets in `VITE_` keys or client code. A deployment platform may also require its own hosting credentials; none are currently configured for staging. The generated staging database password is saved only as a Windows current-user-protected value at `C:\tmp\ads-p5-staging-db-password.dpapi`; move it into an approved password manager before relying on it long term. Do not commit or upload that file.

## Staging project and database access

The project was created by CLI using a locally generated unique database password; the password itself was not printed. The direct database hostname resolves to IPv6, but this workstation's PostgreSQL client cannot resolve/use it. Supabase's [connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres) says to copy the **Session pooler** connection string from the project's Dashboard Connect dialog; its host cannot be safely inferred from the region. Obtain that staging-only host, port, and username before running SQL. Keep the database password in an approved password manager and do not paste it into this document.

An empty Supabase project does **not** yet contain `public.client_licences`, `public.commercial_events`, or `public.is_adash_admin()`. The Phase 5 migration alters/uses those existing objects. Restore the commercial **schema only** into staging first, with no production customer data, and verify the prerequisite objects and prior migration history before applying the Phase 5 migration. Do not run a broad `db push` against this repository: unrelated migrations are present. Record the exact staging project reference on every migration and Edge deployment invocation and verify it against the staging API URL.

## Current staging-readiness gaps

- Staging hostname support has been added to the commercial Edge Function and admin UI through `ADASH_SITES_MANAGED_HOST_SUFFIX` / `VITE_ADASH_SITES_MANAGED_HOST_SUFFIX`. Localhost is accepted only when the commercial backend is local and no managed suffix is configured. The Edge Function's shared hostname helper still needs to be bundled and deployed to an actual staging Supabase project.
- The isolated staging Supabase project and Edge deployment are confirmed, but its Session pooler hostname, Sites URL/database, and staging admin identity are not. The Edge deployment is not functional until the commercial schema and its staging-only secrets are configured.
- The existing Sites-side security suite and both repositories' static validation do not replace actual Admin → Edge → Sites certification.

## Required certification evidence

Use two fictional customers and distinct licences. Record request IDs, tenant IDs, licence IDs, commercial `sites_sync_status`, Sites `ControlRequest` and `AuditEvent` rows, and corresponding `commercial_events`, without copying secrets into the report. Exercise provision and idempotent retry; suspend and verify public block with client login/read-only access; reactivate and verify original content; disable and restore `whatsapp_ordering` (and `basic_inventory` only if safe); simulate a controlled Edge-to-Sites failure and verify failed state and successful retry; reject missing/invalid/expired/tampered/replayed HMAC and wrong customer/licence/tenant mappings. Inspect the staging browser bundle for secret exposure. Only then report Phase 5 complete.
