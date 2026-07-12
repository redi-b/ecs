import { isNestedOverlayActive } from "@/lib/nested-overlay";

/** Resolve the real click target for Radix dismissable-layer outside events. */
export function getDialogOutsideTarget(event: {
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
}) {
  return event.detail?.originalEvent?.target ?? event.target;
}

/**
 * Prevent dialog/sheet dismiss when interacting with portaled overlays
 * (select, popover, menus, datetime picker).
 */
export function shouldIgnoreDialogOutsideEvent(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      [
        "[data-slot='select-content']",
        "[data-slot='popover-content']",
        "[data-slot='dropdown-menu-content']",
        "[data-slot='select-item']",
        "[data-slot='command']",
        "[data-datetime-picker]",
        "[data-radix-select-content]",
        "[data-radix-select-viewport]",
        "[data-radix-popper-content-wrapper]",
        "[data-radix-select-content-wrapper]",
        "[role='listbox']",
        "[role='option']",
      ].join(", "),
    ),
  );
}

/**
 * Use only on focus/pointer/interact *outside* handlers.
 * Do not gate ESC or the close button via onOpenChange.
 */
export function preventDialogDismissForPortals(event: {
  preventDefault: () => void;
  target: EventTarget | null;
  detail?: { originalEvent?: Event };
}) {
  // Click landed on the floating surface itself.
  if (shouldIgnoreDialogOutsideEvent(getDialogOutsideTarget(event))) {
    event.preventDefault();
    return;
  }

  // Nested select/popover is open, or just closed from this same click.
  // Swallow so the dialog does not close with the dropdown.
  if (isNestedOverlayActive()) {
    event.preventDefault();
  }
}
