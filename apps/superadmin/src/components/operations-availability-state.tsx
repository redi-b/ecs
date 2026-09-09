"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { OperationsDataState } from "@/components/operations-data-state";
import { Spinner } from "@/components/ui/spinner";

export function OperationsAvailabilityState() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <OperationsDataState className="w-full max-w-xl" description="Try again in a moment." title="Operations is temporarily unavailable" tone="destructive" action={<Button
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
          </Button>} />
    </main>
  );
}
