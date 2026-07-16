"use client";

import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type HelpTipProps = {
  /** Short one-line summary (tooltip on hover). */
  summary: string;
  /** Optional longer body for the popover. */
  children?: ReactNode;
  className?: string;
  label?: string;
  title?: string;
};

/**
 * Compact “?” help control for dense merchant UIs.
 * Hover shows a short tooltip; click/focus opens a popover for more detail.
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

  return (
    <TooltipProvider delayDuration={200}>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs" side="top">
            {summary}
          </TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-72 space-y-1.5 p-3 text-sm" side="top">
          {title ? <p className="font-medium leading-snug">{title}</p> : null}
          <p className="text-muted-foreground leading-relaxed">{children ?? summary}</p>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
