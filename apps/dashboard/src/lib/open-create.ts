/**
 * Same-page create open without a Next navigation.
 * Command center dispatches this when already on the target list page.
 * Create dialogs listen via useCreateQueryOpen.
 */
export const OPEN_CREATE_EVENT = "ecs:open-create";

export type OpenCreateDetail = {
  value: string;
};

export function requestOpenCreate(value: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenCreateDetail>(OPEN_CREATE_EVENT, {
      detail: { value: value.trim().toLowerCase() },
    }),
  );
}

/** Parse create deep-link from an action href like /admin/products?create=product */
export function parseCreateFromHref(href: string): {
  pathname: string;
  create: string | null;
  search: string;
} {
  const url = new URL(href, "http://local.invalid");
  return {
    pathname: url.pathname,
    create: url.searchParams.get("create")?.trim().toLowerCase() || null,
    search: url.search,
  };
}
