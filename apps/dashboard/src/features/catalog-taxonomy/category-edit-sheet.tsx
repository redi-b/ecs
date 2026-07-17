"use client";

import type { MerchantProductCategory } from "@ecs/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ParentCategoryCombobox } from "@/features/catalog-taxonomy/parent-category-combobox";
import {
  getCategoryDisplayName,
  slugifyTaxonomyHandle,
} from "@/features/catalog-taxonomy/taxonomy-table-state";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

type CategoryEditSheetProps = {
  category: MerchantProductCategory | null;
  categories: MerchantProductCategory[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tenantId?: string | null | undefined;
};

export function CategoryEditSheet({
  category,
  categories,
  onOpenChange,
  open,
  tenantId,
}: CategoryEditSheetProps) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [isHandleLocked, setIsHandleLocked] = useState(true);
  const [parentCategoryId, setParentCategoryId] = useState("__root__");
  const [rank, setRank] = useState("0");
  const [isVisible, setIsVisible] = useState(true);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const HandleLockIcon = isHandleLocked ? AppIcons.lock : AppIcons.lockUnlock;

  const parentOptions = useMemo(() => {
    if (!category) return categories;
    const blocked = new Set(collectDescendantIds(category.id, categories));
    blocked.add(category.id);
    return categories
      .filter((item) => !blocked.has(item.id))
      .sort((a, b) => getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b)));
  }, [categories, category]);

  useEffect(() => {
    if (!category || !open) return;
    setDisplayName(category.name ?? "");
    setHandle(category.handle ?? "");
    setIsHandleLocked(true);
    setParentCategoryId(category.parentCategoryId ?? "__root__");
    setRank(String(category.rank ?? 0));
    setIsVisible(category.visibility !== "hidden");
    setSeoTitle(category.seoTitle ?? "");
    setSeoDescription(category.seoDescription ?? "");
    setError(null);
  }, [category, open]);

  async function submit() {
    if (!category) return;
    const name = displayName.trim();
    if (!name) {
      setError(t("taxonomy.edit.enterCategoryName"));
      return;
    }

    setIsSaving(true);
    setError(null);

    const url = getTenantScopedPath(
      dashboardRoutes.productCategoryUpdateAction(category.id),
      tenantId,
    );
    const response = await fetch(url, {
      body: JSON.stringify({
        name,
        handle: handle.trim() || null,
        parentCategoryId: parentCategoryId === "__root__" ? null : parentCategoryId,
        rank: Number.isFinite(Number(rank)) ? Math.max(0, Math.floor(Number(rank))) : 0,
        visibility: isVisible ? "public" : "hidden",
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);

    setIsSaving(false);

    if (!response?.ok) {
      const data = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(getCategoryEditErrorMessage(data.error, t));
      return;
    }

    toast.success(t("taxonomy.edit.categoryUpdated"));
    onOpenChange(false);
    await queryClient.invalidateQueries({ queryKey: ["product-categories"] });
    router.refresh();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        <SheetHeader className="px-5 py-4 text-left">
          <SheetTitle>{t("taxonomy.edit.categoryTitle")}</SheetTitle>
          <SheetDescription>{t("taxonomy.edit.categoryDesc")}</SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <SheetBody className="grid content-start gap-5 px-5 py-5">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{t("taxonomy.edit.updateFailedCategory")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="category-edit-name">{t("taxonomy.edit.name")}</FieldLabel>
              <Input
                autoComplete="off"
                id="category-edit-name"
                onChange={(event) => {
                  const next = event.target.value;
                  setDisplayName(next);
                  if (isHandleLocked) setHandle(slugifyTaxonomyHandle(next));
                }}
                required
                value={displayName}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="category-edit-handle">{t("taxonomy.edit.handle")}</FieldLabel>
              <InputGroup className="pr-1">
                <InputGroupInput
                  id="category-edit-handle"
                  onChange={(event) => setHandle(slugifyTaxonomyHandle(event.target.value))}
                  readOnly={isHandleLocked}
                  value={handle}
                />
                <InputGroupAddon align="inline-end" className="gap-1 py-0 pr-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={
                          isHandleLocked
                            ? t("taxonomy.form.unlockHandle")
                            : t("taxonomy.form.lockHandle")
                        }
                        className="rounded-full"
                        onClick={() => setIsHandleLocked((value) => !value)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <HandleLockIcon data-icon="inline-start" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      {isHandleLocked
                        ? t("taxonomy.form.unlockHandle")
                        : t("taxonomy.form.lockHandle")}
                    </TooltipContent>
                  </Tooltip>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel>{t("taxonomy.edit.parentCategory")}</FieldLabel>
              <ParentCategoryCombobox
                onChange={setParentCategoryId}
                options={parentOptions}
                rootLabel={t("taxonomy.edit.rootCategory")}
                searchPlaceholder={t("taxonomy.create.searchParent")}
                value={parentCategoryId}
              />
              <FieldDescription>{t("taxonomy.edit.parentHelp")}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="category-edit-rank">
                {t("taxonomy.edit.siblingOrder")}
              </FieldLabel>
              <Input
                id="category-edit-rank"
                min={0}
                onChange={(event) => setRank(event.target.value)}
                step={1}
                type="number"
                value={rank}
              />
              <FieldDescription>{t("taxonomy.edit.siblingOrderHelp")}</FieldDescription>
            </Field>

            <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
              <div className="min-w-0 space-y-1">
                <FieldLabel className="text-sm" htmlFor="category-edit-visible">
                  {t("taxonomy.edit.visibleLabel")}
                </FieldLabel>
                <FieldDescription className="text-xs">
                  {t("taxonomy.edit.visibleCategoryDesc")}
                </FieldDescription>
              </div>
              <Switch
                checked={isVisible}
                id="category-edit-visible"
                onCheckedChange={setIsVisible}
              />
            </Field>

            <div className="space-y-4 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">{t("taxonomy.edit.seo")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("taxonomy.edit.seoCategoryHelp")}
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="category-edit-seo-title">
                  {t("taxonomy.edit.seoTitle")}
                </FieldLabel>
                <Input
                  id="category-edit-seo-title"
                  maxLength={120}
                  onChange={(event) => setSeoTitle(event.target.value)}
                  placeholder={t("taxonomy.edit.seoTitleCategoryPlaceholder")}
                  value={seoTitle}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="category-edit-seo-description">
                  {t("taxonomy.edit.seoDescription")}
                </FieldLabel>
                <Textarea
                  id="category-edit-seo-description"
                  maxLength={320}
                  onChange={(event) => setSeoDescription(event.target.value)}
                  placeholder={t("taxonomy.edit.seoDescCategoryPlaceholder")}
                  value={seoDescription}
                />
              </Field>
            </div>
          </SheetBody>

          <SheetFooter className="flex-row justify-end gap-2 px-5 py-4">
            <Button
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? t("taxonomy.edit.saving") : t("taxonomy.edit.saveChanges")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function collectDescendantIds(rootId: string, categories: MerchantProductCategory[]) {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    const parentId = category.parentCategoryId;
    if (!parentId) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(category.id);
    childrenByParent.set(parentId, list);
  }

  const result: string[] = [];
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop();
    if (!id) continue;
    result.push(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

function getCategoryEditErrorMessage(error: string | undefined, t: Translate) {
  if (error === "missing_name") return t("taxonomy.edit.enterCategoryName");
  if (error === "commerce_backend_unavailable") {
    return t("taxonomy.edit.backendUnavailable");
  }
  if (error === "commerce_credentials_missing" || error === "commerce_credentials_invalid") {
    return t("taxonomy.edit.credentials");
  }
  if (error === "category_not_found") return t("taxonomy.edit.categoryNotFound");
  return t("taxonomy.edit.categorySaveFailed");
}
