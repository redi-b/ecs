"use client";

import type { UppyFile } from "@uppy/core";
import { useEffect, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { formatBytes } from "./media-helpers";

const EXIT_MS = 220;

export type QueueFileStatus = "pending" | "uploading" | "processing" | "done" | "failed";

export type QueueFileView = {
  error?: string | null;
  id: string;
  name: string;
  previewUrl?: string | undefined;
  progress: number;
  size: number;
  status: QueueFileStatus;
};

type UploadMeta = { assetId?: string };

export function MediaUploadQueue({
  collapsed,
  files,
  onClearFinished,
  onCollapseChange,
  onDismiss,
  onRemove,
  onRetryFailed,
  open,
}: {
  collapsed: boolean;
  files: QueueFileView[];
  onClearFinished: () => void;
  onCollapseChange: (collapsed: boolean) => void;
  onDismiss: () => void;
  onRemove: (fileId: string) => void;
  onRetryFailed: () => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const isVisible = open && files.length > 0;
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [active, setActive] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [snapshot, setSnapshot] = useState(files);

  useEffect(() => {
    if (isVisible) {
      setSnapshot(files);
      setExiting(false);
      setShouldRender(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setActive(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setActive(false);
    setExiting(true);
    const timeout = window.setTimeout(() => {
      setShouldRender(false);
      setExiting(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [isVisible]);

  useEffect(() => {
    if (isVisible) setSnapshot(files);
  }, [files, isVisible]);

  if (!shouldRender) return null;

  const queueFiles = isVisible ? files : snapshot;
  const total = queueFiles.length;
  const done = queueFiles.filter((file) => file.status === "done").length;
  const failed = queueFiles.filter((file) => file.status === "failed").length;
  const activeCount = queueFiles.filter(
    (file) => file.status === "uploading" || file.status === "processing",
  ).length;
  const overall =
    total === 0
      ? 0
      : Math.round(
          queueFiles.reduce((sum, file) => sum + Math.min(100, file.progress), 0) / total,
        );
  const busy = activeCount > 0 || queueFiles.some((file) => file.status === "pending");
  const finished = !busy;
  const expanded = !collapsed;

  return (
    <div
      aria-hidden={!active}
      className={cn(
        "fixed right-4 bottom-4 z-[60] w-[min(24rem,calc(100vw-2rem))]",
        "origin-bottom-right duration-200 ease-out fill-mode-forwards",
        active
          ? "animate-in fade-in-0 slide-in-from-bottom-3 zoom-in-95"
          : exiting
            ? "pointer-events-none animate-out fade-out-0 slide-out-to-bottom-3 zoom-out-95"
            : "pointer-events-none opacity-0 translate-y-3",
      )}
    >
      <div className="overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5">
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg border bg-background">
                <AppIcons.upload className={cn("size-3.5", busy && "animate-pulse")} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t("media.queueTitle")}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {busy
                    ? t("media.queueUploading", {
                        active: activeCount || total - done - failed,
                        total,
                      })
                    : finished && done === total
                      ? t("media.queueIdle")
                      : t("media.queueCollapsed", { done, total })}
                </p>
              </div>
            </div>
          </div>
          <Badge variant={failed ? "destructive" : busy ? "secondary" : "outline"}>
            {overall}%
          </Badge>
          <Button
            aria-expanded={expanded}
            aria-label={collapsed ? t("media.queueExpand") : t("media.queueCollapse")}
            onClick={() => onCollapseChange(!collapsed)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <AppIcons.arrowDown
              className={cn(
                "size-4 transition-transform duration-200 ease-out",
                expanded && "rotate-180",
              )}
            />
          </Button>
          {finished ? (
            <Button
              aria-label={t("media.queueDismiss")}
              onClick={onDismiss}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <AppIcons.close />
            </Button>
          ) : null}
        </div>

        <div className="h-1 bg-muted">
          <div
            className={cn(
              "h-full transition-[width] duration-300 ease-out",
              failed && !busy ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${overall}%` }}
          />
        </div>

        {/* Height animation via grid rows (more reliable than opacity-only collapsible). */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="max-h-72 overflow-y-auto overscroll-contain">
              <ul className="divide-y">
                {queueFiles.map((file) => (
                  <li className="flex items-center gap-3 px-3 py-2.5" key={file.id}>
                    <div className="size-11 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {file.previewUrl ? (
                        // biome-ignore lint/performance/noImgElement: Local object URL preview.
                        <img alt="" className="size-full object-cover" src={file.previewUrl} />
                      ) : (
                        <span className="grid size-full place-items-center text-muted-foreground">
                          <AppIcons.image className="size-4" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {statusLabel(file.status, t)} · {formatBytes(file.size)}
                        </span>
                      </div>
                      {file.status === "uploading" || file.status === "processing" ? (
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                            style={{ width: `${Math.max(4, file.progress)}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <StatusDot status={file.status} />
                      {file.status === "failed" || file.status === "pending" ? (
                        <Button
                          aria-label={t("media.remove")}
                          onClick={() => onRemove(file.id)}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <AppIcons.close />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {t("media.queueCollapsed", { done, total })}
              </p>
              <div className="flex gap-1">
                {failed > 0 ? (
                  <Button onClick={onRetryFailed} size="xs" type="button" variant="outline">
                    {t("media.queueRetryFailed")}
                  </Button>
                ) : null}
                {done > 0 || failed > 0 ? (
                  <Button onClick={onClearFinished} size="xs" type="button" variant="ghost">
                    {t("media.queueClearDone")}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: QueueFileStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 rounded-full",
        status === "done" && "bg-emerald-500",
        status === "failed" && "bg-destructive",
        status === "uploading" && "animate-pulse bg-primary",
        status === "processing" && "animate-pulse bg-amber-500",
        status === "pending" && "bg-muted-foreground/40",
      )}
    />
  );
}

function statusLabel(status: QueueFileStatus, t: ReturnType<typeof useI18n>["t"]) {
  switch (status) {
    case "uploading":
      return t("media.queueItemUploading");
    case "processing":
      return t("media.queueItemProcessing");
    case "done":
      return t("media.queueItemDone");
    case "failed":
      return t("media.queueItemFailed");
    default:
      return t("media.queueItemPending");
  }
}

export function mapUppyFileToQueueView(
  file: UppyFile<UploadMeta, Record<string, never>>,
  previewUrl: string | undefined,
  completion: "idle" | "processing" | "done" | "failed",
): QueueFileView {
  const progress = file.progress?.percentage ?? 0;
  let status: QueueFileStatus = "pending";

  if (completion === "done") status = "done";
  else if (completion === "failed" || file.error) status = "failed";
  else if (completion === "processing") status = "processing";
  else if (file.progress?.uploadStarted && !file.progress?.uploadComplete) status = "uploading";
  else if (file.progress?.uploadComplete) status = "processing";

  return {
    error: file.error ? String(file.error) : null,
    id: file.id,
    name: file.name ?? "image",
    previewUrl,
    progress: completion === "done" ? 100 : progress,
    size: file.size ?? 0,
    status,
  };
}
