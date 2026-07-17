"use client";

import { useId, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";

export function SignInForm({
  errorMessage: initialErrorMessage,
  nextPath,
}: {
  errorMessage: string | null;
  nextPath: string;
}) {
  const fieldId = useId();
  const { t } = useI18n();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const PasswordIcon = isPasswordVisible ? AppIcons.eyeOff : AppIcons.eye;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await fetch("/admin/session", {
      body: JSON.stringify({ email, next: nextPath, password }),
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
      setErrorMessage(mapAuthError(data?.error, t));
      setIsSubmitting(false);
      return;
    }

    // Full navigation so the new session cookies hydrate server components.
    window.location.assign(data.redirectTo);
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)}>
      <input name="next" type="hidden" value={nextPath} />
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={`${fieldId}-email`}>{t("auth.email")}</FieldLabel>
          <InputGroup className="h-11 rounded-xl bg-background px-1 transition-colors hover:border-ring/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
            <InputGroupInput
              autoComplete="email"
              autoFocus
              className="px-3 text-sm"
              disabled={isSubmitting}
              id={`${fieldId}-email`}
              name="email"
              placeholder={t("auth.emailPlaceholder")}
              required
              type="email"
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${fieldId}-password`}>{t("auth.password")}</FieldLabel>
          <InputGroup className="h-11 rounded-xl bg-background px-1 transition-colors hover:border-ring/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
            <InputGroupInput
              autoComplete="current-password"
              className="px-3 text-sm"
              disabled={isSubmitting}
              id={`${fieldId}-password`}
              name="password"
              required
              type={isPasswordVisible ? "text" : "password"}
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
          <FieldDescription>{t("auth.passwordHelp")}</FieldDescription>
        </Field>
        {errorMessage ? (
          <Field data-invalid>
            <FieldError>{errorMessage}</FieldError>
          </Field>
        ) : null}
      </FieldGroup>
      <Button
        aria-busy={isSubmitting}
        className="h-11 w-full rounded-xl text-sm font-semibold"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <>
            <AppIcons.loader className="animate-spin" data-icon="inline-start" />
            {t("auth.signingIn")}
          </>
        ) : (
          t("auth.signIn")
        )}
      </Button>
    </form>
  );
}

function mapAuthError(code: string | undefined, t: (key: MessageKey) => string) {
  switch (code) {
    case "missing_email":
      return t("auth.error.missingEmail");
    case "missing_password":
      return t("auth.error.missingPassword");
    case "invalid_credentials":
      return t("auth.error.invalidCredentials");
    case "auth_unavailable":
      return t("auth.error.unavailable");
    case "shop_not_found":
      return t("auth.error.shopNotFound");
    case "shop_unavailable":
      return t("auth.error.shopUnavailable");
    case "shop_access_denied":
      return t("auth.error.shopAccessDenied");
    default:
      return t("auth.error.failed");
  }
}
