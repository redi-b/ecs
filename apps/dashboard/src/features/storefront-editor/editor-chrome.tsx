"use client";

import type { Data } from "@puckeditor/core";
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiEditLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFullscreenExitLine,
  RiFullscreenLine,
  RiPauseLine,
  RiResetLeftLine,
  RiRocketLine,
  RiSave3Line,
} from "@remixicon/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

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
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StorefrontVisualEditorProps } from "@/features/storefront-editor/editor-config";
import { useStorefrontPuck } from "@/features/storefront-editor/editor-config";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

import { TemplatePreview } from "./editor-preview";
import { StorefrontSettingsPanel } from "./editor-settings";
import { getStorefrontPageProps, type PublicationStatus } from "./editor-state";

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
          <RiArrowGoBackLine />
        </ToolbarIconButton>
        <ToolbarIconButton
          disabled={hasMounted ? !canRedo : undefined}
          label={t("editor.actions.redo")}
          onClick={onRedo}
        >
          <RiArrowGoForwardLine />
        </ToolbarIconButton>
        <Separator className="mx-0.5 hidden h-5 sm:mx-1 sm:block" orientation="vertical" />
        <ToolbarIconButton
          label={showEditHints ? t("editor.actions.hideOutlines") : t("editor.actions.showOutlines")}
          onClick={onToggleEditHints}
          pressed={showEditHints}
        >
          {showEditHints ? <RiEyeLine /> : <RiEyeOffLine />}
        </ToolbarIconButton>
        <ToolbarIconButton
          label={isFullscreen ? t("editor.actions.exitFullscreen") : t("editor.actions.fullscreen")}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <RiFullscreenExitLine /> : <RiFullscreenLine />}
        </ToolbarIconButton>
        <ToolbarIconButton asChild label={t("editor.actions.openLive")}>
          <a href={editorMeta.liveStorefrontUrl} rel="noreferrer" target="_blank">
            <RiExternalLinkLine />
          </a>
        </ToolbarIconButton>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button size="icon-sm" type="button" variant="ghost">
                  <RiResetLeftLine />
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
                <RiPauseLine data-icon="inline-start" />
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
  children: ReactNode;
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
          className={cn("size-8 shrink-0 p-0", pressed && "bg-muted text-foreground")}
          disabled={disabled}
          onClick={onClick}
          size="icon"
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
        <div className={cn("p-3 sm:p-5", mobilePanel !== "preview" && "max-lg:hidden")}>
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
