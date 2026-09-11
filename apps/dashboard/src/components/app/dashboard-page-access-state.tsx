import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Button } from "@/components/ui/button";

export function DashboardPageAccessState({
  actionHref,
  actionLabel,
  description,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  description: string;
  title: string;
}) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12 sm:px-6 sm:py-16">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 sm:p-8">
        <span className="mb-5 grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
          <AppIcons.lock className="size-5" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        <Button asChild className="mt-6">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </section>
    </main>
  );
}
