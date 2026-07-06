"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";

type RefreshButtonProps = {
  label?: string;
};

export function RefreshButton({ label = "Refresh" }: RefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const RefreshIcon = AppIcons.refresh;

  return (
    <Button
      aria-busy={isPending}
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      size="sm"
      type="button"
      variant="outline"
    >
      <RefreshIcon className={isPending ? "animate-spin" : undefined} data-icon="inline-start" />
      {isPending ? "Refreshing" : label}
    </Button>
  );
}
