"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import type { MerchantCustomer } from "@/lib/merchant-customers";

export function CustomerFormDialog({
  customer,
  onOpenChange,
  open: openProp,
  trigger,
}: {
  customer?: MerchantCustomer | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  open?: boolean | undefined;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const id = useId();
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen;
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (open) setFormKey((value) => value + 1);
  }, [open, customer?.id]);

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  async function submit(formData: FormData) {
    setSaving(true);
    const payload = Object.fromEntries(formData);
    const response = await fetch(
      customer
        ? `/admin/customers/actions/${encodeURIComponent(customer.id)}`
        : "/admin/customers/actions",
      {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );
    setSaving(false);
    if (!response.ok) return toast.error("Customer could not be saved.");
    toast.success(customer ? "Customer updated." : "Customer created.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger !== undefined ? (
        trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : null
      ) : (
        <DialogTrigger asChild>
          <Button variant={customer ? "outline" : "default"}>
            {customer ? "Edit customer" : "Add customer"}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
          <DialogTitle>{customer ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            Keep contact information accurate for orders, support, and repeat purchases.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(data) => void submit(data)}
          className="flex flex-col"
          key={formKey}
        >
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field>
              <FieldLabel htmlFor={`${id}-first`}>First name</FieldLabel>
              <Input
                defaultValue={customer?.firstName ?? ""}
                id={`${id}-first`}
                name="firstName"
                placeholder="Abebe"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-last`}>Last name</FieldLabel>
              <Input
                defaultValue={customer?.lastName ?? ""}
                id={`${id}-last`}
                name="lastName"
                placeholder="Kebede"
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
              <Input
                defaultValue={customer?.email ?? ""}
                id={`${id}-email`}
                name="email"
                placeholder="customer@example.com"
                required
                type="email"
              />
              <FieldDescription>Used for receipts and account recovery.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-phone`}>Phone</FieldLabel>
              <Input
                defaultValue={customer?.phone ?? ""}
                id={`${id}-phone`}
                name="phone"
                placeholder="+251…"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-company`}>Company</FieldLabel>
              <Input
                defaultValue={customer?.companyName ?? ""}
                id={`${id}-company`}
                name="companyName"
                placeholder="Optional"
              />
            </Field>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? "Saving…" : customer ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
