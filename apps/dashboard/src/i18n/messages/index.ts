import type { AppLocale } from "../config";
import am from "./am";
import en from "./en";

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export const messagesByLocale: Record<AppLocale, Messages> = { am, en };
