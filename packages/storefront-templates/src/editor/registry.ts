import type { StorefrontTemplateKey } from "../registry";
import { luviaV1EditorSchema } from "../templates/luvia/v1/editor";
import { nexahubV1EditorSchema } from "../templates/nexahub/v1/editor";
import type { StorefrontEditorManifest } from "./schema";

export const storefrontEditorManifests: Record<StorefrontTemplateKey, StorefrontEditorManifest> = {
  "luvia@1": luviaV1EditorSchema,
  "nexahub@1": nexahubV1EditorSchema,
};

export function getStorefrontEditorManifest(
  templateKey: string,
): StorefrontEditorManifest | undefined {
  return storefrontEditorManifests[templateKey as StorefrontTemplateKey];
}
