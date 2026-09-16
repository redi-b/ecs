"use client";

import { useFormStatus } from "react-dom";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";

export function VerificationSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      className="w-full"
      disabled={pending}
      size="lg"
      type="submit"
    >
      {pending ? <AppIcons.loader aria-hidden className="animate-spin" /> : null}
      {label}
    </Button>
  );
}
