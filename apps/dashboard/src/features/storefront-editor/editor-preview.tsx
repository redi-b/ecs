"use client";

import { contrastingInk, getStorefrontEditorManifest } from "@ecs/storefront-templates";
import { RiEditLine, RiExternalLinkLine, RiRefreshLine } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  POPOVER_MOTION_CLASSNAME,
  useStorefrontEditor,
} from "@/features/storefront-editor/editor-config";
import { cn } from "@/lib/utils";
import { isMixedContentPreviewUrl } from "@/lib/storefront-preview-url";

import { EditorImageSourceActions } from "./editor-settings";
import { isPreviewImageUrl, updateEditorLinkValue, type StorefrontPageProps } from "./editor-state";
import { updateStorefrontProp } from "./editor-utils";

export function TemplatePreview({
  props,
  templateKey,
  previewUrl,
  isFullscreen = false,
  onSelectPath,
  onSelectionInteractionChange,
  selectedPath,
  showEditHints = true,
}: {
  props: StorefrontPageProps;
  storefrontName: string;
  templateKey: string;
  previewUrl?: string | undefined;
  isFullscreen?: boolean;
  onSelectPath?: (path: string) => void;
  onSelectionInteractionChange?: (active: boolean) => void;
  selectedPath?: string | null;
  showEditHints?: boolean;
}) {
  const manifest = getStorefrontEditorManifest(templateKey);

  if (manifest?.previewMode === "iframe" && previewUrl) {
    return <StorefrontIframePreview isFullscreen={isFullscreen} onSelectPath={onSelectPath} onSelectionInteractionChange={onSelectionInteractionChange} previewUrl={previewUrl} props={props} selectedPath={selectedPath} showEditHints={showEditHints} templateKey={templateKey} />;
  }

  if (manifest?.previewMode === "iframe") {
    return <UnavailableIframePreview templateKey={templateKey} />;
  }

  return <UnsupportedTemplatePreview templateKey={templateKey} />;
}

function UnavailableIframePreview({ templateKey }: { templateKey: string }) {
  return (
    <div className="flex min-h-[32rem] items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-lg border bg-muted/30 p-6">
        <div className="text-sm font-semibold">Preview session unavailable</div>
        <p className="mt-2 text-sm text-muted-foreground">
          The storefront renderer is registered, but the editor could not open a signed preview
          session. Refresh after confirming the preview services are running.
        </p>
        <p className="mt-3 font-mono text-xs text-muted-foreground">{templateKey}</p>
      </div>
    </div>
  );
}

function StorefrontIframePreview({
  previewUrl,
  props,
  templateKey,
  isFullscreen,
  onSelectPath,
  onSelectionInteractionChange,
  selectedPath,
  showEditHints,
}: {
  previewUrl: string;
  props: StorefrontPageProps;
  templateKey: string;
  isFullscreen: boolean;
  onSelectPath?: ((path: string) => void) | undefined;
  onSelectionInteractionChange?: ((active: boolean) => void) | undefined;
  selectedPath?: string | null | undefined;
  showEditHints: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const connectedOriginRef = useRef<string | null>(null);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "failed">("loading");
  const [iframeDocumentLoaded, setIframeDocumentLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const isLoaded = previewState === "ready";
  const data = useStorefrontEditor((api) => api.appState.data);
  const dispatch = useStorefrontEditor((api) => api.dispatch);
  const manifest = useMemo(() => getStorefrontEditorManifest(templateKey), [templateKey]);
  const fields = useMemo(() => {
    const values: Record<string, unknown> = {};
    for (const section of manifest?.sections ?? []) {
      for (const field of section.fields) values[field.path] = props[field.prop as keyof StorefrontPageProps];
    }
    // Firefox cannot structured-clone URL instances. The manifest payload is a
    // JSON contract, so normalize it before it crosses the iframe boundary.
    return JSON.parse(JSON.stringify(values)) as Record<string, unknown>;
  }, [manifest, props]);
  const resolvedTheme = useMemo(() => ({
    accent: props.accentColor,
    background: props.backgroundColor,
    foreground: props.foregroundColor,
    muted: props.mutedColor,
    onAccent: props.accentColor ? contrastingInk(props.accentColor) : undefined,
    onPrimary: props.primaryColor ? contrastingInk(props.primaryColor) : undefined,
    primary: props.primaryColor,
  }), [props.accentColor, props.backgroundColor, props.foregroundColor, props.mutedColor, props.primaryColor]);
  const postConnected = useCallback((message: Record<string, unknown>) => {
    const origin = connectedOriginRef.current;
    if (!origin) return;
    iframeRef.current?.contentWindow?.postMessage(message, origin);
  }, []);
  const connect = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "ecs:editor:connect" }, "*");
  }, []);
  const selectedField = useMemo(
    () => manifest?.sections.flatMap((section) => section.fields).find((field) => field.path === selectedPath),
    [manifest, selectedPath],
  );

  useEffect(() => {
    connectedOriginRef.current = null;
    setPreviewState("loading");
    setIframeDocumentLoaded(false);
    setAttempt(0);
  }, [previewUrl]);

  useEffect(() => {
    postConnected({ type: "ecs:editor:update", fields, theme: resolvedTheme });
  }, [fields, postConnected, resolvedTheme]);

  useEffect(() => {
    postConnected({ type: "ecs:editor:ui", selectedPath, showEditHints });
  }, [postConnected, selectedPath, showEditHints]);

  useEffect(() => {
    if (previewState !== "loading") return;
    connect();
    const timer = window.setInterval(connect, 700);
    return () => window.clearInterval(timer);
  }, [attempt, connect, previewState]);

  useEffect(() => {
    if (previewState !== "loading") return;
    if (isMixedContentPreviewUrl(previewUrl, window.location.protocol)) {
      setPreviewState("failed");
      return;
    }
    // A slow connection or cold deployment gets a generous document-loading
    // window. Once HTML has arrived, the renderer should complete its editor
    // handshake much sooner; an Astro/runtime error otherwise cannot leave the
    // loading surface active forever.
    const timeout = iframeDocumentLoaded ? 15_000 : 45_000;
    const timer = window.setTimeout(() => setPreviewState("failed"), timeout);
    return () => window.clearTimeout(timer);
  }, [attempt, iframeDocumentLoaded, previewState, previewUrl]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "ecs:preview:ready") {
        connectedOriginRef.current = event.origin;
        postConnected({ type: "ecs:editor:update", fields, theme: resolvedTheme });
        postConnected({ type: "ecs:editor:ui", selectedPath, showEditHints });
        setPreviewState("ready");
        return;
      }
      if (!connectedOriginRef.current || event.origin !== connectedOriginRef.current) return;
      if (event.data.type === "ecs:preview:select") {
        const path = typeof event.data.path === "string" ? event.data.path : "";
        const field = manifest?.sections
          .flatMap((section) => section.fields)
          .find((field) => field.path === path || path.startsWith(`${field.path}.`));
        onSelectPath?.(field && path.startsWith(`${field.path}.`) ? path : field?.path ?? path);
        return;
      }
      if (event.data.type !== "ecs:preview:field-change") return;
      const path = typeof event.data.path === "string" ? event.data.path : "";
      const field = manifest?.sections.flatMap((section) => section.fields).find((item) => item.path === path || path.startsWith(`${item.path}.`));
      if (!field) return;
      if (field.kind === "links" && path !== field.path) {
        const current = props[field.prop as keyof StorefrontPageProps];
        const next = updateEditorLinkValue(current, field.path, path, typeof event.data.value === "string" ? event.data.value : "");
        if (!next) return;
        updateStorefrontProp(data, dispatch, field.prop as keyof StorefrontPageProps, next);
        return;
      }
      if (field.kind !== "text" && field.kind !== "textarea") return;
      updateStorefrontProp(
        data,
        dispatch,
        field.prop as keyof StorefrontPageProps,
        typeof event.data.value === "string" ? event.data.value : "",
      );
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [data, dispatch, fields, manifest, onSelectPath, postConnected, resolvedTheme, selectedPath, showEditHints]);

  return (
    <div className={cn("relative h-full min-h-0 w-full bg-background", !isFullscreen && "max-lg:min-h-[42rem]")}>
      <iframe
        className={cn("block h-full min-h-0 w-full border-0 bg-background transition-opacity duration-500", !isFullscreen && "max-lg:min-h-[42rem]", isLoaded ? "opacity-100" : "opacity-0")}
        onLoad={() => {
          connectedOriginRef.current = null;
          setIframeDocumentLoaded(true);
          setPreviewState("loading");
          connect();
        }}
        onError={() => setPreviewState("failed")}
        key={attempt}
        ref={iframeRef}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin"
        src={previewUrl}
        title="Storefront preview"
      />
      {isLoaded && selectedField?.kind === "image" ? (
        <div className="absolute right-3 top-3 z-10 w-[min(22rem,calc(100%-1.5rem))] rounded-xl border border-border/80 bg-background/95 p-3 shadow-xl backdrop-blur-md" data-editor-selection-control onPointerDown={(event) => event.stopPropagation()}>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Edit {selectedField.label}</div>
          <EditorImageSourceActions
            onPickerOpenChange={onSelectionInteractionChange}
            onPicked={(value) =>
              updateStorefrontProp(
                data,
                dispatch,
                selectedField.prop as keyof StorefrontPageProps,
                value,
              )
            }
          />
        </div>
      ) : null}
      <div aria-live="polite" aria-label={previewState === "failed" ? "Storefront preview failed to load" : "Preparing storefront preview"} className={cn("storefront-preview-loader absolute inset-0 grid place-items-center overflow-hidden bg-background transition-opacity duration-300", isLoaded ? "pointer-events-none opacity-0" : "opacity-100")} role={previewState === "failed" ? "alert" : "status"}>
        {previewState === "failed" ? (
          <div className="mx-auto flex max-w-md flex-col items-center px-6 text-center">
            <div className="grid size-12 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm">
              <RiRefreshLine className="size-5" aria-hidden />
            </div>
            <strong className="mt-4 text-base font-semibold">The storefront preview did not respond</strong>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              The storefront may be restarting or unable to render this draft. Retry here, or open
              the preview separately to inspect the storefront error.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => {
                  connectedOriginRef.current = null;
                  setIframeDocumentLoaded(false);
                  setPreviewState("loading");
                  setAttempt((value) => value + 1);
                }}
                size="sm"
                type="button"
              >
                <RiRefreshLine aria-hidden />
                Retry preview
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={previewUrl} rel="noreferrer" target="_blank">
                  <RiExternalLinkLine aria-hidden />
                  Open separately
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <>
        <div className="storefront-preview-loader__halo" />
        <div className="storefront-preview-loader__content">
          <div className="storefront-preview-loader__scene" aria-hidden>
            <div className="storefront-preview-loader__shadow" />
            <div className="storefront-preview-loader__sheet storefront-preview-loader__sheet--back" />
            <div className="storefront-preview-loader__sheet storefront-preview-loader__sheet--middle" />
            <div className="storefront-preview-loader__sheet storefront-preview-loader__sheet--front">
              <div className="storefront-preview-loader__nav"><span /><i /><i /><i /></div>
              <div className="storefront-preview-loader__hero"><span /><span /><b /></div>
              <div className="storefront-preview-loader__cards"><i /><i /><i /></div>
              <div className="storefront-preview-loader__scan" />
            </div>
            <div className="storefront-preview-loader__cursor"><RiEditLine /></div>
          </div>
          <div className="storefront-preview-loader__copy">
            <span>STOREFRONT PREVIEW</span>
            <strong>Preparing your storefront</strong>
            <p>Bringing your latest changes into view</p>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

export function UnsupportedTemplatePreview({ templateKey }: { templateKey: string }) {
  return (
    <div className="flex min-h-[32rem] items-center justify-center p-8 text-center">
      <div className="max-w-md rounded-lg border bg-muted/30 p-6">
        <div className="text-sm font-semibold">Preview adapter unavailable</div>
        <p className="mt-2 text-sm text-muted-foreground">
          This storefront template does not have a registered preview renderer yet.
        </p>
        <p className="mt-3 font-mono text-xs text-muted-foreground">{templateKey}</p>
      </div>
    </div>
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
  const data = useStorefrontEditor((api) => api.appState.data);
  const dispatch = useStorefrontEditor((api) => api.dispatch);
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
  const data = useStorefrontEditor((api) => api.appState.data);
  const dispatch = useStorefrontEditor((api) => api.dispatch);
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
