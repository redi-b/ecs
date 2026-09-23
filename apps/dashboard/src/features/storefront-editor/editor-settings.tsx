"use client";

import { getStorefrontEditorManifest, type StorefrontEditorField } from "@ecs/storefront-templates";
import { RiArrowDownSLine, RiExpandUpDownLine, RiSettings4Line } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";

import Link from "@/components/app/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MediaImageReferenceControl,
  MediaImageSourceActions,
} from "@/features/media/media-image-reference-control";
import {
  SETTINGS_SECTION_LABELS,
  useStorefrontEditor,
} from "@/features/storefront-editor/editor-config";
import { useI18n } from "@/i18n/provider";
import { isShopManagedStorefrontPath } from "@/lib/storefront-managed-fields";
import { cn } from "@/lib/utils";
import { StorefrontLinksEditor } from "./editor-links";
import {
  StorefrontCollectionPicker,
  StorefrontCollectionsPicker,
  StorefrontProductsPicker,
} from "./editor-merchandising";
import {
  type EditorAction,
  type EditorData,
  getStorefrontPageProps,
  type StorefrontPageProps,
} from "./editor-state";
import { ColorPickerField, FontSelect, ThemeBrandSection } from "./editor-theme";
import { updateStorefrontProp } from "./editor-utils";

export {
  MediaImageReferenceControl as ImageReferenceControl,
  MediaImageSourceActions as EditorImageSourceActions,
};

export function StorefrontSettingsPanel({
  onSelectPath,
  selectedPath,
  templateKey,
}: {
  onSelectPath: (path: string | null) => void;
  selectedPath: string | null;
  templateKey: string;
}) {
  const { t } = useI18n();
  const data = useStorefrontEditor((api) => api.appState.data);
  const dispatch = useStorefrontEditor((api) => api.dispatch);
  const props = getStorefrontPageProps(data);
  const manifest = getStorefrontEditorManifest(templateKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["header", "hero", "theme"]),
  );
  const [sectionNavigatorOpen, setSectionNavigatorOpen] = useState(false);
  const activeSection = manifest?.sections.find((section) =>
    sectionContainsPath(section, selectedPath),
  );

  const scrollSettingsPathIntoView = useCallback((path: string) => {
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      const candidate = Array.from(
        scroller?.querySelectorAll<HTMLElement>("[data-editor-settings-path]") ?? [],
      ).find((element) => element.dataset.editorSettingsPath === path);
      if (!candidate || !scroller) return;
      const candidateBounds = candidate.getBoundingClientRect();
      const scrollerBounds = scroller.getBoundingClientRect();
      const candidateTop = scroller.scrollTop + candidateBounds.top - scrollerBounds.top;
      scroller.scrollTo({
        behavior: "smooth",
        top: Math.max(0, candidateTop - 64),
      });
    });
  }, []);

  useEffect(() => {
    if (!activeSection) return;
    setOpenSections((current) => {
      if (current.has(activeSection.id)) return current;
      const next = new Set(current);
      next.add(activeSection.id);
      return next;
    });
  }, [activeSection]);

  useEffect(() => {
    if (!selectedPath || !activeSection || !openSections.has(activeSection.id)) return;
    const frame = requestAnimationFrame(() => scrollSettingsPathIntoView(selectedPath));
    return () => cancelAnimationFrame(frame);
  }, [activeSection, openSections, scrollSettingsPathIntoView, selectedPath]);

  if (!manifest) {
    return null;
  }

  const selectSection = (sectionId: string) => {
    const section = manifest.sections.find((candidate) => candidate.id === sectionId);
    if (!section) return;
    setOpenSections((current) => new Set(current).add(section.id));
    const path = sectionSettingsPath(section);
    onSelectPath(path);
    scrollSettingsPathIntoView(path);
    setSectionNavigatorOpen(false);
  };

  const collapsibleSectionIds = manifest.sections
    .filter((section) => section.id === "theme" || sectionHasCollapsibleBody(section))
    .map((section) => section.id);
  const allSectionsExpanded = collapsibleSectionIds.every((id) => openSections.has(id));

  const toggleAllSections = () => {
    if (allSectionsExpanded) {
      setOpenSections(new Set());
      onSelectPath(null);
      return;
    }
    setOpenSections(new Set(collapsibleSectionIds));
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto" ref={scrollRef}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/80 bg-background/95 p-3 backdrop-blur-sm sm:px-4">
        <Popover onOpenChange={setSectionNavigatorOpen} open={sectionNavigatorOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-expanded={sectionNavigatorOpen}
              className="h-9 min-w-0 flex-1 justify-between px-3 font-normal"
              type="button"
              variant="outline"
            >
              <span className={cn("truncate", !activeSection && "text-muted-foreground")}>
                {activeSection
                  ? (SETTINGS_SECTION_LABELS[activeSection.id] ?? activeSection.label)
                  : t("editor.settings.jumpToSection")}
              </span>
              <RiArrowDownSLine className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
            sideOffset={6}
          >
            <Command shouldFilter>
              <CommandInput placeholder={t("editor.settings.searchSections")} size="panel" />
              <CommandList className="max-h-72 px-1.5 pb-1.5">
                <CommandEmpty>{t("editor.settings.noMatchingSection")}</CommandEmpty>
                <CommandGroup className="p-0">
                  {manifest.sections.map((section) => (
                    <CommandItem
                      data-checked={activeSection?.id === section.id ? true : undefined}
                      key={section.id}
                      onSelect={() => selectSection(section.id)}
                      value={`${section.label} ${section.id}`}
                    >
                      {SETTINGS_SECTION_LABELS[section.id] ?? section.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={
                allSectionsExpanded
                  ? t("editor.settings.collapseAll")
                  : t("editor.settings.expandAll")
              }
              className="size-9 shrink-0"
              onClick={toggleAllSections}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <RiExpandUpDownLine aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {allSectionsExpanded
              ? t("editor.settings.collapseAll")
              : t("editor.settings.expandAll")}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild size="icon-sm" variant="ghost">
              <Link href="/dashboard/settings?tab=storefront">
                <RiSettings4Line />
                <span className="sr-only">{t("editor.translations.openSettings")}</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("editor.translations.openSettings")}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-2.5 p-3 pb-10 sm:p-4">
        {manifest.sections.map((section) => {
          if (section.id === "theme") {
            return (
              <div
                className={cn(
                  "rounded-xl transition-shadow",
                  selectedPath === sectionSettingsPath(section) &&
                    "bg-primary/[0.07] ring-2 ring-primary/30 shadow-sm",
                )}
                data-editor-settings-path={sectionSettingsPath(section)}
                key={section.id}
              >
                <ThemeBrandSection
                  allowDarkMode={manifest.theme?.allowSurfaceMode ?? true}
                  data={data}
                  dispatch={dispatch}
                  editableColors={manifest.theme?.editableColors}
                  onOpenChange={(open) => {
                    setOpenSections((current) => {
                      const next = new Set(current);
                      if (open) next.add(section.id);
                      else next.delete(section.id);
                      return next;
                    });
                    if (!open && activeSection?.id === section.id) onSelectPath(null);
                  }}
                  open={openSections.has(section.id) || activeSection?.id === section.id}
                  props={props}
                  templateKey={templateKey}
                />
              </div>
            );
          }

          const enabledField = section.fields.find(
            (field) => field.kind === "boolean" && field.path.endsWith(".enabled"),
          );
          const bodyFields = section.fields.filter((field) => field !== enabledField);
          const hasShopManagedFields = bodyFields.some((field) =>
            isShopManagedStorefrontPath(field.path),
          );
          const editableBodyFields = bodyFields.filter(
            (field) => !isShopManagedStorefrontPath(field.path),
          );
          const enabledValue = enabledField
            ? (props as Record<string, unknown>)[enabledField.prop]
            : undefined;
          const sectionVisible =
            enabledField == null
              ? true
              : typeof enabledValue === "boolean"
                ? enabledValue
                : enabledValue !== false && enabledValue !== "false";
          const sectionPath = enabledField?.path.replace(/\.enabled$/, "") ?? section.id;

          const sectionOpen =
            openSections.has(section.id) || sectionContainsPath(section, selectedPath);

          return (
            <Collapsible
              key={section.id}
              onOpenChange={(open) => {
                setOpenSections((current) => {
                  const next = new Set(current);
                  if (open) next.add(section.id);
                  else next.delete(section.id);
                  return next;
                });
                if (!open && sectionContainsPath(section, selectedPath)) {
                  onSelectPath(null);
                }
              }}
              open={sectionOpen}
            >
              <section
                className={cn(
                  "min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card transition-opacity",
                  !sectionVisible && "opacity-70",
                  selectedPath === sectionPath &&
                    "border-primary/35 bg-primary/[0.07] ring-2 ring-primary/25 shadow-sm",
                )}
                data-editor-settings-path={sectionPath}
              >
                <div className="flex items-center justify-between gap-3 border-b border-border/80 bg-muted/10 px-4 py-3">
                  <button
                    className="flex min-w-0 items-center gap-2 text-left"
                    onClick={() => onSelectPath(sectionPath)}
                    type="button"
                  >
                    <div className="truncate text-sm font-medium tracking-tight">
                      {SETTINGS_SECTION_LABELS[section.id] ?? section.label}
                    </div>
                    {enabledField && !sectionVisible ? (
                      <Badge className="shrink-0 font-normal" variant="secondary">
                        {t("editor.settings.sectionHidden")}
                      </Badge>
                    ) : null}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {enabledField ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex shrink-0 items-center">
                            <Switch
                              aria-label={enabledField.label}
                              checked={sectionVisible}
                              id={enabledField.prop}
                              onCheckedChange={(next) =>
                                updateStorefrontProp(
                                  data,
                                  dispatch,
                                  enabledField.prop as keyof StorefrontPageProps,
                                  next,
                                )
                              }
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {sectionVisible
                            ? t("editor.settings.sectionVisibleTooltip")
                            : t("editor.settings.sectionHiddenTooltip")}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                    {bodyFields.length > 0 ? (
                      <CollapsibleTrigger asChild>
                        <Button
                          aria-label={`${sectionOpen ? "Collapse" : "Expand"} ${section.label}`}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <RiArrowDownSLine
                            className={cn(
                              "size-4 transition-transform",
                              sectionOpen && "rotate-180",
                            )}
                            aria-hidden
                          />
                        </Button>
                      </CollapsibleTrigger>
                    ) : null}
                  </div>
                </div>
                {bodyFields.length > 0 ? (
                  <CollapsibleContent>
                    <div
                      className={cn(
                        "flex min-w-0 flex-col gap-5 p-4",
                        enabledField && !sectionVisible && "pointer-events-none opacity-50",
                      )}
                    >
                      {hasShopManagedFields ? (
                        <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                          <p className="text-muted-foreground">
                            {t("editor.settings.sharedContactHelp")}
                          </p>
                          <Button asChild className="mt-2" size="sm" variant="outline">
                            <Link href="/dashboard/settings?tab=shop">
                              {t("editor.settings.shopSettings")}
                            </Link>
                          </Button>
                        </div>
                      ) : null}
                      {editableBodyFields.map((field) => {
                        const value = (props as Record<string, unknown>)[field.prop];
                        const helpText = "helpText" in field ? field.helpText : undefined;

                        const showHelp = Boolean(helpText) && field.kind !== "products";

                        return (
                          <Field
                            className={cn(
                              "min-w-0 gap-2.5 rounded-xl px-3 py-2 transition-[background-color,box-shadow] duration-150",
                              (selectedPath === field.path ||
                                selectedPath?.startsWith(`${field.path}.`)) &&
                                "bg-primary/[0.07] ring-2 ring-primary/25 shadow-sm",
                            )}
                            data-editor-settings-path={field.path}
                            key={field.path}
                            onClickCapture={() => onSelectPath(field.path)}
                            onFocusCapture={(event) =>
                              onSelectPath(
                                (event.target as Element).closest<HTMLElement>(
                                  "[data-editor-settings-path]",
                                )?.dataset.editorSettingsPath ?? field.path,
                              )
                            }
                          >
                            {field.kind === "boolean" ? null : (
                              <FieldLabel
                                className="text-sm font-medium"
                                htmlFor={nativeControlId(field)}
                              >
                                {field.label}
                              </FieldLabel>
                            )}
                            <div className="min-w-0">
                              <StorefrontSettingControl
                                data={data}
                                dispatch={dispatch}
                                field={field}
                                value={value}
                              />
                            </div>
                            {showHelp ? (
                              <FieldDescription className="text-pretty leading-relaxed">
                                {helpText}
                              </FieldDescription>
                            ) : null}
                          </Field>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                ) : null}
              </section>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

function sectionSettingsPath(section: { id: string; fields: StorefrontEditorField[] }) {
  if (section.id === "theme") return "themeTokens";
  const enabledPath = section.fields.find(
    (field) => field.kind === "boolean" && field.path.endsWith(".enabled"),
  )?.path;
  return enabledPath?.replace(/\.enabled$/, "") ?? section.id;
}

function sectionHasCollapsibleBody(section: { fields: StorefrontEditorField[] }) {
  return section.fields.some(
    (field) => !(field.kind === "boolean" && field.path.endsWith(".enabled")),
  );
}

function sectionContainsPath(
  section: { id: string; fields: StorefrontEditorField[] },
  path: string | null,
) {
  if (!path) return false;
  const sectionPath = sectionSettingsPath(section);
  return (
    path === sectionPath ||
    path.startsWith(`${sectionPath}.`) ||
    section.fields.some((field) => path === field.path || path.startsWith(`${field.path}.`))
  );
}

export function StorefrontSettingControl({
  data,
  dispatch,
  field,
  value,
}: {
  data: EditorData;
  dispatch: (action: EditorAction) => void;
  field: StorefrontEditorField;
  value: unknown;
}) {
  const update = (nextValue: unknown) =>
    updateStorefrontProp(data, dispatch, field.prop as keyof StorefrontPageProps, nextValue);

  const stringValue = typeof value === "string" ? value : "";
  const controlId = nativeControlId(field);

  if (field.kind === "boolean") {
    const checked = typeof value === "boolean" ? value : value !== false && value !== "false";
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
        <FieldLabel className="text-sm font-medium" htmlFor={field.prop}>
          {field.label}
        </FieldLabel>
        <Switch checked={checked} id={field.prop} onCheckedChange={(next) => update(next)} />
      </div>
    );
  }

  if (field.kind === "collection") {
    return (
      <StorefrontCollectionPicker onChange={(id) => update(id || undefined)} value={stringValue} />
    );
  }

  if (field.kind === "products") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    return (
      <StorefrontProductsPicker
        maxSelection={field.maxItems}
        onChange={(next) => update(next)}
        value={ids}
      />
    );
  }

  if (field.kind === "collections") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    return (
      <StorefrontCollectionsPicker
        maxSelection={field.maxItems}
        onChange={(next) => update(next)}
        value={ids}
      />
    );
  }

  if (field.kind === "product") {
    return (
      <StorefrontProductsPicker
        onChange={(next) => update(next[0] || undefined)}
        value={stringValue ? [stringValue] : []}
      />
    );
  }

  if (field.kind === "links") {
    return (
      <StorefrontLinksEditor
        label={field.label}
        onChange={update}
        path={field.path}
        value={value}
      />
    );
  }

  if (field.kind === "color") {
    return (
      <ColorPickerField
        label={field.label}
        onChange={(next) => update(next)}
        value={stringValue || "#000000"}
      />
    );
  }

  if (field.path.includes("typography.")) {
    return (
      <FontSelect onChange={(nextValue) => update(nextValue)} value={stringValue || "Inter"} />
    );
  }

  if (field.kind === "image") {
    return (
      <MediaImageReferenceControl
        label={field.label}
        onChange={(next) => update(next)}
        value={stringValue}
      />
    );
  }

  if (field.kind === "textarea") {
    return (
      <Textarea
        aria-label={field.label}
        className="min-h-24 w-full min-w-0"
        id={controlId}
        name={field.prop}
        onChange={(event) => update(event.currentTarget.value)}
        value={stringValue}
      />
    );
  }

  return (
    <Input
      aria-label={field.label}
      className="w-full min-w-0"
      id={controlId}
      name={field.prop}
      onChange={(event) => update(event.currentTarget.value)}
      placeholder={field.kind === "link" ? "/" : undefined}
      value={stringValue}
    />
  );
}

function nativeControlId(field: StorefrontEditorField) {
  return field.kind === "text" || field.kind === "textarea" || field.kind === "link"
    ? `storefront-setting-${field.prop}`
    : undefined;
}
