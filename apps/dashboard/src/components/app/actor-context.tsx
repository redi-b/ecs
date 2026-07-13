"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Actor = MerchantDashboardSummary["actor"];

type ActorContextValue = {
  actor: Actor;
  setActorName: (name: string) => void;
};

const ActorContext = createContext<ActorContextValue | null>(null);

export function ActorProvider({
  actor,
  children,
}: {
  actor: Actor;
  children: ReactNode;
}) {
  const [current, setCurrent] = useState(actor);

  useEffect(() => {
    setCurrent(actor);
  }, [actor]);

  const setActorName = useCallback((name: string) => {
    const trimmed = name.trim();
    setCurrent((prev) => ({ ...prev, name: trimmed.length ? trimmed : null }));
  }, []);

  const value = useMemo(
    () => ({
      actor: current,
      setActorName,
    }),
    [current, setActorName],
  );

  return <ActorContext.Provider value={value}>{children}</ActorContext.Provider>;
}

export function useActor() {
  const ctx = useContext(ActorContext);
  if (!ctx) {
    throw new Error("useActor must be used within ActorProvider");
  }
  return ctx;
}

/** Prefer context when present; fall back to server prop for isolated usage. */
export function useActorOrFallback(fallback: Actor): ActorContextValue {
  const ctx = useContext(ActorContext);
  if (ctx) return ctx;
  return {
    actor: fallback,
    setActorName: () => undefined,
  };
}
