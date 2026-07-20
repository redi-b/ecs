"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";

import {
  getSharedThemeFromCookie,
  setSharedThemeCookie,
  type SharedTheme,
} from "@/lib/shared-theme";

/**
 * next-themes injects an inline <script> for localStorage FOUC prevention.
 * We also set ecs-theme (parent-domain cookie) and a blocking cookie script in layout
 * so theme survives dashboard.* ↔ shop.* navigation where localStorage is origin-scoped.
 */
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      first.includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <SharedThemeBridge />
      {children}
    </NextThemesProvider>
  );
}

function applyThemeClass(theme: SharedTheme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Cookie is the cross-subdomain source of truth on first load only.
 * After that, next-themes (user toggle) owns the value; we write cookie/LS
 * when theme changes. Re-reading cookie on every theme change caused prod stuck
 * toggles when a host-only cookie shadowed Domain= and never updated.
 */
function SharedThemeBridge() {
  const { setTheme, theme: activeTheme } = useTheme();
  const didHydrateFromCookie = useRef(false);

  useEffect(() => {
    if (didHydrateFromCookie.current) return;
    didHydrateFromCookie.current = true;

    const fromCookie = getSharedThemeFromCookie();
    if (fromCookie) {
      setTheme(fromCookie);
      applyThemeClass(fromCookie);
      try {
        localStorage.setItem("ecs-theme-ls", fromCookie);
      } catch {
        // private mode
      }
    }
  }, [setTheme]);

  useEffect(() => {
    if (!didHydrateFromCookie.current) return;
    if (activeTheme !== "dark" && activeTheme !== "light" && activeTheme !== "system") {
      return;
    }
    const theme = activeTheme as SharedTheme;
    setSharedThemeCookie(theme);
    applyThemeClass(theme);
    try {
      localStorage.setItem("ecs-theme-ls", theme);
    } catch {
      // private mode
    }
  }, [activeTheme]);

  return null;
}
