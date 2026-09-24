"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { usePermission } from "@/components/app/access-context";
import { AppIcons } from "@/components/app/icons";
import { ListSummary } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  MediaOrientationFilter,
  MediaSizeFilter,
  MediaSort,
} from "@/features/media/media-helpers";
import { MediaLibrary } from "@/features/media/media-library";
import { fetchMediaPickerPage } from "@/features/media/media-picker-query";
import {
  MEDIA_UPLOADED_EVENT,
  OPEN_MEDIA_UPLOAD_EVENT,
} from "@/features/media/media-upload-composer";
import { useI18n } from "@/i18n/provider";
import type { MediaAsset } from "@/lib/merchant-media";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

export function MediaWorkspace({
  children,
  initialAssets,
  initialError,
  initialMimeType = "all",
  initialOrientation = "all",
  initialQuery = "",
  initialSize = "all",
  initialSort = "newest",
  page,
  pageSize,
  totalCount: initialTotalCount,
}: {
  children?: ReactNode;
  initialAssets: MediaAsset[];
  initialError?: string | undefined;
  initialMimeType?: string | undefined;
  initialOrientation?: MediaOrientationFilter | undefined;
  initialQuery?: string | undefined;
  initialSize?: MediaSizeFilter | undefined;
  initialSort?: MediaSort | undefined;
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  const { t } = useI18n();
  const canManage = usePermission("media.manage");
  const [assets, setAssets] = useState(initialAssets);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(Boolean(initialError));
  const refreshController = useRef<AbortController | null>(null);

  useEffect(() => {
    refreshController.current?.abort();
    setRefreshing(false);
    setAssets(initialAssets);
    setTotalCount(initialTotalCount);
    setLoadError(Boolean(initialError));
  }, [initialAssets, initialError, initialTotalCount]);

  const refresh = useCallback(async () => {
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    setRefreshing(true);
    const offset = (page - 1) * pageSize;
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });
    if (initialQuery.trim()) params.set("q", initialQuery.trim());
    if (initialMimeType && initialMimeType !== "all") {
      params.set("mimeType", initialMimeType);
    }
    if (initialOrientation !== "all") params.set("orientation", initialOrientation);
    if (initialSize !== "all") params.set("size", initialSize);
    if (initialSort !== "newest") params.set("sort", initialSort);
    try {
      const data = await fetchMediaPickerPage(params, controller.signal);
      if (controller.signal.aborted) return;
      setAssets(data.assets);
      setTotalCount(data.count);
      setLoadError(false);
    } catch {
      if (!controller.signal.aborted) setLoadError(true);
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }, [initialMimeType, initialOrientation, initialQuery, initialSize, initialSort, page, pageSize]);

  useEffect(() => {
    const refreshLibrary = () => void refresh();
    window.addEventListener(MEDIA_UPLOADED_EVENT, refreshLibrary);
    return () => {
      window.removeEventListener(MEDIA_UPLOADED_EVENT, refreshLibrary);
      refreshController.current?.abort();
    };
  }, [refresh]);

  return (
    <PageShell
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-busy={refreshing}
                aria-label={refreshing ? t("common.refreshing") : t("media.refresh")}
                disabled={refreshing}
                onClick={() => void refresh()}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <AppIcons.refresh className={refreshing ? "animate-spin" : undefined} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {refreshing ? t("common.refreshing") : t("media.refresh")}
            </TooltipContent>
          </Tooltip>
          {canManage ? (
            <Button
              onClick={() => window.dispatchEvent(new Event(OPEN_MEDIA_UPLOAD_EVENT))}
              type="button"
            >
              <AppIcons.upload data-icon="inline-start" />
              {t("media.uploadNew")}
            </Button>
          ) : null}
        </>
      }
      title={t("media.shellTitle")}
    >
      <ListSummary
        count={totalCount}
        filtered={
          Boolean(initialQuery.trim()) ||
          (initialMimeType !== "all" && Boolean(initialMimeType)) ||
          initialOrientation !== "all" ||
          initialSize !== "all" ||
          initialSort !== "newest"
        }
        page={page}
        pageSize={pageSize}
      />
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        {t("media.libraryTaggingHint")}
      </p>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("media.libraryLoadError")}</AlertTitle>
          <AlertDescription>
            {mapPlatformErrorMessage(initialError, {
              fallback: t("media.libraryLoadErrorDescription"),
              resource: "Media",
            })}
          </AlertDescription>
        </Alert>
      ) : null}
      <MediaLibrary
        assets={assets}
        footer={children}
        initialMimeType={initialMimeType}
        initialOrientation={initialOrientation}
        initialQuery={initialQuery}
        initialSize={initialSize}
        initialSort={initialSort}
        onChanged={() => void refresh()}
        totalCount={totalCount}
      />
    </PageShell>
  );
}
