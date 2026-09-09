"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

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
    <Empty className="min-h-[55vh] rounded-2xl border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>This page could not be opened</EmptyTitle>
        <EmptyDescription>
          Try again. If the problem continues, return to the Operations overview.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={reset}>
          <RotateCcw aria-hidden /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Operations overview</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
