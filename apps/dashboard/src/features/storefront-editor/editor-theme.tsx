"use client";

import type { Data, PuckAction } from "@puckeditor/core";
import {
  RiCheckLine,
  RiEditLine,
  RiInformationLine,
  RiRefreshLine,
  RiResetLeftLine,
} from "@remixicon/react";
import { useEffect, useState } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { themePalettePageProps, themeResetPageProps } from "./editor-state";
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

  function resetToDefaults() {
    updateStorefrontProps(data, dispatch, themeResetPageProps(mode));
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
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Regenerate palette from brand color"
                className="size-7 text-muted-foreground"
                onClick={() => regenerate()}
                size="icon"
                type="button"
                variant="ghost"
              >
                <RiRefreshLine className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Rebuild colors from brand</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Reset appearance to defaults"
                className="size-7 text-muted-foreground"
                onClick={resetToDefaults}
                size="icon"
                type="button"
                variant="ghost"
              >
                <RiResetLeftLine className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reset to defaults</TooltipContent>
          </Tooltip>
          <SectionInfoTip
            body="Surface and brand color drive a full palette with readable contrast. Accent stays related to your brand. Edit any swatch for full control, or use the header actions to rebuild or restore defaults."
            title="Appearance"
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Automatic palette</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {autoPalette
                ? "Brand and surface keep the set in sync."
                : "Manual colors. Rebuild from brand anytime."}
            </p>
          </div>
          <Switch
            aria-label="Automatic palette"
            checked={autoPalette}
            onCheckedChange={setAutoPalette}
          />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel className="text-sm font-medium">Surface</FieldLabel>
          <div
            className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-lg border bg-muted/40 p-0.5"
            role="tablist"
            aria-label="Surface style"
          >
            {(
              [
                { id: "light" as const, label: "Light" },
                { id: "dark" as const, label: "Dark" },
              ] as const
            ).map((option) => {
              const active = mode === option.id;
              return (
                <button
                  aria-selected={active}
                  className={cn(
                    "h-8 rounded-md text-sm font-medium transition",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  key={option.id}
                  onClick={() => onSurfaceChange(option.id)}
                  role="tab"
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <FieldLabel className="text-sm font-medium">Colors</FieldLabel>
          <div className="grid grid-cols-5 gap-2.5">
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
                  <span className="truncate text-[10px] font-medium text-muted-foreground">
                    {field.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="text-sm font-medium">Typography</div>
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              <FieldLabel className="text-xs font-medium text-muted-foreground">
                Heading
              </FieldLabel>
              <FontSelect
                onChange={(next) => updateStorefrontProp(data, dispatch, "headingFont", next)}
                value={props.headingFont || "Syne"}
              />
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel className="text-xs font-medium text-muted-foreground">Body</FieldLabel>
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

function clampHue(n: number) {
  const v = Math.round(n) % 360;
  return v < 0 ? v + 360 : v;
}

function clampPercent(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseChannelNumber(raw: string): number | null {
  const n = Number(String(raw).replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function ChannelField({
  label,
  suffix,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  suffix?: string;
  value: number;
  min: number;
  max: number;
  onCommit: (next: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit(raw: string) {
    const n = parseChannelNumber(raw);
    if (n == null) {
      setText(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, Math.round(n)));
    setText(String(clamped));
    onCommit(clamped);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex h-9 min-w-0 items-center overflow-hidden rounded-md border bg-background shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
        <Input
          aria-label={label}
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0"
          inputMode="numeric"
          onBlur={() => commit(text)}
          onChange={(event) => setText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit(event.currentTarget.value);
              event.currentTarget.blur();
            }
          }}
          value={text}
        />
        {suffix ? (
          <span className="shrink-0 border-l px-2 font-mono text-[11px] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
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
  const [hexDraft, setHexDraft] = useState(color.toUpperCase());

  const rgb = hexToRgb(color) ?? { r: 0, g: 0, b: 0 };
  const hsl = hexToHsl(color) ?? { h: 0, s: 0, l: 0 };

  function applyRgb(next: Partial<{ r: number; g: number; b: number }>) {
    onChange(
      rgbToHex(
        clampByte(next.r ?? rgb.r),
        clampByte(next.g ?? rgb.g),
        clampByte(next.b ?? rgb.b),
      ),
    );
  }

  function applyHsl(next: Partial<{ h: number; s: number; l: number }>) {
    onChange(
      hslToHex(
        clampHue(next.h ?? hsl.h),
        clampPercent(next.s ?? hsl.s),
        clampPercent(next.l ?? hsl.l),
      ),
    );
  }

  function commitHex(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setHexDraft(color.toUpperCase());
      return;
    }
    const next = normalizeHex(trimmed.startsWith("#") ? trimmed : `#${trimmed}`, color);
    if (isHexColor(next)) {
      onChange(next);
      setHexDraft(next.toUpperCase());
    } else {
      setHexDraft(color.toUpperCase());
    }
  }

  const formatModes: Array<{ id: ColorFormat; label: string }> = [
    { id: "hex", label: "HEX" },
    { id: "rgb", label: "RGB" },
    { id: "hsl", label: "HSL" },
  ];

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setHexDraft(color.toUpperCase());
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
      <PopoverContent align="start" className="w-[17.5rem] p-3" side="bottom" sideOffset={8}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">{label}</div>
            <div
              className="grid grid-cols-3 overflow-hidden rounded-lg border bg-muted/40 p-0.5"
              role="tablist"
              aria-label="Color format"
            >
              {formatModes.map((mode) => {
                const active = format === mode.id;
                return (
                  <button
                    aria-selected={active}
                    className={cn(
                      "h-7 rounded-md text-[11px] font-semibold tracking-wide transition",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    key={mode.id}
                    onClick={() => setFormat(mode.id)}
                    role="tab"
                    type="button"
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <HexColorPicker
            className="!h-36 !w-full"
            color={color}
            onChange={(next) => {
              onChange(next);
              setHexDraft(normalizeHex(next).toUpperCase());
            }}
          />

          {format === "hex" ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Hex
              </span>
              <div className="flex h-9 items-center overflow-hidden rounded-md border bg-background shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
                <span className="shrink-0 border-r px-2.5 font-mono text-xs text-muted-foreground">
                  #
                </span>
                <Input
                  aria-label={`${label} hex`}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 font-mono text-xs uppercase shadow-none focus-visible:ring-0"
                  onBlur={() => commitHex(hexDraft)}
                  onChange={(event) => setHexDraft(event.currentTarget.value.replace(/^#/, ""))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitHex(event.currentTarget.value);
                      event.currentTarget.blur();
                    }
                  }}
                  value={hexDraft.replace(/^#/, "")}
                />
              </div>
            </div>
          ) : null}

          {format === "rgb" ? (
            <div className="grid grid-cols-3 gap-2">
              <ChannelField
                label="R"
                max={255}
                min={0}
                onCommit={(r) => applyRgb({ r })}
                value={rgb.r}
              />
              <ChannelField
                label="G"
                max={255}
                min={0}
                onCommit={(g) => applyRgb({ g })}
                value={rgb.g}
              />
              <ChannelField
                label="B"
                max={255}
                min={0}
                onCommit={(b) => applyRgb({ b })}
                value={rgb.b}
              />
            </div>
          ) : null}

          {format === "hsl" ? (
            <div className="grid grid-cols-3 gap-2">
              <ChannelField
                label="H"
                max={359}
                min={0}
                onCommit={(h) => applyHsl({ h })}
                value={Math.round(hsl.h)}
              />
              <ChannelField
                label="S"
                max={100}
                min={0}
                onCommit={(s) => applyHsl({ s })}
                suffix="%"
                value={Math.round(hsl.s)}
              />
              <ChannelField
                label="L"
                max={100}
                min={0}
                onCommit={(l) => applyHsl({ l })}
                suffix="%"
                value={Math.round(hsl.l)}
              />
            </div>
          ) : null}
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
