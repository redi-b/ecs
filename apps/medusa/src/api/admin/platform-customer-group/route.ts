import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { ICustomerModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { tenant_id } = req.validatedQuery as { tenant_id: string };
  const customers = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  const [groups, count] = await customers.listAndCountCustomerGroups(
    { metadata: { tenant_id } } as Parameters<
      ICustomerModuleService["listAndCountCustomerGroups"]
    >[0],
    { take: 2, skip: 0, select: ["id", "name", "metadata"], order: { id: "ASC" } },
  );
  if (count > 1) return res.status(409).json({ error: "duplicate_tenant_customer_group" });
  return res.json({ customer_groups: groups, count });
}
