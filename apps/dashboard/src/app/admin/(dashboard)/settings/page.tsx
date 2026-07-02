import { RiSettings3Line } from "@remixicon/react";

import { PageShell } from "@/components/app/page-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function SettingsPage() {
  return (
    <PageShell
      description="Settings will manage merchant account, shop preferences, domains, and operational configuration after those APIs are available."
      title="Settings"
    >
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiSettings3Line />
          </EmptyMedia>
          <EmptyTitle>No settings workspace yet</EmptyTitle>
          <EmptyDescription>
            This placeholder keeps the route reachable without introducing unfinished account or
            shop configuration workflows.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
