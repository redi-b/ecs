"use client";

import type { DataTableFilterDefinition } from "@/components/app/data-table-filters";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import type { MediaOrientationFilter, MediaSizeFilter, MediaSort } from "./media-helpers";

type Translate = (key: MessageKey) => string;
export type MediaFilterValues = {
  mimeType: string;
  orientation: MediaOrientationFilter;
  size: MediaSizeFilter;
};

export function mediaFilterDefinitions(
  t: Translate,
  values: MediaFilterValues,
  onChange: (next: Partial<MediaFilterValues>) => void,
): DataTableFilterDefinition[] {
  return [
    {
      id: "type",
      label: t("media.type"),
      defaultValue: "all",
      value: values.mimeType,
      onChange: (mimeType) => onChange({ mimeType }),
      options: [
        { label: t("media.allTypes"), value: "all" },
        ...["jpeg", "png", "webp", "avif", "gif"].map((type) => ({
          label: type === "jpeg" ? "JPEG" : type === "webp" ? "WebP" : type.toUpperCase(),
          value: `image/${type}`,
        })),
      ],
    },
    {
      id: "size",
      label: t("media.fileSize"),
      defaultValue: "all",
      value: values.size,
      onChange: (size) => onChange({ size: size as MediaSizeFilter }),
      options: [
        { label: t("media.allSizes"), value: "all" },
        { label: t("media.sizeSmall"), value: "small" },
        { label: t("media.sizeMedium"), value: "medium" },
        { label: t("media.sizeLarge"), value: "large" },
      ],
    },
    {
      id: "orientation",
      label: t("media.orientation"),
      defaultValue: "all",
      value: values.orientation,
      onChange: (orientation) => onChange({ orientation: orientation as MediaOrientationFilter }),
      options: [
        { label: t("media.allOrientations"), value: "all" },
        { label: t("media.landscape"), value: "landscape" },
        { label: t("media.portrait"), value: "portrait" },
        { label: t("media.square"), value: "square" },
      ],
    },
  ];
}

export function MediaSortControl({
  value,
  onChange,
}: {
  value: MediaSort;
  onChange: (value: MediaSort) => void;
}) {
  const { t } = useI18n();
  return (
    <Select value={value} onValueChange={(value) => onChange(value as MediaSort)}>
      <SelectTrigger aria-label={t("media.sort")} className="w-auto min-w-36" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="newest">{t("media.sortNewest")}</SelectItem>
          <SelectItem value="oldest">{t("media.sortOldest")}</SelectItem>
          <SelectItem value="name_asc">{t("media.sortNameAsc")}</SelectItem>
          <SelectItem value="name_desc">{t("media.sortNameDesc")}</SelectItem>
          <SelectItem value="largest">{t("media.sortLargest")}</SelectItem>
          <SelectItem value="smallest">{t("media.sortSmallest")}</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
