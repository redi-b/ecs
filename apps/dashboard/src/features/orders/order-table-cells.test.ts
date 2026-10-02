import assert from "node:assert/strict";
import { test } from "node:test";
import type { MerchantOrder } from "@ecs/contracts";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { messagesByLocale } from "@/i18n/messages";
import { OrderIdentityCell, OrderReferenceCell } from "./order-table-cells";

const order: MerchantOrder = {
  id: "order_12345678",
  displayId: 1,
  email: null,
  status: "pending",
  paymentStatus: "not_paid",
  fulfillmentStatus: null,
  currencyCode: "etb",
  total: 200,
  createdAt: null,
  updatedAt: null,
  items: [
    {
      id: "a",
      title: "Red",
      productTitle: "Cotton shirt",
      quantity: 2,
      unitPrice: 50,
      total: 100,
      thumbnail: "https://media.example.com/shirt.jpg",
    },
    { id: "b", title: "Leather belt", quantity: 1, unitPrice: 100, total: 100, thumbnail: null },
  ],
};
function render(value: MerchantOrder, locale: "en" | "am" = "en") {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, messages: messagesByLocale[locale], timeZone: "Africa/Addis_Ababa" } as Parameters<
        typeof NextIntlClientProvider
      >[0],
      createElement(OrderIdentityCell, { order: value, href: null }),
    ),
  );
}
test("order identity leads with product name and thumbnails, keeping a quiet reference", () => {
  const html = render(order);
  assert.match(html, /Cotton shirt/);
  assert.match(html, /shirt.jpg/);
  assert.match(html, /\+1 more/);
  assert.doesNotMatch(html, /ORD-12345678/);
  assert.match(renderToStaticMarkup(createElement(OrderReferenceCell, { order })), /ORD-12345678/);
});
test("empty and untranslated order data have safe bilingual fallbacks", () => {
  for (const locale of ["en", "am"] as const) {
    const html = render({ ...order, items: [] }, locale);
    assert.doesNotMatch(html, /overview\.attention\./);
  }
});
