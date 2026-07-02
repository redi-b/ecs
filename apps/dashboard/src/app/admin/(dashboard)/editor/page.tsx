import { RiLayoutMasonryLine } from "@remixicon/react";

import { PageShell } from "@/components/app/page-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function StorefrontEditorPage() {
  return (
    <PageShell
      description="Storefront editing will manage templates, pages, theme settings, and publish history once the storefront draft API is ready."
      title="Editor"
    >
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiLayoutMasonryLine />
          </EmptyMedia>
          <EmptyTitle>No editor integration yet</EmptyTitle>
          <EmptyDescription>
            This route exists for navigation and shell validation. It does not edit storefront
            content yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
