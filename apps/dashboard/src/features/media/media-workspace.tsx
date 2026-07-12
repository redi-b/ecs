"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { ListSummary } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaLibrary } from "@/features/media/media-library";
import { MediaUploadComposer } from "@/features/media/media-upload-composer";
import { useI18n } from "@/i18n/provider";
import type { MediaAsset } from "@/lib/merchant-media";

export function MediaWorkspace({
  children,
  initialAssets,
  initialError,
  page,
  pageSize,
  totalCount: initialTotalCount,
}: {
  children?: ReactNode;
  initialAssets: MediaAsset[];
  initialError?: string | undefined;
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  const { t } = useI18n();
  const [assets, setAssets] = useState(initialAssets);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(Boolean(initialError));

  useEffect(() => {
    setAssets(initialAssets);
    setTotalCount(initialTotalCount);
    setLoadError(Boolean(initialError));
  }, [initialAssets, initialError, initialTotalCount]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const offset = (page - 1) * pageSize;
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`/admin/media/assets?${params}`);
    const data = (await response.json().catch(() => null)) as {
      assets?: MediaAsset[];
      count?: number;
    } | null;

    if (response.ok && data?.assets) {
      setAssets(data.assets);
      if (typeof data.count === "number") setTotalCount(data.count);
      setLoadError(false);
    } else {
      setLoadError(true);
    }
    setRefreshing(false);
  }, [page, pageSize]);

  return (
    <PageShell
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-busy={refreshing}
                aria-label={refreshing ? "Refreshing" : t("media.refresh")}
                disabled={refreshing}
                onClick={() => void refresh()}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <AppIcons.refresh className={refreshing ? "animate-spin" : undefined} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{refreshing ? "Refreshing" : t("media.refresh")}</TooltipContent>
          </Tooltip>
          <MediaUploadComposer onUploaded={() => void refresh()} />
        </>
      }
      description="Upload, organize, and reuse merchant images across products and future storefront experiences."
      title="Media"
    >
      <ListSummary count={totalCount} label="media assets" />
      {loadError || initialError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("media.libraryLoadError")}</AlertTitle>
          <AlertDescription>{t("media.libraryLoadErrorDescription")}</AlertDescription>
        </Alert>
      ) : null}
      <MediaLibrary
        assets={assets}
        footer={children}
        onChanged={() => void refresh()}
        pageCount={assets.length}
        totalCount={totalCount}
      />
    </PageShell>
  );
}
