import Link from "next/link";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { dashboardRoutes } from "@/lib/routes";

const foundationItems = [
  "Sidebar navigation and route metadata are wired for the merchant dashboard.",
  "Theme, query, and shadcn providers are installed at the app boundary.",
  "Feature routes exist as honest placeholders until commerce integrations are connected.",
] as const;

export default function MerchantAdminPage() {
  return (
    <PageShell
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href={dashboardRoutes.products}>Review product route</Link>
        </Button>
      }
      description="Merchant dashboard foundation for operational commerce workflows. Metrics and entity lists will appear after the Platform API integrations are connected to this shell."
      title="Overview"
    >
      <Alert>
        <AlertTitle>Foundation shell is active</AlertTitle>
        <AlertDescription>
          This overview intentionally avoids sample revenue, order, or product metrics. It only
          reflects the dashboard UI foundation that is available now.
        </AlertDescription>
      </Alert>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Foundation status">
        {foundationItems.map((item) => (
          <div
            className="rounded-lg border bg-card p-4 text-sm leading-6 text-card-foreground"
            key={item}
          >
            {item}
          </div>
        ))}
      </section>
    </PageShell>
  );
}
