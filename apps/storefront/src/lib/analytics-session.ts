export const STOREFRONT_SESSION_IDLE_MS = 30 * 60 * 1000;

export type StorefrontAnalyticsSession = {
  id: string;
  lastSeenAt: number;
};

export function resolveStorefrontAnalyticsSession(input: {
  createId: () => string;
  now: number;
  stored: string | null;
}): StorefrontAnalyticsSession {
  const parsed = parseStoredSession(input.stored);
  if (
    parsed &&
    input.now >= parsed.lastSeenAt &&
    input.now - parsed.lastSeenAt <= STOREFRONT_SESSION_IDLE_MS
  ) {
    return { ...parsed, lastSeenAt: input.now };
  }

  return { id: input.createId(), lastSeenAt: input.now };
}

function parseStoredSession(value: string | null): StorefrontAnalyticsSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StorefrontAnalyticsSession>;
    return typeof parsed.id === "string" &&
      parsed.id.length > 0 &&
      typeof parsed.lastSeenAt === "number" &&
      Number.isFinite(parsed.lastSeenAt)
      ? { id: parsed.id, lastSeenAt: parsed.lastSeenAt }
      : null;
  } catch {
    return null;
  }
}
