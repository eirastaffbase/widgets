// ─────────────────────────────────────────────────────────────────────────────
// Multibranding: resolve the viewer's brand color, corner radius and pinned post.
//
// Resolution order, first match wins:
//   1. A `brandoverrides` entry whose `groupId` is one of the viewer's groups.
//   2. The tenant's own branding theme, via the shared theming API helper.
//   3. The widget's neutral defaults.
//
// Only accents are branded — buttons, chips, active states, the like heart. Card
// chrome deliberately stays neutral so the feed reads modern and generic on any
// tenant rather than looking like a skinned brand page.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchThemeColors } from "../tasks/shared/theming";
import { Brand, BrandOverride } from "./types";

export const NEUTRAL_COLOR = "#1F6FEB";
export const DEFAULT_RADIUS = "14px";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isHex(s: string): boolean {
  return HEX.test(String(s || "").trim());
}

export function hexToRgb(hex: string): string {
  const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)).join(",");
}

/** Readable foreground for text placed on `hex`. Uses the WCAG relative
 *  luminance threshold rather than a naive average, so mid-tone brand colors
 *  (like El Globo's #8B374A) resolve correctly. */
export function contrastColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex).split(",").map(Number);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.55 ? "#111418" : "#FFFFFF";
}

/** Normalize a radius value. Bare numbers are treated as px so admins can type
 *  `5` instead of `5px`. */
function normalizeRadius(raw: string | undefined, fallback: string): string {
  const v = String(raw == null ? "" : raw).trim();
  if (!v) return fallback;
  return /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v;
}

/** Parse the `brandoverrides` JSON config. Invalid JSON yields no overrides
 *  rather than breaking the widget — a malformed brand rule should cost you the
 *  brand color, not the feed. */
export function parseOverrides(raw: string, log: (...a: any[]) => void): BrandOverride[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((o: any) => o && typeof o.groupId === "string" && o.groupId);
  } catch (e: any) {
    log("brandoverrides is not valid JSON —", e && e.message);
    return [];
  }
}

export async function resolveBrand(opts: {
  baseUrl: string;
  apiToken: string;
  overrides: BrandOverride[];
  viewerGroupIds: string[];
  useThemeColor: boolean;
  fallbackColor: string;
  fallbackRadius: string;
  fallbackPinnedPostId: string;
  log: (...a: any[]) => void;
}): Promise<Brand> {
  const {
    baseUrl, apiToken, overrides, viewerGroupIds, useThemeColor,
    fallbackColor, fallbackRadius, fallbackPinnedPostId, log,
  } = opts;

  const groups = new Set(viewerGroupIds || []);
  const match = overrides.find(o => groups.has(o.groupId));

  let color = "";
  let radius = "";
  let pinnedPostId = "";
  let matchedLabel = "";

  if (match) {
    matchedLabel = match.label || match.groupId;
    if (isHex(match.color || "")) color = String(match.color).trim();
    radius = normalizeRadius(match.radius, "");
    pinnedPostId = String(match.pinnedPostId || "").trim();
    log(`brand override matched: ${matchedLabel}`);
  }

  // Only reach for the theming API when no override supplied a color — an
  // override is an explicit decision and must not be second-guessed.
  if (!color && useThemeColor && apiToken) {
    const themed = await fetchThemeColors(baseUrl, apiToken, "primary", "light");
    if (themed.primary && isHex(themed.primary)) {
      color = themed.primary;
      log(`brand color from theming API: ${color}`);
    }
  }

  if (!color) color = isHex(fallbackColor) ? fallbackColor : NEUTRAL_COLOR;
  if (!radius) radius = normalizeRadius(fallbackRadius, DEFAULT_RADIUS);
  if (!pinnedPostId) pinnedPostId = String(fallbackPinnedPostId || "").trim();

  return {
    color,
    colorRgb: hexToRgb(color),
    onColor: contrastColor(color),
    radius,
    pinnedPostId,
    matchedLabel,
  };
}
