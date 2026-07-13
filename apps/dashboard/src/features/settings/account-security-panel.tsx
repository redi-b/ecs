"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useActorOrFallback } from "@/components/app/actor-context";
import { AppIcons, type AppIcon } from "@/components/app/icons";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

type DeviceInfo = {
  browser: string;
  BrowserIcon: AppIcon;
  deviceLabel: string;
  DeviceIcon: AppIcon;
  os: string;
  OsIcon: AppIcon;
};

export function AccountSecurityPanel({
  email,
  initialName,
}: {
  email: string;
  initialName: string | null;
}) {
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
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<AccountSession | null>(null);

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
          ? "Session list blocked by auth origin settings. Restart platform-api after updating trusted origins."
          : "Could not load active sessions.",
      );
      setLoadingSessions(false);
      return;
    }

    setSessions(data?.sessions ?? []);
    setLoadingSessions(false);
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    setName(initialName ?? "");
  }, [initialName]);

  async function saveProfile() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Enter a name with at least 2 characters.");
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
          ? "Profile update blocked by auth origin settings."
          : "Could not update your profile.",
      );
      return;
    }

    setActorName(trimmed);
    toast.success("Profile updated.");
    router.refresh();
  }

  async function savePassword() {
    if (!currentPassword || !newPassword) {
      toast.error("Enter your current and new password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
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
          ? "Current password is incorrect."
          : data?.error === "password_too_short"
            ? "New password must be at least 8 characters."
            : data?.error === "auth_origin_rejected"
              ? "Password change blocked by auth origin settings."
              : "Could not change password.",
      );
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success(
      revokeOtherSessions
        ? "Password updated. Other devices were signed out."
        : "Password updated.",
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
          ? "You cannot sign out this device from here."
          : data?.error === "auth_origin_rejected"
            ? "Revoke blocked by auth origin settings."
            : "Could not sign out that session.",
      );
      return;
    }

    toast.success("Session signed out.");
    void loadSessions();
  }

  const initials = getInitials(name.trim() || email);
  const nameDirty = name.trim() !== (initialName ?? "").trim();
  const passwordReady =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Account</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Profile and sign-in security for your dashboard login.
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-3.5 border-b bg-muted/25 px-4 py-4 sm:px-5">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold tracking-wide text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name.trim() || "Add your name"}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <Field>
            <FieldLabel htmlFor={nameId}>Display name</FieldLabel>
            <Input
              id={nameId}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              value={name}
            />
            <FieldDescription>Shown in the sidebar and across this shop.</FieldDescription>
          </Field>
          <div className="flex justify-end">
            <Button
              className="rounded-full"
              disabled={savingProfile || !nameDirty}
              onClick={() => void saveProfile()}
              size="sm"
              type="button"
            >
              {savingProfile ? "Saving…" : "Save name"}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <div className="border-b px-4 py-3.5 sm:px-5">
          <h3 className="text-sm font-semibold">Password</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Change the password used with {email}.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <FieldGroup>
            <PasswordField
              autoComplete="current-password"
              id={currentPasswordId}
              label="Current password"
              onChange={setCurrentPassword}
              onToggle={() => setShowCurrent((v) => !v)}
              value={currentPassword}
              visible={showCurrent}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField
                autoComplete="new-password"
                description="At least 8 characters."
                id={newPasswordId}
                label="New password"
                onChange={setNewPassword}
                onToggle={() => setShowNew((v) => !v)}
                value={newPassword}
                visible={showNew}
              />
              <PasswordField
                autoComplete="new-password"
                id={confirmPasswordId}
                label="Confirm new password"
                onChange={setConfirmPassword}
                onToggle={() => setShowConfirm((v) => !v)}
                value={confirmPassword}
                visible={showConfirm}
              />
            </div>
          </FieldGroup>
          <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/15 px-3 py-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">Sign out other devices</p>
              <p className="text-xs text-muted-foreground">
                Ends every other session after the password changes. This device stays signed in.
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
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Signed-in devices</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Active browsers for this account. Remove any you do not recognize.
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-busy={loadingSessions}
                aria-label={loadingSessions ? "Refreshing sessions" : "Refresh sessions"}
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
              {loadingSessions ? "Refreshing" : "Refresh sessions"}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          {sessionsError ? (
            <Alert variant="destructive">
              <AlertTitle>Sessions unavailable</AlertTitle>
              <AlertDescription>{sessionsError}</AlertDescription>
            </Alert>
          ) : null}
          {loadingSessions ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">No active sessions found.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sessions.map((session) => {
                const info = parseUserAgent(session.userAgent);
                return (
                  <li
                    className={cn(
                      "rounded-lg border px-4 py-4",
                      session.isCurrent && "border-primary/25 bg-muted/20",
                    )}
                    key={session.id}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3.5">
                        <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                          <info.DeviceIcon className="size-5" />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{info.deviceLabel}</p>
                            {session.isCurrent ? (
                              <Badge variant="secondary">This device</Badge>
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
                                IP{" "}
                                <span className="font-medium text-foreground/80">
                                  {session.ipAddress || "Unknown"}
                                </span>
                              </span>
                            </p>
                            <p className="inline-flex items-center gap-1.5">
                              <AppIcons.time className="size-3.5 shrink-0" />
                              <span>
                                Last active{" "}
                                <span className="font-medium text-foreground/80">
                                  {formatDateTime(session.updatedAt)}
                                </span>
                              </span>
                            </p>
                            <p className="inline-flex items-center gap-1.5 sm:col-span-2">
                              <AppIcons.calendar className="size-3.5 shrink-0" />
                              <span>
                                Signed in{" "}
                                <span className="font-medium text-foreground/80">
                                  {formatDateTime(session.createdAt)}
                                </span>
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                      {session.isCurrent ? (
                        <span className="self-start text-xs font-medium text-muted-foreground sm:pt-1">
                          Current session
                        </span>
                      ) : (
                        <Button
                          className="rounded-full shrink-0 self-start"
                          disabled={revokingToken === session.token}
                          onClick={() => setPendingRevoke(session)}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          Sign out
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t px-4 py-3 sm:px-5">
          <p className="text-xs text-muted-foreground">
            Signing out a device ends its access until the next successful sign-in.
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
            <AlertDialogTitle>Sign out this device?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevoke
                ? `${parseUserAgent(pendingRevoke.userAgent).deviceLabel}${
                    pendingRevoke.ipAddress ? ` (${pendingRevoke.ipAddress})` : ""
                  } will need to sign in again to access the dashboard.`
                : "This device will need to sign in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={Boolean(revokingToken)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(revokingToken)}
              onClick={(event) => {
                event.preventDefault();
                void confirmRevokeSession();
              }}
            >
              {revokingToken ? "Signing out…" : "Sign out device"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PasswordField({
  autoComplete,
  description,
  id,
  label,
  onChange,
  onToggle,
  value,
  visible,
}: {
  autoComplete: string;
  description?: string | undefined;
  id: string;
  label: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  value: string;
  visible: boolean;
}) {
  // Eye = password is hidden (click to show). Eye-off = password is visible (click to hide).
  const PasswordIcon = visible ? AppIcons.eyeOff : AppIcons.eye;
  const tip = visible ? "Hide password" : "Show password";

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          autoComplete={autoComplete}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? "text" : "password"}
          value={value}
        />
        <InputGroupAddon align="inline-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <InputGroupButton
                aria-label={tip}
                onClick={onToggle}
                size="icon-xs"
                type="button"
              >
                <PasswordIcon />
              </InputGroupButton>
            </TooltipTrigger>
            <TooltipContent>{tip}</TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

function parseUserAgent(userAgent: string | null): DeviceInfo {
  const ua = userAgent?.toLowerCase() ?? "";
  const raw = userAgent?.trim() || "";

  const isIos = /iphone|ipad|ipod/.test(ua);
  const isAndroid = ua.includes("android");
  const isMobile = isIos || isAndroid || /mobile|opera mini/.test(ua);
  const isMac = ua.includes("mac os") || ua.includes("macintosh");
  const isWindows = ua.includes("windows");
  const isLinux = ua.includes("linux") && !isAndroid;

  let DeviceIcon: AppIcon = AppIcons.computer;
  let deviceLabel = "Desktop";
  if (isIos && ua.includes("ipad")) {
    DeviceIcon = AppIcons.smartphone;
    deviceLabel = "iPad";
  } else if (isIos) {
    DeviceIcon = AppIcons.smartphone;
    deviceLabel = "iPhone";
  } else if (isAndroid && isMobile) {
    DeviceIcon = AppIcons.smartphone;
    deviceLabel = "Android phone";
  } else if (isMac) {
    DeviceIcon = AppIcons.macbook;
    deviceLabel = "Mac";
  } else if (isWindows) {
    DeviceIcon = AppIcons.computer;
    deviceLabel = "Windows PC";
  } else if (isLinux) {
    DeviceIcon = AppIcons.computer;
    deviceLabel = "Linux PC";
  } else if (isMobile) {
    DeviceIcon = AppIcons.smartphone;
    deviceLabel = "Mobile device";
  } else if (!raw) {
    DeviceIcon = AppIcons.global;
    deviceLabel = "Unknown device";
  }

  let OsIcon: AppIcon = AppIcons.global;
  let os = "Unknown OS";
  if (isIos) {
    OsIcon = AppIcons.apple;
    const match = raw.match(/OS (\d+[._]\d+)/i);
    os = match ? `iOS ${match[1]?.replace("_", ".")}` : "iOS";
  } else if (isAndroid) {
    OsIcon = AppIcons.android;
    const match = raw.match(/Android ([\d.]+)/i);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (isMac) {
    OsIcon = AppIcons.apple;
    const match = raw.match(/Mac OS X ([\d_]+)/i);
    os = match ? `macOS ${match[1]?.replaceAll("_", ".")}` : "macOS";
  } else if (isWindows) {
    OsIcon = AppIcons.windows;
    if (ua.includes("windows nt 10")) os = "Windows 10/11";
    else if (ua.includes("windows nt 6.3")) os = "Windows 8.1";
    else if (ua.includes("windows nt 6.1")) os = "Windows 7";
    else os = "Windows";
  } else if (isLinux) {
    OsIcon = AppIcons.ubuntu;
    os = "Linux";
  }

  let BrowserIcon: AppIcon = AppIcons.global;
  let browser = "Unknown browser";
  if (ua.includes("edg/") || ua.includes("edgios") || ua.includes("edga")) {
    BrowserIcon = AppIcons.edge;
    browser = "Microsoft Edge";
  } else if (ua.includes("firefox") || ua.includes("fxios")) {
    BrowserIcon = AppIcons.firefox;
    browser = "Firefox";
  } else if (ua.includes("crios") || (ua.includes("chrome") && !ua.includes("edg"))) {
    BrowserIcon = AppIcons.chrome;
    browser = "Chrome";
  } else if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("crios")) {
    BrowserIcon = AppIcons.safari;
    browser = "Safari";
  } else if (raw) {
    browser = "Browser";
  }

  return { browser, BrowserIcon, deviceLabel, DeviceIcon, os, OsIcon };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getInitials(value: string) {
  const [first = "", second = ""] = value
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return `${first.charAt(0)}${second.charAt(0) || first.charAt(1) || ""}`.toUpperCase() || "?";
}
