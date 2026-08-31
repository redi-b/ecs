"use client";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";

import { AppIcons } from "@/components/app/icons";
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
  const identity = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {entity.mediaUrl ? (
          <span
            aria-hidden
            className="size-full bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(entity.mediaUrl)})` }}
          />
        ) : (
          <AppIcons.image aria-hidden className="size-4 text-muted-foreground" />
        )}
      </span>
      <span className="truncate">{label}</span>
    </>
  );

  return (
    <div className="min-w-48">
      {onOpen ? (
        <button
          className={cn(listEntityActionClassName, "flex w-full items-center gap-3 text-left")}
          onClick={onOpen}
          type="button"
        >
          {identity}
        </button>
      ) : (
        <div className="flex items-center gap-3 font-medium text-card-foreground">{identity}</div>
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
    return <span className="text-muted-foreground">{t("taxonomy.edit.rootCategory")}</span>;
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
