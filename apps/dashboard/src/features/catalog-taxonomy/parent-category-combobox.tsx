"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
import { useMemo } from "react";

import { SearchableCombobox } from "@/components/app/searchable-combobox";
import { getCategoryDisplayName } from "@/features/catalog-taxonomy/taxonomy-table-state";

const ROOT_VALUE = "__root__";

export function ParentCategoryCombobox({
  disabled,
  onChange,
  options,
  rootLabel,
  searchPlaceholder,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  options: MerchantProductCategory[];
  rootLabel: string;
  searchPlaceholder: string;
  /** Category id, or `__root__` / empty for top-level. */
  value: string;
}) {
  const normalized = !value || value === ROOT_VALUE ? ROOT_VALUE : value;

  const items = useMemo(
    () => [
      {
        value: ROOT_VALUE,
        label: rootLabel,
        keywords: "root top level none parent",
      },
      ...options.map((category) => {
        const name = getCategoryDisplayName(category);
        return {
          value: category.id,
          label: name,
          keywords: `${category.handle ?? ""} ${category.id}`,
        };
      }),
    ],
    [options, rootLabel],
  );

  return (
    <SearchableCombobox
      {...(disabled !== undefined ? { disabled } : {})}
      emptyLabel={rootLabel}
      onChange={(next) => onChange(next || ROOT_VALUE)}
      options={items}
      placeholder={rootLabel}
      searchPlaceholder={searchPlaceholder}
      value={normalized}
    />
  );
}
