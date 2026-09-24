"use client";

import type { StorefrontTemplateCatalogItem } from "@ecs/contracts";
import { useMemo } from "react";

import { AppIcons } from "@/components/app/icons";
import { HelpTip } from "@/components/app/help-tip";
import { MultiSearchableCombobox } from "@/components/app/searchable-combobox";
import { StorefrontTemplatePreview } from "@/components/storefront/storefront-template-preview";
import {
  BUSINESS_CATEGORY_OPTIONS,
  getTemplateTags,
  type HandleState,
} from "@/components/onboarding/onboarding-helpers";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

export function HandleStatus({ message, status }: { message?: string; status: HandleState["status"] }) {
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
      <span className="min-w-0 truncate font-medium text-destructive">
        {message ?? t("onboarding.handle.unavailableShort")}
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
      <div className="flex min-w-0 items-center gap-1.5">
        <p className="text-sm font-medium">{label}</p>
        <HelpTip summary={description} />
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function TemplateOption({
  checked,
  onSelect,
  recommended = false,
  template,
}: {
  checked: boolean;
  onSelect: () => void;
  recommended?: boolean;
  template: StorefrontTemplateCatalogItem;
}) {
  const { t } = useI18n();
  const tags = getTemplateTags(template);

  return (
    <div
      className={cn(
        "flex w-full gap-5 rounded-xl border p-4 text-left transition-colors outline-none sm:p-5",
        checked
          ? "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/25"
          : "border-border bg-background hover:border-ring/40 hover:bg-muted/20",
      )}
    >
      <div className="w-[7.75rem] shrink-0 sm:w-40">
        <StorefrontTemplatePreview
          compact
          demoLabel={t("common.viewDemo")}
          previewLabel={t("common.preview")}
          template={template}
        />
      </div>
      <button
        className="flex min-w-0 flex-1 flex-col justify-center gap-1 rounded-lg py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        onClick={onSelect}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold tracking-tight">{template.name}</p>
              {recommended ? (
                <Badge className="font-normal" variant="secondary">
                  {t("onboarding.recommended")}
                </Badge>
              ) : null}
            </div>
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
      </button>
    </div>
  );
}
