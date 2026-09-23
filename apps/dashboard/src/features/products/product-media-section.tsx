"use client";

import type { ProductOptionMediaBindings } from "@ecs/contracts";
import * as React from "react";
import { MediaUploadField } from "@/features/media/media-upload-field";
import type { ProductOptionDraft } from "@/features/products/product-variant-matrix";

export function ProductMediaSection({
  imageUrls,
  onImageUrlsChange,
  onOptionMediaBindingsChange,
  onThumbnailChange,
  optionMediaBindings,
  options,
  thumbnail,
}: {
  imageUrls: string[];
  onImageUrlsChange: (urls: string[]) => void;
  onOptionMediaBindingsChange?: (bindings: ProductOptionMediaBindings | null) => void;
  onThumbnailChange: (url: string) => void;
  optionMediaBindings?: ProductOptionMediaBindings | null | undefined;
  options?: ProductOptionDraft[] | undefined;
  thumbnail: string;
}) {
  return (
    <MediaUploadField
      imageUrls={imageUrls}
      onImageUrlsChange={onImageUrlsChange}
      onOptionMediaBindingsChange={onOptionMediaBindingsChange}
      onThumbnailChange={onThumbnailChange}
      optionMediaBindings={optionMediaBindings}
      options={options}
      thumbnail={thumbnail}
    />
  );
}
