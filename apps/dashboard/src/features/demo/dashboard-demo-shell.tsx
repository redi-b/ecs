"use client";

import type { ReactNode } from "react";

import { ActorProvider } from "@/components/app/actor-context";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BreadcrumbLabelsProvider } from "@/components/app/breadcrumb-labels";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { dashboardDemoFixture } from "@/features/demo/dashboard-demo-fixture";
import { DemoInteractionBoundary } from "@/features/demo/demo-interaction-boundary";

export function DashboardDemoShell({ children }: { children: ReactNode }) {
  return (
    <DemoInteractionBoundary notice="This preview does not make changes.">
      <TooltipProvider>
        <SidebarProvider>
          <ActorProvider actor={dashboardDemoFixture.actor}>
            <AppSidebar access={dashboardDemoFixture} demoMode />
            <SidebarInset>
              <BreadcrumbLabelsProvider>
                <AppHeader />
                {children}
              </BreadcrumbLabelsProvider>
            </SidebarInset>
          </ActorProvider>
        </SidebarProvider>
      </TooltipProvider>
    </DemoInteractionBoundary>
  );
}
