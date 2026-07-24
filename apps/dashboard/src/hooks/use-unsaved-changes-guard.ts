"use client";

import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useRef, useState } from "react";

type PendingLeave =
  | { kind: "href"; href: string }
  | { kind: "action"; action: () => void };

/**
 * Confirms before leaving when `isDirty` is true:
 * - browser tab close / refresh (`beforeunload`)
 * - in-app link clicks (sidebar, breadcrumbs, etc.)
 * - programmatic exits via `requestLeave(action)`
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const router = useRouter();
  const dirtyRef = useRef(isDirty);
  const [pending, setPending] = useState<PendingLeave | null>(null);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
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
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        return;
      }

      let url: URL;
      try {
        url = new URL(rawHref, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPending({ kind: "href", href: `${url.pathname}${url.search}${url.hash}` });
    }

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  const requestLeave = useCallback((action: () => void) => {
    if (!dirtyRef.current) {
      action();
      return;
    }
    setPending({ kind: "action", action });
  }, []);

  const confirmLeave = useCallback(() => {
    const next = pending;
    setPending(null);
    if (!next) return;
    dirtyRef.current = false;
    if (next.kind === "href") {
      router.push(next.href);
      return;
    }
    next.action();
  }, [pending, router]);

  const cancelLeave = useCallback(() => {
    setPending(null);
  }, []);

  return {
    leaveDialogOpen: pending !== null,
    requestLeave,
    confirmLeave,
    cancelLeave,
  };
}
