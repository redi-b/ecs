"use client";

import { getStorefrontEditorManifest } from "@ecs/storefront-templates";

import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiComputerLine,
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
  RiSideBarLine,
  RiSmartphoneLine,
} from "@remixicon/react";
import { type ReactNode, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StorefrontVisualEditorProps } from "@/features/storefront-editor/editor-config";
import { useStorefrontEditor } from "@/features/storefront-editor/editor-config";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

import { TemplatePreview } from "./editor-preview";
import { StorefrontSettingsPanel } from "./editor-settings";
import { type EditorData, getStorefrontPageProps, type PublicationStatus } from "./editor-state";

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
  canEdit,
  canPublish,
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
  onToggleSettings,
  onToggleEditHints,
  onUndo,
  showEditHints,
  settingsOpen,
}: {
  canEdit: boolean;
  canPublish: boolean;
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
  onToggleSettings: () => void;
  onToggleEditHints: () => void;
  onUndo: () => void;
  showEditHints: boolean;
  settingsOpen: boolean;
}) {
  const { t } = useI18n();
  const [hasMounted, setHasMounted] = useState(false);
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
      {canEdit ? (
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
          <Separator className="mx-0.5 hidden h-5 lg:block" orientation="vertical" />
          <span className="hidden lg:inline-flex">
            <ToolbarIconButton
              label={
                settingsOpen ? t("editor.actions.hideSettings") : t("editor.actions.showSettings")
              }
              onClick={onToggleSettings}
              pressed={settingsOpen}
            >
              <RiSideBarLine />
            </ToolbarIconButton>
          </span>
        </div>
      ) : null}
      <div className="flex min-w-0 items-center justify-end gap-2">
        {canEdit ? (
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
        ) : null}
        {canPublish ? (
          <Button
            className="min-w-0"
            disabled={isPending}
            onClick={onPublish}
            size="sm"
            type="button"
          >
            <RiRocketLine data-icon="inline-start" />
            {t("editor.actions.publish")}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={t("editor.actions.more")}
              disabled={isPending}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <RiMore2Line />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              {canEdit ? (
                <DropdownMenuItem onSelect={onToggleEditHints}>
                  {showEditHints ? <RiEyeOffLine /> : <RiEyeLine />}
                  {showEditHints
                    ? t("editor.actions.hideOutlines")
                    : t("editor.actions.showOutlines")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={onToggleFullscreen}>
                {isFullscreen ? <RiFullscreenExitLine /> : <RiFullscreenLine />}
                {isFullscreen ? t("editor.actions.exitFullscreen") : t("editor.actions.fullscreen")}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={editorMeta.liveStorefrontUrl} rel="noreferrer" target="_blank">
                  <RiExternalLinkLine />
                  {t("editor.actions.openLive")}
                </a>
              </DropdownMenuItem>
              {canEdit ? (
                <DropdownMenuItem asChild>
                  <a href={editorMeta.settingsUrl}>
                    <RiEditLine />
                    {t("editor.settings.changeTemplate")}
                  </a>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {canEdit ? (
                <DropdownMenuItem onSelect={() => setResetConfirmOpen(true)}>
                  <RiResetLeftLine />
                  {t("editor.actions.resetEditor")}
                </DropdownMenuItem>
              ) : null}
              {isLive && onUnpublish ? (
                <DropdownMenuItem onSelect={() => setPauseConfirmOpen(true)} variant="destructive">
                  <RiPauseLine />
                  {t("editor.actions.pauseShop")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {canEdit ? (
        <ConfirmDialog
          confirmLabel={t("editor.actions.resetConfirm")}
          description={t("editor.actions.resetDescription")}
          icon="question"
          onConfirm={() => {
            setResetConfirmOpen(false);
            onReset();
          }}
          onOpenChange={setResetConfirmOpen}
          open={resetConfirmOpen}
          title={t("editor.actions.resetTitle")}
          tone="default"
        />
      ) : null}
      {onUnpublish ? (
        <ConfirmDialog
          cancelDisabled={isPending}
          confirmDisabled={isPending}
          confirmLabel={t("editor.actions.pauseConfirm")}
          description={t("editor.actions.pauseDescription")}
          icon="warning"
          onConfirm={() => {
            setPauseConfirmOpen(false);
            onUnpublish();
          }}
          onOpenChange={setPauseConfirmOpen}
          open={pauseConfirmOpen}
          title={t("editor.actions.pauseTitle")}
        />
      ) : null}
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
type EditorPreviewViewport = "desktop" | "mobile";

export function StorefrontEditorShell({
  canEdit,
  canPublish,
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
  canEdit: boolean;
  canPublish: boolean;
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
  const [previewViewport, setPreviewViewport] = useState<EditorPreviewViewport>("desktop");
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const manifest = getStorefrontEditorManifest(editorMeta.templateKey);
  const previewPages = manifest?.previewPages ?? [{ id: "home", label: "Home" }];
  const [previewPage, setPreviewPage] = useState(previewPages[0]?.id ?? "home");
  const [selectionInteractionActive, setSelectionInteractionActive] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setPreviewViewport("mobile");
    }
  }, []);

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
        "storefront-editor-chrome flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-background shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]",
        isFullscreen && "h-dvh",
      )}
    >
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border/80 bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium tracking-tight">
              {t("editor.shell.title")}
            </div>
            <div className="truncate text-xs text-muted-foreground">{editorMeta.templateName}</div>
          </div>
          {!isLive ? <ShopLiveStatusBadge live={false} /> : null}
          <PublicationStatusBadge status={publicationStatus} />
        </div>
        <StorefrontEditorActions
          canEdit={canEdit}
          canPublish={canPublish}
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
          onToggleSettings={() => setSettingsOpen((current) => !current)}
          onToggleEditHints={onToggleEditHints}
          onUndo={onUndo}
          showEditHints={showEditHints}
          settingsOpen={settingsOpen}
        />
      </div>

      {canEdit ? (
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
      ) : null}

      <div
        className={cn(
          "contain-strict flex h-[clamp(40rem,calc(100dvh-11rem),58rem)] min-h-0 flex-none overflow-hidden bg-muted/20",
          isFullscreen && "h-auto flex-1",
        )}
        data-edit-hints={showEditHints ? "on" : "off"}
      >
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-hidden p-3 sm:p-5",
            isFullscreen && "h-full",
            mobilePanel !== "preview" && "max-lg:hidden",
          )}
        >
          <div
            className={cn(
              "mx-auto h-full min-h-0 w-full overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm",
              isFullscreen ? "max-w-none" : "max-w-6xl",
            )}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-muted/15 p-2">
                <PreviewPageSwitcher
                  ariaLabel={t("editor.preview.page")}
                  onChange={(page) => {
                    setPreviewPage(page);
                    setSelectedPath(null);
                  }}
                  pages={previewPages}
                  value={previewPage}
                />
                <SegmentedControl
                  ariaLabel={t("editor.preview.viewport")}
                  className="shrink-0 [&_svg]:size-4"
                  fullWidth={false}
                  onChange={setPreviewViewport}
                  options={[
                    {
                      ariaLabel: t("editor.preview.desktop"),
                      id: "desktop",
                      label: <RiComputerLine className="size-4" aria-hidden />,
                    },
                    {
                      ariaLabel: t("editor.preview.mobile"),
                      id: "mobile",
                      label: <RiSmartphoneLine className="size-4" aria-hidden />,
                    },
                  ]}
                  size="sm"
                  value={previewViewport}
                />
              </div>
              <div className="min-h-0 flex-1">
                <TemplatePreview
                  {...(canEdit
                    ? {
                        onSelectPath: (path: string) => {
                          setSelectedPath(path || null);
                          if (path) setSettingsOpen(true);
                          const sectionPage = manifest?.sections.find((section) =>
                            section.fields.some(
                              (field) => path === field.path || path.startsWith(`${field.path}.`),
                            ),
                          )?.previewPage;
                          if (sectionPage) setPreviewPage(sectionPage);
                        },
                      }
                    : {})}
                  onSelectionInteractionChange={setSelectionInteractionActive}
                  props={props}
                  selectedPath={selectedPath}
                  showEditHints={canEdit && showEditHints}
                  storefrontName={editorMeta.storefrontName}
                  templateKey={editorMeta.templateKey}
                  previewUrl={editorMeta.previewUrl}
                  previewPage={previewPage}
                  viewport={previewViewport}
                />
              </div>
            </div>
          </div>
        </div>
        {canEdit ? (
          <aside
            className={cn(
              "flex h-full min-h-0 w-full flex-col overflow-hidden border-t border-border/80 bg-background transition-[width,opacity] duration-200 ease-out",
              "lg:w-[clamp(18rem,20vw,24rem)] lg:flex-none lg:border-l lg:border-t-0",
              !settingsOpen && "lg:pointer-events-none lg:w-0 lg:border-l-0 lg:opacity-0",
              mobilePanel !== "settings" && "max-lg:hidden",
            )}
          >
            <StorefrontSettingsPanel
              onSelectPath={(path) => {
                setSelectedPath(path);
                if (!path) return;
                const sectionPage = manifest?.sections.find((section) =>
                  section.fields.some(
                    (field) => path === field.path || path.startsWith(`${field.path}.`),
                  ),
                )?.previewPage;
                if (sectionPage) setPreviewPage(sectionPage);
              }}
              selectedPath={selectedPath}
              templateKey={editorMeta.templateKey}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function PreviewPageSwitcher({
  ariaLabel,
  onChange,
  pages,
  value,
}: {
  ariaLabel: string;
  onChange: (page: string) => void;
  pages: Array<{ id: string; label: string }>;
  value: string;
}) {
  if (pages.length <= 1) return <span />;

  if (pages.length <= 3) {
    return (
      <SegmentedControl
        ariaLabel={ariaLabel}
        className="min-w-0 max-w-md"
        onChange={onChange}
        options={pages.map((page) => ({ id: page.id, label: page.label }))}
        size="sm"
        value={value}
      />
    );
  }

  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger aria-label={ariaLabel} className="w-[min(13rem,55vw)]" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {pages.map((page) => (
          <SelectItem key={page.id} value={page.id}>
            {page.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
