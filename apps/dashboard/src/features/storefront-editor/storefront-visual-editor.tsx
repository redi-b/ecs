"use client";

import "@puckeditor/core/puck.css";

import type { Config, Data, PuckAction } from "@puckeditor/core";
import { createUsePuck, FieldLabel, Puck } from "@puckeditor/core";
import { classicV1EditorSchema as classicV1EditorManifest } from "@ecs/storefront-templates";
import {
  RiCheckLine,
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
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
import { cn } from "@/lib/utils";
import {
  buildDraftPayload,
  buildPuckData,
  getPublicationStatus,
  getStorefrontPageProps,
  isPreviewImageUrl,
  serializeEditorData,
  STOREFRONT_PAGE_COMPONENT,
  type PublicationStatus,
  type StorefrontDraft,
  type StorefrontPageProps,
} from "./editor-state";

import type { ActionResult, StorefrontVisualEditorProps } from "@/features/storefront-editor/editor-config";
import {
  FONT_OPTIONS,
  HISTORY_COMMIT_DELAY_MS,
  HISTORY_LIMIT,
  useStorefrontPuck,
} from "@/features/storefront-editor/editor-config";
import {
  buildPuckConfig,
  getErrorMessage,
  PuckDataOverride,
  StorefrontEditorShell,
} from "@/features/storefront-editor/editor-components";

export function StorefrontVisualEditor({
  draft,
  editorMeta,
  onPublish,
  onSave,
}: StorefrontVisualEditorProps) {
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
      error: (error) => getErrorMessage(error, "Draft could not be saved."),
      finally: () => setIsPending(false),
      loading: "Saving draft...",
      success: "Draft saved.",
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
    })();

    setIsPending(true);
    toast.promise(promise, {
      error: (error) => getErrorMessage(error, "Storefront could not be published."),
      finally: () => setIsPending(false),
      loading: "Publishing storefront...",
      success: "Storefront published.",
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
    toast("Editor reset to the last loaded draft.");
  }

  const currentSnapshot = serializeEditorData(editorData);
  const publicationStatus = getPublicationStatus({
    currentSnapshot,
    publishedSnapshot,
    savedSnapshot,
  });

  return (
    <div
      className={cn(
        "storefront-puck-editor flex flex-col gap-4 transition-all duration-300 ease-out",
        isFullscreen &&
          "fixed inset-0 z-50 animate-in fade-in-0 zoom-in-95 bg-background p-3 shadow-2xl duration-200",
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
          isPending={isPending}
          publicationStatus={publicationStatus}
          onRedo={handleRedo}
          onReset={handleReset}
          onToggleFullscreen={() => setIsFullscreen((current) => !current)}
          onPublish={handlePublishDraft}
          onSave={handleSaveDraft}
          onToggleEditHints={() => setShowEditHints((current) => !current)}
          onUndo={handleUndo}
          showEditHints={showEditHints}
        />
      </Puck>
    </div>
  );
}

