import type { MessageKeys, NestedKeyOf } from "next-intl";
import type { AppLocale } from "../config";

import am_account from "./am/account.json";
import en_account from "./en/account.json";
import am_auth from "./am/auth.json";
import en_auth from "./en/auth.json";
import am_billing from "./am/billing.json";
import en_billing from "./en/billing.json";
import am_categories from "./am/categories.json";
import en_categories from "./en/categories.json";
import am_collections from "./am/collections.json";
import en_collections from "./en/collections.json";
import am_commandCenter from "./am/commandCenter.json";
import en_commandCenter from "./en/commandCenter.json";
import am_common from "./am/common.json";
import en_common from "./en/common.json";
import am_customers from "./am/customers.json";
import en_customers from "./en/customers.json";
import am_editor from "./am/editor.json";
import en_editor from "./en/editor.json";
import am_filters from "./am/filters.json";
import en_filters from "./en/filters.json";
import am_insights from "./am/insights.json";
import en_insights from "./en/insights.json";
import am_language from "./am/language.json";
import en_language from "./en/language.json";
import am_media from "./am/media.json";
import en_media from "./en/media.json";
import am_nav from "./am/nav.json";
import en_nav from "./en/nav.json";
import am_offerOptions from "./am/offerOptions.json";
import en_offerOptions from "./en/offerOptions.json";
import am_onboarding from "./am/onboarding.json";
import en_onboarding from "./en/onboarding.json";
import am_orders from "./am/orders.json";
import en_orders from "./en/orders.json";
import am_overview from "./am/overview.json";
import en_overview from "./en/overview.json";
import am_products from "./am/products.json";
import en_products from "./en/products.json";
import am_promotions from "./am/promotions.json";
import en_promotions from "./en/promotions.json";
import am_settings from "./am/settings.json";
import en_settings from "./en/settings.json";
import am_signup from "./am/signup.json";
import en_signup from "./en/signup.json";
import am_table from "./am/table.json";
import en_table from "./en/table.json";
import am_taxonomy from "./am/taxonomy.json";
import en_taxonomy from "./en/taxonomy.json";

export const messageNamespaces = [
  "account",
  "auth",
  "billing",
  "categories",
  "collections",
  "commandCenter",
  "common",
  "customers",
  "editor",
  "filters",
  "insights",
  "language",
  "media",
  "nav",
  "offerOptions",
  "onboarding",
  "orders",
  "overview",
  "products",
  "promotions",
  "settings",
  "signup",
  "table",
  "taxonomy"
] as const;
export type MessageNamespace = (typeof messageNamespaces)[number];

export const messagesByLocale = {
  am: {
    account: am_account,
    auth: am_auth,
    billing: am_billing,
    categories: am_categories,
    collections: am_collections,
    commandCenter: am_commandCenter,
    common: am_common,
    customers: am_customers,
    editor: am_editor,
    filters: am_filters,
    insights: am_insights,
    language: am_language,
    media: am_media,
    nav: am_nav,
    offerOptions: am_offerOptions,
    onboarding: am_onboarding,
    orders: am_orders,
    overview: am_overview,
    products: am_products,
    promotions: am_promotions,
    settings: am_settings,
    signup: am_signup,
    table: am_table,
    taxonomy: am_taxonomy,
  },
  en: {
    account: en_account,
    auth: en_auth,
    billing: en_billing,
    categories: en_categories,
    collections: en_collections,
    commandCenter: en_commandCenter,
    common: en_common,
    customers: en_customers,
    editor: en_editor,
    filters: en_filters,
    insights: en_insights,
    language: en_language,
    media: en_media,
    nav: en_nav,
    offerOptions: en_offerOptions,
    onboarding: en_onboarding,
    orders: en_orders,
    overview: en_overview,
    products: en_products,
    promotions: en_promotions,
    settings: en_settings,
    signup: en_signup,
    table: en_table,
    taxonomy: en_taxonomy,
  },
} as const;

export type Messages = (typeof messagesByLocale)["en"];


/** Leaf message paths, e.g. `nav.products`, `auth.brandFooter.label`. */
export type MessageKey = MessageKeys<Messages, NestedKeyOf<Messages>>;

export function loadMessages(locale: AppLocale): Messages {
  return messagesByLocale[locale];
}
