"use client";

import type { OperatorStorefrontTemplateCatalog } from "@ecs/contracts";
import AwsS3 from "@uppy/aws-s3";
import Uppy, { type UppyFile } from "@uppy/core";
import { ExternalLink, ImageIcon, ImagePlus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type DragEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

type Template = OperatorStorefrontTemplateCatalog["templates"][number];
type UploadMeta = { assetId?: string };
type UploadState = {
  assetId: string | null;
  error: string | null;
  file: File;
  fileId: string;
  previewUrl: string;
  progress: number;
  status: "uploading" | "processing" | "ready" | "failed";
};

const allowedPreviewTypes = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);
const maxPreviewBytes = 8 * 1024 * 1024;

export function StorefrontTemplateWorkspace({ catalog }: { catalog: OperatorStorefrontTemplateCatalog }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {catalog.templates.map((template) => (
        <TemplateCard key={template.versionId} template={template} />
      ))}
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const uploadStateRef = useRef<UploadState | null>(null);
  const [uppy] = useState(() =>
    new Uppy<UploadMeta, Record<string, never>>({
      autoProceed: true,
      restrictions: {
        allowedFileTypes: [...allowedPreviewTypes],
        maxFileSize: maxPreviewBytes,
        maxNumberOfFiles: 1,
      },
    }).use(AwsS3, {
      async getUploadParameters(file) {
        const response = await fetch("/api/storefront-templates", {
          body: JSON.stringify({ byteSize: file.size, filename: file.name, mimeType: file.type }),
          headers: { accept: "application/json", "content-type": "application/json" },
          method: "POST",
        });
        const descriptor = (await response.json().catch(() => null)) as {
          asset?: { id?: string };
          error?: string;
          headers?: Record<string, string>;
          method?: "PUT";
          uploadUrl?: string;
        } | null;
        const assetId = descriptor?.asset?.id;
        if (!response.ok || !descriptor?.uploadUrl || !assetId) {
          throw new Error(descriptor?.error ?? "upload_failed");
        }
        uppy.setFileMeta(file.id, { assetId });
        return { headers: descriptor.headers ?? {}, method: "PUT" as const, url: descriptor.uploadUrl };
      },
      shouldUseMultipart: false,
    }),
  );

  useEffect(() => {
    uploadStateRef.current = uploadState;
  }, [uploadState]);

  const completeUpload = useCallback(async (file: UppyFile<UploadMeta, Record<string, never>>) => {
    const assetId = file.meta.assetId;
    const sourceFile = file.data as File;
    if (!assetId) throw new Error("upload_failed");
    setUploadState((current) => {
      if (!current || current.fileId !== file.id) return current;
      return { ...current, progress: 100, status: "processing" };
    });
    const dimensions = await readImageDimensions(sourceFile);
    const response = await fetch(`/api/storefront-templates/uploads/${encodeURIComponent(assetId)}/complete`, {
      body: JSON.stringify(dimensions),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "upload_failed");
    setUploadState((current) => {
      if (!current || current.fileId !== file.id) return current;
      return { ...current, assetId, error: null, progress: 100, status: "ready" };
    });
  }, []);

  useEffect(() => {
    const onProgress = (file: UppyFile<UploadMeta, Record<string, never>> | undefined, progress: { bytesTotal: number | null; bytesUploaded: number }) => {
      const bytesTotal = progress.bytesTotal;
      if (!file || !bytesTotal) return;
      setUploadState((current) => {
        if (!current || current.fileId !== file.id) return current;
        return { ...current, progress: Math.round((progress.bytesUploaded / bytesTotal) * 100) };
      });
    };
    const onError = (file: UppyFile<UploadMeta, Record<string, never>> | undefined, error: Error) => {
      if (!file) return;
      setUploadState((current) => {
        if (!current || current.fileId !== file.id) return current;
        return { ...current, error: formatError(error), status: "failed" };
      });
    };
    const onSuccess = (file: UppyFile<UploadMeta, Record<string, never>> | undefined) => {
      if (!file) return;
      void completeUpload(file).catch((error) => {
        setUploadState((current) => {
          if (!current || current.fileId !== file.id) return current;
          return { ...current, error: formatError(error), status: "failed" };
        });
      });
    };
    uppy.on("upload-progress", onProgress);
    uppy.on("upload-error", onError);
    uppy.on("upload-success", onSuccess);
    return () => {
      uppy.off("upload-progress", onProgress);
      uppy.off("upload-error", onError);
      uppy.off("upload-success", onSuccess);
      uppy.cancelAll();
      const current = uploadStateRef.current;
      if (current) URL.revokeObjectURL(current.previewUrl);
    };
  }, [completeUpload, uppy]);

  function clearUpload() {
    const current = uploadStateRef.current;
    if (current && uppy.getFile(current.fileId)) {
      try {
        uppy.removeFile(current.fileId);
      } catch {
        uppy.cancelAll();
      }
    }
    if (current) URL.revokeObjectURL(current.previewUrl);
    uploadStateRef.current = null;
    setUploadState(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function selectFile(file: File | undefined) {
    if (!file) return;
    try {
      validatePreviewFile(file);
      const dimensions = await readImageDimensions(file);
      if (dimensions.width < 960 || dimensions.width <= dimensions.height) throw new Error("platform_asset_dimensions_invalid");
      clearUpload();
      const previewUrl = URL.createObjectURL(file);
      const fileId = uppy.addFile({ data: file, name: file.name, type: file.type });
      const next: UploadState = { assetId: null, error: null, file, fileId, previewUrl, progress: 0, status: "uploading" };
      uploadStateRef.current = next;
      setUploadState(next);
    } catch (error) {
      toast.error(formatError(error));
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function retryUpload() {
    const current = uploadStateRef.current;
    if (!current) return;
    setUploadState({ ...current, error: null, progress: current.assetId ? 100 : 0, status: current.assetId ? "processing" : "uploading" });
    try {
      const file = uppy.getFile(current.fileId);
      if (!file) throw new Error("upload_failed");
      if (file.meta.assetId && file.progress?.uploadComplete) await completeUpload(file);
      else await uppy.retryUpload(current.fileId);
    } catch (error) {
      setUploadState((value) => value ? { ...value, error: formatError(error), status: "failed" } : value);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const previewAssetId = uploadState?.assetId ?? template.previewAssetId;
      const response = await fetch(`/api/storefront-templates/${encodeURIComponent(template.versionId)}`, {
        body: JSON.stringify({
          demoUrl: String(form.get("demoUrl") ?? "").trim() || null,
          previewAltText: String(form.get("previewAltText") ?? "").trim() || null,
          previewAssetId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "update_failed");
      toast.success(`${template.name} preview updated`);
      clearUpload();
      router.refresh();
    } catch (cause) {
      toast.error(formatError(cause));
    } finally {
      setPending(false);
    }
  }

  const previewUrl = uploadState?.previewUrl ?? template.previewUrl;
  const uploadBusy = uploadState?.status === "uploading" || uploadState?.status === "processing";

  return (
    <Card className="overflow-hidden">
      <div className="group relative aspect-[16/10] border-b bg-muted/35">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="size-full object-cover object-top" src={previewUrl} />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ImageIcon aria-hidden className="size-8" />
          </div>
        )}
        {uploadState ? (
          <div className="absolute inset-x-3 bottom-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{uploadState.file.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {uploadState.status === "ready" ? "Ready" : uploadState.status === "processing" ? "Checking image" : uploadState.status === "failed" ? "Upload failed" : `${uploadState.progress}%`}
                  </span>
                </div>
                {uploadState.status !== "ready" && uploadState.status !== "failed" ? <Progress className="mt-2 h-1.5" value={uploadState.progress} /> : null}
                {uploadState.error ? <p className="mt-1 text-xs text-destructive">{uploadState.error}</p> : null}
              </div>
              {uploadState.status === "failed" ? (
                <Button aria-label="Retry upload" onClick={() => void retryUpload()} size="icon-sm" type="button" variant="outline">
                  <RefreshCw aria-hidden />
                </Button>
              ) : null}
              <Button aria-label="Cancel selected screenshot" disabled={uploadState.status === "processing"} onClick={clearUpload} size="icon-sm" type="button" variant="ghost">
                <X aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{template.name}</CardTitle>
              <Badge variant="outline">v{template.version}</Badge>
              <Badge variant={template.status === "active" ? "success" : "secondary"}>{template.status}</Badge>
            </div>
            <CardDescription className="mt-1">{template.description}</CardDescription>
          </div>
          {template.demoUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={template.demoUrl} rel="noreferrer" target="_blank">
                View demo <ExternalLink aria-hidden data-icon="inline-end" />
              </a>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`preview-${template.versionId}`}>Preview screenshot</FieldLabel>
              <input
                accept="image/avif,image/jpeg,image/png,image/webp"
                className="sr-only"
                id={`preview-${template.versionId}`}
                onChange={(event) => void selectFile(event.target.files?.[0])}
                ref={fileRef}
                type="file"
              />
              <button
                className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center outline-none transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                disabled={pending || uploadBusy}
                onClick={() => fileRef.current?.click()}
                onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
                onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                onDrop={(event: DragEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  setDragActive(false);
                  void selectFile(event.dataTransfer.files[0]);
                }}
                style={dragActive ? { borderColor: "var(--ring)", backgroundColor: "var(--muted)" } : undefined}
                type="button"
              >
                <ImagePlus aria-hidden className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium">{template.previewAssetId ? "Replace screenshot" : "Choose a screenshot"}</span>
                <span className="text-xs text-muted-foreground">or drag and drop it here</span>
              </button>
              <FieldDescription>Landscape, at least 960 pixels wide. Maximum 8 MB.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`alt-${template.versionId}`}>Preview description</FieldLabel>
              <Input
                defaultValue={template.previewAltText ?? ""}
                id={`alt-${template.versionId}`}
                name="previewAltText"
                placeholder={`${template.name} storefront home page`}
                required={Boolean(uploadState || template.previewAssetId)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`demo-${template.versionId}`}>Demo URL</FieldLabel>
              <Input
                defaultValue={template.demoUrl ?? ""}
                id={`demo-${template.versionId}`}
                inputMode="url"
                name="demoUrl"
                placeholder="https://demo.example.com"
                type="url"
              />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              {template.previewAssetId && !uploadState ? (
                <Button
                  disabled={pending || uploadBusy}
                  onClick={async () => {
                    setPending(true);
                    try {
                      const response = await fetch(`/api/storefront-templates/${encodeURIComponent(template.versionId)}`, {
                        body: JSON.stringify({ demoUrl: template.demoUrl, previewAltText: null, previewAssetId: null }),
                        headers: { "content-type": "application/json" },
                        method: "POST",
                      });
                      if (!response.ok) throw new Error("remove_failed");
                      toast.success("Preview removed");
                      router.refresh();
                    } catch {
                      toast.error("The preview could not be removed.");
                    } finally {
                      setPending(false);
                    }
                  }}
                  type="button"
                  variant="outline"
                >
                  <Trash2 aria-hidden data-icon="inline-start" />
                  Remove preview
                </Button>
              ) : null}
              <Button disabled={pending || uploadBusy || uploadState?.status === "failed"} type="submit">
                {pending ? <Spinner data-icon="inline-start" /> : <Upload aria-hidden data-icon="inline-start" />}
                Save presentation
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function validatePreviewFile(file: File) {
  if (!allowedPreviewTypes.has(file.type)) throw new Error("platform_asset_mime_type_invalid");
  if (file.size > maxPreviewBytes) throw new Error("platform_asset_too_large");
}

function readImageDimensions(file: File) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ height: image.naturalHeight, width: image.naturalWidth });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_invalid"));
    };
    image.src = url;
  });
}

function formatError(cause: unknown) {
  const value = cause instanceof Error ? cause.message : "update_failed";
  if (value === "platform_asset_dimensions_invalid") return "Use a landscape image at least 960 pixels wide.";
  if (value === "platform_asset_mime_type_invalid") return "Choose an AVIF, JPEG, PNG, or WebP image.";
  if (value === "platform_asset_too_large") return "Choose an image smaller than 8 MB.";
  if (value === "image_invalid") return "Choose a valid image file.";
  if (value === "storefront_template_alt_text_required") return "Add a short description for the preview image.";
  if (value === "storefront_template_demo_url_invalid") return "Enter a valid public demo URL.";
  return "The template presentation could not be saved. Try again.";
}
