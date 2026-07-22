"use client";

import * as React from "react";

/**
 * Modal dialogs/sheets mark the rest of the document inert. Base UI Combobox
 * portals to `document.body` by default, so its popup ends up non-interactive.
 *
 * Dialog/Sheet content provide a container node; Combobox (and similar) portals
 * into it so the popup stays inside the modal tree and remains clickable.
 */
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
