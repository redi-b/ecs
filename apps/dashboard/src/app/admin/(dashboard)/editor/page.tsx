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
      description="Edit storefront content, theme, and publishing."
      title="Editor"
    >
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiLayoutMasonryLine />
          </EmptyMedia>
          <EmptyTitle>Storefront editor is coming soon</EmptyTitle>
          <EmptyDescription>
            Storefront changes will be managed here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
