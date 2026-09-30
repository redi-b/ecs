"use client";

import type {
  MerchantOrder,
  MerchantSalesDocument,
  MerchantSalesDocumentKind,
} from "@ecs/contracts";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
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
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";

function kindLabel(kind: MerchantSalesDocumentKind, t: ReturnType<typeof useI18n>["t"]) {
  if (kind === "payment_receipt") return t("orders.documents.kinds.payment_receipt");
  if (kind === "packing_slip") return t("orders.documents.kinds.packing_slip");
  return t("orders.documents.kinds.order_summary");
}

function canIssueReceipt(order: MerchantOrder) {
  return (
    Boolean(order.settlement) ||
    ["captured", "paid", "partially_refunded", "refunded"].includes(order.paymentStatus ?? "")
  );
}

export function CreateSalesDocumentDialog({
  action,
  order,
}: {
  action: string;
  order: MerchantOrder;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [kind, setKind] = useState<MerchantSalesDocumentKind>("order_summary");
  const [language, setLanguage] = useState<"en" | "am">(locale === "am" ? "am" : "en");
  const replay = useRef<{ fingerprint: string; key: string } | null>(null);

  async function issue() {
    const fingerprint = `${kind}:${language}`;
    if (replay.current?.fingerprint !== fingerprint)
      replay.current = { fingerprint, key: createClientId("sales-document") };
    setPending(true);
    const response = await fetch(action, {
      body: JSON.stringify({ kind, language }),
      headers: { "content-type": "application/json", "idempotency-key": replay.current.key },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as {
      document?: MerchantSalesDocument;
      error?: string;
    };
    if (!response?.ok || !data.document) {
      toast.error(
        data.error === "payment_receipt_requires_payment"
          ? t("orders.documents.paymentRequired")
          : t("orders.documents.issueFailed"),
      );
      setPending(false);
      return;
    }
    replay.current = null;
    setPending(false);
    setOpen(false);
    toast.success(t("orders.documents.issued", { number: data.document.number }));
    router.refresh();
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="shrink-0" size="sm" type="button" variant="outline">
          <AppIcons.add data-icon="inline-start" />
          {t("orders.documents.create")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-visible p-0 sm:max-w-md">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 pr-12 text-left sm:px-5">
          <DialogTitle>{t("orders.documents.createTitle")}</DialogTitle>
          <DialogDescription>{t("orders.documents.createDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-5">
          <Field>
            <FieldLabel>{t("orders.documents.kind")}</FieldLabel>
            <Select
              onValueChange={(value) => setKind(value as MerchantSalesDocumentKind)}
              value={kind}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order_summary">
                  {t("orders.documents.kinds.order_summary")}
                </SelectItem>
                <SelectItem disabled={!canIssueReceipt(order)} value="payment_receipt">
                  {t("orders.documents.kinds.payment_receipt")}
                </SelectItem>
                <SelectItem value="packing_slip">
                  {t("orders.documents.kinds.packing_slip")}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>{t("orders.documents.language")}</FieldLabel>
            <Select onValueChange={(value) => setLanguage(value as "en" | "am")} value={language}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="am">አማርኛ</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t bg-muted/50 p-4">
          <Button disabled={pending} onClick={() => void issue()} type="button">
            {pending ? t("orders.documents.issuing") : t("orders.documents.issue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SalesDocuments({ documents }: { documents: MerchantSalesDocument[] }) {
  const { formatDateTime, t } = useI18n();
  return documents.length === 0 ? (
    <p className="text-sm text-muted-foreground">{t("orders.documents.empty")}</p>
  ) : (
    <div className="max-h-72 divide-y divide-border/60 overflow-y-auto overscroll-contain rounded-lg border border-border/70">
      {documents.map((document) => (
        <Link
          className="flex min-h-11 items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={`/dashboard/orders/documents/${encodeURIComponent(document.id)}`}
          key={document.id}
        >
          <span className="min-w-0">
            <span className="block font-medium">{kindLabel(document.kind, t)}</span>
            <span className="block text-xs text-muted-foreground">
              {formatDateTime(document.createdAt)}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums">
            {document.number}
            <AppIcons.arrowRight className="size-3.5 text-muted-foreground" />
          </span>
        </Link>
      ))}
    </div>
  );
}
