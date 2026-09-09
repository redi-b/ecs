"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { OperationsActionDialog } from "@/components/operations-action-dialog";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { beginReauthentication } from "@/lib/reauthentication";

export function WorkRecoveryAction({
  attemptId,
  merchantName,
}: {
  attemptId: string;
  merchantName: string;
}) {
  const router = useRouter();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function recover() {
    setBusy(true);
    try {
      const response = await fetch(`/api/work/${encodeURIComponent(attemptId)}/recover`, {
        body: JSON.stringify({ reason: reason.trim() }),
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "POST",
      }).catch(() => null);
      const data = (await response?.json().catch(() => ({}))) as { error?: string };
      if (!response?.ok) {
        if (beginReauthentication(data.error)) return;
        toast.error(
          data.error === "recovery_not_available"
            ? "This setup attempt is no longer available for recovery."
            : "Shop recovery could not be completed.",
        );
        return;
      }
      setOpen(false);
      setReason("");
      toast.success("Shop setup recovered.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <OperationsActionDialog
      description={`Retry the failed setup for ${merchantName} using the original owner and template selection.`}
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={busy} variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button disabled={busy || reason.trim().length < 10} onClick={() => void recover()}>
            {busy ? "Recovering…" : "Start recovery"}
          </Button>
        </>
      }
      onOpenChange={setOpen}
      open={open}
      title="Recover shop setup"
      trigger={
        <Button size="sm" variant="outline">
          <RotateCcw aria-hidden data-icon="inline-start" /> Recover
        </Button>
      }
    >
      <Field>
        <FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
        <Textarea
          id={reasonId}
          onChange={(event) => setReason(event.target.value)}
          placeholder="What was checked or changed before this retry?"
          rows={4}
          value={reason}
        />
        <FieldDescription>This reason is saved with the recovery result.</FieldDescription>
      </Field>
    </OperationsActionDialog>
  );
}
