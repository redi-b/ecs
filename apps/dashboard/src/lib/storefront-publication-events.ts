export function emitStorefrontPublicationChange(published: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("ecs:storefront-publication-changed", {
      detail: { published },
    }),
  );
}
