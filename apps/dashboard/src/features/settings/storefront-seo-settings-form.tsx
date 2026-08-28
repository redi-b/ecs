"use client";

import type { StorefrontSeoSettings } from "@ecs/contracts";
import { useForm } from "@tanstack/react-form";
import { ImageUpIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MediaLibraryDialog } from "@/features/media/media-library-dialog";
import { uploadMediaFile } from "@/features/media/upload-media-file";
import { SettingsPanel } from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";

export function StorefrontSeoSettingsForm({
  initialSeo,
  tenantId,
}: {
  initialSeo: StorefrontSeoSettings;
  tenantId: string;
}) {
  const { t } = useI18n();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const form = useForm({
    defaultValues: {
      title: initialSeo.title ?? "",
      description: initialSeo.description ?? "",
      socialImageUrl: initialSeo.socialImageUrl ?? "",
    },
    onSubmit: async ({ value }) => {
      const response = await fetch("/admin/storefront/seo", {
        body: JSON.stringify({
          tenantId,
          seo: {
            title: value.title.trim() || null,
            description: value.description.trim() || null,
            socialImageUrl: value.socialImageUrl.trim() || null,
          },
        }),
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "PATCH",
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        toast.error(
          data?.message === "untrusted_storefront_social_image"
            ? t("settings.storefront.seoImageUntrusted")
            : t("settings.storefront.seoSaveFailed"),
        );
        return;
      }
      toast.success(t("settings.storefront.seoSaved"));
      form.reset(value);
    },
  });

  return (
    <SettingsPanel
      description={t("settings.storefront.seoDescription")}
      title={t("settings.storefront.seoTitle")}
      contentClassName="space-y-5"
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="title"
          validators={{
            onBlur: ({ value }) =>
              value.trim().length <= 70 ? undefined : t("settings.storefront.seoTitleTooLong"),
          }}
        >
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>{t("settings.storefront.seoPageTitle")}</FieldLabel>
              <Input
                id={field.name}
                maxLength={70}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
              <FieldDescription>{t("settings.storefront.seoPageTitleHint")}</FieldDescription>
              {field.state.meta.isTouched && field.state.meta.errors[0] ? (
                <p className="text-sm text-destructive" role="alert">
                  {field.state.meta.errors[0]}
                </p>
              ) : null}
            </Field>
          )}
        </form.Field>
        <form.Field
          name="description"
          validators={{
            onBlur: ({ value }) =>
              value.trim().length <= 160
                ? undefined
                : t("settings.storefront.seoDescriptionTooLong"),
          }}
        >
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>
                {t("settings.storefront.seoMetaDescription")}
              </FieldLabel>
              <Textarea
                id={field.name}
                maxLength={160}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={3}
                value={field.state.value}
              />
              <FieldDescription>{t("settings.storefront.seoMetaDescriptionHint")}</FieldDescription>
              {field.state.meta.isTouched && field.state.meta.errors[0] ? (
                <p className="text-sm text-destructive" role="alert">
                  {field.state.meta.errors[0]}
                </p>
              ) : null}
            </Field>
          )}
        </form.Field>
        <form.Field name="socialImageUrl">
          {(field) => (
            <Field>
              <FieldLabel>{t("settings.storefront.seoSocialImage")}</FieldLabel>
              <FieldDescription>{t("settings.storefront.seoSocialImageHint")}</FieldDescription>
              {field.state.value ? (
                <div className="max-w-md overflow-hidden rounded-xl border bg-muted/30">
                  <div className="aspect-[1.91/1] bg-muted">
                    {/* biome-ignore lint/performance/noImgElement: media origin is tenant-configured at runtime. */}
                    <img alt="" className="size-full object-cover" src={field.state.value} />
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="text-sm font-semibold">
                      {form.getFieldValue("title") || t("settings.storefront.seoPreviewFallback")}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {form.getFieldValue("description") ||
                        t("settings.storefront.seoMetaDescriptionHint")}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <input
                  accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setUploadingImage(true);
                    void uploadMediaFile(file)
                      .then((url) => {
                        field.handleChange(url);
                        toast.success(t("settings.storefront.seoImageUploaded"));
                      })
                      .catch(() => toast.error(t("settings.storefront.seoImageUploadFailed")))
                      .finally(() => {
                        setUploadingImage(false);
                        if (uploadInputRef.current) uploadInputRef.current.value = "";
                      });
                  }}
                  ref={uploadInputRef}
                  type="file"
                />
                <Button
                  disabled={uploadingImage}
                  onClick={() => uploadInputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ImageUpIcon data-icon="inline-start" />
                  {uploadingImage
                    ? t("settings.storefront.seoUploadingImage")
                    : t("settings.storefront.seoUploadImage")}
                </Button>
                <MediaLibraryDialog
                  onSelect={(assets) => {
                    const selected = assets[0];
                    if (selected?.publicUrl) field.handleChange(selected.publicUrl);
                  }}
                  triggerLabel={
                    field.state.value
                      ? t("settings.storefront.seoChangeImage")
                      : t("settings.storefront.seoChooseImage")
                  }
                />
                {field.state.value ? (
                  <Button
                    onClick={() => field.handleChange("")}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {t("media.remove")}
                  </Button>
                ) : null}
              </div>
            </Field>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty] as const}
        >
          {([canSubmit, isSubmitting, isDirty]) => (
            <Button disabled={!canSubmit || !isDirty || isSubmitting} type="submit">
              {isSubmitting ? t("settings.storefront.seoSaving") : t("settings.storefront.seoSave")}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </SettingsPanel>
  );
}
