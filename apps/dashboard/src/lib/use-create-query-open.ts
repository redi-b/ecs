"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { OPEN_CREATE_EVENT, type OpenCreateDetail } from "@/lib/open-create";

/**
 * Opens a create dialog when:
 * - URL has ?create=<value>, or
 * - command center fires ecs:open-create on the same page (no navigation)
 *
 * Parent must be under a React Suspense boundary (Next.js useSearchParams).
 */
export function useCreateQueryOpen(options: {
  /** Accepted create= values, e.g. ["1", "true", "product"]. */
  values: string[];
  onOpen: () => void;
  param?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openedFor = useRef<string | null>(null);
  const onOpenRef = useRef(options.onOpen);
  onOpenRef.current = options.onOpen;

  const param = options.param ?? "create";
  const valuesKey = options.values.join("|");

  // Same-page open from command center (no RSC reload).
  useEffect(() => {
    const accepted = new Set(
      valuesKey
        .split("|")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );

    function onEvent(event: Event) {
      const value = (event as CustomEvent<OpenCreateDetail>).detail?.value?.trim().toLowerCase();
      if (!value || !accepted.has(value)) return;
      onOpenRef.current();
    }

    window.addEventListener(OPEN_CREATE_EVENT, onEvent);
    return () => window.removeEventListener(OPEN_CREATE_EVENT, onEvent);
  }, [valuesKey]);

  // Cross-page deep link: /admin/products?create=product
  useEffect(() => {
    const accepted = new Set(
      valuesKey
        .split("|")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );
    const raw = searchParams.get(param)?.trim().toLowerCase() ?? "";
    if (!raw || !accepted.has(raw)) {
      openedFor.current = null;
      return;
    }

    if (openedFor.current === raw) return;
    openedFor.current = raw;

    onOpenRef.current();

    const next = new URLSearchParams(searchParams.toString());
    next.delete(param);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [param, pathname, router, searchParams, valuesKey]);
}
