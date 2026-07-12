"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const emptyForm = {
  allocation: "across" as "each" | "across",
  code: "",
  currencyCode: "ETB",
  endsAt: "",
  isAutomatic: false,
  method: "percentage" as "percentage" | "fixed",
  promotionType: "standard" as "standard" | "buyget",
  startsAt: "",
  status: "active" as "active" | "inactive" | "draft",
  targetType: "order" as "order" | "items" | "shipping_methods",
  usageLimit: "",
  value: "",
};

export function PromotionCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function create() {
    setSaving(true);
    const response = await fetch("/admin/promotions/actions", {
      body: JSON.stringify({
        allocation: form.targetType === "items" ? form.allocation : null,
        code: form.code,
        currencyCode: form.method === "fixed" ? form.currencyCode : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        isAutomatic: form.isAutomatic,
        method: form.method,
        promotionType: form.promotionType,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        status: form.status,
        targetType: form.targetType,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        value: Number(form.value),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      toast.error("Promotion could not be created.");
      return;
    }
    toast.success("Promotion created.");
    setOpen(false);
    setForm(emptyForm);
    router.refresh();
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setForm(emptyForm);
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <AppIcons.tag data-icon="inline-start" />
          Create promotion
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>Create promotion</DialogTitle>
          <DialogDescription>
            Medusa-style promotion: code, application method, campaign schedule, and usage limit.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="max-h-[min(70dvh,36rem)] space-y-5 overflow-y-auto p-4 sm:p-5">
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-sm font-medium">Basics</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Code and lifecycle. Automatic promotions apply without a checkout code entry.
                </p>
              </div>
              <Field className="sm:col-span-2">
                <FieldLabel>Promotion code</FieldLabel>
                <Input
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="WELCOME10"
                  required
                  value={form.code}
                />
                <FieldDescription>Customers enter this code at checkout unless automatic.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select
                  onValueChange={(value: "active" | "inactive" | "draft") =>
                    setForm({ ...form, status: value })
                  }
                  value={form.status}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Promotion type</FieldLabel>
                <Select
                  onValueChange={(value: "standard" | "buyget") =>
                    setForm({ ...form, promotionType: value })
                  }
                  value={form.promotionType}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="buyget">Buy X get Y</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Buy X get Y needs product rules later; start as draft if configuring that path.
                </FieldDescription>
              </Field>
              <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3 sm:col-span-2">
                <div className="min-w-0 space-y-1">
                  <FieldLabel className="text-sm" htmlFor="promo-automatic">
                    Apply automatically
                  </FieldLabel>
                  <FieldDescription className="text-xs">
                    When on, eligible carts receive the discount without entering a code.
                  </FieldDescription>
                </div>
                <Switch
                  checked={form.isAutomatic}
                  id="promo-automatic"
                  onCheckedChange={(isAutomatic) => setForm({ ...form, isAutomatic })}
                />
              </Field>
            </section>

            <section className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-sm font-medium">Application method</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  How the discount is calculated and what it targets on the cart.
                </p>
              </div>
              <Field>
                <FieldLabel>Discount type</FieldLabel>
                <Select
                  onValueChange={(value: "percentage" | "fixed") =>
                    setForm({ ...form, method: value })
                  }
                  value={form.method}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed amount (ETB)</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>
                  {form.method === "percentage" ? "Percent off" : "Amount off (ETB)"}
                </FieldLabel>
                <Input
                  min="0.01"
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.method === "percentage" ? "10" : "50"}
                  required
                  step="0.01"
                  type="number"
                  value={form.value}
                />
              </Field>
              <Field>
                <FieldLabel>Applies to</FieldLabel>
                <Select
                  onValueChange={(value: "order" | "items" | "shipping_methods") =>
                    setForm({ ...form, targetType: value })
                  }
                  value={form.targetType}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="order">Entire order</SelectItem>
                      <SelectItem value="items">Items</SelectItem>
                      <SelectItem value="shipping_methods">Shipping</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {form.targetType === "items" ? (
                <Field>
                  <FieldLabel>Allocation</FieldLabel>
                  <Select
                    onValueChange={(value: "each" | "across") =>
                      setForm({ ...form, allocation: value })
                    }
                    value={form.allocation}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select allocation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="across">Across items</SelectItem>
                        <SelectItem value="each">Each item</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Across splits the discount; each applies the full value per matching item.
                  </FieldDescription>
                </Field>
              ) : null}
              <Field className={form.targetType === "items" ? "sm:col-span-2" : undefined}>
                <FieldLabel>Usage limit</FieldLabel>
                <Input
                  min="1"
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                  placeholder="Unlimited"
                  type="number"
                  value={form.usageLimit}
                />
                <FieldDescription>Leave empty for unlimited redemptions.</FieldDescription>
              </Field>
            </section>

            <section className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-sm font-medium">Campaign schedule</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Optional start and end dates (stored on the Medusa campaign linked to this
                  promotion).
                </p>
              </div>
              <Field>
                <FieldLabel>Starts</FieldLabel>
                <DateTimePicker
                  onChange={(startsAt) => setForm({ ...form, startsAt })}
                  placeholder="Optional start"
                  value={form.startsAt}
                />
              </Field>
              <Field>
                <FieldLabel>Ends</FieldLabel>
                <DateTimePicker
                  onChange={(endsAt) => setForm({ ...form, endsAt })}
                  placeholder="Optional end"
                  value={form.endsAt}
                />
              </Field>
            </section>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4 sm:justify-end">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? "Creating…" : "Create promotion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
