"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "@/lib/utils";

const Toaster = ({ className, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const sonnerTheme: ToasterProps["theme"] =
    theme === "light" || theme === "dark" || theme === "system" ? theme : "system";

  return (
    <Sonner
      className={cn("toaster group", className)}
      closeButton
      expand={false}
      gap={12}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
        close: <XIcon className="size-3.5" />,
      }}
      offset={20}
      position="bottom-right"
      richColors={false}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
          "--success-bg": "color-mix(in oklch, var(--popover) 92%, var(--primary))",
          "--success-border": "color-mix(in oklch, var(--border) 70%, var(--primary))",
          "--success-text": "var(--popover-foreground)",
          "--error-bg": "color-mix(in oklch, var(--popover) 90%, var(--destructive))",
          "--error-border": "color-mix(in oklch, var(--border) 55%, var(--destructive))",
          "--error-text": "var(--popover-foreground)",
          "--warning-bg": "var(--popover)",
          "--warning-border": "var(--border)",
          "--warning-text": "var(--popover-foreground)",
          "--info-bg": "var(--popover)",
          "--info-border": "var(--border)",
          "--info-text": "var(--popover-foreground)",
        } as React.CSSProperties
      }
      theme={sonnerTheme}
      toastOptions={{
        classNames: {
          toast: cn(
            "cn-toast group/toast",
            "border border-border/80 bg-popover/95 text-popover-foreground",
            "rounded-[var(--radius-lg)] px-4 py-3.5 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)]",
            "backdrop-blur-xl",
            "data-[type=success]:border-[color:var(--success-border)] data-[type=success]:bg-[color:var(--success-bg)]",
            "data-[type=error]:border-[color:var(--error-border)] data-[type=error]:bg-[color:var(--error-bg)]",
          ),
          title: "text-sm font-medium tracking-tight",
          description: "text-sm text-muted-foreground",
          actionButton:
            "rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground",
          cancelButton:
            "rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground",
          closeButton:
            "rounded-full border border-border/70 bg-background/80 text-muted-foreground opacity-80 transition-opacity hover:opacity-100",
          icon: "mt-0.5 text-muted-foreground group-data-[type=success]/toast:text-primary group-data-[type=error]/toast:text-destructive",
        },
        duration: 4200,
      }}
      visibleToasts={4}
      {...props}
    />
  );
};

export { Toaster };
