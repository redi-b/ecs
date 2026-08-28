"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

import { PasswordInput } from "@/components/password-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function OperatorSignInForm({
  email,
  returnTo,
  variant = "sign-in",
}: {
  email?: string;
  returnTo?: string;
  variant?: "reauthenticate" | "sign-in";
}) {
  const emailId = useId();
  const passwordId = useId();
  const isReauthentication = variant === "reauthenticate";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/session", {
        method: "POST",
        headers: { accept: "application/json" },
        body: new FormData(event.currentTarget),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        returnTo?: string;
      } | null;
      if (!response.ok) {
        if (body?.error === "session_expired") {
          router.replace("/sign-in?error=session_expired");
          router.refresh();
          return;
        }
        setError(
          body?.error === "invalid_credentials"
            ? "Check your email and password, then try again."
            : "Sign-in is temporarily unavailable. Try again in a moment.",
        );
        return;
      }
      router.replace(body?.returnTo ?? returnTo ?? "/");
      router.refresh();
    } catch {
      setError("Sign-in is temporarily unavailable. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action="/session" aria-busy={pending} method="post" onSubmit={submit}>
      <FieldGroup>
        {isReauthentication ? (
          <>
            <input name="intent" type="hidden" value="reauthenticate" />
            <input name="returnTo" type="hidden" value={returnTo ?? "/"} />
          </>
        ) : (
          <Field>
            <FieldLabel htmlFor={emailId}>Work email</FieldLabel>
            <Input
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              defaultValue={email}
              id={emailId}
              name="email"
              required
              type="email"
            />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
          <PasswordInput
            autoComplete="current-password"
            id={passwordId}
            minLength={8}
            name="password"
            required
          />
        </Field>
        <Field>
          <Button className="w-full" disabled={pending} size="lg" type="submit">
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending
              ? isReauthentication
                ? "Confirming…"
                : "Signing in…"
              : isReauthentication
                ? "Confirm and continue"
                : "Sign in"}
            {!pending ? <ArrowRight aria-hidden data-icon="inline-end" /> : null}
          </Button>
        </Field>
        {error ? (
          <Alert aria-live="polite" variant="destructive">
            <AlertTitle>We couldn’t sign you in</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </FieldGroup>
    </form>
  );
}
