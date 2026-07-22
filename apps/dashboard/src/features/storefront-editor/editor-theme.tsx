"use client";

import type { Data, PuckAction } from "@puckeditor/core";
import { RiCheckLine, RiEditLine } from "@remixicon/react";
import { HexColorInput, HexColorPicker } from "react-colorful";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

import { FONT_OPTIONS, POPOVER_MOTION_CLASSNAME } from "./editor-config";
import type { StorefrontPageProps } from "./editor-state";
import { themePalettePageProps } from "./editor-state";
import { isHexColor, updateStorefrontProp, updateStorefrontProps } from "./editor-utils";

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
  const primary = isHexColor(props.primaryColor ?? "")
    ? (props.primaryColor as string)
    : "#9bc4a0";

  function applyPalette(nextPrimary: string, nextMode: "light" | "dark") {
    updateStorefrontProps(data, dispatch, themePalettePageProps(nextPrimary, nextMode));
  }

  const swatches: Array<{ label: string; value: string | undefined }> = [
    { label: "Background", value: props.backgroundColor },
    { label: "Text", value: props.foregroundColor },
    { label: "Brand", value: props.primaryColor },
    { label: "Muted", value: props.mutedColor },
    { label: "Accent", value: props.accentColor },
  ];

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Theme</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick a surface and brand color — we build a contrast-safe palette for you.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-5 p-4">
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
                  onClick={() => applyPalette(primary, option.id)}
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
          <FieldLabel className="text-sm font-medium">Brand color</FieldLabel>
          <PremiumColorPicker
            label="Brand color"
            onChange={(next) => applyPalette(next, mode)}
            value={primary}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <FieldLabel className="text-sm font-medium">Generated palette</FieldLabel>
          <div className="grid grid-cols-5 gap-2">
            {swatches.map((swatch) => (
              <div className="flex min-w-0 flex-col items-center gap-1.5" key={swatch.label}>
                <div
                  className="aspect-square w-full rounded-lg border shadow-sm"
                  style={{
                    backgroundColor: isHexColor(swatch.value ?? "")
                      ? swatch.value
                      : "var(--muted)",
                  }}
                  title={swatch.value}
                />
                <span className="truncate text-[10px] text-muted-foreground">{swatch.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Background, text, muted, and accent update automatically when you change brand color or
            surface.
          </p>
        </div>

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
    </section>
  );
}

export function PremiumColorPicker({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const color = isHexColor(value) ? value : "#000000";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="w-full min-w-0 justify-start gap-2" type="button" variant="outline">
          <span className="size-4 shrink-0 rounded-full border" style={{ backgroundColor: color }} />
          <span className="truncate font-mono text-xs uppercase">{color}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={POPOVER_MOTION_CLASSNAME}>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">
              Brand color — the rest of the palette is generated for contrast.
            </div>
          </div>
          <HexColorPicker className="!w-full" color={color} onChange={onChange} />
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-md border" style={{ backgroundColor: color }} />
            <HexColorInput
              aria-label={`${label} hex color`}
              className="flex h-9 min-w-0 flex-1 rounded-md border bg-background px-3 py-1 text-sm font-mono uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
              color={color}
              onChange={(nextColor) => onChange(`#${nextColor}`)}
              prefixed
            />
          </div>
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
