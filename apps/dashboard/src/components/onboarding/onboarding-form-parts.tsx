"use client";

import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";
import { useMemo, useState } from "react";

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
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  BUSINESS_CATEGORY_OPTIONS,
  getTemplateTags,
  type HandleState,
} from "@/components/onboarding/onboarding-helpers";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function CategoryCombobox({
  id,
  onChange,
  placeholder,
  searchPlaceholder,
  values,
}: {
  id: string;
  onChange: (values: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  values: string[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => new Set(values.map((value) => value.trim()).filter(Boolean)),
    [values],
  );

  // Preset list only — free-text custom categories are disabled for now.
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUSINESS_CATEGORY_OPTIONS.filter(
      (option) => !q || option.toLowerCase().includes(q),
    );
  }, [query]);

  function toggle(option: string) {
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    onChange([...next]);
  }

  function remove(option: string) {
    onChange(values.filter((value) => value !== option));
  }

  const triggerLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? values[0]
        : t("onboarding.categorySelectedCount", { count: values.length });

  return (
    <div className="space-y-2">
      <Popover
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        open={open}
      >
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            className={cn(
              "h-11 w-full justify-between rounded-xl px-3 font-normal shadow-none",
              values.length === 0 && "text-muted-foreground",
            )}
            id={id}
            role="combobox"
            type="button"
            variant="outline"
          >
            <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
            <AppIcons.arrowDown className="size-4 shrink-0 opacity-60" data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
          collisionPadding={16}
          onWheel={(event) => event.stopPropagation()}
        >
          <Command className="h-auto max-h-72 w-full min-h-0" shouldFilter={false}>
            <CommandInput
              autoFocus
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
              value={query}
            />
            <CommandList
              className="max-h-60 min-h-0 overflow-y-auto overscroll-contain"
              onWheel={(event) => event.stopPropagation()}
            >
              <CommandEmpty>
                <span className="block py-6 text-center text-sm text-muted-foreground">
                  {t("onboarding.categoryEmpty")}
                </span>
              </CommandEmpty>
              <CommandGroup className="overflow-visible">
                {options.map((option) => {
                  const isSelected = selected.has(option);
                  return (
                    <CommandItem
                      data-checked={isSelected ? true : undefined}
                      key={option}
                      onSelect={() => toggle(option)}
                      value={option}
                    >
                      <span className="truncate">{option}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Badge
              className="max-w-full gap-1 rounded-md px-1.5 py-0.5 font-normal"
              key={value}
              variant="secondary"
            >
              <span className="truncate">{value}</span>
              <button
                aria-label={t("onboarding.categoryRemove", { value })}
                className="rounded-sm opacity-60 hover:opacity-100"
                onClick={() => remove(value)}
                type="button"
              >
                <AppIcons.close className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function parseCategories(value: string | undefined) {
  if (!value?.trim()) return [] as string[];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Keep backend as a single string field (max ~80 in contracts). */
function serializeCategories(values: string[]) {
  const joined = values.map((value) => value.trim()).filter(Boolean).join(", ");
  return joined.slice(0, 80);
}

export function HandleStatus({ status }: { status: HandleState["status"] }) {
  const { t } = useI18n();
  if (status === "checking") {
    return (
      <span className="shrink-0 text-muted-foreground">{t("onboarding.handle.checkingShort")}</span>
    );
  }
  if (status === "available") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
        <AppIcons.check className="size-3.5" />
        {t("onboarding.handle.availableShort")}
      </span>
    );
  }
  if (status === "unavailable") {
    return (
      <span className="shrink-0 font-medium text-destructive">
        {t("onboarding.handle.unavailableShort")}
      </span>
    );
  }
  return <span className="shrink-0 text-muted-foreground">{t("common.preview")}</span>;
}

export function ReviewItem({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-pretty">{value}</dd>
    </div>
  );
}

export function PreferenceToggle({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function TemplateOption({
  checked,
  onSelect,
  template,
}: {
  checked: boolean;
  onSelect: () => void;
  template: StorefrontTemplateCatalogItem;
}) {
  const tags = getTemplateTags(template);

  return (
    <button
      className={cn(
        "flex w-full gap-5 rounded-xl border p-4 text-left transition-colors outline-none sm:p-5",
        "focus-visible:ring-2 focus-visible:ring-ring/40",
        checked
          ? "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/25"
          : "border-border bg-background hover:border-ring/40 hover:bg-muted/20",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="w-[7.75rem] shrink-0 sm:w-40">
        <StorefrontPreview compact template={template} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">{template.name}</p>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-[0.8125rem]">
              {template.description}
            </p>
          </div>
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
              checked
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background",
            )}
          >
            {checked ? <AppIcons.check className="size-3.5" /> : null}
          </span>
        </div>
        {tags.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge className="font-normal" key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export function StorefrontPreview({
  compact,
  template,
}: {
  compact?: boolean;
  template: StorefrontTemplateCatalogItem | null;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-muted/40",
        compact ? "aspect-[4/3]" : "aspect-[16/10]",
      )}
    >
      <div className="absolute inset-x-2.5 top-2.5 flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-foreground/12" />
        <span className="size-1.5 rounded-full bg-foreground/12" />
        <span className="size-1.5 rounded-full bg-foreground/12" />
        <span className="ml-1 h-1.5 flex-1 rounded-full bg-foreground/8" />
      </div>
      <div className="absolute inset-x-2.5 bottom-2.5 top-8 grid grid-cols-[1.2fr_0.8fr] gap-1.5">
        <div className="flex flex-col justify-end rounded-md bg-background/95 p-2.5 shadow-sm">
          <span className="block h-1.5 w-12 rounded-full bg-foreground/20" />
          <span className="mt-1.5 block h-1.5 w-16 rounded-full bg-muted-foreground/15" />
          <span className="mt-2.5 block h-4 w-12 rounded-md bg-primary/70" />
        </div>
        <div className="grid gap-1.5">
          <span className="rounded-md bg-background/70" />
          <span className="rounded-md bg-background/50" />
        </div>
      </div>
      {!compact ? (
        <span className="absolute left-2.5 top-8 rounded-md bg-background/95 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {template?.slug ?? "storefront"}
        </span>
      ) : null}
    </div>
  );
}
