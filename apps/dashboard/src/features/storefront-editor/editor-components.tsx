"use client";

import "@puckeditor/core/puck.css";

import { classicV1EditorSchema as classicV1EditorManifest } from "@ecs/storefront-templates";
import type { Config, Data, PuckAction } from "@puckeditor/core";
import { createUsePuck, FieldLabel, Puck } from "@puckeditor/core";
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
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

export function PublicationStatusBadge({ status }: { status: PublicationStatus }) {
  const copy = {
    published: {
      label: "Published live",
      tone: "bg-primary text-primary-foreground",
      dot: "bg-primary-foreground",
    },
    "saved-draft": {
      label: "Draft saved",
      tone: "bg-muted text-foreground",
      dot: "bg-muted-foreground",
    },
    unsaved: {
      label: "Unpublished edits",
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
  isPending,
  onRedo,
  onReset,
  onToggleFullscreen,
  onPublish,
  onSave,
  onToggleEditHints,
  onUndo,
  showEditHints,
}: {
  canRedo: boolean;
  canUndo: boolean;
  editorMeta: StorefrontVisualEditorProps["editorMeta"];
  isFullscreen: boolean;
  isPending: boolean;
  onRedo: () => void;
  onReset: () => void;
  onToggleFullscreen: () => void;
  onPublish: () => void;
  onSave: () => void;
  onToggleEditHints: () => void;
  onUndo: () => void;
  showEditHints: boolean;
}) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <ToolbarIconButton disabled={hasMounted ? !canUndo : undefined} label="Undo" onClick={onUndo}>
        <RiArrowGoBackLine data-icon="inline-start" />
      </ToolbarIconButton>
      <ToolbarIconButton disabled={hasMounted ? !canRedo : undefined} label="Redo" onClick={onRedo}>
        <RiArrowGoForwardLine data-icon="inline-start" />
      </ToolbarIconButton>
      <Separator className="mx-1 hidden h-5 sm:block" orientation="vertical" />
      <ToolbarIconButton
        label={showEditHints ? "Hide editable outlines" : "Show editable outlines"}
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
        label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? (
          <RiFullscreenExitLine data-icon="inline-start" />
        ) : (
          <RiFullscreenLine data-icon="inline-start" />
        )}
      </ToolbarIconButton>
      <ToolbarIconButton asChild label="Open live storefront">
        <a href={editorMeta.liveStorefrontUrl} rel="noreferrer" target="_blank">
          <RiExternalLinkLine data-icon="inline-start" />
        </a>
      </ToolbarIconButton>
      <AlertDialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button size="sm" type="button" variant="ghost">
                <RiRefreshLine data-icon="inline-start" />
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Reset editor</TooltipContent>
        </Tooltip>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset editor changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This resets the editor to the draft that was loaded when you opened this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onReset}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Separator className="mx-1 hidden h-5 sm:block" orientation="vertical" />
      <Button disabled={isPending} onClick={onSave} size="sm" type="button" variant="outline">
        <RiSave3Line data-icon="inline-start" />
        Save draft
      </Button>
      <Button disabled={isPending} onClick={onPublish} size="sm" type="button">
        <RiRocketLine data-icon="inline-start" />
        Publish
      </Button>
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

export function StorefrontEditorShell({
  canRedo,
  canUndo,
  editorMeta,
  isFullscreen,
  isPending,
  onRedo,
  onReset,
  onToggleFullscreen,
  onPublish,
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
  isPending: boolean;
  onRedo: () => void;
  onReset: () => void;
  onToggleFullscreen: () => void;
  onPublish: (data: Data) => void;
  onSave: (data: Data) => void;
  onToggleEditHints: () => void;
  onUndo: () => void;
  publicationStatus: PublicationStatus;
  showEditHints: boolean;
}) {
  const data = useStorefrontPuck((api) => api.appState.data);
  const props = getStorefrontPageProps(data);

  return (
    <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg border bg-background shadow-sm">
            <RiEditLine className="text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">Storefront editor</div>
              <Badge variant="secondary">{editorMeta.templateName}</Badge>
              <PublicationStatusBadge status={publicationStatus} />
            </div>
            <div className="text-xs text-muted-foreground">
              Click outlined text in the preview, or refine details in settings.
            </div>
          </div>
        </div>
        <StorefrontEditorActions
          canRedo={canRedo}
          canUndo={canUndo}
          editorMeta={editorMeta}
          isFullscreen={isFullscreen}
          isPending={isPending}
          onRedo={onRedo}
          onReset={onReset}
          onToggleFullscreen={onToggleFullscreen}
          onPublish={() => onPublish(data)}
          onSave={() => onSave(data)}
          onToggleEditHints={onToggleEditHints}
          onUndo={onUndo}
          showEditHints={showEditHints}
        />
      </div>
      <div
        className={cn(
          "grid h-[calc(100vh-230px)] min-h-[42rem] bg-muted/30 transition-[height,min-height] duration-300 ease-out lg:grid-cols-[minmax(0,1fr)_24rem]",
          isFullscreen && "h-[calc(100vh-5.5rem)] min-h-0",
        )}
        data-edit-hints={showEditHints ? "on" : "off"}
      >
        <div className="overflow-auto p-5">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-xl border bg-background shadow-sm transition-all duration-300 ease-out">
            <TemplatePreview
              props={props}
              storefrontName={editorMeta.storefrontName}
              templateKey={editorMeta.templateKey}
            />
          </div>
        </div>
        <aside className="flex min-h-0 flex-col border-t bg-background lg:border-l lg:border-t-0">
          <div className="border-b bg-background px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Settings</div>
              <Button asChild size="sm" variant="outline">
                <a href={editorMeta.settingsUrl}>Change template</a>
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Links, images, colors, and fallback content.
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

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-3 p-4">
        {classicV1EditorManifest.sections.map((section) => (
          <section className="rounded-xl border bg-card shadow-sm" key={section.id}>
            <div className="border-b px-4 py-3">
              <div className="text-sm font-semibold">
                {SETTINGS_SECTION_LABELS[section.id] ?? section.label}
              </div>
            </div>
            <div className="flex flex-col gap-4 p-4">
              {section.fields.map((field) => {
                const value = (props as Record<string, unknown>)[field.prop];
                const stringValue = typeof value === "string" ? value : "";
                const helpText = "helpText" in field ? field.helpText : undefined;

                return (
                  <Field key={field.path}>
                    <div className="grid gap-2 text-sm font-medium">
                      <span>{field.label}</span>
                      <StorefrontSettingControl
                        data={data}
                        dispatch={dispatch}
                        field={field}
                        value={stringValue}
                      />
                    </div>
                    {helpText ? <FieldDescription>{helpText}</FieldDescription> : null}
                  </Field>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </ScrollArea>
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
  value: string;
}) {
  const update = (nextValue: string | undefined) =>
    updateStorefrontProp(data, dispatch, field.prop as keyof StorefrontPageProps, nextValue);

  if (field.kind === "color") {
    return <PremiumColorPicker label={field.label} onChange={update} value={value || "#000000"} />;
  }

  if (field.path.includes("typography.")) {
    return <FontSelect onChange={(nextValue) => update(nextValue)} value={value || "Inter"} />;
  }

  if (field.kind === "image") {
    return <ImageReferenceControl label={field.label} onChange={update} value={value} />;
  }

  if (field.kind === "textarea") {
    return (
      <Textarea
        aria-label={field.label}
        className="min-h-24"
        name={field.prop}
        onChange={(event) => update(event.currentTarget.value)}
        value={value}
      />
    );
  }

  return (
    <Input
      aria-label={field.label}
      name={field.prop}
      onChange={(event) => update(event.currentTarget.value)}
      placeholder={field.kind === "link" ? "/" : undefined}
      value={value}
    />
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
  const imageUrl = isPreviewImageUrl(value) ? value : "";

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex items-center gap-3">
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
          <div className="truncate text-xs text-muted-foreground">
            {value ? "Image reference set" : "Paste an image URL"}
          </div>
        </div>
        {value ? (
          <Button onClick={() => onChange(undefined)} size="sm" type="button" variant="ghost">
            Clear
          </Button>
        ) : null}
      </div>
      <Input
        aria-label={`${label} URL`}
        onChange={(event) =>
          onChange(event.currentTarget.value.trim() ? event.currentTarget.value : undefined)
        }
        placeholder="https://example.com/image.jpg"
        value={value}
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
        <Button className="justify-start gap-2" type="button" variant="outline">
          <span className="size-4 rounded-full border" style={{ backgroundColor: color }} />
          <span className="font-mono text-xs uppercase">{color}</span>
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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="justify-between" type="button" variant="outline">
          <span style={{ fontFamily: value }}>{value || "Choose font"}</span>
          <RiEditLine data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn(POPOVER_MOTION_CLASSNAME, "p-0")}>
        <Command>
          <CommandInput placeholder="Search fonts..." />
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
  onChange: (value: string | undefined) => void;
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
  kind: "color" | "image" | "link" | "text" | "textarea";
  label: string;
  name: string;
  onChange: (value: string | undefined) => void;
  value: unknown;
}) {
  const stringValue = typeof value === "string" ? value : "";

  return (
    <FieldGroup>
      <Field>
        <FieldLabel label={label}>
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
        </FieldLabel>
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
  const theme = {
    backgroundColor: props.backgroundColor || "#ffffff",
    color: props.foregroundColor || "#111827",
    fontFamily: props.bodyFont || "Inter",
  };
  const primaryColor = props.primaryColor || "#0f766e";
  const mutedColor = props.mutedColor || "#f3f4f6";
  const storefrontName = props.storefrontName || "Storefront";

  return (
    <main className="min-h-full bg-background" style={theme}>
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
          <span className="font-semibold">{storefrontName}</span>
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
            className="max-w-3xl whitespace-pre-line text-[clamp(2.75rem,6vw,4.5rem)] font-bold leading-none tracking-normal"
            style={{ fontFamily: props.headingFont || "Inter" }}
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
            className="inline-flex h-11 w-fit items-center rounded-md px-5 text-sm font-medium text-white"
            href={props.primaryCtaHref || "/"}
            onClick={preventPreviewLink}
            style={{ backgroundColor: primaryColor }}
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
        <h2 className="text-2xl font-semibold tracking-normal">
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
          <strong>{storefrontName}</strong>
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
              Paste an image URL for the storefront preview.
            </div>
          </div>
          <Input
            aria-label={`${placeholder} URL`}
            autoFocus
            onChange={(event) => updateValue(event.currentTarget.value)}
            placeholder="https://example.com/image.jpg"
            value={value ?? ""}
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
  return (
    <span className="pointer-events-none absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover/editable:opacity-100 group-focus-within/editable:opacity-100">
      <RiEditLine className="size-3" aria-hidden />
      Edit
    </span>
  );
}

export function updateStorefrontProp(
  data: Data,
  dispatch: (action: PuckAction) => void,
  propName: keyof StorefrontPageProps,
  value: string | undefined,
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
