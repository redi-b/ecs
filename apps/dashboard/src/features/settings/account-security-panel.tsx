"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useActorOrFallback } from "@/components/app/actor-context";
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
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatDateTime,
  formatSessionIp,
  getInitials,
  parseUserAgent,
  PasswordField,
} from "@/features/settings/account-security-parts";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const SESSIONS_PAGE_SIZE = 5;

type AccountSession = {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  isCurrent: boolean;
  token: string;
  updatedAt: string;
  userAgent: string | null;
};


export function AccountSecurityPanel({
  email,
  initialName,
}: {
  email: string;
  initialName: string | null;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { setActorName } = useActorOrFallback({
    email,
    id: "",
    name: initialName,
    role: "owner",
  });
  const nameId = useId();
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  const [name, setName] = useState(initialName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);

  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [sessionsVisible, setSessionsVisible] = useState(SESSIONS_PAGE_SIZE);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<AccountSession | null>(null);
  const [pendingRevokeOthers, setPendingRevokeOthers] = useState(false);
  const [revokingOthers, setRevokingOthers] = useState(false);
  /** Browser UA for current session when server never stored one (legacy / proxy gaps). */
  const [browserUserAgent, setBrowserUserAgent] = useState<string | null>(null);

  useEffect(() => {
    setBrowserUserAgent(typeof navigator !== "undefined" ? navigator.userAgent : null);
  }, []);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionsError(null);
    const response = await fetch("/admin/account/sessions", {
      headers: { accept: "application/json" },
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as {
      sessions?: AccountSession[];
      error?: string;
    } | null;

    if (!response?.ok) {
      setSessions([]);
      setSessionsError(
        data?.error === "auth_origin_rejected"
          ? t("settings.accountSecurity.toast.sessionsOrigin")
          : t("settings.accountSecurity.toast.sessionsFailed"),
      );
      setLoadingSessions(false);
      return;
    }

    setSessions(data?.sessions ?? []);
    setSessionsVisible(SESSIONS_PAGE_SIZE);
    setLoadingSessions(false);
  }, [t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    setName(initialName ?? "");
  }, [initialName]);

  async function saveProfile() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error(t("settings.accountSecurity.toast.nameMin"));
      return;
    }
    setSavingProfile(true);
    const response = await fetch("/admin/account/profile", {
      body: JSON.stringify({ name: trimmed }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setSavingProfile(false);

    if (!response?.ok) {
      const data = (await response?.json().catch(() => null)) as { error?: string } | null;
      toast.error(
        data?.error === "auth_origin_rejected"
          ? t("settings.accountSecurity.toast.profileOrigin")
          : t("settings.accountSecurity.toast.profileFailed"),
      );
      return;
    }

    setActorName(trimmed);
    toast.success(t("settings.accountSecurity.toast.profileUpdated"));
    router.refresh();
  }

  async function savePassword() {
    if (!currentPassword || !newPassword) {
      toast.error(t("settings.accountSecurity.toast.passwordRequired"));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t("settings.accountSecurity.toast.passwordMin"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.accountSecurity.toast.passwordMismatch"));
      return;
    }

    setSavingPassword(true);
    const response = await fetch("/admin/account/password", {
      body: JSON.stringify({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setSavingPassword(false);

    if (!response?.ok) {
      const data = (await response?.json().catch(() => null)) as { error?: string } | null;
      toast.error(
        data?.error === "invalid_current_password"
          ? t("settings.accountSecurity.toast.passwordWrong")
          : data?.error === "password_too_short"
            ? t("settings.accountSecurity.toast.passwordMin")
            : data?.error === "auth_origin_rejected"
              ? t("settings.accountSecurity.toast.passwordOrigin")
              : t("settings.accountSecurity.toast.passwordFailed"),
      );
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success(
      revokeOtherSessions
        ? t("settings.accountSecurity.toast.passwordUpdatedOthers")
        : t("settings.accountSecurity.toast.passwordUpdated"),
    );
    void loadSessions();
  }

  async function confirmRevokeSession() {
    const session = pendingRevoke;
    if (!session || session.isCurrent) {
      setPendingRevoke(null);
      return;
    }

    setRevokingToken(session.token);
    const response = await fetch("/admin/account/sessions", {
      body: JSON.stringify({ token: session.token }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setRevokingToken(null);
    setPendingRevoke(null);

    if (!response?.ok) {
      const data = (await response?.json().catch(() => null)) as { error?: string } | null;
      toast.error(
        data?.error === "cannot_revoke_current"
          ? t("settings.accountSecurity.toast.cannotRevokeCurrent")
          : data?.error === "auth_origin_rejected"
            ? t("settings.accountSecurity.toast.revokeOrigin")
            : t("settings.accountSecurity.toast.revokeFailed"),
      );
      return;
    }

    toast.success(t("settings.accountSecurity.toast.sessionSignedOut"));
    void loadSessions();
  }

  async function confirmRevokeOtherSessions() {
    setRevokingOthers(true);
    const response = await fetch("/admin/account/sessions", {
      body: JSON.stringify({ revokeOthers: true }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setRevokingOthers(false);
    setPendingRevokeOthers(false);

    if (!response?.ok) {
      const data = (await response?.json().catch(() => null)) as { error?: string } | null;
      toast.error(
        data?.error === "auth_origin_rejected"
          ? t("settings.accountSecurity.toast.revokeOrigin")
          : t("settings.accountSecurity.toast.revokeOthersFailed"),
      );
      return;
    }

    toast.success(t("settings.accountSecurity.toast.othersSignedOut"));
    void loadSessions();
  }

  const otherSessionCount = sessions.filter((session) => !session.isCurrent).length;

  const initials = getInitials(name.trim() || email);
  const nameDirty = name.trim() !== (initialName ?? "").trim();
  const passwordReady =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{t("settings.accountSecurity.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t("settings.accountSecurity.intro")}
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-3.5 border-b bg-muted/25 px-4 py-4 sm:px-5">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold tracking-wide text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name.trim() || t("settings.accountSecurity.addName")}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <Field>
            <FieldLabel htmlFor={nameId}>{t("settings.accountSecurity.displayName")}</FieldLabel>
            <Input
              id={nameId}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("settings.accountSecurity.namePlaceholder")}
              value={name}
            />
            <FieldDescription>{t("settings.accountSecurity.nameHint")}</FieldDescription>
          </Field>
          <div className="flex justify-end">
            <Button
              className="rounded-full"
              disabled={savingProfile || !nameDirty}
              onClick={() => void saveProfile()}
              size="sm"
              type="button"
            >
              {savingProfile ? t("common.saving") : t("settings.accountSecurity.saveName")}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <div className="border-b px-4 py-3.5 sm:px-5">
          <h3 className="text-sm font-semibold">{t("settings.accountSecurity.password")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("settings.accountSecurity.passwordHint", { email })}
          </p>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <FieldGroup>
            <PasswordField
              autoComplete="current-password"
              id={currentPasswordId}
              label={t("settings.accountSecurity.currentPassword")}
              onChange={setCurrentPassword}
              onToggle={() => setShowCurrent((v) => !v)}
              value={currentPassword}
              visible={showCurrent}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField
                autoComplete="new-password"
                description={t("settings.accountSecurity.passwordMin")}
                id={newPasswordId}
                label={t("settings.accountSecurity.newPassword")}
                onChange={setNewPassword}
                onToggle={() => setShowNew((v) => !v)}
                value={newPassword}
                visible={showNew}
              />
              <PasswordField
                autoComplete="new-password"
                id={confirmPasswordId}
                label={t("settings.accountSecurity.confirmPassword")}
                onChange={setConfirmPassword}
                onToggle={() => setShowConfirm((v) => !v)}
                value={confirmPassword}
                visible={showConfirm}
              />
            </div>
          </FieldGroup>
          <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/15 px-3 py-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">{t("settings.accountSecurity.signOutOthers")}</p>
              <p className="text-xs text-muted-foreground">
                {t("settings.accountSecurity.signOutOthersHint")}
              </p>
            </div>
            <Switch checked={revokeOtherSessions} onCheckedChange={setRevokeOtherSessions} />
          </div>
          <div className="flex justify-end">
            <Button
              className="rounded-full"
              disabled={savingPassword || !passwordReady}
              onClick={() => void savePassword()}
              size="sm"
              type="button"
            >
              {savingPassword ? t("settings.accountSecurity.updating") : t("settings.accountSecurity.updatePassword")}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <div className="flex flex-col gap-3 border-b px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{t("settings.accountSecurity.devicesTitle")}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.accountSecurity.devicesHint")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {otherSessionCount > 0 ? (
              <Button
                className="rounded-full"
                disabled={loadingSessions || revokingOthers}
                onClick={() => setPendingRevokeOthers(true)}
                size="sm"
                type="button"
                variant="destructive-outline"
              >
                {t("settings.accountSecurity.signOutOthersAction")}
              </Button>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-busy={loadingSessions}
                  aria-label={loadingSessions ? t("settings.accountSecurity.refreshingSessions") : t("settings.accountSecurity.refreshSessions")}
                  className="rounded-full"
                  disabled={loadingSessions}
                  onClick={() => void loadSessions()}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <AppIcons.refresh className={loadingSessions ? "animate-spin" : undefined} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {loadingSessions ? t("settings.accountSecurity.refreshing") : t("settings.accountSecurity.refreshSessions")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          {sessionsError ? (
            <Alert variant="destructive">
              <AlertTitle>{t("settings.accountSecurity.sessionsUnavailable")}</AlertTitle>
              <AlertDescription>{sessionsError}</AlertDescription>
            </Alert>
          ) : null}
          {loadingSessions ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">{t("settings.accountSecurity.loadingSessions")}</p>
          ) : sessions.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">{t("settings.accountSecurity.noSessions")}</p>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {sessions.slice(0, sessionsVisible).map((session) => {
                  const resolvedUa =
                    session.userAgent ||
                    (session.isCurrent ? browserUserAgent : null);
                  const info = parseUserAgent(resolvedUa, t);
                  const ipLabel = formatSessionIp(session.ipAddress, t);
                  return (
                    <li
                      className={cn(
                        "rounded-lg border px-4 py-4",
                        session.isCurrent && "border-primary/25 bg-muted/20",
                      )}
                      key={session.id}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex min-w-0 items-start gap-3.5">
                          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                            <info.DeviceIcon className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">{info.deviceLabel}</p>
                              {session.isCurrent ? (
                                <Badge variant="secondary">{t("settings.accountSecurity.thisDevice")}</Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <info.OsIcon className="size-3.5 shrink-0" />
                                {info.os}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <info.BrowserIcon className="size-3.5 shrink-0" />
                                {info.browser}
                              </span>
                            </div>
                            <div className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                              <p className="inline-flex items-center gap-1.5">
                                <AppIcons.mapPin className="size-3.5 shrink-0" />
                                <span>
                                  {t("settings.accountSecurity.ip")}{" "}
                                  <span className="font-medium text-foreground/80">{ipLabel}</span>
                                </span>
                              </p>
                              <p className="inline-flex items-center gap-1.5">
                                <AppIcons.time className="size-3.5 shrink-0" />
                                <span>
                                  {t("settings.accountSecurity.lastActive")}{" "}
                                  <span className="font-medium text-foreground/80">
                                    {formatDateTime(session.updatedAt, locale)}
                                  </span>
                                </span>
                              </p>
                              <p className="inline-flex items-center gap-1.5 sm:col-span-2">
                                <AppIcons.calendar className="size-3.5 shrink-0" />
                                <span>
                                  {t("settings.accountSecurity.signedIn")}{" "}
                                  <span className="font-medium text-foreground/80">
                                    {formatDateTime(session.createdAt, locale)}
                                  </span>
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                        {session.isCurrent ? (
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("settings.accountSecurity.currentSession")}
                          </p>
                        ) : (
                          <Button
                            className="w-full rounded-full sm:w-auto sm:self-end"
                            disabled={revokingToken === session.token}
                            onClick={() => setPendingRevoke(session)}
                            size="sm"
                            type="button"
                            variant="destructive-outline"
                          >
                            {t("settings.accountSecurity.signOut")}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {sessions.length > sessionsVisible ? (
                <div className="pt-1">
                  <Button
                    className="w-full rounded-full sm:w-auto"
                    onClick={() =>
                      setSessionsVisible((count) => count + SESSIONS_PAGE_SIZE)
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("settings.accountSecurity.showMoreSessions", {
                      remaining: sessions.length - sessionsVisible,
                    })}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="border-t px-4 py-3 sm:px-5">
          <p className="text-xs text-muted-foreground">
            {t("settings.accountSecurity.signOutFooter")}
          </p>
        </div>
      </section>

      <AlertDialog
        open={Boolean(pendingRevoke)}
        onOpenChange={(open) => {
          if (!open && !revokingToken) setPendingRevoke(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.accountSecurity.signOutTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevoke
                ? t("settings.accountSecurity.signOutDesc", {
                    device: `${parseUserAgent(
                      pendingRevoke.userAgent ||
                        (pendingRevoke.isCurrent ? browserUserAgent : null),
                      t,
                    ).deviceLabel}${
                      pendingRevoke.ipAddress ? ` (${pendingRevoke.ipAddress})` : ""
                    }`,
                  })
                : t("settings.accountSecurity.signOutDescGeneric")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={Boolean(revokingToken)}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              variant="destructive"
              disabled={Boolean(revokingToken)}
              onClick={(event) => {
                event.preventDefault();
                void confirmRevokeSession();
              }}
            >
              {revokingToken ? t("settings.accountSecurity.signingOut") : t("settings.accountSecurity.signOutDevice")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingRevokeOthers}
        onOpenChange={(open) => {
          if (!open && !revokingOthers) setPendingRevokeOthers(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.accountSecurity.signOutOthersTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.accountSecurity.signOutOthersDesc", {
                count: otherSessionCount,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={revokingOthers}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              disabled={revokingOthers}
              onClick={(event) => {
                event.preventDefault();
                void confirmRevokeOtherSessions();
              }}
              variant="destructive"
            >
              {revokingOthers
                ? t("settings.accountSecurity.signingOut")
                : t("settings.accountSecurity.signOutOthersConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
