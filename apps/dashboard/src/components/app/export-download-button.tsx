"use client";

import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { filenameFromContentDisposition } from "@/components/app/export-filename";
import { Button } from "@/components/ui/button";

type ExportDownloadButtonProps = {
  fallbackFilename: string;
  failedMessage: string;
  href: string;
  label: string;
  pendingLabel: string;
};

export function ExportDownloadButton({
  fallbackFilename,
  failedMessage,
  href,
  label,
  pendingLabel,
}: ExportDownloadButtonProps) {
  const [pending, setPending] = useState(false);

  async function download() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok) throw new Error("export_failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filenameFromContentDisposition(
        response.headers.get("content-disposition"),
        fallbackFilename,
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      toast.error(failedMessage);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      aria-busy={pending}
      disabled={pending}
      onClick={() => void download()}
      variant="outline"
    >
      {pending ? (
        <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <DownloadIcon aria-hidden="true" className="size-4" />
      )}
      {pending ? pendingLabel : label}
    </Button>
  );
}
