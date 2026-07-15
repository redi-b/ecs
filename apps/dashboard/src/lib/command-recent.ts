export type RecentCommandItem = {
  id: string;
  kind: "resource" | "command";
  type?: string;
  label: string;
  href: string;
  at: number;
};

const MAX_RECENT = 12;
const VERSION = "v1";

function storageKey(tenantId: string) {
  return `ecs.command-recent.${VERSION}:${tenantId}`;
}

export function loadRecentCommands(tenantId: string): RecentCommandItem[] {
  if (typeof window === "undefined" || !tenantId.trim()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentCommandItem =>
          Boolean(
            item &&
              typeof item === "object" &&
              typeof (item as RecentCommandItem).id === "string" &&
              typeof (item as RecentCommandItem).href === "string" &&
              typeof (item as RecentCommandItem).label === "string",
          ),
      )
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentCommand(
  tenantId: string,
  item: Omit<RecentCommandItem, "at">,
): RecentCommandItem[] {
  if (typeof window === "undefined" || !tenantId.trim()) return [];
  const next: RecentCommandItem = { ...item, at: Date.now() };
  const existing = loadRecentCommands(tenantId).filter((row) => row.id !== next.id);
  const list = [next, ...existing].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(storageKey(tenantId), JSON.stringify(list));
  } catch {
    // quota / private mode
  }
  return list;
}
