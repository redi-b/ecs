import type { StorefrontEditorManifest } from "./schema";
import { classicV1EditorSchema } from "../templates/classic/v1/editor";
import { luviaV1EditorSchema } from "../templates/luvia/v1/editor";

export const storefrontEditorManifests: Record<string, StorefrontEditorManifest> = {
  "classic@1": classicV1EditorSchema,
  "luvia@1": luviaV1EditorSchema,
};

export function getStorefrontEditorManifest(templateKey: string) {
  return storefrontEditorManifests[templateKey];
}
