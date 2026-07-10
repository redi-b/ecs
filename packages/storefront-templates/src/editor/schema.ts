import { z } from "zod";

export const storefrontEditorFieldKindSchema = z.enum([
  "text",
  "textarea",
  "image",
  "link",
  "color",
]);

export const storefrontEditorFieldSchema = z.object({
  path: z.string().min(1),
  prop: z.string().min(1),
  label: z.string().min(1),
  kind: storefrontEditorFieldKindSchema,
  helpText: z.string().optional(),
});

export const storefrontEditorSectionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  fields: z.array(storefrontEditorFieldSchema).min(1),
});

export const storefrontEditorManifestSchema = z.object({
  templateKey: z.string().min(1),
  templateVersion: z.number().int().positive(),
  sections: z.array(storefrontEditorSectionSchema).min(1),
});

export type StorefrontEditorFieldKind = z.infer<typeof storefrontEditorFieldKindSchema>;
export type StorefrontEditorField = z.infer<typeof storefrontEditorFieldSchema>;
export type StorefrontEditorSection = z.infer<typeof storefrontEditorSectionSchema>;
export type StorefrontEditorManifest = z.infer<typeof storefrontEditorManifestSchema>;
