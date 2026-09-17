// ─────────────────────────────────────────────────────────────────────────────
// Multibranding: resolve the viewer's brand color, corner radius and pinned post.
//
// Resolution order, first match wins:
//   1. A `brandoverrides` rule matching one of the viewer's groups, by ID or by
//      group name.
//   2. The tenant's own branding theme, via the shared theming API helper.
//   3. The widget's neutral defaults.
//
// Only accents are branded — buttons, chips, active states, the like heart. Card
// chrome deliberately stays neutral so the feed reads modern and generic on any
// tenant rather than looking like a skinned brand page.
//
// Why a rule may name several groups, and why names are matched at all: this
// tenant has TWO distinct groups both called "El Globo"
// (6aaa7d70a742e5436549bc91 and 6a42ed4319053625a91b37c2). Targeting the wrong
// one produced no error and no brand — the widget just quietly fell back to the
// theming colour. Matching by name, and allowing a rule to list several IDs,
// removes that failure mode.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchThemeColors } from "../tasks/shared/theming";
import { Brand, BrandOverride } from "./types";

export const NEUTRAL_COLOR = "#1F6FEB";
export const DEFAULT_RADIUS = "14px";

/** Staffbase IDs are 24-char hex (ObjectId-style); anything else is a name. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isHex(s: string): boolean {
  return HEX.test(String(s || "").trim());
}

export function hexToRgb(hex: string): string {
  const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)).join(",");
}

/** Readable foreground for text placed on `hex`.
 *
 *  Picks whichever of the two foregrounds has the higher WCAG contrast ratio
 *  instead of comparing luminance against a fixed cut-off. A fixed threshold
 *  gets mid-tone brands wrong: the real crossover sits near luminance 0.19, so
 *  a 0.55 cut-off handed white text to colors like #FF8D19 (2.3:1 — fails AA)
 *  where dark text scores 8.1:1. Dark brands such as #8B374A still get white. */
export function contrastColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex).split(",").map(Number);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (other: number) =>
    (Math.max(luminance, other) + 0.05) / (Math.min(luminance, other) + 0.05);
  return ratio(DARK_LUMINANCE) >= ratio(1) ? "#111418" : "#FFFFFF";
}

/** Relative luminance of #111418, the dark foreground contrastColor may pick. */
const DARK_LUMINANCE = 0.00596;

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
    return parsed.filter((o: any) => o && ruleTargets(o).length);
  } catch (e: any) {
    log("brandoverrides is not valid JSON —", e && e.message);
    return [];
  }
}

/** The group IDs or names a rule applies to. Accepts `group` as a string or an
 *  array, and the legacy single `groupId`. */
export function ruleTargets(rule: BrandOverride): string[] {
  const raw: unknown[] = Array.isArray(rule.group)
    ? rule.group
    : [rule.group, (rule as any).groupId];
  return raw.map(v => String(v == null ? "" : v).trim()).filter(Boolean);
}

/** Case- and accent-insensitive key, so a rule saying "El Globo" matches a
 *  group stored as "el globo" or "EL GLOBO". */
const norm = (s: string): string =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/**
 * Collect the viewer's branding groups from the host DOM.
 *
 * Staffbase's own multibranding puts a `group-<id>` class on an ancestor (the
 * body/html element), which is exactly what tenant custom CSS keys off —
 * `.group-6aaa7d70a742e5436549bc91 .header-title { … }`. Reading it costs
 * nothing and reflects what the host actually believes about this viewer, which
 * makes it a better signal than the profile call alone.
 */
export function groupsFromDom(start: Element | null): string[] {
  const found: string[] = [];
  for (let el: Element | null = start; el; el = el.parentElement) {
    // `className` is not a string on SVG elements, so read the attribute.
    const cls = el.getAttribute && el.getAttribute("class");
    if (!cls) continue;
    for (const token of cls.split(/\s+/)) {
      const m = /^group-([0-9a-f]{24})$/i.exec(token);
      if (m) found.push(m[1]);
    }
  }
  return Array.from(new Set(found));
}

/** True when any rule targets something other than a 24-hex ID, which is the
 *  only case where group names have to be fetched. Pure-ID configs stay free. */
export const needsGroupNames = (overrides: BrandOverride[]): boolean =>
  overrides.some(o => ruleTargets(o).some(g => !OBJECT_ID.test(g)));

export async function resolveBrand(opts: {
  baseUrl: string;
  apiToken: string;
  overrides: BrandOverride[];
  viewerGroupIds: string[];
  /** id → name for the viewer's groups; empty when only IDs were configured. */
  groupNames?: Map<string, string>;
  useThemeColor: boolean;
  fallbackColor: string;
  fallbackRadius: string;
  fallbackPinnedPostId: string;
  log: (...a: any[]) => void;
}): Promise<Brand> {
  const {
    baseUrl, apiToken, overrides, viewerGroupIds, groupNames, useThemeColor,
    fallbackColor, fallbackRadius, fallbackPinnedPostId, log,
  } = opts;

  const ids = new Set(viewerGroupIds || []);
  const names = new Set(
    (viewerGroupIds || [])
      .map(id => norm((groupNames && groupNames.get(id)) || ""))
      .filter(Boolean),
  );

  log(`brand: viewer in ${ids.size} group(s)`, Array.from(ids).join(",") || "(none)");
  if (names.size) log("brand: group names", Array.from(names).join(" | "));

  let match: BrandOverride | undefined;
  let matchedVia = "";

  for (const rule of overrides) {
    const targets = ruleTargets(rule);
    const hitId = targets.find(g => ids.has(g));
    const hitName = hitId ? "" : targets.find(g => !OBJECT_ID.test(g) && names.has(norm(g)));
    if (hitId || hitName) {
      match = rule;
      matchedVia = hitId ? `group id ${hitId}` : `group name "${hitName}"`;
      break;
    }
    log(`brand: no match for rule ${rule.label || targets.join("/")} (${targets.join(", ")})`);
  }

  let color = "";
  let radius = "";
  let pinnedPostId = "";
  let matchedLabel = "";

  if (match) {
    matchedLabel = match.label || ruleTargets(match)[0] || "";
    if (isHex(match.color || "")) color = String(match.color).trim();
    radius = normalizeRadius(match.radius, "");
    pinnedPostId = String(match.pinnedPostId || "").trim();
    log(`brand: matched "${matchedLabel}" via ${matchedVia} — color ${color || "(none)"}, radius ${radius || "(default)"}`);
  } else if (overrides.length) {
    log(`brand: viewer matched none of ${overrides.length} rule(s) — using theme/defaults`);
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
