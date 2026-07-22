"use client";

import "@puckeditor/core/puck.css";

import type { Data } from "@puckeditor/core";
import { Puck } from "@puckeditor/core";
import { useEffect, useMemo, useRef, useState } from "react";
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
} from "@/components/ui/alert-dialog";
import {
  buildPuckConfig,
  getErrorMessage,
  PuckDataOverride,
  StorefrontEditorShell,
} from "@/features/storefront-editor/editor-components";
import type { StorefrontVisualEditorProps } from "@/features/storefront-editor/editor-config";
import {
  HISTORY_COMMIT_DELAY_MS,
  HISTORY_LIMIT,
} from "@/features/storefront-editor/editor-config";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import {
  buildDraftPayload,
  buildPuckData,
  getPublicationStatus,
  serializeEditorData,
} from "./editor-state";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

export function StorefrontVisualEditor({
  draft,
  editorMeta,
  onPublish,
  onUnpublish,
  onSave,
}: StorefrontVisualEditorProps) {
  const { t, locale } = useI18n();
  const initialData = useMemo(() => buildPuckData(draft), [draft]);
  const initialSnapshot = useMemo(() => serializeEditorData(initialData), [initialData]);
  const initialPublishedSnapshot = useMemo(() => {
    if (draft.published) {
      return serializeEditorData(
        buildPuckData({
          ...draft,
          data: draft.published.data,
          themeTokens: draft.published.themeTokens,
        }),
      );
    }

    return editorMeta.initiallyPublished ? initialSnapshot : null;
  }, [draft, editorMeta.initiallyPublished, initialSnapshot]);
  const [editorData, setEditorData] = useState<Data>(initialData);
  const [history, setHistory] = useState<Data[]>([initialData]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [puckDataOverride, setPuckDataOverride] = useState<Data | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(initialSnapshot);
  const [publishedSnapshot, setPublishedSnapshot] = useState(initialPublishedSnapshot);
  const [isLive, setIsLive] = useState(
    Boolean(draft.published) || editorMeta.initiallyPublished,
  );
  const [showEditHints, setShowEditHints] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const historyRef = useRef<Data[]>([initialData]);
  const historyIndexRef = useRef(0);
  const pendingHistoryDataRef = useRef<Data | null>(null);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipHistoryRef = useRef(false);
  const config = useMemo(
    () => buildPuckConfig(draft.templateKey, editorMeta.storefrontName),
    [draft.templateKey, editorMeta.storefrontName],
  );

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  useEffect(
    () => () => {
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
      }
    },
    [],
  );

  function buildPayload(data: Data) {
    return buildDraftPayload({
      data: draft.data,
      editorData: data,
      tenantId: draft.tenantId,
      themeTokens: draft.themeTokens,
    });
  }

  async function saveCurrentDraft(data: Data) {
    const result = await onSave(buildPayload(data));

    if (!result.ok) {
      throw new Error(result.message);
    }

    setSavedSnapshot(serializeEditorData(data));
  }

  function handleSaveDraft(data: Data) {
    const promise = saveCurrentDraft(data);

    setIsPending(true);
    toast.promise(promise, {
      error: (error) => getErrorMessage(error, t("editor.toast.draftSaveFailed")),
      finally: () => setIsPending(false),
      loading: t("editor.toast.savingDraft"),
      success: t("editor.toast.draftSaved"),
    });
  }

  function handlePublishDraft(data: Data) {
    const payload = buildPayload(data);
    const promise = (async () => {
      const saved = await onSave(payload);

      if (!saved.ok) {
        throw new Error(saved.message);
      }

      const published = await onPublish(draft.tenantId);

      if (!published.ok) {
        throw new Error(published.message);
      }

      const snapshot = serializeEditorData(data);
      setSavedSnapshot(snapshot);
      setPublishedSnapshot(snapshot);
      setIsLive(true);
    })();

    setIsPending(true);
    toast.promise(promise, {
      error: (error) => getErrorMessage(error, t("editor.toast.publishFailed")),
      finally: () => setIsPending(false),
      loading: t("editor.toast.publishing"),
      success: t("editor.toast.published"),
    });
  }

  function handleUnpublishShop() {
    if (!onUnpublish) return;

    const promise = (async () => {
      const result = await onUnpublish(draft.tenantId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      setPublishedSnapshot(null);
      setIsLive(false);
    })();

    setIsPending(true);
    toast.promise(promise, {
      error: (error) => getErrorMessage(error, t("editor.toast.pauseFailed")),
      finally: () => setIsPending(false),
      loading: t("editor.toast.pausing"),
      success: t("editor.toast.paused"),
    });
  }

  function commitHistory(nextData: Data) {
    const current = historyRef.current;
    const currentIndex = historyIndexRef.current;
    const latest = current[currentIndex];

    if (latest && serializeEditorData(latest) === serializeEditorData(nextData)) {
      return;
    }

    const nextHistory = [...current.slice(0, currentIndex + 1), nextData].slice(-HISTORY_LIMIT);
    const nextIndex = nextHistory.length - 1;

    historyRef.current = nextHistory;
    historyIndexRef.current = nextIndex;
    setHistory(nextHistory);
    setHistoryIndex(nextIndex);
  }

  function scheduleHistoryCommit(nextData: Data) {
    pendingHistoryDataRef.current = nextData;

    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
    }

    historyTimerRef.current = setTimeout(() => {
      if (pendingHistoryDataRef.current) {
        commitHistory(pendingHistoryDataRef.current);
      }

      pendingHistoryDataRef.current = null;
      historyTimerRef.current = null;
    }, HISTORY_COMMIT_DELAY_MS);
  }

  function flushHistoryCommit() {
    if (!historyTimerRef.current) {
      return;
    }

    clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;

    if (pendingHistoryDataRef.current) {
      commitHistory(pendingHistoryDataRef.current);
    }

    pendingHistoryDataRef.current = null;
  }

  function handleEditorChange(nextData: Data) {
    setEditorData(nextData);
    setPuckDataOverride(null);

    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }

    scheduleHistoryCommit(nextData);
  }

  function setDataFromHistory(nextData: Data, nextIndex: number) {
    skipHistoryRef.current = true;
    setPuckDataOverride(nextData);
    setEditorData(nextData);
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
  }

  function handleUndo() {
    flushHistoryCommit();

    if (historyIndexRef.current <= 0) {
      return;
    }

    const nextIndex = historyIndexRef.current - 1;
    const nextData = historyRef.current[nextIndex];

    if (nextData) {
      setDataFromHistory(nextData, nextIndex);
    }
  }

  function handleRedo() {
    flushHistoryCommit();

    if (historyIndexRef.current >= historyRef.current.length - 1) {
      return;
    }

    const nextIndex = historyIndexRef.current + 1;
    const nextData = historyRef.current[nextIndex];

    if (nextData) {
      setDataFromHistory(nextData, nextIndex);
    }
  }

  function handleReset() {
    skipHistoryRef.current = true;
    setPuckDataOverride(initialData);
    setEditorData(initialData);
    historyRef.current = [initialData];
    historyIndexRef.current = 0;
    pendingHistoryDataRef.current = null;
    setHistory([initialData]);
    setHistoryIndex(0);
    setSavedSnapshot(initialSnapshot);
    setPublishedSnapshot(initialPublishedSnapshot);
    toast(t("editor.toast.reset"));
  }

  const currentSnapshot = serializeEditorData(editorData);
  const publicationStatus = getPublicationStatus({
    currentSnapshot,
    publishedSnapshot,
    savedSnapshot,
  });
  // Block leave only for edits not yet saved as a draft (badge: Unpublished edits).
  const hasUnsavedChanges = currentSnapshot !== savedSnapshot;
  const { leaveDialogOpen, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(hasUnsavedChanges);

  return (
    <div
      className={cn(
        "storefront-puck-editor flex min-h-0 flex-1 flex-col transition-all duration-300 ease-out",
        // Pin Ethiopic UI face so Puck's Inter tokens cannot fall back to a system Amharic font.
        locale === "am" && "storefront-puck-editor--am",
        isFullscreen &&
          "fixed inset-0 z-50 animate-in fade-in-0 bg-background p-2 duration-200 sm:p-3",
      )}
    >
      <Puck
        config={config}
        data={editorData}
        onChange={handleEditorChange}
        permissions={{
          delete: false,
          drag: false,
          duplicate: false,
          insert: false,
        }}
        ui={{
          itemSelector: {
            index: 0,
            zone: "default-zone",
          },
          leftSideBarVisible: false,
          rightSideBarVisible: true,
        }}
      >
        <PuckDataOverride data={puckDataOverride} />
        <StorefrontEditorShell
          canRedo={historyIndex < history.length - 1}
          canUndo={historyIndex > 0}
          editorMeta={editorMeta}
          isFullscreen={isFullscreen}
          isLive={isLive}
          isPending={isPending}
          publicationStatus={publicationStatus}
          onRedo={handleRedo}
          onReset={handleReset}
          onToggleFullscreen={() => setIsFullscreen((current) => !current)}
          onPublish={handlePublishDraft}
          onUnpublish={onUnpublish ? handleUnpublishShop : undefined}
          onSave={handleSaveDraft}
          onToggleEditHints={() => setShowEditHints((current) => !current)}
          onUndo={handleUndo}
          showEditHints={showEditHints}
        />
      </Puck>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) cancelLeave();
        }}
        open={leaveDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("editor.actions.leaveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("editor.actions.leaveDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLeave}>
              {t("editor.actions.stay")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave} variant="destructive">
              {t("editor.actions.leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
