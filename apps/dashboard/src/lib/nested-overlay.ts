/**
 * Tracks nested floating UI (select / popover / menu) so parent dialogs do not
 * dismiss when the user click-aways to close only the nested layer.
 *
 * Why a suppress window: Radix often unmounts the select content before the
 * dialog handles the same pointer event, so a DOM query for open content is
 * already empty.
 *
 * Important: this must ONLY gate outside-click / focus-outside dismissals —
 * never ESC or the close (X) button. Those go through onOpenChange and must
 * always reach the parent.
 */

let openCount = 0;
let suppressDialogCloseUntil = 0;

const SUPPRESS_MS = 200;

export function notifyNestedOverlayChange(open: boolean) {
  if (open) {
    openCount += 1;
    return;
  }

  openCount = Math.max(0, openCount - 1);
  // Keep outside-dismiss suppressed briefly after nested layer closes.
  suppressDialogCloseUntil = performance.now() + SUPPRESS_MS;
}

/**
 * Call from floating-layer roots on unmount when still open, so openCount
 * cannot stick after a parent dialog unmounts without firing onOpenChange(false).
 */
export function releaseNestedOverlayIfOpen(wasOpen: boolean) {
  if (!wasOpen) return;
  openCount = Math.max(0, openCount - 1);
}

export function isNestedOverlayActive() {
  return openCount > 0 || performance.now() < suppressDialogCloseUntil;
}

/** Test helper / diagnostics */
export function getNestedOverlayDebugState() {
  return {
    openCount,
    suppressed: performance.now() < suppressDialogCloseUntil,
    suppressDialogCloseUntil,
  };
}
