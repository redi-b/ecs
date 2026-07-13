"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { useEffect } from "react";

import { getSharedThemeFromCookie } from "@/lib/shared-theme";

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

function SharedThemeBridge() {
  const { setTheme } = useTheme();

  useEffect(() => {
    const theme = getSharedThemeFromCookie();

    if (theme) {
      setTheme(theme);
    }
  }, [setTheme]);

  return null;
}
