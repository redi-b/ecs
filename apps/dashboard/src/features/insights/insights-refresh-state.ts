export type InsightsRefreshState = { requestedAt: string | null; retryAt: string | null };

export const EMPTY_INSIGHTS_REFRESH_STATE: InsightsRefreshState = {
  requestedAt: null,
  retryAt: null,
};

export function restoreInsightsRefreshState(
  raw: string | null,
  nowMs: number,
): InsightsRefreshState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<InsightsRefreshState>;
    if (typeof value.retryAt !== "string" || new Date(value.retryAt).getTime() <= nowMs)
      return null;
    return {
      requestedAt: typeof value.requestedAt === "string" ? value.requestedAt : null,
      retryAt: value.retryAt,
    };
  } catch {
    return null;
  }
}

export function refreshStateFromResponse(input: {
  queued: boolean;
  requestedAt?: string | undefined;
  retryAt: string;
}): InsightsRefreshState {
  return {
    requestedAt: input.queued ? (input.requestedAt ?? new Date().toISOString()) : null,
    retryAt: input.retryAt,
  };
}

export function isAwaitingInsightsReport(input: {
  lastSuccessfulAt: string | null;
  nowMs: number;
  state: InsightsRefreshState;
}) {
  if (!input.state.requestedAt || !input.state.retryAt) return false;
  if (new Date(input.state.retryAt).getTime() <= input.nowMs) return false;
  return (
    !input.lastSuccessfulAt ||
    new Date(input.lastSuccessfulAt).getTime() < new Date(input.state.requestedAt).getTime()
  );
}
