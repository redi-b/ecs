"use client";

import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import { CommandCenter } from "@/components/app/command-center";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b bg-background px-6">
      <SidebarTrigger className="size-9 rounded-full" />
      <div aria-hidden="true" className="h-6 w-px shrink-0 self-center bg-border" />
      <div className="min-w-0 flex-1">
        <AppBreadcrumbs />
      </div>
      <CommandCenter />
      <LanguageSwitcher />
      <ThemeToggle />
    </header>
  );
}
