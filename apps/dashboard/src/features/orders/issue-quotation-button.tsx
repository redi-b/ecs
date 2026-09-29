"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";

export function IssueQuotationButton({
  draftId,
  disabled,
}: {
  draftId: string;
  disabled?: boolean;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const key = useRef(crypto.randomUUID());
  const [pending, setPending] = useState(false);
  async function issue() {
    setPending(true);
    const response = await fetch(dashboardRoutes.orderQuotationsAction, {
      body: JSON.stringify({ draftId, language: locale === "am" ? "am" : "en" }),
      headers: { "content-type": "application/json", "idempotency-key": key.current },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as { quotation?: { id?: string } };
    if (!response?.ok || !data.quotation?.id) {
      toast.error(t("orders.quotes.issueFailed"));
      setPending(false);
      return;
    }
    toast.success(t("orders.quotes.issued"));
    router.push(dashboardRoutes.orderQuotation(data.quotation.id));
    router.refresh();
  }
  return (
    <Button disabled={disabled || pending} onClick={() => void issue()} size="sm" type="button">
      {pending ? t("orders.quotes.issuing") : t("orders.quotes.issue")}
    </Button>
  );
}
