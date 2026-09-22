"use client";

import * as React from "react";
import { useState } from "react";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function VariantImagePicker({
  galleryImages = [],
  imageUrl,
  onRemoveImage,
  onSelectImage,
}: {
  galleryImages?: string[] | undefined;
  imageUrl?: string | undefined;
  onRemoveImage: () => void;
  onSelectImage: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={imageUrl ? "Change variant image" : "Select variant image"}
          className="group relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg transition-transform active:scale-95"
          onClick={(event) => event.stopPropagation()}
          type="button"
        >
          {imageUrl ? (
            /* biome-ignore lint/performance/noImgElement: Runtime product photo */
            <img alt="" className="size-9 rounded-lg object-cover border" src={imageUrl} />
          ) : (
            <div className="size-9 rounded-lg border border-dashed grid place-items-center text-muted-foreground hover:bg-muted">
              <AppIcons.image className="size-4" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 text-xs" side="bottom">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Variant Image</span>
            {imageUrl ? (
              <Button
                className="h-6 gap-1 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  onRemoveImage();
                  setOpen(false);
                }}
                size="xs"
                type="button"
                variant="ghost"
              >
                <AppIcons.close className="size-3" />
                Remove
              </Button>
            ) : null}
          </div>

          {galleryImages.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No product images yet. Upload images in the Media section first.
            </p>
          ) : (
            <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto p-0.5">
              {galleryImages.map((url) => {
                const isSelected = imageUrl === url;
                return (
                  <button
                    className={cn(
                      "relative aspect-square w-full cursor-pointer overflow-hidden rounded-md border transition-all hover:scale-105 active:scale-95",
                      isSelected
                        ? "border-primary ring-2 ring-primary ring-offset-1"
                        : "border-border hover:border-foreground/40",
                    )}
                    key={url}
                    onClick={() => {
                      onSelectImage(url);
                      setOpen(false);
                    }}
                    type="button"
                  >
                    {/* biome-ignore lint/performance/noImgElement: Runtime asset */}
                    <img alt="" className="size-full object-cover" src={url} />
                    {isSelected ? (
                      <span className="absolute inset-0 grid place-items-center bg-primary/25 text-primary-foreground">
                        <AppIcons.check className="size-3.5 rounded-full bg-primary p-0.5 text-primary-foreground" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
