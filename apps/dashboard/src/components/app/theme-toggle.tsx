"use client";

import { useTheme } from "next-themes";
import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";

const THEME_SWAP_DELAY_MS = 280;
const THEME_TRANSITION_DURATION_MS = 380;
const THEME_BACKGROUND = {
  dark: "oklch(0.184 0.027 255)",
  light: "oklch(0.987 0.008 248)",
} as const;

type ThemeName = keyof typeof THEME_BACKGROUND;
type TransitionPoint = {
  x: number;
  y: number;
  color: (typeof THEME_BACKGROUND)[ThemeName];
};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [transitionPoint, setTransitionPoint] = useState<TransitionPoint | null>(null);
  const swapTimeoutRef = useRef<number | null>(null);
  const clearTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);

    return () => {
      if (swapTimeoutRef.current !== null) {
        window.clearTimeout(swapTimeoutRef.current);
      }

      if (clearTimeoutRef.current !== null) {
        window.clearTimeout(clearTimeoutRef.current);
      }
    };
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const Icon = isDark ? AppIcons.sun : AppIcons.moon;
  const overlayStyle = transitionPoint
    ? ({
        "--theme-x": `${transitionPoint.x}px`,
        "--theme-y": `${transitionPoint.y}px`,
        "--theme-overlay-color": transitionPoint.color,
      } as CSSProperties)
    : undefined;

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const nextTheme: ThemeName = isDark ? "light" : "dark";
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setTheme(nextTheme);
      return;
    }

    setTransitionPoint({
      x: event.clientX,
      y: event.clientY,
      color: THEME_BACKGROUND[nextTheme],
    });

    swapTimeoutRef.current = window.setTimeout(() => {
      setTheme(nextTheme);
    }, THEME_SWAP_DELAY_MS);

    clearTimeoutRef.current = window.setTimeout(() => {
      setTransitionPoint(null);
    }, THEME_TRANSITION_DURATION_MS);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        disabled={!mounted || transitionPoint !== null}
        onClick={toggleTheme}
      >
        <Icon />
      </Button>
      <div
        aria-hidden="true"
        className="theme-transition-overlay"
        data-active={transitionPoint ? "true" : "false"}
        style={overlayStyle}
      />
    </>
  );
}
