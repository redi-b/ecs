"use client";

import { useId, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useI18n } from "@/i18n/provider";

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const id = useId();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const response = await fetch("/admin/forgot-password/request", {
      body: JSON.stringify({ email }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError(t("auth.recovery.requestError"));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div aria-live="polite">
        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <AppIcons.mail aria-hidden className="size-5" />
        </span>
        <h1 className="mt-5 type-page-title sm:text-[1.35rem]">
          {t("auth.recovery.checkEmailTitle")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("auth.recovery.checkEmailDescription")}
        </p>
        <p className="mt-4 break-all text-sm font-medium">{email}</p>
        <div className="mt-6 grid gap-2.5">
          <Button asChild className="w-full rounded-full" variant="outline">
            <Link href="/admin/sign-in">{t("auth.recovery.backToSignIn")}</Link>
          </Button>
          <Button className="w-full rounded-full" onClick={() => setSent(false)} variant="ghost">
            {t("auth.recovery.useAnotherEmail")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void submit(event)}>
      <div>
        <h1 className="type-page-title sm:text-[1.35rem]">{t("auth.recovery.forgotTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("auth.recovery.forgotDescription")}
        </p>
      </div>
      <FieldGroup>
        <Field data-invalid={Boolean(error) || undefined}>
          <FieldLabel htmlFor={id}>{t("auth.email")}</FieldLabel>
          <Input
            autoComplete="email"
            autoFocus
            disabled={pending}
            id={id}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
            placeholder={t("auth.emailPlaceholder")}
            required
            type="email"
            value={email}
          />
          <FieldDescription>{t("auth.recovery.forgotHint")}</FieldDescription>
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
      </FieldGroup>
      <Button aria-busy={pending} className="h-11 w-full rounded-full" disabled={pending}>
        {pending ? <AppIcons.loader aria-hidden className="animate-spin" /> : null}
        {pending ? t("auth.recovery.sending") : t("auth.recovery.sendLink")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link className="font-medium text-primary hover:underline" href="/admin/sign-in">
          {t("auth.recovery.backToSignIn")}
        </Link>
      </p>
    </form>
  );
}

export function VerificationEmailForm({ initialEmail }: { initialEmail: string }) {
  const { t } = useI18n();
  const id = useId();
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const response = await fetch("/admin/sign-up/check-email/request", {
      body: JSON.stringify({ email }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setError(t("signup.verification.resendError"));
      return;
    }
    setSent(true);
  }

  return (
    <form className="mt-6 space-y-3" onSubmit={(event) => void submit(event)}>
      <Field data-invalid={Boolean(error) || undefined}>
        <FieldLabel htmlFor={id}>{t("auth.email")}</FieldLabel>
        <Input
          autoComplete="email"
          disabled={pending}
          id={id}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
            setSent(false);
          }}
          required
          type="email"
          value={email}
        />
        {error ? <FieldError>{error}</FieldError> : null}
        {sent ? (
          <FieldDescription aria-live="polite" className="text-success">
            {t("signup.verification.resent")}
          </FieldDescription>
        ) : null}
      </Field>
      <Button
        aria-busy={pending}
        className="h-11 w-full rounded-full"
        disabled={pending}
        type="submit"
      >
        {pending ? <AppIcons.loader aria-hidden className="animate-spin" /> : null}
        {pending ? t("signup.verification.sending") : t("signup.verification.resend")}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ invalid, token }: { invalid: boolean; token: string | null }) {
  const { t } = useI18n();
  const id = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unusable = invalid || !token;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || unusable) return;
    if (password.length < 8) return setError(t("auth.recovery.passwordMinimum"));
    if (password !== confirm) return setError(t("auth.recovery.passwordMismatch"));
    setPending(true);
    setError(null);
    const response = await fetch("/admin/reset-password/submit", {
      body: JSON.stringify({ newPassword: password, token }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { error?: string } | null;
    if (!response?.ok) {
      setPending(false);
      setError(
        data?.error === "invalid_token"
          ? t("auth.recovery.invalidLinkDescription")
          : t("auth.recovery.resetError"),
      );
      return;
    }
    window.location.assign("/admin/sign-in?reset=1");
  }

  if (unusable) {
    return (
      <div>
        <h1 className="type-page-title sm:text-[1.35rem]">{t("auth.recovery.invalidLinkTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("auth.recovery.invalidLinkDescription")}
        </p>
        <Button asChild className="mt-6 w-full rounded-full">
          <Link href="/admin/forgot-password">{t("auth.recovery.requestNewLink")}</Link>
        </Button>
      </div>
    );
  }

  const EyeIcon = visible ? AppIcons.eyeOff : AppIcons.eye;
  return (
    <form className="space-y-6" onSubmit={(event) => void submit(event)}>
      <div>
        <h1 className="type-page-title sm:text-[1.35rem]">{t("auth.recovery.resetTitle")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("auth.recovery.resetDescription")}
        </p>
      </div>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={`${id}-password`}>{t("auth.recovery.newPassword")}</FieldLabel>
          <InputGroup>
            <InputGroupInput
              autoComplete="new-password"
              autoFocus
              id={`${id}-password`}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              required
              type={visible ? "text" : "password"}
              value={password}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
                onClick={() => setVisible((value) => !value)}
                size="icon-xs"
              >
                <EyeIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>{t("auth.recovery.passwordMinimum")}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(error) || undefined}>
          <FieldLabel htmlFor={`${id}-confirm`}>{t("auth.confirmPassword")}</FieldLabel>
          <Input
            autoComplete="new-password"
            id={`${id}-confirm`}
            onChange={(event) => {
              setConfirm(event.target.value);
              setError(null);
            }}
            required
            type={visible ? "text" : "password"}
            value={confirm}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
      </FieldGroup>
      <Button aria-busy={pending} className="h-11 w-full rounded-full" disabled={pending}>
        {pending ? <AppIcons.loader aria-hidden className="animate-spin" /> : null}
        {pending ? t("auth.recovery.saving") : t("auth.recovery.savePassword")}
      </Button>
    </form>
  );
}
