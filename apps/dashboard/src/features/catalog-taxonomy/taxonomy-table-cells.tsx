"use client";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";

import {
  formatTaxonomyDate,
  getCategoryDisplayName,
  getCollectionDisplayName,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { useI18n } from "@/i18n/provider";
import { listEntityActionClassName } from "@/lib/list-entity-link";
import { cn } from "@/lib/utils";

type TaxonomyIdentityCellProps = {
  entity: MerchantProductCategory | MerchantProductCollection;
  label: string;
  onOpen?: (() => void) | undefined;
};

export function TaxonomyIdentityCell({ entity: _entity, label, onOpen }: TaxonomyIdentityCellProps) {
  // Handle lives in its own table column — keep the name cell name-only.
  void _entity;
  return (
    <div className="min-w-48">
      {onOpen ? (
        <button
          className={cn(listEntityActionClassName, "truncate")}
          onClick={onOpen}
          type="button"
        >
          {label}
        </button>
      ) : (
        <div className="font-medium text-card-foreground">{label}</div>
      )}
    </div>
  );
}

export function CategoryIdentityCell({
  category,
  onOpen,
}: {
  category: MerchantProductCategory;
  onOpen?: (() => void) | undefined;
}) {
  return (
    <TaxonomyIdentityCell
      entity={category}
      label={getCategoryDisplayName(category)}
      {...(onOpen ? { onOpen } : {})}
    />
  );
}

export function CollectionIdentityCell({
  collection,
  onOpen,
}: {
  collection: MerchantProductCollection;
  onOpen?: (() => void) | undefined;
}) {
  return (
    <TaxonomyIdentityCell
      entity={collection}
      label={getCollectionDisplayName(collection)}
      {...(onOpen ? { onOpen } : {})}
    />
  );
}

export function TaxonomyHandleCell({ handle }: { handle: string | null }) {
  if (!handle) {
    return <span className="text-muted-foreground">No handle</span>;
  }

  return <span className="font-mono text-sm text-muted-foreground">{handle}</span>;
}

export function CategoryParentCell({
  parentCategory,
  parentCategoryId,
}: {
  parentCategory?: MerchantProductCategory | undefined;
  parentCategoryId: string | null;
}) {
  const { t } = useI18n();
  if (!parentCategoryId) {
    return (
      <span className="text-muted-foreground">{t("taxonomy.edit.rootCategory")}</span>
    );
  }

  if (parentCategory) {
    return (
      <span className="font-medium text-card-foreground">
        {getCategoryDisplayName(parentCategory)}
      </span>
    );
  }

  return <span className="text-muted-foreground">{t("taxonomy.cells.parentId")}</span>;
}

export function TaxonomyDateCell({ value }: { value: string | null }) {
  const { t } = useI18n();
  return (
    <span className="text-muted-foreground">
      {formatTaxonomyDate(value, t("taxonomy.cells.noDate"))}
    </span>
  );
}
