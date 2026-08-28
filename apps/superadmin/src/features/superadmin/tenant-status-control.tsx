"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { beginReauthentication } from "@/lib/reauthentication";

export function TenantStatusControl({ status, tenantId }: { status: string; tenantId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const target = status === "suspended" ? "active" : "suspended";
  const suspending = target === "suspended";

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/status`, {
        body: JSON.stringify({ reason: reason.trim(), status: target }),
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "POST",
      }).catch(() => null);
      const data = (await response?.json().catch(() => ({}))) as { error?: string };
      if (!response?.ok) {
        if (beginReauthentication(data.error)) return;
        if (data.error === "tenant_status_invalid") {
          toast.error("This merchant’s status changed. The current status has been reloaded.");
          setConfirming(false);
          router.refresh();
          return;
        }
        toast.error(
          data.error === "operator_forbidden"
            ? "Your operator access no longer allows merchant-status changes."
            : "Merchant status could not be changed.",
        );
        return;
      }
      toast.success(suspending ? "Merchant suspended." : "Merchant restored.");
      setReason("");
      setConfirming(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={suspending ? "border-destructive/30" : undefined}>
      <CardHeader>
        <CardTitle>{suspending ? "Suspend merchant" : "Restore merchant"}</CardTitle>
        <CardDescription>
          {suspending
            ? "Immediately blocks storefront access. Billing and merchant data are preserved."
            : "Restores normal access using the merchant's existing configuration."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field>
          <FieldLabel htmlFor={`status-reason-${tenantId}`}>Required reason</FieldLabel>
          <Input
            id={`status-reason-${tenantId}`}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              suspending
                ? "Policy violation confirmed in support case…"
                : "Issue resolved and access approved…"
            }
            value={reason}
          />
          <FieldDescription>
            Saved with the status change for future operational review.
          </FieldDescription>
        </Field>
        <Button
          disabled={busy || reason.trim().length < 10}
          onClick={() => setConfirming(true)}
          type="button"
          variant={suspending ? "destructive" : "default"}
        >
          {suspending ? "Review suspension" : "Review restoration"}
        </Button>
      </CardContent>
      <Dialog onOpenChange={setConfirming} open={confirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {suspending ? "Suspend this merchant?" : "Restore this merchant?"}
            </DialogTitle>
            <DialogDescription>
              {suspending
                ? "The storefront and merchant dashboard will become unavailable immediately. Existing merchant data and billing records will be preserved."
                : "The merchant dashboard and storefront will become available again using the existing shop configuration."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/35 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reason
            </p>
            <p className="mt-1 break-words text-sm">{reason.trim()}</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={busy} variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              disabled={busy}
              onClick={() => void submit()}
              variant={suspending ? "destructive-solid" : "default"}
            >
              {busy
                ? suspending
                  ? "Suspending…"
                  : "Restoring…"
                : suspending
                  ? "Suspend merchant"
                  : "Restore merchant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
