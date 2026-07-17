"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useLocale } from "next-intl";
import type { ComponentProps } from "react";
import { useEffect } from "react";

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

function SharedThemeBridge() {
  const { setTheme, theme: activeTheme } = useTheme();
  const locale = useLocale();

  // Cookie is source of truth across subdomains; localStorage is origin-only.
  useEffect(() => {
    const fromCookie = getSharedThemeFromCookie();
    if (fromCookie) {
      setTheme(fromCookie);
      applyThemeClass(fromCookie);
      try {
        localStorage.setItem("ecs-theme-ls", fromCookie);
      } catch {
        // private mode
      }
      return;
    }

    const theme = (activeTheme as SharedTheme | undefined) ?? "system";
    if (theme === "dark" || theme === "light" || theme === "system") {
      // Persist resolved choice onto parent domain so the next shop host inherits it.
      setSharedThemeCookie(theme);
      applyThemeClass(theme);
    }
  }, [setTheme, activeTheme, locale]);

  return null;
}
