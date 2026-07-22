"use client";

import type { Data, PuckAction } from "@puckeditor/core";
import { RiCheckLine, RiEditLine, RiInformationLine, RiRefreshLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import {
  hexToHsl,
  hexToRgb,
  hslToHex,
  normalizeHex,
  rgbToHex,
} from "@ecs/storefront-templates";

import { FONT_OPTIONS, POPOVER_MOTION_CLASSNAME } from "./editor-config";
import type { StorefrontPageProps } from "./editor-state";
import { themePalettePageProps } from "./editor-state";
import { isHexColor, updateStorefrontProp, updateStorefrontProps } from "./editor-utils";

type ColorFormat = "hex" | "rgb" | "hsl";

type PaletteKey = "primary" | "background" | "foreground" | "muted" | "accent";

const PALETTE_FIELDS: Array<{
  key: PaletteKey;
  prop: keyof StorefrontPageProps;
  label: string;
}> = [
  { key: "primary", prop: "primaryColor", label: "Brand" },
  { key: "background", prop: "backgroundColor", label: "Background" },
  { key: "foreground", prop: "foregroundColor", label: "Text" },
  { key: "muted", prop: "mutedColor", label: "Muted" },
  { key: "accent", prop: "accentColor", label: "Accent" },
];

function SectionInfoTip({ title, body }: { title: string; body: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={title}
          className="size-7 shrink-0 text-muted-foreground"
          size="icon"
          type="button"
          variant="ghost"
        >
          <RiInformationLine className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-1.5 p-3" side="bottom">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
      </PopoverContent>
    </Popover>
  );
}

export function ThemeBrandSection({
  data,
  dispatch,
  props,
}: {
  data: Data;
  dispatch: (action: PuckAction) => void;
  props: StorefrontPageProps;
}) {
  const mode: "light" | "dark" =
    props.surfaceMode === "light" || props.surfaceMode === "dark"
      ? props.surfaceMode
      : "dark";
  const autoPalette = props.autoPalette !== false;
  const primary = isHexColor(props.primaryColor ?? "")
    ? (props.primaryColor as string)
    : "#9bc4a0";

  function regenerate(nextPrimary = primary, nextMode = mode) {
    updateStorefrontProps(data, dispatch, themePalettePageProps(nextPrimary, nextMode));
  }

  function setAutoPalette(enabled: boolean) {
    if (enabled) {
      regenerate(primary, mode);
      return;
    }
    updateStorefrontProp(data, dispatch, "autoPalette", false);
  }

  function onSurfaceChange(nextMode: "light" | "dark") {
    if (autoPalette) {
      regenerate(primary, nextMode);
      return;
    }
    updateStorefrontProp(data, dispatch, "surfaceMode", nextMode);
  }

  function onBrandChange(nextPrimary: string) {
    if (autoPalette) {
      regenerate(nextPrimary, mode);
      return;
    }
    updateStorefrontProp(data, dispatch, "primaryColor", nextPrimary);
  }

  function onPaletteColorChange(prop: keyof StorefrontPageProps, next: string) {
    if (prop === "primaryColor" && autoPalette) {
      regenerate(next, mode);
      return;
    }
    // Manual tweak of a derived swatch exits auto mode so we do not overwrite on next brand change.
    updateStorefrontProps(data, dispatch, {
      autoPalette: prop === "primaryColor" ? autoPalette : false,
      [prop]: next,
    });
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="text-sm font-semibold">Appearance</div>
        <SectionInfoTip
          body="Choose a light or dark surface and a brand color. We generate background, text, muted, and accent with readable contrast. You can edit any color, turn auto palette off, or regenerate anytime."
          title="How appearance works"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-5 p-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-sm font-medium">Auto palette</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {autoPalette
                ? "Brand and surface update the full color set."
                : "Colors are freeform. Regenerate to rebuild from brand."}
            </p>
          </div>
          <Switch
            aria-label="Auto palette"
            checked={autoPalette}
            onCheckedChange={setAutoPalette}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <FieldLabel className="text-sm font-medium">Surface</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "light" as const, label: "Light" },
                { id: "dark" as const, label: "Dark" },
              ] as const
            ).map((option) => {
              const active = mode === option.id;
              return (
                <Button
                  className={cn("h-9", active && "ring-2 ring-primary/40")}
                  key={option.id}
                  onClick={() => onSurfaceChange(option.id)}
                  type="button"
                  variant={active ? "default" : "outline"}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <FieldLabel className="text-sm font-medium">Colors</FieldLabel>
            <Button
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => regenerate()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RiRefreshLine className="size-3.5" aria-hidden />
              Regenerate
            </Button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {PALETTE_FIELDS.map((field) => {
              const value = props[field.prop];
              const hex =
                typeof value === "string" && isHexColor(value) ? value : "#888888";
              return (
                <div className="flex min-w-0 flex-col items-center gap-1.5" key={field.key}>
                  <PremiumColorPicker
                    label={field.label}
                    onChange={(next) => onPaletteColorChange(field.prop, next)}
                    swatchOnly
                    value={hex}
                  />
                  <span className="truncate text-[10px] text-muted-foreground">{field.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tap a swatch to edit. Changing a non-brand color turns auto palette off so your
            tweaks stick.
          </p>
        </div>

        <div className="border-t pt-4">
          <div className="mb-3 text-sm font-semibold">Typography</div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              <FieldLabel className="text-sm font-medium">Heading font</FieldLabel>
              <FontSelect
                onChange={(next) => updateStorefrontProp(data, dispatch, "headingFont", next)}
                value={props.headingFont || "Syne"}
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <FieldLabel className="text-sm font-medium">Body font</FieldLabel>
              <FontSelect
                onChange={(next) => updateStorefrontProp(data, dispatch, "bodyFont", next)}
                value={props.bodyFont || "Outfit"}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function formatRgb(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "0, 0, 0";
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}

function formatHsl(hex: string) {
  const hsl = hexToHsl(hex);
  if (!hsl) return "0, 0%, 0%";
  return `${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`;
}

function parseRgbInput(value: string): string | null {
  const parts = value
    .replace(/rgba?\(/i, "")
    .replace(/\)/g, "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
  return rgbToHex(clampByte(parts[0]!), clampByte(parts[1]!), clampByte(parts[2]!));
}

function parseHslInput(value: string): string | null {
  const parts = value
    .replace(/hsla?\(/i, "")
    .replace(/\)/g, "")
    .replace(/%/g, "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
  return hslToHex(parts[0]!, parts[1]!, parts[2]!);
}

export function PremiumColorPicker({
  label,
  onChange,
  value,
  swatchOnly = false,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
  /** Compact trigger for palette grids */
  swatchOnly?: boolean;
}) {
  const color = isHexColor(value) ? normalizeHex(value) : "#000000";
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [draft, setDraft] = useState("");

  const display = useMemo(() => {
    if (format === "hex") return color.toUpperCase();
    if (format === "rgb") return formatRgb(color);
    return formatHsl(color);
  }, [color, format]);

  function commitDraft(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (format === "hex") {
      const next = normalizeHex(trimmed.startsWith("#") ? trimmed : `#${trimmed}`, color);
      if (isHexColor(next)) onChange(next);
      return;
    }
    if (format === "rgb") {
      const next = parseRgbInput(trimmed);
      if (next) onChange(next);
      return;
    }
    const next = parseHslInput(trimmed);
    if (next) onChange(next);
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setDraft(display);
      }}
    >
      <PopoverTrigger asChild>
        {swatchOnly ? (
          <button
            aria-label={`Edit ${label} color`}
            className="aspect-square w-full rounded-lg border shadow-sm transition hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: color }}
            type="button"
          />
        ) : (
          <Button className="w-full min-w-0 justify-start gap-2" type="button" variant="outline">
            <span
              className="size-4 shrink-0 rounded-full border"
              style={{ backgroundColor: color }}
            />
            <span className="truncate font-mono text-xs uppercase">{color}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className={cn(POPOVER_MOTION_CLASSNAME, "w-72")}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">{label}</div>
            <div className="flex rounded-md border p-0.5">
              {(["hex", "rgb", "hsl"] as const).map((mode) => (
                <button
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase transition",
                    format === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  key={mode}
                  onClick={() => {
                    setFormat(mode);
                    setDraft(
                      mode === "hex"
                        ? color.toUpperCase()
                        : mode === "rgb"
                          ? formatRgb(color)
                          : formatHsl(color),
                    );
                  }}
                  type="button"
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <HexColorPicker className="!w-full" color={color} onChange={onChange} />
          <div className="flex items-center gap-2">
            <span className="size-8 shrink-0 rounded-md border" style={{ backgroundColor: color }} />
            <Input
              aria-label={`${label} ${format} value`}
              className="h-9 min-w-0 flex-1 font-mono text-xs uppercase"
              onBlur={() => commitDraft(draft || display)}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitDraft(event.currentTarget.value);
                  event.currentTarget.blur();
                }
              }}
              value={draft || display}
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {format === "hex"
              ? "Hex like #0F766E"
              : format === "rgb"
                ? "RGB like 15, 118, 110"
                : "HSL like 174, 78%, 25%"}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FontSelect({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const { t } = useI18n();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="w-full min-w-0 justify-between gap-2" type="button" variant="outline">
          <span className="min-w-0 truncate" style={{ fontFamily: value }}>
            {value || t("editor.fonts.choose")}
          </span>
          <RiEditLine className="shrink-0" data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn(POPOVER_MOTION_CLASSNAME, "p-0")}>
        <Command>
          <CommandInput placeholder={t("editor.fonts.search")} />
          <CommandList>
            <CommandEmpty>No font found.</CommandEmpty>
            <CommandGroup>
              {FONT_OPTIONS.map((font) => (
                <CommandItem key={font} onSelect={() => onChange(font)} value={font}>
                  <span className="flex-1" style={{ fontFamily: font }}>
                    {font}
                  </span>
                  {font === value ? <RiCheckLine aria-hidden data-icon="inline-end" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
