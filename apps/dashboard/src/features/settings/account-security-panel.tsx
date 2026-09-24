"use client";

import { defaultProfileAvatar, type ProfileAvatarPreferences } from "@ecs/contracts";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { useActorOrFallback } from "@/components/app/actor-context";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { AppIcons } from "@/components/app/icons";
import { ProfileAvatar } from "@/components/app/profile-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatDateTime,
  formatSessionIp,
  PasswordField,
  parseUserAgent,
} from "@/features/settings/account-security-parts";
import { ProfileAvatarEditor } from "@/features/settings/profile-avatar-editor";
import { SectionIntro, SettingsSectionBody } from "@/features/settings/settings-sections";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const SESSIONS_PAGE_SIZE = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  onDirtyChange,
}: {
  email: string;
  initialName: string | null;
  onDirtyChange?: (changes: readonly string[]) => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { actor, setActorName, setActorAvatar } = useActorOrFallback({
    email,
    id: "",
    name: initialName,
    role: "owner",
  });
  const nameId = useId();
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();
  const emailId = useId();

  const [name, setName] = useState(initialName ?? "");
  const [avatar, setAvatar] = useState<ProfileAvatarPreferences>(
    actor.avatar ?? defaultProfileAvatar,
  );
  const [savedAvatar, setSavedAvatar] = useState<ProfileAvatarPreferences>(
    actor.avatar ?? defaultProfileAvatar,
  );
  const [avatarDraft, setAvatarDraft] = useState<ProfileAvatarPreferences>(
    actor.avatar ?? defaultProfileAvatar,
  );
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const avatarDirty =
    avatar.color !== savedAvatar.color ||
    avatar.variation !== savedAvatar.variation ||
    avatar.eyes !== savedAvatar.eyes ||
    avatar.angle !== savedAvatar.angle;
  useEffect(() => {
    const next = actor.avatar ?? defaultProfileAvatar;
    setAvatar(next);
    setSavedAvatar(next);
    setAvatarDraft(next);
  }, [actor.avatar]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [accountEmail, setAccountEmail] = useState(email);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [emailStateLoading, setEmailStateLoading] = useState(true);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);

  const accountDirty = useMemo(() => {
    const nameDirty = name.trim() !== (initialName ?? "").trim();
    const passwordDirty =
      currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;
    return (
      nameDirty || avatarDirty || passwordDirty || (editingEmail && newEmail.trim().length > 0)
    );
  }, [
    avatarDirty,
    confirmPassword,
    currentPassword,
    editingEmail,
    initialName,
    name,
    newEmail,
    newPassword,
  ]);

  const accountChanges = useMemo(() => {
    const changes: string[] = [];
    if (name.trim() !== (initialName ?? "").trim()) {
      changes.push(t("settings.accountSecurity.displayName"));
    }
    if (avatarDirty) changes.push(t("settings.accountSecurity.avatar.title"));
    if (editingEmail && newEmail.trim().length > 0) {
      changes.push(t("settings.accountSecurity.emailTitle"));
    }
    if (currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0) {
      changes.push(t("settings.accountSecurity.password"));
    }
    return changes;
  }, [
    avatarDirty,
    confirmPassword,
    currentPassword,
    editingEmail,
    initialName,
    name,
    newEmail,
    newPassword,
    t,
  ]);

  useEffect(() => {
    onDirtyChange?.(accountDirty ? accountChanges : []);
    return () => onDirtyChange?.([]);
  }, [accountChanges, accountDirty, onDirtyChange]);

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
    const response = await fetch("/dashboard/account/sessions", {
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

  useEffect(() => {
    const url = new URL(window.location.href);
    const verified = url.searchParams.get("verified") === "1";
    const emailChanged = url.searchParams.get("emailChanged") === "1";
    if (!verified && !emailChanged) return;
    toast.success(
      verified
        ? t("settings.accountSecurity.toast.emailVerified")
        : t("settings.accountSecurity.toast.emailChanged"),
    );
    url.searchParams.delete("verified");
    url.searchParams.delete("emailChanged");
    const query = url.searchParams.toString();
    router.replace(query ? `${url.pathname}?${query}` : url.pathname, { scroll: false });
  }, [router, t]);

  useEffect(() => {
    let active = true;
    void fetch("/dashboard/account/email", { headers: { accept: "application/json" } })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as {
          email?: string;
          emailVerified?: boolean;
        } | null;
        if (!active) return;
        if (response.ok && data?.email) {
          setAccountEmail(data.email);
          setEmailVerified(data.emailVerified === true);
        }
        setEmailStateLoading(false);
      })
      .catch(() => {
        if (active) setEmailStateLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function requestEmailChange() {
    const value = newEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value) || value.length > 320) {
      toast.error(t("settings.accountSecurity.toast.emailInvalid"));
      return;
    }
    if (value === accountEmail.toLowerCase()) {
      toast.error(t("settings.accountSecurity.toast.emailUnchanged"));
      return;
    }
    setSavingEmail(true);
    const response = await fetch("/dashboard/account/email", {
      body: JSON.stringify({ newEmail: value }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setSavingEmail(false);
    const data = (await response?.json().catch(() => null)) as { error?: string } | null;
    if (!response?.ok) {
      toast.error(
        data?.error === "email_unchanged"
          ? t("settings.accountSecurity.toast.emailUnchanged")
          : t("settings.accountSecurity.toast.emailChangeFailed"),
      );
      return;
    }
    setEditingEmail(false);
    setNewEmail("");
    toast.success(t("settings.accountSecurity.toast.emailChangeSent"));
  }

  async function resendVerification() {
    setResendingVerification(true);
    const response = await fetch("/dashboard/account/verification", {
      headers: { accept: "application/json" },
      method: "POST",
    }).catch(() => null);
    setResendingVerification(false);
    if (!response?.ok) {
      toast.error(t("settings.accountSecurity.toast.verificationFailed"));
      return;
    }
    toast.success(t("settings.accountSecurity.toast.verificationSent"));
  }

  async function saveProfile() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error(t("settings.accountSecurity.toast.nameMin"));
      return;
    }
    setSavingProfile(true);
    const response = await fetch("/dashboard/account/profile", {
      body: JSON.stringify({ name: trimmed, avatar }),
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
    setSavedAvatar(avatar);
    setActorAvatar(avatar);
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
    const response = await fetch("/dashboard/account/password", {
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
    const response = await fetch("/dashboard/account/sessions", {
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
    const response = await fetch("/dashboard/account/sessions", {
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

  const nameDirty = name.trim() !== (initialName ?? "").trim();
  const passwordReady =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <SettingsSectionBody>
      <SectionIntro title={t("settings.accountSecurity.title")} />

      <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/[0.08] shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
        <div className="flex items-center gap-3.5 border-b border-border/60 bg-muted/20 px-4 py-3.5 sm:px-4">
          <Dialog
            open={avatarDialogOpen}
            onOpenChange={(open) => {
              if (open) setAvatarDraft(avatar);
              setAvatarDialogOpen(open);
            }}
          >
            <DialogTrigger asChild>
              <button
                aria-label={t("settings.accountSecurity.avatar.edit")}
                className="group/avatar-edit relative shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={savingProfile}
                type="button"
              >
                <ProfileAvatar
                  className="size-11 transition-[filter,transform] duration-150 group-hover/avatar-edit:brightness-75 group-active/avatar-edit:scale-[0.96]"
                  userId={actor.id}
                  name={name}
                  preferences={avatar}
                />
                <span className="pointer-events-none absolute inset-0 hidden place-items-center rounded-full bg-black/35 text-white opacity-0 transition-opacity duration-150 group-hover/avatar-edit:grid group-hover/avatar-edit:opacity-100 group-focus-visible/avatar-edit:grid group-focus-visible/avatar-edit:opacity-100 sm:grid">
                  <AppIcons.edit className="size-4" aria-hidden />
                </span>
                <span className="pointer-events-none absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card sm:hidden">
                  <AppIcons.edit className="size-3" aria-hidden />
                </span>
              </button>
            </DialogTrigger>
            <DialogContent
              className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl p-0 sm:max-w-3xl"
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <DialogHeader className="px-4 pt-4 pr-10">
                <DialogTitle>{t("settings.accountSecurity.avatar.title")}</DialogTitle>
                <DialogDescription>{t("settings.accountSecurity.avatar.hint")}</DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto px-4 pb-4">
                <ProfileAvatarEditor
                  userId={actor.id}
                  name={name}
                  value={avatarDraft}
                  onChange={setAvatarDraft}
                  disabled={savingProfile}
                />
              </div>
              <DialogFooter className="mx-0 mb-0 rounded-none">
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    {t("common.cancel")}
                  </Button>
                </DialogClose>
                <Button
                  disabled={savingProfile}
                  onClick={() => {
                    setAvatar(avatarDraft);
                    setAvatarDialogOpen(false);
                  }}
                  type="button"
                >
                  {t("settings.accountSecurity.avatar.use")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {name.trim() || t("settings.accountSecurity.addName")}
            </p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-4 py-3.5 sm:px-4">
          <Field>
            <FieldLabel htmlFor={nameId}>{t("settings.accountSecurity.displayName")}</FieldLabel>
            <Input
              id={nameId}
              disabled={savingProfile}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("settings.accountSecurity.namePlaceholder")}
              value={name}
            />
            <FieldDescription>{t("settings.accountSecurity.nameHint")}</FieldDescription>
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={savingProfile || (!nameDirty && !avatarDirty)}
              onClick={() => {
                setName(initialName ?? "");
                setAvatar(savedAvatar);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="w-full rounded-full sm:w-auto"
              disabled={savingProfile || (!nameDirty && !avatarDirty)}
              onClick={() => void saveProfile()}
              size="sm"
              type="button"
            >
              {savingProfile ? t("common.saving") : t("settings.accountSecurity.saveName")}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/[0.08] shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5">
          <div className="min-w-0">
            <h3 className="text-sm font-medium tracking-tight">
              {t("settings.accountSecurity.emailTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.accountSecurity.emailDescription")}
            </p>
          </div>
          {!emailStateLoading && emailVerified !== null ? (
            <Badge variant={emailVerified ? "secondary" : "outline"}>
              {emailVerified
                ? t("settings.accountSecurity.emailVerified")
                : t("settings.accountSecurity.emailNotVerified")}
            </Badge>
          ) : null}
        </div>
        <div className="space-y-4 px-4 py-3.5">
          {editingEmail ? (
            <Field>
              <FieldLabel htmlFor={emailId}>{t("settings.accountSecurity.newEmail")}</FieldLabel>
              <Input
                autoComplete="email"
                autoFocus
                disabled={savingEmail}
                id={emailId}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                type="email"
                value={newEmail}
              />
              <FieldDescription>{t("settings.accountSecurity.emailChangeHint")}</FieldDescription>
            </Field>
          ) : (
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {t("settings.accountSecurity.currentEmail")}
              </p>
              <p className="mt-1 truncate text-sm font-medium">{accountEmail}</p>
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {!emailStateLoading && emailVerified === false && !editingEmail ? (
              <Button
                disabled={resendingVerification}
                onClick={() => void resendVerification()}
                size="sm"
                type="button"
                variant="ghost"
              >
                {resendingVerification
                  ? t("settings.accountSecurity.sendingVerification")
                  : t("settings.accountSecurity.resendVerification")}
              </Button>
            ) : null}
            {editingEmail ? (
              <>
                <Button
                  disabled={savingEmail}
                  onClick={() => {
                    setEditingEmail(false);
                    setNewEmail("");
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  disabled={savingEmail || !newEmail.trim()}
                  onClick={() => void requestEmailChange()}
                  size="sm"
                  type="button"
                >
                  {savingEmail
                    ? t("common.saving")
                    : t("settings.accountSecurity.continueEmailChange")}
                </Button>
              </>
            ) : (
              <Button
                disabled={emailStateLoading}
                onClick={() => setEditingEmail(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("settings.accountSecurity.changeEmail")}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/[0.08] shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
        <div className="border-b border-border/60 px-4 py-2.5 sm:px-4">
          <h3 className="text-sm font-medium tracking-tight">
            {t("settings.accountSecurity.password")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("settings.accountSecurity.passwordHint", { email })}
          </p>
        </div>
        <div className="flex flex-col gap-4 px-4 py-3.5 sm:px-4">
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
              className="w-full rounded-full sm:w-auto"
              disabled={savingPassword || !passwordReady}
              onClick={() => void savePassword()}
              size="sm"
              type="button"
            >
              {savingPassword
                ? t("settings.accountSecurity.updating")
                : t("settings.accountSecurity.updatePassword")}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/[0.08] shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
        <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:px-4">
          <div className="min-w-0">
            <h3 className="text-sm font-medium tracking-tight">
              {t("settings.accountSecurity.devicesTitle")}
            </h3>
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
                  aria-label={
                    loadingSessions
                      ? t("settings.accountSecurity.refreshingSessions")
                      : t("settings.accountSecurity.refreshSessions")
                  }
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
                {loadingSessions
                  ? t("settings.accountSecurity.refreshing")
                  : t("settings.accountSecurity.refreshSessions")}
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
            <p className="px-1 py-3 text-sm text-muted-foreground">
              {t("settings.accountSecurity.loadingSessions")}
            </p>
          ) : sessions.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">
              {t("settings.accountSecurity.noSessions")}
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {sessions.slice(0, sessionsVisible).map((session) => {
                  const resolvedUa =
                    session.userAgent || (session.isCurrent ? browserUserAgent : null);
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
                                <Badge variant="secondary">
                                  {t("settings.accountSecurity.thisDevice")}
                                </Badge>
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
                    onClick={() => setSessionsVisible((count) => count + SESSIONS_PAGE_SIZE)}
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

      <ConfirmDialog
        cancelDisabled={Boolean(revokingToken)}
        confirmDisabled={Boolean(revokingToken)}
        confirmLabel={
          revokingToken
            ? t("settings.accountSecurity.signingOut")
            : t("settings.accountSecurity.signOutDevice")
        }
        description={
          pendingRevoke
            ? t("settings.accountSecurity.signOutDesc", {
                device: `${
                  parseUserAgent(
                    pendingRevoke.userAgent || (pendingRevoke.isCurrent ? browserUserAgent : null),
                    t,
                  ).deviceLabel
                }${pendingRevoke.ipAddress ? ` (${pendingRevoke.ipAddress})` : ""}`,
              })
            : t("settings.accountSecurity.signOutDescGeneric")
        }
        icon="logout"
        onConfirm={() => {
          void confirmRevokeSession();
        }}
        onOpenChange={(open) => {
          if (!open && !revokingToken) setPendingRevoke(null);
        }}
        open={Boolean(pendingRevoke)}
        title={t("settings.accountSecurity.signOutTitle")}
        tone="destructive"
      />

      <ConfirmDialog
        cancelDisabled={revokingOthers}
        confirmDisabled={revokingOthers}
        confirmLabel={
          revokingOthers
            ? t("settings.accountSecurity.signingOut")
            : t("settings.accountSecurity.signOutOthersConfirm")
        }
        description={t("settings.accountSecurity.signOutOthersDesc", {
          count: otherSessionCount,
        })}
        icon="logout"
        onConfirm={() => {
          void confirmRevokeOtherSessions();
        }}
        onOpenChange={(open) => {
          if (!open && !revokingOthers) setPendingRevokeOthers(false);
        }}
        open={pendingRevokeOthers}
        title={t("settings.accountSecurity.signOutOthersTitle")}
        tone="destructive"
      />
    </SettingsSectionBody>
  );
}
