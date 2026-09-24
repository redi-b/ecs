import Link from "next/link";

import { OperationsDataState } from "@/components/operations-data-state";
import { RefreshPageButton } from "@/components/refresh-page-button";
import { Button } from "@/components/ui/button";

export function OperatorReadError({
  resource,
  status,
  unavailableDescription,
}: {
  resource: string;
  status: number;
  unavailableDescription: string;
}) {
  if (status === 401) {
    return (
      <OperationsDataState
        action={<Button asChild size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>}
        description="Sign in again to continue."
        title="Your session has ended"
        tone="restricted"
      />
    );
  }

  if (status === 403) {
    return (
      <OperationsDataState description={`Your account does not have access to ${resource}.`} title="Access not assigned" tone="restricted" />
    );
  }

  return (
    <OperationsDataState action={<RefreshPageButton label="Try again" />} description={unavailableDescription} title={`${resource} unavailable`} tone="destructive" />
  );
}
