"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Opens a create dialog when the URL has ?create=<value>, then strips the param
 * so refresh/back does not re-open. Used by command-center deep links.
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
  const param = options.param ?? "create";
  const valuesKey = options.values.join("|");

  useEffect(() => {
    const accepted = new Set(
      valuesKey.split("|").map((value) => value.trim().toLowerCase()).filter(Boolean),
    );
    const raw = searchParams.get(param)?.trim().toLowerCase() ?? "";
    if (!raw || !accepted.has(raw)) {
      openedFor.current = null;
      return;
    }

    if (openedFor.current === raw) return;
    openedFor.current = raw;

    options.onOpen();

    const next = new URLSearchParams(searchParams.toString());
    next.delete(param);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onOpen is intentionally stable open() from parents
  }, [param, pathname, router, searchParams, valuesKey]);
}
