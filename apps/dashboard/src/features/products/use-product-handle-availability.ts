"use client";

import { useEffect, useState } from "react";

export type ProductHandleAvailability = "idle" | "checking" | "available" | "taken" | "error";
export type ProductHandleAvailabilityResult = {
  status: ProductHandleAvailability;
  suggestedHandle: string | null;
};

export function useProductHandleAvailability({
  action,
  currentHandle,
  handle,
  productId,
}: {
  action: string;
  currentHandle?: string | null | undefined;
  handle: string;
  productId?: string | undefined;
}) {
  const [status, setStatus] = useState<ProductHandleAvailability>("idle");
  const [suggestedHandle, setSuggestedHandle] = useState<string | null>(null);

  useEffect(() => {
    const normalized = handle.trim().toLowerCase();
    if (!normalized || normalized === currentHandle?.trim().toLowerCase()) {
      setStatus("idle");
      setSuggestedHandle(null);
      return;
    }

    setStatus("checking");
    setSuggestedHandle(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const endpoint = new URL("/admin/products/actions/handle", window.location.origin);
      endpoint.searchParams.set("handle", normalized);
      if (productId) endpoint.searchParams.set("excludeId", productId);
      const tenantId = new URL(action, window.location.origin).searchParams.get("tenantId");
      if (tenantId) endpoint.searchParams.set("tenantId", tenantId);

      const response = await fetch(endpoint, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      }).catch(() => null);
      if (!response) {
        if (!controller.signal.aborted) setStatus("error");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as {
        available?: boolean;
        suggestedHandle?: string;
      };
      if (controller.signal.aborted) return;
      setStatus(response.ok ? (data.available ? "available" : "taken") : "error");
      setSuggestedHandle(response.ok && !data.available ? data.suggestedHandle ?? null : null);
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [action, currentHandle, handle, productId]);

  return { status, suggestedHandle } satisfies ProductHandleAvailabilityResult;
}
