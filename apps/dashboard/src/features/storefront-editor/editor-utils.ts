import type { Data, PuckAction } from "@puckeditor/core";

import {
  STOREFRONT_PAGE_COMPONENT,
  type StorefrontPageProps,
} from "./editor-state";

export function updateStorefrontProp(
  data: Data,
  dispatch: (action: PuckAction) => void,
  propName: keyof StorefrontPageProps,
  value: unknown,
) {
  updateStorefrontProps(data, dispatch, { [propName]: value });
}

export function updateStorefrontProps(
  data: Data,
  dispatch: (action: PuckAction) => void,
  patch: Partial<StorefrontPageProps>,
) {
  dispatch({
    type: "setData",
    data: {
      ...data,
      content: data.content.map((entry) =>
        entry.type === STOREFRONT_PAGE_COMPONENT
          ? {
              ...entry,
              props: {
                ...entry.props,
                ...patch,
              },
            }
          : entry,
      ),
    },
  });
}

export function preventPreviewLink(event: React.MouseEvent<HTMLElement>) {
  event.preventDefault();
}

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
