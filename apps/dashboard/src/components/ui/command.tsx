"use client";

import { Command as CommandPrimitive } from "cmdk";
import { CheckIcon, SearchIcon, XIcon } from "lucide-react";
import type * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn("top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0", className)}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  value,
  onValueChange,
  size = "default",
  ...props
}: Omit<React.ComponentProps<typeof CommandPrimitive.Input>, "size"> & {
  size?: "default" | "lg" | "panel";
}) {
  const stringValue = typeof value === "string" ? value : "";
  const isLg = size === "lg";
  const isPanel = size === "panel";
  const inputClassName = cn(
    "min-w-0 w-full flex-1 text-foreground outline-hidden antialiased caret-foreground",
    "placeholder:truncate placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/65",
    "disabled:cursor-not-allowed disabled:opacity-50",
    isLg || isPanel ? "text-sm leading-normal" : "text-[13px] leading-normal",
    className,
  );

  if (isPanel) {
    const panelInputClassName = cn(
      inputClassName,
      "px-3 border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0",
    );
    return (
      <div data-slot="command-input-wrapper" className="px-1.5 pt-1.5 pb-1.5">
        <InputGroup
          className={cn(
            "h-9! border-input/40 bg-muted/40 shadow-none!",
            "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            "has-[[data-slot=input-group-control]:focus-visible]:border-ring",
            "has-[[data-slot=input-group-control]:focus-visible]:ring-3",
            "has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50",
          )}
        >
          {typeof value === "string" && onValueChange ? (
            <CommandPrimitive.Input
              data-slot="input-group-control"
              className={panelInputClassName}
              onValueChange={onValueChange}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              value={value}
              {...props}
            />
          ) : (
            <CommandPrimitive.Input
              data-slot="input-group-control"
              className={panelInputClassName}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              {...props}
            />
          )}
          {stringValue && onValueChange ? (
            <InputGroupAddon align="inline-end" className="gap-1 pr-1!">
              <button
                aria-label="Clear search"
                className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                onClick={() => onValueChange("")}
                type="button"
              >
                <XIcon className="size-3" />
              </button>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </div>
    );
  }

  return (
    <div
      data-slot="command-input-wrapper"
      className={cn(
        "border-b border-border/60",
        isLg ? "px-3 py-2" : "px-1.5 py-1",
      )}
    >
      <InputGroup
        className={cn(
          "rounded-md! border-0 bg-transparent! shadow-none! dark:bg-transparent!",
          "*:data-[slot=input-group-addon]:pl-0.5!",
          isLg ? "h-9!" : "h-7!",
          "has-[[data-slot=input-group-control]:focus-visible]:border-0",
          "has-[[data-slot=input-group-control]:focus-visible]:ring-0",
        )}
      >
        <InputGroupAddon align="inline-start" className="gap-1 pl-0.5!">
          <SearchIcon
            className={cn(
              "shrink-0 text-muted-foreground",
              isLg ? "size-4" : "size-3.5",
            )}
          />
        </InputGroupAddon>
        {typeof value === "string" && onValueChange ? (
          <CommandPrimitive.Input
            data-slot="command-input"
            className={inputClassName}
            onValueChange={onValueChange}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={value}
            {...props}
          />
        ) : (
          <CommandPrimitive.Input
            data-slot="command-input"
            className={inputClassName}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            {...props}
          />
        )}
        {stringValue && onValueChange ? (
          <InputGroupAddon align="inline-end" className="gap-1 pr-0.5!">
            <button
              aria-label="Clear search"
              className={cn(
                "grid place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isLg ? "size-7" : "size-6",
              )}
              onClick={() => onValueChange("")}
              type="button"
            >
              <XIcon className={isLg ? "size-3.5" : "size-3"} />
            </button>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("px-3 py-6 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-hidden select-none",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "data-selected:bg-accent data-selected:text-accent-foreground",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto size-4 opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-data-selected/command-item:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
