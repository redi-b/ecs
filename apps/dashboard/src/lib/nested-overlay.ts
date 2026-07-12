/**
 * Tracks nested floating UI (select / popover / menu) so parent dialogs/sheets
 * do not dismiss when the user click-aways to close only the nested layer.
 *
 * Why a suppress window: Radix often unmounts the select content (and fires
 * onOpenChange(false)) before or during the parent modal's outside handler for
 * the same pointer event. A live DOM query for open content is already empty,
 * so we keep a short suppress window after close.
 *
 * Applies to ALL outside dismissals for the parent — including scrim/overlay
 * clicks — while a nested layer is open or within the suppress window.
 *
 * Does NOT gate ESC or the close (X) button (those use onOpenChange / Close).
 */

/** Stable tokens for each open nested layer (avoids double-count drift). */
const openLayers = new Set<symbol>();
let suppressDialogCloseUntil = 0;

/** Long enough to cover the same pointerdown→click race across nested layers. */
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

  // Parent modal outside-handlers for this same gesture must still see "active".
  suppressDialogCloseUntil = performance.now() + SUPPRESS_MS;
  return undefined;
}

/**
 * Call from floating-layer roots on unmount when still open, so openLayers
 * cannot stick after a parent dialog unmounts without firing onOpenChange(false).
 * Does not start a suppress window (parent is going away).
 */
export function releaseNestedOverlayIfOpen(wasOpen: boolean, layerId?: symbol | null) {
  if (!wasOpen) return;
  if (layerId) {
    openLayers.delete(layerId);
    return;
  }
  const first = openLayers.values().next().value;
  if (first) openLayers.delete(first);
}

/** True when a select/popover/menu is open, or was just closed (race window). */
export function isNestedOverlayActive() {
  return openLayers.size > 0 || performance.now() < suppressDialogCloseUntil;
}

/** Open layers only — excludes the brief post-close suppress window. */
export function isNestedOverlayOpen() {
  return openLayers.size > 0;
}

/** Test helper / diagnostics */
export function getNestedOverlayDebugState() {
  return {
    openCount: openLayers.size,
    suppressed: performance.now() < suppressDialogCloseUntil,
    suppressDialogCloseUntil,
  };
}
