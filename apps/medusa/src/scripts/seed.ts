import type { MedusaContainer } from "@medusajs/framework/types";
import { createApiKeysWorkflow, createRegionsWorkflow } from "@medusajs/medusa/core-flows";

type QueryGraph = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => Promise<{ data: unknown[] }>;
};

/**
 * Bootstrap seed for Medusa (local + production).
 *
 * Creates:
 * - Shared ETB region (if missing)
 * - A new secret Admin API key for platform-api
 *
 * The secret token is only available at creation time. Copy it into
 * MEDUSA_ADMIN_API_TOKEN and restart platform-api before onboarding shops.
 *
 * Does not create demo products, tenants, or media.
 */
export default async function seed({ container }: { container: MedusaContainer }) {
  const query = container.resolve("query") as QueryGraph;
  const title = process.env.SEED_MEDUSA_SECRET_KEY_TITLE ?? "Platform API Secret";
  const createdBy = process.env.SEED_MEDUSA_SECRET_KEY_CREATED_BY ?? "platform-seed";

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code"],
    filters: {
      currency_code: "etb",
    },
  });

  if (regions.length === 0) {
    await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Ethiopia",
            currency_code: "etb",
            countries: ["et"],
            payment_providers: ["pp_system_default", "pp_chapa_chapa"],
            metadata: {
              platform_shared_region: true,
            },
          },
        ],
      },
    });
    console.info("[medusa seed] created shared ETB region");
  } else {
    console.info("[medusa seed] ETB region already present");
  }

  const { result } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title,
          type: "secret",
          created_by: createdBy,
        },
      ],
    },
  });

  const [apiKey] = result;

  if (!apiKey?.token) {
    throw new Error("Medusa secret API key creation returned no token.");
  }

  // Machine-readable for scripts; human instructions after.
  console.log(
    JSON.stringify(
      {
        medusaAdminApiToken: apiKey.token,
        title,
        type: "secret",
        note: "Token is shown only once. Store it as MEDUSA_ADMIN_API_TOKEN.",
      },
      null,
      2,
    ),
  );

  console.info(`
────────────────────────────────────────────────────────────
  Medusa bootstrap complete

  1. Copy the token above into:
       - local:  apps/platform-api/.env  → MEDUSA_ADMIN_API_TOKEN=...
       - prod:   Dokploy env              → MEDUSA_ADMIN_API_TOKEN=...

  2. Restart platform-api so it picks up the token.

  3. You can now create shops via onboarding.
────────────────────────────────────────────────────────────
`);
}
