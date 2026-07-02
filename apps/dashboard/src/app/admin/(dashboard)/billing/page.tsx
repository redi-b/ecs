import { RiBankCardLine } from "@remixicon/react";

import { PageShell } from "@/components/app/page-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function BillingPage() {
  return (
    <PageShell
      description="Billing will expose subscription, payment method, and invoice workflows after the billing provider integration is defined."
      title="Billing"
    >
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiBankCardLine />
          </EmptyMedia>
          <EmptyTitle>No billing integration yet</EmptyTitle>
          <EmptyDescription>
            Plans, invoices, and payment actions are not implemented in this foundation task.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
