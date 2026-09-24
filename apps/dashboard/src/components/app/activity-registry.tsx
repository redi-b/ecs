"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type ActivityStatus = "queued" | "running" | "success" | "warning" | "error";

export type GlobalActivity = {
  badgeLabel?: string | undefined;
  description: string;
  details?: ReactNode | undefined;
  dismiss?:
    | {
        label: string;
        onSelect: () => void;
      }
    | undefined;
  icon: ReactNode;
  id: string;
  priority?: number | undefined;
  progress?: number | undefined;
  status: ActivityStatus;
  title: string;
};

type Registration = {
  activity: GlobalActivity;
  order: number;
};

export class ActivityRegistry {
  private listeners = new Set<() => void>();
  private nextOrder = 0;
  private registrations = new Map<string, Registration>();
  private snapshot: GlobalActivity[] = [];

  getSnapshot = () => this.snapshot;

  register(id: string, activity: GlobalActivity) {
    const existing = this.registrations.get(id);
    this.registrations.set(id, {
      activity,
      order: existing?.order ?? this.nextOrder++,
    });
    this.publish();

    return () => {
      this.registrations.delete(id);
      this.publish();
    };
  }

  update(activity: GlobalActivity) {
    const registration = this.registrations.get(activity.id);
    if (!registration) return;
    registration.activity = activity;
    this.publish();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish() {
    this.snapshot = [...this.registrations.values()]
      .sort((left, right) => {
        const priority = (right.activity.priority ?? 0) - (left.activity.priority ?? 0);
        return priority || left.order - right.order;
      })
      .map((registration) => registration.activity);
    this.listeners.forEach((listener) => {
      listener();
    });
  }
}

const ActivityRegistryContext = createContext<ActivityRegistry | null>(null);

export function ActivityRegistryProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new ActivityRegistry());
  return (
    <ActivityRegistryContext.Provider value={registry}>{children}</ActivityRegistryContext.Provider>
  );
}

export function useActivityRegistration(activity: GlobalActivity | null) {
  const registry = useActivityRegistry();
  const latest = useRef(activity);
  latest.current = activity;
  const id = activity?.id ?? null;

  useEffect(() => {
    if (!id) return;
    return registry.register(
      id,
      (() => {
        const current = latest.current;
        if (!current || current.id !== id) {
          throw new Error(`Activity ${id} was read after its registration became stale.`);
        }
        return current;
      })(),
    );
  }, [id, registry]);

  useEffect(() => {
    if (activity) registry.update(activity);
  }, [activity, registry]);
}

export function useGlobalActivities() {
  const registry = useActivityRegistry();
  return useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
}

function useActivityRegistry() {
  const registry = useContext(ActivityRegistryContext);
  if (!registry) throw new Error("Global activity must be used inside ActivityRegistryProvider.");
  return registry;
}
