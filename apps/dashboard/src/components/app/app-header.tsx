"use client";

import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import { CommandCenter } from "@/components/app/command-center";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background/90 px-6 backdrop-blur">
      <SidebarTrigger className="size-9 rounded-full" />
      <div aria-hidden="true" className="h-6 w-px shrink-0 self-center bg-border" />
      <div className="min-w-0 flex-1">
        <AppBreadcrumbs />
      </div>
      <CommandCenter />
      <ThemeToggle />
    </header>
  );
}
