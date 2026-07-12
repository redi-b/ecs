import type { MessageKey } from "@/i18n/messages";

/**
 * Download a remote image via our server proxy and return a File suitable for
 * `uppy.addFile({ data, name, type })` — same upload path as local picks.
 */
export async function importRemoteImageAsFile(url: string): Promise<File> {
  const response = await fetch("/admin/media/import-url", {
    body: JSON.stringify({ url: url.trim() }),
    headers: {
      accept: "application/octet-stream, application/json",
      "content-type": "application/json",
    },
    method: "POST",
  }).catch(() => null);

  if (!response) {
    throw new Error("fetch_failed");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || contentType.includes("application/json")) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "fetch_failed");
  }

  const blob = await response.blob();
  const mimeType =
    response.headers.get("x-media-mime-type")?.trim() ||
    blob.type ||
    contentType.split(";")[0]?.trim() ||
    "image/jpeg";
  const encodedName = response.headers.get("x-media-filename");
  const filename = encodedName ? decodeURIComponent(encodedName) : "imported-image.jpg";

  return new File([blob], filename, { type: mimeType, lastModified: Date.now() });
}

export function mapImportUrlError(code: string, t: (key: MessageKey) => string) {
  switch (code) {
    case "invalid_url":
      return t("media.importUrlInvalid");
    case "private_url":
      return t("media.importUrlPrivate");
    case "invalid_type":
      return t("media.invalidType");
    case "too_large":
      return t("media.tooLarge");
    case "empty_file":
      return t("media.importUrlEmpty");
    case "timeout":
      return t("media.importUrlTimeout");
    case "unauthorized":
      return t("media.importUrlUnauthorized");
    default:
      return t("media.importUrlFailed");
  }
}
