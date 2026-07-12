"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useI18n } from "@/i18n/provider";

export function AccountSignUpForm({
  defaultValues,
  errorMessage,
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
  const PasswordIcon = isPasswordVisible ? AppIcons.eyeOff : AppIcons.eye;

  return (
    <Card className="w-full rounded-3xl border border-border bg-card [--card-spacing:--spacing(5)]">
      <CardHeader className="gap-1.5">
        <div className="text-xs font-bold tracking-normal text-muted-foreground uppercase">
          {t("auth.merchantConsole")}
        </div>
        <CardTitle className="text-xl font-semibold">{t("auth.createAccountTitle")}</CardTitle>
        <CardDescription>{t("auth.createAccountDescription")}</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-1">
        <form action="/admin/sign-up/submit" className="flex flex-col gap-5" method="post">
          <Field>
            <FieldLabel htmlFor={`${fieldId}-ownerName`}>{t("auth.ownerName")}</FieldLabel>
            <InputGroup className="h-11 rounded-full bg-background/70 px-1 transition-all duration-200 hover:border-ring/70">
              <InputGroupInput
                autoComplete="name"
                className="px-3 text-sm"
                id={`${fieldId}-ownerName`}
                name="ownerName"
                onChange={(event) => setOwnerName(event.target.value)}
                placeholder="Mahi Bekele"
                required
                value={ownerName}
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${fieldId}-email`}>{t("auth.workEmail")}</FieldLabel>
            <InputGroup className="h-11 rounded-full bg-background/70 px-1 transition-all duration-200 hover:border-ring/70">
              <InputGroupInput
                autoComplete="email"
                className="px-3 text-sm"
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
            <InputGroup className="h-11 rounded-full bg-background/70 px-1 transition-all duration-200 hover:border-ring/70">
              <InputGroupInput
                autoComplete="new-password"
                className="px-3 text-sm"
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
          <Button className="h-11 rounded-full text-sm font-semibold shadow-sm" type="submit">
            {t("common.continue")}
          </Button>
        </form>
        <p className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
          {t("auth.alreadyRegistered")}{" "}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="/admin/sign-in"
          >
            {t("auth.signIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
