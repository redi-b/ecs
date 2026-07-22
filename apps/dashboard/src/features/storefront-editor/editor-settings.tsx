"use client";

import { classicV1EditorSchema as classicV1EditorManifest } from "@ecs/storefront-templates";
import type { Data, PuckAction } from "@puckeditor/core";
import { RiImageLine } from "@remixicon/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  SETTINGS_SECTION_LABELS,
  useStorefrontPuck,
} from "@/features/storefront-editor/editor-config";
import { MediaLibraryDialog } from "@/features/media/media-library-dialog";
import { MediaUrlImportField } from "@/features/media/media-url-import-field";
import { uploadMediaFile } from "@/features/media/upload-media-file";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

import {
  StorefrontCollectionPicker,
  StorefrontProductsPicker,
} from "./editor-merchandising";
import { getStorefrontPageProps, isPreviewImageUrl, type StorefrontPageProps } from "./editor-state";
import { ThemeBrandSection, FontSelect, PremiumColorPicker } from "./editor-theme";
import { updateStorefrontProp } from "./editor-utils";

export function StorefrontSettingsPanel() {
  const data = useStorefrontPuck((api) => api.appState.data);
  const dispatch = useStorefrontPuck((api) => api.dispatch);
  const props = getStorefrontPageProps(data);

  // No overscroll-contain: at top/bottom, wheel continues to page scroll (natural chaining).
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-3 p-4 pb-10">
        {classicV1EditorManifest.sections.map((section) => {
          if (section.id === "theme") {
            return (
              <ThemeBrandSection
                data={data}
                dispatch={dispatch}
                key={section.id}
                props={props}
              />
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
                    "flex min-w-0 flex-col gap-5 p-4",
                    enabledField && !sectionVisible && "pointer-events-none opacity-50",
                  )}
                >
                  {bodyFields.map((field) => {
                    const value = (props as Record<string, unknown>)[field.prop];
                    const helpText = "helpText" in field ? field.helpText : undefined;

                    const showHelp = Boolean(helpText) && field.kind !== "products";

                    return (
                      <Field className="min-w-0 gap-2.5" key={field.path}>
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
                        {showHelp ? (
                          <FieldDescription className="text-pretty leading-relaxed">
                            {helpText}
                          </FieldDescription>
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
}: {
  onPicked: (url: string | undefined) => void;
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
