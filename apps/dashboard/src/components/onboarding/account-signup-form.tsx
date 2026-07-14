"use client";

import Link from "@/components/app/link";
import { useId, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";

export function AccountSignUpForm({
  defaultValues,
  errorMessage: initialErrorMessage,
}: {
  defaultValues: {
    email?: string | undefined;
    ownerName?: string | undefined;
  };
  errorMessage: string | null;
}) {
  const fieldId = useId();
  const { t } = useI18n();
  const [ownerName, setOwnerName] = useState(defaultValues.ownerName ?? "");
  const [email, setEmail] = useState(defaultValues.email ?? "");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const PasswordIcon = isPasswordVisible ? AppIcons.eyeOff : AppIcons.eye;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await fetch("/admin/sign-up/submit", {
      body: JSON.stringify({ email, ownerName, password }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    }).catch(() => null);

    const data = (await response?.json().catch(() => null)) as {
      error?: string;
      ok?: boolean;
      redirectTo?: string;
    } | null;

    if (!response?.ok || !data?.ok || !data.redirectTo) {
      setErrorMessage(mapSignupError(data?.error, t));
      setIsSubmitting(false);
      return;
    }

    window.location.assign(data.redirectTo);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-9">
      <div className="mb-7">
        <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {t("auth.merchantConsole")}
        </p>
        <h2 className="mt-2.5 text-xl font-semibold tracking-tight sm:text-[1.35rem]">
          {t("auth.createAccountTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("auth.createAccountDescription")}
        </p>
      </div>

      <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)}>
        <Field>
          <FieldLabel htmlFor={`${fieldId}-ownerName`}>{t("auth.ownerName")}</FieldLabel>
          <InputGroup className="h-11 rounded-xl bg-background px-1 transition-colors hover:border-ring/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
            <InputGroupInput
              autoComplete="name"
              autoFocus
              className="px-3 text-sm"
              disabled={isSubmitting}
              id={`${fieldId}-ownerName`}
              name="ownerName"
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="Mahi Bekele"
              required
              value={ownerName}
            />
          </InputGroup>
          <FieldDescription>{t("auth.ownerNameHelp")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${fieldId}-email`}>{t("auth.workEmail")}</FieldLabel>
          <InputGroup className="h-11 rounded-xl bg-background px-1 transition-colors hover:border-ring/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
            <InputGroupInput
              autoComplete="email"
              className="px-3 text-sm"
              disabled={isSubmitting}
              id={`${fieldId}-email`}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="mahi@example.com"
              required
              type="email"
              value={email}
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${fieldId}-password`}>{t("auth.password")}</FieldLabel>
          <InputGroup className="h-11 rounded-xl bg-background px-1 transition-colors hover:border-ring/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
            <InputGroupInput
              autoComplete="new-password"
              className="px-3 text-sm"
              disabled={isSubmitting}
              id={`${fieldId}-password`}
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type={isPasswordVisible ? "text" : "password"}
              value={password}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={isPasswordVisible ? t("auth.hidePassword") : t("auth.showPassword")}
                disabled={isSubmitting}
                onClick={() => setIsPasswordVisible((value) => !value)}
                size="icon-xs"
              >
                <PasswordIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>{t("auth.passwordMinimum")}</FieldDescription>
        </Field>
        {errorMessage ? (
          <Field data-invalid>
            <FieldError>{errorMessage}</FieldError>
          </Field>
        ) : null}
        <Button
          aria-busy={isSubmitting}
          className="mt-2 h-11 w-full rounded-xl text-sm font-semibold"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <AppIcons.loader className="animate-spin" data-icon="inline-start" />
              {t("auth.creatingAccount")}
            </>
          ) : (
            t("auth.createAccountCta")
          )}
        </Button>
      </form>

      <p className="mt-7 border-t pt-6 text-center text-sm text-muted-foreground">
        {t("auth.alreadyRegistered")}{" "}
        <Link
          className="font-medium text-primary underline-offset-4 hover:underline"
          href="/admin/sign-in"
        >
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}

function mapSignupError(code: string | undefined, t: (key: MessageKey) => string) {
  switch (code) {
    case "auth_session_missing":
      return t("signup.error.sessionMissing");
    case "auth_unavailable":
      return t("signup.error.unavailable");
    case "email_already_exists":
      return t("signup.error.emailExists");
    case "missing_required_fields":
      return t("signup.error.required");
    case "password_too_short":
      return t("signup.error.passwordShort");
    default:
      return t("signup.error.failed");
  }
}
