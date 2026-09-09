"use client";

import type { OperatorPlanCatalog } from "@ecs/contracts";
import { Check, History, PencilLine, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import { OperationsActionDialog } from "@/components/operations-action-dialog";
import { OperationsDataState } from "@/components/operations-data-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogClose } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type Plan = OperatorPlanCatalog["plans"][number];

export function PlanCatalogWorkspace({ catalog }: { catalog: OperatorPlanCatalog }) {
  if (!catalog.plans.length) {
    return (
      <OperationsDataState
        description="Plans will appear after the billing catalog is initialized."
        title="No plans yet"
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {catalog.plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const version = plan.latestVersion;
  const productLimit = readProductLimit(version?.limits ?? plan.limits);
  const customDomains = readBooleanFeature(version?.features ?? plan.features, "customDomains");

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{plan.name}</CardTitle>
              <Badge variant={plan.status === "active" ? "success" : "secondary"}>
                {plan.status === "active" ? "Available" : plan.status}
              </Badge>
              {plan.draft ? <Badge variant="outline">Draft r{plan.draft.revision}</Badge> : null}
            </div>
            <CardDescription className="mt-1">
              {plan.subscriptionCount} {plan.subscriptionCount === 1 ? "merchant" : "merchants"}
              {version ? ` · Published version ${version.version}` : " · Not published"}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(version?.price ?? plan.price, version?.currency ?? "ETB")}
            </p>
            <p className="text-xs text-muted-foreground">
              per {formatInterval(version?.billingInterval ?? "month")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <PlanFact
            label="Products"
            value={productLimit == null ? "No set limit" : `Up to ${productLimit}`}
          />
          <PlanFact label="Custom domains" value={customDomains ? "Included" : "Not included"} />
        </div>
        {plan.draft ? (
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-muted/25 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Draft changes</span>
              <span>Published</span>
              <span>Draft</span>
            </div>
            <PlanDifference
              label="Price"
              published={version ? formatMoney(version.price, version.currency) : "Not published"}
              draft={formatMoney(plan.draft.price, plan.draft.currency)}
            />
            <PlanDifference
              label="Products"
              published={formatProductLimit(readProductLimit(version?.limits))}
              draft={formatProductLimit(readProductLimit(plan.draft.limits))}
            />
            <PlanDifference
              label="Custom domains"
              published={
                readBooleanFeature(version?.features, "customDomains") ? "Included" : "Not included"
              }
              draft={
                readBooleanFeature(plan.draft.features, "customDomains")
                  ? "Included"
                  : "Not included"
              }
            />
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <History aria-hidden />
          {plan.versions.length} published {plan.versions.length === 1 ? "version" : "versions"}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <EditPlanDialog plan={plan} />
          {plan.draft ? <PublishPlanDialog plan={plan} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanDifference({
  draft,
  label,
  published,
}: {
  draft: string;
  label: string;
  published: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b px-3 py-2.5 text-sm last:border-0">
      <span>{label}</span>
      <span className="text-muted-foreground">{published}</span>
      <span className="font-medium">{draft}</span>
    </div>
  );
}

function formatProductLimit(value: number | null) {
  return value === null ? "No limit" : value.toLocaleString("en-ET");
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-medium">
        <Check aria-hidden className="text-primary" /> {value}
      </p>
    </div>
  );
}

function EditPlanDialog({ plan }: { plan: Plan }) {
  const router = useRouter();
  const formId = useId();
  const source = plan.draft ?? plan.latestVersion;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [customDomains, setCustomDomains] = useState(
    readBooleanFeature(source?.features ?? plan.features, "customDomains")
      ? "included"
      : "excluded",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const productLimit = String(form.get("productLimit") ?? "").trim();
    setPending(true);
    try {
      const response = await fetch(`/api/billing/plans/${encodeURIComponent(plan.id)}/draft`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          price: form.get("price"),
          currency: "ETB",
          billingInterval: "month",
          features: { customDomains: customDomains === "included" },
          limits: productLimit ? { products: Number(productLimit) } : {},
          reason: form.get("reason"),
        }),
      });
      if (!response.ok) throw new Error("draft_not_saved");
      toast.success("Plan draft saved");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("The plan draft could not be saved. Review the details and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <OperationsActionDialog
      description="Save a draft for review. Current merchant terms do not change until a version is published and assigned."
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={pending} variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button disabled={pending} form={formId} type="submit">
            {pending ? <Spinner data-icon="inline-start" /> : null}Save draft
          </Button>
        </>
      }
      onOpenChange={setOpen}
      open={open}
      title={`Edit ${plan.name}`}
      trigger={
        <Button variant="outline">
          <PencilLine data-icon="inline-start" /> Edit draft
        </Button>
      }
    >
      <form id={formId} onSubmit={submit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`plan-name-${plan.id}`}>Plan name</FieldLabel>
            <Input
              id={`plan-name-${plan.id}`}
              name="name"
              defaultValue={source?.name ?? plan.name}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`plan-price-${plan.id}`}>Monthly price (ETB)</FieldLabel>
              <Input
                id={`plan-price-${plan.id}`}
                name="price"
                inputMode="decimal"
                defaultValue={source?.price ?? plan.price}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`plan-products-${plan.id}`}>Product limit</FieldLabel>
              <Input
                id={`plan-products-${plan.id}`}
                name="productLimit"
                inputMode="numeric"
                min="0"
                type="number"
                defaultValue={readProductLimit(source?.limits ?? plan.limits) ?? ""}
              />
              <FieldDescription>
                Leave empty when the plan has no set product limit.
              </FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel>Custom domains</FieldLabel>
            <Select value={customDomains} onValueChange={setCustomDomains}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="included">Included</SelectItem>
                  <SelectItem value="excluded">Not included</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={`plan-reason-${plan.id}`}>Reason for this draft</FieldLabel>
            <Textarea
              id={`plan-reason-${plan.id}`}
              name="reason"
              minLength={10}
              required
              placeholder="Explain the commercial change for the audit record."
            />
          </Field>
        </FieldGroup>
      </form>
    </OperationsActionDialog>
  );
}

function PublishPlanDialog({ plan }: { plan: Plan }) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch(`/api/billing/plans/${encodeURIComponent(plan.id)}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: form.get("reason") }),
      });
      if (!response.ok) throw new Error("publish_failed");
      toast.success("New plan version published");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("The plan could not be published. The draft is unchanged.");
    } finally {
      setPending(false);
    }
  }

  return (
    <OperationsActionDialog
      description="Creates an immutable version for new subscriptions. Existing merchants stay on their accepted version unless moved separately."
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={pending} variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button disabled={pending} form={formId} type="submit">
            {pending ? <Spinner data-icon="inline-start" /> : null}Publish version
          </Button>
        </>
      }
      onOpenChange={setOpen}
      open={open}
      title={`Publish ${plan.draft?.name ?? plan.name}`}
      trigger={
        <Button>
          <Rocket data-icon="inline-start" /> Review and publish
        </Button>
      }
    >
      <form id={formId} onSubmit={submit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`publish-reason-${plan.id}`}>Reason for publishing</FieldLabel>
            <Textarea
              id={`publish-reason-${plan.id}`}
              name="reason"
              minLength={10}
              required
              placeholder="Record who approved these terms and why."
            />
          </Field>
        </FieldGroup>
      </form>
    </OperationsActionDialog>
  );
}

function readProductLimit(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const products = Reflect.get(value, "products");
  return typeof products === "number" && Number.isSafeInteger(products) && products >= 0
    ? products
    : null;
}

function readBooleanFeature(value: unknown, key: string) {
  return Boolean(value && typeof value === "object" && Reflect.get(value, key) === true);
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatInterval(value: string) {
  return value === "year" ? "year" : value === "week" ? "week" : value === "day" ? "day" : "month";
}
