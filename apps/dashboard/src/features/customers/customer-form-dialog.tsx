"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (open) {
      setFormKey((value) => value + 1);
      setError(null);
    }
  }, [open, customer?.id]);

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);

    const payload = {
      companyName: String(formData.get("companyName") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim(),
      firstName: String(formData.get("firstName") ?? "").trim() || null,
      lastName: String(formData.get("lastName") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
    };

    if (!payload.email) {
      setSaving(false);
      setError("Enter an email address.");
      return;
    }

    const response = await fetch(
      customer
        ? `/admin/customers/actions/${encodeURIComponent(customer.id)}`
        : "/admin/customers/actions",
      {
        body: JSON.stringify(payload),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        method: "POST",
      },
    ).catch(() => null);

    setSaving(false);

    if (!response?.ok) {
      const data = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(getCustomerErrorMessage(data.error, Boolean(customer)));
      return;
    }

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
            Keep contact details current for orders, support, and follow-ups.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(data) => void submit(data)}
          className="flex flex-col"
          key={formKey}
        >
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            {error ? (
              <Alert className="sm:col-span-2" variant="destructive">
                <AlertTitle>
                  {customer ? "Customer could not be updated" : "Customer could not be created"}
                </AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor={`${id}-first`}>First name</FieldLabel>
              <Input
                autoComplete="given-name"
                defaultValue={customer?.firstName ?? ""}
                id={`${id}-first`}
                name="firstName"
                placeholder="Abebe"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-last`}>Last name</FieldLabel>
              <Input
                autoComplete="family-name"
                defaultValue={customer?.lastName ?? ""}
                id={`${id}-last`}
                name="lastName"
                placeholder="Kebede"
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
              <Input
                autoComplete="email"
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
                autoComplete="tel"
                defaultValue={customer?.phone ?? ""}
                id={`${id}-phone`}
                name="phone"
                placeholder="+251…"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-company`}>Company</FieldLabel>
              <Input
                autoComplete="organization"
                defaultValue={customer?.companyName ?? ""}
                id={`${id}-company`}
                name="companyName"
                placeholder="Optional"
              />
            </Field>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4">
            <Button
              disabled={saving}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
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

function getCustomerErrorMessage(error: string | undefined, isEdit: boolean) {
  if (error === "invalid_customer") return "Check the email and other fields, then try again.";
  if (error === "customer_email_conflict") {
    return isEdit
      ? "Another customer already uses this email."
      : "This email is already in your customer list.";
  }
  if (error === "customer_not_found") return "Customer was not found.";
  if (error === "commerce_backend_unavailable") {
    return isEdit
      ? "Could not save right now. Try again in a moment."
      : "Could not add this customer right now. Try again in a moment.";
  }
  if (error === "commerce_credentials_missing" || error === "commerce_credentials_invalid") {
    return "Customer changes are temporarily unavailable. Contact support.";
  }
  return isEdit
    ? "Customer could not be updated. Try again."
    : "Customer could not be created. Try again.";
}
