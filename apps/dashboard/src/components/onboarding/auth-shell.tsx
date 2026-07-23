import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { getTranslations } from "@/i18n/server";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  brandDescription: string;
  brandFooter?: string;
  brandPoints?: string[];
  brandTitle: string;
  children: ReactNode;
  className?: string;
  /** Narrow centered form (auth) vs wider setup layout (onboarding). */
  layout?: "auth" | "setup";
  toolbar?: ReactNode;
};

export async function AuthShell({
  brandDescription,
  brandFooter,
  brandPoints = [],
  brandTitle,
  children,
  className,
  layout = "auth",
  toolbar,
}: AuthShellProps) {
  const t = await getTranslations();
  const footer = brandFooter ?? t("auth.brandFooter.label");

  const tools = (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/80 bg-card/90 p-0.5 shadow-sm backdrop-blur-sm sm:gap-1 sm:p-1">
      {toolbar}
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  );

  return (
    <div className={cn("relative min-h-screen bg-background text-foreground", className)}>
      {/* Soft brand wash on the left half only (desktop). No glass blobs. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-y-0 left-0 hidden w-1/2 bg-[radial-gradient(120%_80%_at_0%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_55%)] lg:block" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(80%_100%_at_50%_0%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_70%)] lg:hidden" />
      </div>

      <div className="fixed top-4 right-4 z-50 hidden sm:block">{tools}</div>

      {layout === "auth" ? (
        <div className="relative grid min-h-screen w-full lg:grid-cols-2">
          <aside className="flex flex-col border-b border-border/80 px-5 py-7 sm:px-10 sm:py-8 lg:min-h-screen lg:border-r lg:border-b-0 lg:px-12 lg:py-12 xl:px-16">
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <BrandMark tagline={t("auth.brandTagline")} />
                </div>
                <div className="sm:hidden">{tools}</div>
              </div>

              <div className="mt-6 flex flex-1 flex-col justify-center sm:mt-10 lg:mt-0">
                <BrandCopy
                  brandDescription={brandDescription}
                  brandPoints={brandPoints}
                  brandTitle={brandTitle}
                  compactOnMobile
                  eyebrow={t("auth.merchantConsole")}
                  titleClassName="text-2xl sm:text-3xl sm:text-[2.1rem] sm:leading-[1.15]"
                />
              </div>

              {footer ? (
                <p className="mt-8 hidden shrink-0 text-xs leading-relaxed text-muted-foreground sm:mt-10 sm:block lg:mt-0">
                  {footer}
                </p>
              ) : null}
            </div>
          </aside>

          <div className="flex min-h-full items-start justify-center px-4 py-8 sm:items-center sm:px-10 sm:py-12 lg:px-12 lg:py-14">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col">
          <aside className="flex flex-col border-b border-border/80 px-4 py-6 sm:px-10 sm:py-10 lg:px-14 lg:py-12 lg:pb-10">
            <div className="flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <BrandMark tagline={t("auth.brandTagline")} />
              </div>
              <div className="sm:hidden">{tools}</div>
            </div>
            <div className="mt-6 max-w-2xl sm:mt-10">
              <BrandCopy
                brandDescription={brandDescription}
                brandPoints={brandPoints}
                brandTitle={brandTitle}
                compactOnMobile
                eyebrow={t("auth.merchantConsole")}
                titleClassName="text-xl sm:text-2xl sm:text-3xl"
              />
            </div>
          </aside>
          <div className="px-4 pb-10 pt-6 sm:px-10 sm:pb-12 sm:pt-10 lg:px-12 lg:pt-12">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

function BrandMark({ tagline }: { tagline: string }) {
  return (
    <>
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-[0.7rem] bg-primary text-sm font-bold tracking-tight text-primary-foreground shadow-[inset_0_1px_0_color-mix(in_oklch,white_22%,transparent),0_1px_2px_color-mix(in_oklch,var(--foreground)_10%,transparent)]"
      >
        E
      </span>
      <div>
        <p className="text-sm font-semibold tracking-tight">ECS</p>
        <p className="text-xs text-muted-foreground">{tagline}</p>
      </div>
    </>
  );
}

function BrandCopy({
  brandDescription,
  brandPoints,
  brandTitle,
  compactOnMobile = false,
  eyebrow,
  titleClassName,
}: {
  brandDescription: string;
  brandPoints: string[];
  brandTitle: string;
  compactOnMobile?: boolean;
  eyebrow: string;
  titleClassName: string;
}) {
  return (
    <>
      <p className="type-eyebrow text-primary/90">{eyebrow}</p>
      <h1 className={cn("mt-2 font-heading font-semibold tracking-tight text-balance sm:mt-3", titleClassName)}>
        {brandTitle}
      </h1>
      <p
        className={cn(
          "mt-2.5 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground sm:mt-3.5 sm:text-[0.95rem]",
          compactOnMobile && "line-clamp-3 sm:line-clamp-none",
        )}
      >
        {brandDescription}
      </p>
      {brandPoints.length > 0 ? (
        <ul
          className={cn(
            "mt-6 space-y-3 sm:mt-8 sm:space-y-3.5",
            compactOnMobile && "hidden sm:block",
          )}
        >
          {brandPoints.map((point) => (
            <li className="flex gap-3 text-sm" key={point}>
              <span
                aria-hidden
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
              >
                <AppIcons.check className="size-3" />
              </span>
              <span className="leading-relaxed text-foreground/85">{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
