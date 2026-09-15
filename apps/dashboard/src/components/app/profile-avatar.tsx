"use client";

import type { ProfileAvatarPreferences } from "@ecs/contracts";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { profileAvatarDataUri, profileInitial } from "@/lib/profile-avatar";

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
  return (
    <Avatar className={className} size={size}>
      <AvatarImage src={src} alt="" />
      <AvatarFallback>{profileInitial(name)}</AvatarFallback>
    </Avatar>
  );
}
