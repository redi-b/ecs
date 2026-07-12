import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  assertPublicHttpUrl,
  filenameFromUrl,
  isAllowedMediaImportMime,
  MEDIA_URL_IMPORT_MAX_BYTES,
} from "@/lib/media-url-import";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";

const FETCH_TIMEOUT_MS = 20_000;

/**
 * Fetch a remote image server-side so the client can stage it into Uppy
 * (same AwsS3 complete pipeline as local files) without Companion or CORS.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const platformApiBaseUrl = getPlatformApiBaseUrl();
  const probe = await fetch(`${platformApiBaseUrl}/platform/merchant/media?limit=1&offset=0`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      cookie: cookieHeader,
      ...(requestHost ? { "x-forwarded-host": requestHost } : {}),
    },
  }).catch(() => null);

  if (!probe || probe.status === 401 || probe.status === 403) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  if (typeof body?.url !== "string" || !body.url.trim()) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = assertPublicHttpUrl(body.url);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_url";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.8",
        "user-agent": "ecs-media-url-import/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
    }

    try {
      assertPublicHttpUrl(upstream.url);
    } catch {
      return NextResponse.json({ error: "private_url" }, { status: 400 });
    }

    const contentTypeHeader = upstream.headers.get("content-type") ?? "";
    const mimeType = contentTypeHeader.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!isAllowedMediaImportMime(mimeType)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }

    const contentLength = Number(upstream.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MEDIA_URL_IMPORT_MAX_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 400 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: "empty_file" }, { status: 400 });
    }
    if (buffer.byteLength > MEDIA_URL_IMPORT_MAX_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 400 });
    }

    const filename = filenameFromUrl(target.toString(), mimeType);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "content-type": mimeType,
        "x-media-filename": encodeURIComponent(filename),
        "x-media-mime-type": mimeType,
      },
      status: 200,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
