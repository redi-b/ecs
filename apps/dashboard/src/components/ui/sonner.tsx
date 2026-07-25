"use client";

import type { CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { cn } from "@/lib/utils";

const toneWell =
  "flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset [&_svg]:size-[1.125rem]";

const Toaster = ({ className, toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const sonnerTheme: ToasterProps["theme"] =
    theme === "light" || theme === "dark" || theme === "system" ? theme : "system";

  return (
    <Sonner
      className={cn("toaster group z-[200]", className)}
      closeButton
      expand={false}
      gap={12}
      icons={{
        success: (
          <span
            className={cn(
              toneWell,
              "bg-success/12 text-success ring-success/25 dark:bg-success/15",
            )}
          >
            <AppIcons.check aria-hidden />
          </span>
        ),
        info: (
          <span className={cn(toneWell, "bg-info/12 text-info ring-info/25 dark:bg-info/15")}>
            <AppIcons.notifications aria-hidden />
          </span>
        ),
        warning: (
          <span
            className={cn(
              toneWell,
              "bg-warning/14 text-warning ring-warning/30 dark:bg-warning/15",
            )}
          >
            <AppIcons.error aria-hidden />
          </span>
        ),
        error: (
          <span
            className={cn(
              toneWell,
              "bg-destructive/12 text-destructive ring-destructive/25 dark:bg-destructive/15",
            )}
          >
            <AppIcons.close aria-hidden />
          </span>
        ),
        loading: (
          <span
            className={cn(
              toneWell,
              "bg-primary/10 text-primary ring-primary/25 dark:bg-primary/14",
            )}
          >
            <AppIcons.loader aria-hidden className="animate-spin" />
          </span>
        ),
        close: <AppIcons.close className="size-3.5" aria-hidden />,
      }}
      mobileOffset={{ bottom: 16, right: 12, left: 12 }}
      offset={{ top: 16, right: 16 }}
      position="top-right"
      richColors={false}
      style={
        {
          zIndex: 200,
          "--width": "356px",
          "--border-radius": "1rem",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--toast-icon-margin-start": "0px",
          "--toast-icon-margin-end": "10px",
          "--toast-svg-margin-start": "0px",
          "--toast-svg-margin-end": "0px",
        } as CSSProperties
      }
      theme={sonnerTheme}
      toastOptions={{
        duration: 4200,
        closeButton: true,
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: cn(
            "cn-toast group/toast ecs-toast",
            "!rounded-2xl !border-border/80 !bg-popover !text-popover-foreground",
            "!gap-3 !py-3.5 !pl-4 !pr-11",
            "shadow-[0_1px_2px_rgb(0_0_0/0.06),0_16px_40px_-12px_rgb(0_0_0/0.28)]",
            "dark:!border-border/60 dark:shadow-[0_1px_2px_rgb(0_0_0/0.45),0_20px_48px_-10px_rgb(0_0_0/0.72)]",
            toastOptions?.classNames?.toast,
          ),
          title: cn(
            "!text-sm !font-medium !leading-snug !tracking-tight !text-foreground",
            toastOptions?.classNames?.title,
          ),
          description: cn(
            "!text-sm !leading-relaxed !text-muted-foreground",
            toastOptions?.classNames?.description,
          ),
          icon: cn("!h-9 !w-9 !m-0", toastOptions?.classNames?.icon),
          actionButton: cn(
            "!rounded-full !bg-primary !text-primary-foreground !font-medium",
            toastOptions?.classNames?.actionButton,
          ),
          cancelButton: cn(
            "!rounded-full !border !border-border !bg-background !text-foreground !font-medium",
            toastOptions?.classNames?.cancelButton,
          ),
          closeButton: cn(
            "ecs-toast-close",
            "!size-7 !rounded-lg !border-0 !bg-transparent !p-0 !shadow-none",
            "!text-muted-foreground !opacity-55",
            "hover:!bg-muted hover:!text-foreground hover:!opacity-100",
            "[&>svg]:!size-3.5",
            toastOptions?.classNames?.closeButton,
          ),
          loader: cn(
            "!static !inset-auto !transform-none !h-9 !w-9",
            "flex items-center justify-center",
            toastOptions?.classNames?.loader,
          ),
        },
      }}
      visibleToasts={4}
      {...props}
      richColors={false}
    />
  );
};

export { Toaster };
