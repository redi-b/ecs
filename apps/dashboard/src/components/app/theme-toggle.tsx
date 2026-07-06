"use client";

import { useTheme } from "next-themes";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { setSharedThemeCookie } from "@/lib/shared-theme";
import { changeThemeWithTransition } from "@/lib/theme-transition";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const Icon = isDark ? AppIcons.sun : AppIcons.moon;

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const nextTheme = isDark ? "light" : "dark";

    setSharedThemeCookie(nextTheme);
    changeThemeWithTransition(setTheme, nextTheme, event);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={toggleTheme}
      suppressHydrationWarning
    >
      <Icon />
    </Button>
  );
}
