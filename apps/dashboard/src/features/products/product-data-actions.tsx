"use client";

import { ArrowUpDownIcon, DownloadIcon, FileUpIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { filenameFromContentDisposition } from "@/components/app/export-filename";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/provider";
import { ProductImportDryRunDialog } from "./product-import-dry-run-dialog";

export function ProductDataActions({ exportHref }: { exportHref: string }) {
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  async function exportProducts() {
    if (exporting) return;
    setExporting(true);
    const toastId = toast.loading(t("products.export.pending"));
    try {
      const response = await fetch(exportHref, { cache: "no-store" });
      if (!response.ok) throw new Error("export_failed");
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filenameFromContentDisposition(
        response.headers.get("content-disposition"),
        "ecs-products.csv",
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      toast.success(t("products.export.ready"), { id: toastId });
    } catch {
      toast.error(t("products.export.failed"), { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <ArrowUpDownIcon data-icon="inline-start" />
            {t("products.dataTools")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={exporting} onSelect={() => void exportProducts()}>
              {exporting ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
              {exporting ? t("products.export.pending") : t("products.export.label")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setImportOpen(true)}>
              <FileUpIcon />
              {t("products.import.action")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProductImportDryRunDialog onOpenChange={setImportOpen} open={importOpen} />
    </>
  );
}
