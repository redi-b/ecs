export type TaxonomyFormInput = {
  handle: string | null;
  mediaUrl: string | null;
  name: string | null;
  title: string | null;
};

export function getTaxonomyFormInput(formData: FormData): TaxonomyFormInput {
  return {
    handle: getOptionalString(formData, "handle"),
    mediaUrl: getOptionalString(formData, "mediaUrl"),
    name: getOptionalString(formData, "name"),
    title: getOptionalString(formData, "title"),
  };
}

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}
