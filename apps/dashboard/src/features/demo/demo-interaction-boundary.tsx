"use client";

import { type FormEvent, type MouseEvent, type ReactNode, useState } from "react";

type DemoInteractionBoundaryProps = {
  children: ReactNode;
  notice: string;
};

export function DemoInteractionBoundary({ children, notice }: DemoInteractionBoundaryProps) {
  const [announcement, setAnnouncement] = useState("");

  function containNavigation(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a") : null;
    if (!anchor) {
      return;
    }

    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname.startsWith("/demo")) return;

    event.preventDefault();
    setAnnouncement("");
    window.requestAnimationFrame(() => setAnnouncement(notice));
  }

  function containSubmit(event: FormEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setAnnouncement("");
    window.requestAnimationFrame(() => setAnnouncement(notice));
  }

  return (
    <div
      className="contents"
      onAuxClickCapture={containNavigation}
      onClickCapture={containNavigation}
      onSubmitCapture={containSubmit}
    >
      {children}
      <output aria-live="polite" className="sr-only">
        {announcement}
      </output>
    </div>
  );
}
