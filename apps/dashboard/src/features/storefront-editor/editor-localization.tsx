"use client";

import {
  getStorefrontLocalizationManifest,
  getStorefrontTemplateTranslationDefaults,
} from "@ecs/storefront-templates";
import { RiArrowDownSLine, RiSettings4Line, RiTranslate2 } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "@/components/app/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { useStorefrontEditor } from "./editor-config";
import {
  getLocalizedInitialTranslations,
  getLocalizedStatuses,
  getLocalizedStatusOverrides,
  getLocalizedTranslations,
  getStorefrontPageProps,
  markLocalizedTranslationReviewed,
  updateLocalizedTranslation,
} from "./editor-state";
import { SectionNavigator } from "./section-navigator";
import { TranslationSourceReference } from "./translation-source-reference";

type LocalizedEditorField = {
  defaultTranslation?: string;
  label: string;
  path: string;
  sectionId: string;
  sectionLabel: string;
  source: string;
};

export function StorefrontLocalizationPanel({
  enabled,
  onSelectPath,
  selectedPath,
  templateKey,
}: {
  enabled: boolean;
  onSelectPath: (path: string | null) => void;
  selectedPath: string | null;
  templateKey: string;
}) {
  const { t } = useI18n();
  const data = useStorefrontEditor((api) => api.appState.data);
  const dispatch = useStorefrontEditor((api) => api.dispatch);
  const props = getStorefrontPageProps(data);
  const translations = getLocalizedTranslations(data);
  const initialTranslations = getLocalizedInitialTranslations(data);
  const initialStatuses = getLocalizedStatuses(data);
  const statusOverrides = getLocalizedStatusOverrides(data);
  const [unfinishedOnly, setUnfinishedOnly] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fields = useMemo(
    () => getEditableTranslationFields(templateKey, props),
    [props, templateKey],
  );
  const [sourceBaseline] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.path, field.source])),
  );
  const statusFor = (field: LocalizedEditorField) => {
    const storedValue = translations[field.path]?.trim();
    const value = (storedValue ?? field.defaultTranslation)?.trim();
    if (!value) return "using_english" as const;
    if (!storedValue && field.defaultTranslation) return "ready" as const;
    if (statusOverrides[field.path] === "ready") return "ready" as const;
    if (translations[field.path] !== initialTranslations[field.path]) return "ready" as const;
    if (sourceBaseline[field.path] !== field.source) return "needs_review" as const;
    return initialStatuses[field.path] ?? "ready";
  };
  const visibleFields = unfinishedOnly
    ? fields.filter((field) => statusFor(field) !== "ready")
    : fields;
  const ready = fields.filter((field) => statusFor(field) === "ready").length;
  const sections = useMemo(() => {
    const result = new Map<string, { id: string; label: string; fields: LocalizedEditorField[] }>();
    for (const field of visibleFields) {
      const group = result.get(field.sectionId) ?? {
        id: field.sectionId,
        label: field.sectionLabel,
        fields: [],
      };
      group.fields.push(field);
      result.set(field.sectionId, group);
    }
    return [...result.values()];
  }, [visibleFields]);
  const activeSectionId = sections.find((section) =>
    section.fields.some((field) => field.path === selectedPath),
  )?.id;
  const allSectionsExpanded = sections.every((section) => !collapsedSections.has(section.id));

  const scrollFieldIntoView = useCallback((path: string) => {
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      const candidate = Array.from(
        scroller?.querySelectorAll<HTMLElement>("[data-editor-settings-path]") ?? [],
      ).find((element) => element.dataset.editorSettingsPath === path);
      if (!candidate || !scroller) return;
      const candidateBounds = candidate.getBoundingClientRect();
      const scrollerBounds = scroller.getBoundingClientRect();
      scroller.scrollTo({
        behavior: "smooth",
        top: Math.max(0, scroller.scrollTop + candidateBounds.top - scrollerBounds.top - 152),
      });
    });
  }, []);

  useEffect(() => {
    if (!selectedPath || !activeSectionId) return;
    setCollapsedSections((current) => {
      if (!current.has(activeSectionId)) return current;
      const next = new Set(current);
      next.delete(activeSectionId);
      return next;
    });
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => scrollFieldIntoView(selectedPath)),
    );
    return () => cancelAnimationFrame(frame);
  }, [activeSectionId, scrollFieldIntoView, selectedPath]);

  function jumpToSection(sectionId: string) {
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
      allSectionsExpanded ? new Set(sections.map((section) => section.id)) : new Set(),
    );
    if (allSectionsExpanded) onSelectPath(null);
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto" ref={scrollRef}>
      <div className="sticky top-0 z-10 border-b border-border/80 bg-background/95 p-3 backdrop-blur-sm sm:px-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <RiTranslate2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("editor.translations.title")}</p>
            <p className="text-xs text-muted-foreground">
              {t("editor.translations.progress", { ready, total: fields.length })}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild size="icon-sm" variant="ghost">
                <Link href="/dashboard/settings?section=storefront">
                  <RiSettings4Line />
                  <span className="sr-only">{t("editor.translations.openSettings")}</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("editor.translations.openSettings")}</TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${fields.length ? (ready / fields.length) * 100 : 0}%` }}
          />
        </div>
        {!enabled ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium">{t("editor.translations.disabledTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("editor.translations.disabledDescription")}
              </p>
            </div>
            <Button asChild className="shrink-0" size="sm" variant="outline">
              <Link href="/dashboard/settings?section=storefront">
                {t("editor.translations.openSettings")}
              </Link>
            </Button>
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <Button
            aria-pressed={unfinishedOnly}
            className="shrink-0"
            onClick={() => setUnfinishedOnly((current) => !current)}
            size="sm"
            type="button"
            variant={unfinishedOnly ? "secondary" : "ghost"}
          >
            {t("editor.translations.unfinished")}
          </Button>
          {sections.length > 1 ? (
            <SectionNavigator
              activeId={activeSectionId}
              allExpanded={allSectionsExpanded}
              className="min-w-0 flex-1"
              collapseAllLabel={t("editor.settings.collapseAll")}
              emptyLabel={t("editor.settings.noMatchingSection")}
              expandAllLabel={t("editor.settings.expandAll")}
              jumpLabel={t("editor.settings.jumpToSection")}
              onSelect={jumpToSection}
              onToggleAll={toggleAllSections}
              searchLabel={t("editor.settings.searchSections")}
              sections={sections}
            />
          ) : null}
        </div>
      </div>

      <div className="space-y-3 p-3 pb-10 sm:p-4">
        {sections.map((section) => (
          <Collapsible
            className="scroll-mt-40 overflow-hidden rounded-xl border bg-card"
            key={section.id}
            onOpenChange={(open) =>
              setCollapsedSections((current) => {
                const next = new Set(current);
                if (open) next.delete(section.id);
                else next.add(section.id);
                return next;
              })
            }
            open={!collapsedSections.has(section.id)}
          >
            <section
              ref={(node) => {
                if (node) sectionRefs.current.set(section.id, node);
                else sectionRefs.current.delete(section.id);
              }}
            >
              <CollapsibleTrigger asChild>
                <button
                  className="group flex w-full items-center gap-3 bg-muted/10 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                  type="button"
                >
                  <RiArrowDownSLine className="size-4 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
                  <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{section.label}</h2>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {
                      section.fields.filter(
                        (field) =>
                          translations[field.path]?.trim() || field.defaultTranslation?.trim(),
                      ).length
                    }
                    /{section.fields.length}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex min-w-0 flex-col gap-2 py-3 border-t border-border/80">
                  {section.fields.map((field) => {
                    const value = translations[field.path] ?? field.defaultTranslation ?? "";
                    const selected = selectedPath === field.path;
                    const status = statusFor(field);
                    return (
                      <div
                        className={cn(
                          "flex min-w-0 flex-col gap-2.5 px-4 py-2.5 transition-[background-color,box-shadow]",
                          selected &&
                            "bg-primary/[0.07] ring-2 ring-inset ring-primary/25 shadow-sm",
                        )}
                        data-editor-settings-path={field.path}
                        key={field.path}
                        onClickCapture={() => onSelectPath(field.path)}
                        onFocusCapture={() => onSelectPath(field.path)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label
                            className="text-sm font-medium"
                            htmlFor={`translation-${field.path}`}
                          >
                            {field.label}
                          </label>
                          <Badge variant="outline">
                            {status === "ready"
                              ? t("editor.translations.ready")
                              : status === "needs_review"
                                ? t("editor.translations.needsReview")
                                : t("editor.translations.usingEnglish")}
                          </Badge>
                        </div>
                        <TranslationSourceReference label={t("editor.translations.sourceLabel")}>
                          {field.source}
                        </TranslationSourceReference>
                        <Textarea
                          id={`translation-${field.path}`}
                          className="min-h-20 resize-y"
                          onChange={(event) =>
                            dispatch({
                              type: "setData",
                              data: updateLocalizedTranslation(
                                data,
                                field.path,
                                event.target.value,
                              ),
                            })
                          }
                          onFocus={() => onSelectPath(field.path)}
                          placeholder={t("editor.translations.usingEnglish")}
                          value={value}
                        />
                        {status === "needs_review" ? (
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {t("editor.translations.sourceChanged")}
                            </p>
                            <Button
                              className="shrink-0"
                              onClick={() =>
                                dispatch({
                                  type: "setData",
                                  data: markLocalizedTranslationReviewed(data, field.path),
                                })
                              }
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {t("editor.translations.markReviewed")}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>
        ))}
        {!sections.length ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("editor.translations.empty")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function getEditableTranslationFields(
  templateKey: string,
  props: ReturnType<typeof getStorefrontPageProps>,
) {
  const manifest = getStorefrontLocalizationManifest(templateKey);
  const defaults = getStorefrontTemplateTranslationDefaults(templateKey, "am");
  const fields: LocalizedEditorField[] = [];
  for (const field of manifest?.fields ?? []) {
    if (field.localization !== "localized") continue;
    if (field.kind === "text" || field.kind === "textarea") {
      const source = props[field.prop];
      if (typeof source === "string" && source.trim()) {
        const fallback = defaults[field.path];
        fields.push({
          ...(fallback?.source === source ? { defaultTranslation: fallback.value } : {}),
          label: field.label,
          path: field.path,
          sectionId: field.sectionId,
          sectionLabel: field.sectionLabel,
          source,
        });
      }
    }
    if (field.kind === "links") {
      const links = props[field.prop];
      if (!Array.isArray(links)) continue;
      links.forEach((link, index) => {
        const label = link && typeof link === "object" ? (link as { label?: unknown }).label : null;
        if (typeof label !== "string" || !label.trim()) return;
        const path = `${field.path}.${index}.label`;
        const fallback = defaults[path];
        fields.push({
          ...(fallback?.source === label ? { defaultTranslation: fallback.value } : {}),
          label: `${field.label} ${index + 1}`,
          path,
          sectionId: field.sectionId,
          sectionLabel: field.sectionLabel,
          source: label,
        });
      });
    }
  }
  return fields;
}

export function getEffectiveLocalizedTranslations(
  templateKey: string,
  props: ReturnType<typeof getStorefrontPageProps>,
  translations: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    getEditableTranslationFields(templateKey, props)
      .map((field) => [field.path, translations[field.path] ?? field.defaultTranslation ?? ""])
      .filter(([, value]) => value),
  ) as Record<string, string>;
}
