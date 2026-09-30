export async function copyTextToClipboard(value: string) {
  const text = value.trim();

  if (!text || typeof window === "undefined") {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard access can be unavailable on local HTTP hosts or denied by
      // browser permissions. Continue with the selection-based fallback.
    }
  }

  const previouslyFocused = document.activeElement;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.setAttribute("data-clipboard-fallback", "true");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
    if (typeof HTMLElement !== "undefined" && previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus({ preventScroll: true });
    }
  }
}

export function isClipboardFallbackTarget(target: EventTarget | null) {
  return (
    typeof Element !== "undefined" &&
    target instanceof Element &&
    target.hasAttribute("data-clipboard-fallback")
  );
}
