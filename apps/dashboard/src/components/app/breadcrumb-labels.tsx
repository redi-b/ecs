"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

import type { DashboardBreadcrumbLabels } from "@/lib/dashboard-breadcrumbs";

type BreadcrumbLabelSetter = (id: string, label: string | null) => void;

const BreadcrumbLabelsContext = createContext<DashboardBreadcrumbLabels>({});
const BreadcrumbLabelSetterContext = createContext<BreadcrumbLabelSetter | null>(null);

export function BreadcrumbLabelsProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<DashboardBreadcrumbLabels>({});
  const setLabel = useCallback((id: string, label: string | null) => {
    setLabels((current) => {
      if (!label?.trim()) {
        const { [id]: _removed, ...next } = current;

        return next;
      }

      if (current[id] === label.trim()) {
        return current;
      }

      return {
        ...current,
        [id]: label.trim(),
      };
    });
  }, []);

  return (
    <BreadcrumbLabelSetterContext.Provider value={setLabel}>
      <BreadcrumbLabelsContext.Provider value={labels}>{children}</BreadcrumbLabelsContext.Provider>
    </BreadcrumbLabelSetterContext.Provider>
  );
}

export function useBreadcrumbLabels() {
  return useContext(BreadcrumbLabelsContext);
}

export function DashboardBreadcrumbLabel({
  label,
  labelKey,
}: {
  label: string | null;
  labelKey: string;
}) {
  const setLabel = useContext(BreadcrumbLabelSetterContext);

  useEffect(() => {
    setLabel?.(labelKey, label);

    return () => setLabel?.(labelKey, null);
  }, [labelKey, label, setLabel]);

  return null;
}
