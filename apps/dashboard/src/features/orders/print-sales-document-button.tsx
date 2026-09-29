"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function PrintSalesDocumentButton() {
  const { t } = useI18n();
  return (
    <Button className="print:hidden" onClick={() => window.print()} type="button">
      {t("orders.documents.print")}
    </Button>
  );
}
