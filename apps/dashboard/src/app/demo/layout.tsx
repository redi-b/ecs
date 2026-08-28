import type { ReactNode } from "react";

import { DashboardDemoShell } from "@/features/demo/dashboard-demo-shell";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <DashboardDemoShell>{children}</DashboardDemoShell>;
}
