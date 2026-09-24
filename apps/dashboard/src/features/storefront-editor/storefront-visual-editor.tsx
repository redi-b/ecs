"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { UnsavedChangesDialog } from "@/components/app/unsaved-changes-dialog";
import {
  getErrorMessage,
  StorefrontEditorShell,
} from "@/features/storefront-editor/editor-components";
import type { StorefrontVisualEditorProps } from "@/features/storefront-editor/editor-config";
import {
  HISTORY_COMMIT_DELAY_MS,
  HISTORY_LIMIT,
  StorefrontEditorProvider,
} from "@/features/storefront-editor/editor-config";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useI18n } from "@/i18n/provider";
import { markStorefrontEditorVisited } from "@/lib/launch-assistant-preferences";
import { cn } from "@/lib/utils";
import {
  buildDraftPayload,
  buildEditorData,
  type EditorData,
  getLocalizedStatusOverrides,
  getLocalizedTranslations,
  getPublicationStatus,
  serializeEditorData,
} from "./editor-state";

export function StorefrontVisualEditor({
  canEdit = true,
  canPublish = true,
  draft,
  editorMeta,
  onPublish,
  onUnpublish,
  onSave,
}: StorefrontVisualEditorProps) {
  const { t, locale } = useI18n();
  const initialData = useMemo(() => buildEditorData(draft), [draft]);
  const initialSnapshot = useMemo(() => serializeEditorData(initialData), [initialData]);
  const initialPublishedSnapshot = useMemo(() => {
    if (draft.published?.templateKey === draft.templateKey) {
      return serializeEditorData(
        buildEditorData({
          ...draft,
          data: draft.published.data,
          ...(draft.published.localizedContent
            ? { localizedContent: draft.published.localizedContent }
            : {}),
          themeTokens: draft.published.themeTokens,
        }),
      );
    }

    if (draft.published) return null;
    return editorMeta.initiallyPublished ? initialSnapshot : null;
  }, [draft, editorMeta.initiallyPublished, initialSnapshot]);
  const [editorData, setEditorData] = useState<EditorData>(initialData);
  const [history, setHistory] = useState<EditorData[]>([initialData]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState(initialSnapshot);
  const [publishedSnapshot, setPublishedSnapshot] = useState(initialPublishedSnapshot);
  const [isLive, setIsLive] = useState(Boolean(draft.published) || editorMeta.initiallyPublished);
  const [showEditHints, setShowEditHints] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const historyRef = useRef<EditorData[]>([initialData]);
  const historyIndexRef = useRef(0);
  const pendingHistoryDataRef = useRef<EditorData | null>(null);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipHistoryRef = useRef(false);
  const savedTranslationsRef = useRef(getLocalizedTranslations(initialData));

  useEffect(() => {
    if (canEdit) markStorefrontEditorVisited(draft.tenantId);
  }, [canEdit, draft.tenantId]);

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
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
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

  function buildPayload(data: EditorData) {
    return buildDraftPayload({
      data: draft.data,
      editorData: data,
      templateKey: draft.templateKey,
      tenantId: draft.tenantId,
      themeTokens: draft.themeTokens,
    });
  }

  async function saveCurrentDraft(data: EditorData) {
    const result = await onSave(buildPayload(data));

    if (!result.ok) {
      throw new Error(result.message);
    }

    const translations = getLocalizedTranslations(data);
    const reviewRequests = getLocalizedStatusOverrides(data);
    const changedTranslations = Object.fromEntries(
      Object.entries(translations).filter(
        ([path, value]) =>
          savedTranslationsRef.current[path] !== value || reviewRequests[path] === "ready",
      ),
    );
    if (Object.keys(changedTranslations).length) {
      const response = await fetch("/dashboard/storefront/translations/content", {
        body: JSON.stringify({
          locale: "am",
          tenantId: draft.tenantId,
          translations: changedTranslations,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "translation_save_failed");
      }
      savedTranslationsRef.current = { ...translations };
    }

    setSavedSnapshot(serializeEditorData(data));
  }

  function handleSaveDraft(data: EditorData) {
    const promise = saveCurrentDraft(data);

    setIsPending(true);
    toast.promise(promise, {
      error: (error) => getErrorMessage(error, t("editor.toast.draftSaveFailed")),
      finally: () => setIsPending(false),
      loading: t("editor.toast.savingDraft"),
      success: t("editor.toast.draftSaved"),
    });
  }

  function handlePublishDraft(data: EditorData) {
    const promise = (async () => {
      await saveCurrentDraft(data);

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
      error: (error) =>
        error instanceof Error && error.message === "launch_not_ready"
          ? t("editor.toast.launchNotReady")
          : error instanceof Error && error.message === "launch_check_unavailable"
            ? t("editor.toast.launchCheckUnavailable")
            : getErrorMessage(error, t("editor.toast.publishFailed")),
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

  function commitHistory(nextData: EditorData) {
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

  function scheduleHistoryCommit(nextData: EditorData) {
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

  function handleEditorChange(nextData: EditorData) {
    if (!canEdit) return;
    setEditorData(nextData);

    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }

    scheduleHistoryCommit(nextData);
  }

  function setDataFromHistory(nextData: EditorData, nextIndex: number) {
    skipHistoryRef.current = true;
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
    setEditorData(initialData);
    historyRef.current = [initialData];
    historyIndexRef.current = 0;
    pendingHistoryDataRef.current = null;
    setHistory([initialData]);
    setHistoryIndex(0);
    setSavedSnapshot(initialSnapshot);
    savedTranslationsRef.current = getLocalizedTranslations(initialData);
    setPublishedSnapshot(initialPublishedSnapshot);
    toast(t("editor.toast.reset"));
  }

  const currentSnapshot = serializeEditorData(editorData);
  const publicationStatus = getPublicationStatus({
    currentSnapshot,
    publishedSnapshot,
    savedSnapshot,
  });
  const hasUnsavedChanges = canEdit && currentSnapshot !== savedSnapshot;
  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedChangesGuard(hasUnsavedChanges);

  return (
    <div
      className={cn(
        "storefront-editor-runtime min-h-0 w-full flex-none transition-all duration-300 ease-out",
        // Keep the editor chrome on the configured Ethiopic UI face in Amharic.
        locale === "am" && "storefront-editor-runtime--am",
        isFullscreen &&
          "fixed inset-0 z-50 animate-in fade-in-0 bg-background p-2 duration-200 sm:p-3",
      )}
    >
      <StorefrontEditorProvider data={editorData} onChange={handleEditorChange}>
        <StorefrontEditorShell
          canEdit={canEdit}
          canPublish={canEdit && canPublish}
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
          onUnpublish={canEdit && canPublish && onUnpublish ? handleUnpublishShop : undefined}
          onSave={handleSaveDraft}
          onToggleEditHints={() => setShowEditHints((current) => !current)}
          onUndo={handleUndo}
          showEditHints={showEditHints}
          enabledStorefrontLocales={draft.languageSettings?.enabledLocales ?? ["en"]}
        />
      </StorefrontEditorProvider>

      <UnsavedChangesDialog onLeave={confirmLeave} onStay={cancelLeave} open={leaveDialogOpen} />
    </div>
  );
}
