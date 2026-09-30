"use client";

import type { StorefrontEditorColorRole } from "@ecs/storefront-templates";
import { RiArrowDownSLine, RiInformationLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ColorPickerField } from "@/components/ui/color-picker-field";
import { FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { EditorAction, EditorData, StorefrontPageProps } from "./editor-state";
import { themePalettePageProps, themeResetPageProps } from "./editor-state";
import { isHexColor, updateStorefrontProps } from "./editor-utils";

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
  onOpenChange?: ((open: boolean) => void) | undefined;
  open?: boolean;
  props: StorefrontPageProps;
  templateKey: string;
}) {
  const { t } = useI18n();
  const mode: "light" | "dark" =
    props.surfaceMode === "light" || props.surfaceMode === "dark" ? props.surfaceMode : "dark";
  const primary = isHexColor(props.primaryColor ?? "") ? (props.primaryColor as string) : "#9bc4a0";
  const resetPrimary = themeResetPageProps(templateKey).primaryColor;
  const onBrandColorChange = (next: string) =>
    updateStorefrontProps(data, dispatch, themePalettePageProps(next, mode, templateKey));

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
              description={t("editor.theme.appearanceHelp")}
              label={t("editor.theme.colorBrand")}
              onChange={onBrandColorChange}
              resetLabel={t("editor.theme.defaultColor")}
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
            </div>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
