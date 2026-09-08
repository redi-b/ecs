"use client";

import { useEffect, useState } from "react";

export type ProductHandleAvailability = "idle" | "checking" | "available" | "taken" | "error";

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

  useEffect(() => {
    const normalized = handle.trim().toLowerCase();
    if (!normalized || normalized === currentHandle?.trim().toLowerCase()) {
      setStatus("idle");
      return;
    }

    setStatus("checking");
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
        setStatus("error");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { available?: boolean };
      setStatus(response.ok ? (data.available ? "available" : "taken") : "error");
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [action, currentHandle, handle, productId]);

  return status;
}
