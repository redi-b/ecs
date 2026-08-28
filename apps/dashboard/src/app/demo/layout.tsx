import type { ReactNode } from "react";

import { DashboardDemoShell } from "@/features/demo/dashboard-demo-shell";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardDemoShell>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-x-hidden p-4 sm:gap-6 sm:p-5 md:gap-7 md:p-8">
        {children}
      </main>
    </DashboardDemoShell>
  );
}
