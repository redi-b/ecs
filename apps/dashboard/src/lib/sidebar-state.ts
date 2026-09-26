export const SIDEBAR_COOKIE_NAME = "sidebar_state";

export function isStorefrontEditorPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const cleanPath = pathname.split("?")[0]?.split("#")[0] ?? "";
  return cleanPath === "/dashboard/editor" || cleanPath.startsWith("/dashboard/editor/");
}

export function getSidebarDefaultOpen(
  value: string | null | undefined,
  pathname?: string | null | undefined,
) {
  if (isStorefrontEditorPath(pathname)) {
    return false;
  }
  return value !== "false";
}
