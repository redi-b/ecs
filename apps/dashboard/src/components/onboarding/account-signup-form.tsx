"use client";

import Link from "next/link";
import { useId, useState } from "react";
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
import { Input } from "@/components/ui/input";

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
  const [ownerName, setOwnerName] = useState(defaultValues.ownerName ?? "");
  const [email, setEmail] = useState(defaultValues.email ?? "");
  const [password, setPassword] = useState("");

  return (
    <Card className="w-full rounded-3xl border border-border/70 bg-card/95 shadow-xl shadow-primary/5 backdrop-blur [--card-spacing:--spacing(5)]">
      <CardHeader className="gap-1.5">
        <div className="text-xs font-bold tracking-normal text-muted-foreground uppercase">
          Merchant console
        </div>
        <CardTitle className="text-xl font-semibold">Create your account</CardTitle>
        <CardDescription>Shop setup starts after your account is created.</CardDescription>
        <CardAction>
          <ThemeToggle />
        </CardAction>
      </CardHeader>
      <CardContent className="pt-1">
        <form action="/admin/sign-up/submit" className="flex flex-col gap-5" method="post">
          <Field>
            <FieldLabel htmlFor={`${fieldId}-ownerName`}>Owner name</FieldLabel>
            <Input
              autoComplete="name"
              id={`${fieldId}-ownerName`}
              name="ownerName"
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="Mahi Bekele"
              required
              value={ownerName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${fieldId}-email`}>Work email</FieldLabel>
            <Input
              autoComplete="email"
              id={`${fieldId}-email`}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="mahi@example.com"
              required
              type="email"
              value={email}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${fieldId}-password`}>Password</FieldLabel>
            <Input
              autoComplete="new-password"
              id={`${fieldId}-password`}
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <FieldDescription>At least 8 characters.</FieldDescription>
          </Field>
          {errorMessage ? (
            <Field data-invalid>
              <FieldError>{errorMessage}</FieldError>
            </Field>
          ) : null}
          <Button className="h-11 rounded-full text-sm font-semibold shadow-sm" type="submit">
            Continue
          </Button>
        </form>
        <p className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="/admin/sign-in"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
