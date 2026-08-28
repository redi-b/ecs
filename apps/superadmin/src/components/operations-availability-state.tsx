"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

export function OperationsAvailabilityState() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <Empty className="w-full max-w-xl rounded-2xl border bg-card py-16 shadow-xs">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RotateCcw />
          </EmptyMedia>
          <EmptyTitle>Operations is temporarily unavailable</EmptyTitle>
          <EmptyDescription>
            We couldn’t open the workspace. Try again in a moment.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
            type="button"
          >
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RotateCcw data-icon="inline-start" />
            )}
            {pending ? "Trying again…" : "Try again"}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
