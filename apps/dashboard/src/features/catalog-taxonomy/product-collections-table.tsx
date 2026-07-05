"use client";

import type { MerchantProductCollection } from "@ecs/contracts";
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
  CollectionIdentityCell,
  TaxonomyDateCell,
  TaxonomyHandleCell,
} from "@/features/catalog-taxonomy/taxonomy-table-cells";
import {
  filterCollectionsForTable,
  getCollectionDisplayName,
  getTaxonomyTableCounts,
} from "@/features/catalog-taxonomy/taxonomy-table-state";

type ProductCollectionsTableProps = {
  collections: MerchantProductCollection[];
  pageSize: number;
  totalCount: number;
};

function copyToClipboard(value: string) {
  if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  void navigator.clipboard.writeText(value).catch(() => undefined);
}

function getCollectionColumns(): ColumnDef<MerchantProductCollection>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all visible collections"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${getCollectionDisplayName(row.original)}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        />
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "title",
      accessorFn: (collection) => getCollectionDisplayName(collection),
      header: ({ column }) => <DataTableHeader column={column} title="Collection" />,
      cell: ({ row }) => <CollectionIdentityCell collection={row.original} />,
    },
    {
      accessorKey: "handle",
      header: ({ column }) => <DataTableHeader column={column} title="Handle" />,
      cell: ({ row }) => <TaxonomyHandleCell handle={row.original.handle} />,
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
        const collection = row.original;

        return (
          <RowActionsMenu
            actions={[
              {
                label: "Copy collection ID",
                onSelect: () => copyToClipboard(collection.id),
                type: "button",
              },
              {
                disabled: !collection.handle,
                label: "Copy handle",
                onSelect: () => copyToClipboard(collection.handle ?? ""),
                type: "button",
              },
            ]}
            label={`Open actions for ${getCollectionDisplayName(collection)}`}
          />
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}

export function ProductCollectionsTable({
  collections,
  pageSize,
  totalCount,
}: ProductCollectionsTableProps) {
  const [query, setQuery] = useState("");
  void pageSize;

  const filteredCollections = useMemo(
    () => filterCollectionsForTable(collections, { query }),
    [collections, query],
  );
  const counts = getTaxonomyTableCounts({
    filteredCount: filteredCollections.length,
    pageCount: collections.length,
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
          aria-label="Search product collections"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search collections"
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
      bulkActions={(selectedCollections) => (
        <Button
          onClick={() =>
            copyToClipboard(selectedCollections.map((collection) => collection.id).join("\n"))
          }
          size="sm"
          type="button"
          variant="outline"
        >
          <AppIcons.copy data-icon="inline-start" />
          Copy IDs
        </Button>
      )}
      columns={getCollectionColumns()}
      data={filteredCollections}
      emptyMessage="No product collections have been synced for this merchant yet."
      filteredEmptyMessage="No product collections match the current search."
      getRowId={(collection) => collection.id}
      isFiltered={counts.hasActiveFilter}
      selectedSummaryLabel={(count) => `collection${count === 1 ? "" : "s"} selected`}
      toolbar={toolbar}
    />
  );
}
