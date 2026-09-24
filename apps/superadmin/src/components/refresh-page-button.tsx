"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function RefreshPageButton({ label = "Refresh status" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      aria-label={pending ? "Refreshing status" : label}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      size="sm"
      variant="outline"
    >
      <RefreshCw
        aria-hidden
        className={pending ? "animate-spin motion-reduce:animate-none" : undefined}
      />
      {pending ? "Refreshing…" : label}
    </Button>
  );
}
