"use client";

import type {
  MerchantOrder,
  MerchantSalesDocument,
  MerchantSalesDocumentKind,
} from "@ecs/contracts";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
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

export function SalesDocuments({
  action,
  documents,
  order,
}: {
  action: string;
  documents: MerchantSalesDocument[];
  order: MerchantOrder;
}) {
  const { formatDateTime, locale, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [kind, setKind] = useState<MerchantSalesDocumentKind>("order_summary");
  const [language, setLanguage] = useState<"en" | "am">(locale === "am" ? "am" : "en");
  const replay = useRef<{ fingerprint: string; key: string } | null>(null);

  async function issue() {
    const fingerprint = `${kind}:${language}`;
    if (replay.current?.fingerprint !== fingerprint) {
      replay.current = { fingerprint, key: createClientId("sales-document") };
    }
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("orders.documents.optionalHint")}
        </p>
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger asChild>
            <Button className="shrink-0" size="sm" type="button" variant="outline">
              {t("orders.documents.create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("orders.documents.createTitle")}</DialogTitle>
              <DialogDescription>{t("orders.documents.createDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-1">
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
                    <SelectItem value="payment_receipt" disabled={!canIssueReceipt(order)}>
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
                <Select
                  onValueChange={(value) => setLanguage(value as "en" | "am")}
                  value={language}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="am">አማርኛ</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground ring-1 ring-border/60">
                {t("orders.documents.notTaxInvoice")}
              </p>
            </div>
            <DialogFooter>
              <Button disabled={pending} onClick={() => void issue()} type="button">
                {pending ? t("orders.documents.issuing") : t("orders.documents.issue")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("orders.documents.empty")}</p>
      ) : (
        <div className="divide-y divide-border/60 rounded-lg border border-border/70">
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
              <span className="shrink-0 font-mono text-xs tabular-nums">{document.number}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
