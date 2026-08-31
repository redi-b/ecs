import { z } from "zod";

export const storefrontEditorFieldKindSchema = z.enum([
  "text",
  "textarea",
  "image",
  "link",
  "color",
  "boolean",
  "collection",
  "collections",
  "product",
  "products",
  "links",
]);

export const storefrontEditorFieldSchema = z.object({
  path: z.string().min(1),
  prop: z.string().min(1),
  label: z.string().min(1),
  kind: storefrontEditorFieldKindSchema,
  helpText: z.string().optional(),
  /** Maximum selectable items for product/collection multi-pickers. */
  maxItems: z.number().int().positive().optional(),
  /** Obsolete persisted paths removed when this replacement field is saved. */
  deprecatedPaths: z.array(z.string().min(1)).optional(),
  /** How the iframe applies unsaved structured values without replacing template-owned markup. */
  preview: z.object({
    strategy: z.enum(["replace-children", "preserve-structure", "list-items", "variant-options"]),
    variants: z.array(z.string().min(1)).optional(),
  }).optional(),
}).superRefine((field, context) => {
  if (field.preview?.strategy === "variant-options" && !field.preview.variants?.length) {
    context.addIssue({ code: "custom", message: "variant-options preview fields require variants", path: ["preview", "variants"] });
  }
  if (field.maxItems && field.kind !== "products" && field.kind !== "collections") {
    context.addIssue({ code: "custom", message: "maxItems is only valid for multi-select fields", path: ["maxItems"] });
  }
});

export const storefrontEditorSectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Preview descriptor to display when this section is selected. */
  previewPage: z.string().min(1).optional(),
  fields: z.array(storefrontEditorFieldSchema).min(1),
});

export const storefrontEditorPreviewPageSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const storefrontEditorColorRoleSchema = z.enum([
  "primary",
  "background",
  "foreground",
  "muted",
  "accent",
]);

export const storefrontEditorThemeSchema = z.object({
  /** Surface switching is opt-in because some templates are intentionally light- or dark-only. */
  allowSurfaceMode: z.boolean().default(true),
  /** Color roles a merchant may override after disabling the generated palette. */
  editableColors: z.array(storefrontEditorColorRoleSchema).min(1).default([
    "primary",
    "background",
    "foreground",
    "muted",
    "accent",
  ]),
  /** Palette relationship authored by the template designer. */
  paletteStrategy: z.enum(["tonal", "contrasting"]).default("contrasting"),
});

export const storefrontEditorManifestSchema = z.object({
  templateKey: z.string().min(1),
  templateVersion: z.number().int().positive(),
  previewMode: z.literal("iframe"),
  previewPages: z.array(storefrontEditorPreviewPageSchema).min(1).default([{ id: "home", label: "Home" }]),
  theme: storefrontEditorThemeSchema.optional(),
  sections: z.array(storefrontEditorSectionSchema).min(1),
});

export type StorefrontEditorFieldKind = z.infer<typeof storefrontEditorFieldKindSchema>;
export type StorefrontEditorField = z.infer<typeof storefrontEditorFieldSchema>;
export type StorefrontEditorSection = z.infer<typeof storefrontEditorSectionSchema>;
export type StorefrontEditorPreviewPage = z.infer<typeof storefrontEditorPreviewPageSchema>;
export type StorefrontEditorColorRole = z.infer<typeof storefrontEditorColorRoleSchema>;
export type StorefrontEditorManifest = z.infer<typeof storefrontEditorManifestSchema>;
