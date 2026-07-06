"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { useEffect } from "react";

import { getSharedThemeFromCookie } from "@/lib/shared-theme";

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
