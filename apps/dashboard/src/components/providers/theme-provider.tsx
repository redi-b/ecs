"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";

import {
  getSharedThemeFromCookie,
  persistSharedTheme,
  type SharedTheme,
} from "@/lib/shared-theme";

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
  const didHydrateFromCookie = useRef(false);

  useEffect(() => {
    if (didHydrateFromCookie.current) return;
    didHydrateFromCookie.current = true;

    const fromCookie = getSharedThemeFromCookie();
    if (fromCookie) {
      setTheme(fromCookie);
      applyThemeClass(fromCookie);
      persistSharedTheme(fromCookie);
    }
  }, [setTheme]);

  useEffect(() => {
    if (!didHydrateFromCookie.current) return;
    if (activeTheme !== "dark" && activeTheme !== "light" && activeTheme !== "system") {
      return;
    }
    const theme = activeTheme as SharedTheme;
    persistSharedTheme(theme);
    applyThemeClass(theme);
  }, [activeTheme]);

  useEffect(() => {
    if (activeTheme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeClass("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [activeTheme]);

  return null;
}
