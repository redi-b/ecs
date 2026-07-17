"use client";

import Link from "@/components/app/link";
import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import type {
  MerchantChapaStatus,
  MerchantPaymentsStatus,
} from "@/lib/platform-api/payments/client";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type PaymentsSectionProps = {
  initialPayment: MerchantPaymentsStatus | null;
  /** mailto: or https URL for merchant support (Chapa setup help). */
  supportHref?: string | null;
};

type OnlineStatus = "loading" | "not_connected" | "off" | "on";

function onlineStatus(chapa: MerchantChapaStatus | undefined): OnlineStatus {
  if (!chapa) return "loading";
  if (!chapa.configured) return "not_connected";
  return chapa.onlineEnabled ? "on" : "off";
}

function OnlineStatusBadge({ status }: { status: OnlineStatus }) {
  const { t } = useI18n();
  if (status === "loading") {
    return <Badge variant="outline">{t("settings.payments.status.loading")}</Badge>;
  }
  if (status === "on") {
    return <Badge variant="secondary">{t("settings.payments.status.on")}</Badge>;
  }
  if (status === "off") {
    return <Badge variant="outline">{t("settings.payments.status.off")}</Badge>;
  }
  return <Badge variant="outline">{t("settings.payments.status.notConnected")}</Badge>;
}

const emptyPaymentsStatus = (): MerchantPaymentsStatus => ({
  cod: true,
  chapa: {
    configured: false,
    onlineEnabled: false,
    credentialsValidated: false,
    secretFingerprint: null,
    status: "not_configured",
  },
});

export function PaymentsSection({ initialPayment, supportHref = null }: PaymentsSectionProps) {
  const { t } = useI18n();
  const secretId = useId();
  const [payment, setPayment] = useState<MerchantPaymentsStatus | null>(initialPayment);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/admin/settings/payments", {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const data = await response.json().catch(() => undefined);
      if (response.ok && data?.payment) {
        setPayment(data.payment as MerchantPaymentsStatus);
        setLoadError(null);
        return;
      }
      const code =
        (typeof data?.error === "string" && data.error) ||
        (typeof data?.message === "string" && data.message) ||
        response.statusText ||
        "payments_status_unavailable";
      // Avoid infinite "Loading…" when the BFF/platform route is missing or failing.
      setPayment(emptyPaymentsStatus());
      setLoadError(code);
    } catch {
      setPayment(emptyPaymentsStatus());
      setLoadError("payments_status_unavailable");
    }
  }, []);

  useEffect(() => {
    if (!initialPayment) {
      void refresh();
    }
  }, [initialPayment, refresh]);

  const chapa = payment?.chapa;
  const status = onlineStatus(chapa);
  const connected = Boolean(chapa?.configured);
  const canSave = secretKey.trim().length > 0;

  function run(action: string, body: Record<string, unknown>, successKey: MessageKey) {
    startTransition(async () => {
      const toastId = toast.loading(t("settings.payments.toast.working"));
      try {
        const response = await fetch("/admin/settings/payments", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ action, ...body }),
        });
        const data = await response.json().catch(() => undefined);
        if (!response.ok) {
          const code =
            (typeof data?.error === "string" && data.error) ||
            (typeof data?.message === "string" && data.message) ||
            response.statusText;
          toast.error(
            mapPlatformErrorMessage(code, { fallback: t("settings.payments.toast.failed") }),
            { id: toastId },
          );
          return;
        }
        if (data?.payment) {
          setPayment(data.payment as MerchantPaymentsStatus);
          setLoadError(null);
        } else if (action === "clear") {
          setPayment(emptyPaymentsStatus());
          setLoadError(null);
        } else {
          await refresh();
        }
        if (action === "save") {
          setSecretKey("");
          setShowKey(false);
        }
        toast.success(t(successKey), { id: toastId });
      } catch {
        toast.error(t("settings.payments.toast.failed"), { id: toastId });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("settings.sections.payments.label")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("settings.payments.intro")}</p>
      </div>

      {/* Cash on delivery */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
              <AppIcons.orders className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{t("settings.payments.cod.title")}</CardTitle>
                <Badge variant="secondary">{t("settings.payments.cod.badge")}</Badge>
              </div>
              <CardDescription>{t("settings.payments.cod.description")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t("settings.payments.cod.hint")}</p>
          <Button asChild className="w-full shrink-0 rounded-full sm:w-auto" size="sm" variant="outline">
            <Link href={`${dashboardRoutes.settings}?tab=fulfillment`}>
              {t("settings.payments.cod.openFulfillment")}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Online payments */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40">
              <AppIcons.billing className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{t("settings.payments.online.title")}</CardTitle>
                <OnlineStatusBadge status={status} />
              </div>
              <CardDescription>{t("settings.payments.online.description")}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {status === "loading" ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted/50" />
          ) : null}

          {loadError && status !== "loading" ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <p>
                {mapPlatformErrorMessage(loadError, {
                  fallback: t("settings.payments.loadError"),
                })}
              </p>
              <Button
                className="mt-2 rounded-full"
                disabled={isPending}
                onClick={() => void refresh()}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("settings.payments.retry")}
              </Button>
            </div>
          ) : null}

          {/* Connected: offer on storefront */}
          {connected ? (
            <div
              className={cn(
                "flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
                chapa?.onlineEnabled ? "border-border bg-muted/20" : "bg-background",
              )}
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">{t("settings.payments.online.offerLabel")}</p>
                <p className="text-sm text-muted-foreground">
                  {chapa?.onlineEnabled
                    ? t("settings.payments.online.offerOnHint")
                    : t("settings.payments.online.offerOffHint")}
                </p>
                {chapa?.secretFingerprint ? (
                  <p className="pt-1 text-xs text-muted-foreground">
                    {t("settings.payments.online.connectedAs", {
                      fingerprint: chapa.secretFingerprint,
                    })}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2 self-start rounded-full border bg-background px-2.5 py-1 sm:self-center">
                <span className="text-xs text-muted-foreground">
                  {t("settings.payments.online.offerSwitch")}
                </span>
                <Switch
                  checked={Boolean(chapa?.onlineEnabled)}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    run("toggle", { onlineEnabled: checked }, "settings.payments.toast.toggled")
                  }
                />
              </div>
            </div>
          ) : null}

          {/* Connect / replace secret */}
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {connected
                  ? t("settings.payments.online.updateTitle")
                  : t("settings.payments.online.connectTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {connected
                  ? t("settings.payments.online.updateHint")
                  : t("settings.payments.online.connectHint")}
              </p>
            </div>

            {!connected ? (
              <ol className="list-decimal space-y-1.5 ps-5 text-sm text-muted-foreground">
                <li>{t("settings.payments.online.step1")}</li>
                <li>{t("settings.payments.online.step2")}</li>
                <li>{t("settings.payments.online.step3")}</li>
              </ol>
            ) : null}

            <Field>
              <FieldLabel htmlFor={secretId}>{t("settings.payments.online.secretLabel")}</FieldLabel>
              <FieldContent>
                <InputGroup>
                  <InputGroupInput
                    autoComplete="off"
                    disabled={isPending}
                    id={secretId}
                    name="secretKey"
                    onChange={(event) => setSecretKey(event.target.value)}
                    placeholder={t("settings.payments.online.secretPlaceholder")}
                    spellCheck={false}
                    type={showKey ? "text" : "password"}
                    value={secretKey}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      aria-label={
                        showKey
                          ? t("settings.payments.online.hideKey")
                          : t("settings.payments.online.showKey")
                      }
                      className="rounded-full"
                      disabled={isPending}
                      onClick={() => setShowKey((value) => !value)}
                      size="xs"
                      type="button"
                      variant="ghost"
                    >
                      {showKey ? (
                        <AppIcons.eyeOff className="size-3.5" />
                      ) : (
                        <AppIcons.eye className="size-3.5" />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>{t("settings.payments.online.secretHint")}</FieldDescription>
              </FieldContent>
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-full"
                disabled={isPending || !canSave}
                onClick={() =>
                  run(
                    "save",
                    { secretKey: secretKey.trim(), onlineEnabled: false },
                    connected
                      ? "settings.payments.toast.updated"
                      : "settings.payments.toast.connected",
                  )
                }
                type="button"
              >
                {isPending ? (
                  <>
                    <AppIcons.loader className="animate-spin" />
                    {t("common.saving")}
                  </>
                ) : connected ? (
                  t("settings.payments.online.saveUpdate")
                ) : (
                  t("settings.payments.online.connect")
                )}
              </Button>
              <Button
                className="rounded-full"
                disabled={isPending || (!canSave && !connected)}
                onClick={() =>
                  run(
                    "test",
                    canSave ? { secretKey: secretKey.trim() } : {},
                    "settings.payments.toast.tested",
                  )
                }
                type="button"
                variant="outline"
              >
                {t("settings.payments.online.test")}
              </Button>
            </div>
          </div>

          {/* Support / guided setup */}
          <div
            className={cn(
              "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between",
              connected ? "border-border bg-background" : "border-border bg-muted/25",
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background">
                <AppIcons.question className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">{t("settings.payments.online.helpTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {connected
                    ? t("settings.payments.online.helpBodyConnected")
                    : t("settings.payments.online.helpBody")}
                </p>
              </div>
            </div>
            {supportHref ? (
              <Button asChild className="w-full shrink-0 rounded-full sm:w-auto" size="sm" variant="outline">
                <a href={supportHref} rel="noopener noreferrer" target={supportHref.startsWith("http") ? "_blank" : undefined}>
                  <AppIcons.mail className="size-3.5" />
                  {t("settings.payments.online.helpCta")}
                </a>
              </Button>
            ) : null}
          </div>

          {connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {t("settings.payments.online.disconnectHint")}
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="rounded-full"
                    disabled={isPending}
                    type="button"
                    variant="outline"
                  >
                    {t("settings.payments.online.disconnect")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("settings.payments.online.disconnectTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("settings.payments.online.disconnectDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">
                      {t("common.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-full"
                      onClick={() => run("clear", {}, "settings.payments.toast.disconnected")}
                    >
                      {t("settings.payments.online.disconnectConfirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
