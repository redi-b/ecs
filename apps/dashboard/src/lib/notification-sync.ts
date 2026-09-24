export const NOTIFICATION_CHANGED_EVENT = "ecs:notifications-changed";
const CHANNEL_NAME = "ecs-notifications";
const LEASE_KEY = "ecs:notifications-poll-leader";

export type NotificationSyncMessage = { type: "changed" } | { type: "count"; count: number };

type NotificationCrypto = Pick<Crypto, "getRandomValues"> &
  Partial<Pick<Crypto, "randomUUID">>;

export function createNotificationPollOwner(
  cryptoApi: NotificationCrypto | undefined = globalThis.crypto,
) {
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues === "function") {
    const values = cryptoApi.getRandomValues(new Uint32Array(4));
    return Array.from(values, (value) => value.toString(36)).join("-");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function openNotificationSync(onMessage: (message: NotificationSyncMessage) => void) {
  if (typeof BroadcastChannel === "undefined") return null;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = event.data as Partial<NotificationSyncMessage> | null;
    if (message?.type === "changed") onMessage({ type: "changed" });
    if (message?.type === "count" && typeof message.count === "number") {
      onMessage({ count: message.count, type: "count" });
    }
  };
  return channel;
}

export function notifyInboxChanged() {
  window.dispatchEvent(new Event(NOTIFICATION_CHANGED_EVENT));
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: "changed" } satisfies NotificationSyncMessage);
  channel.close();
}

export function claimNotificationPollLease(
  storage: Pick<Storage, "getItem" | "setItem">,
  owner: string,
  now: number,
  ttlMs: number,
) {
  try {
    const current = JSON.parse(storage.getItem(LEASE_KEY) ?? "null") as {
      expiresAt?: unknown;
      owner?: unknown;
    } | null;
    if (
      current &&
      current.owner !== owner &&
      typeof current.expiresAt === "number" &&
      current.expiresAt > now
    ) {
      return false;
    }
    storage.setItem(LEASE_KEY, JSON.stringify({ expiresAt: now + ttlMs, owner }));
    const confirmed = JSON.parse(storage.getItem(LEASE_KEY) ?? "null") as {
      owner?: unknown;
    } | null;
    return confirmed?.owner === owner;
  } catch {
    return true;
  }
}
