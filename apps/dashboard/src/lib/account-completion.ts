export function getSafeAccountCompletionPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/onboarding";

  const url = new URL(value, "https://dashboard.invalid");
  const allowed =
    url.pathname === "/onboarding" ||
    url.pathname.startsWith("/onboarding/") ||
    url.pathname === "/accept-invitation" ||
    url.pathname.startsWith("/accept-invitation/") ||
    url.pathname === "/dashboard" ||
    url.pathname.startsWith("/dashboard/");

  if (url.origin !== "https://dashboard.invalid" || !allowed) return "/onboarding";
  return `${url.pathname}${url.search}${url.hash}`;
}
