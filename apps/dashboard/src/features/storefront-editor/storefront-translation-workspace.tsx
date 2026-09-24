"use client";

import type {
  CatalogTranslationQueue,
  CatalogTranslationQueueItem,
  CatalogTranslationStatus,
  MerchantProduct,
  StorefrontLocale,
} from "@ecs/contracts";
import { merchantProductSchema } from "@ecs/contracts";
import {
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiRefreshLine,
  RiTranslate2,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { HelpTip } from "@/components/app/help-tip";
import Link from "@/components/app/link";
import { ListToolbarSearch } from "@/components/app/list-toolbar";
import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TaxonomyTranslationSheet,
  type TaxonomyTranslationTarget,
} from "@/features/catalog-taxonomy/taxonomy-translation-sheet";
import { ProductTranslationSheet } from "@/features/products/product-translation-sheet";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useI18n } from "@/i18n/provider";
import type { StorefrontTranslationField } from "@/lib/storefront-localization-fields";
import { cn } from "@/lib/utils";
import { SectionNavigator } from "./section-navigator";
import { TranslationSourceReference } from "./translation-source-reference";

type WorkspaceField = StorefrontTranslationField & {
  initialStatus: CatalogTranslationStatus;
  translation: string;
};

type CatalogTarget = {
  item: CatalogTranslationQueueItem;
  kind: "category" | "collection" | "product" | "shipping";
};

export function StorefrontTranslationWorkspace({
  categoryReadiness,
  collectionReadiness,
  fields,
  locale,
  productReadiness,
  shippingReadiness,
  tenantId,
}: {
  categoryReadiness: CatalogTranslationQueue | null;
  collectionReadiness: CatalogTranslationQueue | null;
  fields: WorkspaceField[];
  locale: Exclude<StorefrontLocale, "en">;
  productReadiness: CatalogTranslationQueue | null;
  shippingReadiness: CatalogTranslationQueue | null;
  tenantId: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.path, field.translation])),
  );
  const [savedValues, setSavedValues] = useState(values);
  const [reviewedPaths, setReviewedPaths] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "unfinished">("all");
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const fieldRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const stickySentinelRef = useRef<HTMLDivElement>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>();
  const [headerStuck, setHeaderStuck] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const [catalogTarget, setCatalogTarget] = useState<CatalogTarget | null>(null);
  const [catalogProduct, setCatalogProduct] = useState<MerchantProduct | null>(null);
  const [catalogProductLoading, setCatalogProductLoading] = useState(false);

  const statusFor = (field: WorkspaceField): CatalogTranslationStatus => {
    if (reviewedPaths.has(field.path)) return "ready";
    const value = values[field.path]?.trim();
    if (!value) return "using_english";
    if (value !== field.translation) return "ready";
    return field.initialStatus;
  };
  const unfinished = fields.filter((field) => statusFor(field) !== "ready");
  const filtered = (() => {
    const normalized = query.trim().toLocaleLowerCase();
    return fields.filter((field) => {
      if (view === "unfinished" && statusFor(field) === "ready") return false;
      if (!normalized) return true;
      return [field.label, field.sectionLabel, field.source, values[field.path]].some((value) =>
        value?.toLocaleLowerCase().includes(normalized),
      );
    });
  })();
  const groups = useMemo(() => {
    const result = new Map<string, { id: string; label: string; fields: WorkspaceField[] }>();
    filtered.forEach((field) => {
      const group = result.get(field.sectionId) ?? {
        id: field.sectionId,
        label: field.sectionLabel,
        fields: [],
      };
      group.fields.push(field);
      result.set(field.sectionId, group);
    });
    return [...result.values()];
  }, [filtered]);
  const dirty =
    reviewedPaths.size > 0 ||
    fields.some((field) => values[field.path] !== savedValues[field.path]);
  const { leaveDialogOpen, requestLeave, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(dirty);
  const allSectionsExpanded = groups.every((group) => !collapsedSections.has(group.id));
  const pageMetric = fields.reduce(
    (metric, field) => {
      const status = statusFor(field);
      metric[status] += 1;
      return metric;
    },
    { needs_review: 0, ready: 0, using_english: 0 },
  );
  const catalogTargets = useMemo(
    () =>
      [
        ...(productReadiness?.items ?? []).map((item) => ({ kind: "product" as const, item })),
        ...(categoryReadiness?.items ?? []).map((item) => ({ kind: "category" as const, item })),
        ...(collectionReadiness?.items ?? []).map((item) => ({
          kind: "collection" as const,
          item,
        })),
        ...(shippingReadiness?.items ?? []).map((item) => ({ kind: "shipping" as const, item })),
      ].filter((target) => target.item.status !== "ready"),
    [categoryReadiness, collectionReadiness, productReadiness, shippingReadiness],
  );
  const catalogReady =
    (productReadiness?.ready ?? 0) +
    (categoryReadiness?.ready ?? 0) +
    (collectionReadiness?.ready ?? 0) +
    (shippingReadiness?.ready ?? 0);
  const catalogTotal =
    (productReadiness ? queueTotal(productReadiness) : 0) +
    (categoryReadiness ? queueTotal(categoryReadiness) : 0) +
    (collectionReadiness ? queueTotal(collectionReadiness) : 0) +
    (shippingReadiness ? queueTotal(shippingReadiness) : 0);
  const totalReady = pageMetric.ready + catalogReady;
  const totalFields = fields.length + catalogTotal;

  useEffect(() => {
    const sentinel = stickySentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderStuck(entry ? !entry.isIntersecting : false),
      { rootMargin: "-64px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  function jumpToSection(sectionId: string) {
    setActiveSectionId(sectionId);
    setCollapsedSections((current) => {
      const next = new Set(current);
      next.delete(sectionId);
      return next;
    });
    requestAnimationFrame(() =>
      sectionRefs.current.get(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function toggleAllSections() {
    setCollapsedSections(
      allSectionsExpanded ? new Set(groups.map((group) => group.id)) : new Set(),
    );
  }

  function moveUnfinished(direction: -1 | 1) {
    if (!unfinished.length) return;
    const focused = document.activeElement;
    const currentIndex = unfinished.findIndex(
      (field) => fieldRefs.current.get(field.path) === focused,
    );
    const nextIndex =
      currentIndex < 0 ? 0 : (currentIndex + direction + unfinished.length) % unfinished.length;
    const target = unfinished[nextIndex];
    if (!target) return;
    if (view !== "all") setView("all");
    setCollapsedSections((current) => {
      const next = new Set(current);
      next.delete(target.sectionId);
      return next;
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        fieldRefs.current.get(target.path)?.scrollIntoView({ behavior: "smooth", block: "center" });
        fieldRefs.current.get(target.path)?.focus({ preventScroll: true });
      }),
    );
  }

  async function openCatalogTarget(target: CatalogTarget) {
    if (target.kind !== "product") {
      setCatalogProduct(null);
      setCatalogTarget(target);
      return;
    }
    const replacingOpenProduct = catalogTarget?.kind === "product" && catalogProduct;
    if (!replacingOpenProduct) {
      setCatalogTarget(target);
      setCatalogProduct(null);
    }
    setCatalogProductLoading(true);
    try {
      const query = new URLSearchParams({ tenantId });
      const response = await fetch(
        `/dashboard/products/actions/${encodeURIComponent(target.item.resourceId)}?${query}`,
        { cache: "no-store", headers: { accept: "application/json" } },
      );
      const payload = await response.json().catch(() => null);
      const parsed = merchantProductSchema.safeParse(payload?.product);
      if (!response.ok || !parsed.success) throw new Error("load_failed");
      setCatalogTarget(target);
      setCatalogProduct(parsed.data);
    } catch {
      if (!replacingOpenProduct) setCatalogTarget(null);
      toast.error(t("products.translation.loadFailed"));
    } finally {
      setCatalogProductLoading(false);
    }
  }

  function moveCatalogTarget(direction: -1 | 1) {
    if (!catalogTarget || catalogTargets.length < 2) return;
    const index = catalogTargets.findIndex(
      (candidate) =>
        candidate.kind === catalogTarget.kind &&
        candidate.item.resourceId === catalogTarget.item.resourceId,
    );
    const nextIndex =
      index < 0 ? 0 : (index + direction + catalogTargets.length) % catalogTargets.length;
    const next = catalogTargets[nextIndex];
    if (next) void openCatalogTarget(next);
  }

  const sheetNavigation =
    catalogTargets.length > 1
      ? {
          loading: catalogProductLoading,
          onNext: () => moveCatalogTarget(1),
          onPrevious: () => moveCatalogTarget(-1),
        }
      : undefined;

  const taxonomyTarget: TaxonomyTranslationTarget | null =
    catalogTarget && catalogTarget.kind !== "product"
      ? {
          kind: catalogTarget.kind,
          resource: {
            id: catalogTarget.item.resourceId,
            name: catalogTarget.item.title,
            title: catalogTarget.item.title,
          },
        }
      : null;

  function save() {
    if (!dirty || pending) return;
    startTransition(async () => {
      const changed = Object.fromEntries(
        fields
          .filter(
            (field) =>
              reviewedPaths.has(field.path) || values[field.path] !== savedValues[field.path],
          )
          .map((field) => [field.path, values[field.path] ?? ""]),
      );
      const response = await fetch("/dashboard/storefront/translations/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale, tenantId, translations: changed }),
      });
      if (!response.ok) {
        toast.error(t("editor.translations.saveFailed"));
        return;
      }
      setSavedValues({ ...values });
      setReviewedPaths(new Set());
      toast.success(t("editor.translations.saved"));
    });
  }

  return (
    <div className="relative flex flex-col gap-5">
      <div
        ref={stickySentinelRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 h-px w-px"
      />
      <div
        className={cn(
          "sticky top-16 z-20 rounded-[calc(var(--radius)+0.25rem)] border bg-background/95 p-3 backdrop-blur transition-[box-shadow,border-color,width,margin] duration-150 supports-[backdrop-filter]:bg-background/88",
          headerStuck
            ? "border-border/90 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.38),0_3px_10px_-6px_rgba(0,0,0,0.18)] sm:-mx-2 sm:w-[calc(100%+1rem)] dark:shadow-[0_14px_34px_-18px_rgba(0,0,0,0.72)]"
            : "border-border/70 shadow-none",
        )}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <RiTranslate2 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {t("editor.translations.progress", { ready: totalReady, total: totalFields })}
              </p>
              <div className="mt-1 h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${totalFields ? (totalReady / totalFields) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:flex sm:justify-end">
            <div className="flex h-8 items-center rounded-full border bg-muted/25 p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t("editor.translations.previous")}
                    disabled={!unfinished.length}
                    onClick={() => moveUnfinished(-1)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <RiArrowLeftLine />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("editor.translations.previous")}</TooltipContent>
              </Tooltip>
              <span className="h-4 w-px bg-border" aria-hidden="true" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t("editor.translations.next")}
                    disabled={!unfinished.length}
                    onClick={() => moveUnfinished(1)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <RiArrowRightLine />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("editor.translations.next")}</TooltipContent>
              </Tooltip>
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={!dirty || pending}
              onClick={save}
              size="sm"
            >
              {pending ? t("editor.translations.saving") : t("editor.translations.save")}
            </Button>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t("common.refresh")}
                    disabled={refreshing}
                    onClick={() => requestLeave(() => startRefresh(() => router.refresh()))}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <RiRefreshLine className={refreshing ? "animate-spin" : undefined} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("common.refresh")}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-expanded={toolsExpanded}
                    aria-label={t(
                      toolsExpanded
                        ? "editor.translations.collapseTools"
                        : "editor.translations.expandTools",
                    )}
                    onClick={() => setToolsExpanded((current) => !current)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <RiArrowDownSLine
                      className={cn(
                        "size-4 transition-transform duration-150",
                        toolsExpanded && "rotate-180",
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t(
                    toolsExpanded
                      ? "editor.translations.collapseTools"
                      : "editor.translations.expandTools",
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
        <Collapsible open={toolsExpanded}>
          <CollapsibleContent className="-mx-1 px-1 pb-1">
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center lg:grid-cols-[minmax(12rem,1fr)_auto_16rem]">
              <ListToolbarSearch
                className="sm:max-w-none lg:max-w-none"
                clearLabel={t("common.clearSearch")}
                debounceMs={0}
                label={t("editor.translations.search")}
                onChange={setQuery}
                placeholder={t("editor.translations.search")}
                value={query}
              />
              <SegmentedControl
                active="muted"
                ariaLabel={t("editor.translations.filterLabel")}
                className="mx-auto shrink-0 sm:mx-0 sm:w-auto [&_button]:min-w-24"
                fullWidth={false}
                onChange={setView}
                options={(["all", "unfinished"] as const).map((option) => ({
                  id: option,
                  label: t(`editor.translations.${option}`),
                }))}
                size="sm"
                value={view}
              />
              {groups.length > 1 ? (
                <SectionNavigator
                  activeId={activeSectionId}
                  allExpanded={allSectionsExpanded}
                  className="w-full sm:col-span-2 lg:col-span-1"
                  collapseAllLabel={t("editor.settings.collapseAll")}
                  emptyLabel={t("editor.settings.noMatchingSection")}
                  expandAllLabel={t("editor.settings.expandAll")}
                  jumpLabel={t("editor.settings.jumpToSection")}
                  onSelect={jumpToSection}
                  onToggleAll={toggleAllSections}
                  searchLabel={t("editor.settings.searchSections")}
                  sections={groups}
                />
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <TranslationOverview
        categoryQueue={categoryReadiness}
        collectionQueue={collectionReadiness}
        pageMetric={{
          needsReview: pageMetric.needs_review,
          ready: pageMetric.ready,
          total: fields.length,
          usingEnglish: pageMetric.using_english,
        }}
        locale={locale}
        productQueue={productReadiness}
        shippingQueue={shippingReadiness}
        onOpenResource={openCatalogTarget}
      />

      <CatalogTranslationQueues
        categoryQueue={categoryReadiness}
        collectionQueue={collectionReadiness}
        productQueue={productReadiness}
        onOpenResource={openCatalogTarget}
        loadingResourceId={catalogProductLoading ? catalogTarget?.item.resourceId : undefined}
        unfinishedOnly={view === "unfinished"}
      />

      {groups.length ? (
        groups.map((group) => (
          <Collapsible
            className="scroll-mt-36 overflow-hidden rounded-[calc(var(--radius)+0.25rem)] border bg-card"
            key={group.id}
            onOpenChange={(open) =>
              setCollapsedSections((current) => {
                const next = new Set(current);
                if (open) next.delete(group.id);
                else next.add(group.id);
                return next;
              })
            }
            open={!collapsedSections.has(group.id)}
          >
            <section
              ref={(node) => {
                if (node) sectionRefs.current.set(group.id, node);
                else sectionRefs.current.delete(group.id);
              }}
            >
              <CollapsibleTrigger asChild>
                <button
                  className="group flex w-full items-center gap-3 bg-muted/25 px-4 py-3 text-left transition-colors hover:bg-muted/45"
                  type="button"
                >
                  <RiArrowDownSLine className="size-4 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
                  <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{group.label}</h2>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {group.fields.filter((field) => statusFor(field) === "ready").length}/
                    {group.fields.length}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {group.fields.some((field) => field.sectionId === "seo") ? (
                  <div className="border-b bg-muted/10 p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("editor.translations.searchPreview")}
                    </p>
                    <div className="mt-2 max-w-2xl rounded-xl border bg-background p-4 shadow-xs">
                      <p className="line-clamp-1 text-lg font-medium text-primary">
                        {values["seo.title"]?.trim() ||
                          group.fields.find((field) => field.path === "seo.title")?.source}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {values["seo.description"]?.trim() ||
                          group.fields.find((field) => field.path === "seo.description")?.source}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("editor.translations.searchPreviewDescription")}
                    </p>
                  </div>
                ) : null}
                <div className="divide-y">
                  {group.fields.map((field) => {
                    const status = statusFor(field);
                    return (
                      <div
                        className="grid gap-3 p-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-6"
                        key={field.path}
                      >
                        <div className="min-w-0">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{field.label}</p>
                            <StatusBadge status={status} />
                          </div>
                          <TranslationSourceReference label={t("editor.translations.sourceLabel")}>
                            {field.source}
                          </TranslationSourceReference>
                          {status === "needs_review" ? (
                            <div className="mt-2 flex items-start justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                {t("editor.translations.sourceChanged")}
                              </p>
                              <Button
                                className="shrink-0"
                                onClick={() =>
                                  setReviewedPaths((current) => new Set(current).add(field.path))
                                }
                                size="xs"
                                type="button"
                                variant="outline"
                              >
                                {t("editor.translations.markReviewed")}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <label
                              className="text-xs font-medium text-muted-foreground"
                              htmlFor={`workspace-translation-${field.path}`}
                            >
                              {t("editor.translations.translationLabel")}
                            </label>
                            <div className="flex items-center gap-1">
                              <Button
                                onClick={() =>
                                  setValues((current) => ({
                                    ...current,
                                    [field.path]: field.source,
                                  }))
                                }
                                size="xs"
                                type="button"
                                variant="ghost"
                              >
                                {t("editor.translations.useEnglish")}
                              </Button>
                              <Button
                                disabled={!values[field.path]}
                                onClick={() =>
                                  setValues((current) => ({ ...current, [field.path]: "" }))
                                }
                                size="xs"
                                type="button"
                                variant="ghost"
                              >
                                {t("editor.translations.clearTranslation")}
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            className="min-h-24 resize-y"
                            id={`workspace-translation-${field.path}`}
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                [field.path]: event.target.value,
                              }))
                            }
                            ref={(node) => {
                              if (node) fieldRefs.current.set(field.path, node);
                              else fieldRefs.current.delete(field.path);
                            }}
                            value={values[field.path] ?? ""}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {group.fields.some(
                  (field) =>
                    reviewedPaths.has(field.path) || values[field.path] !== savedValues[field.path],
                ) ? (
                  <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2.5">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      {t("common.unsaved.eyebrow")}
                    </span>
                    <Button disabled={!dirty || pending} onClick={save} size="sm" type="button">
                      {pending ? t("editor.translations.saving") : t("editor.translations.save")}
                    </Button>
                  </div>
                ) : null}
              </CollapsibleContent>
            </section>
          </Collapsible>
        ))
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("editor.translations.empty")}
        </div>
      )}

      {catalogTarget?.kind === "product" && catalogProduct ? (
        <ProductTranslationSheet
          onOpenChange={(open) => {
            if (!open) {
              setCatalogTarget(null);
              setCatalogProduct(null);
            }
          }}
          onSaved={() => startRefresh(() => router.refresh())}
          open
          product={catalogProduct}
          queueNavigation={sheetNavigation}
          readOnly={false}
          showTrigger={false}
          tenantId={tenantId}
        />
      ) : null}
      <TaxonomyTranslationSheet
        onOpenChange={(open) => {
          if (!open) setCatalogTarget(null);
        }}
        onSaved={() => startRefresh(() => router.refresh())}
        queueNavigation={sheetNavigation}
        target={taxonomyTarget}
        tenantId={tenantId}
      />
      <UnsavedChangesDialog onLeave={confirmLeave} onStay={cancelLeave} open={leaveDialogOpen} />
    </div>
  );
}

function CatalogTranslationQueues({
  categoryQueue,
  collectionQueue,
  productQueue,
  unfinishedOnly,
  onOpenResource,
  loadingResourceId,
}: {
  categoryQueue: CatalogTranslationQueue | null;
  collectionQueue: CatalogTranslationQueue | null;
  productQueue: CatalogTranslationQueue | null;
  unfinishedOnly: boolean;
  onOpenResource: (target: CatalogTarget) => void | Promise<void>;
  loadingResourceId?: string | undefined;
}) {
  const { t } = useI18n();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<CatalogTarget["kind"]>>(
    () => new Set(),
  );
  const groups = [
    {
      href: "/dashboard/products",
      kind: "product" as const,
      label: t("editor.translations.products"),
      queue: productQueue,
    },
    {
      href: "/dashboard/products/categories",
      kind: "category" as const,
      label: t("editor.translations.categories"),
      queue: categoryQueue,
    },
    {
      href: "/dashboard/products/collections",
      kind: "collection" as const,
      label: t("editor.translations.collections"),
      queue: collectionQueue,
    },
  ]
    .map((group) => ({
      ...group,
      items: (group.queue?.items ?? []).filter(
        (item) => !unfinishedOnly || item.status !== "ready",
      ),
    }))
    .filter((group) => group.items.length);
  const allGroupsExpanded = groups.every((group) => !collapsedGroups.has(group.kind));

  if (!groups.length) return null;

  return (
    <section className="overflow-hidden rounded-[calc(var(--radius)+0.25rem)] border bg-card">
      <header className="flex items-start justify-between gap-3 border-b bg-muted/25 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t("editor.translations.catalogQueue")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("editor.translations.catalogQueueDescription")}
          </p>
        </div>
        <Button
          className="shrink-0"
          onClick={() =>
            setCollapsedGroups(
              allGroupsExpanded ? new Set(groups.map((group) => group.kind)) : new Set(),
            )
          }
          size="xs"
          type="button"
          variant="ghost"
        >
          {t(allGroupsExpanded ? "editor.settings.collapseAll" : "editor.settings.expandAll")}
        </Button>
      </header>
      <div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {groups.map((group) => (
          <Collapsible
            className="min-w-0 p-3"
            key={group.kind}
            onOpenChange={(open) =>
              setCollapsedGroups((current) => {
                const next = new Set(current);
                if (open) next.delete(group.kind);
                else next.add(group.kind);
                return next;
              })
            }
            open={!collapsedGroups.has(group.kind)}
          >
            <div className="mb-1.5 flex min-h-9 items-center gap-1">
              <CollapsibleTrigger asChild>
                <button
                  className="group flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-muted/40"
                  type="button"
                >
                  <RiArrowDownSLine className="size-4 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
                  <h3 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </h3>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {group.queue?.count ?? group.items.length}
                  </span>
                </button>
              </CollapsibleTrigger>
              <Button asChild size="xs" variant="ghost">
                <Link href={group.href}>{t("editor.translations.viewAll")}</Link>
              </Button>
            </div>
            <CollapsibleContent>
              <div className="divide-y">
                {group.items.map((item, index) => (
                  <button
                    className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_7.5rem_3rem_1rem] items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    key={item.resourceId}
                    disabled={loadingResourceId === item.resourceId}
                    onClick={() => void onOpenResource({ item, kind: group.kind })}
                    type="button"
                  >
                    <span className="min-w-0 truncate">{item.title}</span>
                    <span className="justify-self-end">
                      <StatusBadge status={item.status} />
                    </span>
                    <span className="justify-self-end text-right tabular-nums text-xs text-muted-foreground">
                      {item.translatedFields}/{item.totalFields}
                    </span>
                    {loadingResourceId === item.resourceId ? (
                      <RiRefreshLine
                        className="size-4 animate-spin justify-self-end text-muted-foreground"
                        aria-hidden
                      />
                    ) : (
                      <RiArrowRightLine
                        className="size-4 justify-self-end text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    <span className="sr-only">
                      {t("editor.translations.queuePosition", {
                        current: index + 1,
                        total: group.items.length,
                      })}
                    </span>
                  </button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </section>
  );
}

function TranslationOverview({
  categoryQueue,
  collectionQueue,
  pageMetric,
  productQueue,
  shippingQueue,
  locale,
  onOpenResource,
}: {
  categoryQueue: CatalogTranslationQueue | null;
  collectionQueue: CatalogTranslationQueue | null;
  pageMetric: { needsReview: number; ready: number; total: number; usingEnglish: number };
  productQueue: CatalogTranslationQueue | null;
  shippingQueue: CatalogTranslationQueue | null;
  locale: Exclude<StorefrontLocale, "en">;
  onOpenResource: (target: CatalogTarget) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const items = [
    {
      label: t("editor.translations.shopPages"),
      metric: pageMetric,
      href: `/dashboard/editor?locale=${encodeURIComponent(locale)}`,
      target: null,
    },
    {
      label: t("editor.translations.products"),
      metric: readinessMetric(productQueue),
      href: "/dashboard/products",
      target: queueTarget(productQueue, "product"),
    },
    {
      label: t("editor.translations.categories"),
      metric: readinessMetric(categoryQueue),
      href: "/dashboard/products/categories",
      target: queueTarget(categoryQueue, "category"),
    },
    {
      label: t("editor.translations.collections"),
      metric: readinessMetric(collectionQueue),
      href: "/dashboard/products/collections",
      target: queueTarget(collectionQueue, "collection"),
    },
    {
      label: t("editor.translations.delivery"),
      metric: readinessMetric(shippingQueue),
      href: "/dashboard/settings?tab=fulfillment",
      target: queueTarget(shippingQueue, "shipping"),
    },
  ];
  return (
    <section
      aria-label={t("editor.translations.readinessLabel")}
      className="overflow-hidden rounded-[calc(var(--radius)+0.25rem)] border bg-card"
    >
      <header className="flex items-center gap-1.5 border-b bg-muted/20 px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("editor.translations.coverage")}
        </h2>
        <HelpTip
          label={t("editor.translations.coverageHelpLabel")}
          summary={t("editor.translations.coverageHelpSummary")}
          title={t("editor.translations.coverage")}
        >
          <StatusLegend />
        </HelpTip>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 lg:divide-x">
        {items.map((item) => {
          const content = (
            <>
              <span className="truncate text-sm font-medium group-hover:text-primary">
                {item.label}
              </span>
              <span className="mt-1 text-xs tabular-nums text-muted-foreground">
                {item.metric
                  ? t("editor.translations.resourceReadyCount", {
                      ready: item.metric.ready,
                      total: item.metric.total,
                    })
                  : t("editor.translations.couldNotCheck")}
              </span>
              <span className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                {item.metric?.total ? (
                  <>
                    <span
                      className="bg-primary transition-[width] duration-200"
                      style={{ width: `${(item.metric.ready / item.metric.total) * 100}%` }}
                    />
                    <span
                      className="bg-amber-500/75 transition-[width] duration-200"
                      style={{ width: `${(item.metric.needsReview / item.metric.total) * 100}%` }}
                    />
                    <span
                      className="bg-muted-foreground/25 transition-[width] duration-200"
                      style={{ width: `${(item.metric.usingEnglish / item.metric.total) * 100}%` }}
                    />
                  </>
                ) : null}
              </span>
              {item.metric?.total ? (
                <span className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                    {item.metric.ready}
                  </span>
                  {item.metric.needsReview ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                      {item.metric.needsReview}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
                    {item.metric.usingEnglish}
                  </span>
                </span>
              ) : null}
            </>
          );
          const className =
            "group flex min-h-24 min-w-0 flex-col justify-center border-b px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0";
          return item.target ? (
            <button
              className={className}
              key={item.label}
              onClick={() => item.target && void onOpenResource(item.target)}
              type="button"
            >
              {content}
            </button>
          ) : (
            <Link className={className} href={item.href} key={item.label}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function queueTarget(
  queue: CatalogTranslationQueue | null,
  kind: CatalogTarget["kind"],
): CatalogTarget | null {
  const item = queue?.items.find((candidate) => candidate.status !== "ready") ?? queue?.items.at(0);
  return item ? { item, kind } : null;
}

function StatusLegend() {
  const { t } = useI18n();
  return (
    <div className="space-y-2.5">
      {(
        [
          ["ready", "bg-primary"],
          ["needsReview", "bg-amber-500"],
          ["usingEnglish", "bg-muted-foreground/40"],
        ] as const
      ).map(([status, color]) => (
        <div className="flex items-start gap-2.5" key={status}>
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", color)} aria-hidden />
          <span>
            <strong className="block font-medium text-foreground">
              {t(`editor.translations.${status}`)}
            </strong>
            <span>{t(`editor.translations.${status}Description`)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function readinessMetric(queue: CatalogTranslationQueue | null) {
  return queue
    ? {
        ready: queue.ready,
        needsReview: queue.needsReview,
        usingEnglish: queue.usingEnglish,
        total: queueTotal(queue),
      }
    : null;
}

function queueTotal(queue: CatalogTranslationQueue) {
  return queue.ready + queue.needsReview + queue.usingEnglish;
}

function StatusBadge({ status }: { status: CatalogTranslationStatus }) {
  const { t } = useI18n();
  const key =
    status === "ready" ? "ready" : status === "needs_review" ? "needsReview" : "usingEnglish";
  return (
    <Badge
      className={cn(
        status === "ready" &&
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        status === "needs_review" &&
          "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
      variant="outline"
    >
      {t(`editor.translations.${key}`)}
    </Badge>
  );
}
