import type { MerchantProductCategory, MerchantProductCollection } from "@ecs/contracts";

import {
  formatTaxonomyDate,
  getCategoryDisplayName,
  getCollectionDisplayName,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { listEntityActionClassName } from "@/lib/list-entity-link";
import { cn } from "@/lib/utils";

type TaxonomyIdentityCellProps = {
  entity: MerchantProductCategory | MerchantProductCollection;
  label: string;
  onOpen?: (() => void) | undefined;
};

export function TaxonomyIdentityCell({ entity, label, onOpen }: TaxonomyIdentityCellProps) {
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
      <div className="mt-1 max-w-64 truncate font-mono text-xs text-muted-foreground">
        {entity.id}
      </div>
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
