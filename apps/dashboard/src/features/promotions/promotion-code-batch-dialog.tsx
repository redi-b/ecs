"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFooterActions,
  DialogFooterLeading,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { MerchantPromotion } from "@/lib/merchant-promotions";
import { readPlatformErrorMessage } from "@/lib/platform-api/errors";

type BatchResult = { codes: string[]; failed: number; requested: number };

export function PromotionCodeBatchDialog({
  onOpenChange,
  open,
  promotion,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  promotion: MerchantPromotion | null;
}) {
  const { t } = useI18n();
  const [prefix, setPrefix] = useState("");
  const [count, setCount] = useState("10");
  const [usageLimit, setUsageLimit] = useState("1");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const key = useRef(createClientId("promotion-batch"));
  const fieldId = useId();

  useEffect(() => {
    if (!open || !promotion) return;
    setPrefix(promotion.code.replace(/[^A-Z0-9]/gi, "").slice(0, 12) || "PROMO");
    setCount("10");
    setUsageLimit("1");
    setResult(null);
    key.current = createClientId("promotion-batch");
  }, [open, promotion]);

  async function createBatch() {
    if (!promotion) return;
    const requested = Number(count);
    const limit = usageLimit.trim() ? Number(usageLimit) : null;
    if (!Number.isInteger(requested) || requested < 2 || requested > 50) {
      toast.error(t("promotions.batch.invalidCount"));
      return;
    }
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
      toast.error(t("promotions.batch.invalidLimit"));
      return;
    }
    setSaving(true);
    const response = await fetch("/dashboard/promotions/actions/batches", {
      body: JSON.stringify({
        count: requested,
        prefix,
        promotionId: promotion.id,
        suffixLength: 8,
        usageLimit: limit,
      }),
      headers: { "content-type": "application/json", "idempotency-key": key.current },
      method: "POST",
    }).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      toast.error(
        await readPlatformErrorMessage(response, {
          fallback: t("promotions.batch.failed"),
          resource: "Promotion",
        }),
      );
      return;
    }
    const data = (await response.json()) as BatchResult;
    setResult(data);
    toast.success(t("promotions.batch.created", { count: data.codes.length }));
  }

  async function copyCodes() {
    if (!result?.codes.length) return;
    const copied = await copyTextToClipboard(result.codes.join("\n"));
    toast[copied ? "success" : "error"](
      t(copied ? "promotions.batch.copied" : "table.actions.copyFailed"),
    );
  }

  function downloadCsv() {
    if (!result?.codes.length) return;
    const blob = new Blob([`code\n${result.codes.join("\n")}\n`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${prefix.toLowerCase()}-promotion-codes.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="gap-0 overflow-visible p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 pr-12 text-left sm:px-5">
          <DialogTitle>{t("promotions.batch.title")}</DialogTitle>
          <DialogDescription>
            {t("promotions.batch.description", { code: promotion?.code ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 py-5 sm:px-5">
          {result ? (
            <div className="space-y-3">
              <div className="max-h-56 overflow-y-auto rounded-xl border bg-muted/20 p-3 font-mono text-sm">
                {result.codes.map((code) => (
                  <div key={code}>{code}</div>
                ))}
              </div>
              {result.failed > 0 ? (
                <p className="text-sm text-destructive">
                  {t("promotions.batch.partial", {
                    failed: result.failed,
                    requested: result.requested,
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={`${fieldId}-prefix`}>
                  {t("promotions.batch.prefix")}
                </FieldLabel>
                <Input
                  id={`${fieldId}-prefix`}
                  maxLength={12}
                  onChange={(event) =>
                    setPrefix(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  value={prefix}
                />
                <FieldDescription>{t("promotions.batch.prefixHelp")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-count`}>{t("promotions.batch.count")}</FieldLabel>
                <Input
                  id={`${fieldId}-count`}
                  max="50"
                  min="2"
                  onChange={(event) => setCount(event.target.value)}
                  type="number"
                  value={count}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-limit`}>
                  {t("promotions.batch.usageLimit")}
                </FieldLabel>
                <Input
                  id={`${fieldId}-limit`}
                  min="1"
                  onChange={(event) => setUsageLimit(event.target.value)}
                  placeholder={t("promotions.batch.unlimited")}
                  type="number"
                  value={usageLimit}
                />
              </Field>
            </div>
          )}
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4">
          <DialogFooterLeading>
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              {t(result ? "promotions.batch.close" : "common.cancel")}
            </Button>
          </DialogFooterLeading>
          <DialogFooterActions>
            {result ? (
              <>
                <Button onClick={() => void copyCodes()} type="button" variant="outline">
                  <AppIcons.copy />
                  {t("promotions.batch.copy")}
                </Button>
                <Button onClick={downloadCsv} type="button">
                  <AppIcons.download />
                  {t("promotions.batch.download")}
                </Button>
              </>
            ) : (
              <Button
                disabled={saving || prefix.length < 2}
                onClick={() => void createBatch()}
                type="button"
              >
                {saving ? t("promotions.batch.creating") : t("promotions.batch.create")}
              </Button>
            )}
          </DialogFooterActions>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
