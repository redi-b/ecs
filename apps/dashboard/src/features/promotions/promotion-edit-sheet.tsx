"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { MerchantPromotion } from "@/lib/merchant-promotions";

function offerSummary(promotion: MerchantPromotion) {
  if (promotion.promotionType === "buyget") {
    return `Buy ${promotion.buyMinQuantity ?? "X"} get ${promotion.applyToQuantity ?? "Y"}`;
  }
  if (
    promotion.targetType === "shipping_methods" &&
    promotion.method === "percentage" &&
    promotion.value >= 100
  ) {
    return "Free shipping";
  }
  const amount =
    promotion.method === "percentage"
      ? `${promotion.value}% off`
      : `${promotion.value} ${promotion.currencyCode?.toUpperCase() ?? "ETB"} off`;
  const target =
    promotion.targetType === "items"
      ? "products"
      : promotion.targetType === "shipping_methods"
        ? "shipping"
        : "order";
  return `${amount} · ${target}`;
}

export function PromotionEditSheet({
  onOpenChange,
  open,
  promotion,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  promotion: MerchantPromotion | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<MerchantPromotion["status"]>("active");
  const [isAutomatic, setIsAutomatic] = useState(false);
  const [isTaxInclusive, setIsTaxInclusive] = useState(false);
  const [value, setValue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [saving, setSaving] = useState(false);

  const isBuyGet = promotion?.promotionType === "buyget";
  const isFreeShipping =
    promotion?.targetType === "shipping_methods" &&
    promotion.method === "percentage" &&
    promotion.value >= 100;
  const canEditValue = Boolean(promotion) && !isBuyGet && !isFreeShipping;

  useEffect(() => {
    if (!promotion || !open) return;
    setCode(promotion.code);
    setStatus(promotion.status);
    setIsAutomatic(promotion.isAutomatic);
    setIsTaxInclusive(promotion.isTaxInclusive);
    setValue(String(promotion.value));
    setStartsAt(promotion.startsAt ? toLocalInput(promotion.startsAt) : "");
    setEndsAt(promotion.endsAt ? toLocalInput(promotion.endsAt) : "");
    setCampaignName(promotion.campaignName ?? "");
  }, [promotion, open]);

  async function save() {
    if (!promotion) return;
    const nextCode = code.trim().toUpperCase().replace(/\s+/g, "");
    if (nextCode.length < 2) {
      toast.error("Enter a promotion code with at least 2 characters.");
      return;
    }
    const nextValue = canEditValue ? Number(value) : promotion.value;
    if (canEditValue && (!Number.isFinite(nextValue) || nextValue <= 0)) {
      toast.error("Enter a valid discount value.");
      return;
    }

    setSaving(true);
    const response = await fetch(`/admin/promotions/actions/${encodeURIComponent(promotion.id)}`, {
      body: JSON.stringify({
        campaignName: campaignName.trim() || null,
        code: nextCode,
        currencyCode: promotion.currencyCode,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        isAutomatic,
        isTaxInclusive,
        method: promotion.method,
        promotionType: promotion.promotionType,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        status,
        targetType: promotion.targetType,
        usageLimit: promotion.usageLimit,
        value: nextValue,
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);
    setSaving(false);

    if (!response?.ok) {
      toast.error("Promotion could not be updated.");
      return;
    }
    toast.success("Promotion updated.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md" side="right">
        <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
          <SheetTitle>Edit promotion</SheetTitle>
          <SheetDescription>
            {promotion ? offerSummary(promotion) : "Update code, status, and schedule."}
          </SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 content-start gap-5 overflow-y-auto px-5 py-5">
          <Field>
            <FieldLabel htmlFor="promo-edit-code">Promotion code</FieldLabel>
            <Input
              id="promo-edit-code"
              onChange={(event) =>
                setCode(event.target.value.toUpperCase().replace(/\s+/g, ""))
              }
              value={code}
            />
          </Field>

          <Field>
            <FieldLabel>Status</FieldLabel>
            <Select
              onValueChange={(next: MerchantPromotion["status"]) => setStatus(next)}
              value={status}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
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

          {canEditValue ? (
            <Field>
              <FieldLabel htmlFor="promo-edit-value">
                {promotion?.method === "percentage" ? "Percent off" : "Amount off (ETB)"}
              </FieldLabel>
              <Input
                id="promo-edit-value"
                min="0.01"
                onChange={(event) => setValue(event.target.value)}
                step="0.01"
                type="number"
                value={value}
              />
            </Field>
          ) : (
            <div className="rounded-xl border px-3.5 py-3">
              <p className="text-sm font-medium">Discount</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {promotion ? offerSummary(promotion) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This offer type keeps a fixed discount shape after creation.
              </p>
            </div>
          )}

          <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
            <div className="min-w-0 space-y-1">
              <FieldLabel className="text-sm" htmlFor="promo-edit-automatic">
                Apply automatically
              </FieldLabel>
              <FieldDescription className="text-xs">
                Eligible carts get the discount without entering a code.
              </FieldDescription>
            </div>
            <Switch
              checked={isAutomatic}
              id="promo-edit-automatic"
              onCheckedChange={setIsAutomatic}
            />
          </Field>

          {!isBuyGet && !isFreeShipping ? (
            <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
              <div className="min-w-0 space-y-1">
                <FieldLabel className="text-sm" htmlFor="promo-edit-tax">
                  Apply after tax
                </FieldLabel>
                <FieldDescription className="text-xs">
                  When off, the discount is calculated before tax.
                </FieldDescription>
              </div>
              <Switch
                checked={isTaxInclusive}
                id="promo-edit-tax"
                onCheckedChange={setIsTaxInclusive}
              />
            </Field>
          ) : null}

          <div className="space-y-4 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">Schedule</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Optional start and end times for when this offer is available.
              </p>
            </div>
            <Field>
              <FieldLabel htmlFor="promo-edit-campaign">Campaign name</FieldLabel>
              <Input
                id="promo-edit-campaign"
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder={code || "Campaign"}
                value={campaignName}
              />
            </Field>
            <Field>
              <FieldLabel>Starts</FieldLabel>
              <DateTimePicker
                onChange={setStartsAt}
                placeholder="Optional start"
                value={startsAt}
              />
            </Field>
            <Field>
              <FieldLabel>Ends</FieldLabel>
              <DateTimePicker onChange={setEndsAt} placeholder="Optional end" value={endsAt} />
            </Field>
          </div>

          {promotion ? (
            <p className="text-xs text-muted-foreground">
              Used {promotion.usageCount}
              {promotion.usageLimit != null ? ` of ${promotion.usageLimit}` : ""} time
              {promotion.usageCount === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t bg-muted/30 px-5 py-4">
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={saving || !promotion} onClick={() => void save()} type="button">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Convert ISO strings to the datetime-local style value our picker accepts. */
function toLocalInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
