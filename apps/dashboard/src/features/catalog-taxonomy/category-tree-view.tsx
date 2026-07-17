"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
import { useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { RowActionsMenu } from "@/components/app/row-actions-menu";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  buildCategoryTree,
  flattenCategoryTree,
  getCategoryDisplayName,
  type CategoryTreeNode,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { useI18n } from "@/i18n/provider";
import { listEntityActionClassName } from "@/lib/list-entity-link";
import { cn } from "@/lib/utils";

type CategoryTreeViewProps = {
  categories: MerchantProductCategory[];
  onEdit: (category: MerchantProductCategory) => void;
  query?: string;
  /** When true, parent card already provides border/radius — only render rows. */
  embedded?: boolean;
};

export function CategoryTreeView({
  categories,
  onEdit,
  query = "",
  embedded = false,
}: CategoryTreeViewProps) {
  const { t } = useI18n();
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const rows = useMemo(() => flattenCategoryTree(tree), [tree]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((node) => {
      // Hide descendants of collapsed ancestors.
      let parentId = node.category.parentCategoryId;
      while (parentId) {
        if (collapsed.has(parentId)) return false;
        const parent = categories.find((item) => item.id === parentId);
        parentId = parent?.parentCategoryId ?? null;
      }

      if (!q) return true;
      return (
        getCategoryDisplayName(node.category).toLowerCase().includes(q) ||
        (node.category.handle?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [categories, collapsed, query, rows]);

  if (!categories.length) {
    return (
      <div className="flex min-h-56 items-center justify-center px-5 py-12 sm:min-h-64 sm:px-8">
        <Empty className="max-w-sm border-0 p-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AppIcons.tree />
            </EmptyMedia>
            <EmptyTitle>{t("taxonomy.table.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("taxonomy.table.emptyMessage")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!visibleRows.length) {
    return (
      <div className="flex min-h-56 items-center justify-center px-5 py-12 sm:min-h-64 sm:px-8">
        <Empty className="max-w-sm border-0 p-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AppIcons.search />
            </EmptyMedia>
            <EmptyTitle>{t("taxonomy.table.filteredEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("taxonomy.table.filteredEmptyMessage")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const list = (
    <ul className="divide-y divide-border">
      {visibleRows.map((node) => (
        <TreeRow
          collapsed={collapsed.has(node.category.id)}
          hasChildren={node.children.length > 0}
          key={node.category.id}
          node={node}
          onEdit={() => onEdit(node.category)}
          onToggle={() =>
            setCollapsed((current) => {
              const next = new Set(current);
              if (next.has(node.category.id)) next.delete(node.category.id);
              else next.add(node.category.id);
              return next;
            })
          }
        />
      ))}
    </ul>
  );

  if (embedded) {
    return list;
  }

  return (
    <div className="overflow-hidden rounded-[1.35rem] border bg-card/95">{list}</div>
  );
}

function TreeRow({
  collapsed,
  hasChildren,
  node,
  onEdit,
  onToggle,
}: {
  collapsed: boolean;
  hasChildren: boolean;
  node: CategoryTreeNode;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const hidden = node.category.visibility === "hidden";
  const name = getCategoryDisplayName(node.category);

  return (
    <li className="group/row flex items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/40">
      <div
        className="flex min-w-0 flex-1 items-center gap-1.5"
        style={{ paddingLeft: `${node.depth * 1.25}rem` }}
      >
        {hasChildren ? (
          <button
            aria-expanded={!collapsed}
            aria-label={
              collapsed ? t("taxonomy.tree.expand") : t("taxonomy.tree.collapse")
            }
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onToggle}
            type="button"
          >
            <AppIcons.arrowDown
              className={cn("size-4 transition-transform", collapsed && "-rotate-90")}
            />
          </button>
        ) : (
          <span className="size-7 shrink-0" aria-hidden />
        )}
        <div className="min-w-0">
          <button
            className={cn(listEntityActionClassName, "truncate text-left")}
            onClick={onEdit}
            type="button"
          >
            {name}
          </button>
          {node.category.handle ? (
            <p className="truncate font-mono text-xs text-muted-foreground">
              {node.category.handle}
            </p>
          ) : null}
        </div>
      </div>
      <Badge variant={hidden ? "secondary" : "outline"}>
        {hidden
          ? t("taxonomy.table.visibility.hidden")
          : t("taxonomy.table.visibility.public")}
      </Badge>
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {node.category.rank ?? 0}
      </span>
      <div className="shrink-0">
        <RowActionsMenu
          actions={[
            {
              icon: AppIcons.edit,
              label: t("taxonomy.table.actions.edit", {
                entity: t("taxonomy.entity.category.label"),
              }),
              onSelect: onEdit,
              type: "button",
            },
          ]}
          label={t("taxonomy.table.actions.edit", {
            entity: t("taxonomy.entity.category.label"),
          })}
        />
      </div>
    </li>
  );
}
