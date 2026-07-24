"use client";

import type { Data, PuckAction } from "@puckeditor/core";
import {
  RiInformationLine,
  RiMore2Line,
  RiRefreshLine,
  RiResetLeftLine,
} from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";

import { SearchableCombobox } from "@/components/app/searchable-combobox";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

import { ensureStorefrontFontOptionsLoaded, FONT_OPTIONS } from "./editor-config";
import type { StorefrontPageProps } from "./editor-state";
import { themePalettePageProps, themeResetPageProps } from "./editor-state";
import { isHexColor, updateStorefrontProp, updateStorefrontProps } from "./editor-utils";

type ColorFormat = "hex" | "rgb" | "hsl";

type PaletteKey = "primary" | "background" | "foreground" | "muted" | "accent";

const PALETTE_FIELDS: Array<{
  key: PaletteKey;
  prop: keyof StorefrontPageProps;
  labelKey:
    | "editor.theme.colorBrand"
    | "editor.theme.colorBackground"
    | "editor.theme.colorText"
    | "editor.theme.colorMuted"
    | "editor.theme.colorAccent";
}> = [
  { key: "primary", prop: "primaryColor", labelKey: "editor.theme.colorBrand" },
  { key: "background", prop: "backgroundColor", labelKey: "editor.theme.colorBackground" },
  { key: "foreground", prop: "foregroundColor", labelKey: "editor.theme.colorText" },
  { key: "muted", prop: "mutedColor", labelKey: "editor.theme.colorMuted" },
  { key: "accent", prop: "accentColor", labelKey: "editor.theme.colorAccent" },
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
  const { t } = useI18n();
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
    updateStorefrontProps(data, dispatch, {
      autoPalette: prop === "primaryColor" ? autoPalette : false,
      [prop]: next,
    });
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
      <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-muted/10 px-4 py-3">
        <div className="text-sm font-medium tracking-tight">{t("editor.theme.appearance")}</div>
        <div className="flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t("editor.theme.paletteActions")}
                className="size-7 text-muted-foreground"
                size="icon"
                type="button"
                variant="ghost"
              >
                <RiMore2Line className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem
                className="gap-2"
                onSelect={() => {
                  regenerate();
                }}
              >
                <RiRefreshLine className="size-4 opacity-70" aria-hidden />
                {t("editor.theme.rebuildFromBrand")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2"
                onSelect={() => {
                  resetToDefaults();
                }}
              >
                <RiResetLeftLine className="size-4 opacity-70" aria-hidden />
                {t("editor.theme.resetDefaults")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SectionInfoTip
            body={t("editor.theme.appearanceHelp")}
            title={t("editor.theme.appearance")}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">{t("editor.theme.autoPalette")}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {autoPalette
                ? t("editor.theme.autoPaletteOn")
                : t("editor.theme.autoPaletteOff")}
            </p>
          </div>
          <Switch
            aria-label={t("editor.theme.autoPalette")}
            checked={autoPalette}
            onCheckedChange={setAutoPalette}
          />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel className="text-sm font-medium">{t("editor.theme.surface")}</FieldLabel>
          <SegmentedControl
            ariaLabel={t("editor.theme.surface")}
            onChange={onSurfaceChange}
            options={[
              { id: "light", label: t("editor.theme.surfaceLight") },
              { id: "dark", label: t("editor.theme.surfaceDark") },
            ]}
            value={mode}
          />
        </div>

        <div className="flex flex-col gap-3">
          <FieldLabel className="text-sm font-medium">{t("editor.theme.colors")}</FieldLabel>
          <div className="grid grid-cols-5 gap-2.5">
            {PALETTE_FIELDS.map((field) => {
              const value = props[field.prop];
              const hex =
                typeof value === "string" && isHexColor(value) ? value : "#888888";
              const label = t(field.labelKey);
              return (
                <div className="flex min-w-0 flex-col items-center gap-1.5" key={field.key}>
                  <PremiumColorPicker
                    label={label}
                    onChange={(next) => onPaletteColorChange(field.prop, next)}
                    swatchOnly
                    value={hex}
                  />
                  <span className="truncate text-[10px] font-medium text-muted-foreground">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 border-t border-border/80 pt-4">
          <div className="text-sm font-medium">{t("editor.theme.typography")}</div>
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              <FieldLabel className="text-xs font-medium text-muted-foreground">
                {t("editor.theme.heading")}
              </FieldLabel>
              <FontSelect
                onChange={(next) => updateStorefrontProp(data, dispatch, "headingFont", next)}
                value={props.headingFont || "Syne"}
              />
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel className="text-xs font-medium text-muted-foreground">
                {t("editor.theme.body")}
              </FieldLabel>
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
      <PopoverContent
        align="start"
        avoidCollisions
        className="w-80 p-3.5"
        collisionPadding={20}
        side="bottom"
        sideOffset={8}
        sticky="partial"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">{label}</div>
            <SegmentedControl
              ariaLabel="Color format"
              onChange={setFormat}
              options={formatModes.map((mode) => ({
                id: mode.id,
                label: mode.label,
              }))}
              size="sm"
              value={format}
            />
          </div>

          <HexColorPicker
            className="!h-48 !w-full [&_.react-colorful__saturation]:rounded-lg [&_.react-colorful__hue]:mt-2.5 [&_.react-colorful__hue]:h-3 [&_.react-colorful__hue]:rounded-full"
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
  const options = useMemo(
    () =>
      FONT_OPTIONS.map((font) => ({
        value: font,
        label: font,
        keywords: font,
      })),
    [],
  );

  useEffect(() => {
    ensureStorefrontFontOptionsLoaded();
  }, []);

  return (
    <SearchableCombobox
      className="w-full min-w-0 font-normal"
      emptyLabel={t("editor.fonts.empty")}
      onChange={onChange}
      options={options}
      placeholder={t("editor.fonts.choose")}
      renderItem={(item) => (
        <span
          className="min-w-0 flex-1 truncate font-normal"
          style={{ fontFamily: `"${item.value}", ui-sans-serif, system-ui, sans-serif` }}
        >
          {item.label}
        </span>
      )}
      renderValue={(item) =>
        item ? (
          <span
            className="truncate font-normal"
            style={{ fontFamily: `"${item.value}", ui-sans-serif, system-ui, sans-serif` }}
          >
            {item.label}
          </span>
        ) : (
          t("editor.fonts.choose")
        )
      }
      searchPlaceholder={t("editor.fonts.search")}
      triggerIcon="edit"
      value={value}
    />
  );
}
