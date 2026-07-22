"use client";

import type { MerchantSearchHit, MerchantSearchHitType } from "@ecs/contracts";
import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";
import {
  commandSearchValue,
  filterStaticCommands,
  getAllStaticCommands,
  type CommandDef,
} from "@/lib/command-registry";
import {
  loadRecentCommands,
  pushRecentCommand,
  type RecentCommandItem,
} from "@/lib/command-recent";
import { getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import {
  groupLabelForSearchType,
  hrefForSearchHit,
} from "@/lib/merchant-search";
import { parseCreateFromHref, requestOpenCreate } from "@/lib/open-create";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

const REMOTE_MIN_CHARS = 2;
const DEBOUNCE_MS = 220;

/** Progressive waves — core types first, then the rest. */
const SEARCH_WAVES: MerchantSearchHitType[][] = [
  ["product", "order", "customer"],
  ["media", "category", "collection", "promotion"],
];

const TYPE_ORDER: MerchantSearchHitType[] = [
  "product",
  "order",
  "customer",
  "media",
  "category",
  "collection",
  "promotion",
];

function searchTypeIcon(type: MerchantSearchHitType) {
  switch (type) {
    case "product":
      return AppIcons.products;
    case "order":
      return AppIcons.orders;
    case "customer":
      return AppIcons.user;
    case "media":
      return AppIcons.image;
    case "category":
      return AppIcons.tree;
    case "collection":
      return AppIcons.folder;
    case "promotion":
      return AppIcons.tag;
    default:
      return AppIcons.search;
  }
}

function IconTile({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // size-7 tile + size-3.5 glyph keeps icons lighter than the previous size-8/size-4 pair
        "flex size-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/40 text-muted-foreground transition-colors",
        "group-data-selected/command-item:border-primary/25 group-data-selected/command-item:bg-primary/10 group-data-selected/command-item:text-primary",
        "[&_svg]:size-3.5!",
        className,
      )}
    >
      {children}
    </span>
  );
}

function useModKeyLabel() {

  const [modKey, setModKey] = useState("Ctrl");
  useEffect(() => {
    const apple = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setModKey(apple ? "⌘" : "Ctrl");
  }, []);
  return modKey;
}

export function CommandCenter() {
  const { t } = useI18n();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteByType, setRemoteByType] = useState<
    Partial<Record<MerchantSearchHitType, MerchantSearchHit[]>>
  >({});
  const [pendingWaves, setPendingWaves] = useState(0);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentCommandItem[]>([]);
  const modKey = useModKeyLabel();

  const tenantId =
    typeof window !== "undefined"
      ? getSelectedTenantId({
          tenantId: new URLSearchParams(window.location.search).get("tenantId") ?? undefined,
        }) ?? window.location.hostname
      : "default";

  const staticCommands = useMemo(() => getAllStaticCommands(t), [t]);
  const filteredCommands = useMemo(
    () => filterStaticCommands(query, staticCommands),
    [query, staticCommands],
  );
  const actionCommands = filteredCommands.filter((c) => c.group === "action");
  const navCommands = filteredCommands.filter((c) => c.group === "navigation");

  const remoteHitsCount = useMemo(
    () => Object.values(remoteByType).reduce((sum, list) => sum + (list?.length ?? 0), 0),
    [remoteByType],
  );
  const remoteLoading = pendingWaves > 0;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setRemoteByType({});
      setRemoteError(null);
      setPendingWaves(0);
      return;
    }
    setRecent(loadRecentCommands(tenantId));
  }, [open, tenantId]);

  // Progressive multi-wave search: paint groups as each wave returns.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < REMOTE_MIN_CHARS) {
      setRemoteByType({});
      setRemoteError(null);
      setPendingWaves(0);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setRemoteByType({});
    setRemoteError(null);
    setPendingWaves(SEARCH_WAVES.length);

    const timer = window.setTimeout(() => {
      SEARCH_WAVES.forEach((types) => {
        const params = new URLSearchParams({
          q,
          limit: "6",
          types: types.join(","),
        });
        if (tenantId.includes("-") && tenantId.length > 20) {
          params.set("tenantId", tenantId);
        }

        void fetch(`/admin/search?${params}`, {
          headers: { accept: "application/json" },
          signal: controller.signal,
          cache: "no-store",
        })
          .then(async (response) => {
            if (!active) return;
            const data = (await response.json().catch(() => ({}))) as {
              results?: MerchantSearchHit[];
              error?: string;
            };
            if (!response.ok) {
              setRemoteError((prev) => prev ?? data.error ?? t("commandCenter.searchFailed"));
              return;
            }
            const hits = Array.isArray(data.results) ? data.results : [];
            setRemoteByType((prev) => {
              const next = { ...prev };
              for (const type of types) {
                next[type] = hits.filter((hit) => hit.type === type);
              }
              return next;
            });
          })
          .catch((error) => {
            if (!active || (error as Error).name === "AbortError") return;
            setRemoteError((prev) => prev ?? t("commandCenter.searchFailed"));
          })
          .finally(() => {
            if (!active) return;
            setPendingWaves((count) => Math.max(0, count - 1));
          });
      });
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query, tenantId]);

  const closePalette = useCallback(() => {
    setOpen(false);
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  const go = useCallback(
    (href: string, recentItem?: Omit<RecentCommandItem, "at">) => {
      if (recentItem) {
        setRecent(pushRecentCommand(tenantId, recentItem));
      }
      router.push(href);
      closePalette();
    },
    [closePalette, router, tenantId],
  );

  function selectCommand(command: CommandDef) {
    const recentItem = {
      id: command.id,
      kind: "command" as const,
      label: command.label,
      href: command.href,
    };

    // Same-page create: open dialog via event — no Next navigation / RSC reload.
    const { pathname, create } = parseCreateFromHref(command.href);
    if (create && typeof window !== "undefined") {
      const current = window.location.pathname.replace(/\/$/, "") || "/";
      const target = pathname.replace(/\/$/, "") || "/";
      if (current === target) {
        setRecent(pushRecentCommand(tenantId, recentItem));
        requestOpenCreate(create);
        closePalette();
        return;
      }
    }

    go(command.href, recentItem);
  }

  function selectHit(hit: MerchantSearchHit) {
    const href = hrefForSearchHit(hit);
    go(href, {
      id: `${hit.type}:${hit.id}`,
      kind: "resource",
      type: hit.type,
      label: hit.label,
      href,
    });
  }

  function selectRecent(item: RecentCommandItem) {
    go(item.href, item);
  }

  const showEmptyQuery = query.trim().length === 0;
  const showRemote = query.trim().length >= REMOTE_MIN_CHARS;
  const hasLocal = actionCommands.length > 0 || navCommands.length > 0;
  const hasRemote = remoteHitsCount > 0;
  const showEmpty =
    !showEmptyQuery && !hasLocal && !hasRemote && !remoteLoading;


  const [inputPlaceholder, setInputPlaceholder] = useState(t("commandCenter.searchOrJump"));
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => {
      setInputPlaceholder(
        mq.matches ? t("commandCenter.searchOrJumpLong") : t("commandCenter.searchOrJump"),
      );
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={t("commandCenter.openAria")}
          size="icon"
          className={cn(
            "size-9 shrink-0 text-muted-foreground",
            "sm:h-9 sm:w-auto sm:min-w-[15.5rem] sm:justify-start sm:gap-2 sm:rounded-xl sm:border sm:border-border/80 sm:bg-background sm:px-3 sm:shadow-sm",
            "sm:hover:bg-accent sm:hover:text-accent-foreground",
          )}
        >
          <AppIcons.search className="size-4 opacity-80" />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {t("commandCenter.triggerLabel")}
          </span>
          <KbdGroup className="ml-auto hidden shrink-0 sm:inline-flex">
            <Kbd className={cn(modKey === "⌘" && "min-w-5 px-1 text-[13px] leading-none")}>
              {modKey}
            </Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          // Mobile: near full-screen sheet from top for thumb reach + more list room.
          "fixed top-0 left-1/2 z-50 flex max-h-[100dvh] w-full max-w-full -translate-x-1/2 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-2xl",
          "data-open:zoom-in-100 data-closed:zoom-out-100",

          "sm:top-[min(12vh,6rem)] sm:max-h-[min(36rem,80dvh)] sm:max-w-xl sm:rounded-2xl sm:border sm:border-border/70",
          "bg-popover",
          "ring-1 ring-black/5 dark:ring-white/10",
          "pb-[env(safe-area-inset-bottom,0px)]",
        )}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t("commandCenter.title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("commandCenter.dialogDescription")}
        </DialogDescription>

        {/* Mobile drag/close chrome */}
        <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2 sm:hidden">
          <p className="text-sm font-medium">{t("commandCenter.title")}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("commandCenter.closeAria")}
            onClick={() => setOpen(false)}
          >
            <AppIcons.close className="size-4" />
          </Button>
        </div>

        <Command
          shouldFilter={false}
          className="flex min-h-0 flex-1 flex-col rounded-none bg-transparent sm:rounded-2xl"
        >
          <CommandInput
            placeholder={inputPlaceholder}
            value={query}
            onValueChange={setQuery}
            size="lg"
          />

          <CommandList className="min-h-0 flex-1 scroll-py-1 px-2 pb-2 max-h-none sm:max-h-[min(28rem,55dvh)]">
            {showEmpty ? (
              <CommandEmpty className="py-10 text-muted-foreground">
                {remoteError ? remoteError : t("commandCenter.noMatches")}
              </CommandEmpty>
            ) : null}

            {showEmptyQuery && recent.length > 0 ? (
              <CommandGroup
                heading={t("commandCenter.recent")}
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted-foreground/80 **:[[cmdk-group-heading]]:uppercase"
              >
                {recent.map((item) => {
                  const Icon =
                    item.kind === "resource" && item.type
                      ? searchTypeIcon(item.type as MerchantSearchHitType)
                      : AppIcons.time;
                  return (
                    <CommandItem
                      key={item.id}
                      value={`recent ${item.label} ${item.id}`}
                      onSelect={() => selectRecent(item)}
                      className="group/command-item gap-2.5 rounded-lg px-2 py-2 data-selected:bg-accent/90"
                    >
                      <IconTile>
                        <Icon />
                      </IconTile>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground/70">
                        {t("commandCenter.recent")}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {showEmptyQuery && recent.length > 0 && actionCommands.length > 0 ? (
              <CommandSeparator className="my-1 bg-border/60" />
            ) : null}

            {actionCommands.length > 0 ? (
              <CommandGroup
                heading={t("commandCenter.actionsHeading")}
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted-foreground/80 **:[[cmdk-group-heading]]:uppercase"
              >
                {actionCommands.map((command) => (
                  <CommandItem
                    key={command.id}
                    value={commandSearchValue(command)}
                    onSelect={() => selectCommand(command)}
                    className="group/command-item gap-2.5 rounded-lg px-2 py-2 data-selected:bg-accent/90"
                  >
                    <IconTile>
                      <command.icon />
                    </IconTile>
                    <span className="text-sm font-medium">{command.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {showRemote ? (
              <>
                {(hasRemote || remoteLoading) && (hasLocal || showEmptyQuery) ? (
                  <CommandSeparator className="my-1 bg-border/60" />
                ) : null}

                {TYPE_ORDER.map((type) => {
                  const hits = remoteByType[type];
                  if (!hits?.length) return null;
                  const Icon = searchTypeIcon(type);
                  return (
                    <CommandGroup
                      key={type}
                      heading={groupLabelForSearchType(type, t)}
                      className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted-foreground/80 **:[[cmdk-group-heading]]:uppercase"
                    >
                      {hits.map((hit) => (
                        <CommandItem
                          key={`${hit.type}:${hit.id}`}
                          value={`${hit.type} ${hit.label} ${hit.description ?? ""} ${hit.id}`}
                          onSelect={() => selectHit(hit)}
                          className="group/command-item gap-2.5 rounded-lg px-2 py-2 data-selected:bg-accent/90"
                        >
                          <IconTile>
                            <Icon />
                          </IconTile>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium leading-tight">
                              {hit.label}
                            </span>
                            {hit.description ? (
                              <span className="truncate text-xs text-muted-foreground">
                                {hit.description}
                              </span>
                            ) : null}
                          </div>
                          {hit.status ? (
                            <Badge
                              variant="secondary"
                              className="max-w-24 shrink-0 truncate rounded-md px-1.5 py-0 text-[10px] font-medium capitalize"
                            >
                              {hit.status}
                            </Badge>
                          ) : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}

                {remoteLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                    <AppIcons.loader className="size-3.5 animate-spin opacity-70" />
                    <span>
                      {hasRemote ? t("commandCenter.loadingMore") : t("commandCenter.searchingShop")}
                    </span>
                  </div>
                ) : null}
              </>
            ) : null}

            {navCommands.length > 0 ? (
              <>
                {(hasRemote || actionCommands.length > 0 || recent.length > 0) &&
                !showEmptyQuery ? (
                  <CommandSeparator className="my-1 bg-border/60" />
                ) : showEmptyQuery && actionCommands.length > 0 ? (
                  <CommandSeparator className="my-1 bg-border/60" />
                ) : null}
                <CommandGroup
                  heading={t("commandCenter.navigationHeading")}
                  className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted-foreground/80 **:[[cmdk-group-heading]]:uppercase"
                >
                  {navCommands.map((command) => (
                    <CommandItem
                      key={command.id}
                      value={commandSearchValue(command)}
                      onSelect={() => selectCommand(command)}
                      className="group/command-item gap-2.5 rounded-lg px-2 py-2 data-selected:bg-accent/90"
                    >
                      <IconTile>
                        <command.icon />
                      </IconTile>
                      <span className="text-sm font-medium">{command.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground sm:py-2">
            <span className="flex items-center gap-1.5">
              <span className="sm:hidden">{t("commandCenter.tapToOpen")}</span>
              <span className="hidden items-center gap-1.5 sm:flex">
                <Kbd className="h-5 min-w-5 px-1">↑</Kbd>
                <Kbd className="h-5 min-w-5 px-1">↓</Kbd>
                <span>{t("commandCenter.move")}</span>
                <Kbd className="ml-1 h-5 px-1.5">↵</Kbd>
                <span>{t("commandCenter.open")}</span>
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd className="hidden h-5 px-1.5 sm:inline-flex">esc</Kbd>
              <button
                type="button"
                className="text-foreground/80 underline-offset-2 sm:no-underline sm:hover:underline"
                onClick={() => setOpen(false)}
              >
                {t("commandCenter.close")}
              </button>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
