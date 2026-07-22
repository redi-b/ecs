"use client";

import * as React from "react";

const FloatingPortalContainerContext = React.createContext<HTMLElement | null>(null);

export function FloatingPortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: React.ReactNode;
}) {
  return (
    <FloatingPortalContainerContext.Provider value={container}>
      {children}
    </FloatingPortalContainerContext.Provider>
  );
}

export function useFloatingPortalContainer() {
  return React.useContext(FloatingPortalContainerContext);
}
