"use client";

import type { SuperadminTenant } from "@ecs/contracts";
import { useQuery } from "@tanstack/react-query";
import { Building2, type LucideIcon, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";

type CommandDestination = { href: string; icon: LucideIcon; label: string; shortcut: string };

export function OperatorCommand({ destinations }: { destinations: readonly CommandDestination[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sequenceStartedAt = useRef(0);
  const normalizedQuery = query.trim();
  const deferredQuery = useDeferredValue(normalizedQuery);
  const merchantQuery = useQuery({
    enabled: open && deferredQuery.length > 0,
    queryKey: ["operations", "merchant-command", deferredQuery],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/tenants?q=${encodeURIComponent(deferredQuery)}`, {
        signal,
      });
      if (!response.ok) throw new Error("merchant_search_unavailable");
      const body = (await response.json()) as { tenants?: SuperadminTenant[] };
      return body.tenants ?? [];
    },
  });
  const merchants = merchantQuery.data ?? [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toUpperCase();
      if (key === "G") {
        sequenceStartedAt.current = Date.now();
        return;
      }
      if (Date.now() - sequenceStartedAt.current > 900) return;
      const destination = destinations.find((item) => item.shortcut === key);
      sequenceStartedAt.current = 0;
      if (destination) {
        event.preventDefault();
        setOpen(false);
        router.push(destination.href);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [destinations, router]);

  function selectMerchant(tenantId: string) {
    setOpen(false);
    router.push(`/tenants/${encodeURIComponent(tenantId)}`);
  }

  return (
    <>
      <Button
        className="size-10 justify-center text-muted-foreground sm:w-64 sm:justify-start md:h-9"
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <Search aria-hidden data-icon="inline-start" />
        <span className="hidden flex-1 text-left font-normal sm:inline">Find a merchant…</span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>⌘/Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
        <span className="sr-only sm:hidden">Find a merchant</span>
      </Button>
      <CommandDialog
        className="sm:max-w-xl"
        description="Search merchants by name or handle and open their operations workspace."
        onOpenChange={setOpen}
        open={open}
        title="Find a merchant"
      >
        <Command shouldFilter={false}>
          <output aria-atomic="true" aria-live="polite" className="sr-only">
            {getSearchStatus(normalizedQuery, merchantQuery.status, merchants.length)}
          </output>
          <CommandInput
            onValueChange={setQuery}
            placeholder="Search merchant name or handle…"
            value={query}
          />
          <CommandList>
            {!normalizedQuery ? (
              <CommandGroup heading="Go to">
                {destinations.map((destination) => {
                  const Icon = destination.icon;
                  return (
                    <CommandItem
                      key={destination.href}
                      onSelect={() => {
                        setOpen(false);
                        router.push(destination.href);
                      }}
                      value={destination.label}
                    >
                      <span className="grid size-8 place-items-center rounded-lg bg-muted">
                        <Icon aria-hidden />
                      </span>
                      <span>{destination.label}</span>
                      <CommandShortcut>G then {destination.shortcut}</CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
            {merchantQuery.isFetching || normalizedQuery !== deferredQuery ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Spinner /> Searching…
              </div>
            ) : null}
            {merchantQuery.isError ? (
              <CommandEmpty>Merchant search is temporarily unavailable.</CommandEmpty>
            ) : null}
            {normalizedQuery && merchantQuery.isSuccess && merchants.length === 0 ? (
              <CommandEmpty>No matching merchants.</CommandEmpty>
            ) : null}
            {merchants.length ? (
              <CommandGroup heading="Merchants">
                {merchants.map((merchant) => (
                  <CommandItem
                    key={merchant.id}
                    onSelect={() => selectMerchant(merchant.id)}
                    value={merchant.id}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-muted">
                      <Building2 aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{merchant.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        @{merchant.handle}
                      </span>
                    </span>
                    <CommandShortcut>{formatStatus(merchant.status)}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, select"))
  );
}

function formatStatus(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function getSearchStatus(query: string, status: "error" | "pending" | "success", count: number) {
  if (!query) return "Quick navigation is available. Enter a merchant name or handle to search.";
  if (status === "pending") return "Searching merchants.";
  if (status === "error") return "Merchant search is temporarily unavailable.";
  if (status === "success") {
    return count === 0
      ? "No matching merchants."
      : `${count} matching ${count === 1 ? "merchant" : "merchants"}.`;
  }
  return "Enter a merchant name or handle.";
}
