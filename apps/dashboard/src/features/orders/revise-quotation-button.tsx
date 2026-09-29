"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import { dashboardRoutes } from "@/lib/routes";

export function ReviseQuotationButton({
  draftId,
  quotationId,
  revision,
}: {
  draftId: string;
  quotationId: string;
  revision: number;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const key = useRef(createClientId("quotation-revise"));
  const [pending, setPending] = useState(false);
  async function revise() {
    setPending(true);
    const response = await fetch(dashboardRoutes.orderQuotationReviseAction(quotationId), {
      body: JSON.stringify({
        draftId,
        expectedRevision: revision,
        language: locale === "am" ? "am" : "en",
      }),
      headers: { "content-type": "application/json", "idempotency-key": key.current },
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) {
      toast.error(t("orders.quotes.reviseFailed"));
      setPending(false);
      return;
    }
    toast.success(t("orders.quotes.revised"));
    router.refresh();
  }
  return (
    <Button disabled={pending} onClick={() => void revise()} variant="outline">
      {pending ? t("orders.quotes.revising") : t("orders.quotes.revise")}
    </Button>
  );
}
