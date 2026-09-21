"use client";

import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";

import { CatalogTranslatedName } from "@/components/app/catalog-translated-name";
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
  source: string | null;
  untitled: string;
  onOpen?: (() => void) | undefined;
};

export function TaxonomyIdentityCell({ entity, onOpen, source, untitled }: TaxonomyIdentityCellProps) {
  const media = (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
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
  );

  return (
    <div className="flex min-w-48 items-center gap-3">
      {media}
      <CatalogTranslatedName
        renderName={
          onOpen
            ? (primary) => (
                <button
                  className={cn(listEntityActionClassName, "min-w-0 truncate text-left")}
                  onClick={onOpen}
                  type="button"
                >
                  {primary}
                </button>
              )
            : undefined
        }
        source={source}
        translation={entity.translation}
        untitled={untitled}
      />
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
      source={category.name}
      untitled={getCategoryDisplayName(category)}
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
      source={collection.title}
      untitled={getCollectionDisplayName(collection)}
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
      <CatalogTranslatedName
        className="font-medium text-card-foreground"
        preview="name"
        source={parentCategory.name}
        translation={parentCategory.translation}
        untitled={getCategoryDisplayName(parentCategory)}
      />
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
