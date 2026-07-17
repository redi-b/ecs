"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useLocale } from "next-intl";
import type { ComponentProps } from "react";
import { useEffect } from "react";

import { getSharedThemeFromCookie, type SharedTheme } from "@/lib/shared-theme";

/**
 * next-themes injects an inline <script> to set the theme before hydration (FOUC).
 * React 19 warns when client components render <script> tags; the script still
 * runs correctly from the SSR HTML. See:
 * - https://github.com/pacocoursey/next-themes/issues/387
 * - https://github.com/shadcn-ui/ui/issues/10104
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
  // Locale changes trigger router.refresh(); re-apply theme if RSC touched <html>.
  const locale = useLocale();

  useEffect(() => {
    const fromCookie = getSharedThemeFromCookie();
    const theme = fromCookie ?? (activeTheme as SharedTheme | undefined);

    if (!theme || (theme !== "dark" && theme !== "light" && theme !== "system")) {
      return;
    }

    if (fromCookie) {
      setTheme(fromCookie);
    }
    // Force the class even when next-themes short-circuits same-value setTheme.
    applyThemeClass(theme);
  }, [setTheme, activeTheme, locale]);

  return null;
}
