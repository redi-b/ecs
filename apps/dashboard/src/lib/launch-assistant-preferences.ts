export const LAUNCH_ASSISTANT_PREFERENCE_EVENT = "ecs-launch-assistant-preference";

export function getLaunchAssistantStorageKey(tenantId: string) {
  return `ecs-launch-assistant-hidden:${tenantId}`;
}

export function getLaunchAssistantOpenStorageKey(tenantId: string) {
  return `ecs-launch-assistant-open:${tenantId}`;
}

export function isLaunchAssistantHidden(tenantId: string) {
  return window.localStorage.getItem(getLaunchAssistantStorageKey(tenantId)) === "true";
}

export function getLaunchAssistantOpenPreference(tenantId: string) {
  const value = window.localStorage.getItem(getLaunchAssistantOpenStorageKey(tenantId));

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

export function setLaunchAssistantHidden(tenantId: string, hidden: boolean) {
  window.localStorage.setItem(getLaunchAssistantStorageKey(tenantId), hidden ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent(LAUNCH_ASSISTANT_PREFERENCE_EVENT, {
      detail: {
        hidden,
        tenantId,
      },
    }),
  );
}

export function setLaunchAssistantOpenPreference(tenantId: string, open: boolean) {
  window.localStorage.setItem(getLaunchAssistantOpenStorageKey(tenantId), open ? "true" : "false");
}
