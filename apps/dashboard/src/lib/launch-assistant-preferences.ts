export const LAUNCH_ASSISTANT_PREFERENCE_EVENT = "ecs-launch-assistant-preference";

export function getLaunchAssistantStorageKey(tenantId: string) {
  return `ecs-launch-assistant-hidden:${tenantId}`;
}

export function isLaunchAssistantHidden(tenantId: string) {
  return window.localStorage.getItem(getLaunchAssistantStorageKey(tenantId)) === "true";
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
