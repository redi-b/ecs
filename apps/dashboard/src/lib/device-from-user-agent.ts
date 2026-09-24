/**
 * Parse a browser user-agent into merchant-friendly device / OS / browser labels.
 * Tolerates sparse UAs and prefers "unknown" over guessing Desktop.
 */

export type DeviceParseLabels = {
  browser: string;
  deviceLabel: string;
  os: string;
  /** Coarse form factor for icons. */
  form: "phone" | "tablet" | "desktop" | "unknown";
  browserKind: "chrome" | "safari" | "firefox" | "edge" | "other" | "unknown";
  osKind: "ios" | "android" | "macos" | "windows" | "linux" | "unknown";
};

type DeviceLabelOverrides = {
  browser?: string;
  deviceLabel?: string;
  os?: string;
};

const DEFAULTS: Required<DeviceLabelOverrides> = {
  browser: "Unknown browser",
  deviceLabel: "Unknown device",
  os: "Unknown OS",
};

export function parseDeviceFromUserAgent(
  userAgent: string | null | undefined,
  labels: DeviceLabelOverrides = {},
): DeviceParseLabels {
  const unknownBrowser = labels.browser ?? DEFAULTS.browser;
  const unknownDevice = labels.deviceLabel ?? DEFAULTS.deviceLabel;
  const unknownOs = labels.os ?? DEFAULTS.os;

  const raw = userAgent?.trim() || "";
  const ua = raw.toLowerCase();

  if (!raw || !looksLikeBrowserUa(ua)) {
    return {
      browser: unknownBrowser,
      deviceLabel: unknownDevice,
      os: unknownOs,
      form: "unknown",
      browserKind: "unknown",
      osKind: "unknown",
    };
  }

  const isIos = /iphone|ipad|ipod/.test(ua);
  const isIpad =
    ua.includes("ipad") ||
    // iPadOS desktop-class UA still exposes Macintosh + touch elsewhere; keep explicit ipad token.
    (ua.includes("macintosh") && ua.includes("mobile"));
  const isAndroid = ua.includes("android");
  const isMobileToken = /mobile|mobi|opera mini|iemobile|webos|blackberry/.test(ua);
  const isTabletToken =
    isIpad ||
    ua.includes("tablet") ||
    (isAndroid && !isMobileToken) ||
    ua.includes("kindle") ||
    ua.includes("silk");
  const isPhone = (isIos && !isIpad) || (isAndroid && isMobileToken) || (isMobileToken && !isTabletToken);
  const isMac = (ua.includes("mac os") || ua.includes("macintosh")) && !isIos && !isIpad;
  const isWindows = ua.includes("windows");
  const isLinux = ua.includes("linux") && !isAndroid;

  let form: DeviceParseLabels["form"] = "desktop";
  let deviceLabel = "Desktop";
  if (isIpad || (isIos && ua.includes("ipad"))) {
    form = "tablet";
    deviceLabel = "iPad";
  } else if (isIos || (isPhone && /iphone|ipod/.test(ua))) {
    form = "phone";
    deviceLabel = "iPhone";
  } else if (isAndroid && isTabletToken) {
    form = "tablet";
    deviceLabel = "Android tablet";
  } else if (isAndroid || (isPhone && isAndroid)) {
    form = "phone";
    deviceLabel = "Android phone";
  } else if (isPhone) {
    form = "phone";
    deviceLabel = "Mobile device";
  } else if (isTabletToken) {
    form = "tablet";
    deviceLabel = "Tablet";
  } else if (isMac) {
    form = "desktop";
    deviceLabel = "Mac";
  } else if (isWindows) {
    form = "desktop";
    deviceLabel = "Windows PC";
  } else if (isLinux) {
    form = "desktop";
    deviceLabel = "Linux PC";
  }

  let osKind: DeviceParseLabels["osKind"] = "unknown";
  let os = unknownOs;
  if (isIos || isIpad) {
    osKind = "ios";
    const match = raw.match(/OS (\d+[._]\d+(?:[._]\d+)?)/i);
    os = match ? `iOS ${match[1]?.replaceAll("_", ".")}` : "iOS";
  } else if (isAndroid) {
    osKind = "android";
    const match = raw.match(/Android ([\d.]+)/i);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (isMac) {
    osKind = "macos";
    const match = raw.match(/Mac OS X ([\d_.]+)/i);
    os = match ? `macOS ${match[1]?.replaceAll("_", ".")}` : "macOS";
  } else if (isWindows) {
    osKind = "windows";
    if (ua.includes("windows nt 10") || ua.includes("windows nt 11")) os = "Windows 10/11";
    else if (ua.includes("windows nt 6.3")) os = "Windows 8.1";
    else if (ua.includes("windows nt 6.1")) os = "Windows 7";
    else os = "Windows";
  } else if (isLinux) {
    osKind = "linux";
    os = "Linux";
  }

  let browserKind: DeviceParseLabels["browserKind"] = "other";
  let browser = unknownBrowser;
  if (ua.includes("edg/") || ua.includes("edgios") || ua.includes("edga")) {
    browserKind = "edge";
    browser = "Microsoft Edge";
  } else if (ua.includes("firefox") || ua.includes("fxios")) {
    browserKind = "firefox";
    browser = "Firefox";
  } else if (
    ua.includes("crios") ||
    (ua.includes("chrome") && !ua.includes("edg")) ||
    ua.includes("chromium")
  ) {
    browserKind = "chrome";
    browser = "Chrome";
  } else if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("crios") && !ua.includes("chromium")) {
    browserKind = "safari";
    browser = "Safari";
  } else if (raw) {
    browserKind = "other";
    browser = "Browser";
  } else {
    browserKind = "unknown";
  }

  return { browser, browserKind, deviceLabel, form, os, osKind };
}

function looksLikeBrowserUa(ua: string) {
  if (!ua) return false;
  // Server-side fetch clients should never be shown as "Desktop".
  if (/^(node|undici|axios|python|curl|go-http|java|okhttp|postman)/i.test(ua)) {
    return false;
  }
  return /mozilla|applewebkit|chrome|safari|firefox|edg|mobile|android|iphone|ipad|crios|fxios/i.test(
    ua,
  );
}
