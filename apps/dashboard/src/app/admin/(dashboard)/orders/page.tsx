import { RiShoppingBag3Line } from "@remixicon/react";

import { PageShell } from "@/components/app/page-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function MerchantOrdersPage() {
  return (
    <PageShell
      description="Order operations will show merchant-scoped fulfillment and payment data after the commerce API boundary is connected."
      title="Orders"
    >
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiShoppingBag3Line />
          </EmptyMedia>
          <EmptyTitle>No order workspace yet</EmptyTitle>
          <EmptyDescription>
            Order lists, fulfillment actions, payment status, and customer details will be added in
            a later commerce workflow task.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
