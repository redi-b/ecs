import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { OperationsAvailabilityState } from "@/components/operations-availability-state";
import { OperationsShell } from "@/components/operations-shell";
import { resolveOperationsAccessAction } from "@/lib/operations-access-policy";
import { getOpsAccess } from "@/lib/ops-access";

export default async function OperationsLayout({ children }: { children: ReactNode }) {
  const access = await getOpsAccess();
  if (!access.ok) {
    const action = resolveOperationsAccessAction(access.kind);
    if (action === "sign_in") redirect("/sign-in");
    if (action === "not_found") notFound();
    return <OperationsAvailabilityState />;
  }

  return (
    <OperationsShell operator={access.operator} permissions={access.permissions}>
      {children}
    </OperationsShell>
  );
}
