"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, Loader2Icon, PackageOpenIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { type GlobalActivity, useActivityRegistration } from "@/components/app/activity-registry";
import { Button } from "@/components/ui/button";
import {
  loadProductImportExecution,
  RECENT_PRODUCT_IMPORT_KEY,
} from "@/features/products/product-import-progress";
import { useI18n } from "@/i18n/provider";

const TERMINAL = new Set(["completed", "completed_with_errors", "failed_enqueue"]);

/** Persistent shell-level progress for work that continues after navigation. */
export function BackgroundTaskCenter() {
  const { formatNumber, t } = useI18n();
  const [executionId, setExecutionId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setExecutionId(window.localStorage.getItem(RECENT_PRODUCT_IMPORT_KEY));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("ecs:background-task", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("ecs:background-task", sync);
    };
  }, []);

  const executionQuery = useQuery({
    enabled: Boolean(executionId),
    queryFn: ({ signal }) => loadProductImportExecution(executionId ?? "", signal),
    queryKey: ["global-activity", "product-import", executionId],
    refetchInterval: (query) => {
      const execution = query.state.data;
      return execution && !TERMINAL.has(execution.status) ? 1_800 : false;
    },
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: 2,
    staleTime: 0,
  });

  useEffect(() => {
    if (executionId && executionQuery.isSuccess && executionQuery.data === null) {
      window.localStorage.removeItem(RECENT_PRODUCT_IMPORT_KEY);
      setExecutionId(null);
    }
  }, [executionId, executionQuery.data, executionQuery.isSuccess]);

  const {
    data: execution,
    isError: executionUnavailable,
    refetch: refetchExecution,
  } = executionQuery;
  const activity = useMemo<GlobalActivity | null>(() => {
    if (!executionId) return null;

    if (!execution) {
      return {
        badgeLabel: executionUnavailable ? t("products.import.queueUnavailableBadge") : "…",
        description: executionUnavailable
          ? t("products.import.queueUnavailable")
          : t("products.import.queueChecking"),
        details: executionUnavailable ? (
          <div className="flex justify-end border-t px-3 py-2">
            <Button
              onClick={() => void refetchExecution()}
              size="xs"
              type="button"
              variant="outline"
            >
              {t("products.import.queueRetry")}
            </Button>
          </div>
        ) : undefined,
        icon: <Loader2Icon className="animate-spin" />,
        id: `product-import:${executionId}`,
        priority: 20,
        status: executionUnavailable ? "error" : "queued",
        title: t("products.import.queueTitle"),
      };
    }

    const progress = execution.totalProducts
      ? Math.min(100, Math.round((execution.cursor / execution.totalProducts) * 100))
      : 0;
    const done = TERMINAL.has(execution.status);
    const failed = execution.failedProducts > 0 || execution.status === "failed_enqueue";

    return {
      badgeLabel: `${progress}%`,
      description: done
        ? t(failed ? "products.import.queueFinishedWithErrors" : "products.import.queueFinished")
        : t("products.import.queueWorking", {
            processed: formatNumber(execution.cursor),
            total: formatNumber(execution.totalProducts),
          }),
      details: (
        <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
          <PackageOpenIcon />
          <span>
            {t("products.import.queueResult", {
              failed: formatNumber(execution.failedProducts),
              succeeded: formatNumber(execution.succeededProducts),
            })}
          </span>
        </div>
      ),
      dismiss: done
        ? {
            label: t("products.import.queueDismiss"),
            onSelect: () => {
              window.localStorage.removeItem(RECENT_PRODUCT_IMPORT_KEY);
              setExecutionId(null);
            },
          }
        : undefined,
      icon: done ? <CheckCircle2Icon /> : <Loader2Icon className="animate-spin" />,
      id: `product-import:${executionId}`,
      priority: 20,
      progress,
      status: failed ? "error" : done ? "success" : "running",
      title: t("products.import.queueTitle"),
    };
  }, [execution, executionId, executionUnavailable, formatNumber, refetchExecution, t]);

  useActivityRegistration(activity);
  return null;
}
