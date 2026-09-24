/**
 * Tracks open floating layers (popover/select/menu/combobox) so parent
 * dialogs/sheets do not dismiss while a nested layer is open or just closed.
 */

/** Tokens for currently open nested layers. */
const openLayers = new Set<symbol>();
let suppressDialogCloseUntil = 0;

/** Covers the pointerdown→click race when a nested layer closes on outside click. */
const SUPPRESS_MS = 320;

export function notifyNestedOverlayChange(open: true): symbol;
export function notifyNestedOverlayChange(open: false, layerId?: symbol): undefined;
export function notifyNestedOverlayChange(
  open: boolean,
  layerId?: symbol,
): symbol | undefined {
  if (open) {
    const id = layerId ?? Symbol("nested-overlay");
    openLayers.add(id);
    return id;
  }

  if (layerId) {
    openLayers.delete(layerId);
  } else {
    const first = openLayers.values().next().value;
    if (first) openLayers.delete(first);
  }

  suppressDialogCloseUntil = performance.now() + SUPPRESS_MS;
  return undefined;
}

/** Per-host open session; open=true is a no-op if already open. */
export type NestedOverlaySession = {
  isOpen: boolean;
  layerId: symbol | null;
};

export function applyNestedOverlaySession(
  open: boolean,
  session: NestedOverlaySession,
): NestedOverlaySession {
  if (open) {
    if (session.isOpen) return session;
    return {
      isOpen: true,
      layerId: notifyNestedOverlayChange(true),
    };
  }
  if (!session.isOpen) return session;
  notifyNestedOverlayChange(false, session.layerId ?? undefined);
  return { isOpen: false, layerId: null };
}

/** Drop a layer on unmount if still open (no suppress window). */
export function releaseNestedOverlayIfOpen(wasOpen: boolean, layerId?: symbol | null) {
  if (!wasOpen) return;
  if (layerId) {
    openLayers.delete(layerId);
    return;
  }
  const first = openLayers.values().next().value;
  if (first) openLayers.delete(first);
}

/** Nested layer open, or within the brief post-close suppress window. */
export function isNestedOverlayActive() {
  return openLayers.size > 0 || performance.now() < suppressDialogCloseUntil;
}

/** Nested layer currently open (excludes suppress window). */
export function isNestedOverlayOpen() {
  return openLayers.size > 0;
}

export function getNestedOverlayDebugState() {
  return {
    openCount: openLayers.size,
    suppressed: performance.now() < suppressDialogCloseUntil,
    suppressDialogCloseUntil,
  };
}
