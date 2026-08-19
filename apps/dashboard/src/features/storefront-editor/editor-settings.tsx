"use client";

import {
  getStorefrontEditorManifest,
  type StorefrontEditorField,
} from "@ecs/storefront-templates";
import { RiArrowDownSLine, RiExpandUpDownLine, RiImageLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
  SETTINGS_SECTION_LABELS,
  useStorefrontEditor,
} from "@/features/storefront-editor/editor-config";
import { MediaLibraryDialog } from "@/features/media/media-library-dialog";
import { MediaUrlImportField } from "@/features/media/media-url-import-field";
import { uploadMediaFile } from "@/features/media/upload-media-file";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

import {
  StorefrontCollectionPicker,
  StorefrontCollectionsPicker,
  StorefrontProductsPicker,
} from "./editor-merchandising";
import { StorefrontLinksEditor } from "./editor-links";
import {
  getStorefrontPageProps,
  isPreviewImageUrl,
  type EditorAction,
  type EditorData,
  type StorefrontPageProps,
} from "./editor-state";
import { ThemeBrandSection, FontSelect, PremiumColorPicker } from "./editor-theme";
import { updateStorefrontProp } from "./editor-utils";

export function StorefrontSettingsPanel({ onSelectPath, selectedPath, templateKey }: { onSelectPath: (path: string | null) => void; selectedPath: string | null; templateKey: string }) {
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

  const scrollSettingsPathIntoView = (path: string) => {
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
  };

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
    if (!selectedPath) return;
    scrollSettingsPathIntoView(selectedPath);
    // The scroll target is intentionally derived from the selected path only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath]);

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
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" ref={scrollRef}>
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
                  ? SETTINGS_SECTION_LABELS[activeSection.id] ?? activeSection.label
                  : "Jump to a section"}
              </span>
              <RiArrowDownSLine className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0" sideOffset={6}>
            <Command shouldFilter>
              <CommandInput placeholder="Search sections…" size="panel" />
              <CommandList className="max-h-72 px-1.5 pb-1.5">
                <CommandEmpty>No matching section.</CommandEmpty>
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
        <Button
          className="h-9 w-[7.75rem] shrink-0 gap-1.5 px-3 text-xs"
          onClick={toggleAllSections}
          type="button"
          variant="ghost"
        >
          <RiExpandUpDownLine aria-hidden className="size-3.5 shrink-0" />
          {allSectionsExpanded
            ? t("editor.settings.collapseAll")
            : t("editor.settings.expandAll")}
        </Button>
      </div>
      <div className="flex flex-col gap-3 p-3 pb-10 sm:p-4">
        {manifest.sections.map((section) => {
          if (section.id === "theme") {
            return (
              <div
                className={cn(
                  "rounded-2xl transition-shadow",
                  selectedPath === sectionSettingsPath(section)
                    && "ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
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

          const sectionOpen = openSections.has(section.id) || sectionContainsPath(section, selectedPath);

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
                "min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)] transition-opacity",
                !sectionVisible && "opacity-70",
                selectedPath === sectionPath && "ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
              )}
              data-editor-settings-path={sectionPath}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/80 bg-muted/10 px-4 py-3">
                <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => onSelectPath(sectionPath)} type="button">
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
                {bodyFields.length > 0 ? <CollapsibleTrigger asChild>
                  <Button aria-label={`${sectionOpen ? "Collapse" : "Expand"} ${section.label}`} size="icon-sm" type="button" variant="ghost">
                    <RiArrowDownSLine className={cn("size-4 transition-transform", sectionOpen && "rotate-180")} aria-hidden />
                  </Button>
                </CollapsibleTrigger> : null}
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
                  {bodyFields.map((field) => {
                    const value = (props as Record<string, unknown>)[field.prop];
                    const helpText = "helpText" in field ? field.helpText : undefined;

                    const showHelp = Boolean(helpText) && field.kind !== "products";

                    return (
                      <Field className={cn("-ml-3 min-w-0 gap-2.5 border-l-2 border-transparent py-1 pl-3 transition-[border-color,background-color] duration-150", (selectedPath === field.path || selectedPath?.startsWith(`${field.path}.`)) && "border-primary/60 bg-primary/[0.035]")} data-editor-settings-path={field.path} key={field.path} onClickCapture={() => onSelectPath(field.path)} onFocusCapture={(event) => onSelectPath((event.target as Element).closest<HTMLElement>("[data-editor-settings-path]")?.dataset.editorSettingsPath ?? field.path)}>
                        {field.kind === "boolean" ? null : (
                          <FieldLabel className="text-sm font-medium" htmlFor={nativeControlId(field)}>{field.label}</FieldLabel>
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
  return path === sectionPath
    || path.startsWith(`${sectionPath}.`)
    || section.fields.some((field) => path === field.path || path.startsWith(`${field.path}.`));
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
      <StorefrontCollectionPicker
        onChange={(id) => update(id || undefined)}
        value={stringValue}
      />
    );
  }

  if (field.kind === "products") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    return <StorefrontProductsPicker onChange={(next) => update(next)} value={ids} />;
  }

  if (field.kind === "collections") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    return <StorefrontCollectionsPicker onChange={(next) => update(next)} value={ids} />;
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
    return <StorefrontLinksEditor label={field.label} onChange={update} path={field.path} value={value} />;
  }

  if (field.kind === "color") {
    return (
      <PremiumColorPicker
        label={field.label}
        onChange={(next) => update(next)}
        value={stringValue || "#000000"}
      />
    );
  }

  if (field.path.includes("typography.")) {
    return <FontSelect onChange={(nextValue) => update(nextValue)} value={stringValue || "Inter"} />;
  }

  if (field.kind === "image") {
    return (
      <ImageReferenceControl
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

export function ImageReferenceControl({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string | undefined) => void;
  value: string;
}) {
  const { t } = useI18n();
  const imageUrl = isPreviewImageUrl(value) ? value : "";

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full object-cover" src={imageUrl} />
          ) : (
            <RiImageLine aria-hidden className="text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-pretty text-muted-foreground">
            {value ? t("editor.media.referenceSet") : t("editor.media.uploadOrChoose")}
          </div>
        </div>
        {value ? (
          <Button
            className="shrink-0"
            onClick={() => onChange(undefined)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("editor.media.clear")}
          </Button>
        ) : null}
      </div>
      <EditorImageSourceActions onPicked={onChange} />
    </div>
  );
}

export function EditorImageSourceActions({
  onPicked,
  onPickerOpenChange,
}: {
  onPicked: (url: string | undefined) => void;
  onPickerOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMediaFile(file);
      onPicked(url);
      toast.success(t("editor.toast.imageUploaded"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "upload_failed";
      toast.error(
        code === "invalid_type"
          ? t("editor.toast.unsupportedImage")
          : code === "too_large"
            ? t("editor.toast.imageTooLarge")
            : t("editor.toast.imageUploadFailed"),
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => void handleFiles(event.target.files)}
          ref={inputRef}
          type="file"
        />
        <Button
          className="w-full min-w-0 justify-center sm:w-auto"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <RiImageLine data-icon="inline-start" />
          {uploading ? t("editor.media.uploading") : t("editor.media.uploadImage")}
        </Button>
        <MediaLibraryDialog
          onOpenChange={onPickerOpenChange}
          onSelect={(assets) => {
            const url = assets[0]?.publicUrl?.trim();
            if (url) onPicked(url);
          }}
          selectionMode="single"
          triggerClassName="w-full min-w-0 sm:w-auto"
          triggerLabel={t("editor.media.chooseLibrary")}
          triggerSize="sm"
          triggerVariant="outline"
        />
      </div>
      <MediaUrlImportField
        className="min-w-0"
        disabled={uploading}
        onImported={(file) => {
          void (async () => {
            try {
              const publicUrl = await uploadMediaFile(file);
              onPicked(publicUrl);
              toast.success(t("editor.toast.imageImported"));
            } catch {
              toast.error(t("editor.toast.imageImportFailed"));
            }
          })();
        }}
        size="sm"
      />
    </div>
  );
}
