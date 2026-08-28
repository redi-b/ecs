"use client";

import type { SuperadminSupportAccess } from "@ecs/contracts";
import { ExternalLink } from "lucide-react";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { beginReauthentication } from "@/lib/reauthentication";

const MIN_ACCESS_MS = 15 * 60_000;
const MIN_INPUT_ACCESS_MS = 16 * 60_000;
const MAX_ACCESS_MS = 8 * 60 * 60_000;

export function SupportAccessControl({
  canManage,
  currentOperatorUserId,
  dashboardUrl,
  grants,
  tenantId,
}: {
  canManage: boolean;
  currentOperatorUserId: string;
  dashboardUrl: string | null;
  grants: SuperadminSupportAccess["grants"];
  tenantId: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const active = grants.filter(
    (grant) => !grant.revokedAt && new Date(grant.expiresAt).getTime() > Date.now(),
  );
  const currentOperatorAccess = active.find(
    (grant) => grant.operatorUserId === currentOperatorUserId,
  );
  const expiryError = getExpiryError(expiresAt);

  async function grantAccess() {
    if (expiryError || reason.trim().length < 10) return;
    setBusy(true);
    try {
      const response = await changeSupportAccess(tenantId, "POST", {
        expiresAt: new Date(expiresAt).toISOString(),
        reason: reason.trim(),
      });
      if (!response.ok) {
        if (beginReauthentication(response.error)) return;
        toast.error(getAccessError(response.error));
        return;
      }
      setExpiresAt("");
      setReason("");
      toast.success("Temporary support access granted.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-warning/35">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Temporary dashboard access</CardTitle>
            <CardDescription>
              Open the merchant dashboard with your named operator identity for 15 minutes to 8
              hours. The merchant sees a persistent support banner and your actions remain
              attributed to you.
            </CardDescription>
          </div>
          <Badge variant={active.length ? "warning" : "secondary"}>{active.length} active</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {currentOperatorAccess && dashboardUrl ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/35 p-4">
            <div>
              <p className="text-sm font-medium">Your access is active</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ends {new Date(currentOperatorAccess.expiresAt).toLocaleString()}. Keep this page
                open if you may need to end access early.
              </p>
            </div>
            <Button asChild>
              <a href={dashboardUrl} rel="noreferrer" target="_blank">
                Open merchant dashboard <ExternalLink aria-hidden data-icon="inline-end" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          </div>
        ) : null}
        {canManage ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(expiryError) || undefined}>
                <FieldLabel htmlFor={`support-access-expiry-${tenantId}`}>Access ends</FieldLabel>
                <Input
                  aria-invalid={Boolean(expiryError) || undefined}
                  id={`support-access-expiry-${tenantId}`}
                  max={toLocalDateTime(new Date(Date.now() + MAX_ACCESS_MS))}
                  min={toLocalDateTime(new Date(Date.now() + MIN_INPUT_ACCESS_MS))}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  type="datetime-local"
                  value={expiresAt}
                />
                {expiryError ? <FieldError>{expiryError}</FieldError> : null}
                <FieldDescription>Permanent access is not available.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`support-access-reason-${tenantId}`}>Reason</FieldLabel>
                <Input
                  id={`support-access-reason-${tenantId}`}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Investigating support case ECS-…"
                  value={reason}
                />
                <FieldDescription>Do not include customer details or credentials.</FieldDescription>
              </Field>
            </div>
            <Button
              disabled={busy || !expiresAt || Boolean(expiryError) || reason.trim().length < 10}
              onClick={() => void grantAccess()}
              type="button"
            >
              {busy ? "Granting access…" : "Grant my temporary access"}
            </Button>
          </>
        ) : null}

        <div className="space-y-3 border-t pt-5">
          <h3 className="text-sm font-medium">Active access</h3>
          {active.length ? (
            active.map((grant) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                key={grant.id}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">ECS operator access</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ends {new Date(grant.expiresAt).toLocaleString()}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                    {grant.operatorUserId}
                  </p>
                </div>
                {canManage ? (
                  <RevokeAccessAction
                    expiresAt={grant.expiresAt}
                    grantId={grant.id}
                    tenantId={tenantId}
                  />
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No operator currently has access.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RevokeAccessAction({
  expiresAt,
  grantId,
  tenantId,
}: {
  expiresAt: string;
  grantId: string;
  tenantId: string;
}) {
  const router = useRouter();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function revoke() {
    setBusy(true);
    try {
      const response = await changeSupportAccess(tenantId, "DELETE", {
        grantId,
        reason: reason.trim(),
      });
      if (!response.ok) {
        if (beginReauthentication(response.error)) return;
        toast.error(getAccessError(response.error));
        return;
      }
      setOpen(false);
      setReason("");
      toast.success("Support access revoked.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive-outline">
          Revoke access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke support access?</DialogTitle>
          <DialogDescription>
            This operator will immediately lose merchant dashboard access that currently ends{" "}
            {new Date(expiresAt).toLocaleString()}.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
          <Textarea
            id={reasonId}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this access ending early?"
            rows={3}
            value={reason}
          />
          <FieldDescription>Saved with the revocation record.</FieldDescription>
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={busy} variant="outline">
              Keep access
            </Button>
          </DialogClose>
          <Button
            disabled={busy || reason.trim().length < 10}
            onClick={() => void revoke()}
            variant="destructive-solid"
          >
            {busy ? "Revoking access…" : "Revoke access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function changeSupportAccess(
  tenantId: string,
  method: "DELETE" | "POST",
  body: Record<string, string>,
) {
  const response = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/support-access`, {
    body: JSON.stringify(body),
    headers: { accept: "application/json", "content-type": "application/json" },
    method,
  }).catch(() => null);
  const data = (await response?.json().catch(() => ({}))) as { error?: string };
  return { ok: Boolean(response?.ok), error: data.error };
}

function getAccessError(error: string | undefined) {
  if (error === "operator_forbidden") {
    return "Your operator access no longer allows support-access changes.";
  }
  if (error === "support_access_expiry_invalid") {
    return "Choose an end time between 15 minutes and 8 hours from now.";
  }
  return "Support access could not be changed.";
}

function getExpiryError(value: string) {
  if (!value) return null;
  const expiresAt = Date.parse(value);
  const duration = expiresAt - Date.now();
  if (!Number.isFinite(expiresAt) || duration < MIN_ACCESS_MS || duration > MAX_ACCESS_MS) {
    return "Choose a time between 15 minutes and 8 hours from now.";
  }
  return null;
}

function toLocalDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}
