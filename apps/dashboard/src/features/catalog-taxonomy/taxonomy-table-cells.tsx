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

export function TaxonomyIdentityCell({ entity, label, onOpen }: TaxonomyIdentityCellProps) {
  const handle = "handle" in entity ? entity.handle : null;
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
      {handle ? (
        <div className="mt-1 max-w-64 truncate text-xs text-muted-foreground">/{handle}</div>
      ) : null}
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
    const handle = parentCategory.handle;
    return (
      <div className="min-w-44">
        <div className="font-medium text-card-foreground">
          {getCategoryDisplayName(parentCategory)}
        </div>
        {handle ? (
          <div className="mt-1 max-w-56 truncate text-xs text-muted-foreground">/{handle}</div>
        ) : null}
      </div>
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
