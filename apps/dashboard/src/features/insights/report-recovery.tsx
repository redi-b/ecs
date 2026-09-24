"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function ReportRecovery({
  invalid,
  from,
  to,
}: {
  invalid: boolean;
  from: string;
  to: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          if (!invalid) return router.refresh();
          const next = new URLSearchParams({ from, to });
          const tenantId = params.get("tenantId");
          if (tenantId) next.set("tenantId", tenantId);
          router.replace(`${pathname}?${next}`, { scroll: false });
        });
      }}
    >
      {t(invalid ? "insights.salesWorkspace.resetRange" : "insights.storefrontReport.refresh")}
    </Button>
  );
}
