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
 * Optional `rich` layout mirrors the old in-page help cards (icon + title + body).
 */
export function HelpTip({
  summary,
  children,
  className,
  label,
  title,
  rich = false,
  contentClassName,
}: HelpTipProps & {
  /** Larger popover with leading icon — for setup/help content that used to be a card. */
  rich?: boolean;
  contentClassName?: string;
}) {
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
      <PopoverContent
        align="end"
        className={cn(
          rich
            ? "w-[min(22rem,calc(100vw-2rem))] space-y-0 p-0 text-sm"
            : "w-72 space-y-1.5 p-3 text-sm",
          contentClassName,
        )}
        side="bottom"
      >
        {rich ? (
          <div className="flex items-start gap-3 p-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/30">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-1.5">
              {title ? (
                <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
              ) : null}
              <div className="text-sm leading-relaxed text-muted-foreground">{body}</div>
            </div>
          </div>
        ) : (
          <>
            {title ? <p className="font-medium leading-snug">{title}</p> : null}
            <div className="leading-relaxed text-muted-foreground">{body}</div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
