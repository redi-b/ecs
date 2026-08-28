"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import {
  EMPTY_INSIGHTS_REFRESH_STATE,
  type InsightsRefreshState,
  isAwaitingInsightsReport,
  refreshStateFromResponse,
  restoreInsightsRefreshState,
} from "./insights-refresh-state";

export function InsightsHeaderActions({ summary }: { summary: MerchantDashboardSummary }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [state, setState] = useState<InsightsRefreshState>(EMPTY_INSIGHTS_REFRESH_STATE);
  const [now, setNow] = useState(0);
  const storageKey = `ecs:insights-refresh:${summary.tenant.id}`;
  const lastSuccessfulAt = summary.operations?.quality.lastSuccessfulAt ?? null;
  const retryAtMs = state.retryAt ? new Date(state.retryAt).getTime() : 0;
  const coolingDown = retryAtMs > now;
  const awaitingReport = isAwaitingInsightsReport({ lastSuccessfulAt, nowMs: now, state });

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    const restored = restoreInsightsRefreshState(stored, Date.now());
    if (!restored) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    setState(restored);
  }, [storageKey]);

  useEffect(() => {
    const syncState = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      if (!event.newValue) {
        setState(EMPTY_INSIGHTS_REFRESH_STATE);
        return;
      }
      try {
        const restored = restoreInsightsRefreshState(event.newValue, Date.now());
        if (restored) setState(restored);
      } catch {
        // Ignore malformed state written outside this application.
      }
    };
    window.addEventListener("storage", syncState);
    return () => window.removeEventListener("storage", syncState);
  }, [storageKey]);

  useEffect(() => {
    if (!awaitingReport) return;
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [awaitingReport, router]);

  useEffect(() => {
    if (!state.retryAt) return;
    if (!coolingDown) {
      setState(EMPTY_INSIGHTS_REFRESH_STATE);
      window.localStorage.removeItem(storageKey);
      return;
    }
    if (state.requestedAt && !awaitingReport) {
      const next = { ...state, requestedAt: null };
      setState(next);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
  }, [awaitingReport, coolingDown, state, storageKey]);

  async function requestUpdate() {
    setRequesting(true);
    const response = await fetch(
      `/admin/insights/actions/refresh?tenantId=${encodeURIComponent(summary.tenant.id)}`,
      {
        headers: { accept: "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(12_000),
      },
    ).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as {
      queued?: boolean;
      requestedAt?: string;
      retryAt?: string;
    };
    setRequesting(false);
    if (!response?.ok || !data.retryAt) {
      toast.error(t("insights.refresh.error"));
      return;
    }
    const next = refreshStateFromResponse({
      queued: data.queued === true,
      ...(data.requestedAt ? { requestedAt: data.requestedAt } : {}),
      retryAt: data.retryAt,
    });
    setState(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    toast.success(data.queued ? t("insights.refresh.queued") : t("insights.refresh.alreadyQueued"));
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="text-right">
        <p className="text-xs font-medium">{qualityLabel(summary.operations?.quality.status, t)}</p>
        <p className="text-xs text-muted-foreground">
          {lastSuccessfulAt
            ? t("insights.freshness.updated", { date: shortDate(lastSuccessfulAt, locale) })
            : t("insights.freshness.notYetUpdated")}
        </p>
      </div>
      <Button
        disabled={requesting || coolingDown}
        onClick={() => void requestUpdate()}
        type="button"
        variant="outline"
      >
        <RefreshCwIcon
          className={requesting ? "animate-spin" : undefined}
          data-icon="inline-start"
        />
        {requesting
          ? t("insights.refresh.requesting")
          : coolingDown && state.retryAt
            ? t("insights.refresh.availableAtShort", { date: shortTime(state.retryAt, locale) })
            : t("insights.refresh.action")}
      </Button>
    </div>
  );
}

function qualityLabel(status: string | undefined, t: ReturnType<typeof useI18n>["t"]) {
  if (status === "fresh") return t("insights.freshness.current");
  if (status === "stale") return t("insights.freshness.delayed");
  return t("insights.freshness.preparing");
}

function shortDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function shortTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}
