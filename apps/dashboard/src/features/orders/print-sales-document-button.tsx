"use client";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function PrintSalesDocumentButton() {
  const { t } = useI18n();
  return (
    <Button className="print:hidden" onClick={() => window.print()} type="button">
      <AppIcons.print data-icon="inline-start" />
      {t("orders.documents.print")}
    </Button>
  );
}
