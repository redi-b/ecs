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
import { useSidebar } from "@/components/ui/sidebar";
import { getNavigableAppRoutes } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function CommandCenter() {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
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
          variant="ghost"
          aria-label="Open command center"
          size="icon"
          className={cn(
            "shrink-0 text-muted-foreground",
            // Desktop: full search field; mobile: icon-only matching header controls.
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
                        if (isMobile) setOpenMobile(false);
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
