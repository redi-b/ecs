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
      priceAmount: undefined,
      currencyCode: null,
      status: null,
      thumbnail: null,
    });
  });
});
