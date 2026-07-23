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
  /**
   * Card-style popover (icon header + body). Use for setup/help that used to
   * live as an in-page help panel — not for one-line field hints.
   */
  rich?: boolean;
  contentClassName?: string;
  /** Optional footer under rich body (e.g. contact support button). */
  footer?: ReactNode;
};

/**
 * Compact “?” help control for dense merchant UIs.
 */
export function HelpTip({
  summary,
  children,
  className,
  label,
  title,
  rich = false,
  contentClassName,
  footer,
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
      <PopoverContent
        align="end"
        className={cn(
          rich
            ? "w-[min(20rem,calc(100vw-2rem))] overflow-hidden p-0 text-sm shadow-lg"
            : "w-72 space-y-1.5 p-3 text-sm",
          contentClassName,
        )}
        side="bottom"
        sideOffset={6}
      >
        {rich ? (
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 border-b border-border/60 bg-muted/25 px-3.5 py-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground shadow-xs">
                <Icon className="size-3.5" />
              </div>
              {title ? (
                <p className="min-w-0 text-sm font-medium tracking-tight text-foreground">
                  {title}
                </p>
              ) : null}
            </div>
            <div className="space-y-2.5 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
              {body}
            </div>
            {footer ? (
              <div className="border-t border-border/60 bg-muted/15 px-3.5 py-2.5">{footer}</div>
            ) : null}
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
