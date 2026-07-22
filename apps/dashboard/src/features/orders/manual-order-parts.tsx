"use client";

import { useMemo } from "react";

import { AppIcons } from "@/components/app/icons";
import { SearchableCombobox } from "@/components/app/searchable-combobox";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

import type { CustomerOption } from "./manual-order-model";

export function CreateOrderTriggerButton({ disabled }: { disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <Button type="button" disabled={disabled}>
      <AppIcons.orders data-icon="inline-start" />
      {t("orders.create.trigger")}
    </Button>
  );
}

export function CustomerPicker({
  catalog,
  loading,
  onChange,
  selectedId,
}: {
  catalog: CustomerOption[];
  loading: boolean;
  onChange: (id: string) => void;
  selectedId: string | null;
  selectedLabel: string | null;
}) {
  const { t } = useI18n();

  const options = useMemo(
    () =>
      catalog.map((customer) => ({
        value: customer.id,
        label: customer.label,
        keywords: `${customer.email} ${customer.phone ?? ""}`,
      })),
    [catalog],
  );

  return (
    <SearchableCombobox
      disabled={loading}
      emptyLabel={t("orders.create.noCustomers")}
      onChange={onChange}
      options={options}
      placeholder={
        loading ? t("orders.create.loadingCustomers") : t("orders.create.selectCustomer")
      }
      searchPlaceholder={t("orders.create.searchCustomer")}
      value={selectedId ?? ""}
    />
  );
}
