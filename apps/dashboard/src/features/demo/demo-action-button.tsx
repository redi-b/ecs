"use client";

import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function DemoActionButton({
  children,
  icon,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "type"> & { icon?: ReactNode }) {
  const { t } = useI18n();

  return (
    <Button {...props} onClick={() => toast.info(t("overview.demo.actionNotice"))} type="button">
      {icon}
      {children}
    </Button>
  );
}
