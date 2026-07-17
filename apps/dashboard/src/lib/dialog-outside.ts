import { isNestedOverlayActive } from "@/lib/nested-overlay";

/** Resolve the real click target for Radix dismissable-layer outside events. */
export function getDialogOutsideTarget(event: {
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
}) {
  return event.detail?.originalEvent?.target ?? event.target;
}

const FLOATING_UI_SELECTOR = [
  "[data-slot='select-content']",
  "[data-slot='popover-content']",
  "[data-slot='dropdown-menu-content']",
  "[data-slot='select-item']",
  "[data-slot='command']",
  "[data-datetime-picker]",
  // Portaled bulk selection dock — clicks must not dismiss the mobile sidebar sheet.
  "[data-slot='data-table-bulk-bar']",
  "[data-radix-select-content]",
  "[data-radix-select-viewport]",
  "[data-radix-popper-content-wrapper]",
  "[data-radix-select-content-wrapper]",
  "[role='listbox']",
  "[role='option']",
].join(", ");

const MODAL_CONTENT_SELECTOR = [
  "[data-slot='dialog-content']",
  "[data-slot='sheet-content']",
  "[data-slot='alert-dialog-content']",
  "[data-media-lightbox]",
].join(", ");

const MODAL_OVERLAY_SELECTOR = [
  "[data-slot='dialog-overlay']",
  "[data-slot='sheet-overlay']",
  "[data-slot='alert-dialog-overlay']",
].join(", ");

/** True when the event landed on a modal scrim/backdrop. */
export function isModalOverlayTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (!target.closest(MODAL_OVERLAY_SELECTOR)) return false;
  return !target.closest(MODAL_CONTENT_SELECTOR);
}

/**
 * Prevent dialog/sheet dismiss when interacting with portaled overlays
 * (select, popover, menus, datetime picker) or a stacked higher modal surface.
 */
export function shouldIgnoreDialogOutsideEvent(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  // Floating menus / pickers portaled outside the dialog/sheet content.
  if (target.closest(FLOATING_UI_SELECTOR)) return true;

  // Stacked higher modal *content* (library dialog / lightbox body).
  // Do not treat modal scrims as content — those dismiss the top layer via Radix.
  if (target.closest(MODAL_CONTENT_SELECTOR) && !isModalOverlayTarget(target)) {
    return true;
  }

  return false;
}

/**
 * Use only on focus/pointer/interact *outside* handlers.
 * Do not gate ESC or the close button via onOpenChange.
 *
 * Rules:
 * 1. Click on select/popover/menu surface → keep parent open.
 * 2. Nested select/popover is open, or just closed on this same pointer event
 *    (including scrim clicks that only meant to close the dropdown) → keep parent open.
 * 3. Otherwise allow dismiss (empty scrim click with no nested layer).
 */
export function preventDialogDismissForPortals(event: {
  preventDefault: () => void;
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
}) {
  const target = getDialogOutsideTarget(event);

  // Click landed on a floating surface or higher modal content.
  if (shouldIgnoreDialogOutsideEvent(target)) {
    event.preventDefault();
    return;
  }

  // Nested select / popover / menu is open, or was just closed by this same
  // outside click (including clicks on the sheet/dialog scrim). Swallow so the
  // parent modal does not close together with the dropdown.
  if (isNestedOverlayActive()) {
    event.preventDefault();
  }
}
