"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";

type RefreshButtonProps = {
  label?: string;
};

export function RefreshButton({ label }: RefreshButtonProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const RefreshIcon = AppIcons.refresh;

  const resolvedLabel = label ?? t("common.refresh" as any);
  const pendingLabel = t("common.refreshing" as any);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-busy={isPending}
          aria-label={isPending ? pendingLabel : resolvedLabel}
          disabled={isPending}
          onClick={() => startTransition(() => router.refresh())}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <RefreshIcon className={isPending ? "animate-spin" : undefined} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isPending ? pendingLabel : resolvedLabel}</TooltipContent>
    </Tooltip>
  );
}
