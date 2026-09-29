"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";

export function ConvertQuotationButton({ quotationId }: { quotationId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const key = useRef(crypto.randomUUID());
  const [pending, setPending] = useState(false);
  async function convert() {
    setPending(true);
    const response = await fetch(dashboardRoutes.orderQuotationConvertAction(quotationId), {
      body: JSON.stringify({ confirmChanges: false }),
      headers: { "content-type": "application/json", "idempotency-key": key.current },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as { orderId?: string; error?: string };
    if (!response?.ok || !data.orderId) {
      toast.error(
        data.error === "quotation_conversion_changed"
          ? t("orders.quotes.changed")
          : t("orders.quotes.convertFailed"),
      );
      setPending(false);
      return;
    }
    toast.success(t("orders.quotes.converted"));
    router.push(`/dashboard/orders/${encodeURIComponent(data.orderId)}`);
  }
  return (
    <Button disabled={pending} onClick={() => void convert()}>
      {pending ? t("orders.quotes.converting") : t("orders.quotes.convert")}
    </Button>
  );
}
