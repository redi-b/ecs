"use client";

import { type CatalogTranslationResource, catalogTranslationResourceSchema } from "@ecs/contracts";
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
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

type TranslationTargetResource = {
  id: string;
  name?: string | null | undefined;
  title?: string | null | undefined;
};

type TaxonomyTranslationTarget =
  | { kind: "category"; resource: TranslationTargetResource }
  | { kind: "collection"; resource: TranslationTargetResource }
  | { kind: "shipping"; resource: TranslationTargetResource };

export function TaxonomyTranslationSheet({
  onOpenChange,
  target,
  tenantId,
  queueNavigation,
  onSaved,
}: {
  onOpenChange: (open: boolean) => void;
  target: TaxonomyTranslationTarget | null;
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
  onSaved?: (() => void) | undefined;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resource, setResource] = useState<CatalogTranslationResource | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dirty = Boolean(
    resource &&
      Object.keys(resource.source).some(
        (field) => (drafts[field] ?? "") !== (resource.translations[field] ?? ""),
      ),
  );
  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } = useUnsavedChangesGuard(
    dirty && Boolean(target),
  );

  useEffect(() => {
    if (!target) {
      setResource(null);
      setDrafts({});
      return;
    }
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({
      locale: "am",
      resourceId: target.resource.id,
      resourceType:
        target.kind === "category"
          ? "product_category"
          : target.kind === "collection"
            ? "product_collection"
            : "shipping_option",
    });
    if (tenantId) query.set("tenantId", tenantId);
    fetch(`/dashboard/storefront/translations/catalog?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        const parsed = catalogTranslationResourceSchema.safeParse(data?.resource);
        if (!response.ok || !parsed.success) throw new Error("load_failed");
        return parsed.data;
      })
      .then((loaded) => {
        if (!active) return;
        setResource(loaded);
        setDrafts(loaded.translations);
      })
      .catch(() => active && toast.error(t("taxonomy.translation.loadFailed")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [t, target, tenantId]);

  async function save() {
    if (!resource || !target) return;
    setSaving(true);
    try {
      const response = await fetch("/dashboard/storefront/translations/catalog", {
        body: JSON.stringify({
          locale: "am",
          resourceId: resource.resourceId,
          resourceType: resource.resourceType,
          translations: drafts,
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      const data = await response.json().catch(() => null);
      const parsed = catalogTranslationResourceSchema.safeParse(data?.resource);
      if (!response.ok || !parsed.success) throw new Error("save_failed");
      setResource(parsed.data);
      setDrafts(parsed.data.translations);
      toast.success(t("taxonomy.translation.saved"));
      onSaved?.();
    } catch {
      toast.error(t("taxonomy.translation.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const title =
    target?.kind === "category"
      ? t("taxonomy.translation.categoryTitle")
      : target?.kind === "collection"
        ? t("taxonomy.translation.collectionTitle")
        : t("taxonomy.translation.deliveryTitle");

  return (
    <Sheet
      onOpenChange={(open) => {
        if (saving || open) return;
        requestLeave(() => onOpenChange(false));
      }}
      open={Boolean(target)}
    >
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
              {title}
            </SheetTitle>
            <Badge variant="secondary">{t("products.translation.language")}</Badge>
          </div>
          <SheetDescription>
            {loading
              ? t("products.translation.loading")
              : t("products.translation.progress", {
                  translated: resource?.translatedFields ?? 0,
                  total: resource?.totalFields ?? 0,
                })}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="relative space-y-5">
          {queueNavigation?.loading && !loading ? (
            <TranslationSheetLoadingNotice label={t("products.translation.loading")} />
          ) : null}
          {loading ? (
            <TranslationSheetLoadingFields label={t("products.translation.loading")} />
          ) : resource ? (
            <section className="space-y-4">
              {resource.status === "needs_review" ? (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                  {t("editor.translations.catalogIncomplete")}
                </p>
              ) : null}
              {Object.entries(resource.source).map(([field, source]) => {
                const id = `taxonomy-translation-${resource.resourceId}-${field}`;
                return (
                  <div className="space-y-2" key={field}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor={id}>{taxonomyFieldLabel(field, t)}</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => setDrafts((current) => ({ ...current, [field]: source }))}
                          size="xs"
                          type="button"
                          variant="ghost"
                        >
                          {t("editor.translations.useEnglish")}
                        </Button>
                        <Button
                          disabled={!drafts[field]}
                          onClick={() => setDrafts((current) => ({ ...current, [field]: "" }))}
                          size="xs"
                          type="button"
                          variant="ghost"
                        >
                          {t("editor.translations.clearTranslation")}
                        </Button>
                      </div>
                    </div>
                    <TranslationSourceReference
                      label={t("products.translation.english")}
                      variant="panel"
                    >
                      {source}
                    </TranslationSourceReference>
                    <Textarea
                      className={cn(field === "description" ? "min-h-32" : "min-h-20")}
                      disabled={saving}
                      id={id}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [field]: event.target.value }))
                      }
                      placeholder={t("products.translation.placeholder")}
                      value={drafts[field] ?? ""}
                    />
                  </div>
                );
              })}
            </section>
          ) : null}
        </SheetBody>
        <SheetFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
            <Button
              disabled={saving}
              onClick={() => requestLeave(() => onOpenChange(false))}
              variant="outline"
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={loading || saving || !resource} onClick={save}>
              {saving ? t("products.translation.saving") : t("products.translation.save")}
            </Button>
          </div>
        </SheetFooter>
        <UnsavedChangesDialog onLeave={confirmLeave} onStay={cancelLeave} open={leaveDialogOpen} />
      </SheetContent>
    </Sheet>
  );
}

function taxonomyFieldLabel(field: string, t: ReturnType<typeof useI18n>["t"]) {
  if (field === "name" || field === "title") return t("taxonomy.translation.field.name");
  if (field === "description") return t("taxonomy.translation.field.description");
  return field;
}

export type { TaxonomyTranslationTarget };
