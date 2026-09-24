"use client";

import type { OperatorPlanCatalog } from "@ecs/contracts";
import { Check, History, Megaphone, PencilLine, Plus, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useState } from "react";
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Commercial catalog</p>
          <p className="text-sm text-muted-foreground">
            {catalog.plans.length} plans,{" "}
            {catalog.plans.filter((plan) => plan.visibility === "public").length} available for
            self-service
          </p>
        </div>
        <CreatePlanDialog catalog={catalog} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {catalog.plans.map((plan) => (
          <PlanCard catalog={catalog} key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ catalog, plan }: { catalog: OperatorPlanCatalog; plan: Plan }) {
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
              <Badge variant="outline">
                {plan.kind === "custom"
                  ? "Custom agreement"
                  : plan.visibility === "public"
                    ? "Self-service"
                    : "Private"}
              </Badge>
              {plan.presentation?.landingVisible ? (
                <Badge variant="outline">On landing site</Badge>
              ) : null}
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
          <PlanFact
            label="Free trial"
            value={formatTrial(version?.trialPolicy ?? plan.draft?.trialPolicy)}
          />
          <PlanFact
            label="Audience"
            value={
              plan.kind === "custom"
                ? "One shop"
                : plan.visibility === "public"
                  ? "All shops"
                  : "Assigned by Operations"
            }
          />
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
          <PresentationDialog plan={plan} />
          <EditPlanDialog catalog={catalog} plan={plan} />
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

function CreatePlanDialog({ catalog }: { catalog: OperatorPlanCatalog }) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [kind, setKind] = useState<"standard" | "custom">("standard");
  const [tenantId, setTenantId] = useState("");
  const [baseVersionId, setBaseVersionId] = useState("");
  const baseVersions = catalog.plans.flatMap((plan) =>
    plan.latestVersion && plan.kind === "standard"
      ? [
          {
            id: plan.latestVersion.id,
            label: `${plan.latestVersion.name}, version ${plan.latestVersion.version}`,
            plan,
          },
        ]
      : [],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const base = baseVersions.find((item) => item.id === baseVersionId)?.plan.latestVersion;
    const price = String(form.get("price") ?? base?.price ?? "0");
    const productLimit = String(form.get("productLimit") ?? "").trim();
    setPending(true);
    try {
      const response = await fetch("/api/billing/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          kind,
          tenantId: kind === "custom" ? tenantId : null,
          basePlanVersionId: kind === "custom" ? baseVersionId : null,
          visibility: kind === "custom" ? "private" : "public",
          reason: form.get("reason"),
          draft: {
            name: form.get("name"),
            price,
            currency: "ETB",
            billingInterval: "month",
            limits: productLimit ? { products: Number(productLimit) } : (base?.limits ?? {}),
            features: base?.features ?? { customDomains: false },
            trialPolicy: { enabled: false },
          },
        }),
      });
      if (!response.ok) throw new Error("plan_not_created");
      toast.success(kind === "custom" ? "Custom plan draft created" : "Plan draft created");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("The plan could not be created. Check the code and required details.");
    } finally {
      setPending(false);
    }
  }

  return (
    <OperationsActionDialog
      description="Create reusable terms for all shops or a private agreement for one shop. Nothing becomes billable until you publish it."
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={pending} variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={pending || (kind === "custom" && (!tenantId || !baseVersionId))}
            form={formId}
            type="submit"
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}Create draft
          </Button>
        </>
      }
      onOpenChange={setOpen}
      open={open}
      title="New plan"
      trigger={
        <Button>
          <Plus data-icon="inline-start" /> New plan
        </Button>
      }
    >
      <form id={formId} onSubmit={submit}>
        <FieldGroup>
          <Field>
            <FieldLabel>Plan type</FieldLabel>
            <Select value={kind} onValueChange={(value) => setKind(value as "standard" | "custom")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard plan</SelectItem>
                <SelectItem value="custom">Custom plan for one shop</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {kind === "custom" ? <TenantSearch value={tenantId} onChange={setTenantId} /> : null}
          {kind === "custom" ? (
            <Field>
              <FieldLabel>Start from</FieldLabel>
              <Select value={baseVersionId} onValueChange={setBaseVersionId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose published terms" />
                </SelectTrigger>
                <SelectContent>
                  {baseVersions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                The custom agreement copies these published terms into an independent draft.
              </FieldDescription>
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={`${formId}-name`}>Internal name</FieldLabel>
              <Input
                id={`${formId}-name`}
                name="name"
                placeholder={kind === "custom" ? "Acme negotiated plan" : "Business"}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-code`}>Stable code</FieldLabel>
              <Input
                id={`${formId}-code`}
                name="code"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="business"
                required
              />
              <FieldDescription>Lowercase letters, numbers and hyphens.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-price`}>Monthly price (ETB)</FieldLabel>
              <Input
                id={`${formId}-price`}
                inputMode="decimal"
                name="price"
                placeholder="0"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-limit`}>Product limit</FieldLabel>
              <Input id={`${formId}-limit`} min="0" name="productLimit" type="number" />
              <FieldDescription>Leave empty for no set limit.</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`${formId}-reason`}>Reason</FieldLabel>
            <Textarea
              id={`${formId}-reason`}
              minLength={10}
              name="reason"
              placeholder="Record why this plan is being created."
              required
            />
          </Field>
        </FieldGroup>
      </form>
    </OperationsActionDialog>
  );
}

function TenantSearch({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; handle?: string }>>([]);
  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/tenants?q=${encodeURIComponent(query)}&limit=6`, {
        signal: controller.signal,
      }).catch(() => null);
      const body = response?.ok ? await response.json().catch(() => null) : null;
      setResults(Array.isArray(body?.tenants) ? body.tenants : []);
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const selected = results.find((tenant) => tenant.id === value);
  return (
    <Field>
      <FieldLabel htmlFor={inputId}>Shop</FieldLabel>
      <Input
        id={inputId}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
        }}
        placeholder="Search by shop name or handle"
        value={selected ? selected.name : query}
      />
      {results.length && !value ? (
        <div className="overflow-hidden rounded-lg border">
          {results.map((tenant) => (
            <button
              className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
              key={tenant.id}
              onClick={() => {
                onChange(tenant.id);
                setQuery(tenant.name);
                setResults([]);
              }}
              type="button"
            >
              <span>{tenant.name}</span>
              <span className="text-xs text-muted-foreground">{tenant.handle}</span>
            </button>
          ))}
        </div>
      ) : null}
      <FieldDescription>
        {value ? "Shop selected" : "Custom plans are visible only to the selected shop."}
      </FieldDescription>
    </Field>
  );
}

function PresentationDialog({ plan }: { plan: Plan }) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [visibility, setVisibility] = useState(plan.visibility);
  const [landingVisible, setLandingVisible] = useState(plan.presentation?.landingVisible ?? false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch(
        `/api/billing/plans/${encodeURIComponent(plan.id)}/presentation`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            publicName: form.get("publicName"),
            summary: form.get("summary"),
            description: form.get("description"),
            featureList: String(form.get("featureList") ?? "")
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            badge: String(form.get("badge") ?? "").trim() || null,
            ctaLabel: form.get("ctaLabel"),
            displayOrder: Number(form.get("displayOrder")),
            featured: form.get("featured") === "on",
            landingVisible,
            visibility,
            reason: form.get("reason"),
          }),
        },
      );
      if (!response.ok) throw new Error("presentation_not_saved");
      toast.success("Plan presentation saved");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("The plan presentation could not be saved.");
    } finally {
      setPending(false);
    }
  }
  return (
    <OperationsActionDialog
      description="Control how this plan is offered. Marketing copy never changes entitlements or billing terms."
      footer={
        <>
          <DialogClose asChild>
            <Button disabled={pending} variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button disabled={pending} form={formId} type="submit">
            {pending ? <Spinner data-icon="inline-start" /> : null}Save presentation
          </Button>
        </>
      }
      onOpenChange={setOpen}
      open={open}
      title={`Present ${plan.name}`}
      trigger={
        <Button variant="outline">
          <Megaphone data-icon="inline-start" /> Presentation
        </Button>
      }
    >
      <form id={formId} onSubmit={submit}>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Availability</FieldLabel>
              <Select
                disabled={plan.kind === "custom"}
                value={visibility}
                onValueChange={(value) => {
                  setVisibility(value as "public" | "private");
                  if (value === "private") setLandingVisible(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Self-service</SelectItem>
                  <SelectItem value="private">Operations only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${formId}-order`}>Landing order</FieldLabel>
              <Input
                defaultValue={plan.presentation?.displayOrder ?? 0}
                id={`${formId}-order`}
                min="0"
                name="displayOrder"
                required
                type="number"
              />
            </Field>
          </div>
          <label className="flex items-start gap-3 rounded-xl border p-3">
            <input
              checked={landingVisible}
              className="mt-1 size-4 accent-primary"
              disabled={plan.kind === "custom" || visibility !== "public"}
              onChange={(event) => setLandingVisible(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-medium">Show on landing site</span>
              <span className="text-sm text-muted-foreground">
                Only published, self-service plans can appear publicly.
              </span>
            </span>
          </label>
          <Field>
            <FieldLabel>Public name</FieldLabel>
            <Input
              defaultValue={plan.presentation?.publicName ?? plan.name}
              name="publicName"
              required
            />
          </Field>
          <Field>
            <FieldLabel>Short summary</FieldLabel>
            <Input defaultValue={plan.presentation?.summary ?? ""} name="summary" />
          </Field>
          <Field>
            <FieldLabel>Description</FieldLabel>
            <Textarea defaultValue={plan.presentation?.description ?? ""} name="description" />
          </Field>
          <Field>
            <FieldLabel>Feature list</FieldLabel>
            <Textarea
              defaultValue={readStringList(plan.presentation?.featureList).join("\n")}
              name="featureList"
              placeholder={"One customer-facing benefit per line"}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Badge</FieldLabel>
              <Input
                defaultValue={plan.presentation?.badge ?? ""}
                name="badge"
                placeholder="Most popular"
              />
            </Field>
            <Field>
              <FieldLabel>Button label</FieldLabel>
              <Input
                defaultValue={plan.presentation?.ctaLabel ?? "Choose plan"}
                name="ctaLabel"
                required
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              defaultChecked={plan.presentation?.featured ?? false}
              name="featured"
              type="checkbox"
            />{" "}
            Feature this plan
          </label>
          <Field>
            <FieldLabel>Reason</FieldLabel>
            <Textarea
              minLength={10}
              name="reason"
              placeholder="Record why this public presentation is changing."
              required
            />
          </Field>
        </FieldGroup>
      </form>
    </OperationsActionDialog>
  );
}

function EditPlanDialog({ catalog, plan }: { catalog: OperatorPlanCatalog; plan: Plan }) {
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
  const initialTrial = source?.trialPolicy;
  const [trialEnabled, setTrialEnabled] = useState(initialTrial?.enabled === true);
  const [trialActivation, setTrialActivation] = useState(
    initialTrial?.enabled ? initialTrial.activation : "manual",
  );
  const freeVersions = catalog.plans.flatMap((candidate) => {
    const version = candidate.latestVersion;
    return version && Number(version.price) === 0
      ? [{ id: version.id, label: `${version.name}, version ${version.version}` }]
      : [];
  });
  const [fallbackVersionId, setFallbackVersionId] = useState(
    initialTrial?.enabled ? initialTrial.fallbackPlanVersionId : (freeVersions[0]?.id ?? ""),
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
          trialPolicy: trialEnabled
            ? {
                enabled: true,
                activation: trialActivation,
                durationDays: Number(form.get("trialDurationDays")),
                eligibilityScope: "tenant",
                fallbackPlanVersionId: fallbackVersionId,
                paymentMethodRequired: false,
              }
            : { enabled: false },
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
          <div className="rounded-xl border p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                checked={trialEnabled}
                className="mt-1 size-4 accent-primary"
                onChange={(event) => setTrialEnabled(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-medium">Offer a free trial</span>
                <span className="block text-sm text-muted-foreground">
                  The shop returns to the selected free plan if the trial ends without payment.
                </span>
              </span>
            </label>
            {trialEnabled ? (
              <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`trial-days-${plan.id}`}>Trial length in days</FieldLabel>
                  <Input
                    defaultValue={initialTrial?.enabled ? initialTrial.durationDays : 14}
                    id={`trial-days-${plan.id}`}
                    max="365"
                    min="1"
                    name="trialDurationDays"
                    required
                    type="number"
                  />
                </Field>
                <Field>
                  <FieldLabel>How the trial starts</FieldLabel>
                  <Select
                    value={trialActivation}
                    onValueChange={(value) => setTrialActivation(value as "automatic" | "manual")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Shop chooses to start</SelectItem>
                      <SelectItem value="automatic">Starts during onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel>Plan after the trial</FieldLabel>
                  <Select value={fallbackVersionId} onValueChange={setFallbackVersionId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a free plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {freeVersions.map((version) => (
                        <SelectItem key={version.id} value={version.id}>
                          {version.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    This fallback is pinned when the trial starts, so later catalog edits cannot
                    change the outcome.
                  </FieldDescription>
                </Field>
              </div>
            ) : null}
          </div>
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

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function formatTrial(policy: NonNullable<Plan["latestVersion"]>["trialPolicy"] | undefined) {
  return policy?.enabled ? `${policy.durationDays} days, ${policy.activation}` : "Not offered";
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
