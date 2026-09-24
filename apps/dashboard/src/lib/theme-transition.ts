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

function setThemeTransitionOrigin(x: number, y: number) {
  const root = document.documentElement;
  root.style.setProperty("--x", `${x}px`);
  root.style.setProperty("--y", `${y}px`);
}

function clearThemeTransitionOrigin() {
  const root = document.documentElement;
  root.style.removeProperty("--x");
  root.style.removeProperty("--y");
}

export function changeThemeWithTransition(
  setTheme: (theme: string) => void,
  nextTheme: string,
  event?: ThemePointerEvent,
) {
  if (
    typeof document === "undefined" ||
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    setTheme(nextTheme);
    return;
  }

  const x = event?.clientX ?? lastPointerPosition.x;
  const y = event?.clientY ?? lastPointerPosition.y;

  window.setTimeout(() => {
    setThemeTransitionOrigin(x, y);

    try {
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          setTheme(nextTheme);
        });
      });
      void transition.finished.finally(clearThemeTransitionOrigin);
    } catch {
      clearThemeTransitionOrigin();
      setTheme(nextTheme);
    }
  }, 0);
}
