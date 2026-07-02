import { RiBox3Line } from "@remixicon/react";

import { PageShell } from "@/components/app/page-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function MerchantProductsPage() {
  return (
    <PageShell
      description="Product management will connect to the merchant-scoped Platform API. The route is available now so navigation, breadcrumbs, and command actions have a real destination."
      title="Products"
    >
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiBox3Line />
          </EmptyMedia>
          <EmptyTitle>No product workspace yet</EmptyTitle>
          <EmptyDescription>
            Product lists, creation, editing, and inventory workflows are intentionally out of scope
            for this foundation pass.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
