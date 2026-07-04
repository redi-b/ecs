"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { DashboardBreadcrumbLabels } from "@/lib/dashboard-breadcrumbs";

type BreadcrumbLabelsContextValue = {
  labels: DashboardBreadcrumbLabels;
  setLabel: (id: string, label: string | null) => void;
};

const BreadcrumbLabelsContext = createContext<BreadcrumbLabelsContextValue | null>(null);

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
  const value = useMemo<BreadcrumbLabelsContextValue>(
    () => ({
      labels,
      setLabel,
    }),
    [labels, setLabel],
  );

  return (
    <BreadcrumbLabelsContext.Provider value={value}>{children}</BreadcrumbLabelsContext.Provider>
  );
}

export function useBreadcrumbLabels() {
  return useContext(BreadcrumbLabelsContext)?.labels ?? {};
}

export function DashboardBreadcrumbLabel({ id, label }: { id: string; label: string | null }) {
  const context = useContext(BreadcrumbLabelsContext);

  useEffect(() => {
    context?.setLabel(id, label);

    return () => context?.setLabel(id, null);
  }, [context, id, label]);

  return null;
}
