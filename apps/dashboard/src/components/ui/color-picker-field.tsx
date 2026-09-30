"use client";

import { hexToHsl, hexToRgb, hslToHex, normalizeHex, rgbToHex } from "@ecs/storefront-templates";
import { RiArrowLeftSLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type ColorFormat = "hex" | "rgb" | "hsl";
const COLOR_PRESETS = [
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
const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(value)));
const clampHue = (value: number) => ((Math.round(value) % 360) + 360) % 360;

function ChannelField({
  label,
  max,
  min,
  onCommit,
  suffix,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onCommit: (value: number) => void;
  suffix?: string;
  value: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit(raw: string) {
    const parsed = Number(raw.replace(/%/g, "").trim());
    if (!Number.isFinite(parsed)) return setDraft(String(value));
    const next = clamp(parsed, min, max);
    setDraft(String(next));
    onCommit(next);
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
          onBlur={() => commit(draft)}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit(event.currentTarget.value);
              event.currentTarget.blur();
            }
          }}
          value={draft}
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
  description,
  label,
  onChange,
  onCommit,
  resetLabel,
  value,
  swatchOnly = false,
}: {
  defaultColor?: string | undefined;
  description?: string | undefined;
  label: string;
  onChange: (value: string) => void;
  onCommit?: ((value: string) => void) | undefined;
  resetLabel?: string | undefined;
  value: string;
  swatchOnly?: boolean;
}) {
  const { t } = useI18n();
  const normalizedValue = isHexColor(value) ? normalizeHex(value).toLowerCase() : "#111111";
  const [color, setColor] = useState(normalizedValue);
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [hexDraft, setHexDraft] = useState(normalizedValue.toUpperCase());
  const [showCustom, setShowCustom] = useState(false);
  const interactingRef = useRef(false);
  const colorRef = useRef(color);
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
  const formats: Array<{ id: ColorFormat; label: string }> = [
    { id: "hex", label: "HEX" },
    { id: "rgb", label: "RGB" },
    { id: "hsl", label: "HSL" },
  ];
  function commitHex(raw: string) {
    const trimmed = raw.trim();
    const candidate = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (isHexColor(candidate)) updateColor(candidate, true);
    else setHexDraft(color.toUpperCase());
  }
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
            aria-label={label}
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
          <div className="flex shrink-0 flex-col gap-1 border-b px-4 py-3">
            <div className="flex items-center justify-between gap-2">
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
            {description ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-3.5">
            {showCustom ? (
              <>
                <SegmentedControl
                  ariaLabel="Color format"
                  onChange={setFormat}
                  options={formats}
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
                      onCommit={(r) =>
                        updateColor(
                          rgbToHex(clamp(r, 0, 255), clamp(rgb.g, 0, 255), clamp(rgb.b, 0, 255)),
                          true,
                        )
                      }
                      value={rgb.r}
                    />
                    <ChannelField
                      label="G"
                      max={255}
                      min={0}
                      onCommit={(g) =>
                        updateColor(
                          rgbToHex(clamp(rgb.r, 0, 255), clamp(g, 0, 255), clamp(rgb.b, 0, 255)),
                          true,
                        )
                      }
                      value={rgb.g}
                    />
                    <ChannelField
                      label="B"
                      max={255}
                      min={0}
                      onCommit={(b) =>
                        updateColor(
                          rgbToHex(clamp(rgb.r, 0, 255), clamp(rgb.g, 0, 255), clamp(b, 0, 255)),
                          true,
                        )
                      }
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
                      onCommit={(h) =>
                        updateColor(
                          hslToHex(clampHue(h), clamp(hsl.s, 0, 100), clamp(hsl.l, 0, 100)),
                          true,
                        )
                      }
                      value={Math.round(hsl.h)}
                    />
                    <ChannelField
                      label="S"
                      max={100}
                      min={0}
                      onCommit={(s) =>
                        updateColor(
                          hslToHex(clampHue(hsl.h), clamp(s, 0, 100), clamp(hsl.l, 0, 100)),
                          true,
                        )
                      }
                      suffix="%"
                      value={Math.round(hsl.s)}
                    />
                    <ChannelField
                      label="L"
                      max={100}
                      min={0}
                      onCommit={(l) =>
                        updateColor(
                          hslToHex(clampHue(hsl.h), clamp(hsl.s, 0, 100), clamp(l, 0, 100)),
                          true,
                        )
                      }
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
                  {COLOR_PRESETS.map((preset) => (
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
                <Button
                  className="w-full"
                  onClick={() => setShowCustom(true)}
                  type="button"
                  variant="outline"
                >
                  {t("editor.theme.customColor")}
                </Button>
                {defaultColor &&
                isHexColor(defaultColor) &&
                color !== normalizeHex(defaultColor) ? (
                  <Button
                    className="w-full justify-start text-muted-foreground"
                    onClick={() => updateColor(defaultColor, true)}
                    type="button"
                    variant="ghost"
                  >
                    <AppIcons.refresh data-icon="inline-start" />
                    {resetLabel ?? t("editor.theme.defaultColor")}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
