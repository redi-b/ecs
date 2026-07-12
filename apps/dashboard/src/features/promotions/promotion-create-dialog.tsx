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

const emptyForm = {
  code: "",
  currencyCode: "ETB",
  endsAt: "",
  method: "percentage" as "percentage" | "fixed",
  startsAt: "",
  status: "active" as "active" | "inactive" | "draft",
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
        ...form,
        currencyCode: form.method === "fixed" ? form.currencyCode : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
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
            Configure a code, value, availability, and a safe redemption limit.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field className="sm:col-span-2">
              <FieldLabel>Promotion code</FieldLabel>
              <Input
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME10"
                required
                value={form.code}
              />
              <FieldDescription>Customers enter this code at checkout.</FieldDescription>
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
