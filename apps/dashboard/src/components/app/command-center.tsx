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
import { appRoutes } from "@/lib/navigation";

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
          className="justify-start text-muted-foreground"
        >
          <AppIcons.search data-icon="inline-start" />
          <span className="hidden sm:inline">Search or jump...</span>
          <kbd className="ml-2 hidden rounded-md border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline">
            Cmd K
          </kbd>
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
              {appRoutes
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
