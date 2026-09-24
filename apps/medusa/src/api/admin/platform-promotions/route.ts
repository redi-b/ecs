import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { IPromotionModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import {
  type TenantPromotionQuery,
  tenantPromotionFilters,
} from "../../../lib/tenant-promotion-query";

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const input = req.validatedQuery as TenantPromotionQuery;
  const service = req.scope.resolve<IPromotionModuleService>(Modules.PROMOTION);
  const [promotions, count] = await service.listAndCountPromotions(
    tenantPromotionFilters(input) as Parameters<
      IPromotionModuleService["listAndCountPromotions"]
    >[0],
    {
      take: input.limit,
      skip: input.offset,
      order: { created_at: "DESC", id: "ASC" },
      relations: [
        "campaign",
        "campaign.budget",
        "application_method",
        "application_method.target_rules",
        "application_method.target_rules.values",
        "application_method.buy_rules",
        "application_method.buy_rules.values",
        "rules",
        "rules.values",
      ],
    },
  );
  return res.json({ promotions, count, limit: input.limit, offset: input.offset });
}
