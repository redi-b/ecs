"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type {
  DiscountType,
  QuickSaleProduct,
  SaleLine,
  Tender,
  VariantDetail,
} from "./quick-sale-model";
import { formatEtb } from "./quick-sale-model";

export type QuickSaleStage = "cart" | "payment" | "complete";

type CompletedSale = { orderId: string; paid: boolean };

export function QuickSaleCart({
  adjustmentReason,
  canUpdate,
  cashReceived,
  change,
  completedSale,
  completing,
  customerEmail,
  customerName,
  customerPhone,
  discount,
  discountType,
  discountValue,
  lines,
  mobileOpen,
  onClear,
  onCloseMobile,
  onComplete,
  onNewSale,
  onSave,
  onSetAdjustmentReason,
  onSetCashReceived,
  onSetCustomerEmail,
  onSetCustomerName,
  onSetCustomerPhone,
  onSetDiscountType,
  onSetDiscountValue,
  onSetReference,
  onSetStage,
  onSetTender,
  onUpdateLine,
  productById,
  reference,
  saving,
  stage,
  subtotal,
  tender,
  total,
  valid,
  variantById,
}: {
  adjustmentReason: string;
  canUpdate: boolean;
  cashReceived: string;
  change: number;
  completedSale: CompletedSale | null;
  completing: boolean;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  discount: number;
  discountType: DiscountType;
  discountValue: string;
  lines: SaleLine[];
  mobileOpen: boolean;
  onClear: () => void;
  onCloseMobile: () => void;
  onComplete: (completion: "paid" | "pay_later") => void;
  onNewSale: () => void;
  onSave: () => void;
  onSetAdjustmentReason: (value: string) => void;
  onSetCashReceived: (value: string) => void;
  onSetCustomerEmail: (value: string) => void;
  onSetCustomerName: (value: string) => void;
  onSetCustomerPhone: (value: string) => void;
  onSetDiscountType: (value: DiscountType) => void;
  onSetDiscountValue: (value: string) => void;
  onSetReference: (value: string) => void;
  onSetStage: (stage: QuickSaleStage) => void;
  onSetTender: (value: Tender) => void;
  onUpdateLine: (variantId: string, change: Partial<SaleLine> | null) => void;
  productById: Map<string, QuickSaleProduct>;
  reference: string;
  saving: boolean;
  stage: QuickSaleStage;
  subtotal: number;
  tender: Tender;
  total: number;
  valid: boolean;
  variantById: Map<string, VariantDetail>;
}) {
  const { formatNumber, t } = useI18n();
  const [customerOpen, setCustomerOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const hasCustomer = Boolean(customerName || customerPhone || customerEmail);
  const editingLine = lines.find((line) => line.variantId === editingVariantId) ?? null;
  const editingVariant = editingVariantId ? variantById.get(editingVariantId) : null;

  return (
    <aside
      className={cn(
        "z-40 flex min-h-0 flex-col bg-card lg:static lg:z-auto lg:border-l",
        mobileOpen ? "fixed inset-0" : "hidden lg:flex",
      )}
      aria-label={t("quickSale.currentSale")}
    >
      {stage === "complete" && completedSale ? (
        <CompletionState completedSale={completedSale} onNewSale={onNewSale} />
      ) : stage === "payment" ? (
        <PaymentStage
          canUpdate={canUpdate}
          cashReceived={cashReceived}
          change={change}
          completing={completing}
          onBack={() => onSetStage("cart")}
          onComplete={onComplete}
          onSetCashReceived={onSetCashReceived}
          onSetReference={onSetReference}
          onSetTender={onSetTender}
          reference={reference}
          tender={tender}
          total={total}
          valid={valid}
        />
      ) : (
        <>
          <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
            <Button
              aria-label={t("common.back")}
              className="lg:hidden"
              onClick={onCloseMobile}
              size="icon-sm"
              variant="ghost"
            >
              <AppIcons.arrowLeft />
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base font-medium">{t("quickSale.currentSale")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("quickSale.items", {
                  count: lines.reduce((sum, line) => sum + line.quantity, 0),
                })}
              </p>
            </div>
            {lines.length > 0 ? (
              <ConfirmDialog
                confirmLabel={t("quickSale.clearSale")}
                description={t("quickSale.clearSaleDescription")}
                icon="trash"
                onConfirm={onClear}
                title={t("quickSale.clearSaleTitle")}
                trigger={
                  <Button
                    aria-label={t("quickSale.clearSale")}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    size="sm"
                    variant="ghost"
                  >
                    <AppIcons.clear data-icon="inline-start" />
                    {t("quickSale.clearSale")}
                  </Button>
                }
              />
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {lines.length === 0 ? (
              <div className="grid min-h-full place-items-center px-8 text-center">
                <div className="max-w-xs space-y-2">
                  <span className="mx-auto grid size-11 place-items-center rounded-full border bg-muted/45 text-muted-foreground">
                    <AppIcons.orders className="size-5" />
                  </span>
                  <p className="font-medium">{t("quickSale.emptyCartTitle")}</p>
                  <p className="text-sm text-muted-foreground">{t("quickSale.emptyCart")}</p>
                </div>
              </div>
            ) : (
              <>
                <ul className="divide-y">
                  {lines.map((line) => {
                    const variant = variantById.get(line.variantId);
                    const product = variant ? productById.get(variant.productId) : null;
                    const price = line.unitPrice ?? variant?.priceAmount ?? 0;
                    return (
                      <li className="flex gap-3 px-3 py-3 sm:px-4" key={line.variantId}>
                        <ProductThumb
                          title={variant?.productTitle ?? line.variantId}
                          url={variant?.imageUrl ?? product?.thumbnailUrl}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {variant?.productTitle ?? line.variantId}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {[variant?.variantTitle, variant?.sku].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <Button
                              aria-label={t("quickSale.remove")}
                              className="-mt-1 -mr-1 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => onUpdateLine(line.variantId, null)}
                              size="icon-sm"
                              variant="ghost"
                            >
                              <AppIcons.trash />
                            </Button>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="inline-flex h-8 items-center rounded-full border bg-background">
                              <Button
                                aria-label={t("quickSale.decreaseQuantity")}
                                className="size-8 rounded-full"
                                onClick={() =>
                                  onUpdateLine(line.variantId, {
                                    quantity: Math.max(1, line.quantity - 1),
                                  })
                                }
                                size="icon-sm"
                                variant="ghost"
                              >
                                <AppIcons.subtract />
                              </Button>
                              <span className="min-w-7 text-center text-sm font-medium tabular-nums">
                                {line.quantity}
                              </span>
                              <Button
                                aria-label={t("quickSale.increaseQuantity")}
                                className="size-8 rounded-full"
                                disabled={
                                  variant?.availableQuantity != null &&
                                  line.quantity >= variant.availableQuantity
                                }
                                onClick={() =>
                                  onUpdateLine(line.variantId, { quantity: line.quantity + 1 })
                                }
                                size="icon-sm"
                                variant="ghost"
                              >
                                <AppIcons.add />
                              </Button>
                            </div>
                            <button
                              className={cn(
                                "rounded-full px-2 py-1 font-mono text-sm font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                canUpdate && "hover:bg-muted",
                              )}
                              disabled={!canUpdate}
                              onClick={() => setEditingVariantId(line.variantId)}
                              type="button"
                            >
                              {formatEtb(price * line.quantity, formatNumber)}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t px-3 py-2 sm:px-4">
                  <CartAction
                    detail={
                      hasCustomer ? customerName || customerPhone || customerEmail : undefined
                    }
                    icon={AppIcons.user}
                    label={hasCustomer ? t("quickSale.customerAdded") : t("quickSale.addCustomer")}
                    onClick={() => setCustomerOpen(true)}
                  />
                  <CartAction
                    detail={
                      discountType === "none"
                        ? undefined
                        : discountType === "percentage"
                          ? `${discountValue}%`
                          : formatEtb(Number(discountValue) || 0, formatNumber)
                    }
                    disabled={!canUpdate}
                    icon={AppIcons.tag}
                    label={
                      discountType === "none"
                        ? t("quickSale.addDiscount")
                        : t("quickSale.editDiscount")
                    }
                    onClick={() => setDiscountOpen(true)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
            <div className="mb-3 space-y-1.5 text-sm">
              <MoneyRow label={t("quickSale.subtotal")} value={formatEtb(subtotal, formatNumber)} />
              {discount > 0 ? (
                <MoneyRow
                  label={t("quickSale.discount")}
                  value={`− ${formatEtb(discount, formatNumber)}`}
                />
              ) : null}
              <MoneyRow
                emphasized
                label={t("quickSale.total")}
                value={formatEtb(total, formatNumber)}
              />
            </div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t("quickSale.saveCart")}
                    disabled={!valid || saving || completing}
                    onClick={onSave}
                    size="icon"
                    variant="outline"
                  >
                    {saving ? <AppIcons.loader className="animate-spin" /> : <AppIcons.documents />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("quickSale.saveCart")}</TooltipContent>
              </Tooltip>
              <Button
                className="justify-between px-4"
                disabled={!valid || completing}
                onClick={() => onSetStage("payment")}
              >
                <span>{t("quickSale.checkout")}</span>
                <span className="font-mono tabular-nums">{formatEtb(total, formatNumber)}</span>
              </Button>
            </div>
          </div>
        </>
      )}

      <CustomerSheet
        email={customerEmail}
        name={customerName}
        onEmailChange={onSetCustomerEmail}
        onNameChange={onSetCustomerName}
        onOpenChange={setCustomerOpen}
        onPhoneChange={onSetCustomerPhone}
        open={customerOpen}
        phone={customerPhone}
      />
      <DiscountSheet
        adjustmentReason={adjustmentReason}
        discountType={discountType}
        discountValue={discountValue}
        onAdjustmentReasonChange={onSetAdjustmentReason}
        onDiscountTypeChange={onSetDiscountType}
        onDiscountValueChange={onSetDiscountValue}
        onOpenChange={setDiscountOpen}
        open={discountOpen}
      />
      <PriceSheet
        adjustmentReason={adjustmentReason}
        line={editingLine}
        onAdjustmentReasonChange={onSetAdjustmentReason}
        onOpenChange={(open) => !open && setEditingVariantId(null)}
        onPriceChange={(unitPrice) =>
          editingVariantId && onUpdateLine(editingVariantId, { unitPrice })
        }
        open={Boolean(editingLine)}
        variant={editingVariant ?? null}
      />
    </aside>
  );
}

function PaymentStage({
  canUpdate,
  cashReceived,
  change,
  completing,
  onBack,
  onComplete,
  onSetCashReceived,
  onSetReference,
  onSetTender,
  reference,
  tender,
  total,
  valid,
}: {
  canUpdate: boolean;
  cashReceived: string;
  change: number;
  completing: boolean;
  onBack: () => void;
  onComplete: (completion: "paid" | "pay_later") => void;
  onSetCashReceived: (value: string) => void;
  onSetReference: (value: string) => void;
  onSetTender: (value: Tender) => void;
  reference: string;
  tender: Tender;
  total: number;
  valid: boolean;
}) {
  const { formatNumber, t } = useI18n();
  const tenders: Tender[] = ["cash", "telebirr", "cbe_birr", "bank_transfer", "other"];

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <Button aria-label={t("common.back")} onClick={onBack} size="icon-sm" variant="ghost">
          <AppIcons.arrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-medium">{t("quickSale.payment")}</h2>
          <p className="truncate font-mono text-xs tabular-nums text-muted-foreground">
            {formatEtb(total, formatNumber)}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2">
          {tenders.map((value) => (
            <button
              aria-pressed={tender === value}
              className={cn(
                "min-h-12 rounded-xl border px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                tender === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-background hover:bg-muted",
              )}
              key={value}
              onClick={() => onSetTender(value)}
              type="button"
            >
              {t(`quickSale.${tenderKey(value)}`)}
            </button>
          ))}
        </div>

        {tender === "cash" ? (
          <div className="mt-5 space-y-3">
            <Field>
              <FieldLabel>{t("quickSale.cashReceived")}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  autoFocus
                  inputMode="decimal"
                  min={0}
                  onChange={(event) => onSetCashReceived(event.target.value)}
                  type="number"
                  value={cashReceived}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>ETB</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <div className="flex items-center justify-between rounded-xl border bg-muted/25 px-3 py-3">
              <span className="text-sm text-muted-foreground">{t("quickSale.change")}</span>
              <span className="font-mono font-semibold tabular-nums">
                {formatEtb(change, formatNumber)}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <Badge variant="outline">{t("quickSale.merchantRecorded")}</Badge>
            <Field>
              <FieldLabel>{t("quickSale.referenceOptional")}</FieldLabel>
              <Input onChange={(event) => onSetReference(event.target.value)} value={reference} />
            </Field>
          </div>
        )}
      </div>
      <div className="shrink-0 space-y-2 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
        <Button
          className="w-full justify-between px-4"
          disabled={!valid || !canUpdate || completing}
          onClick={() => onComplete("paid")}
        >
          <span>{t("quickSale.completePaid")}</span>
          <span className="font-mono tabular-nums">{formatEtb(total, formatNumber)}</span>
        </Button>
        <Button
          className="w-full"
          disabled={!valid || completing}
          onClick={() => onComplete("pay_later")}
          variant="outline"
        >
          {completing ? <AppIcons.loader className="animate-spin" /> : null}
          {t("quickSale.payLater")}
        </Button>
      </div>
    </>
  );
}

function CompletionState({
  completedSale,
  onNewSale,
}: {
  completedSale: CompletedSale;
  onNewSale: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid min-h-full place-items-center p-6 text-center">
      <div className="w-full max-w-xs space-y-5">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success/12 text-success">
          <AppIcons.check className="size-7" />
        </span>
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-semibold">{t("quickSale.saleComplete")}</h2>
          <p className="text-sm text-muted-foreground">
            {t(completedSale.paid ? "quickSale.completed" : "quickSale.createdUnpaid")}
          </p>
        </div>
        <div className="grid gap-2">
          <Button className="w-full" onClick={onNewSale}>
            {t("quickSale.startNextSale")}
          </Button>
          <Button asChild className="w-full" variant="outline">
            <Link href={dashboardRoutes.orderDetail(completedSale.orderId)}>
              {t("quickSale.viewOrder")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerSheet({
  email,
  name,
  onEmailChange,
  onNameChange,
  onOpenChange,
  onPhoneChange,
  open,
  phone,
}: {
  email: string;
  name: string;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onPhoneChange: (value: string) => void;
  open: boolean;
  phone: string;
}) {
  const { t } = useI18n();
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("quickSale.customer")}</SheetTitle>
          <SheetDescription>{t("quickSale.customerDescription")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <Field>
            <FieldLabel>{t("quickSale.customerName")}</FieldLabel>
            <Input autoFocus onChange={(event) => onNameChange(event.target.value)} value={name} />
          </Field>
          <Field>
            <FieldLabel>{t("quickSale.customerPhone")}</FieldLabel>
            <Input
              inputMode="tel"
              onChange={(event) => onPhoneChange(event.target.value)}
              value={phone}
            />
          </Field>
          <Field>
            <FieldLabel>{t("quickSale.customerEmail")}</FieldLabel>
            <Input
              onChange={(event) => onEmailChange(event.target.value)}
              type="email"
              value={email}
            />
          </Field>
        </SheetBody>
        <SheetFooter>
          <Button onClick={() => onOpenChange(false)}>{t("quickSale.done")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function DiscountSheet({
  adjustmentReason,
  discountType,
  discountValue,
  onAdjustmentReasonChange,
  onDiscountTypeChange,
  onDiscountValueChange,
  onOpenChange,
  open,
}: {
  adjustmentReason: string;
  discountType: DiscountType;
  discountValue: string;
  onAdjustmentReasonChange: (value: string) => void;
  onDiscountTypeChange: (value: DiscountType) => void;
  onDiscountValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const [reasonTouched, setReasonTouched] = useState(false);
  const reasonRequired = discountType !== "none" && adjustmentReason.trim().length < 3;
  const showReasonError = reasonRequired && reasonTouched;
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setReasonTouched(false);
    onOpenChange(nextOpen);
  }
  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("quickSale.discount")}</SheetTitle>
          <SheetDescription>{t("quickSale.discountDescription")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <Field>
            <FieldLabel>{t("quickSale.discount")}</FieldLabel>
            <Select
              onValueChange={(value) => onDiscountTypeChange(value as DiscountType)}
              value={discountType}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("quickSale.none")}</SelectItem>
                <SelectItem value="percentage">{t("quickSale.percentage")}</SelectItem>
                <SelectItem value="fixed">{t("quickSale.fixed")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {discountType !== "none" ? (
            <>
              <Field>
                <FieldLabel>{t("quickSale.discountValue")}</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>−</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    min={0}
                    onChange={(event) => onDiscountValueChange(event.target.value)}
                    type="number"
                    value={discountValue}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{discountType === "percentage" ? "%" : "ETB"}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field data-invalid={showReasonError}>
                <FieldLabel>
                  {t("quickSale.adjustmentReason")}
                  <span aria-hidden className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <Input
                  aria-invalid={showReasonError}
                  onBlur={() => setReasonTouched(true)}
                  onChange={(event) => onAdjustmentReasonChange(event.target.value)}
                  value={adjustmentReason}
                />
                {showReasonError ? (
                  <FieldError>{t("quickSale.reasonRequired")}</FieldError>
                ) : (
                  <FieldDescription>{t("quickSale.reasonRequired")}</FieldDescription>
                )}
              </Field>
            </>
          ) : null}
        </SheetBody>
        <SheetFooter>
          <Button disabled={reasonRequired} onClick={() => onOpenChange(false)}>
            {t("quickSale.done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PriceSheet({
  adjustmentReason,
  line,
  onAdjustmentReasonChange,
  onOpenChange,
  onPriceChange,
  open,
  variant,
}: {
  adjustmentReason: string;
  line: SaleLine | null;
  onAdjustmentReasonChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onPriceChange: (value: number | null) => void;
  open: boolean;
  variant: VariantDetail | null;
}) {
  const { t } = useI18n();
  const [reasonTouched, setReasonTouched] = useState(false);
  const reasonRequired = line?.unitPrice != null && adjustmentReason.trim().length < 3;
  const showReasonError = reasonRequired && reasonTouched;
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setReasonTouched(false);
    onOpenChange(nextOpen);
  }
  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetContent className="w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("quickSale.editPrice")}</SheetTitle>
          <SheetDescription>{variant?.productTitle}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <Field>
            <FieldLabel>{t("quickSale.price")}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                autoFocus
                min={0}
                onChange={(event) =>
                  onPriceChange(
                    event.target.value === "" ? null : Math.max(0, Number(event.target.value)),
                  )
                }
                placeholder={variant?.priceAmount == null ? "0" : String(variant.priceAmount)}
                type="number"
                value={line?.unitPrice ?? ""}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>ETB</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field data-invalid={showReasonError}>
            <FieldLabel>
              {t("quickSale.adjustmentReason")}
              <span aria-hidden className="text-destructive">
                *
              </span>
            </FieldLabel>
            <Input
              aria-invalid={showReasonError}
              onBlur={() => setReasonTouched(true)}
              onChange={(event) => onAdjustmentReasonChange(event.target.value)}
              value={adjustmentReason}
            />
            {showReasonError ? (
              <FieldError>{t("quickSale.reasonRequired")}</FieldError>
            ) : (
              <FieldDescription>{t("quickSale.reasonRequired")}</FieldDescription>
            )}
          </Field>
        </SheetBody>
        <SheetFooter>
          <Button disabled={reasonRequired} onClick={() => onOpenChange(false)}>
            {t("quickSale.done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CartAction({
  detail,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  detail?: string | undefined;
  disabled?: boolean;
  icon: typeof AppIcons.user;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      {detail ? (
        <span className="max-w-32 truncate text-xs text-muted-foreground">{detail}</span>
      ) : null}
      <AppIcons.arrowRight className="size-4 text-muted-foreground" />
    </button>
  );
}

function ProductThumb({ title, url }: { title: string; url?: string | null | undefined }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/45 text-sm font-semibold text-muted-foreground">
      {url ? (
        // biome-ignore lint/performance/noImgElement: commerce thumbnails may come from merchant media hosts.
        <img alt="" className="size-full object-cover" src={url} />
      ) : (
        title.trim().charAt(0).toUpperCase() || "?"
      )}
    </span>
  );
}

function MoneyRow({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        emphasized && "border-t pt-2 text-base font-semibold",
      )}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

function tenderKey(tender: Tender) {
  if (tender === "cbe_birr") return "cbeBirr" as const;
  if (tender === "bank_transfer") return "bankTransfer" as const;
  return tender;
}
