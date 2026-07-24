"use client";

import { useTheme } from "next-themes";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { persistSharedTheme } from "@/lib/shared-theme";
import { changeThemeWithTransition } from "@/lib/theme-transition";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const Icon = isDark ? AppIcons.sun : AppIcons.moon;
  const label = isDark ? t("common.themeToLight") : t("common.themeToDark");

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    if (!mounted) return;
    persistSharedTheme(nextTheme);
    changeThemeWithTransition(setTheme, nextTheme, event);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label={mounted ? label : t("common.toggleTheme")}
      title={mounted ? label : t("common.toggleTheme")}
      disabled={!mounted}
      onClick={toggleTheme}
    >
      <Icon
        className={cn(
          "size-4 transition-[transform,opacity] duration-200 ease-[var(--ease-dashboard)]",
          mounted ? "scale-100 opacity-100" : "scale-95 opacity-70",
        )}
      />
    </Button>
  );
}
