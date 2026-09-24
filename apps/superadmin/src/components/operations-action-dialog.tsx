"use client";

import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function OperationsActionDialog({
  children,
  description,
  footer,
  onOpenChange,
  open,
  title,
  trigger,
  wide = false,
}: {
  children: ReactNode;
  description?: ReactNode;
  footer: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title: ReactNode;
  trigger?: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={
          wide
            ? "flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:max-w-2xl"
            : "flex max-h-[calc(100dvh-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(40rem,calc(100dvh-2rem))] sm:max-w-lg"
        }
      >
        <DialogHeader className="shrink-0 border-b px-4 py-4 pe-12 sm:px-5">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-5 sm:px-5">
          {children}
        </div>
        <DialogFooter className="m-0 shrink-0 rounded-none border-t bg-popover px-4 py-3 sm:px-5">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
