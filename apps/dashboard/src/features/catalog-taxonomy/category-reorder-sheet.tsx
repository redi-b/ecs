"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getCategoryDisplayName } from "@/features/catalog-taxonomy/taxonomy-table-state";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

type CategoryReorderSheetProps = {
  categories: MerchantProductCategory[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tenantId?: string | null | undefined;
};

type SiblingGroup = {
  parentId: string | null;
  parentLabel: string;
  items: MerchantProductCategory[];
};

export function CategoryReorderSheet({
  categories,
  onOpenChange,
  open,
  tenantId,
}: CategoryReorderSheetProps) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [groups, setGroups] = useState<SiblingGroup[]>([]);
  const [baselineKey, setBaselineKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open) return;
    const next = buildSiblingGroups(categories, t);
    setGroups(next);
    setBaselineKey(orderKey(next));
  }, [categories, open, t]);

  const isDirty = open && orderKey(groups) !== baselineKey;
  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(isDirty);

  function requestClose() {
    requestLeave(() => onOpenChange(false));
  }

  async function saveOrder() {
    const items = groups.flatMap((group) =>
      group.items.map((category, index) => ({
        categoryId: category.id,
        rank: index,
      })),
    );

    setIsSaving(true);
    const url = getTenantScopedPath(dashboardRoutes.productCategoriesReorderAction, tenantId);
    const response = await fetch(url, {
      body: JSON.stringify({ items }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);
    setIsSaving(false);

    if (!response?.ok) {
      toast.error(t("taxonomy.reorder.saveFailed"));
      return;
    }

    toast.success(t("taxonomy.reorder.saved"));
    onOpenChange(false);
    await queryClient.invalidateQueries({ queryKey: ["product-categories"] });
    router.refresh();
  }

  function onDragEnd(parentId: string | null, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setGroups((current) =>
      current.map((group) => {
        if ((group.parentId ?? null) !== (parentId ?? null)) return group;
        const oldIndex = group.items.findIndex((item) => item.id === active.id);
        const newIndex = group.items.findIndex((item) => item.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return group;
        return {
          ...group,
          items: arrayMove(group.items, oldIndex, newIndex),
        };
      }),
    );
  }

  return (
    <>
    <Sheet
      onOpenChange={(next) => {
        if (!next) requestClose();
        else onOpenChange(true);
      }}
      open={open}
    >
      <SheetContent className="w-full sm:max-w-lg" side="right">
        <SheetHeader className="px-5 py-4 text-left">
          <SheetTitle>{t("taxonomy.reorder.title")}</SheetTitle>
          <SheetDescription>{t("taxonomy.reorder.description")}</SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6 px-5 py-5">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("taxonomy.reorder.empty")}</p>
          ) : null}
          {groups.map((group) => (
            <section className="space-y-2" key={group.parentId ?? "__root__"}>
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.parentLabel}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {group.items.length === 1
                    ? t("taxonomy.reorder.countOne")
                    : t("taxonomy.reorder.count", { count: group.items.length })}
                </p>
              </div>
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={(event) => onDragEnd(group.parentId, event)}
                sensors={sensors}
              >
                <SortableContext
                  items={group.items.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-1.5">
                    {group.items.map((item, index) => (
                      <SortableCategoryRow category={item} index={index} key={item.id} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </section>
          ))}
        </SheetBody>

        <SheetFooter className="flex-row justify-end gap-2 px-5 py-4">
          <Button disabled={isSaving} onClick={requestClose} type="button" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button disabled={isSaving || groups.length === 0} onClick={() => void saveOrder()} type="button">
            {isSaving ? t("taxonomy.reorder.saving") : t("taxonomy.reorder.saveOrder")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    <UnsavedChangesDialog
      onLeave={confirmLeave}
      onStay={cancelLeave}
      open={leaveDialogOpen}
    />
    </>
  );
}

function orderKey(groups: SiblingGroup[]) {
  return groups.map((group) => group.items.map((item) => item.id).join(",")).join("|");
}

function SortableCategoryRow({
  category,
  index,
}: {
  category: MerchantProductCategory;
  index: number;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-card px-2.5 py-2 shadow-sm",
        isDragging && "z-10 border-primary/40 shadow-md",
      )}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <button
        aria-label={t("taxonomy.reorder.dragAria", {
          name: getCategoryDisplayName(category),
        })}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        type="button"
        {...attributes}
        {...listeners}
      >
        <AppIcons.arrowUpDown className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{getCategoryDisplayName(category)}</p>
        {category.handle ? (
          <p className="truncate font-mono text-xs text-muted-foreground">{category.handle}</p>
        ) : null}
      </div>
      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{index}</span>
    </li>
  );
}

function buildSiblingGroups(
  categories: MerchantProductCategory[],
  t: Translate,
): SiblingGroup[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const buckets = new Map<string, MerchantProductCategory[]>();

  for (const category of categories) {
    const key = category.parentCategoryId ?? "__root__";
    const list = buckets.get(key) ?? [];
    list.push(category);
    buckets.set(key, list);
  }

  const groups: SiblingGroup[] = [];
  for (const [key, items] of buckets) {
    const parentId = key === "__root__" ? null : key;
    items.sort((a, b) => {
      const rankDelta = (a.rank ?? 0) - (b.rank ?? 0);
      if (rankDelta !== 0) return rankDelta;
      return getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b));
    });
    const parent = parentId ? byId.get(parentId) : undefined;
    groups.push({
      parentId,
      parentLabel: parent
        ? t("taxonomy.reorder.underParent", { name: getCategoryDisplayName(parent) })
        : parentId
          ? t("taxonomy.reorder.underUnknownParent")
          : t("taxonomy.reorder.rootCategories"),
      items,
    });
  }

  // Roots first, then groups by parent name.
  groups.sort((a, b) => {
    if (a.parentId === null) return -1;
    if (b.parentId === null) return 1;
    return a.parentLabel.localeCompare(b.parentLabel);
  });

  return groups;
}
