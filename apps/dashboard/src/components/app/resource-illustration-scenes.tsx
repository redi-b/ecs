import React from "react";

export type ResourceIllustrationKind =
  | "empty"
  | "customers"
  | "media"
  | "categories"
  | "collections"
  | "promotions"
  | "inquiries";

/** Shared blue-ink geometry; each scene communicates a resource, never a status. */
export function ResourceIllustrationScene({ kind }: { kind: ResourceIllustrationKind }) {
  return (
    <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      {kind === "customers" ? (
        <>
          <circle cx="45" cy="39" r="11" fill="currentColor" fillOpacity="0.08" />
          <path d="M24 76v-8a21 21 0 0 1 42 0v8z" fill="currentColor" fillOpacity="0.06" />
          <path d="M67 30a10 10 0 0 1 0 20m7 8a18 18 0 0 1 10 16" opacity="0.5" />
        </>
      ) : kind === "media" ? (
        <>
          <path d="m27 25 52 5-5 48-52-5z" fill="currentColor" fillOpacity="0.06" />
          <path d="M29 35h52v43H29z" fill="oklch(0.97 0.012 265)" />
          <path d="m30 69 16-18 13 13 9-9 12 14" fill="currentColor" fillOpacity="0.08" />
          <circle cx="67" cy="46" r="4" fill="currentColor" fillOpacity="0.15" />
        </>
      ) : kind === "categories" ? (
        <>
          <rect x="40" y="24" width="24" height="19" rx="4" fill="currentColor" fillOpacity="0.1" />
          <path d="M52 43v13H29v10m23-10h23v10" opacity="0.5" />
          <rect
            x="17"
            y="66"
            width="24"
            height="18"
            rx="4"
            fill="currentColor"
            fillOpacity="0.06"
          />
          <rect
            x="63"
            y="66"
            width="24"
            height="18"
            rx="4"
            fill="currentColor"
            fillOpacity="0.06"
          />
        </>
      ) : kind === "collections" ? (
        <>
          <path d="M23 37V27h24l7 8h28v43H23z" fill="currentColor" fillOpacity="0.06" />
          <path d="m19 44 65-3-7 39H25z" fill="oklch(0.97 0.012 265)" />
          <path d="M39 55h24M39 64h16" opacity="0.5" />
        </>
      ) : kind === "promotions" ? (
        <>
          <path
            d="M24 34h56v14a7 7 0 0 0 0 14v14H24V62a7 7 0 0 0 0-14z"
            fill="currentColor"
            fillOpacity="0.06"
          />
          <path d="M63 35v40" strokeDasharray="3 5" opacity="0.35" />
          <path d="m35 63 16-16" />
          <circle cx="36" cy="47" r="3" />
          <circle cx="50" cy="63" r="3" />
        </>
      ) : kind === "inquiries" ? (
        <>
          <path d="M23 28h58v40H46L32 80V68h-9z" fill="currentColor" fillOpacity="0.06" />
          <path d="M35 42h34M35 52h22" opacity="0.55" />
        </>
      ) : (
        <>
          <ellipse
            cx="52"
            cy="80"
            rx="30"
            ry="4.5"
            fill="currentColor"
            fillOpacity="0.07"
            stroke="none"
          />
          {/* Back open flaps */}
          <path d="m26 39-9-10 26-13 9 10z" fill="currentColor" fillOpacity="0.04" />
          <path d="m52 26 9-10 26 13-9 10z" fill="currentColor" fillOpacity="0.04" />
          {/* Interior cavity & floor */}
          <path d="M26 39 52 26v26L38 59z" fill="currentColor" fillOpacity="0.08" />
          <path d="M78 39 52 26v26L66 59z" fill="currentColor" fillOpacity="0.05" />
          <path d="m52 52 14 7-14 7-14-7z" fill="currentColor" fillOpacity="0.13" />
          <path d="M52 26v26" opacity="0.35" />
          {/* Front walls */}
          <path d="M26 39v26l26 13V52z" fill="currentColor" fillOpacity="0.05" />
          <path d="M52 52v26l26-13V39z" fill="currentColor" fillOpacity="0.09" />
          <path d="M52 52v26" />
          {/* Front-left parcel shipping label */}
          <path d="m31 53 13 6.5v11l-13-6.5z" fill="oklch(0.97 0.012 265)" />
          <path d="m34 58 7 3.5M34 63 39 65.5" opacity="0.45" strokeWidth="1.5" />
          {/* Front folded flaps */}
          <path d="m26 39-11 8 26 13 11-8z" fill="oklch(0.97 0.012 265)" />
          <path d="m52 52 11 8 26-13-11-8z" fill="oklch(0.97 0.012 265)" />
        </>
      )}
      {kind !== "empty" && <path d="M83 20v7m-3.5-3.5h7" opacity="0.7" />}
    </g>
  );
}
