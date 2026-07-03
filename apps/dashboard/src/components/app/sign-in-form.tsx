"use client";

import { useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

export function SignInForm({
  errorMessage,
  nextPath,
}: {
  errorMessage: string | null;
  nextPath: string;
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const PasswordIcon = isPasswordVisible ? AppIcons.eyeOff : AppIcons.eye;

  return (
    <form action="/admin/session" className="flex flex-col gap-5" method="post">
      <input name="next" type="hidden" value={nextPath} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <InputGroup className="h-11 rounded-full bg-background/70 px-1 transition-all duration-200 hover:border-ring/70">
            <InputGroupInput
              autoComplete="email"
              className="px-3 text-sm"
              defaultValue="owner@abebe.local"
              id="email"
              name="email"
              placeholder="owner@abebe.local"
              required
              type="email"
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <InputGroup className="h-11 rounded-full bg-background/70 px-1 transition-all duration-200 hover:border-ring/70">
            <InputGroupInput
              autoComplete="current-password"
              className="px-3 text-sm"
              id="password"
              name="password"
              required
              type={isPasswordVisible ? "text" : "password"}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                onClick={() => setIsPasswordVisible((value) => !value)}
                size="icon-xs"
              >
                <PasswordIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>Use the password for this merchant account.</FieldDescription>
        </Field>
        {errorMessage ? (
          <Field data-invalid>
            <FieldError>{errorMessage}</FieldError>
          </Field>
        ) : null}
      </FieldGroup>
      <Button className="h-11 rounded-full text-sm font-semibold shadow-sm" type="submit">
        Continue
      </Button>
    </form>
  );
}
