import type { AppLocale } from "./config";
import type { Messages } from "./messages/load";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: Messages;
  }
}
