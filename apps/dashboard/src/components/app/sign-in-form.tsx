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
import { useI18n } from "@/i18n/provider";

export function SignInForm({
  errorMessage,
  nextPath,
}: {
  errorMessage: string | null;
  nextPath: string;
}) {
  const fieldId = useId();
  const { t } = useI18n();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const PasswordIcon = isPasswordVisible ? AppIcons.eyeOff : AppIcons.eye;

  return (
    <form action="/admin/session" className="flex flex-col gap-5" method="post">
      <input name="next" type="hidden" value={nextPath} />
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={`${fieldId}-email`}>{t("auth.email")}</FieldLabel>
          <InputGroup className="h-11 rounded-xl bg-background px-1 transition-colors hover:border-ring/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
            <InputGroupInput
              autoComplete="email"
              autoFocus
              className="px-3 text-sm"
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
              id={`${fieldId}-password`}
              name="password"
              required
              type={isPasswordVisible ? "text" : "password"}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={isPasswordVisible ? t("auth.hidePassword") : t("auth.showPassword")}
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
      <Button className="h-11 w-full rounded-xl text-sm font-semibold" type="submit">
        {t("auth.signIn")}
      </Button>
    </form>
  );
}
