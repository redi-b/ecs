"use client";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function QuotationPageActions() {
  const { t } = useI18n();

  return (
    <Button className="print:hidden" onClick={() => window.print()} type="button" variant="outline">
      <AppIcons.print data-icon="inline-start" />
      {t("orders.quotes.print")}
    </Button>
  );
}
