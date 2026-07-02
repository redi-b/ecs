import { flushSync } from "react-dom";

type ThemePointerEvent = {
  clientX: number;
  clientY: number;
};

const lastPointerPosition = {
  x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
  y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
};

if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (event) => {
      lastPointerPosition.x = event.clientX;
      lastPointerPosition.y = event.clientY;
    },
    { capture: true, passive: true },
  );
}

export function changeThemeWithTransition(
  setTheme: (theme: string) => void,
  nextTheme: string,
  event?: ThemePointerEvent,
) {
  if (
    typeof document === "undefined" ||
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    setTheme(nextTheme);
    return;
  }

  const x = event?.clientX ?? lastPointerPosition.x;
  const y = event?.clientY ?? lastPointerPosition.y;

  window.setTimeout(() => {
    document.documentElement.style.setProperty("--x", `${x}px`);
    document.documentElement.style.setProperty("--y", `${y}px`);

    document.startViewTransition(() => {
      flushSync(() => {
        setTheme(nextTheme);
      });
    });
  }, 0);
}
