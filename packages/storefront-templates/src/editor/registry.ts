import type { StorefrontEditorManifest } from "./schema";
import type { StorefrontTemplateKey } from "../registry";
import { classicV1EditorSchema } from "../templates/classic/v1/editor";
import { luviaV1EditorSchema } from "../templates/luvia/v1/editor";

export const storefrontEditorManifests: Record<StorefrontTemplateKey, StorefrontEditorManifest> = {
  "classic@1": classicV1EditorSchema,
  "luvia@1": luviaV1EditorSchema,
};

export function getStorefrontEditorManifest(
  templateKey: string,
): StorefrontEditorManifest | undefined {
  return storefrontEditorManifests[templateKey as StorefrontTemplateKey];
}
