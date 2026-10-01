import type { MerchantBillingStatus } from "@ecs/contracts";

type Invoice = MerchantBillingStatus["invoices"][number];

export function findPlanInvoice(invoices: Invoice[], planId: string): Invoice | null {
  return (
    invoices.find(
      (invoice) =>
        invoice.status === "pending" &&
        (invoice.planId ? invoice.planId === planId : invoice.provider === `plan:${planId}`),
    ) ?? null
  );
}
