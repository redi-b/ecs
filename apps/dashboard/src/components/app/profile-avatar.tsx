"use client";

import type { ProfileAvatarPreferences } from "@ecs/contracts";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { profileAvatarDataUri, profileInitial } from "@/lib/profile-avatar";
import { cn } from "@/lib/utils";

export function ProfileAvatar({
  userId,
  name,
  preferences,
  className,
  size = "default",
}: {
  userId: string;
  name?: string | null | undefined;
  preferences?: ProfileAvatarPreferences | null | undefined;
  className?: string | undefined;
  size?: "default" | "sm" | "lg";
}) {
  const src = useMemo(() => {
    if (!userId) return undefined;
    try {
      return profileAvatarDataUri(userId, name, preferences);
    } catch {
      return undefined;
    }
  }, [userId, name, preferences]);
  const [displayedSrc, setDisplayedSrc] = useState(src);
  const [incomingSrc, setIncomingSrc] = useState<string>();
  const [incomingVisible, setIncomingVisible] = useState(false);

  useEffect(() => {
    if (!src) {
      setDisplayedSrc(undefined);
      setIncomingSrc(undefined);
      return;
    }
    if (!displayedSrc) {
      setDisplayedSrc(src);
      return;
    }
    if (src === displayedSrc) return;

    let cancelled = false;
    let frame = 0;
    let settleTimer = 0;

    if (typeof window === "undefined") {
      setDisplayedSrc(src);
      return;
    }

    const img = new window.Image();
    img.src = src;

    const reveal = () => {
      if (cancelled) return;
      setIncomingSrc(src);
      setIncomingVisible(false);
      frame = requestAnimationFrame(() => {
        setIncomingVisible(true);
        settleTimer = window.setTimeout(() => {
          setDisplayedSrc(src);
          setIncomingSrc(undefined);
          setIncomingVisible(false);
        }, 130);
      });
    };

    if (img.complete) {
      if (typeof img.decode === "function") {
        void img.decode().then(reveal, reveal);
      } else {
        reveal();
      }
    } else {
      img.addEventListener("load", reveal, { once: true });
      img.addEventListener("error", reveal, { once: true });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      img.removeEventListener("load", reveal);
      img.removeEventListener("error", reveal);
    };
  }, [displayedSrc, src]);

  return (
    <Avatar className={className} size={size}>
      {displayedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="aspect-square size-full rounded-full object-cover"
          src={displayedSrc}
        />
      ) : (
        <AvatarFallback>{profileInitial(name)}</AvatarFallback>
      )}
      {incomingSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 aspect-square size-full rounded-full object-cover opacity-0 transition-opacity duration-120 motion-reduce:transition-none",
            incomingVisible && "opacity-100",
          )}
          src={incomingSrc}
        />
      ) : null}
    </Avatar>
  );
}
