import { LockKeyhole, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { RefreshPageButton } from "@/components/refresh-page-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
      <Alert>
        <LockKeyhole aria-hidden />
        <AlertTitle>Your session has ended</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
          <span>Sign in again to continue working in ECS Operations.</span>
          <Button asChild size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 403) {
    return (
      <Alert>
        <LockKeyhole aria-hidden />
        <AlertTitle>Access not assigned</AlertTitle>
        <AlertDescription>
          Your operator account does not have access to {resource}. No changes were made.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertTitle>{resource} unavailable</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
        <span>{unavailableDescription}</span>
        <RefreshPageButton label="Try again" />
      </AlertDescription>
    </Alert>
  );
}
