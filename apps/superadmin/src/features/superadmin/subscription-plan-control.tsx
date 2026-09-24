"use client";

import type { OperatorPlanCatalog } from "@ecs/contracts";
import { ArrowRightLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export function SubscriptionPlanControl({
  catalog,
  currentPlanName,
  currentPlanVersionId,
  tenantId,
}: {
  catalog: OperatorPlanCatalog;
  currentPlanName: string | null;
  currentPlanVersionId: string | null;
  tenantId: string;
}) {
  const choices = useMemo(
    () =>
      catalog.plans.flatMap((plan) =>
        plan.versions.map((version) => ({
          id: version.id,
          label: `${plan.name} · version ${version.version} · ${formatMoney(version.price, version.currency)}`,
          planName: plan.name,
          version: version.version,
        })),
      ),
    [catalog],
  );
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const selected = choices.find((choice) => choice.id === selectedId) ?? null;
  const hasAlternative = choices.some((choice) => choice.id !== currentPlanVersionId);
  const router = useRouter();

  async function submit() {
    if (pending || !selected || selected.id === currentPlanVersionId) return;
    setPending(true);
    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/billing/plan-version`,
        {
          body: JSON.stringify({ planVersionId: selected.id, reason: reason.trim() }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(migrationError(body.error));
        return;
      }
      setOpen(false);
      setSelectedId("");
      setReason("");
      toast.success(`Merchant moved to ${selected.planName}, version ${selected.version}.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Subscription terms</CardTitle>
            <CardDescription className="mt-1">
              Move this merchant to a specific published plan version when an approved correction is
              required.
            </CardDescription>
          </div>
          <Badge variant="outline">{currentPlanName ?? "No active plan"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
        <p className="max-w-2xl text-sm text-muted-foreground">
          This changes the merchant’s access immediately. It does not issue a refund, collect a
          payment, or change existing invoices.
        </p>
        <OperationsActionDialog
          description="Choose the published plan version approved for this merchant. The change takes effect immediately and is recorded."
          footer={
            <>
              <DialogClose asChild>
                <Button disabled={pending} variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                disabled={
                  pending ||
                  !selected ||
                  selected.id === currentPlanVersionId ||
                  reason.trim().length < 10
                }
                onClick={() => void submit()}
              >
                {pending ? <Spinner data-icon="inline-start" /> : null}Apply immediately
              </Button>
            </>
          }
          onOpenChange={setOpen}
          open={open}
          title="Change subscription terms"
          trigger={
            <Button disabled={!hasAlternative} variant="outline">
              <ArrowRightLeft data-icon="inline-start" /> Change plan version
            </Button>
          }
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Published plan version</FieldLabel>
              <Select onValueChange={setSelectedId} value={selectedId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a plan version" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectGroup>
                    <SelectLabel>Available versions</SelectLabel>
                    {choices.map((choice) => (
                      <SelectItem
                        disabled={choice.id === currentPlanVersionId}
                        key={choice.id}
                        value={choice.id}
                      >
                        {choice.label}
                        {choice.id === currentPlanVersionId ? " (current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                Published versions are immutable. Drafts cannot be assigned to merchants.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`plan-migration-reason-${tenantId}`}>
                Reason for this change
              </FieldLabel>
              <Textarea
                id={`plan-migration-reason-${tenantId}`}
                minLength={10}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Record the approved correction or commercial decision."
                rows={3}
                value={reason}
              />
              <FieldDescription>Saved with the operator and selected version.</FieldDescription>
            </Field>
          </FieldGroup>
        </OperationsActionDialog>
      </CardContent>
    </Card>
  );
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en-ET", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value));
}

function migrationError(error?: string) {
  if (error === "plan_admin_subscription_unchanged")
    return "This merchant already uses that version.";
  if (error === "plan_admin_subscription_not_found")
    return "This merchant has no subscription to update.";
  if (error === "plan_admin_version_not_found")
    return "That published version is no longer available.";
  if (error === "reauthentication_required")
    return "Confirm your identity, then try this change again.";
  return "The subscription could not be changed. Review the selection and try again.";
}

import { OperationsActionDialog } from "@/components/operations-action-dialog";
