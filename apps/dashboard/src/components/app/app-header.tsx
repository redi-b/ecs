"use client";

import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import { CommandCenter } from "@/components/app/command-center";
import { LanguageSwitcher } from "@/components/app/language-switcher";
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
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <CommandCenter />
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
