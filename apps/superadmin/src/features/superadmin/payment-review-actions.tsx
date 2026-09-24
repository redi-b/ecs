"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { OperationsActionDialog } from "@/components/operations-action-dialog";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { beginReauthentication } from "@/lib/reauthentication";

export function PaymentReviewActions({
  invoiceId,
  provider,
  reference,
  tenantId,
}: {
  invoiceId: string;
  provider: string;
  reference: string;
  tenantId: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <ReviewAction
        invoiceId={invoiceId}
        mode="paid"
        provider={provider}
        reference={reference}
        tenantId={tenantId}
      />
      <ReviewAction
        invoiceId={invoiceId}
        mode="evidence_rejected"
        provider={provider}
        reference={reference}
        tenantId={tenantId}
      />
    </div>
  );
}

function ReviewAction({
  invoiceId,
  mode,
  provider,
  reference,
  tenantId,
}: {
  invoiceId: string;
  mode: "evidence_rejected" | "paid";
  provider: string;
  reference: string;
  tenantId: string;
}) {
  const router = useRouter();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const approving = mode === "paid";

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/billing/invoices/${encodeURIComponent(invoiceId)}/status`,
        {
          body: JSON.stringify({
            status: mode,
            reason: reason.trim(),
            ...(approving ? { provider, providerReference: reference } : {}),
          }),
          headers: { accept: "application/json", "content-type": "application/json" },
          method: "POST",
        },
      ).catch(() => null);
      const data = (await response?.json().catch(() => ({}))) as { error?: string };
      if (!response?.ok) {
        if (beginReauthentication(data.error)) return;
        toast.error("The payment decision could not be saved.");
        return;
      }
      setOpen(false);
      setReason("");
      toast.success(approving ? "Payment confirmed." : "Evidence rejected. The invoice remains open.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const label = approving ? "Confirm" : "Reject";
  return (
    <OperationsActionDialog
      description={
        approving
          ? "Confirm only after the amount, recipient, and receipt match. This activates the merchant plan."
          : "Explain what is wrong. The merchant can correct the evidence and submit it again."
      }
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={busy} variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={busy || reason.trim().length < 10}
            onClick={() => void submit()}
            variant={approving ? "default" : "destructive-solid"}
          >
            {busy ? "Saving…" : label}
          </Button>
        </>
      }
      onOpenChange={setOpen}
      open={open}
      title={approving ? "Confirm this payment?" : "Reject this evidence?"}
      trigger={<Button size="sm" variant={approving ? "default" : "destructive-outline"}>{label}</Button>}
    >
      <Field>
        <FieldLabel htmlFor={reasonId}>Review note</FieldLabel>
        <Textarea
          id={reasonId}
          onChange={(event) => setReason(event.target.value)}
          placeholder={approving ? "How the payment was verified" : "What the merchant needs to correct"}
          rows={4}
          value={reason}
        />
        <FieldDescription>Saved in the audit trail. Rejection notes are shown to the merchant.</FieldDescription>
      </Field>
    </OperationsActionDialog>
  );
}
