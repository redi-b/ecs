import type { MedusaContainer } from "@medusajs/framework/types";
import { createApiKeysWorkflow, createRegionsWorkflow } from "@medusajs/medusa/core-flows";

type QueryGraph = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => Promise<{ data: unknown[] }>;
};

export type CommerceBootstrapResult = {
  medusaAdminApiToken: string;
  regionCreated: boolean;
  title: string;
};

const DEFAULT_SECRET_TITLE = "Platform API Secret";

/**
 * Ensures shared ETB region + mints a new Medusa secret admin API key.
 * Token is only available at create time — callers must persist it securely.
 */
export async function ensureCommerceBootstrap(
  container: MedusaContainer,
  options?: {
    secretKeyTitle?: string;
    createdBy?: string;
  },
): Promise<CommerceBootstrapResult> {
  const query = container.resolve("query") as QueryGraph;
  const title = options?.secretKeyTitle?.trim() || DEFAULT_SECRET_TITLE;
  const createdBy = options?.createdBy?.trim() || "platform-bootstrap";

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code"],
    filters: {
      currency_code: "etb",
    },
  });

  let regionCreated = false;
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
    regionCreated = true;
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
  if (!apiKey?.token || typeof apiKey.token !== "string") {
    throw new Error("Medusa secret API key creation returned no token.");
  }

  return {
    medusaAdminApiToken: apiKey.token,
    regionCreated,
    title,
  };
}
