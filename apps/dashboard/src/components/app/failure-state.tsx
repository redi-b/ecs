"use client";

import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import { useTransition } from "react";

import Link from "@/components/app/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function FailureState({
  actionHref,
  actionLabel,
  code,
  description,
  onRetry,
  retryingLabel,
  title,
}: {
  actionHref?: string;
  actionLabel: string;
  code?: string;
  description: string;
  onRetry?: () => void;
  retryingLabel?: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground sm:px-8">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-xl items-center">
        <div>
          {code ? <p className="text-sm font-medium text-muted-foreground">{code}</p> : null}
          <h1 className={cn("text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-5xl", code && "mt-3")}>
            {title}
          </h1>
          <p className="mt-4 max-w-lg text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
            {description}
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {onRetry ? (
              <Button disabled={pending} onClick={() => startTransition(onRetry)} type="button">
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RefreshCwIcon data-icon="inline-start" />
                )}
                {pending ? (retryingLabel ?? actionLabel) : actionLabel}
              </Button>
            ) : actionHref ? (
              <Button asChild>
                <Link href={actionHref}>
                  <ArrowLeftIcon data-icon="inline-start" />
                  {actionLabel}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
