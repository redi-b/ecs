import type {
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";

import {
  formatTaxonomyDate,
  getCategoryDisplayName,
  getCollectionDisplayName,
} from "@/features/catalog-taxonomy/taxonomy-table-state";

type TaxonomyIdentityCellProps = {
  entity: MerchantProductCategory | MerchantProductCollection;
  label: string;
};

export function TaxonomyIdentityCell({ entity, label }: TaxonomyIdentityCellProps) {
  return (
    <div className="min-w-48">
      <div className="font-medium text-card-foreground">{label}</div>
      <div className="mt-1 max-w-64 truncate font-mono text-xs text-muted-foreground">
        {entity.id}
      </div>
    </div>
  );
}

export function CategoryIdentityCell({ category }: { category: MerchantProductCategory }) {
  return <TaxonomyIdentityCell entity={category} label={getCategoryDisplayName(category)} />;
}

export function CollectionIdentityCell({
  collection,
}: {
  collection: MerchantProductCollection;
}) {
  return (
    <TaxonomyIdentityCell entity={collection} label={getCollectionDisplayName(collection)} />
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
  if (!parentCategoryId) {
    return <span className="text-muted-foreground">Root category</span>;
  }

  return (
    <div className="min-w-44">
      <div className="font-medium text-card-foreground">
        {parentCategory ? getCategoryDisplayName(parentCategory) : "Parent ID"}
      </div>
      <div className="mt-1 max-w-56 truncate font-mono text-xs text-muted-foreground">
        {parentCategoryId}
      </div>
    </div>
  );
}

export function TaxonomyDateCell({ value }: { value: string | null }) {
  return <span className="text-muted-foreground">{formatTaxonomyDate(value)}</span>;
}
