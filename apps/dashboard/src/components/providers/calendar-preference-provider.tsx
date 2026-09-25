"use client";

import type { UserCalendarPreference } from "@ecs/date-time";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

type CalendarPreferenceContextValue = {
  preference: UserCalendarPreference;
  setPreference: (preference: UserCalendarPreference) => void;
};

const CalendarPreferenceContext = createContext<CalendarPreferenceContextValue | null>(null);

export function CalendarPreferenceProvider({
  children,
  initialPreference,
}: {
  children: ReactNode;
  initialPreference: UserCalendarPreference;
}) {
  const [preference, setPreference] = useState(initialPreference);
  const value = useMemo(() => ({ preference, setPreference }), [preference]);
  return (
    <CalendarPreferenceContext.Provider value={value}>
      {children}
    </CalendarPreferenceContext.Provider>
  );
}

export function useCalendarPreference() {
  return (
    useContext(CalendarPreferenceContext) ?? {
      preference: "follow-language" as const,
      setPreference: () => undefined,
    }
  );
}
