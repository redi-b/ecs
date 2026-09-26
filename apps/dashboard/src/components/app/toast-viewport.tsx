"use client";

import { Toast as ToastPrimitive } from "radix-ui";
import { type CSSProperties, isValidElement, useEffect, useRef, useState } from "react";
import { type Action, type ToastT, toast, useSonner } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const DEFAULT_DURATION = 6000;
const MAX_TIMER_DURATION = 2_147_483_647;

function content(value: ToastT["title"]) {
  return typeof value === "function" ? value() : value;
}

function isAction(value: ToastT["action"]): value is Action {
  return Boolean(
    value && !isValidElement(value) && typeof value === "object" && "onClick" in value,
  );
}

/** Sonner is the event API; Radix owns dismissal and its public pause/resume lifecycle. */
function ToastNotice({
  notice,
  onPause,
  onResume,
}: {
  notice: ToastT;
  onPause: () => void;
  onResume: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const manual = useRef(false);
  const closed = useRef(false);
  const loading = notice.type === "loading";
  // Radix uses a browser timer; Infinity overflows and can close immediately.
  const duration = loading ? MAX_TIMER_DURATION : (notice.duration ?? DEFAULT_DURATION);
  const dismissible = notice.dismissible !== false;
  const Icon = loading
    ? AppIcons.loader
    : notice.type === "success"
      ? AppIcons.check
      : notice.type === "error" || notice.type === "warning"
        ? AppIcons.error
        : AppIcons.notifications;

  // Keep the exit animation independent of reduced-motion and CSS availability.
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => toast.dismiss(notice.id), 220);
    return () => clearTimeout(timer);
  }, [open, notice.id]);

  const close = (next: boolean) => {
    if (next || closed.current) return;
    closed.current = true;
    setOpen(false);
    if (manual.current) notice.onDismiss?.(notice);
    else notice.onAutoClose?.(notice);
  };
  const action = (value: ToastT["action"], secondary = false) => {
    if (!isAction(value)) return value;
    return (
      <button
        type="button"
        className={cn("ecs-notice-action", secondary && "ecs-notice-action--secondary")}
        style={secondary ? notice.cancelButtonStyle : notice.actionButtonStyle}
        onClick={(event) => {
          value.onClick(event);
          if (!event.defaultPrevented) {
            manual.current = true;
            close(false);
          }
        }}
      >
        {value.label}
      </button>
    );
  };

  return (
    <ToastPrimitive.Root
      className={cn("ecs-notice", notice.className)}
      data-tone={notice.type ?? "normal"}
      data-testid={notice.testId}
      duration={duration}
      open={open}
      onOpenChange={close}
      onPause={onPause}
      onResume={onResume}
      onEscapeKeyDown={(event) => {
        if (!dismissible) event.preventDefault();
        else manual.current = true;
      }}
      onSwipeEnd={(event) => {
        if (!dismissible) event.preventDefault();
        else manual.current = true;
      }}
      style={{ "--notice-duration": `${duration}ms`, ...notice.style } as CSSProperties}
      type="background"
    >
      {!loading && duration > 0 && <span className="ecs-notice-lifetime" aria-hidden="true" />}
      {notice.jsx ?? (
        <>
          <span className="ecs-notice-icon" aria-hidden="true">
            {notice.icon ?? <Icon className={cn(loading && "animate-spin")} />}
          </span>
          <div className="ecs-notice-content">
            <ToastPrimitive.Title className="ecs-notice-title">
              {content(notice.title)}
            </ToastPrimitive.Title>
            {notice.description && (
              <ToastPrimitive.Description className="ecs-notice-description">
                {content(notice.description)}
              </ToastPrimitive.Description>
            )}
            {(notice.action || notice.cancel) && (
              <div className="ecs-notice-actions">
                {action(notice.action)}
                {action(notice.cancel, true)}
              </div>
            )}
          </div>
        </>
      )}
      {dismissible && notice.closeButton !== false && (
        <ToastPrimitive.Close
          className="ecs-notice-close"
          aria-label={t("commandCenter.close")}
          onClick={() => {
            manual.current = true;
          }}
        >
          <AppIcons.close aria-hidden="true" />
        </ToastPrimitive.Close>
      )}
    </ToastPrimitive.Root>
  );
}

export function Toaster() {
  const { toasts } = useSonner();
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  return (
    <ToastPrimitive.Provider
      label={t("nav.notifications")}
      duration={DEFAULT_DURATION}
      swipeDirection="right"
    >
      {toasts.slice(0, 4).map((notice) => (
        <ToastNotice
          key={`${notice.id}:${notice.type}:${notice.duration}`}
          notice={notice}
          onPause={() => setPaused(true)}
          onResume={() => setPaused(false)}
        />
      ))}
      <ToastPrimitive.Viewport
        className="ecs-notice-viewport"
        data-paused={paused}
        hotkey={["altKey", "KeyT"]}
        label={`${t("nav.notifications")} (Alt+T)`}
      />
    </ToastPrimitive.Provider>
  );
}
