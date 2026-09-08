"use client";

import { getStorefrontEditorManifest } from "@ecs/storefront-templates";

import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiEditLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFullscreenExitLine,
  RiFullscreenLine,
  RiMore2Line,
  RiPauseLine,
  RiResetLeftLine,
  RiRocketLine,
  RiSave3Line,
} from "@remixicon/react";
import { useEffect, useState, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StorefrontVisualEditorProps } from "@/features/storefront-editor/editor-config";
import { useStorefrontEditor } from "@/features/storefront-editor/editor-config";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

import { TemplatePreview } from "./editor-preview";
import { StorefrontSettingsPanel } from "./editor-settings";
import { getStorefrontPageProps, type EditorData, type PublicationStatus } from "./editor-state";

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
  const [resetOpen, setResetOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <div className="flex w-full min-w-0 items-center gap-1.5 sm:justify-end sm:gap-2">
      <div className="flex shrink-0 items-center gap-0.5">
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
        <Separator className="mx-0.5 h-5" orientation="vertical" />
        <ToolbarIconButton label={isFullscreen ? t("editor.actions.exitFullscreen") : t("editor.actions.fullscreen")} onClick={onToggleFullscreen}>
          {isFullscreen ? <RiFullscreenExitLine /> : <RiFullscreenLine />}
        </ToolbarIconButton>
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:ml-0 sm:gap-2">
        <Button
          aria-label={t("editor.actions.saveDraft")}
          className="min-w-0 px-2.5 sm:px-3"
          disabled={isPending}
          onClick={onSave}
          size="sm"
          type="button"
          variant="outline"
        >
          <RiSave3Line data-icon="inline-start" />
          <span className="hidden sm:inline">{t("editor.actions.saveDraft")}</span>
        </Button>
        <Button
          aria-label={t("editor.actions.publish")}
          className="min-w-0 px-2.5 sm:px-3"
          disabled={isPending}
          onClick={onPublish}
          size="sm"
          type="button"
        >
          <RiRocketLine data-icon="inline-start" />
          <span className="hidden sm:inline">{t("editor.actions.publish")}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button aria-label={t("editor.actions.more")} size="icon-sm" type="button" variant="outline"><RiMore2Line /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={onToggleEditHints}>{showEditHints ? <RiEyeOffLine /> : <RiEyeLine />}{showEditHints ? t("editor.actions.hideOutlines") : t("editor.actions.showOutlines")}</DropdownMenuItem>
            <DropdownMenuItem asChild><a href={editorMeta.liveStorefrontUrl} rel="noreferrer" target="_blank"><RiExternalLinkLine />{t("editor.actions.openLive")}</a></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setResetOpen(true)}><RiResetLeftLine />{t("editor.actions.resetEditor")}</DropdownMenuItem>
            {isLive && onUnpublish ? <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => setPauseOpen(true)}><RiPauseLine />{t("editor.actions.pauseShop")}</DropdownMenuItem></> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConfirmDialog confirmLabel={t("editor.actions.resetConfirm")} description={t("editor.actions.resetDescription")} icon="question" onConfirm={() => { setResetOpen(false); onReset(); }} onOpenChange={setResetOpen} open={resetOpen} title={t("editor.actions.resetTitle")} tone="default" />
      {onUnpublish ? <ConfirmDialog cancelDisabled={isPending} confirmDisabled={isPending} confirmLabel={t("editor.actions.pauseConfirm")} description={t("editor.actions.pauseDescription")} icon="warning" onConfirm={() => { setPauseOpen(false); onUnpublish(); }} onOpenChange={setPauseOpen} open={pauseOpen} title={t("editor.actions.pauseTitle")} /> : null}
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
  onPublish: (data: EditorData) => void;
  onUnpublish?: (() => void) | undefined;
  onSave: (data: EditorData) => void;
  onToggleEditHints: () => void;
  onUndo: () => void;
  publicationStatus: PublicationStatus;
  showEditHints: boolean;
}) {
  const { t } = useI18n();
  const data = useStorefrontEditor((api) => api.appState.data);
  const props = getStorefrontPageProps(data);
  const [mobilePanel, setMobilePanel] = useState<EditorMobilePanel>("preview");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const manifest = getStorefrontEditorManifest(editorMeta.templateKey);
  const previewPages = manifest?.previewPages ?? [{ id: "home", label: "Home" }];
  const [previewPage, setPreviewPage] = useState(previewPages[0]?.id ?? "home");
  const [selectionInteractionActive, setSelectionInteractionActive] = useState(false);

  useEffect(() => {
    function clearSelection() {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setSelectedPath(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Let the first Escape close an active portal. A subsequent Escape clears editor selection.
      if (document.querySelector('[data-slot="dialog-content"],[data-slot="popover-content"]')) {
        return;
      }
      clearSelection();
    }
    function onPointerDown(event: PointerEvent) {
      if (selectionInteractionActive) return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        !target?.closest(
          '[data-editor-settings-path],[data-editor-selection-control],[data-slot="dialog-content"],[data-slot="dialog-overlay"],[data-slot="popover-content"],[data-slot="dropdown-menu-content"]',
        )
      ) {
        setSelectedPath(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [selectionInteractionActive]);

  return (
    <div
      className={cn(
        "storefront-editor-chrome flex min-h-0 min-w-0 flex-col rounded-2xl border border-border/80 bg-background shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]",
        isFullscreen ? "h-dvh overflow-hidden" : "overflow-visible",
      )}
    >
      <div className="sticky top-0 z-20 flex shrink-0 flex-col gap-2.5 border-b border-border/80 bg-background px-3 py-3 sm:gap-3 sm:px-4">
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
          "grid min-h-0 bg-muted/20 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]",
          isFullscreen ? "flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden" : "items-start overflow-visible",
        )}
        data-edit-hints={showEditHints ? "on" : "off"}
      >
        <div
          className={cn(
            "min-h-0 min-w-0 p-3 sm:p-5",
            isFullscreen ? "h-full overflow-hidden" : "h-[clamp(34rem,72dvh,52rem)] overflow-hidden lg:sticky lg:top-20",
            mobilePanel !== "preview" && "max-lg:hidden",
          )}
        >
          <div className={cn("mx-auto h-full min-h-0 w-full overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm", isFullscreen ? "max-w-none" : "max-w-6xl")}>
            <div className="flex h-full min-h-0 flex-col">
            {previewPages.length > 1 ? <div className="shrink-0 border-b border-border/80 bg-muted/15 p-2"><SegmentedControl ariaLabel="Preview page" onChange={(page) => { setPreviewPage(page); setSelectedPath(null); }} options={previewPages.map((page) => ({ id: page.id, label: page.label }))} size="sm" value={previewPage} /></div> : null}
            <div className="min-h-0 flex-1">
            <TemplatePreview
              isFullscreen={isFullscreen}
              onSelectPath={(path) => {
                setSelectedPath(path || null);
                const sectionPage = manifest?.sections.find((section) => section.fields.some((field) => path === field.path || path.startsWith(`${field.path}.`)))?.previewPage;
                if (sectionPage) setPreviewPage(sectionPage);
              }}
              onSelectionInteractionChange={setSelectionInteractionActive}
              props={props}
              selectedPath={selectedPath}
              showEditHints={showEditHints}
              storefrontName={editorMeta.storefrontName}
              templateKey={editorMeta.templateKey}
              previewUrl={editorMeta.previewUrl}
              previewPage={previewPage}
            />
            </div>
            </div>
          </div>
        </div>
        <aside
          className={cn(
            "flex min-h-0 flex-col border-t border-border/80 bg-background",
            isFullscreen ? "h-full overflow-hidden" : "h-auto overflow-visible",
            "lg:border-l lg:border-t-0",
            mobilePanel !== "settings" && "max-lg:hidden",
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
          <StorefrontSettingsPanel contained={isFullscreen} onSelectPath={(path) => {
            setSelectedPath(path);
            if (!path) return;
            const sectionPage = manifest?.sections.find((section) => section.fields.some((field) => path === field.path || path.startsWith(`${field.path}.`)))?.previewPage;
            if (sectionPage) setPreviewPage(sectionPage);
          }} selectedPath={selectedPath} templateKey={editorMeta.templateKey} />
        </aside>
      </div>
    </div>
  );
}
