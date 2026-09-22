"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaLibraryDialog } from "@/features/media/media-library-dialog";
import { uploadMediaFile } from "@/features/media/upload-media-file";
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMediaFile(file);
      onSelectImage(url);
      setOpen(false);
      toast.success("Variant photo uploaded");
    } catch (error) {
      const code = error instanceof Error ? error.message : "upload_failed";
      toast.error(
        code === "invalid_type"
          ? "Unsupported image file format"
          : code === "too_large"
            ? "File exceeds maximum upload size (15MB)"
            : "Failed to upload image",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                aria-label={imageUrl ? "Change variant photo" : "Assign variant photo"}
                className="group relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(event) => event.stopPropagation()}
                type="button"
              >
                {imageUrl ? (
                  <div className="relative size-9 shrink-0 overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" className="size-9 rounded-lg object-cover border" src={imageUrl} />
                    <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/40 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <AppIcons.edit className="size-3.5" />
                    </span>
                  </div>
                ) : (
                  <div className="size-9 rounded-lg border border-dashed grid place-items-center text-muted-foreground bg-muted/20 transition-all duration-150 group-hover:border-primary group-hover:bg-primary/5 group-hover:text-primary">
                    <AppIcons.add className="size-4" />
                  </div>
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {imageUrl ? "Change variant photo" : "Assign variant photo"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="start" className="w-80 rounded-xl p-3 text-xs shadow-md" side="bottom">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div>
              <div className="text-xs font-semibold text-foreground">Variant Photo</div>
              <p className="text-[11px] text-muted-foreground">
                Assign a dedicated photo to this variant
              </p>
            </div>
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

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Product images</span>
            {galleryImages.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 bg-muted/10 py-3 text-center text-xs text-muted-foreground">
                No product images yet in the Media section.
              </p>
            ) : (
              <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto p-0.5">
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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

          <div className="flex flex-col gap-2 border-t border-border/60 pt-2.5">
            <input
              accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => void handleFileUpload(event.target.files)}
              ref={fileInputRef}
              type="file"
            />
            <div className="flex items-center gap-2">
              <Button
                className="h-7 flex-1 justify-center text-xs"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                type="button"
                variant="outline"
              >
                {uploading ? (
                  <AppIcons.loader className="size-3 animate-spin" />
                ) : (
                  <AppIcons.upload className="size-3" />
                )}
                {uploading ? "Uploading…" : "Upload photo"}
              </Button>
              <MediaLibraryDialog
                onSelect={(assets) => {
                  const url = assets[0]?.publicUrl?.trim();
                  if (url) {
                    onSelectImage(url);
                    setOpen(false);
                  }
                }}
                selectionMode="single"
                triggerClassName="h-7 flex-1 justify-center text-xs"
                triggerLabel="Choose library"
                triggerSize="sm"
                triggerVariant="outline"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
