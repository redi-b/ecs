"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
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
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("media.editMetadata")}</SheetTitle>
          <SheetDescription>{t("media.metadataDescription")}</SheetDescription>
        </SheetHeader>

        {asset ? (
          <form
            className="flex flex-1 flex-col gap-5 px-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="overflow-hidden rounded-xl border bg-muted/30">
              <button
                className="block w-full bg-muted text-left"
                disabled={!asset.publicUrl || !onOpenLightbox}
                onClick={() => onOpenLightbox?.()}
                type="button"
              >
                {/* biome-ignore lint/performance/noImgElement: Runtime object-storage media. */}
                <img
                  alt={asset.altText ?? asset.displayName}
                  className="aspect-[4/3] w-full object-cover"
                  src={asset.publicUrl ?? ""}
                />
              </button>
              <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                <span>{formatMimeLabel(asset.mimeType)}</span>
                <span aria-hidden>·</span>
                <span>{formatBytes(asset.byteSize)}</span>
                {dimensions ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{dimensions}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4">
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
              <div className="rounded-xl border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                <p>
                  {t("media.added")}: {formatDate(new Date(asset.createdAt))}
                </p>
                <p className="mt-1 truncate">{asset.filename}</p>
              </div>
            </div>

            <SheetFooter className="gap-2 px-0 sm:flex-row sm:justify-between">
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
