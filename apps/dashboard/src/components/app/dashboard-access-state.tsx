import Link from "@/components/app/link";

import { Button } from "@/components/ui/button";

type DashboardAccessStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function DashboardAccessState({
  actionHref,
  actionLabel,
  description,
  title,
}: DashboardAccessStateProps) {
  const isExternal = Boolean(actionHref && /^https?:\/\//i.test(actionHref));

  return (
    <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
      <section className="flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-normal">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {actionHref && actionLabel ? (
          <Button asChild className="self-start">
            {isExternal ? (
              <a href={actionHref}>{actionLabel}</a>
            ) : (
              <Link href={actionHref}>{actionLabel}</Link>
            )}
          </Button>
        ) : null}
      </section>
    </main>
  );
}
