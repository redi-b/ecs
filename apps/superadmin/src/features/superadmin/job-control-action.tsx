"use client";

import { Ban, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { OperationsActionDialog } from "@/components/operations-action-dialog";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { beginReauthentication } from "@/lib/reauthentication";

export function JobControlAction({
  action,
  jobName,
  jobRunId,
}: {
  action: "cancel" | "retry";
  jobName: string;
  jobRunId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const retry = action === "retry";

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobRunId)}/${action}`, {
        headers: { accept: "application/json" },
        method: "POST",
      }).catch(() => null);
      const data = (await response?.json().catch(() => ({}))) as { error?: string };
      if (!response?.ok) {
        if (beginReauthentication(data.error)) return;
        toast.error(
          data.error === "job_state_changed"
            ? "This job changed while you were reviewing it. Refresh and try again."
            : retry
              ? "This job cannot be retried."
              : "This job cannot be cancelled.",
        );
        return;
      }
      setOpen(false);
      toast.success(retry ? "A new job run was queued." : "The queued job was cancelled.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <OperationsActionDialog
      description={
        retry
          ? `Queue a new ${formatJobName(jobName)} run using the validated input from this failed run. The failed run remains in history.`
          : `Remove this ${formatJobName(jobName)} run before a worker starts it.`
      }
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={busy} variant="outline">
              Keep job
            </Button>
          </DialogClose>
          <Button
            disabled={busy}
            onClick={() => void submit()}
            variant={retry ? "default" : "destructive"}
          >
            {busy ? (retry ? "Queuing…" : "Cancelling…") : retry ? "Queue retry" : "Cancel job"}
          </Button>
        </>
      }
      onOpenChange={setOpen}
      open={open}
      title={retry ? "Retry failed job" : "Cancel queued job"}
      trigger={
        <Button size="sm" variant="outline">
          {retry ? (
            <RotateCcw aria-hidden data-icon="inline-start" />
          ) : (
            <Ban aria-hidden data-icon="inline-start" />
          )}
          {retry ? "Retry" : "Cancel"}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        {retry
          ? "Only jobs marked safe for manual retry can be started here."
          : "Cancellation is available only until a worker starts the job."}
      </p>
    </OperationsActionDialog>
  );
}

function formatJobName(value: string) {
  return value.replaceAll(".", " ").replaceAll("_", " ");
}
