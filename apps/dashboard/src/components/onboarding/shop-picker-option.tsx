"use client";

import { useFormStatus } from "react-dom";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";

export function ShopPickerOption({
  current,
  currentLabel,
  domain,
  initial,
  name,
  openLabel,
  openingLabel,
  role,
}: {
  current: boolean;
  currentLabel: string;
  domain: string;
  initial: string;
  name: string;
  openLabel: string;
  openingLabel: string;
  role: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-label={pending ? openingLabel : openLabel}
      className="group flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-wait sm:px-5"
      disabled={pending}
      type="submit"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{name}</span>
          {current ? <Badge variant="secondary">{currentLabel}</Badge> : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{domain}</span>
        <span className="mt-1.5 block text-xs capitalize text-muted-foreground">{role}</span>
      </span>
      {pending ? (
        <AppIcons.loader className="size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <AppIcons.arrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
      )}
    </button>
  );
}
