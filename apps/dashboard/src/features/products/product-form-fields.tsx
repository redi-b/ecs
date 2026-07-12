"use client";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";
import { useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
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
import { FieldDescription } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildCategoryTree,
  flattenCategoryTree,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { cn } from "@/lib/utils";

export const NO_COLLECTION_VALUE = "__none";

export function ComposerSection({ description, title }: { description: string; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function StepDot({ status }: { status: "active" | "complete" | "idle" }) {
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full border transition-colors",
        status === "active" || status === "complete"
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40",
      )}
    >
      {status === "active" || status === "complete" ? (
        <AppIcons.check data-icon="inline-start" />
      ) : null}
    </span>
  );
}

export function CollectionPicker({
  collections,
  onChange,
  selectedCollection,
  value,
}: {
  collections: MerchantProductCollection[];
  onChange: (value: string) => void;
  selectedCollection: MerchantProductCollection | undefined;
  value: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button className="w-full justify-between" type="button" variant="outline">
          <span className="truncate">
            {selectedCollection ? getCollectionLabel(selectedCollection) : "No collection"}
          </span>
          <AppIcons.arrowDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-1">
        <Command>
          <CommandInput placeholder="Search collections..." />
          <CommandList>
            <CommandEmpty>No collections found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                data-checked={value === NO_COLLECTION_VALUE}
                onSelect={() => {
                  onChange(NO_COLLECTION_VALUE);
                  setOpen(false);
                }}
                value="No collection"
              >
                No collection
              </CommandItem>
              {collections.map((collection) => (
                <CommandItem
                  data-checked={value === collection.id}
                  key={collection.id}
                  onSelect={() => {
                    onChange(collection.id);
                    setOpen(false);
                  }}
                  value={`${collection.title ?? ""} ${collection.handle ?? ""}`}
                >
                  <span className="truncate">{getCollectionLabel(collection)}</span>
                  {collection.handle ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {collection.handle}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CategoryPicker({
  categories,
  onChange,
  selectedCategories,
  value,
}: {
  categories: MerchantProductCategory[];
  onChange: (value: string[]) => void;
  selectedCategories: MerchantProductCategory[];
  value: string[];
}) {
  const [open, setOpen] = useState(false);
  const treeRows = useMemo(
    () => flattenCategoryTree(buildCategoryTree(categories)),
    [categories],
  );

  function toggleCategory(categoryId: string) {
    onChange(
      value.includes(categoryId)
        ? value.filter((selectedId) => selectedId !== categoryId)
        : [...value, categoryId],
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button className="w-full justify-between" type="button" variant="outline">
            <span className="truncate">
              {selectedCategories.length
                ? `${selectedCategories.length} selected`
                : "Select categories"}
            </span>
            <AppIcons.arrowDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(30rem,calc(100vw-2rem))] p-1">
          <Command>
            <CommandInput placeholder="Search categories…" />
            <CommandList className="max-h-72">
              <CommandEmpty>No categories found.</CommandEmpty>
              <CommandGroup>
                {treeRows.map((node) => {
                  const category = node.category;
                  const label = getCategoryLabel(category);
                  return (
                    <CommandItem
                      data-checked={value.includes(category.id) ? true : undefined}
                      key={category.id}
                      onSelect={() => toggleCategory(category.id)}
                      value={`${category.name ?? ""} ${category.handle ?? ""} ${label}`}
                    >
                      <Checkbox checked={value.includes(category.id)} tabIndex={-1} />
                      <span
                        className="min-w-0 flex-1 truncate"
                        style={{ paddingLeft: `${node.depth * 0.85}rem` }}
                      >
                        {node.depth > 0 ? (
                          <span className="mr-1.5 text-muted-foreground/50">└</span>
                        ) : null}
                        {label}
                      </span>
                      {category.handle ? (
                        <span className="ml-auto max-w-[35%] truncate text-xs text-muted-foreground">
                          {category.handle}
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedCategories.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedCategories.map((category) => (
            <Badge key={category.id} variant="secondary">
              {getCategoryLabel(category)}
            </Badge>
          ))}
        </div>
      ) : (
        <FieldDescription>No categories selected.</FieldDescription>
      )}
    </div>
  );
}

export function FieldError({ errors, touched }: { errors: unknown[]; touched: boolean }) {
  const message = errors.find((error): error is string => typeof error === "string");

  if (!message || !touched) {
    return null;
  }

  return <FieldDescription className="text-destructive">{message}</FieldDescription>;
}

export function hasFieldError(field: {
  state: { meta: { errors: unknown[]; isTouched: boolean } };
}) {
  return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

function getCollectionLabel(collection: MerchantProductCollection) {
  return collection.title ?? collection.handle ?? "Untitled collection";
}

function getCategoryLabel(category: MerchantProductCategory) {
  return category.name ?? category.handle ?? "Untitled category";
}
