"use client";

import { useFormStatus } from "react-dom";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";

export function VerificationSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      className="h-11 w-full rounded-full"
      disabled={pending}
      type="submit"
    >
      {pending ? <AppIcons.loader aria-hidden className="animate-spin" /> : null}
      {label}
    </Button>
  );
}
