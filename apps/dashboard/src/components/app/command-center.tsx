"use client";

import type { MerchantSearchHit, MerchantSearchHitType } from "@ecs/contracts";
import { useRouter } from "nextjs-toploader/app";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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
import { cn } from "@/lib/utils";

const REMOTE_MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

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

export function CommandCenter() {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteHits, setRemoteHits] = useState<MerchantSearchHit[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentCommandItem[]>([]);

  const tenantId =
    typeof window !== "undefined"
      ? getSelectedTenantId({
          tenantId: new URLSearchParams(window.location.search).get("tenantId") ?? undefined,
        }) ??
        // Fallback: shop host has no tenantId in URL; use hostname as recent key.
        window.location.hostname
      : "default";

  const staticCommands = useMemo(() => getAllStaticCommands(), []);
  const filteredCommands = useMemo(
    () => filterStaticCommands(query, staticCommands),
    [query, staticCommands],
  );
  const actionCommands = filteredCommands.filter((c) => c.group === "action");
  const navCommands = filteredCommands.filter((c) => c.group === "navigation");

  const remoteByType = useMemo(() => {
    const map = new Map<MerchantSearchHitType, MerchantSearchHit[]>();
    for (const hit of remoteHits) {
      const list = map.get(hit.type) ?? [];
      list.push(hit);
      map.set(hit.type, list);
    }
    return map;
  }, [remoteHits]);

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
      setRemoteHits([]);
      setRemoteError(null);
      setRemoteLoading(false);
      return;
    }
    setRecent(loadRecentCommands(tenantId));
  }, [open, tenantId]);

  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < REMOTE_MIN_CHARS) {
      setRemoteHits([]);
      setRemoteError(null);
      setRemoteLoading(false);
      return;
    }

    const controller = new AbortController();
    setRemoteLoading(true);
    setRemoteError(null);

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, limit: "6" });
        // Prefer core types first; include more when useful
        params.set("types", "product,order,customer,media,category,collection,promotion");
        if (tenantId && tenantId.includes("-")) {
          // UUID-like selected tenant from query
          params.set("tenantId", tenantId);
        }
        const response = await fetch(`/admin/search?${params}`, {
          headers: { accept: "application/json" },
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as {
          results?: MerchantSearchHit[];
          error?: string;
        };
        if (!response.ok) {
          setRemoteError(data.error ?? "Search failed");
          setRemoteHits([]);
          return;
        }
        setRemoteHits(Array.isArray(data.results) ? data.results : []);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setRemoteError("Search failed");
        setRemoteHits([]);
      } finally {
        setRemoteLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query, tenantId]);

  const go = useCallback(
    (href: string, recentItem?: Omit<RecentCommandItem, "at">) => {
      if (recentItem) {
        setRecent(pushRecentCommand(tenantId, recentItem));
      }
      router.push(href);
      setOpen(false);
      if (isMobile) setOpenMobile(false);
    },
    [isMobile, router, setOpenMobile, tenantId],
  );

  function selectCommand(command: CommandDef) {
    go(command.href, {
      id: command.id,
      kind: "command",
      label: command.label,
      href: command.href,
    });
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
  const hasRemote = remoteHits.length > 0;
  const typeOrder: MerchantSearchHitType[] = [
    "product",
    "order",
    "customer",
    "media",
    "category",
    "collection",
    "promotion",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="Open command center"
          size="icon"
          className={cn(
            "shrink-0 text-muted-foreground",
            "sm:h-9 sm:w-auto sm:min-w-56 sm:justify-start sm:gap-2 sm:rounded-lg sm:border sm:border-input sm:bg-background sm:px-3 sm:hover:bg-accent sm:hover:text-accent-foreground",
          )}
        >
          <AppIcons.search className="size-4" />
          <span className="hidden sm:inline">Search or jump…</span>
          <KbdGroup className="ml-auto hidden shrink-0 sm:inline-flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">Command center</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, products, orders, customers, and run common actions.
        </DialogDescription>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search pages, products, orders…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!hasLocal && !hasRemote && !remoteLoading && !showEmptyQuery ? (
              <CommandEmpty>
                {remoteError ? remoteError : "No results found."}
              </CommandEmpty>
            ) : null}

            {showEmptyQuery && recent.length > 0 ? (
              <CommandGroup heading="Recent">
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
                    >
                      <Icon />
                      <span className="truncate">{item.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {actionCommands.length > 0 ? (
              <CommandGroup heading="Actions">
                {actionCommands.map((command) => (
                  <CommandItem
                    key={command.id}
                    value={commandSearchValue(command)}
                    onSelect={() => selectCommand(command)}
                  >
                    <command.icon />
                    <span>{command.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {showRemote ? (
              remoteLoading && !hasRemote ? (
                <CommandGroup heading="Searching">
                  <CommandItem disabled value="loading">
                    <AppIcons.loader className="animate-spin" />
                    <span>Searching…</span>
                  </CommandItem>
                </CommandGroup>
              ) : (
                typeOrder.map((type) => {
                  const hits = remoteByType.get(type);
                  if (!hits?.length) return null;
                  const Icon = searchTypeIcon(type);
                  return (
                    <CommandGroup heading={groupLabelForSearchType(type)} key={type}>
                      {hits.map((hit) => (
                        <CommandItem
                          key={`${hit.type}:${hit.id}`}
                          value={`${hit.type} ${hit.label} ${hit.description ?? ""} ${hit.id}`}
                          onSelect={() => selectHit(hit)}
                        >
                          <Icon />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">{hit.label}</span>
                            {hit.description ? (
                              <span className="truncate text-xs text-muted-foreground">
                                {hit.description}
                              </span>
                            ) : null}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })
              )
            ) : null}

            {navCommands.length > 0 ? (
              <CommandGroup heading="Navigation">
                {navCommands.map((command) => (
                  <CommandItem
                    key={command.id}
                    value={commandSearchValue(command)}
                    onSelect={() => selectCommand(command)}
                  >
                    <command.icon />
                    <span>{command.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
