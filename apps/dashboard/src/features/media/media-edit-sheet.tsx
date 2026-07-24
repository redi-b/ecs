"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/provider";
import type { MediaAsset } from "@/lib/merchant-media";
import {
  formatBytes,
  formatMimeLabel,
  mediaAssetDimensionsLabel,
} from "./media-helpers";

export function MediaEditSheet({
  asset,
  onClose,
  onOpenLightbox,
  onSaved,
}: {
  asset: MediaAsset | null;
  onClose: () => void;
  onOpenLightbox?: (() => void) | undefined;
  onSaved: () => void;
}) {
  const { formatDate, t } = useI18n();
  const nameId = useId();
  const altId = useId();
  const [name, setName] = useState("");
  const [alt, setAlt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(asset?.displayName ?? "");
    setAlt(asset?.altText ?? "");
    setSaving(false);
  }, [asset]);

  async function save() {
    if (!asset) return;
    setSaving(true);
    const response = await fetch(`/admin/media/assets/${encodeURIComponent(asset.id)}`, {
      body: JSON.stringify({ altText: alt, displayName: name }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setSaving(false);
    if (!response.ok) {
      toast.error(t("media.saveError"));
      return;
    }
    toast.success(t("media.saved"));
    onSaved();
  }

  const dimensions = asset ? mediaAssetDimensionsLabel(asset) : null;

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={Boolean(asset)}
    >
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("media.editMetadata")}</SheetTitle>
          <SheetDescription>{t("media.metadataDescription")}</SheetDescription>
        </SheetHeader>

        {asset ? (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <SheetBody className="flex flex-col gap-5">
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
                <button
                  className="group relative block w-full bg-muted text-left disabled:cursor-default"
                  disabled={!asset.publicUrl || !onOpenLightbox}
                  onClick={() => onOpenLightbox?.()}
                  type="button"
                >
                  {/* biome-ignore lint/performance/noImgElement: Runtime object-storage media. */}
                  <img
                    alt={asset.altText ?? asset.displayName}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.01] group-disabled:scale-100"
                    src={asset.publicUrl ?? ""}
                  />
                  {asset.publicUrl && onOpenLightbox ? (
                    <span className="pointer-events-none absolute inset-0 flex items-end justify-end bg-linear-to-t from-black/35 via-transparent to-transparent p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <span className="rounded-full border border-white/20 bg-black/45 p-1.5 text-white">
                        <AppIcons.expand className="size-3.5" />
                      </span>
                    </span>
                  ) : null}
                </button>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/80 bg-muted/15 px-3.5 py-2.5 text-xs text-muted-foreground">
                  <span className="font-medium tracking-wide text-foreground/80 uppercase">
                    {formatMimeLabel(asset.mimeType)}
                  </span>
                  <span aria-hidden className="text-border">
                    ·
                  </span>
                  <span className="tabular-nums">{formatBytes(asset.byteSize)}</span>
                  {dimensions ? (
                    <>
                      <span aria-hidden className="text-border">
                        ·
                      </span>
                      <span className="tabular-nums">{dimensions}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 rounded-2xl border border-border/80 bg-card p-3.5 shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)] sm:p-4">
                <Field>
                  <FieldLabel htmlFor={nameId}>{t("media.displayName")}</FieldLabel>
                  <Input
                    id={nameId}
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={altId}>{t("media.altText")}</FieldLabel>
                  <Textarea
                    id={altId}
                    onChange={(event) => setAlt(event.target.value)}
                    rows={3}
                    value={alt}
                  />
                  <FieldDescription>{t("media.altTextHint")}</FieldDescription>
                </Field>
              </div>

              <div className="rounded-2xl border border-border/80 bg-muted/20 px-3.5 py-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground/80">
                  {t("media.added")}:{" "}
                  <span className="font-normal text-muted-foreground">
                    {formatDate(new Date(asset.createdAt))}
                  </span>
                </p>
                <p className="mt-1.5 truncate font-mono text-[11px] opacity-90" title={asset.filename}>
                  {asset.filename}
                </p>
              </div>
            </SheetBody>

            <SheetFooter className="gap-2 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                {asset.publicUrl ? (
                  <Button asChild size="sm" type="button" variant="outline">
                    <a href={asset.publicUrl} rel="noreferrer" target="_blank">
                      <AppIcons.externalLink data-icon="inline-start" />
                      {t("media.openInNewTab")}
                    </a>
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button onClick={onClose} size="sm" type="button" variant="outline">
                  {t("common.cancel")}
                </Button>
                <Button disabled={saving || !name.trim()} size="sm" type="submit">
                  {saving ? t("media.saving") : t("common.save")}
                </Button>
              </div>
            </SheetFooter>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
