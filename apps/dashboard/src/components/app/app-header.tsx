"use client";

import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import { CommandCenter } from "@/components/app/command-center";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { NotificationCenter } from "@/components/app/notification-center";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:h-16 sm:gap-3 sm:px-6">
      <SidebarTrigger className="size-9 shrink-0 rounded-full" />
      <div
        aria-hidden="true"
        className="hidden h-6 w-px shrink-0 self-center bg-border sm:block"
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <AppBreadcrumbs />
      </div>
      {/* Primary: search. Secondary: utility icons. Right-end is standard for these actions. */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <CommandCenter />
        <div
          aria-hidden="true"
          className="hidden h-5 w-px shrink-0 bg-border/80 sm:block"
        />
        <div className="flex items-center gap-0.5">
          <NotificationCenter />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
