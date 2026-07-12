"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type RefreshButtonProps = {
  label?: string;
};

export function RefreshButton({ label = "Refresh" }: RefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const RefreshIcon = AppIcons.refresh;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-busy={isPending}
          aria-label={isPending ? "Refreshing" : label}
          disabled={isPending}
          onClick={() => startTransition(() => router.refresh())}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <RefreshIcon className={isPending ? "animate-spin" : undefined} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isPending ? "Refreshing" : label}</TooltipContent>
    </Tooltip>
  );
}
