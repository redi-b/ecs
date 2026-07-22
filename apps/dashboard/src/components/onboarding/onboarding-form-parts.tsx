"use client";

import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";
import { useMemo } from "react";

import { AppIcons } from "@/components/app/icons";
import { MultiSearchableCombobox } from "@/components/app/searchable-combobox";
import { Badge } from "@/components/ui/badge";
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

  const options = useMemo(
    () =>
      BUSINESS_CATEGORY_OPTIONS.map((label) => ({
        value: label,
        label,
        keywords: label,
      })),
    [],
  );

  return (
    <MultiSearchableCombobox
      className="h-11"
      emptyLabel={t("onboarding.categoryEmpty")}
      id={id}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      removeLabel={(label) => t("onboarding.categoryRemove", { value: label })}
      searchPlaceholder={searchPlaceholder}
      selectedCountLabel={(count) => t("onboarding.categorySelectedCount", { count })}
      values={values}
    />
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
