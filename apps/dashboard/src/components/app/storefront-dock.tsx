"use client";

import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { copyTextToClipboard, isClipboardFallbackTarget } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

export function StorefrontDock({
  storefrontPublished,
  storefrontUrl,
}: {
  storefrontPublished: boolean;
  storefrontUrl: string;
}) {
  const { isMobile, setOpenMobile, state } = useSidebar();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByHover = useRef(false);
  const collapsed = state === "collapsed" && !isMobile;
  const displayAddress = storefrontUrl.startsWith("/")
    ? t("common.viewDemo")
    : new URL(storefrontUrl).hostname;
  const statusLabel = t(
    storefrontPublished ? "common.storefrontDock.published" : "common.storefrontDock.notPublished",
  );

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    },
    [],
  );

  function clearHoverClose() {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = null;
  }

  function openOnHover(event: ReactPointerEvent) {
    if (event.pointerType !== "mouse") return;
    clearHoverClose();
    if (!open) openedByHover.current = true;
    setOpen(true);
  }

  function closeAfterHover(event: ReactPointerEvent) {
    if (event.pointerType !== "mouse") return;
    clearHoverClose();
    hoverCloseTimer.current = setTimeout(() => setOpen(false), 140);
  }

  async function copyLink() {
    const success = await copyTextToClipboard(storefrontUrl);
    if (!success) {
      toast.error(t("common.storefrontDock.copyFailed"));
      return;
    }

    setCopied(true);
    toast.success(t("common.storefrontDock.copied"));
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      className="shrink-0 border-t border-sidebar-border px-2 py-2 group-data-[collapsible=icon]:px-2"
      data-slot="storefront-dock"
    >
      <SidebarMenu>
        <SidebarMenuItem>
          <Popover
            onOpenChange={(nextOpen) => {
              clearHoverClose();
              setOpen(nextOpen);
            }}
            open={open}
          >
            <PopoverTrigger asChild>
              <SidebarMenuButton
                aria-expanded={open}
                aria-label={`${t("common.storefrontDock.title")}: ${statusLabel}`}
                className="group-data-[collapsible=icon]:mx-auto"
                onPointerEnter={openOnHover}
                onPointerLeave={closeAfterHover}
              >
                <AppIcons.global />
                <span
                  aria-label={statusLabel}
                  className={cn(
                    "absolute top-1 right-1 hidden size-1.5 rounded-full ring-2 ring-sidebar group-data-[collapsible=icon]:block",
                    storefrontPublished ? "bg-success" : "bg-muted-foreground/55",
                  )}
                  data-storefront-status-collapsed
                  role="img"
                />
                <span className="truncate font-medium">{t("common.storefrontDock.title")}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      aria-label={statusLabel}
                      className={cn(
                        "ms-auto size-1.5 shrink-0 rounded-full group-data-[collapsible=icon]:hidden",
                        storefrontPublished ? "bg-success" : "bg-muted-foreground/45",
                      )}
                      data-storefront-status
                      role="img"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    {statusLabel}
                  </TooltipContent>
                </Tooltip>
                <AppIcons.arrowRight className="text-sidebar-foreground/55 transition-transform duration-150 ease-[var(--ease-dashboard)] group-data-[collapsible=icon]:hidden group-aria-expanded/menu-button:rotate-90" />
              </SidebarMenuButton>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 gap-0 overflow-hidden p-0"
              collisionPadding={12}
              onOpenAutoFocus={(event) => {
                if (openedByHover.current) event.preventDefault();
                openedByHover.current = false;
              }}
              onFocusOutside={(event) => {
                if (isClipboardFallbackTarget(event.target)) event.preventDefault();
              }}
              onPointerEnter={openOnHover}
              onPointerLeave={closeAfterHover}
              side={isMobile ? "top" : "right"}
              sideOffset={collapsed ? 10 : 8}
            >
              <PopoverHeader className="gap-1.5 border-b px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <PopoverTitle>{t("common.storefrontDock.title")}</PopoverTitle>
                  <Badge variant={storefrontPublished ? "success" : "secondary"}>
                    {t(
                      storefrontPublished
                        ? "common.storefrontDock.published"
                        : "common.storefrontDock.notPublished",
                    )}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground" title={displayAddress}>
                  {displayAddress}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(
                    storefrontPublished
                      ? "common.storefrontDock.publishedDescription"
                      : "common.storefrontDock.notPublishedDescription",
                  )}
                </p>
              </PopoverHeader>
              <div className="grid grid-cols-2 gap-1 p-1.5">
                <Button asChild className="justify-start" size="sm" variant="ghost">
                  <a
                    href={storefrontUrl}
                    onClick={() => {
                      setOpen(false);
                      if (isMobile) setOpenMobile(false);
                    }}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <AppIcons.externalLink data-icon="inline-start" />
                    {t("common.storefrontDock.open")}
                  </a>
                </Button>
                <Button
                  aria-live="polite"
                  className="justify-start"
                  onClick={() => void copyLink()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {copied ? (
                    <AppIcons.check data-icon="inline-start" />
                  ) : (
                    <AppIcons.copy data-icon="inline-start" />
                  )}
                  {t(copied ? "common.storefrontDock.copied" : "common.storefrontDock.copy")}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}
