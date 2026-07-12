"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
import { getNavigableAppRoutes } from "@/lib/navigation";

export function CommandCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Open command center"
          className="h-9 min-w-0 justify-start gap-2 rounded-lg px-3 text-muted-foreground sm:min-w-64"
        >
          <AppIcons.search data-icon="inline-start" />
          <span className="hidden sm:inline">Search or jump…</span>
          <KbdGroup className="ml-auto hidden shrink-0 sm:inline-flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Command center</DialogTitle>
        <DialogDescription className="sr-only">
          Search dashboard navigation and jump to a page.
        </DialogDescription>
        <Command>
          <CommandInput placeholder="Search pages..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {getNavigableAppRoutes()
                .filter((route) => !route.disabled)
                .map((route) => {
                  const Icon = route.icon;

                  return (
                    <CommandItem
                      key={route.id}
                      value={[route.title, ...route.keywords].join(" ")}
                      onSelect={() => {
                        router.push(route.href);
                        setOpen(false);
                      }}
                    >
                      <Icon />
                      <span>{route.title}</span>
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
