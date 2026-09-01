"use client";

import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTransition } from "react";

import Link from "@/components/app/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function FailureState({
  actionHref,
  actionLabel,
  code,
  description,
  eyebrow,
  onRetry,
  retryingLabel,
  title,
}: {
  actionHref?: string;
  actionLabel: string;
  code?: string;
  description: string;
  eyebrow: string;
  onRetry?: () => void;
  retryingLabel?: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <main className="failure-stage min-h-dvh bg-background px-5 py-8 text-foreground sm:px-8">
      <div aria-hidden className="failure-grid" />
      <section className="relative z-10 mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-5xl content-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)] lg:items-center">
        <div className="max-w-xl">
          <p className="type-eyebrow text-primary">
            {eyebrow}
            {code ? ` / ${code}` : ""}
          </p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">
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
        <FailureViewport />
      </section>
    </main>
  );
}

function FailureViewport(): ReactNode {
  return (
    <div aria-hidden className="failure-viewport">
      <div className="failure-browser-bar">
        <span />
        <span />
        <span />
        <div />
      </div>
      <div className="failure-canvas">
        <div className="failure-frame failure-frame-one" />
        <div className="failure-frame failure-frame-two" />
        <div className="failure-frame failure-frame-three" />
        <div className="failure-scan" />
      </div>
      <div className="failure-status">
        <span /> ECS
      </div>
    </div>
  );
}
