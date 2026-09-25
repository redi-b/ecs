"use client";

import { ethiopianPhoneSchema, normalizeEthiopianPhone } from "@ecs/contracts";
import { useState } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export function EthiopianPhoneInput({
  disabled,
  errorMessage,
  help,
  id,
  label,
  onChange,
  required = false,
  size = "default",
  value,
}: {
  disabled?: boolean;
  errorMessage: string;
  help?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  size?: "default" | "lg";
  value: string;
}) {
  const [touched, setTouched] = useState(false);
  const normalized = value.trim() ? normalizeEthiopianPhone(value) : "";
  const invalid = touched && (!normalized || !ethiopianPhoneSchema.safeParse(normalized).success);

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup
        className={cn(
          "bg-background px-1 transition-colors hover:border-ring/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25",
          size === "lg" && "h-11",
        )}
      >
        <InputGroupAddon>+251</InputGroupAddon>
        <InputGroupInput
          aria-invalid={invalid || undefined}
          autoComplete="tel-national"
          className="px-2 text-sm"
          disabled={disabled}
          id={id}
          inputMode="numeric"
          maxLength={9}
          minLength={9}
          onBlur={() => {
            setTouched(true);
            if (normalized) onChange(normalized);
          }}
          onChange={(event) => {
            const national = event.target.value
              .replace(/\D/g, "")
              .replace(/^251/, "")
              .replace(/^0/, "")
              .slice(0, 9);
            onChange(national ? `+251${national}` : "");
          }}
          pattern="[1-9][0-9]{8}"
          placeholder="91 234 5678"
          required={required}
          type="tel"
          value={value.replace(/\D/g, "").replace(/^251/, "").replace(/^0/, "")}
        />
      </InputGroup>
      {invalid ? <FieldError>{errorMessage}</FieldError> : null}
      {!invalid && help ? <FieldDescription>{help}</FieldDescription> : null}
    </Field>
  );
}
