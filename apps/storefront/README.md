# Storefront

Astro multi-tenant storefront.

Public requests resolve tenant context from the host, load the published storefront revision, and render through a static template registry. Public rendering must never use draft data without a valid preview token.
