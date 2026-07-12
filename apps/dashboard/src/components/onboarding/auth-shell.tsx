import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/app/language-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { getRequestMessages } from "@/i18n/server";
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

/**
 * Shared chrome for sign-in, sign-up, and shop setup.
 * Restrained product aesthetic: no glow, glass, or decorative gradients.
 */
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
  const { messages } = await getRequestMessages();
  const t = (key: keyof typeof messages) => messages[key];
  const footer = brandFooter ?? t("auth.brandFooter");

  return (
    <div className={cn("relative min-h-screen bg-background text-foreground", className)}>
      <div className="fixed top-4 right-4 z-50 flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
        {toolbar}
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {layout === "auth" ? (
        <div className="grid min-h-screen w-full lg:grid-cols-2">
          <aside className="flex flex-col border-b px-6 py-8 sm:px-10 lg:min-h-screen lg:border-r lg:border-b-0 lg:px-12 lg:py-12 xl:px-16">
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
              <div className="flex shrink-0 items-center gap-2.5 pr-16 lg:pr-0">
                <BrandMark tagline={t("auth.brandTagline")} />
              </div>

              <div className="mt-10 flex flex-1 flex-col justify-center lg:mt-0">
                <BrandCopy
                  brandDescription={brandDescription}
                  brandPoints={brandPoints}
                  brandTitle={brandTitle}
                  eyebrow={t("auth.merchantConsole")}
                  titleClassName="text-3xl sm:text-[2.15rem] sm:leading-tight"
                />
              </div>

              {footer ? (
                <p className="mt-10 shrink-0 text-xs leading-relaxed text-muted-foreground lg:mt-0">
                  {footer}
                </p>
              ) : null}
            </div>
          </aside>

          {/* Full half-width column; card centered on both axes, capped width. */}
          <div className="flex min-h-full items-center justify-center px-5 py-12 sm:px-10 lg:px-12 lg:py-14">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col">
          <aside className="flex flex-col border-b px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12 lg:pb-10">
            <div className="flex shrink-0 items-center gap-2.5 pr-28">
              <BrandMark tagline={t("auth.brandTagline")} />
            </div>
            <div className="mt-8 max-w-2xl sm:mt-10">
              <BrandCopy
                brandDescription={brandDescription}
                brandPoints={brandPoints}
                brandTitle={brandTitle}
                eyebrow={t("auth.merchantConsole")}
                titleClassName="text-2xl sm:text-3xl"
              />
            </div>
          </aside>
          <div className="px-5 pb-12 pt-8 sm:px-10 sm:pt-10 lg:px-12 lg:pt-12">{children}</div>
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
        className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-bold tracking-tight text-primary-foreground shadow-sm"
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
  eyebrow,
  titleClassName,
}: {
  brandDescription: string;
  brandPoints: string[];
  brandTitle: string;
  eyebrow: string;
  titleClassName: string;
}) {
  return (
    <>
      <p className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">{eyebrow}</p>
      <h1 className={cn("mt-3 font-semibold tracking-tight text-balance", titleClassName)}>
        {brandTitle}
      </h1>
      <p className="mt-3.5 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground sm:text-[0.95rem]">
        {brandDescription}
      </p>
      {brandPoints.length > 0 ? (
        <ul className="mt-8 space-y-3.5">
          {brandPoints.map((point) => (
            <li className="flex gap-3 text-sm" key={point}>
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="leading-relaxed text-foreground/85">{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
