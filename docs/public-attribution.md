# Public A’Dash attribution

Published active tenant sites show the shared `PoweredByAdashBadge` by default. The existing platform-managed `white_label` entitlement suppresses it. Tenant content and branding forms cannot grant or remove entitlements. Founding/free/starter tenants without that grant retain attribution; granting white labeling is an explicit platform decision, not an automatic billing change.

The runtime root layout resolves the hostname and tenant, checks publication and entitlements, and renders one badge across public pages. Unknown, unpublished and suspended sites do not display it. The badge links to `https://adash.technology/sites` with a safe new-tab link and exposes `data-analytics-event="powered_by_adash_clicked"` for future tracking. No analytics provider is added.

The fixed badge respects safe-area insets and reserves space at the end of the document. It hides when it would cover customer content or actions. Future floating controls should use `data-floating-control`; a shell can also set `--adash-floating-controls-height` to stack the badge above a shared control dock. No tenant-specific IDs are used.

Sabrena’s recorded starter entitlements (products, locations and testimonials) resolve to badge-on. No tenant rows were changed during implementation. Live appearance requires a staging runtime deployment.
