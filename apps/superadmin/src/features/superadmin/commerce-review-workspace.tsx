"use client";

import type { SuperadminCommerceReview } from "@ecs/contracts";
import { Banknote, CreditCard, FileCheck2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { beginReauthentication } from "@/lib/reauthentication";

export function CommerceReviewWorkspace({
  canReviewPayments,
  canUpdateInvoices,
  review,
  tenantId,
}: {
  canReviewPayments: boolean;
  canUpdateInvoices: boolean;
  review: SuperadminCommerceReview;
  tenantId: string;
}) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      {review.billing ? (
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Billing</CardTitle>
                <CardDescription className="mt-1">
                  Current plan and invoice decisions for this merchant.
                </CardDescription>
              </div>
              <Badge variant="outline">{formatStatus(review.billing.subscriptionStatus)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Summary label="Plan" value={review.billing.planName} />
              <Summary label="Billing" value={formatStatus(review.billing.billingCycle)} />
              <Summary
                label="Period ends"
                value={
                  review.billing.currentPeriodEnd
                    ? formatDate(review.billing.currentPeriodEnd)
                    : "Not set"
                }
              />
            </dl>
            <div className="space-y-3 border-t pt-5">
              <h3 className="text-sm font-medium">Invoices</h3>
              {review.billing.invoices.length ? (
                review.billing.invoices.map((invoice) => (
                  <div className="rounded-xl border p-4" key={invoice.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold tabular-nums">
                          {formatMoney(invoice.amount, invoice.currency)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {invoice.dueAt
                            ? `Due ${formatDate(invoice.dueAt)}`
                            : `Created ${formatDate(invoice.createdAt)}`}
                        </p>
                      </div>
                      <Badge variant={invoiceStatusVariant(invoice.status)}>
                        {formatStatus(invoice.status)}
                      </Badge>
                    </div>
                    {invoice.providerReference ? (
                      <p
                        className="mt-3 truncate font-mono text-[11px] text-muted-foreground"
                        title={invoice.providerReference}
                      >
                        {invoice.providerReference}
                      </p>
                    ) : null}
                    {canUpdateInvoices && invoice.status === "pending" ? (
                      <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                        <InvoiceAction invoice={invoice} mode="paid" tenantId={tenantId} />
                        <InvoiceAction invoice={invoice} mode="void" tenantId={tenantId} />
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No invoices have been issued.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {review.paymentOnboarding ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Payment setup</CardTitle>
            <CardDescription className="mt-1">
              Review merchant requests to accept online payments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {review.paymentOnboarding.length ? (
              review.paymentOnboarding.map((payment) => (
                <div className="rounded-xl border p-4" key={payment.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                        <CreditCard aria-hidden className="size-4" />
                      </span>
                      <div>
                        <p className="font-medium">{formatProvider(payment.provider)}</p>
                        <p className="text-xs text-muted-foreground">Online payment provider</p>
                      </div>
                    </div>
                    <Badge variant={paymentStatusVariant(payment.status)}>
                      {formatPaymentStatus(payment.status)}
                    </Badge>
                  </div>
                  {payment.requiredDocuments.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {payment.requiredDocuments.map((document) => (
                        <Badge key={document} variant="outline">
                          <FileCheck2 aria-hidden /> {formatStatus(document)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No supporting documents listed.
                    </p>
                  )}
                  {payment.notes ? (
                    <p className="mt-4 text-sm text-muted-foreground">{payment.notes}</p>
                  ) : null}
                  {canReviewPayments && payment.status === "pending_review" ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                      <PaymentReviewAction
                        payment={payment}
                        status="approved"
                        tenantId={tenantId}
                      />
                      <PaymentReviewAction
                        payment={payment}
                        status="needs_review"
                        tenantId={tenantId}
                      />
                      <PaymentReviewAction
                        payment={payment}
                        status="rejected"
                        tenantId={tenantId}
                      />
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No payment setup requests.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function InvoiceAction({
  invoice,
  mode,
  tenantId,
}: {
  invoice: NonNullable<SuperadminCommerceReview["billing"]>["invoices"][number];
  mode: "paid" | "void";
  tenantId: string;
}) {
  const router = useRouter();
  const reasonId = useId();
  const referenceId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const paid = mode === "paid";

  async function submit() {
    setBusy(true);
    try {
      const response = await postReview(
        `/api/tenants/${encodeURIComponent(tenantId)}/billing/invoices/${encodeURIComponent(invoice.id)}/status`,
        {
          status: mode,
          reason: reason.trim(),
          ...(paid ? { provider: "manual", providerReference: reference.trim() } : {}),
        },
      );
      if (!response.ok) {
        if (beginReauthentication(response.error)) return;
        if (response.error === "billing_invoice_status_invalid") router.refresh();
        toast.error(invoiceError(response.error));
        return;
      }
      setOpen(false);
      setReason("");
      setReference("");
      toast.success(paid ? "Invoice payment confirmed." : "Invoice voided.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant={paid ? "default" : "destructive-outline"}>
          {paid ? <Banknote aria-hidden /> : null}
          {paid ? "Confirm payment" : "Void invoice"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{paid ? "Confirm this payment?" : "Void this invoice?"}</DialogTitle>
          <DialogDescription>
            {paid
              ? "This marks the invoice paid and activates or extends the merchant’s subscription period. Confirm the external payment evidence first."
              : "This permanently closes the pending invoice without activating the related plan period."}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border bg-muted/35 p-4">
          <p className="text-xs text-muted-foreground">Invoice total</p>
          <p className="mt-1 font-semibold tabular-nums">
            {formatMoney(invoice.amount, invoice.currency)}
          </p>
        </div>
        {paid ? (
          <Field>
            <FieldLabel htmlFor={referenceId}>Payment reference</FieldLabel>
            <Input
              id={referenceId}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Bank receipt or transfer reference"
              value={reference}
            />
            <FieldDescription>
              Use the reference from the verified external payment.
            </FieldDescription>
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
          <Textarea
            id={reasonId}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              paid ? "How was this payment verified?" : "Why should this invoice be closed?"
            }
            rows={3}
            value={reason}
          />
          <FieldDescription>Saved with the invoice decision.</FieldDescription>
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={busy} variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={busy || reason.trim().length < 10 || (paid && !reference.trim())}
            onClick={() => void submit()}
            variant={paid ? "default" : "destructive-solid"}
          >
            {busy ? "Saving decision…" : paid ? "Confirm payment" : "Void invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentReviewAction({
  payment,
  status,
  tenantId,
}: {
  payment: NonNullable<SuperadminCommerceReview["paymentOnboarding"]>[number];
  status: "approved" | "needs_review" | "rejected";
  tenantId: string;
}) {
  const router = useRouter();
  const reasonId = useId();
  const accountId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [accountRef, setAccountRef] = useState(payment.providerAccountRef ?? "");
  const [busy, setBusy] = useState(false);
  const label =
    status === "approved" ? "Approve" : status === "needs_review" ? "Request changes" : "Reject";

  async function submit() {
    setBusy(true);
    try {
      const response = await postReview(
        `/api/tenants/${encodeURIComponent(tenantId)}/payments/onboarding/${encodeURIComponent(payment.id)}/review`,
        {
          status,
          reason: reason.trim(),
          ...(accountRef.trim() ? { providerAccountRef: accountRef.trim() } : {}),
        },
      );
      if (!response.ok) {
        if (beginReauthentication(response.error)) return;
        if (response.error === "payment_onboarding_status_invalid") router.refresh();
        toast.error(paymentError(response.error));
        return;
      }
      setOpen(false);
      setReason("");
      toast.success(
        status === "approved"
          ? "Payment setup approved."
          : status === "needs_review"
            ? "Changes requested."
            : "Payment setup rejected.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={
            status === "rejected"
              ? "destructive-outline"
              : status === "approved"
                ? "default"
                : "outline"
          }
        >
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {label} {formatProvider(payment.provider)} setup?
          </DialogTitle>
          <DialogDescription>{paymentImpact(status)}</DialogDescription>
        </DialogHeader>
        {status === "approved" ? (
          <Field>
            <FieldLabel htmlFor={accountId}>Provider account reference</FieldLabel>
            <Input
              id={accountId}
              onChange={(event) => setAccountRef(event.target.value)}
              placeholder="Optional provider account reference"
              value={accountRef}
            />
            <FieldDescription>Do not enter secret credentials.</FieldDescription>
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
          <Textarea
            id={reasonId}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Record the evidence and decision…"
            rows={4}
            value={reason}
          />
          <FieldDescription>Saved with the review result.</FieldDescription>
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={busy} variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={busy || reason.trim().length < 10}
            onClick={() => void submit()}
            variant={status === "rejected" ? "destructive-solid" : "default"}
          >
            {busy ? "Saving review…" : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function postReview(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { accept: "application/json", "content-type": "application/json" },
    method: "POST",
  }).catch(() => null);
  const data = (await response?.json().catch(() => ({}))) as { error?: string };
  return { ok: Boolean(response?.ok), error: data.error };
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString("en-ET", { maximumFractionDigits: 2 }) : amount}`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", { dateStyle: "medium" }).format(new Date(value));
}
function formatStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatProvider(value: string) {
  return value.toLowerCase() === "chapa" ? "Chapa" : formatStatus(value);
}
function formatPaymentStatus(value: string) {
  return (
    (
      {
        pending_review: "Ready for review",
        needs_review: "Changes requested",
        approved: "Approved",
        rejected: "Rejected",
      } as Record<string, string>
    )[value] ?? formatStatus(value)
  );
}
function invoiceStatusVariant(value: string): "destructive" | "outline" | "success" | "warning" {
  return value === "paid"
    ? "success"
    : value === "pending"
      ? "warning"
      : value === "void" || value === "cancelled"
        ? "destructive"
        : "outline";
}
function paymentStatusVariant(value: string): "destructive" | "outline" | "success" | "warning" {
  return value === "approved"
    ? "success"
    : value === "pending_review" || value === "needs_review"
      ? "warning"
      : value === "rejected"
        ? "destructive"
        : "outline";
}
function paymentImpact(status: "approved" | "needs_review" | "rejected") {
  return status === "approved"
    ? "This accepts the merchant’s payment setup review. It does not expose or change their secret credentials."
    : status === "needs_review"
      ? "The merchant will need to correct or provide more information before approval."
      : "This closes the current request as rejected. The merchant can submit a new request later.";
}
function invoiceError(error: string | undefined) {
  return error === "billing_invoice_status_invalid"
    ? "This invoice changed and has been reloaded."
    : error === "operator_forbidden"
      ? "Your operator access no longer allows invoice decisions."
      : "The invoice decision could not be saved.";
}
function paymentError(error: string | undefined) {
  return error === "payment_onboarding_status_invalid"
    ? "This payment request changed and has been reloaded."
    : error === "operator_forbidden"
      ? "Your operator access no longer allows payment reviews."
      : "The payment review could not be saved.";
}
