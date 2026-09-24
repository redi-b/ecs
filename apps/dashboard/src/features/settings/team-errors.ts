import type { MessageKey } from "@/i18n/messages";

export function teamErrorKey(error: unknown): MessageKey | null {
  const code = error instanceof Error ? error.message : "";
  if (code === "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION")
    return "settings.team.alreadyMember";
  if (code === "USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION")
    return "settings.team.alreadyInvited";
  return null;
}
