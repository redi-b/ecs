"use client";

import { ethiopianPhoneSchema } from "@ecs/contracts";
import { useId, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { EthiopianPhoneInput } from "@/components/ui/ethiopian-phone-input";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/provider";

export function AccountCompletionForm({
  initialPhone,
  nextPath,
  requiresEmail,
}: {
  initialPhone?: string | null;
  nextPath: string;
  requiresEmail: boolean;
}) {
  const fieldId = useId();
  const { t } = useI18n();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [phoneEditing, setPhoneEditing] = useState(!initialPhone);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!ethiopianPhoneSchema.safeParse(phone).success) {
      setError(t("auth.completion.invalidPhone"));
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const response = await fetch("/complete-account/submit", {
      body: JSON.stringify({ email, next: nextPath, phone }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as {
      emailVerificationRequired?: boolean;
      error?: string;
      redirectTo?: string;
    } | null;

    if (!response?.ok || !result?.redirectTo) {
      setError(
        result?.error === "invalid_email" || result?.error === "missing_email"
          ? t("auth.completion.invalidEmail")
          : result?.error === "invalid_phone"
            ? t("auth.completion.invalidPhone")
            : result?.error === "auth_required"
              ? t("auth.completion.sessionExpired")
              : t("auth.completion.failed"),
      );
      setIsSubmitting(false);
      return;
    }

    if (result.emailVerificationRequired) {
      window.location.assign(result.redirectTo);
      return;
    }
    window.location.assign(result.redirectTo);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-[1.35rem]">
          {t("auth.completion.title")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {requiresEmail
            ? t("auth.completion.telegramDescription")
            : t("auth.completion.description")}
        </p>
      </div>

      <form className="flex flex-col gap-5" onSubmit={(event) => void onSubmit(event)}>
        {requiresEmail ? (
          <div className="grid gap-2">
            <Label htmlFor={`${fieldId}-email`}>{t("auth.email")}</Label>
            <Input
              autoComplete="email"
              disabled={isSubmitting}
              id={`${fieldId}-email`}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              required
              type="email"
              value={email}
            />
          </div>
        ) : null}
        <EthiopianPhoneInput
          disabled={isSubmitting || !phoneEditing}
          errorMessage={t("auth.completion.invalidPhone")}
          id={`${fieldId}-phone`}
          label={t("auth.accountPhone")}
          onChange={setPhone}
          readOnly={!phoneEditing}
          required
          size="lg"
          value={phone}
        />
        {initialPhone && !phoneEditing ? (
          <button
            className="-mt-3 self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setPhoneEditing(true)}
            type="button"
          >
            {t("auth.completion.changePhone")}
          </button>
        ) : null}

        {error ? (
          <Field data-invalid>
            <FieldError>{error}</FieldError>
          </Field>
        ) : null}

        <Button
          aria-busy={isSubmitting}
          className="w-full text-sm font-semibold"
          disabled={isSubmitting}
          size="lg"
          type="submit"
        >
          {isSubmitting ? (
            <>
              <AppIcons.loader className="animate-spin" data-icon="inline-start" />
              {t("auth.completion.saving")}
            </>
          ) : (
            t("auth.completion.continue")
          )}
        </Button>
      </form>
    </div>
  );
}
