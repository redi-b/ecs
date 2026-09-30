"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";

type OrdersView = "orders" | "drafts" | "quotes";

const hrefs: Record<OrdersView, string> = {
  orders: dashboardRoutes.orders,
  drafts: `${dashboardRoutes.orders}?view=drafts`,
  quotes: `${dashboardRoutes.orders}?view=quotes`,
};

export function OrdersViewSwitcher({ value }: { value: OrdersView }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);

  function navigate(next: OrdersView) {
    if (next === value) return;
    startTransition(() => {
      setOptimisticValue(next);
      router.push(hrefs[next], { scroll: false });
    });
  }

  return (
    <nav aria-label={t("orders.views.aria")} className="w-fit max-w-full overflow-x-auto pb-0.5">
      <SegmentedControl
        active="muted"
        ariaLabel={t("orders.views.aria")}
        disabled={pending}
        fullWidth={false}
        onChange={navigate}
        options={(
          [
            ["orders", "orders.views.orders"],
            ["drafts", "orders.views.drafts"],
            ["quotes", "orders.views.quotes"],
          ] as const
        ).map(([id, label]) => ({ id, label: t(label) }))}
        size="sm"
        value={optimisticValue}
      />
    </nav>
  );
}
