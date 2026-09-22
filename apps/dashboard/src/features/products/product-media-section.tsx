"use client";

import type { ProductOptionMediaBindings } from "@ecs/contracts";
import * as React from "react";
import { MediaUploadField } from "@/features/media/media-upload-field";
import type { ProductFormValues } from "@/features/products/product-form-types";
import type { ProductOptionDraft } from "@/features/products/product-variant-matrix";

export function ProductMediaSection({
  imageUrls,
  onImageUrlsChange,
  onOptionMediaBindingsChange,
  onThumbnailChange,
  onVariantOverridesChange,
  optionMediaBindings,
  options,
  thumbnail,
  variantOverrides,
}: {
  imageUrls: string[];
  onImageUrlsChange: (urls: string[]) => void;
  onOptionMediaBindingsChange?: (bindings: ProductOptionMediaBindings | null) => void;
  onThumbnailChange: (url: string) => void;
  onVariantOverridesChange?: (overrides: ProductFormValues["variantOverrides"]) => void;
  optionMediaBindings?: ProductOptionMediaBindings | null | undefined;
  options?: ProductOptionDraft[] | undefined;
  thumbnail: string;
  variantOverrides?: ProductFormValues["variantOverrides"] | undefined;
}) {
  return (
    <MediaUploadField
      imageUrls={imageUrls}
      onImageUrlsChange={onImageUrlsChange}
      onOptionMediaBindingsChange={onOptionMediaBindingsChange}
      onThumbnailChange={onThumbnailChange}
      onVariantOverridesChange={onVariantOverridesChange}
      optionMediaBindings={optionMediaBindings}
      options={options}
      thumbnail={thumbnail}
      variantOverrides={variantOverrides}
    />
  );
}
