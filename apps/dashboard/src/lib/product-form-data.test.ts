import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getProductFormInput } from "./product-form-data.js";

describe("getProductFormInput", () => {
  it("normalizes rich product form fields", () => {
    const formData = new FormData();

    formData.set("title", "Coffee");
    formData.set("description", "Roasted coffee beans");
    formData.set("handle", "coffee");
    formData.set("collectionId", "pcol_1");
    formData.append("categoryIds", "pcat_1");
    formData.append("categoryIds", "pcat_2");
    formData.set("imageUrls", "https://cdn.test/1.jpg\nhttps://cdn.test/2.jpg");
    formData.set("priceAmount", "350");
    formData.set("optionTitle", "Size");
    formData.set("optionValues", "Small, Medium\nLarge");
    formData.set("currencyCode", "etb");
    formData.set("status", "draft");
    formData.set("thumbnail", "https://cdn.test/thumb.jpg");

    assert.deepEqual(getProductFormInput(formData), {
      title: "Coffee",
      description: "Roasted coffee beans",
      handle: "coffee",
      collectionId: "pcol_1",
      categoryIds: ["pcat_1", "pcat_2"],
      imageUrls: ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg"],
      options: [{ title: "Size", values: ["Small", "Medium", "Large"] }],
      priceAmount: 350,
      currencyCode: "etb",
      status: "draft",
      thumbnail: "https://cdn.test/thumb.jpg",
    });
  });

  it("normalizes empty product form fields", () => {
    const formData = new FormData();

    formData.set("title", " ");
    formData.set("description", "");
    formData.set("handle", "");
    formData.set("collectionId", "");
    formData.append("categoryIds", "");
    formData.set("imageUrls", "\n \n");
    formData.set("priceAmount", "");
    formData.set("currencyCode", "");
    formData.set("status", "");
    formData.set("thumbnail", "");

    assert.deepEqual(getProductFormInput(formData), {
      title: null,
      description: null,
      handle: null,
      collectionId: null,
      categoryIds: [],
      imageUrls: [],
      options: undefined,
      priceAmount: undefined,
      currencyCode: null,
      status: null,
      thumbnail: null,
    });
  });

  it("normalizes generated product options and variant matrix rows", () => {
    const formData = new FormData();

    formData.set("title", "T-shirt");
    formData.set(
      "options",
      JSON.stringify([
        { title: "Size", values: ["S", "M"] },
        { title: "Color", values: ["Black"] },
      ]),
    );
    formData.set(
      "variants",
      JSON.stringify([
        {
          optionValues: { Size: "S", Color: "Black" },
          sku: "TEE-S-BLACK",
          priceAmount: 25,
          currencyCode: "usd",
          stockedQuantity: 4,
        },
        {
          optionValues: { Size: "M", Color: "Black" },
          sku: "TEE-M-BLACK",
          priceAmount: 27,
          currencyCode: "usd",
          stockedQuantity: 7,
        },
      ]),
    );

    assert.deepEqual(getProductFormInput(formData), {
      title: "T-shirt",
      description: null,
      handle: null,
      collectionId: null,
      categoryIds: [],
      imageUrls: [],
      options: [
        { title: "Size", values: ["S", "M"] },
        { title: "Color", values: ["Black"] },
      ],
      variants: [
        {
          optionValues: { Size: "S", Color: "Black" },
          sku: "TEE-S-BLACK",
          priceAmount: 25,
          currencyCode: "usd",
          stockedQuantity: 4,
        },
        {
          optionValues: { Size: "M", Color: "Black" },
          sku: "TEE-M-BLACK",
          priceAmount: 27,
          currencyCode: "usd",
          stockedQuantity: 7,
        },
      ],
      priceAmount: undefined,
      currencyCode: null,
      status: null,
      thumbnail: null,
    });
  });
});
