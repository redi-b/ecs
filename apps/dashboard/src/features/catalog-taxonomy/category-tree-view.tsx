"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
import { useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildCategoryTree,
  flattenCategoryTree,
  getCategoryDisplayName,
  type CategoryTreeNode,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type CategoryTreeViewProps = {
  categories: MerchantProductCategory[];
  onEdit: (category: MerchantProductCategory) => void;
  query?: string;
};

export function CategoryTreeView({ categories, onEdit, query = "" }: CategoryTreeViewProps) {
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
      return getCategoryDisplayName(node.category).toLowerCase().includes(q)
        || (node.category.handle?.toLowerCase().includes(q) ?? false);
    });
  }, [categories, collapsed, query, rows]);

  if (!categories.length) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        No categories yet. Create a root category to start the tree.
      </div>
    );
  }

  if (!visibleRows.length) {
    return (
      <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        No categories match this search.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <ul className="divide-y">
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
    </div>
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

  return (
    <li className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30">
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
          <span className="size-7 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{getCategoryDisplayName(node.category)}</p>
          {node.category.handle ? (
            <p className="truncate font-mono text-xs text-muted-foreground">
              {node.category.handle}
            </p>
          ) : null}
        </div>
      </div>
      <Badge variant={hidden ? "secondary" : "outline"}>{hidden ? "Hidden" : "Public"}</Badge>
      <span className="w-8 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
        {node.category.rank ?? 0}
      </span>
      <Button onClick={onEdit} size="sm" type="button" variant="ghost">
        Edit
      </Button>
    </li>
  );
}
