"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/app/data-table";
import { DataTableHeader } from "@/components/app/data-table-header";
import { AppIcons } from "@/components/app/icons";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  CategoryIdentityCell,
  CategoryParentCell,
  TaxonomyDateCell,
  TaxonomyHandleCell,
} from "@/features/catalog-taxonomy/taxonomy-table-cells";
import {
  filterCategoriesForTable,
  getCategoryDisplayName,
  getTaxonomyTableCounts,
} from "@/features/catalog-taxonomy/taxonomy-table-state";

type ProductCategoriesTableProps = {
  categories: MerchantProductCategory[];
  pageSize: number;
  totalCount: number;
};

function copyToClipboard(value: string) {
  if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(value).catch(() => undefined);
}

function getCategoryColumns(
  categoriesById: Map<string, MerchantProductCategory>,
): ColumnDef<MerchantProductCategory>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all visible categories"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${getCategoryDisplayName(row.original)}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "name",
      accessorFn: (category) => getCategoryDisplayName(category),
      header: ({ column }) => <DataTableHeader column={column} title="Category" />,
      cell: ({ row }) => <CategoryIdentityCell category={row.original} />,
    },
    {
      accessorKey: "handle",
      header: ({ column }) => <DataTableHeader column={column} title="Handle" />,
      cell: ({ row }) => <TaxonomyHandleCell handle={row.original.handle} />,
    },
    {
      id: "parent",
      accessorFn: (category) => category.parentCategoryId ?? "",
      header: ({ column }) => <DataTableHeader column={column} title="Parent" />,
      cell: ({ row }) => (
        <CategoryParentCell
          parentCategory={
            row.original.parentCategoryId
              ? categoriesById.get(row.original.parentCategoryId)
              : undefined
          }
          parentCategoryId={row.original.parentCategoryId}
        />
      ),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <DataTableHeader column={column} title="Updated" />,
      cell: ({ row }) => <TaxonomyDateCell value={row.original.updatedAt} />,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableHeader column={column} title="Created" />,
      cell: ({ row }) => <TaxonomyDateCell value={row.original.createdAt} />,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const category = row.original;

        return (
          <RowActionsMenu
            actions={[
              {
                label: "Copy category ID",
                onSelect: () => copyToClipboard(category.id),
                type: "button",
              },
              {
                disabled: !category.handle,
                label: "Copy handle",
                onSelect: () => copyToClipboard(category.handle ?? ""),
                type: "button",
              },
            ]}
            label={`Open actions for ${getCategoryDisplayName(category)}`}
          />
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}

export function ProductCategoriesTable({
  categories,
  pageSize,
  totalCount,
}: ProductCategoriesTableProps) {
  const [query, setQuery] = useState("");
  void pageSize;

  const filteredCategories = useMemo(
    () => filterCategoriesForTable(categories, { query }),
    [categories, query],
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const counts = getTaxonomyTableCounts({
    filteredCount: filteredCategories.length,
    pageCount: categories.length,
    query,
    totalCount,
  });

  const toolbar = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <InputGroup className="h-10 rounded-full bg-background/70 px-1 sm:max-w-sm">
        <InputGroupAddon>
          <AppIcons.search data-icon="inline-start" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search product categories"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories"
          value={query}
        />
      </InputGroup>
      <p className="text-sm text-muted-foreground">
        {counts.hasActiveFilter
          ? `${counts.filteredCount} of ${counts.pageCount} on this page`
          : `${counts.pageCount} on this page, ${counts.totalCount} total`}
      </p>
    </div>
  );

  return (
    <DataTable
      bulkActions={(selectedCategories) => (
        <Button
          onClick={() =>
            copyToClipboard(selectedCategories.map((category) => category.id).join("\n"))
          }
          size="sm"
          type="button"
          variant="outline"
        >
          <AppIcons.copy data-icon="inline-start" />
          Copy IDs
        </Button>
      )}
      columns={getCategoryColumns(categoriesById)}
      data={filteredCategories}
      emptyMessage="No product categories have been synced for this merchant yet."
      filteredEmptyMessage="No product categories match the current search."
      getRowId={(category) => category.id}
      isFiltered={counts.hasActiveFilter}
      selectedSummaryLabel={(count) => `categor${count === 1 ? "y" : "ies"} selected`}
      toolbar={toolbar}
    />
  );
}
