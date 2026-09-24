import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MerchantProduct, ProductOptionMediaBindings } from "@ecs/contracts";
import { createElement } from "react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import {
  isColorOptionTitle,
  isVisualOptionTitle,
  VariantImagePicker,
} from "./product-form-sections";
import {
  applyOptionMediaAutoAssignment,
  getInitialProductOptions,
  getInitialVariantOverrides,
  getProductDefaultValues,
  getProductPayload,
  getProductVariantsPayload,
  getVariantRows,
  reconcileOptionMediaBindings,
} from "./product-form-state";
import type { ProductFormValues } from "./product-form-types";

describe("Product Variant Image Picker & Smart Auto-Assignment", () => {
  const options = [
    {
      key: "option:color",
      title: "Color",
      values: [
        { key: "val:red", label: "Red" },
        { key: "val:blue", label: "Blue" },
      ],
    },
    {
      key: "option:size",
      title: "Size",
      values: [
        { key: "val:s", label: "S" },
        { key: "val:m", label: "M" },
      ],
    },
  ];

  const defaultValues: ProductFormValues = {
    title: "Test Shirt",
    description: "A comfortable shirt",
    handle: "test-shirt",
    thumbnail: "https://example.com/thumb.jpg",
    imageUrls: "https://example.com/red-1.jpg\nhttps://example.com/blue-1.jpg",
    status: "draft",
    priceAmount: "500",
    currencyCode: "etb",
    hasVariants: true,
    initialStock: "10",
    options,
    optionMediaBindings: null,
    skuPrefix: "SHIRT",
    variantOverrides: {},
    collectionId: "",
    categoryIds: [],
  };

  it("keeps image links when an option or value is renamed", () => {
    const bindings: ProductOptionMediaBindings = {
      optionTitle: "Color",
      mappings: { Red: ["https://example.com/red.jpg"], Blue: ["https://example.com/blue.jpg"] },
    };
    const renamed = [
      {
        ...options[0]!,
        title: "Shade",
        values: [{ ...options[0]!.values[0]!, label: "Crimson" }, options[0]!.values[1]!],
      },
      options[1]!,
    ];
    assert.deepEqual(reconcileOptionMediaBindings(bindings, options, renamed), {
      optionTitle: "Shade",
      mappings: {
        Crimson: ["https://example.com/red.jpg"],
        Blue: ["https://example.com/blue.jpg"],
      },
    });
  });

  it("removes only image links for a deleted value or option", () => {
    const bindings: ProductOptionMediaBindings = {
      optionTitle: "Color",
      mappings: { Red: ["https://example.com/red.jpg"], Blue: ["https://example.com/blue.jpg"] },
    };
    const remaining = [{ ...options[0]!, values: [options[0]!.values[0]!] }, options[1]!];
    assert.deepEqual(reconcileOptionMediaBindings(bindings, options, remaining), {
      optionTitle: "Color",
      mappings: { Red: ["https://example.com/red.jpg"] },
    });
    assert.equal(reconcileOptionMediaBindings(bindings, options, [options[1]!]), null);
  });

  it("applies smart auto-assignment to variants matching bound option values", () => {
    const rows = getVariantRows(defaultValues);
    const redS = rows.find((r) => r.optionValues.Color === "Red" && r.optionValues.Size === "S");
    const redM = rows.find((r) => r.optionValues.Color === "Red" && r.optionValues.Size === "M");
    const blueS = rows.find((r) => r.optionValues.Color === "Blue" && r.optionValues.Size === "S");
    assert.ok(redS && redM && blueS, "Rows must be present");

    const initialOverrides: ProductFormValues["variantOverrides"] = {
      [redM.key]: {
        imageUrl: "https://example.com/custom-manual-red.jpg",
      },
    };

    const bindings: ProductOptionMediaBindings = {
      optionTitle: "Color",
      mappings: {
        Red: [
          "https://example.com/auto-red-primary.jpg",
          "https://example.com/auto-red-secondary.jpg",
        ],
        Blue: ["https://example.com/auto-blue-primary.jpg"],
      },
    };

    const updated = applyOptionMediaAutoAssignment({
      variantOverrides: initialOverrides,
      options,
      rows,
      optionMediaBindings: bindings,
    });

    // Unassigned Red variant receives primary mapped Red image
    assert.equal(updated[redS.key]?.imageUrl, "https://example.com/auto-red-primary.jpg");
    // Manually assigned Red variant preserves its manual image
    assert.equal(updated[redM.key]?.imageUrl, "https://example.com/custom-manual-red.jpg");
    // Unassigned Blue variant receives primary mapped Blue image
    assert.equal(updated[blueS.key]?.imageUrl, "https://example.com/auto-blue-primary.jpg");
  });

  it("saves only media fields from the PDP media sheet, never variant price or stock snapshots", async () => {
    const { buildProductMediaEditPayload } = await import("./product-edit-dialog");
    const payload = buildProductMediaEditPayload({
      imageUrls: "https://example.com/old.jpg\nhttps://example.com/new.jpg",
      thumbnail: "https://example.com/old.jpg",
      optionMediaBindings: {
        optionTitle: "Color",
        mappings: { Red: ["https://example.com/new.jpg"] },
      },
    });
    assert.deepEqual(Object.keys(payload).sort(), ["imageUrls", "optionMediaBindings", "thumbnail"]);
    assert.equal("variants" in payload, false);
  });
  it("updates option-assigned photos while preserving manual variant photos", () => {
    const rows = getVariantRows(defaultValues);
    const redS = rows.find(
      (row) => row.optionValues.Color === "Red" && row.optionValues.Size === "S",
    );
    const redM = rows.find(
      (row) => row.optionValues.Color === "Red" && row.optionValues.Size === "M",
    );
    assert.ok(redS && redM);
    const variantOverrides: ProductFormValues["variantOverrides"] = {
      [redS.key]: { imageUrl: "https://example.com/old.jpg", imageSource: "option" },
      [redM.key]: { imageUrl: "https://example.com/manual.jpg", imageSource: "manual" },
    };
    const changed = applyOptionMediaAutoAssignment({
      variantOverrides,
      rows,
      optionMediaBindings: {
        optionTitle: "Color",
        mappings: { Red: ["https://example.com/new.jpg"] },
      },
    });
    assert.equal(changed[redS.key]?.imageUrl, "https://example.com/new.jpg");
    assert.equal(changed[redS.key]?.imageSource, "option");
    assert.equal(changed[redM.key]?.imageUrl, "https://example.com/manual.jpg");

    const cleared = applyOptionMediaAutoAssignment({
      variantOverrides: changed,
      rows,
      optionMediaBindings: null,
    });
    assert.equal(cleared[redS.key]?.imageUrl, undefined);
    assert.equal(cleared[redS.key]?.imageSource, undefined);
    assert.equal(cleared[redM.key]?.imageUrl, "https://example.com/manual.jpg");
  });
  it("handles null or empty bindings gracefully", () => {
    const rows = getVariantRows(defaultValues);
    const initialOverrides: ProductFormValues["variantOverrides"] = {
      "some-key": { priceAmount: "600" },
    };

    const resultWithNull = applyOptionMediaAutoAssignment({
      variantOverrides: initialOverrides,
      options,
      rows,
      optionMediaBindings: null,
    });
    assert.deepEqual(resultWithNull, initialOverrides);

    const resultWithEmpty = applyOptionMediaAutoAssignment({
      variantOverrides: initialOverrides,
      options,
      rows,
      optionMediaBindings: { optionTitle: "Color", mappings: {} },
    });
    assert.deepEqual(resultWithEmpty, initialOverrides);
  });

  it("initializes optionMediaBindings from product in getProductDefaultValues", () => {
    const mockProduct = {
      id: "prod_1",
      title: "Striped Polo",
      handle: "striped-polo",
      description: "Polo shirt",
      thumbnail: "https://example.com/polo.jpg",
      status: "published",
      categoryIds: [],
      collectionId: null,
      images: [{ id: "img_1", url: "https://example.com/polo.jpg" }],
      options: [
        {
          id: "opt_1",
          title: "Color",
          values: [{ id: "val_1", label: "Red", swatch: { kind: "color", value: "#ff0000" } }],
        },
      ],
      optionMediaBindings: {
        optionTitle: "Color",
        mappings: {
          Red: ["https://example.com/polo.jpg"],
        },
      },
      variants: [
        {
          id: "var_1",
          sku: "POLO-RED",
          imageUrl: "https://example.com/polo.jpg",
          optionValues: [{ optionId: "opt_1", optionTitle: "Color", value: "Red" }],
          prices: [{ currencyCode: "ETB", amount: 950 }],
          stock: { stockedQuantity: 15, reservedQuantity: 0 },
        },
      ],
    } as unknown as MerchantProduct;

    const values = getProductDefaultValues(mockProduct);
    assert.deepEqual(values.optionMediaBindings, {
      optionTitle: "Color",
      mappings: {
        Red: ["https://example.com/polo.jpg"],
      },
    });

    const initialOptions = getInitialProductOptions(mockProduct);
    const overrides = getInitialVariantOverrides(mockProduct, initialOptions);
    const firstOverride = Object.values(overrides)[0];
    assert.equal(firstOverride?.imageUrl, "https://example.com/polo.jpg");
  });

  it("includes variant imageUrl in getProductVariantsPayload", () => {
    const rows = getVariantRows(defaultValues);
    const firstRow = rows[0];
    assert.ok(firstRow, "First row must be present");
    const formValues: ProductFormValues = {
      ...defaultValues,
      variantOverrides: {
        [firstRow.key]: {
          imageUrl: "https://example.com/custom-variant.jpg",
          priceAmount: "750",
          stockedQuantity: "25",
        },
      },
    };

    const payload = getProductVariantsPayload(formValues);
    assert.ok(payload);
    const matched = payload.find((v) =>
      Object.entries(firstRow.optionValues).every(([k, val]) => v.optionValues[k] === val),
    );
    assert.ok(matched);
    assert.equal(matched.imageUrl, "https://example.com/custom-variant.jpg");
  });

  it("includes optionMediaBindings in getProductPayload", () => {
    const formValues: ProductFormValues = {
      ...defaultValues,
      optionMediaBindings: {
        optionTitle: "Color",
        mappings: {
          Red: ["https://example.com/red-1.jpg"],
        },
      },
    };

    const payload = getProductPayload(formValues, { includeOptions: true }, (key) => key);
    assert.deepEqual(payload.optionMediaBindings, {
      optionTitle: "Color",
      mappings: {
        Red: ["https://example.com/red-1.jpg"],
      },
    });
  });

  it("renders VariantImagePicker with thumbnail when imageUrl is provided", () => {
    const markup = renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        {
          locale: "en",
          messages: {
            media: { variantPhotoChange: "Change photo", variantPhotoAssign: "Add photo" },
          },
        } as unknown as Parameters<typeof NextIntlClientProvider>[0],
        createElement(VariantImagePicker, {
          imageUrl: "https://example.com/active-photo.jpg",
          galleryImages: ["https://example.com/active-photo.jpg", "https://example.com/other.jpg"],
          onSelectImage: () => {},
          onRemoveImage: () => {},
        }),
      ),
    );

    assert.match(markup, /<img/);
    assert.match(markup, /src="https:\/\/example\.com\/active-photo\.jpg"/);
    assert.match(markup, /size-9 rounded-lg object-cover border/);
  });

  it("renders VariantImagePicker placeholder button when imageUrl is empty", () => {
    const markup = renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        {
          locale: "en",
          messages: {
            media: { variantPhotoChange: "Change photo", variantPhotoAssign: "Add photo" },
          },
        } as unknown as Parameters<typeof NextIntlClientProvider>[0],
        createElement(VariantImagePicker, {
          imageUrl: undefined,
          galleryImages: ["https://example.com/other.jpg"],
          onSelectImage: () => {},
          onRemoveImage: () => {},
        }),
      ),
    );

    assert.doesNotMatch(markup, /<img/);
    assert.match(markup, /size-9 rounded-lg border border-dashed/);
  });

  it("supports positional argument invocation for applyOptionMediaAutoAssignment", () => {
    const rows = getVariantRows(defaultValues);
    const redS = rows.find((r) => r.optionValues.Color === "Red" && r.optionValues.Size === "S");
    assert.ok(redS, "Row must be present");

    const bindings: ProductOptionMediaBindings = {
      optionTitle: "Color",
      mappings: {
        Red: ["https://example.com/positional-red.jpg"],
      },
    };

    const updated = applyOptionMediaAutoAssignment({}, options, rows, bindings);
    assert.equal(updated[redS.key]?.imageUrl, "https://example.com/positional-red.jpg");
  });

  it("sends imageUrl as null in getProductVariantsPayload when an existing variant image is cleared", () => {
    const rows = getVariantRows(defaultValues);
    const firstRow = rows[0];
    assert.ok(firstRow, "First row must be present");
    const formValues: ProductFormValues = {
      ...defaultValues,
      variantOverrides: {
        [firstRow.key]: {
          id: "var_existing_1",
          imageUrl: undefined,
          priceAmount: "750",
          stockedQuantity: "25",
        },
      },
    };

    const payload = getProductVariantsPayload(formValues);
    assert.ok(payload);
    const matched = payload.find((v) => v.id === "var_existing_1");
    assert.ok(matched);
    assert.equal(matched.imageUrl, null);
  });

  it("prunes stale deleted image URLs from variantOverrides when validImageUrls is provided", () => {
    const rows = getVariantRows(defaultValues);
    const redS = rows.find((r) => r.optionValues.Color === "Red" && r.optionValues.Size === "S");
    assert.ok(redS, "Row must be present");

    const staleOverrides: ProductFormValues["variantOverrides"] = {
      [redS.key]: {
        imageUrl: "https://example.com/deleted-image.jpg",
        imageSource: "option",
      },
    };

    const bindings: ProductOptionMediaBindings = {
      optionTitle: "Color",
      mappings: {
        Red: ["https://example.com/new-red.jpg"],
      },
    };

    const validUrls = ["https://example.com/new-red.jpg"];

    const updated = applyOptionMediaAutoAssignment({
      variantOverrides: staleOverrides,
      options,
      rows,
      optionMediaBindings: bindings,
      validImageUrls: validUrls,
    });

    assert.equal(updated[redS.key]?.imageUrl, "https://example.com/new-red.jpg");
    const removed = applyOptionMediaAutoAssignment({
      variantOverrides: staleOverrides,
      options,
      rows,
      optionMediaBindings: bindings,
      validImageUrls: [],
    });
    assert.equal(removed[redS.key]?.imageUrl, undefined);
  });

  it("isVisualOptionTitle matches visual option titles and keeps Material as text pills", () => {
    assert.equal(isVisualOptionTitle("Color"), true);
    assert.equal(isVisualOptionTitle("colour"), true);
    assert.equal(isVisualOptionTitle("Pattern"), true);
    assert.equal(isVisualOptionTitle("Fabric"), true);
    assert.equal(isVisualOptionTitle("Material"), false);
    assert.equal(isVisualOptionTitle("Texture"), true);
    assert.equal(isVisualOptionTitle("Finish"), true);
    assert.equal(isVisualOptionTitle("Size"), false);
    assert.equal(isColorOptionTitle("Pattern"), true);
  });

  it("renders ImageOptionTagPopover with untagged and tagged states", async () => {
    const { ImageOptionTagPopover } = await import("@/features/media/media-upload-field");
    const { NextIntlClientProvider } = await import("next-intl");
    const messages = {
      media: {
        tagForAll: "Every choice",
        tagAction: "Show photo for",
        tagAria: "Show photo for: {choice}",
      },
    };
    const renderTag = (currentTag: { optionTitle: string; valueLabel: string } | null) =>
      renderToStaticMarkup(
        createElement(
          NextIntlClientProvider,
          { locale: "en", messages } as unknown as Parameters<typeof NextIntlClientProvider>[0],
          createElement(ImageOptionTagPopover, {
            currentTag,
            options,
            onSelectTag: () => {},
          }),
        ),
      );

    assert.match(renderTag(null), /Every choice/);
    assert.match(renderTag({ optionTitle: "Color", valueLabel: "Red" }), /Red/);
  });

  it("renders ProductMediaSection with options and optionMediaBindings wired", async () => {
    const { ProductMediaSection } = await import("./product-form-sections");
    const { NextIntlClientProvider } = await import("next-intl");
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const { TooltipProvider } = await import("@/components/ui/tooltip");

    const queryClient = new QueryClient();
    const markup = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          NextIntlClientProvider,
          {
            locale: "en",
            messages: {},
          } as unknown as Parameters<typeof NextIntlClientProvider>[0],
          createElement(
            TooltipProvider,
            null,
            createElement(ProductMediaSection, {
              imageUrls: ["https://example.com/polo-1.jpg"],
              thumbnail: "https://example.com/polo-1.jpg",
              onImageUrlsChange: () => {},
              onThumbnailChange: () => {},
              options,
              optionMediaBindings: {
                optionTitle: "Color",
                mappings: {
                  Red: ["https://example.com/polo-1.jpg"],
                },
              },
            }),
          ),
        ),
      ),
    );

    assert.match(markup, /src="https:\/\/example\.com\/polo-1\.jpg"/);
    assert.match(markup, /Red/);
  });
});
