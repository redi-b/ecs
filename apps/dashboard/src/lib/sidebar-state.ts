export const SIDEBAR_COOKIE_NAME = "sidebar_state";

export function getSidebarDefaultOpen(value: string | null | undefined) {
  return value !== "false";
}
