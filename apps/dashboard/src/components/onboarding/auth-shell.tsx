import type { ReactNode } from "react";

import { AppIcons } from "@/components/app/icons";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { getTranslations } from "@/i18n/server";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  brandDescription?: string;
  brandPoints?: string[];
  brandTitle?: string;
  children: ReactNode;
  className?: string;
  /** Narrow centered form (auth) vs wider setup layout (onboarding). */
  layout?: "auth" | "setup";
  toolbar?: ReactNode;
};

export async function AuthShell({
  brandDescription,
  brandPoints = [],
  brandTitle,
  children,
  className,
  layout = "auth",
  toolbar,
}: AuthShellProps) {
  const t = await getTranslations();
  const tools = (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/80 bg-card p-0.5 sm:gap-1 sm:p-1">
      {toolbar}
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  );

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      {layout === "auth" ? (
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-5 sm:max-w-lg sm:px-8 sm:py-8">
          <header className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <BrandMark tagline={t("auth.brandTagline")} />
            </div>
            {tools}
          </header>
          <div className="flex flex-1 py-6 sm:py-10">
            <div className="my-auto w-full max-w-md">{children}</div>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
          <aside className="flex flex-col border-b border-border/80 px-4 py-6 sm:px-10 sm:py-10 lg:px-14 lg:py-12 lg:pb-10">
            <div className="flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <BrandMark tagline={t("auth.brandTagline")} />
              </div>
              <div>{tools}</div>
            </div>
            <div className="mt-6 max-w-2xl sm:mt-10">
              <BrandCopy
                brandDescription={brandDescription ?? ""}
                brandPoints={brandPoints}
                brandTitle={brandTitle ?? ""}
                compactOnMobile
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
        className="grid size-9 place-items-center rounded-[0.7rem] bg-primary text-sm font-bold tracking-tight text-primary-foreground"
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
  titleClassName,
}: {
  brandDescription: string;
  brandPoints: string[];
  brandTitle: string;
  compactOnMobile?: boolean;
  titleClassName: string;
}) {
  return (
    <>
      <h1 className={cn("font-heading font-semibold tracking-tight text-pretty", titleClassName)}>
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
