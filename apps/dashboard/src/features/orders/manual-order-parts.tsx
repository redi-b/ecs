"use client";

import { useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

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
  selectedLabel,
}: {
  catalog: CustomerOption[];
  loading: boolean;
  onChange: (id: string) => void;
  selectedId: string | null;
  selectedLabel: string | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "h-8 w-full justify-between px-2.5 font-normal shadow-none",
            !selectedId && "text-muted-foreground",
          )}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="truncate">
            {loading ? t("orders.create.loadingCustomers") : selectedLabel ? selectedLabel : t("orders.create.selectCustomer")}
          </span>
          <AppIcons.arrowDown className="size-4 shrink-0 opacity-60" data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        collisionPadding={16}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onWheel={(event) => event.stopPropagation()}
      >
        <Command className="h-auto max-h-72 w-full min-h-0">
          <CommandInput placeholder={t("orders.create.searchCustomer")} />
          <CommandList
            className="max-h-60 min-h-0 overflow-y-auto overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
          >
            <CommandEmpty>{t("orders.create.noCustomers")}</CommandEmpty>
            <CommandGroup className="overflow-visible">
              {catalog.map((customer) => {
                const isSelected = customer.id === selectedId;
                return (
                  <CommandItem
                    data-checked={isSelected ? true : undefined}
                    key={customer.id}
                    onSelect={() => {
                      onChange(customer.id);
                      setOpen(false);
                    }}
                    value={`${customer.label} ${customer.email} ${customer.phone ?? ""}`}
                  >
                    <Checkbox checked={isSelected} tabIndex={-1} />
                    <span className="min-w-0 flex-1 truncate">{customer.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

