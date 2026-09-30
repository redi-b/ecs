"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import { dashboardRoutes } from "@/lib/routes";

export function ReviseQuotationButton({
  draftId,
  expiresAt,
  quotationId,
  revision,
}: {
  draftId: string;
  expiresAt: string;
  quotationId: string;
  revision: number;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const key = useRef(createClientId("quotation-revise"));
  const validUntilId = useId();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<"am" | "en">(locale === "am" ? "am" : "en");
  const [validUntil, setValidUntil] = useState(() => expiresAt.slice(0, 10));
  async function revise() {
    setPending(true);
    const response = await fetch(dashboardRoutes.orderQuotationReviseAction(quotationId), {
      body: JSON.stringify({
        draftId,
        expectedRevision: revision,
        expiresAt: new Date(`${validUntil}T20:59:59.999Z`).toISOString(),
        language,
      }),
      headers: { "content-type": "application/json", "idempotency-key": key.current },
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) {
      toast.error(t("orders.quotes.reviseFailed"));
      setPending(false);
      return;
    }
    toast.success(t("orders.quotes.revised"));
    setOpen(false);
    router.refresh();
  }
  return (
    <Dialog onOpenChange={(next) => !pending && setOpen(next)} open={open}>
      <DialogTrigger asChild>
        <Button disabled={pending} variant="outline">
          {t("orders.quotes.revise")}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-visible p-0 sm:max-w-md">
        <DialogHeader className="gap-1.5 border-b px-4 py-4 pr-12 text-left sm:px-5">
          <DialogTitle>{t("orders.quotes.reviseTitle")}</DialogTitle>
          <DialogDescription>{t("orders.quotes.reviseDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-4 py-5 sm:px-5">
          <Button asChild className="w-full" variant="outline">
            <Link
              href={`${dashboardRoutes.orders}?view=drafts&draft=${encodeURIComponent(draftId)}`}
            >
              {t("orders.quotes.editSource")}
            </Link>
          </Button>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={validUntilId}>{t("orders.quotes.validUntil")}</FieldLabel>
              <DatePicker
                id={validUntilId}
                min={new Date().toISOString().slice(0, 10)}
                onChange={setValidUntil}
                value={validUntil}
              />
            </Field>
            <Field>
              <FieldLabel>{t("orders.quotes.language")}</FieldLabel>
              <Select onValueChange={(value) => setLanguage(value as "am" | "en")} value={language}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="am">አማርኛ</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-b-xl border-t bg-muted/50 p-4">
          <Button disabled={pending || !validUntil} onClick={() => void revise()}>
            {pending ? t("orders.quotes.revising") : t("orders.quotes.createRevision")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
