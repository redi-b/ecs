"use client";

import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import { CommandCenter } from "@/components/app/command-center";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <div className="min-w-0 flex-1">
        <AppBreadcrumbs />
      </div>
      <CommandCenter />
      <ThemeToggle />
    </header>
  );
}
