import type { MedusaContainer } from "@medusajs/framework/types";
import { createApiKeysWorkflow, createRegionsWorkflow } from "@medusajs/medusa/core-flows";

type QueryGraph = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => Promise<{ data: unknown[] }>;
};

export default async function seed({ container }: { container: MedusaContainer }) {
  const query = container.resolve("query") as QueryGraph;
  const title = process.env.SEED_MEDUSA_SECRET_KEY_TITLE ?? "Platform API Local Secret";
  const createdBy = process.env.SEED_MEDUSA_SECRET_KEY_CREATED_BY ?? "platform-seed";
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id"],
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

  console.log(JSON.stringify({ medusaAdminApiToken: apiKey.token }, null, 2));
}
