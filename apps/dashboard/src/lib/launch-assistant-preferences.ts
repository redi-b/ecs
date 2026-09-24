export const LAUNCH_ASSISTANT_PREFERENCE_EVENT = "ecs-launch-assistant-preference";

export function getLaunchAssistantStorageKey(tenantId: string) {
  return `ecs-launch-assistant-hidden:${tenantId}`;
}

export function getLaunchAssistantCookieName(tenantId: string) {
  return `ecs_launch_hidden_${tenantId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function getLaunchAssistantEditorVisitedStorageKey(tenantId: string) {
  return `ecs-launch-assistant-editor-visited:${tenantId}`;
}

export function hasVisitedStorefrontEditor(tenantId: string) {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(getLaunchAssistantEditorVisitedStorageKey(tenantId)) === "true"
  );
}

export function markStorefrontEditorVisited(tenantId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getLaunchAssistantEditorVisitedStorageKey(tenantId), "true");
}

export function isLaunchAssistantHidden(tenantId: string) {
  if (typeof window === "undefined") return false;
  const item = window.localStorage.getItem(getLaunchAssistantStorageKey(tenantId));
  if (item !== null) {
    return item === "true";
  }
  const cookieMatch = document.cookie.match(
    new RegExp(`(?:^|; )${getLaunchAssistantCookieName(tenantId)}=([^;]*)`),
  );
  return cookieMatch ? cookieMatch[1] === "true" : false;
}

export function setLaunchAssistantHidden(tenantId: string, hidden: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getLaunchAssistantStorageKey(tenantId), hidden ? "true" : "false");

  const cookieName = getLaunchAssistantCookieName(tenantId);
  const maxAge = hidden ? 31536000 : 0;
  document.cookie = `${cookieName}=${hidden ? "true" : "false"}; path=/; max-age=${maxAge}; SameSite=Lax`;

  window.dispatchEvent(
    new CustomEvent(LAUNCH_ASSISTANT_PREFERENCE_EVENT, {
      detail: {
        hidden,
        tenantId,
      },
    }),
  );
}

