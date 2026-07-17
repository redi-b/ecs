import type { MedusaContainer } from "@medusajs/framework/types";

import { ensureCommerceBootstrap } from "../lib/commerce-bootstrap";

/**
 * Bootstrap seed for Medusa (local + production).
 *
 * Creates:
 * - Shared ETB region (if missing)
 * - A new secret Admin API key for platform-api
 *
 * Prefer automatic bootstrap via platform-api (internal route + encrypted DB).
 * This script remains for local `pnpm seed` and break-glass.
 *
 * Does not create demo products, tenants, or media.
 */
export default async function seed({ container }: { container: MedusaContainer }) {
  const title = process.env.SEED_MEDUSA_SECRET_KEY_TITLE ?? "Platform API Secret";
  const createdBy = process.env.SEED_MEDUSA_SECRET_KEY_CREATED_BY ?? "platform-seed";

  const result = await ensureCommerceBootstrap(container, {
    secretKeyTitle: title,
    createdBy,
  });

  if (result.regionCreated) {
    console.info("[medusa seed] created shared ETB region");
  } else {
    console.info("[medusa seed] ETB region already present");
  }

  console.log(
    JSON.stringify(
      {
        medusaAdminApiToken: result.medusaAdminApiToken,
        title: result.title,
        type: "secret",
        note: "Token is shown only once. Prefer platform auto-bootstrap; or set MEDUSA_ADMIN_API_TOKEN.",
      },
      null,
      2,
    ),
  );

  console.info(`
────────────────────────────────────────────────────────────
  Medusa bootstrap complete

  Preferred (prod): platform-api auto-bootstraps and stores the token
  encrypted in platform DB — no manual env paste required.

  Override / local:
    apps/platform-api/.env  → MEDUSA_ADMIN_API_TOKEN=...
    or: pnpm seed --write-env

  Then restart platform-api if it was already running with an empty token.
────────────────────────────────────────────────────────────
`);
}
