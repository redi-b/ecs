"use client";

import { useEffect, useMemo, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

import {
  isVariantOutOfStock,
  optionLabelFromVariantTitle,
  resolveVariantByOptions,
  type ProductCatalogPickVariant,
  type ProductOptionAxis,
} from "./product-catalog-picker-model";

export function ProductOptionConfigurator({
  axes,
  variants,
  onAdd,
  productTitle,
  selectionMode,
}: {
  axes: ProductOptionAxis[];
  variants: ProductCatalogPickVariant[];
  onAdd: (variantId: string) => void;
  productTitle: string;
  selectionMode: "single" | "multiple";
}) {
  const { t } = useI18n();
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [justAdded, setJustAdded] = useState(false);

  // Prefer first available (in-stock) values as defaults when axes exist.
  useEffect(() => {
    if (!axes.length) return;
    setPicks((current) => {
      if (Object.keys(current).length) return current;
      const next: Record<string, string> = {};
      for (const axis of axes) {
        const preferred =
          axis.values.find((value) => {
            const trial = { ...next, [axis.title]: value };
            const match = resolveVariantByOptions(variants, trial);
            return match ? !isVariantOutOfStock(match) : true;
          }) ?? axis.values[0];
        if (preferred) next[axis.title] = preferred;
      }
      return next;
    });
  }, [axes, variants]);

  const resolved = useMemo(() => {
    if (axes.length === 0) return null;
    const complete = axes.every((axis) => Boolean(picks[axis.title]));
    if (!complete) return null;
    return resolveVariantByOptions(variants, picks);
  }, [axes, picks, variants]);

  const resolvedOutOfStock = Boolean(resolved && isVariantOutOfStock(resolved));

  function isValueAvailable(axisTitle: string, value: string) {
    const trial = { ...picks, [axisTitle]: value };
    return variants.some((variant) => {
      if (isVariantOutOfStock(variant)) {
        // Keep the value clickable if this is the only match, but prefer
        // combinations that can resolve to in-stock variants when possible.
      }
      const opts = variant.options ?? {};
      if (Object.keys(opts).length) {
        return Object.entries(trial).every(([k, v]) => !v || opts[k] === v);
      }
      const label = optionLabelFromVariantTitle(variant.title, productTitle);
      const parts = label.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
      const axisIndex = axes.findIndex((a) => a.title === axisTitle);
      if (axisIndex < 0) return true;
      if (parts[axisIndex] !== value && label !== value) return false;
      return axes.every((axis, index) => {
        if (axis.title === axisTitle) return true;
        const picked = trial[axis.title];
        if (!picked) return true;
        return parts[index] === picked || (axes.length === 1 && label === picked);
      });
    });
  }

  function displayAxisTitle(title: string) {
    const normalized = title.trim().toLowerCase();
    if (
      !title ||
      normalized === "option" ||
      normalized === "variant" ||
      normalized === "default" ||
      /^option\s*\d+$/i.test(title)
    ) {
      return t("products.catalogPicker.optionsHeading");
    }
    return title;
  }

  // No structured axes → simple chips of option labels (not full combo SKUs).
  if (axes.length === 0) {
    return (
      <div className="space-y-2.5 border-t bg-muted/10 px-3.5 py-3.5">
        <p className="text-xs font-medium text-muted-foreground">
          {t("products.catalogPicker.pickOptionFor", { product: productTitle })}
        </p>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => {
            const oos = isVariantOutOfStock(variant);
            return (
              <button
                className={cn(
                  "rounded-full border bg-background px-3.5 py-2 text-sm font-medium shadow-sm transition-colors",
                  oos
                    ? "cursor-not-allowed opacity-45"
                    : "hover:border-primary/40 hover:bg-primary/5",
                )}
                disabled={oos}
                key={variant.id}
                onClick={() => {
                  if (oos) return;
                  onAdd(variant.id);
                }}
                type="button"
              >
                {optionLabelFromVariantTitle(variant.title, productTitle)}
                {variant.priceLabel ? (
                  <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">
                    {variant.priceLabel}
                  </span>
                ) : null}
                {oos ? (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    · {t("products.catalogPicker.outOfStock")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 border-t bg-muted/10 px-3.5 py-3.5">
      {axes.map((axis) => (
        <div className="space-y-2" key={axis.title}>
          <p className="text-xs font-semibold text-foreground/80">
            {displayAxisTitle(axis.title)}
          </p>
          <div className="flex flex-wrap gap-2">
            {axis.values.map((value) => {
              const active = picks[axis.title] === value;
              const available = isValueAvailable(axis.title, value);
              return (
                <button
                  className={cn(
                    "min-w-10 rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/80 bg-background shadow-sm hover:border-primary/35 hover:bg-primary/[0.04]",
                    !available && !active && "pointer-events-none opacity-30",
                  )}
                  disabled={!available && !active}
                  key={value}
                  onClick={() => {
                    setJustAdded(false);
                    setPicks((current) => ({
                      ...current,
                      [axis.title]: value,
                    }));
                  }}
                  type="button"
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 rounded-xl border bg-background/80 px-3 py-2.5 shadow-sm">
        <div className="min-w-0 flex-1">
          {resolved ? (
            resolvedOutOfStock ? (
              <p className="text-sm font-semibold text-muted-foreground">
                {t("products.catalogPicker.outOfStock")}
              </p>
            ) : (
              <p className="text-sm font-semibold tabular-nums tracking-tight">
                {resolved.priceLabel ?? t("products.catalogPicker.readyToAdd")}
              </p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("products.catalogPicker.completeOptions")}
            </p>
          )}
          {justAdded ? (
            <p className="mt-0.5 text-xs font-medium text-primary">
              {t("products.catalogPicker.addedHint")}
            </p>
          ) : null}
        </div>
        <Button
          className="shrink-0 rounded-full px-4"
          disabled={!resolved || resolvedOutOfStock}
          onClick={() => {
            if (!resolved || resolvedOutOfStock) return;
            onAdd(resolved.id);
            setJustAdded(true);
          }}
          size="sm"
          type="button"
        >
          {selectionMode === "multiple"
            ? t("products.catalogPicker.addCombination")
            : t("products.catalogPicker.selectCombination")}
        </Button>
      </div>
    </div>
  );
}

export function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background",
      )}
    >
      {selected ? <AppIcons.check className="size-3" /> : null}
    </span>
  );
}

export function ProductPickThumb({
  title,
  url,
}: {
  title: string;
  url?: string | null | undefined;
}) {
  if (url) {
    return (
      // biome-ignore lint/performance/noImgElement: product thumbnail from commerce CDN
      <img
        alt=""
        className="size-12 shrink-0 rounded-full border object-cover shadow-sm"
        src={url}
      />
    );
  }
  const initial = title.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground shadow-sm">
      {initial}
    </span>
  );
}
