"use client";

import { productDescriptionToText } from "@ecs/content";
import {
  type CatalogTranslationResource,
  catalogTranslationResourceSchema,
  type MerchantProduct,
} from "@ecs/contracts";
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { LanguagesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TranslationSheetLoadingFields,
  TranslationSheetLoadingNotice,
} from "@/features/storefront-editor/translation-sheet-loading";
import { TranslationSourceReference } from "@/features/storefront-editor/translation-source-reference";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type EditableResource = {
  key: string;
  label: string;
  productId?: string;
  resourceId: string;
  resourceType: "product" | "product_option" | "product_option_value";
};

function productResources(product: MerchantProduct): EditableResource[] {
  const resources: EditableResource[] = [
    {
      key: `product:${product.id}`,
      label: product.title ?? "Product",
      resourceId: product.id,
      resourceType: "product",
    },
  ];
  const options = product.options ?? [];
  const hasSyntheticDefault =
    options.length === 1 &&
    (product.variants ?? []).length === 1 &&
    isDefaultName(options[0]?.title) &&
    options[0]?.values.every((value) => isDefaultName(value.label));
  for (const option of hasSyntheticDefault ? [] : options) {
    if (!option.id) continue;
    resources.push({
      key: `option:${option.id}`,
      label: option.title,
      productId: product.id,
      resourceId: option.id,
      resourceType: "product_option",
    });
    for (const value of option.values) {
      if (!value.id) continue;
      resources.push({
        key: `value:${value.id}`,
        label: `${option.title}: ${value.label}`,
        productId: product.id,
        resourceId: value.id,
        resourceType: "product_option_value",
      });
    }
  }
  return resources;
}

function isDefaultName(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase().startsWith("default") ?? false;
}

export function ProductTranslationSheet({
  defaultOpen = false,
  onOpenChange,
  onSaved,
  open: controlledOpen,
  product,
  readOnly,
  queueNavigation,
  showTrigger = true,
}: {
  defaultOpen?: boolean;
  onOpenChange?: ((open: boolean) => void) | undefined;
  onSaved?: (() => void) | undefined;
  open?: boolean | undefined;
  product: MerchantProduct;
  readOnly: boolean;
  tenantId?: string | undefined;
  queueNavigation?:
    | {
        next?: string | undefined;
        loading?: boolean | undefined;
        onNext?: (() => void) | undefined;
        onPrevious?: (() => void) | undefined;
        previous?: string | undefined;
      }
    | undefined;
  showTrigger?: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resources, setResources] = useState<CatalogTranslationResource[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const definitions = useMemo(() => productResources(product), [product]);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dirty = resources.some((resource) =>
    Object.keys(resource.source).some(
      (field) =>
        (drafts[resource.resourceId]?.[field] ?? "") !== (resource.translations[field] ?? ""),
    ),
  );
  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } = useUnsavedChangesGuard(
    dirty && open,
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    fetch("/dashboard/storefront/translations/catalog", {
      body: JSON.stringify({
        items: definitions.map((definition) => ({
          locale: "am",
          productId: definition.productId,
          resourceId: definition.resourceId,
          resourceType: definition.resourceType,
        })),
      }),
      cache: "no-store",
      headers: { "content-type": "application/json" },
      method: "POST",
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        const parsed = catalogTranslationResourceSchema.array().safeParse(data?.resources);
        if (!response.ok || !parsed.success) throw new Error("load_failed");
        return parsed.data;
      })
      .then((loaded) => {
        if (!active) return;
        setResources(loaded);
        setDrafts(
          Object.fromEntries(
            loaded.map((resource) => [resource.resourceId, resource.translations]),
          ),
        );
      })
      .catch(() => active && toast.error(t("products.translation.loadFailed")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [definitions, open, t]);

  const translated = resources.reduce((total, resource) => total + resource.translatedFields, 0);
  const total = resources.reduce((sum, resource) => sum + resource.totalFields, 0);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/dashboard/storefront/translations/catalog?operation=update", {
        body: JSON.stringify({
          items: resources.map((resource) => ({
            locale: "am",
            productId: resource.productId ?? undefined,
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            translations: drafts[resource.resourceId] ?? {},
          })),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      const parsed = catalogTranslationResourceSchema.array().safeParse(data?.resources);
      if (!response.ok || !parsed.success) throw new Error("save_failed");
      const updated = parsed.data;
      setResources(updated);
      setDrafts(
        Object.fromEntries(updated.map((resource) => [resource.resourceId, resource.translations])),
      );
      toast.success(t("products.translation.saved"));
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", product.id] });
      queryClient.invalidateQueries({ queryKey: ["product-taxonomy"] });
      router.refresh();
      onSaved?.();
    } catch {
      toast.error(t("products.translation.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      onOpenChange={(next) => {
        if (saving) return;
        if (next) {
          setOpen(true);
          return;
        }
        requestLeave(() => setOpen(false));
      }}
      open={open}
    >
      {showTrigger ? (
        <SheetTrigger asChild>
          <Button size="sm" variant="outline">
            <LanguagesIcon />
            {t("products.translation.action")}
          </Button>
        </SheetTrigger>
      ) : null}
      <SheetContent
        className="w-full sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
        }}
      >
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="outline-none" ref={titleRef} tabIndex={-1}>
              {t("products.translation.title")}
            </SheetTitle>
            <Badge variant="secondary">{t("products.translation.language")}</Badge>
          </div>
          <SheetDescription>
            {loading
              ? t("products.translation.loading")
              : t("products.translation.progress", { translated, total })}
          </SheetDescription>
        </SheetHeader>
        {queueNavigation?.loading && !loading ? (
          <TranslationSheetLoadingNotice
            className="top-[4.75rem]"
            label={t("products.translation.loading")}
          />
        ) : null}
        <SheetBody className="space-y-5">
          {loading ? (
            <TranslationSheetLoadingFields count={2} label={t("products.translation.loading")} />
          ) : (
            resources.map((resource, resourceIndex) => {
              const definition = definitions[resourceIndex];
              return (
                <section className="space-y-3" key={resource.resourceId}>
                  <div className="flex items-center justify-between gap-3 border-b pb-2">
                    <h3 className="text-sm font-medium">{definition?.label ?? resource.title}</h3>
                    <TranslationStatus status={resource.status} />
                  </div>
                  {resource.status === "needs_review" ? (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                      {t("editor.translations.catalogIncomplete")}
                    </p>
                  ) : null}
                  {Object.entries(resource.source).map(([field, source]) => {
                    const id = `translation-${resource.resourceId}-${field}`;
                    const setFieldValue = (value: string) =>
                      setDrafts((current) => ({
                        ...current,
                        [resource.resourceId]: {
                          ...current[resource.resourceId],
                          [field]: value,
                        },
                      }));
                    return (
                      <div className="space-y-2" key={field}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label htmlFor={id}>{fieldLabel(field, t)}</Label>
                          {readOnly ? null : (
                            <div className="flex items-center gap-1">
                              <Button
                                onClick={() => setFieldValue(source)}
                                size="xs"
                                type="button"
                                variant="ghost"
                              >
                                {t("editor.translations.useEnglish")}
                              </Button>
                              <Button
                                disabled={!drafts[resource.resourceId]?.[field]}
                                onClick={() => setFieldValue("")}
                                size="xs"
                                type="button"
                                variant="ghost"
                              >
                                {t("editor.translations.clearTranslation")}
                              </Button>
                            </div>
                          )}
                        </div>
                        <TranslationSourceReference
                          label={t("products.translation.english")}
                          variant="panel"
                        >
                          {field === "description" ? productDescriptionToText(source) : source}
                        </TranslationSourceReference>
                        {field === "description" && readOnly ? (
                          <div className="min-h-20 rounded-[var(--radius)] border bg-muted/20 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                            {productDescriptionToText(
                              drafts[resource.resourceId]?.[field] || source,
                            )}
                          </div>
                        ) : field === "description" ? (
                          <RichTextEditor
                            aria-label={t("products.translation.field.description")}
                            id={id}
                            onChange={setFieldValue}
                            placeholder={t("products.translation.placeholder")}
                            value={drafts[resource.resourceId]?.[field] ?? ""}
                          />
                        ) : (
                          <Textarea
                            className="min-h-20"
                            disabled={readOnly || saving}
                            id={id}
                            onChange={(event) => setFieldValue(event.target.value)}
                            placeholder={t("products.translation.placeholder")}
                            value={drafts[resource.resourceId]?.[field] ?? ""}
                          />
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })
          )}
        </SheetBody>
        <SheetFooter
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-center",
            queueNavigation?.previous || queueNavigation?.onPrevious || queueNavigation?.next || queueNavigation?.onNext
              ? "sm:justify-between"
              : "sm:justify-end",
          )}
        >
          {queueNavigation?.previous || queueNavigation?.onPrevious || queueNavigation?.next || queueNavigation?.onNext ? (
            <div className="flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-start">
              {queueNavigation?.previous || queueNavigation?.onPrevious ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {queueNavigation.onPrevious ? (
                      <Button
                        aria-label={t("editor.translations.previous")}
                        disabled={loading || queueNavigation.loading}
                        onClick={() => requestLeave(() => queueNavigation.onPrevious?.())}
                        size="icon-sm"
                        type="button"
                        variant="outline"
                      >
                        <RiArrowLeftLine />
                      </Button>
                    ) : (
                      <Button asChild size="icon-sm" variant="outline">
                        <a
                          aria-label={t("editor.translations.previous")}
                          href={queueNavigation.previous}
                        >
                          <RiArrowLeftLine />
                        </a>
                      </Button>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>{t("editor.translations.previous")}</TooltipContent>
                </Tooltip>
              ) : null}
              {queueNavigation?.next || queueNavigation?.onNext ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {queueNavigation.onNext ? (
                      <Button
                        aria-label={t("editor.translations.next")}
                        disabled={loading || queueNavigation.loading}
                        onClick={() => requestLeave(() => queueNavigation.onNext?.())}
                        size="icon-sm"
                        type="button"
                        variant="outline"
                      >
                        <RiArrowRightLine />
                      </Button>
                    ) : (
                      <Button asChild size="icon-sm" variant="outline">
                        <a aria-label={t("editor.translations.next")} href={queueNavigation.next}>
                          <RiArrowRightLine />
                        </a>
                      </Button>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>{t("editor.translations.next")}</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          ) : null}
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:items-center">
            <Button
              className="w-full sm:w-auto"
              disabled={saving}
              onClick={() => requestLeave(() => setOpen(false))}
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            {readOnly ? null : (
              <Button
                className="w-full sm:w-auto"
                disabled={loading || saving || resources.length === 0}
                onClick={save}
              >
                {saving ? t("products.translation.saving") : t("products.translation.save")}
              </Button>
            )}
          </div>
        </SheetFooter>
        <UnsavedChangesDialog onLeave={confirmLeave} onStay={cancelLeave} open={leaveDialogOpen} />
      </SheetContent>
    </Sheet>
  );
}

function TranslationStatus({ status }: { status: CatalogTranslationResource["status"] }) {
  const { t } = useI18n();
  return (
    <Badge variant={status === "ready" ? "default" : "outline"}>
      {t(`products.translation.status.${status}`)}
    </Badge>
  );
}

function fieldLabel(field: string, t: ReturnType<typeof useI18n>["t"]) {
  const known = ["title", "subtitle", "description", "material", "value"] as const;
  return known.includes(field as (typeof known)[number])
    ? t(`products.translation.field.${field as (typeof known)[number]}`)
    : field;
}
