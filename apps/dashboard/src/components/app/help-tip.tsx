"use client";

import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type HelpTipProps = {
  /** Short summary shown in the popover body when `children` is omitted. */
  summary: string;
  /** Optional longer body for the popover. */
  children?: ReactNode;
  className?: string;
  label?: string;
  title?: string;
};

/**
 * Compact “?” help control for dense merchant UIs.
 * Single interaction: click/tap opens a popover (works the same on desktop and mobile).
 */
export function HelpTip({
  summary,
  children,
  className,
  label,
  title,
}: HelpTipProps) {
  const { t } = useI18n();
  const resolvedLabel = label ?? t("common.moreInfo");
  const Icon = AppIcons.question;
  const body = children ?? summary;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={resolvedLabel}
          className={cn(
            "size-5 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground",
            className,
          )}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Icon className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-1.5 p-3 text-sm" side="bottom">
        {title ? <p className="font-medium leading-snug">{title}</p> : null}
        <div className="text-muted-foreground leading-relaxed">{body}</div>
      </PopoverContent>
    </Popover>
  );
}
