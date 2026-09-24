"use client";

import { usePermission } from "@/components/app/access-context";
import { MEDIA_UPLOADED_EVENT, MediaUploadComposer } from "@/features/media/media-upload-composer";

/** Dashboard-shell host keeps active uploads alive across page navigation. */
export function MediaUploadHost() {
  const canManageMedia = usePermission("media.manage");
  if (!canManageMedia) return null;

  return (
    <MediaUploadComposer
      onUploaded={() => window.dispatchEvent(new Event(MEDIA_UPLOADED_EVENT))}
      showTrigger={false}
    />
  );
}
