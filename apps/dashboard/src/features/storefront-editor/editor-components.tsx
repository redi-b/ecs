"use client";

import "@puckeditor/core/puck.css";

import { classicV1EditorSchema as classicV1EditorManifest } from "@ecs/storefront-templates";
import type { Config, Data, PuckAction } from "@puckeditor/core";
import { createUsePuck, FieldLabel as PuckFieldLabel, Puck } from "@puckeditor/core";
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiCheckLine,
  RiEditLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFullscreenExitLine,
  RiFullscreenLine,
  RiImageLine,
  RiRefreshLine,
  RiRocketLine,
  RiSave3Line,
} from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ProductCatalogPickerDialog,
  ProductCatalogPickerTrigger,
} from "@/features/products/product-catalog-picker-dialog";
import type {
  ActionResult,
  StorefrontVisualEditorProps,
} from "@/features/storefront-editor/editor-config";
import {
  FONT_OPTIONS,
  HISTORY_COMMIT_DELAY_MS,
  HISTORY_LIMIT,
  POPOVER_MOTION_CLASSNAME,
  SETTINGS_SECTION_LABELS,
  useStorefrontPuck,
} from "@/features/storefront-editor/editor-config";
import { MediaLibraryDialog } from "@/features/media/media-library-dialog";
import { MediaUrlImportField } from "@/features/media/media-url-import-field";
import { uploadMediaFile } from "@/features/media/upload-media-file";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import {
  buildDraftPayload,
  buildPuckData,
  getPublicationStatus,
  getStorefrontPageProps,
  isPreviewImageUrl,
  type PublicationStatus,
  STOREFRONT_PAGE_COMPONENT,
  type StorefrontDraft,
  type StorefrontPageProps,
  serializeEditorData,
} from "./editor-state";

export function PuckDataOverride({ data }: { data: Data | null }) {
  const dispatch = useStorefrontPuck((api) => api.dispatch);
  const appliedRef = useRef<Data | null>(null);

  useEffect(() => {
    if (data && appliedRef.current !== data) {
      appliedRef.current = data;
      dispatch({
        type: "setData",
        data,
      });
    }
  }, [data, dispatch]);

  return null;
}

export function ShopLiveStatusBadge({ live }: { live: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm",
        live
          ? "bg-emerald-600/12 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200"
          : "bg-amber-500/12 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          live ? "bg-emerald-600 dark:bg-emerald-400" : "bg-amber-600 dark:bg-amber-400",
        )}
        aria-hidden
      />
      {live ? t("editor.status.live") : t("editor.status.paused")}
    </span>
  );
}

export function PublicationStatusBadge({ status }: { status: PublicationStatus }) {
  const { t } = useI18n();
  const copy = {
    published: {
      label: t("editor.status.publishedLive"),
      tone: "bg-primary text-primary-foreground",
      dot: "bg-primary-foreground",
    },
    "saved-draft": {
      label: t("editor.status.draftSaved"),
      tone: "bg-muted text-foreground",
      dot: "bg-muted-foreground",
    },
    unsaved: {
      label: t("editor.status.unpublishedEdits"),
      tone: "bg-accent text-accent-foreground",
      dot: "bg-accent-foreground",
    },
  } satisfies Record<PublicationStatus, { dot: string; label: string; tone: string }>;
  const item = copy[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm",
        item.tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", item.dot)} />
      {item.label}
    </span>
  );
}

export function StorefrontEditorActions({
  canRedo,
  canUndo,
  editorMeta,
  isFullscreen,
  isLive,
  isPending,
  onRedo,
  onReset,
  onToggleFullscreen,
  onPublish,
  onUnpublish,
  onSave,
  onToggleEditHints,
  onUndo,
  showEditHints,
}: {
  canRedo: boolean;
  canUndo: boolean;
  editorMeta: StorefrontVisualEditorProps["editorMeta"];
  isFullscreen: boolean;
  isLive: boolean;
  isPending: boolean;
  onRedo: () => void;
  onReset: () => void;
  onToggleFullscreen: () => void;
  onPublish: () => void;
  onUnpublish?: (() => void) | undefined;
  onSave: () => void;
  onToggleEditHints: () => void;
  onUndo: () => void;
  showEditHints: boolean;
}) {
  const { t } = useI18n();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        <ToolbarIconButton
          disabled={hasMounted ? !canUndo : undefined}
          label={t("editor.actions.undo")}
          onClick={onUndo}
        >
          <RiArrowGoBackLine data-icon="inline-start" />
        </ToolbarIconButton>
        <ToolbarIconButton
          disabled={hasMounted ? !canRedo : undefined}
          label={t("editor.actions.redo")}
          onClick={onRedo}
        >
          <RiArrowGoForwardLine data-icon="inline-start" />
        </ToolbarIconButton>
        <Separator className="mx-0.5 hidden h-5 sm:mx-1 sm:block" orientation="vertical" />
        <ToolbarIconButton
          label={showEditHints ? t("editor.actions.hideOutlines") : t("editor.actions.showOutlines")}
          onClick={onToggleEditHints}
          pressed={showEditHints}
        >
          {showEditHints ? (
            <RiEyeLine data-icon="inline-start" />
          ) : (
            <RiEyeOffLine data-icon="inline-start" />
          )}
        </ToolbarIconButton>
        <ToolbarIconButton
          label={isFullscreen ? t("editor.actions.exitFullscreen") : t("editor.actions.fullscreen")}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? (
            <RiFullscreenExitLine data-icon="inline-start" />
          ) : (
            <RiFullscreenLine data-icon="inline-start" />
          )}
        </ToolbarIconButton>
        <ToolbarIconButton asChild label={t("editor.actions.openLive")}>
          <a href={editorMeta.liveStorefrontUrl} rel="noreferrer" target="_blank">
            <RiExternalLinkLine data-icon="inline-start" />
          </a>
        </ToolbarIconButton>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button size="icon-sm" type="button" variant="ghost">
                  <RiRefreshLine />
                  <span className="sr-only">{t("editor.actions.resetEditor")}</span>
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>{t("editor.actions.resetEditor")}</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("editor.actions.resetTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("editor.actions.resetDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={onReset}>{t("editor.actions.resetConfirm")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
        <Button
          className="min-w-0 flex-1 sm:flex-none"
          disabled={isPending}
          onClick={onSave}
          size="sm"
          type="button"
          variant="outline"
        >
          <RiSave3Line data-icon="inline-start" />
          {t("editor.actions.saveDraft")}
        </Button>
        {isLive && onUnpublish ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="min-w-0 flex-1 sm:flex-none"
                disabled={isPending}
                size="sm"
                type="button"
                variant="destructive"
              >
                {t("editor.actions.pauseShop")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("editor.actions.pauseTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("editor.actions.pauseDescription")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    onUnpublish();
                  }}
                  variant="destructive"
                >
                  {t("editor.actions.pauseConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        <Button
          className="min-w-0 flex-1 sm:flex-none"
          disabled={isPending}
          onClick={onPublish}
          size="sm"
          type="button"
        >
          <RiRocketLine data-icon="inline-start" />
          {t("editor.actions.publish")}
        </Button>
      </div>
    </div>
  );
}

export function ToolbarIconButton({
  asChild = false,
  children,
  disabled,
  label,
  onClick,
  pressed,
}: {
  asChild?: boolean;
  children: React.ReactNode;
  disabled?: boolean | undefined;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={pressed}
          asChild={asChild}
          disabled={disabled}
          onClick={onClick}
          size="sm"
          type="button"
          variant="ghost"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

type EditorMobilePanel = "preview" | "settings";

export function StorefrontEditorShell({
  canRedo,
  canUndo,
  editorMeta,
  isFullscreen,
  isLive,
  isPending,
  onRedo,
  onReset,
  onToggleFullscreen,
  onPublish,
  onUnpublish,
  onSave,
  onToggleEditHints,
  onUndo,
  publicationStatus,
  showEditHints,
}: {
  canRedo: boolean;
  canUndo: boolean;
  editorMeta: StorefrontVisualEditorProps["editorMeta"];
  isFullscreen: boolean;
  isLive: boolean;
  isPending: boolean;
  onRedo: () => void;
  onReset: () => void;
  onToggleFullscreen: () => void;
  onPublish: (data: Data) => void;
  onUnpublish?: (() => void) | undefined;
  onSave: (data: Data) => void;
  onToggleEditHints: () => void;
  onUndo: () => void;
  publicationStatus: PublicationStatus;
  showEditHints: boolean;
}) {
  const { t } = useI18n();
  const data = useStorefrontPuck((api) => api.appState.data);
  const props = getStorefrontPageProps(data);
  const [mobilePanel, setMobilePanel] = useState<EditorMobilePanel>("preview");

  return (
    <div className="storefront-editor-chrome flex flex-col rounded-xl border bg-background shadow-sm">
      <div className="flex shrink-0 flex-col gap-3 border-b bg-muted/30 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background shadow-sm sm:size-10">
            <RiEditLine className="text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">{t("editor.shell.title")}</div>
              <Badge variant="secondary">{editorMeta.templateName}</Badge>
              <ShopLiveStatusBadge live={isLive} />
              <PublicationStatusBadge status={publicationStatus} />
            </div>
            <div className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              {isLive ? t("editor.shell.hint") : t("editor.shell.hintPaused")}
            </div>
          </div>
        </div>
        <StorefrontEditorActions
          canRedo={canRedo}
          canUndo={canUndo}
          editorMeta={editorMeta}
          isFullscreen={isFullscreen}
          isLive={isLive}
          isPending={isPending}
          onRedo={onRedo}
          onReset={onReset}
          onToggleFullscreen={onToggleFullscreen}
          onPublish={() => onPublish(data)}
          onUnpublish={onUnpublish}
          onSave={() => onSave(data)}
          onToggleEditHints={onToggleEditHints}
          onUndo={onUndo}
          showEditHints={showEditHints}
        />
      </div>

      {/* Mobile: switch between preview and settings so neither is buried. */}
      <div className="grid shrink-0 grid-cols-2 border-b bg-background p-1 lg:hidden">
        {(
          [
            { id: "preview", label: t("editor.panels.preview") },
            { id: "settings", label: t("editor.panels.settings") },
          ] as const
        ).map((tab) => (
          <button
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              mobilePanel === tab.id
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            key={tab.id}
            onClick={() => setMobilePanel(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/*
        Row height comes from the preview only.
        Settings uses min-h-0 so its content cannot grow the grid row; it scrolls inside.
        Page still scrolls when the pointer is over the preview.
      */}
      <div
        className={cn(
          "grid bg-muted/30 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]",
          isFullscreen && "min-h-[calc(100dvh-7.5rem)]",
        )}
        data-edit-hints={showEditHints ? "on" : "off"}
      >
        <div
          className={cn(
            "p-3 sm:p-5",
            mobilePanel !== "preview" && "max-lg:hidden",
          )}
        >
          <div className="mx-auto max-w-6xl overflow-hidden rounded-xl border bg-background shadow-sm">
            <TemplatePreview
              props={props}
              storefrontName={editorMeta.storefrontName}
              templateKey={editorMeta.templateKey}
            />
          </div>
        </div>
        <aside
          className={cn(
            "flex flex-col overflow-hidden border-t bg-background",
            // Critical: min-h-0 so settings content does not expand the grid row.
            // h-0 + min-h-full = fill the row height set by the preview column.
            "max-lg:max-h-[min(70dvh,40rem)]",
            "lg:h-0 lg:min-h-full lg:border-l lg:border-t-0",
            mobilePanel !== "settings" && "max-lg:hidden",
          )}
        >
          <div className="shrink-0 border-b bg-background px-4 py-3 sm:py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Settings</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Links, images, colors, and fallback content.
                </div>
              </div>
              <Button asChild className="w-full shrink-0 sm:w-auto" size="sm" variant="outline">
                <a href={editorMeta.settingsUrl}>Change template</a>
              </Button>
            </div>
          </div>
          <StorefrontSettingsPanel />
        </aside>
      </div>
    </div>
  );
}

export function StorefrontSettingsPanel() {
  const data = useStorefrontPuck((api) => api.appState.data);
  const dispatch = useStorefrontPuck((api) => api.dispatch);
  const props = getStorefrontPageProps(data);

  // No overscroll-contain: at top/bottom, wheel continues to page scroll (natural chaining).
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-3 p-4 pb-10">
        {classicV1EditorManifest.sections.map((section) => {
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

          return (
            <section
              className={cn(
                "min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm transition-opacity",
                !sectionVisible && "opacity-70",
              )}
              key={section.id}
            >
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-sm font-semibold">
                    {SETTINGS_SECTION_LABELS[section.id] ?? section.label}
                  </div>
                  {enabledField && !sectionVisible ? (
                    <Badge className="shrink-0 font-normal" variant="secondary">
                      Hidden
                    </Badge>
                  ) : null}
                </div>
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
                      {sectionVisible ? "Visible on storefront" : "Hidden on storefront"}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              {bodyFields.length > 0 ? (
                <div
                  className={cn(
                    "flex min-w-0 flex-col gap-4 p-4",
                    enabledField && !sectionVisible && "pointer-events-none opacity-50",
                  )}
                >
                  {bodyFields.map((field) => {
                    const value = (props as Record<string, unknown>)[field.prop];
                    const helpText = "helpText" in field ? field.helpText : undefined;

                    return (
                      <Field className="min-w-0 gap-2" key={field.path}>
                        {field.kind === "boolean" ? null : (
                          <FieldLabel className="text-sm font-medium">{field.label}</FieldLabel>
                        )}
                        <div className="min-w-0">
                          <StorefrontSettingControl
                            data={data}
                            dispatch={dispatch}
                            field={field}
                            value={value}
                          />
                        </div>
                        {helpText ? (
                          <FieldDescription className="text-pretty">{helpText}</FieldDescription>
                        ) : null}
                      </Field>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function StorefrontSettingControl({
  data,
  dispatch,
  field,
  value,
}: {
  data: Data;
  dispatch: (action: PuckAction) => void;
  field: (typeof classicV1EditorManifest.sections)[number]["fields"][number];
  value: unknown;
}) {
  const update = (nextValue: unknown) =>
    updateStorefrontProp(data, dispatch, field.prop as keyof StorefrontPageProps, nextValue);

  const stringValue = typeof value === "string" ? value : "";

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
      name={field.prop}
      onChange={(event) => update(event.currentTarget.value)}
      placeholder={field.kind === "link" ? "/" : undefined}
      value={stringValue}
    />
  );
}

type CatalogOption = {
  handle?: string | null;
  id: string;
  thumbnailUrl?: string | null;
  title: string;
};

function StorefrontCollectionPicker({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<CatalogOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/admin/products/collections/actions/list?limit=100", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        const collections = payload?.data?.collections ?? payload?.collections ?? [];
        if (!Array.isArray(collections)) {
          setOptions([]);
          return;
        }
        setOptions(
          collections
            .map((row: { handle?: string | null; id?: string; title?: string | null }) =>
              row?.id
                ? {
                    id: String(row.id),
                    title: String(row.title ?? row.id),
                    handle: row.handle ?? null,
                  }
                : null,
            )
            .filter(Boolean) as CatalogOption[],
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = options.find((option) => option.id === value);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-9 w-full min-w-0 justify-between px-3 font-normal shadow-none"
          disabled={loading}
          type="button"
          variant="outline"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {loading
              ? "Loading collections…"
              : selected
                ? selected.title
                : "Select a collection"}
          </span>
          <RiEditLine className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(POPOVER_MOTION_CLASSNAME, "w-[min(22rem,calc(100vw-2rem))] p-0")}
        collisionPadding={16}
        onWheel={(event) => event.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Search collections…" />
          <CommandList
            className="max-h-60 overflow-y-auto overscroll-contain"
            onWheel={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No collections found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
                value="none clear"
              >
                None
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  value={`${option.title} ${option.handle ?? ""} ${option.id}`}
                >
                  <span className="min-w-0 flex-1 truncate">{option.title}</span>
                  {option.handle ? (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      /{option.handle}
                    </span>
                  ) : null}
                  {option.id === value ? (
                    <RiCheckLine className="ml-2 size-4 shrink-0" aria-hidden />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StorefrontProductsPicker({
  onChange,
  value,
}: {
  onChange: (value: string[]) => void;
  value: string[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<CatalogOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/admin/products/actions/list?limit=100", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        const products = payload?.data?.products ?? payload?.data ?? payload?.products ?? [];
        if (!Array.isArray(products)) {
          setOptions([]);
          return;
        }
        setOptions(
          products
            .map(
              (row: {
                handle?: string | null;
                id?: string;
                thumbnail?: string | null;
                thumbnailUrl?: string | null;
                title?: string | null;
              }) =>
                row?.id
                  ? {
                      id: String(row.id),
                      title: String(row.title ?? row.handle ?? row.id),
                      handle: row.handle ?? null,
                      thumbnailUrl: row.thumbnailUrl ?? row.thumbnail ?? null,
                    }
                  : null,
            )
            .filter(Boolean) as CatalogOption[],
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () =>
      options.map((product) => ({
        id: product.id,
        title: product.title,
        subtitle: product.handle ? `/${product.handle}` : null,
        thumbnailUrl: product.thumbnailUrl ?? null,
        searchText: [product.title, product.handle, product.id].filter(Boolean).join(" "),
      })),
    [options],
  );

  return (
    <>
      <ProductCatalogPickerTrigger
        loading={loading}
        onClick={() => setOpen(true)}
        selectedCount={value.length}
      />
      {value.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {value.length === 1
            ? "1 product selected for this section."
            : `${value.length} products selected for this section.`}{" "}
          Clear in the picker to show newest products automatically.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No products selected — storefront shows newest products.
        </p>
      )}
      <ProductCatalogPickerDialog
        items={items}
        loading={loading}
        onConfirm={onChange}
        onOpenChange={setOpen}
        open={open}
        selectedIds={value}
        selectionMode="multiple"
        selectionTarget="product"
        title="Featured products"
      />
    </>
  );
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

function EditorImageSourceActions({ onPicked }: { onPicked: (url: string | undefined) => void }) {
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

export function PremiumColorPicker({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const color = isHexColor(value) ? value : "#000000";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="w-full min-w-0 justify-start gap-2" type="button" variant="outline">
          <span className="size-4 shrink-0 rounded-full border" style={{ backgroundColor: color }} />
          <span className="truncate font-mono text-xs uppercase">{color}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={POPOVER_MOTION_CLASSNAME}>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">Pick a brand-safe storefront color.</div>
          </div>
          <HexColorPicker className="!w-full" color={color} onChange={onChange} />
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-md border" style={{ backgroundColor: color }} />
            <HexColorInput
              aria-label={`${label} hex color`}
              className="flex h-9 min-w-0 flex-1 rounded-md border bg-background px-3 py-1 text-sm font-mono uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
              color={color}
              onChange={(nextColor) => onChange(`#${nextColor}`)}
              prefixed
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FontSelect({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const { t } = useI18n();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="w-full min-w-0 justify-between gap-2" type="button" variant="outline">
          <span className="min-w-0 truncate" style={{ fontFamily: value }}>
            {value || t("editor.fonts.choose")}
          </span>
          <RiEditLine className="shrink-0" data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn(POPOVER_MOTION_CLASSNAME, "p-0")}>
        <Command>
          <CommandInput placeholder={t("editor.fonts.search")} />
          <CommandList>
            <CommandEmpty>No font found.</CommandEmpty>
            <CommandGroup>
              {FONT_OPTIONS.map((font) => (
                <CommandItem key={font} onSelect={() => onChange(font)} value={font}>
                  <span className="flex-1" style={{ fontFamily: font }}>
                    {font}
                  </span>
                  {font === value ? <RiCheckLine aria-hidden data-icon="inline-end" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function buildPuckConfig(
  templateKey: string,
  storefrontName: string,
): Config<Record<typeof STOREFRONT_PAGE_COMPONENT, StorefrontPageProps>> {
  return {
    components: {
      [STOREFRONT_PAGE_COMPONENT]: {
        fields: buildPuckFields(),
        render: (props) =>
          templateKey === "classic@1" ? (
            <ClassicV1StorefrontPreview {...props} storefrontName={storefrontName} />
          ) : (
            <UnsupportedTemplatePreview templateKey={templateKey} />
          ),
      },
    },
  };
}

export function buildPuckFields() {
  const fieldEntries = classicV1EditorManifest.sections.flatMap((section) =>
    section.fields.map((field) => [
      field.prop,
      {
        label: field.label,
        type: "custom" as const,
        render: ({ name, onChange, value }: PuckCustomFieldProps) => {
          const helpText = "helpText" in field ? field.helpText : undefined;

          return (
            <VisualEditorField
              {...(helpText ? { helpText } : {})}
              kind={field.kind}
              label={field.label}
              name={name}
              onChange={onChange}
              value={value}
            />
          );
        },
      },
    ]),
  );

  return Object.fromEntries(fieldEntries);
}

export type PuckCustomFieldProps = {
  name: string;
  onChange: (value: unknown) => void;
  value: unknown;
};

export function VisualEditorField({
  helpText,
  kind,
  label,
  name,
  onChange,
  value,
}: {
  helpText?: string;
  kind:
    | "color"
    | "image"
    | "link"
    | "text"
    | "textarea"
    | "boolean"
    | "collection"
    | "products";
  label: string;
  name: string;
  onChange: (value: unknown) => void;
  value: unknown;
}) {
  const stringValue = typeof value === "string" ? value : "";

  if (kind === "boolean") {
    const checked = typeof value === "boolean" ? value : value !== false;
    return (
      <FieldGroup>
        <Field>
          <div className="flex items-center justify-between gap-3">
            <PuckFieldLabel label={label} />
            <Switch checked={checked} onCheckedChange={(next) => onChange(next)} />
          </div>
          {helpText ? <FieldDescription>{helpText}</FieldDescription> : null}
        </Field>
      </FieldGroup>
    );
  }

  if (kind === "collection") {
    return (
      <FieldGroup>
        <Field>
          <PuckFieldLabel label={label}>
            <StorefrontCollectionPicker
              onChange={(id) => onChange(id || undefined)}
              value={stringValue}
            />
          </PuckFieldLabel>
          {helpText ? <FieldDescription>{helpText}</FieldDescription> : null}
        </Field>
      </FieldGroup>
    );
  }

  if (kind === "products") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    return (
      <FieldGroup>
        <Field>
          <PuckFieldLabel label={label}>
            <StorefrontProductsPicker onChange={onChange} value={ids} />
          </PuckFieldLabel>
          {helpText ? <FieldDescription>{helpText}</FieldDescription> : null}
        </Field>
      </FieldGroup>
    );
  }

  return (
    <FieldGroup>
      <Field>
        <PuckFieldLabel label={label}>
          {kind === "textarea" ? (
            <Textarea
              name={name}
              onChange={(event) => onChange(event.currentTarget.value)}
              value={stringValue}
            />
          ) : (
            <Input
              name={name}
              onChange={(event) =>
                onChange(
                  kind === "image" && !event.currentTarget.value.trim()
                    ? undefined
                    : event.currentTarget.value,
                )
              }
              type={kind === "color" && isHexColor(stringValue) ? "color" : "text"}
              value={stringValue}
            />
          )}
        </PuckFieldLabel>
        {helpText ? <FieldDescription>{helpText}</FieldDescription> : null}
      </Field>
    </FieldGroup>
  );
}

export function TemplatePreview({
  props,
  storefrontName,
  templateKey,
}: {
  props: StorefrontPageProps;
  storefrontName: string;
  templateKey: string;
}) {
  if (templateKey === "classic@1") {
    return <ClassicV1StorefrontPreview {...props} storefrontName={storefrontName} />;
  }

  return <UnsupportedTemplatePreview templateKey={templateKey} />;
}

export function UnsupportedTemplatePreview({ templateKey }: { templateKey: string }) {
  return (
    <div className="flex min-h-[32rem] items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-lg border bg-muted/30 p-6">
        <div className="text-sm font-semibold">Preview adapter unavailable</div>
        <p className="mt-2 text-sm text-muted-foreground">
          This storefront template needs an editor preview adapter before it can be edited visually.
        </p>
        <p className="mt-3 font-mono text-xs text-muted-foreground">{templateKey}</p>
      </div>
    </div>
  );
}

export function ClassicV1StorefrontPreview(
  props: StorefrontPageProps & { storefrontName?: string },
) {
  // Match live classic storefront: Syne display + Outfit body (always loaded).
  const headingFont = props.headingFont?.trim() || "Syne";
  const bodyFont = props.bodyFont?.trim() || "Outfit";
  const theme = {
    backgroundColor: props.backgroundColor || "#ffffff",
    color: props.foregroundColor || "#111827",
    fontFamily: `"${bodyFont}", Outfit, ui-sans-serif, system-ui, sans-serif`,
  };
  const primaryColor = props.primaryColor || "#0f766e";
  const mutedColor = props.mutedColor || "#f3f4f6";
  const storefrontName = props.storefrontName || "Storefront";
  const displayFace = `"${headingFont}", Syne, ui-sans-serif, system-ui, sans-serif`;

  return (
    <main className="min-h-full bg-background" style={theme}>
      <link href={previewGoogleFontsHref([headingFont, bodyFont])} rel="stylesheet" />
      <div
        className="px-5 py-2.5 text-center text-sm font-semibold text-white"
        style={{ backgroundColor: primaryColor }}
      >
        <span className="mx-auto inline-block max-w-[70ch]">
          <EditableText
            fallback="Now accepting orders online."
            propName="announcementText"
            value={props.announcementText}
          />
        </span>
      </div>
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-8 py-5">
        <div className="flex items-center gap-3">
          <EditableImage
            fallbackLabel={(storefrontName || "S").slice(0, 1).toUpperCase()}
            placeholder="Logo"
            propName="logoAssetId"
            toneColor={primaryColor}
            value={props.logoAssetId}
            variant="logo"
          />
          <span className="font-bold tracking-tight" style={{ fontFamily: displayFace }}>
            {storefrontName}
          </span>
        </div>
        <nav className="flex items-center gap-5">
          <a
            className="min-w-12 text-sm font-semibold"
            href={props.navigationHref || "/"}
            onClick={preventPreviewLink}
          >
            <EditableText
              fallback="Shop"
              propName="navigationLabel"
              value={props.navigationLabel}
            />
          </a>
          <button className="text-sm font-semibold" onClick={preventPreviewLink} type="button">
            Contact
          </button>
        </nav>
      </header>
      <section className="mx-auto grid min-h-[420px] max-w-5xl items-center gap-12 px-8 py-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-5">
          <p
            className="text-sm font-extrabold uppercase tracking-normal"
            style={{ color: primaryColor }}
          >
            {storefrontName}
          </p>
          <h1
            className="max-w-3xl whitespace-pre-line text-[clamp(2.75rem,6vw,4.5rem)] font-bold leading-none tracking-tight"
            style={{ fontFamily: displayFace }}
          >
            <EditableText
              fallback="Your shop, online"
              multiline
              propName="heroTitle"
              value={props.heroTitle}
            />
          </h1>
          <p className="max-w-xl text-lg leading-7 opacity-75">
            <EditableText
              fallback="Browse products and place an order in minutes."
              multiline
              propName="heroSubtitle"
              value={props.heroSubtitle}
            />
          </p>
          <a
            className="inline-flex h-11 min-w-[9.5rem] items-center justify-center rounded-full px-6 text-sm font-semibold text-white"
            href={props.primaryCtaHref || "/"}
            onClick={preventPreviewLink}
            style={{ backgroundColor: primaryColor, color: "#ffffff" }}
          >
            <EditableText
              fallback="Shop products"
              propName="primaryCtaLabel"
              value={props.primaryCtaLabel}
            />
          </a>
        </div>
        <EditableImage
          placeholder="Hero image"
          propName="heroImageAssetId"
          toneColor={mutedColor}
          value={props.heroImageAssetId}
          variant="hero"
        />
      </section>
      <section className="mx-auto max-w-5xl px-8 pb-12 pt-8">
        <h2
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: displayFace }}
        >
          <EditableText
            fallback="Featured products"
            propName="productSectionTitle"
            value={props.productSectionTitle}
          />
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div className="rounded-lg border p-4" key={item}>
              <div className="aspect-square rounded-md" style={{ backgroundColor: mutedColor }} />
              <p className="mt-3 text-sm font-medium">Dynamic product</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="mx-auto flex max-w-5xl justify-between gap-5 border-t px-8 py-8 text-sm">
        <div className="flex flex-col gap-1">
          <strong style={{ fontFamily: displayFace }}>{storefrontName}</strong>
          <EditableText fallback="Phone" propName="footerPhone" value={props.footerPhone} />
          <EditableText
            fallback="Address"
            multiline
            propName="footerAddress"
            value={props.footerAddress}
          />
        </div>
      </footer>
    </main>
  );
}

/** Load Syne/Outfit (and draft theme fonts) for the visual editor twin. */
function previewGoogleFontsHref(names: string[]) {
  const catalog: Record<string, string> = {
    Syne: "Syne:wght@500;600;700;800",
    Outfit: "Outfit:wght@400;500;600;700",
    Inter: "Inter:wght@400;500;600;700",
    Geist: "Geist:wght@400;500;600;700",
    Manrope: "Manrope:wght@400;500;600;700",
    "DM Sans": "DM+Sans:wght@400;500;600;700",
    "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700",
    "Nunito Sans": "Nunito+Sans:wght@400;500;600;700",
    "Source Sans 3": "Source+Sans+3:wght@400;500;600;700",
    Figtree: "Figtree:wght@400;500;600;700",
  };
  const seen = new Set<string>();
  const families: string[] = [];
  for (const name of [...names, "Syne", "Outfit"]) {
    const spec = catalog[name];
    if (spec && !seen.has(spec)) {
      seen.add(spec);
      families.push(spec);
    }
  }
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;
}

export function EditableText({
  fallback,
  multiline = false,
  propName,
  value,
}: {
  fallback: string;
  multiline?: boolean;
  propName: keyof StorefrontPageProps;
  value?: string | undefined;
}) {
  const data = useStorefrontPuck((api) => api.appState.data);
  const dispatch = useStorefrontPuck((api) => api.dispatch);
  const displayValue = value?.trim() ? value : fallback;

  function updateValue(nextValue: string) {
    updateStorefrontProp(
      data,
      dispatch,
      propName,
      multiline ? nextValue : nextValue.replace(/\n/g, " "),
    );
  }

  if (multiline) {
    return (
      <span className="group/editable relative -m-1 block cursor-text rounded-md p-1 transition-colors hover:bg-primary/5 focus-within:bg-primary/5 [[data-edit-hints=off]_&]:hover:bg-primary/5">
        <textarea
          aria-label={`Edit ${String(propName)}`}
          className="peer block min-h-[1.5em] w-full cursor-text resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 text-inherit outline-none ring-1 ring-primary/25 transition-shadow hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary/60 [[data-edit-hints=off]_&]:ring-transparent [[data-edit-hints=off]_&]:hover:ring-primary/50"
          onChange={(event) => updateValue(event.currentTarget.value)}
          rows={2}
          value={displayValue}
        />
        <EditableHint />
      </span>
    );
  }

  return (
    <span className="group/editable relative -m-1 inline-flex max-w-full cursor-text rounded-md p-1 transition-colors hover:bg-primary/5 focus-within:bg-primary/5 [[data-edit-hints=off]_&]:hover:bg-primary/5">
      <input
        aria-label={`Edit ${String(propName)}`}
        className="peer inline-block min-w-0 max-w-full cursor-text rounded-sm border-0 bg-transparent p-0 text-inherit outline-none ring-1 ring-primary/25 transition-shadow hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary/60 [[data-edit-hints=off]_&]:ring-transparent [[data-edit-hints=off]_&]:hover:ring-primary/50"
        onChange={(event) => updateValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        style={{ width: `calc(${Math.max(displayValue.length, fallback.length, 4)}ch + 0.75rem)` }}
        value={displayValue}
      />
      <EditableHint />
    </span>
  );
}

export function EditableImage({
  fallbackLabel,
  placeholder,
  propName,
  toneColor,
  value,
  variant,
}: {
  fallbackLabel?: string;
  placeholder: string;
  propName: keyof StorefrontPageProps;
  toneColor: string;
  value?: string | undefined;
  variant: "hero" | "logo";
}) {
  const data = useStorefrontPuck((api) => api.appState.data);
  const dispatch = useStorefrontPuck((api) => api.dispatch);
  const imageUrl = isPreviewImageUrl(value) ? value : "";

  function updateValue(nextValue: string) {
    updateStorefrontProp(data, dispatch, propName, nextValue.trim() ? nextValue : undefined);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`Edit ${placeholder}`}
          className={cn(
            "group/editable relative flex cursor-pointer items-center justify-center border bg-background text-sm transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 [[data-edit-hints=off]_&]:ring-transparent [[data-edit-hints=off]_&]:hover:ring-primary/50",
            variant === "logo"
              ? "size-10 rounded-md font-semibold text-white ring-1 ring-primary/25 hover:ring-primary/50"
              : "aspect-[4/3] w-full rounded-lg ring-1 ring-primary/25 hover:ring-primary/50",
          )}
          style={variant === "logo" && !imageUrl ? { backgroundColor: toneColor } : undefined}
          type="button"
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full rounded-[inherit] object-cover" src={imageUrl} />
          ) : variant === "logo" ? (
            fallbackLabel
          ) : (
            <span
              className="flex size-full items-center justify-center rounded-[inherit]"
              style={{ backgroundColor: toneColor }}
            >
              {value || placeholder}
            </span>
          )}
          <EditableHint />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn(POPOVER_MOTION_CLASSNAME, "w-80")}>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-sm font-medium">{placeholder}</div>
            <div className="text-xs text-muted-foreground">
              Upload a file or choose an image from your media library.
            </div>
          </div>
          <EditorImageSourceActions
            onPicked={(url) => {
              if (url) updateValue(url);
            }}
          />
          {value ? (
            <Button onClick={() => updateValue("")} size="sm" type="button" variant="outline">
              Clear image
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EditableHint() {
  // Isolate type size from parent (hero titles inherit huge clamp sizes).
  return (
    <span
      className="pointer-events-none absolute right-0 top-0 z-20 inline-flex -translate-y-1/2 translate-x-1/4 items-center gap-1 rounded-full border border-border/80 bg-background px-1.5 py-0.5 font-medium text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover/editable:opacity-100 group-focus-within/editable:opacity-100 [[data-edit-hints=off]_&]:hidden"
      style={{
        fontSize: 10,
        lineHeight: 1.2,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontWeight: 500,
        letterSpacing: "0.01em",
      }}
    >
      <RiEditLine aria-hidden className="size-3 shrink-0" style={{ width: 12, height: 12 }} />
      Edit
    </span>
  );
}

export function updateStorefrontProp(
  data: Data,
  dispatch: (action: PuckAction) => void,
  propName: keyof StorefrontPageProps,
  value: unknown,
) {
  dispatch({
    type: "setData",
    data: {
      ...data,
      content: data.content.map((entry) =>
        entry.type === STOREFRONT_PAGE_COMPONENT
          ? {
              ...entry,
              props: {
                ...entry.props,
                [propName]: value,
              },
            }
          : entry,
      ),
    },
  });
}

export function preventPreviewLink(event: React.MouseEvent<HTMLElement>) {
  event.preventDefault();
}

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
