"use client";

import type { OperatorPlanCatalog } from "@ecs/contracts";
import { ArrowRightLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const selected = choices.find((choice) => choice.id === selectedId) ?? null;
  const hasAlternative = choices.some((choice) => choice.id !== currentPlanVersionId);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !selected || selected.id === currentPlanVersionId) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/billing/plan-version`,
        {
          body: JSON.stringify({ planVersionId: selected.id, reason: form.get("reason") }),
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
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger asChild>
            <Button disabled={!hasAlternative} variant="outline">
              <ArrowRightLeft data-icon="inline-start" /> Change plan version
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={submit}>
              <DialogHeader>
                <DialogTitle>Change subscription terms</DialogTitle>
                <DialogDescription>
                  Choose the exact published version approved for this merchant. The change takes
                  effect immediately and is recorded in the audit log.
                </DialogDescription>
              </DialogHeader>
              <FieldGroup className="py-5">
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
                    name="reason"
                    placeholder="Record the approved correction or commercial decision."
                    required
                    rows={3}
                  />
                  <FieldDescription>Saved with the operator and selected version.</FieldDescription>
                </Field>
              </FieldGroup>
              <DialogFooter showCloseButton>
                <Button
                  disabled={pending || !selected || selected.id === currentPlanVersionId}
                  type="submit"
                >
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  Apply immediately
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
