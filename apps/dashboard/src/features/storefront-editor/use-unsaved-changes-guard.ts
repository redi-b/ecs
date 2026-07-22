"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Blocks leaving when the editor has unsaved draft changes:
 * - browser tab close / refresh (native beforeunload)
 * - in-app link clicks (sidebar, breadcrumbs, change template, etc.)
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const router = useRouter();
  const dirtyRef = useRef(isDirty);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
      // Chromium requires returnValue to be set for the prompt to show.
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!dirtyRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (anchor.dataset.allowUnsaved === "true") return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(rawHref, window.location.href);
      } catch {
        return;
      }

      // External destinations keep default behavior (new tab or full navigation).
      if (url.origin !== window.location.origin) return;

      // Same page (hash-only) is fine.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    }

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  const confirmLeave = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    if (!href) return;
    // Allow the navigation without re-triggering the guard.
    dirtyRef.current = false;
    router.push(href);
  }, [pendingHref, router]);

  const cancelLeave = useCallback(() => {
    setPendingHref(null);
  }, []);

  return {
    leaveDialogOpen: pendingHref !== null,
    confirmLeave,
    cancelLeave,
  };
}
