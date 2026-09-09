"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { OperationsDataState } from "@/components/operations-data-state";

export default function OperationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <OperationsDataState className="min-h-[55vh]" title="This page could not be opened" description="Try again or return to the overview." tone="destructive" action={<>
        <Button onClick={reset}>
          <RotateCcw aria-hidden /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Operations overview</Link>
        </Button>
      </>} />
  );
}
