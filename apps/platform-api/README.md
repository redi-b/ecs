# Platform API

Hono service that owns platform routes, tenant resolution, auth/session boundaries, Store API facade behavior, platform workers, seeds, and operator APIs.

This app may call Medusa through the internal network. Browsers must not call Medusa Admin API directly.
