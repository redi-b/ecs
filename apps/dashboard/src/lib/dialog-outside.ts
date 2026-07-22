import { isNestedOverlayActive } from "@/lib/nested-overlay";

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
  "[data-slot='combobox-content']",
  "[data-slot='combobox-list']",
  "[data-slot='combobox-item']",
  "[data-datetime-picker]",
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

export function isModalOverlayTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (!target.closest(MODAL_OVERLAY_SELECTOR)) return false;
  return !target.closest(MODAL_CONTENT_SELECTOR);
}

/** True when the event landed on a portaled floating surface or stacked modal content. */
export function shouldIgnoreDialogOutsideEvent(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest(FLOATING_UI_SELECTOR)) return true;
  if (target.closest(MODAL_CONTENT_SELECTOR) && !isModalOverlayTarget(target)) {
    return true;
  }
  return false;
}

/**
 * Call from dialog/sheet outside handlers only (not ESC / close button).
 * Keeps the parent open when the interaction is for a nested floating layer.
 */
export function preventDialogDismissForPortals(event: {
  preventDefault: () => void;
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
}) {
  const target = getDialogOutsideTarget(event);
  if (shouldIgnoreDialogOutsideEvent(target)) {
    event.preventDefault();
    return;
  }
  if (isNestedOverlayActive()) {
    event.preventDefault();
  }
}
