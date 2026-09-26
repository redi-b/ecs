"use client";

import {
  hexToHsl,
  hexToRgb,
  hslToHex,
  normalizeHex,
  rgbToHex,
  type StorefrontEditorColorRole,
} from "@ecs/storefront-templates";
import { RiArrowDownSLine, RiArrowLeftSLine, RiInformationLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

import type { EditorAction, EditorData, StorefrontPageProps } from "./editor-state";
import { themePalettePageProps, themeResetPageProps } from "./editor-state";
import { isHexColor, updateStorefrontProps } from "./editor-utils";

type ColorFormat = "hex" | "rgb" | "hsl";

const COMMON_COLOR_PRESETS = [
  { label: "Black", value: "#111111" },
  { label: "White", value: "#ffffff" },
  { label: "Gray", value: "#6b7280" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Yellow", value: "#eab308" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#9333ea" },
  { label: "Pink", value: "#db2777" },
] as const;

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
  allowDarkMode: _allowDarkMode = true,
  data,
  dispatch,
  editableColors: _editableColors,
  onOpenChange,
  open = true,
  props,
  templateKey,
}: {
  allowDarkMode?: boolean;
  data: EditorData;
  dispatch: (action: EditorAction) => void;
  editableColors?: StorefrontEditorColorRole[] | undefined;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  props: StorefrontPageProps;
  templateKey: string;
}) {
  const { t } = useI18n();
  const mode: "light" | "dark" =
    props.surfaceMode === "light" || props.surfaceMode === "dark" ? props.surfaceMode : "dark";
  const primary = isHexColor(props.primaryColor ?? "") ? (props.primaryColor as string) : "#9bc4a0";
  const resetPrimary = themeResetPageProps(templateKey).primaryColor;

  function onBrandColorChange(next: string) {
    updateStorefrontProps(data, dispatch, themePalettePageProps(next, mode, templateKey));
  }

  return (
    <Collapsible {...(onOpenChange ? { onOpenChange } : {})} open={open}>
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
        <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-muted/10 px-4 py-3">
          <div className="text-sm font-medium tracking-tight">{t("editor.theme.appearance")}</div>
          <div className="flex items-center gap-0.5">
            <SectionInfoTip
              body={t("editor.theme.appearanceHelp")}
              title={t("editor.theme.appearance")}
            />
            <CollapsibleTrigger asChild>
              <Button
                aria-label={`${open ? "Collapse" : "Expand"} ${t("editor.theme.appearance")}`}
                className="size-7 text-muted-foreground"
                size="icon"
                type="button"
                variant="ghost"
              >
                <RiArrowDownSLine
                  aria-hidden
                  className={cn("size-4 transition-transform", open && "rotate-180")}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="flex min-w-0 items-center gap-3 p-4">
            <ColorPickerField
              defaultColor={
                typeof resetPrimary === "string" && isHexColor(resetPrimary)
                  ? resetPrimary
                  : undefined
              }
              label={t("editor.theme.colorBrand")}
              onChange={onBrandColorChange}
              swatchOnly
              value={primary}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <FieldLabel className="text-sm font-medium">
                  {t("editor.theme.colorBrand")}
                </FieldLabel>
                <span className="font-mono text-[11px] uppercase text-muted-foreground">
                  {primary}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {t("editor.theme.appearanceHelp")}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
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

export function ColorPickerField({
  defaultColor,
  label,
  onChange,
  onCommit,
  value,
  swatchOnly = false,
}: {
  /** Template default for this field — shown as a labeled restore option */
  defaultColor?: string | undefined;
  label: string;
  onChange: (value: string) => void;
  onCommit?: ((value: string) => void) | undefined;
  value: string;
  /** Compact trigger for palette grids */
  swatchOnly?: boolean;
}) {
  const normalizedValue = isHexColor(value) ? normalizeHex(value) : "#000000";
  const [color, setColor] = useState(normalizedValue);
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [hexDraft, setHexDraft] = useState(color.toUpperCase());
  const [showCustom, setShowCustom] = useState(false);
  const interactingRef = useRef(false);
  const colorRef = useRef(color);
  const { t } = useI18n();

  useEffect(() => {
    if (interactingRef.current) return;
    colorRef.current = normalizedValue;
    setColor(normalizedValue);
    setHexDraft(normalizedValue.toUpperCase());
  }, [normalizedValue]);

  function updateColor(next: string, commit = false) {
    const normalized = normalizeHex(next, color).toLowerCase();
    colorRef.current = normalized;
    setColor(normalized);
    setHexDraft(normalized.toUpperCase());
    onChange(normalized);
    if (commit) onCommit?.(normalized);
  }

  const rgb = hexToRgb(color) ?? { r: 0, g: 0, b: 0 };
  const hsl = hexToHsl(color) ?? { h: 0, s: 0, l: 0 };

  function applyRgb(next: Partial<{ r: number; g: number; b: number }>) {
    updateColor(
      rgbToHex(clampByte(next.r ?? rgb.r), clampByte(next.g ?? rgb.g), clampByte(next.b ?? rgb.b)),
      true,
    );
  }

  function applyHsl(next: Partial<{ h: number; s: number; l: number }>) {
    updateColor(
      hslToHex(
        clampHue(next.h ?? hsl.h),
        clampPercent(next.s ?? hsl.s),
        clampPercent(next.l ?? hsl.l),
      ),
      true,
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
      updateColor(next, true);
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
        if (open) {
          setHexDraft(color.toUpperCase());
          setShowCustom(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        {swatchOnly ? (
          <button
            aria-label={`Edit ${label} color`}
            className="aspect-square w-full max-w-14 rounded-lg border shadow-sm transition hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        className="max-h-[var(--radix-popover-content-available-height)] w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
        collisionPadding={20}
        side="bottom"
        sideOffset={8}
        sticky="partial"
      >
        <div className="flex max-h-[var(--radix-popover-content-available-height)] min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
            <div className="min-w-0 truncate text-sm font-medium">{label}</div>
            {showCustom ? (
              <Button
                className="shrink-0"
                onClick={() => setShowCustom(false)}
                size="sm"
                type="button"
                variant="outline"
              >
                <RiArrowLeftSLine aria-hidden />
                {t("common.back")}
              </Button>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-3.5">
            {showCustom ? (
              <>
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

                <HexColorPicker
                  className="!h-48 !w-full [&_.react-colorful__saturation]:rounded-lg [&_.react-colorful__hue]:mt-2.5 [&_.react-colorful__hue]:h-3 [&_.react-colorful__hue]:rounded-full"
                  color={color}
                  onChange={(next) => updateColor(next)}
                  onPointerDown={() => {
                    interactingRef.current = true;
                  }}
                  onPointerUp={() => {
                    interactingRef.current = false;
                    onCommit?.(colorRef.current);
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
                        onChange={(event) =>
                          setHexDraft(event.currentTarget.value.replace(/^#/, ""))
                        }
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
              </>
            ) : (
              <>
                <fieldset
                  aria-label={t("editor.theme.colors")}
                  className="grid grid-cols-10 gap-1.5"
                >
                  {COMMON_COLOR_PRESETS.map((preset) => (
                    <button
                      aria-label={preset.label}
                      className={cn(
                        "aspect-square rounded-full border shadow-xs transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        color === preset.value && "ring-2 ring-ring ring-offset-2",
                      )}
                      key={preset.value}
                      onClick={() => updateColor(preset.value, true)}
                      style={{ backgroundColor: preset.value }}
                      title={preset.label}
                      type="button"
                    />
                  ))}
                </fieldset>

                {defaultColor && isHexColor(defaultColor) ? (
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs text-muted-foreground shadow-xs transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      color === normalizeHex(defaultColor) && "border-ring ring-1 ring-ring/40",
                    )}
                    onClick={() => updateColor(defaultColor, true)}
                    type="button"
                  >
                    <span
                      className="size-4 shrink-0 rounded-full border"
                      style={{ backgroundColor: defaultColor }}
                    />
                    {t("editor.theme.defaultColor")}
                  </button>
                ) : null}

                <Button
                  className="w-full"
                  onClick={() => setShowCustom(true)}
                  type="button"
                  variant="outline"
                >
                  {t("editor.theme.customColor")}
                </Button>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
