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

import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
    <Badge
      variant={live ? "success" : "warning"}
      className="gap-1.5 px-2 py-0.5 text-[11px] font-medium shadow-sm"
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {live ? t("editor.status.live") : t("editor.status.paused")}
    </Badge>
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
    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
      <div className="flex flex-wrap items-center gap-0.5 sm:gap-2">
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
        <span className="hidden sm:inline-flex">
          <ToolbarIconButton
            label={isFullscreen ? t("editor.actions.exitFullscreen") : t("editor.actions.fullscreen")}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <RiFullscreenExitLine /> : <RiFullscreenLine />}
          </ToolbarIconButton>
        </span>
        <ToolbarIconButton asChild label={t("editor.actions.openLive")}>
          <a href={editorMeta.liveStorefrontUrl} rel="noreferrer" target="_blank">
            <RiExternalLinkLine />
          </a>
        </ToolbarIconButton>
        <ConfirmDialog
          confirmLabel={t("editor.actions.resetConfirm")}
          description={t("editor.actions.resetDescription")}
          eyebrow={t("common.confirm.dangerEyebrow")}
          onConfirm={onReset}
          title={t("editor.actions.resetTitle")}
          tone="default"
          trigger={
            <Button
              aria-label={t("editor.actions.resetEditor")}
              size="icon-sm"
              title={t("editor.actions.resetEditor")}
              type="button"
              variant="ghost"
            >
              <RiResetLeftLine />
              <span className="sr-only">{t("editor.actions.resetEditor")}</span>
            </Button>
          }
        />
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
        <Button
          className="min-w-0"
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
          <ConfirmDialog
            cancelDisabled={isPending}
            confirmDisabled={isPending}
            confirmLabel={t("editor.actions.pauseConfirm")}
            description={t("editor.actions.pauseDescription")}
            eyebrow={t("common.confirm.dangerEyebrow")}
            onConfirm={() => onUnpublish()}
            title={t("editor.actions.pauseTitle")}
            trigger={
              <Button
                className="min-w-0"
                disabled={isPending}
                size="sm"
                type="button"
                variant="destructive"
              >
                <RiPauseLine data-icon="inline-start" />
                {t("editor.actions.pauseShop")}
              </Button>
            }
          />
        ) : (
          <span className="hidden sm:block" />
        )}
        <Button
          className={cn("min-w-0", isLive && onUnpublish ? "col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-1")}
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
    <div
      className={cn(
        "storefront-editor-chrome flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-background shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]",
        "max-lg:min-h-[min(100dvh-5.5rem,52rem)]",
        isFullscreen && "max-lg:min-h-dvh",
      )}
    >
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border/80 bg-muted/20 px-3 py-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/80 bg-background shadow-sm sm:size-10">
            <RiEditLine className="text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className="text-sm font-medium tracking-tight">{t("editor.shell.title")}</div>
              <Badge variant="secondary">{editorMeta.templateName}</Badge>
              <ShopLiveStatusBadge live={isLive} />
              <PublicationStatusBadge status={publicationStatus} />
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
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

      <div className="shrink-0 border-b border-border/80 bg-background px-3 py-2 lg:hidden">
        <SegmentedControl
          active="muted"
          ariaLabel={`${t("editor.panels.preview")} / ${t("editor.panels.settings")}`}
          onChange={setMobilePanel}
          options={[
            { id: "preview", label: t("editor.panels.preview") },
            { id: "settings", label: t("editor.panels.settings") },
          ]}
          size="sm"
          value={mobilePanel}
        />
      </div>

      <div
        className={cn(
          "grid min-h-0 flex-1 bg-muted/20 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]",
          isFullscreen && "lg:min-h-[calc(100dvh-7.5rem)]",
        )}
        data-edit-hints={showEditHints ? "on" : "off"}
      >
        <div
          className={cn(
            "min-w-0 p-3 sm:p-5",
            mobilePanel !== "preview" && "max-lg:hidden",
            "max-lg:overflow-x-auto max-lg:overscroll-x-contain",
          )}
        >
          <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm max-lg:min-w-[22rem]">
            <TemplatePreview
              props={props}
              storefrontName={editorMeta.storefrontName}
              templateKey={editorMeta.templateKey}
            />
          </div>
        </div>
        <aside
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-t border-border/80 bg-background",
            "lg:h-0 lg:min-h-full lg:border-l lg:border-t-0",
            mobilePanel !== "settings" && "max-lg:hidden",
            "max-lg:min-h-0 max-lg:flex-1",
          )}
        >
          <div className="shrink-0 border-b border-border/80 bg-muted/15 px-4 py-3 sm:py-3.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium tracking-tight">
                  {t("editor.panels.settings")}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t("editor.settings.description")}
                </div>
              </div>
              <Button asChild className="w-full shrink-0 sm:w-auto" size="sm" variant="outline">
                <a href={editorMeta.settingsUrl}>{t("editor.settings.changeTemplate")}</a>
              </Button>
            </div>
          </div>
          <StorefrontSettingsPanel />
        </aside>
      </div>
    </div>
  );
}
