"use client";

import Link from "@/components/app/link";
import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { HelpTip } from "@/components/app/help-tip";
import { SearchableCombobox } from "@/components/app/searchable-combobox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import {
  SectionIntro,
  SettingsSectionBody,
} from "@/features/settings/settings-sections";
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
    return <Badge variant="success">{t("settings.payments.status.on")}</Badge>;
  }
  if (status === "off") {
    return <Badge variant="warning">{t("settings.payments.status.off")}</Badge>;
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
    <SettingsSectionBody>
      <SectionIntro
        description={t("settings.payments.intro")}
        title={t("settings.sections.payments.label")}
      />

      {/* Cash on delivery */}
      <Card size="sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/60 pb-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="text-sm font-medium tracking-tight">
              {t("settings.payments.cod.title")}
            </CardTitle>
            <Badge variant="secondary">{t("settings.payments.cod.badge")}</Badge>
            <HelpTip
              summary={t("settings.payments.cod.description")}
              title={t("settings.payments.cod.title")}
            >
              <p>{t("settings.payments.cod.description")}</p>
              <p className="mt-2 text-muted-foreground">{t("settings.payments.cod.hint")}</p>
            </HelpTip>
          </div>
          <Button asChild className="shrink-0 rounded-full" size="sm" variant="outline">
            <Link href={`${dashboardRoutes.settings}?tab=fulfillment`}>
              {t("settings.payments.cod.openFulfillment")}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-3 text-sm text-muted-foreground">
          {t("settings.payments.cod.hint")}
        </CardContent>
      </Card>

      {/* Online payments (Chapa) — keep surface short; details live in HelpTips. */}
      <Card size="sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/60 pb-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CardTitle className="text-sm font-medium tracking-tight">
              {t("settings.payments.online.title")}
            </CardTitle>
            <OnlineStatusBadge status={status} />
            <HelpTip
              summary={t("settings.payments.online.description")}
              title={t("settings.payments.online.title")}
            >
              <p>{t("settings.payments.online.description")}</p>
              {!connected ? (
                <ol className="mt-2 list-decimal space-y-1 ps-4 text-muted-foreground">
                  <li>{t("settings.payments.online.step1")}</li>
                  <li>{t("settings.payments.online.step2")}</li>
                  <li>{t("settings.payments.online.step3")}</li>
                </ol>
              ) : null}
              <p className="mt-2 text-muted-foreground">
                {connected
                  ? t("settings.payments.online.helpBodyConnected")
                  : t("settings.payments.online.helpBody")}
              </p>
            </HelpTip>
          </div>
          {supportHref ? (
            <Button asChild className="shrink-0 rounded-full" size="sm" variant="ghost">
              <a
                href={supportHref}
                rel="noopener noreferrer"
                target={supportHref.startsWith("http") ? "_blank" : undefined}
              >
                <AppIcons.mail className="size-3.5" />
                {t("settings.payments.online.helpCta")}
              </a>
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-3">
          {status === "loading" ? (
            <div className="h-20 animate-pulse rounded-lg bg-muted/50" />
          ) : null}

          {loadError && status !== "loading" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
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

          {connected ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium">{t("settings.payments.online.offerLabel")}</p>
                  <HelpTip
                    summary={
                      chapa?.onlineEnabled
                        ? t("settings.payments.online.offerOnHint")
                        : t("settings.payments.online.offerOffHint")
                    }
                    title={t("settings.payments.online.offerLabel")}
                  />
                </div>
                {chapa?.secretFingerprint ? (
                  <p className="text-xs text-muted-foreground">
                    {t("settings.payments.online.connectedAs", {
                      fingerprint: chapa.secretFingerprint,
                    })}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2 self-start rounded-full border bg-muted/20 px-2.5 py-1 sm:self-center">
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

          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium">
                {connected
                  ? t("settings.payments.online.updateTitle")
                  : t("settings.payments.online.connectTitle")}
              </p>
              <HelpTip
                summary={
                  connected
                    ? t("settings.payments.online.updateHint")
                    : t("settings.payments.online.connectHint")
                }
                title={
                  connected
                    ? t("settings.payments.online.updateTitle")
                    : t("settings.payments.online.connectTitle")
                }
              />
            </div>

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

          {connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">
                {t("settings.payments.online.disconnectHint")}
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="rounded-full"
                    disabled={isPending}
                    type="button"
                    variant="outline"
                    size="sm"
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

      <ReceivingAccountsCard />
    </SettingsSectionBody>
  );
}

type ReceivingAccountRow = {
  id: string;
  label: string;
  bankCode: string | null;
  bankName: string;
  accountName: string | null;
  accountLast4: string | null;
  isDefault: boolean;
};

type ReceivingAccountFormState = {
  label: string;
  bankCode: string;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
};

const emptyReceivingForm = (): ReceivingAccountFormState => ({
  label: "",
  bankCode: "",
  accountName: "",
  accountNumber: "",
  isDefault: false,
});

function ReceivingAccountsCard() {
  const { t } = useI18n();
  const formIds = useId();
  const [accounts, setAccounts] = useState<ReceivingAccountRow[]>([]);
  const [banks, setBanks] = useState<Array<{ code: string; name: string }>>([]);
  const [form, setForm] = useState<ReceivingAccountFormState>(emptyReceivingForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        value: bank.code,
        label: bank.name,
        keywords: `${bank.code} ${bank.name}`,
      })),
    [banks],
  );

  const editingAccount = editingId
    ? (accounts.find((account) => account.id === editingId) ?? null)
    : null;
  const deleteAccount = deleteId
    ? (accounts.find((account) => account.id === deleteId) ?? null)
    : null;

  const load = useCallback(async () => {
    try {
      const [accRes, bankRes] = await Promise.all([
        fetch("/admin/settings/payments/receiving-accounts", {
          cache: "no-store",
          headers: { accept: "application/json" },
        }),
        fetch("/admin/settings/payments/banks", {
          cache: "no-store",
          headers: { accept: "application/json" },
        }),
      ]);
      if (accRes.ok) {
        const data = await accRes.json().catch(() => null);
        if (Array.isArray(data?.accounts)) setAccounts(data.accounts);
      }
      if (bankRes.ok) {
        const data = await bankRes.json().catch(() => null);
        if (Array.isArray(data?.banks)) setBanks(data.banks);
      }
    } catch {
      // ignore load failures; list stays empty
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyReceivingForm(),
      isDefault: accounts.length === 0,
    });
    setDialogOpen(true);
  }

  function openEdit(account: ReceivingAccountRow) {
    setEditingId(account.id);
    setForm({
      label: account.label,
      bankCode: account.bankCode ?? "",
      accountName: account.accountName ?? "",
      accountNumber: "",
      isDefault: account.isDefault,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyReceivingForm());
  }

  function saveAccount() {
    const label = form.label.trim();
    const bank = banks.find((item) => item.code === form.bankCode);
    if (!label || !form.bankCode || !bank) return;

    startTransition(async () => {
      toast.loading(t("settings.payments.toast.working"), { id: "recv-acc" });
      try {
        const isEdit = Boolean(editingId);
        const body: Record<string, unknown> = {
          label,
          bankCode: form.bankCode,
          bankName: bank.name,
          accountName: form.accountName.trim() || null,
          isDefault: form.isDefault,
        };
        // Only send account number when the merchant entered a new value (edit keeps existing if blank).
        if (form.accountNumber.trim()) {
          body.accountNumber = form.accountNumber.trim();
        } else if (!isEdit) {
          body.accountNumber = null;
        }

        const response = await fetch(
          isEdit
            ? `/admin/settings/payments/receiving-accounts/${editingId}`
            : "/admin/settings/payments/receiving-accounts",
          {
            method: "POST",
            headers: { accept: "application/json", "content-type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(
            mapPlatformErrorMessage(
              typeof data?.error === "string"
                ? data.error
                : typeof data?.message === "string"
                  ? data.message
                  : "receiving_account_create_failed",
              { fallback: t("settings.payments.receiving.failed") },
            ),
            { id: "recv-acc" },
          );
          return;
        }
        toast.success(t("settings.payments.receiving.saved"), { id: "recv-acc" });
        closeDialog();
        await load();
      } catch {
        toast.error(t("settings.payments.receiving.failed"), { id: "recv-acc" });
      }
    });
  }

  function removeAccount(id: string) {
    startTransition(async () => {
      toast.loading(t("settings.payments.toast.working"), { id: "recv-del" });
      try {
        const response = await fetch(`/admin/settings/payments/receiving-accounts/${id}`, {
          method: "DELETE",
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          toast.error(t("settings.payments.receiving.failed"), { id: "recv-del" });
          return;
        }
        toast.success(t("settings.payments.receiving.deleted"), { id: "recv-del" });
        setDeleteId(null);
        await load();
      } catch {
        toast.error(t("settings.payments.receiving.failed"), { id: "recv-del" });
      }
    });
  }

  const canSave = form.label.trim().length > 0 && form.bankCode.length > 0 && !isPending;

  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60 pb-2.5">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-sm font-medium tracking-tight">
            {t("settings.payments.receiving.title")}
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            {t("settings.payments.receiving.description")}
          </CardDescription>
        </div>
        {accounts.length > 0 ? (
          <Button
            className="shrink-0 rounded-full"
            onClick={openCreate}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("settings.payments.receiving.add")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-3">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl border bg-background shadow-sm">
              <AppIcons.billing className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("settings.payments.receiving.emptyTitle")}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("settings.payments.receiving.empty")}
              </p>
            </div>
            <Button className="rounded-full" onClick={openCreate} size="sm" type="button">
              {t("settings.payments.receiving.add")}
            </Button>
          </div>
        ) : (
          <ul
            className={cn(
              "divide-y overflow-hidden rounded-xl border",
              accounts.length > 6 && "max-h-[min(22rem,45vh)] overflow-y-auto overscroll-contain",
            )}
          >
            {accounts.map((account) => (
              <li
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                key={account.id}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                  <AppIcons.billing className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{account.label}</p>
                    {account.isDefault ? (
                      <Badge variant="secondary">{t("settings.payments.receiving.defaultBadge")}</Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {account.bankName}
                    {account.accountLast4
                      ? ` · ${t("settings.payments.receiving.endsIn", { digits: account.accountLast4 })}`
                      : ""}
                    {account.accountName ? ` · ${account.accountName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    aria-label={t("settings.payments.receiving.edit")}
                    className="rounded-full"
                    disabled={isPending}
                    onClick={() => openEdit(account)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <AppIcons.edit className="size-4" />
                  </Button>
                  <Button
                    aria-label={t("settings.payments.receiving.delete")}
                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={isPending}
                    onClick={() => setDeleteId(account.id)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <AppIcons.trash className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
        open={dialogOpen}
      >
        <DialogContent className="gap-0 overflow-visible p-0 sm:max-w-md">
          <DialogHeader className="gap-1.5 border-b px-4 py-4 text-left sm:px-5">
            <DialogTitle>
              {editingId
                ? t("settings.payments.receiving.dialogEditTitle")
                : t("settings.payments.receiving.dialogAddTitle")}
            </DialogTitle>
            <DialogDescription>{t("settings.payments.receiving.dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[min(70dvh,32rem)] flex-col gap-4 overflow-y-auto p-4 sm:p-5">
            <Field>
              <FieldLabel htmlFor={`${formIds}-label`}>
                {t("settings.payments.receiving.label")}
              </FieldLabel>
              <Input
                autoFocus
                disabled={isPending}
                id={`${formIds}-label`}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder={t("settings.payments.receiving.labelPlaceholder")}
                value={form.label}
              />
              <FieldDescription>{t("settings.payments.receiving.labelHint")}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${formIds}-bank`}>
                {t("settings.payments.receiving.bank")}
              </FieldLabel>
              <SearchableCombobox
                disabled={isPending}
                emptyLabel={t("settings.payments.receiving.noMatchingBanks")}
                id={`${formIds}-bank`}
                onChange={(value) => setForm((current) => ({ ...current, bankCode: value }))}
                options={bankOptions}
                placeholder={t("settings.payments.receiving.bankPlaceholder")}
                searchPlaceholder={t("settings.payments.receiving.searchBanks")}
                value={form.bankCode}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${formIds}-holder`}>
                {t("settings.payments.receiving.accountName")}
              </FieldLabel>
              <Input
                disabled={isPending}
                id={`${formIds}-holder`}
                onChange={(event) =>
                  setForm((current) => ({ ...current, accountName: event.target.value }))
                }
                placeholder={t("settings.payments.receiving.accountNamePlaceholder")}
                value={form.accountName}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor={`${formIds}-number`}>
                {t("settings.payments.receiving.accountNumber")}
              </FieldLabel>
              <Input
                autoComplete="off"
                disabled={isPending}
                id={`${formIds}-number`}
                inputMode="numeric"
                onChange={(event) =>
                  setForm((current) => ({ ...current, accountNumber: event.target.value }))
                }
                placeholder={
                  editingAccount?.accountLast4
                    ? t("settings.payments.receiving.endsIn", {
                        digits: editingAccount.accountLast4,
                      })
                    : t("settings.payments.receiving.accountNumberPlaceholder")
                }
                value={form.accountNumber}
              />
              <FieldDescription>
                {editingId
                  ? t("settings.payments.receiving.accountNumberKeep")
                  : t("settings.payments.receiving.accountNumberHint")}
              </FieldDescription>
            </Field>

            <Field className="flex flex-row items-center justify-between gap-4 rounded-xl border px-3.5 py-3">
              <div className="min-w-0 space-y-1">
                <FieldLabel className="text-sm" htmlFor={`${formIds}-default`}>
                  {t("settings.payments.receiving.default")}
                </FieldLabel>
                <FieldDescription className="text-xs">
                  {t("settings.payments.receiving.defaultHint")}
                </FieldDescription>
              </div>
              <Switch
                checked={form.isDefault}
                disabled={isPending}
                id={`${formIds}-default`}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isDefault: checked }))
                }
              />
            </Field>
          </div>

          {/* p-0 content: cancel DialogFooter negative margins (same as mark-paid / create dialogs). */}
          <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-muted/50 p-4">
            <Button disabled={isPending} onClick={closeDialog} type="button" variant="outline">
              {t("common.cancel")}
            </Button>
            <Button disabled={!canSave} onClick={saveAccount} type="button">
              {isPending
                ? t("settings.payments.receiving.saving")
                : t("settings.payments.receiving.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        open={Boolean(deleteId)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.payments.receiving.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAccount
                ? `${deleteAccount.label} — ${t("settings.payments.receiving.deleteConfirm")}`
                : t("settings.payments.receiving.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending || !deleteId}
              onClick={(event) => {
                event.preventDefault();
                if (deleteId) removeAccount(deleteId);
              }}
            >
              {t("settings.payments.receiving.deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
