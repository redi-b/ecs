import "server-only";

import { cookies } from "next/headers";

import { defaultLocale, isAppLocale, localeCookieName } from "./config";
import { messagesByLocale } from "./messages";

export async function getRequestLocale() {
  const cookieStore = await cookies();
  const candidate = cookieStore.get(localeCookieName)?.value;

  return isAppLocale(candidate) ? candidate : defaultLocale;
}

export async function getRequestMessages() {
  const locale = await getRequestLocale();

  return { locale, messages: messagesByLocale[locale] };
}
