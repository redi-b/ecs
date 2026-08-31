"use client";

import { CopyIcon, DownloadIcon, FileSpreadsheetIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { type DragEvent, type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/provider";
import { copyTextToClipboard } from "@/lib/clipboard";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { type ProductImportExecution, RECENT_PRODUCT_IMPORT_KEY } from "./product-import-progress";

type Artifact = {
  contentDigest: string;
  expiresAt: string;
  id: string;
  schemaVersion: string;
  status: "reviewed";
  summary: Report["summary"] & { products: number };
};

type Report = {
  artifact?: Artifact;
  issues: Array<{ code: string; message: string; row: number }>;
  summary: { blocked: number; creates: number; rows: number; updates: number };
};

type ApplyResponse = {
  execution: ProductImportExecution;
};

const PRODUCT_CSV_HEADERS = [
  "schema_version",
  "product_id",
  "product_handle",
  "product_title",
  "description",
  "status",
  "collection_id",
  "category_ids",
  "variant_id",
  "variant_title",
  "sku",
  "option_values_json",
  "option_presentations_json",
  "prices_json",
  "stocked_quantity",
  "reserved_quantity",
  "incoming_quantity",
  "available_quantity",
  "thumbnail_url",
  "image_urls_json",
  "created_at",
  "updated_at",
] as const;
const SAMPLE_PRODUCT_CSV = [
  PRODUCT_CSV_HEADERS,
  [
    "ecs-products-v2",
    "",
    "ethiopian-coffee",
    "Ethiopian Coffee",
    "Freshly roasted coffee",
    "published",
    "",
    "[]",
    "",
    "250 g",
    "COFFEE-250",
    "[]",
    "[]",
    '[{"amount":450,"currencyCode":"etb"}]',
    "25",
    "",
    "",
    "",
    "",
    "[]",
    "",
    "",
  ],
]
  .map((row) => row.map(csvCell).join(","))
  .join("\r\n");

function createIdempotencyKey(artifactId: string) {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `product-import:${artifactId}:${randomPart}`;
}

export function ProductImportDryRunDialog({
  onOpenChange,
  open: controlledOpen,
  trigger,
}: {
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  trigger?: ReactNode;
}) {
  const { t, formatNumber, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  async function run() {
    if (!file) {
      toast.error(t("products.import.fileRequired"));
      return;
    }
    const body = new FormData();
    body.set("file", file);
    setRunning(true);
    setReport(null);
    idempotencyKey.current = null;
    try {
      const response = await fetch(dashboardRoutes.productsImportDryRunAction, {
        body,
        headers: { accept: "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "product_import_dry_run_failed");
      setReport(data as Report);
    } catch {
      toast.error(t("products.import.failed"));
    } finally {
      setRunning(false);
    }
  }

  function selectFile(nextFile: File | null) {
    if (nextFile && !isCsvFile(nextFile)) {
      toast.error(t("products.import.invalidFile"));
      return;
    }
    setFile(nextFile);
    setReport(null);
    idempotencyKey.current = null;
  }

  function dropFile(event: DragEvent<HTMLFieldSetElement>) {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    selectFile(event.dataTransfer.files[0] ?? null);
  }

  async function copyFormat() {
    try {
      const copied = await copyTextToClipboard(PRODUCT_CSV_HEADERS.join(","));
      toast[copied ? "success" : "error"](
        t(copied ? "products.import.formatCopied" : "products.import.copyFailed"),
      );
    } catch {
      toast.error(t("products.import.copyFailed"));
    }
  }

  function downloadSample() {
    const objectUrl = URL.createObjectURL(
      new Blob([`\uFEFF${SAMPLE_PRODUCT_CSV}\r\n`], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "ecs-products-sample.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  async function apply() {
    const artifact = report?.artifact;
    if (!artifact || report.issues.length > 0) return;
    if (new Date(artifact.expiresAt).getTime() <= Date.now()) {
      toast.error(t("products.import.expired"));
      return;
    }

    const key = idempotencyKey.current ?? createIdempotencyKey(artifact.id);
    idempotencyKey.current = key;
    setApplying(true);
    try {
      const response = await fetch(dashboardRoutes.productsImportApplyAction, {
        body: JSON.stringify({
          artifactId: artifact.id,
          contentDigest: artifact.contentDigest,
          idempotencyKey: key,
        }),
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as ApplyResponse & {
        error?: string;
      };
      if (!response.ok || !data.execution) {
        if (data.error === "product_import_artifact_expired") {
          toast.error(t("products.import.expired"));
        } else {
          toast.error(t("products.import.applyFailed"));
        }
        return;
      }
      window.localStorage.setItem(RECENT_PRODUCT_IMPORT_KEY, data.execution.id);
      window.dispatchEvent(new Event("ecs:background-task"));
      toast.success(t("products.import.queued"));
      if (controlledOpen === undefined) setOpen(false);
      onOpenChange?.(false);
    } catch {
      toast.error(t("products.import.applyFailed"));
    } finally {
      setApplying(false);
    }
  }

  const artifactExpired = report?.artifact
    ? new Date(report.artifact.expiresAt).getTime() <= Date.now()
    : false;
  const busy = running || applying;
  const resolvedOpen = controlledOpen ?? open;

  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (controlledOpen === undefined) setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={resolvedOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="grid max-h-[min(90vh,48rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-5 pt-5 pb-4 pr-12">
          <DialogTitle>{t("products.import.title")}</DialogTitle>
          <DialogDescription>{t("products.import.description")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto px-5 pb-5">
          <section className="min-w-0 rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t("products.import.formatTitle")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("products.import.formatDescription")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void copyFormat()} size="sm" type="button" variant="outline">
                  <CopyIcon />
                  {t("products.import.copyFormat")}
                </Button>
                <Button onClick={downloadSample} size="sm" type="button" variant="outline">
                  <DownloadIcon />
                  {t("products.import.downloadSample")}
                </Button>
              </div>
            </div>
            <div className="mt-3 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border bg-background px-3 py-2">
              <code className="whitespace-nowrap text-xs text-muted-foreground">
                {PRODUCT_CSV_HEADERS.join("  ·  ")}
              </code>
            </div>
          </section>
          <input
            accept=".csv,text/csv,application/csv"
            className="sr-only"
            disabled={busy}
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            ref={fileInput}
            type="file"
          />
          <fieldset
            aria-label={t("products.import.dropTitle")}
            className={cn(
              "group rounded-2xl border border-dashed bg-muted/25 p-5 transition-[border-color,background-color,box-shadow] duration-200",
              dragging && "border-primary bg-primary/5 ring-4 ring-primary/10",
              busy && "pointer-events-none opacity-60",
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                setDragging(false);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropFile}
          >
            {file ? (
              <div className="flex items-center gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileSpreadsheetIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatFileSize(file.size, locale)} · {t("products.import.csvFile")}
                  </p>
                </div>
                <Button
                  aria-label={t("products.import.removeFile")}
                  disabled={busy}
                  onClick={() => {
                    selectFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <XIcon />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center px-4 py-4 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-200 group-hover:-translate-y-0.5">
                  <UploadCloudIcon className="size-6" />
                </div>
                <p className="mt-3 text-sm font-medium">{t("products.import.dropTitle")}</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  {t("products.import.dropDescription")}
                </p>
                <Button
                  className="mt-4"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                  type="button"
                  variant="outline"
                >
                  {t("products.import.browse")}
                </Button>
              </div>
            )}
          </fieldset>
          {report ? (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="font-medium">
                {t("products.import.summary", {
                  blocked: formatNumber(report.summary.blocked),
                  creates: formatNumber(report.summary.creates),
                  rows: formatNumber(report.summary.rows),
                  updates: formatNumber(report.summary.updates),
                })}
              </p>
              {report.issues.length ? (
                <ul className="max-h-64 space-y-1 overflow-y-auto text-sm text-destructive">
                  {report.issues.map((issue, index) => (
                    <li key={`${issue.row}:${issue.code}:${index}`}>
                      {t("products.import.issue", {
                        code: issue.code,
                        message: issue.message,
                        row: formatNumber(issue.row),
                      })}
                    </li>
                  ))}
                </ul>
              ) : report.artifact ? (
                <div className="space-y-1 text-sm">
                  <p className="text-emerald-700">{t("products.import.ready")}</p>
                  <p className="text-muted-foreground">
                    {t("products.import.reviewed", {
                      digest: report.artifact.contentDigest.slice(0, 12),
                      expires: new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(report.artifact.expiresAt)),
                      products: formatNumber(report.artifact.summary.products),
                    })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-destructive">{t("products.import.reviewUnavailable")}</p>
              )}
            </div>
          ) : null}
        </div>
        <DialogFooter className="m-0 rounded-b-xl" showCloseButton={!busy}>
          {report?.artifact && report.issues.length === 0 ? (
            <Button disabled={busy || artifactExpired} onClick={() => void apply()}>
              {applying ? t("products.import.applying") : t("products.import.apply")}
            </Button>
          ) : null}
          <Button
            disabled={!file || busy}
            onClick={() => void run()}
            variant={report ? "outline" : "default"}
          >
            {running ? t("products.import.running") : t("products.import.run")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
}

function formatFileSize(bytes: number, locale: string) {
  if (bytes < 1024) return `${new Intl.NumberFormat(locale).format(bytes)} B`;
  if (bytes < 1024 * 1024) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
