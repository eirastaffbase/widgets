/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Theming — pulls brand colors from the Staffbase theming API, plus the color
// math the widget needs to keep those colors readable on either surface.
//
// Ported from `tasks/shared/theming.ts`, which the task widgets import directly.
// This widget is its own npm/webpack package root, so a relative import would
// reach outside the build root; the code is copied instead. The dark-surface
// reference color is parameterized here so contrast is measured against the
// surface this widget actually paints, not the leaderboard's near-black stage.
//
// GET {baseUrl}/theming/themes/{themeId}  ->
//   { globalTheme: { customColors: [ {id, color}, ... ], interfaceColor },
//     desktopTheme: { components: { navigation: { accentColor }, ... } } }
//
// A color field (e.g. navigation.accentColor) may hold either a literal hex
// ("#FF6720") OR an *id* referencing one of globalTheme.customColors
// ("legacy-text-color"), so references are resolved against the customColors map.

export type ThemeColors = { primary?: string; accent?: string };

/** Which background the chosen colors have to survive on. A widget rendering on
 *  a dark surface needs the opposite treatment from a white card: brand colors
 *  get *lightened* toward legibility instead of darkened. */
export type ThemeSurface = "light" | "dark";

/** The surface the widget paints in dark mode. Contrast for dark-mode colors is
 *  measured against this, so "readable" means readable on the actual card. */
export const DARK_SURFACE = "#15161a";
export const LIGHT_SURFACE = "#ffffff";

export const isHex = (s: string): boolean => /^#[0-9a-fA-F]{3,8}$/.test(s);

// Pure white/black are useless as an accent (invisible on light UIs / harsh),
// so they count as "no usable accent" and we fall through to the next candidate.
const isNeutralExtreme = (s: string): boolean => {
  const x = s.replace("#", "").toLowerCase();
  return x === "ffffff" || x === "fff" || x === "000000" || x === "000";
};

// ── Color math ────────────────────────────────────────────────────────────────

/** Expand #abc to #aabbcc and normalize to a 6-digit hex body. */
function hexBody(hex: string): string {
  let x = hex.replace("#", "");
  if (x.length === 3) x = x[0] + x[0] + x[1] + x[1] + x[2] + x[2];
  return (x + "000000").slice(0, 6);
}

export function hexToRgb(hex: string): string {
  const h = hexBody(hex);
  return `${parseInt(h.slice(0, 2), 16) || 0},${parseInt(h.slice(2, 4), 16) || 0},${parseInt(h.slice(4, 6), 16) || 0}`;
}

function relLuminance(hex: string): number {
  const h = hexBody(hex);
  const r = parseInt(h.slice(0, 2), 16) / 255,
    g = parseInt(h.slice(2, 4), 16) / 255,
    b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colors. */
export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a),
    lb = relLuminance(b);
  const hi = Math.max(la, lb),
    lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const contrastOnWhite = (hex: string): number => contrastRatio(hex, LIGHT_SURFACE);
const contrastOnDark = (hex: string): number => contrastRatio(hex, DARK_SURFACE);

/** Readable text color to place ON TOP of the given background. Leans toward
 *  white: only genuinely light backgrounds get dark text, so mid-tone saturated
 *  brand colors read as white rather than harsh black. */
export function contrastColor(hex: string): string {
  return relLuminance(hex) > 0.45 ? "#1a1a1a" : "#ffffff";
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const x = hexBody(hex);
  const r = parseInt(x.slice(0, 2), 16) / 255,
    g = parseInt(x.slice(2, 4), 16) / 255,
    b = parseInt(x.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  const l = (mx + mn) / 2;
  let s = 0,
    h = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Darken a color (keeping hue/saturation) until it reads on a white surface. */
export function darkenToContrast(hex: string, target = 4.5): string {
  const { h, s } = hexToHsl(hex);
  let { l } = hexToHsl(hex);
  let out = hex;
  for (let i = 0; i < 50 && contrastOnWhite(out) < target && l > 0.04; i++) {
    l = Math.max(0, l - 0.02);
    out = hslToHex(h, s, l);
  }
  return out;
}

/** Lighten a color (keeping hue/saturation) until it reads on the dark surface. */
export function lightenToContrast(hex: string, target = 4.5): string {
  const { h, s } = hexToHsl(hex);
  let { l } = hexToHsl(hex);
  let out = hex;
  for (let i = 0; i < 60 && contrastOnDark(out) < target && l < 0.96; i++) {
    l = Math.min(1, l + 0.02);
    out = hslToHex(h, s, l);
  }
  return out;
}

/**
 * Make a color legible on the widget's current surface, but only if it needs it.
 *
 * A manually picked brand color is the editor's deliberate choice, so it's left
 * exactly as-is when it already clears the contrast target. It's only nudged
 * when it would otherwise disappear — e.g. a dark navy primary on a dark card.
 */
export function readableOn(hex: string, surface: ThemeSurface, target = 4.5): string {
  if (!isHex(hex)) return hex;
  if (surface === "dark") {
    return contrastOnDark(hex) >= target ? hex : lightenToContrast(hex, target);
  }
  return contrastOnWhite(hex) >= target ? hex : darkenToContrast(hex, target);
}

/**
 * Lift a fill off a dark surface without neon-ing it.
 *
 * Lightening in HSL holds saturation, which turns a deep navy into electric
 * blue long before it separates from a near-black card. Mixing toward white
 * instead raises lightness and drops saturation together, so the brand color
 * stays recognisably itself — just enough above the surface to read as a bar.
 */
export function elevateOn(hex: string, surface: ThemeSurface, target = 1.4): string {
  if (surface !== "dark" || !isHex(hex)) return hex;
  let out = hex;
  for (let mix = 0.04; mix <= 0.4 && contrastOnDark(out) < target; mix += 0.04) {
    out = mixWithWhite(hex, mix);
  }
  return out;
}

/** Blend a color toward white by `amount` (0-1) in RGB space. */
function mixWithWhite(hex: string, amount: number): string {
  const h = hexBody(hex);
  const ch = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) || 0;
    return Math.round(v + (255 - v) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

// From a palette, pick the color to use ON A DARK SURFACE: the most saturated
// color, lightened only as far as legibility demands so the brand hue survives.
function pickOnDark(cands: string[]): string {
  const scored = cands.filter(isHex).map(hex => ({ hex, ...hexToHsl(hex), contrast: contrastOnDark(hex) }));
  let pool = scored.filter(c => c.s >= 0.35 && c.l >= 0.15 && c.l <= 0.92);
  if (!pool.length) pool = scored.filter(c => c.s >= 0.2);
  if (!pool.length) return "";
  pool.sort((a, b) => b.s - a.s || b.contrast - a.contrast);
  return lightenToContrast(pool[0].hex, 4.5);
}

// From a palette, pick the color to use ON WHITE: the darkest one that's still
// clearly saturated, then darken further if it's still too light to read.
function pickOnWhite(cands: string[]): string {
  const scored = cands.filter(isHex).map(hex => ({ hex, ...hexToHsl(hex), contrast: contrastOnWhite(hex) }));
  let pool = scored.filter(c => c.s >= 0.35 && c.l >= 0.12 && c.l <= 0.85);
  if (!pool.length) pool = scored.filter(c => c.s >= 0.2 && c.l <= 0.9);
  if (!pool.length) return "";
  pool.sort((a, b) => b.contrast - a.contrast || b.s - a.s);
  return darkenToContrast(pool[0].hex, 4.5);
}

// Most vivid color in the palette (used where it sits on a colored background,
// so light/bright is fine). Avoids matching `exclude`.
function pickVivid(cands: string[], exclude = ""): string {
  const pool = cands
    .filter(isHex)
    .map(hex => ({ hex, ...hexToHsl(hex) }))
    .filter(c => c.s >= 0.3 && c.l >= 0.15 && c.l <= 0.92)
    .sort((a, b) => b.s - a.s);
  if (!pool.length) return "";
  return (pool.find(c => c.hex.toLowerCase() !== exclude.toLowerCase()) || pool[0]).hex;
}

/** Only the fields this widget reads; the endpoint returns a great deal more. */
interface ThemeResponse {
  globalTheme?: {
    customColors?: Array<{ id?: string; color?: string }>;
    interfaceColor?: string;
  };
  desktopTheme?: {
    components?: {
      navigation?: { accentColor?: string };
    };
  };
}

export async function fetchThemeColors(
  baseUrl: string,
  apiToken: string,
  themeId = "primary",
  surface: ThemeSurface = "light"
): Promise<ThemeColors> {
  if (!baseUrl || !apiToken) return {};
  try {
    const res = await fetch(`${baseUrl}/theming/themes/${themeId}`, {
      // Omit the session cookie so the request is authenticated purely by the
      // Basic API token (the service identity). Otherwise, when the viewer is
      // logged in as another user (e.g. via the login-as widget), the cookie is
      // sent and the theming endpoint is evaluated as that user — who may lack
      // theme access — so it returns nothing and brand colors silently fail.
      credentials: "omit",
      headers: { Authorization: `Basic ${apiToken}`, Accept: "application/json" },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as ThemeResponse;

    // Build id -> hex map from customColors.
    const customs: Record<string, string> = {};
    for (const c of data?.globalTheme?.customColors || []) {
      if (c && c.id && c.color) customs[c.id] = c.color;
    }
    // Resolve a value that's either a hex or a customColors id reference.
    const resolve = (v?: string): string => {
      if (!v) return "";
      if (v[0] === "#") return v;
      return customs[v] || "";
    };

    // Gather every color the theme exposes (skipping pure white/black), then
    // choose deliberately: a configured brand color can be far too light (e.g.
    // #F7DDED) to read on the card, so primary-brand-color is never just trusted.
    const palette = [
      ...Object.values(customs),
      typeof data?.globalTheme?.interfaceColor === "string" ? data.globalTheme.interfaceColor : "",
      resolve(data?.desktopTheme?.components?.navigation?.accentColor),
    ].filter(c => isHex(c) && !isNeutralExtreme(c));

    let primary = surface === "dark" ? pickOnDark(palette) : pickOnWhite(palette);
    if (!primary) {
      primary =
        resolve("primary-brand-color") ||
        customs["legacy-background-color"] ||
        (typeof data?.globalTheme?.interfaceColor === "string" ? data.globalTheme.interfaceColor : "");
      if (isHex(primary)) {
        primary = surface === "dark" ? lightenToContrast(primary, 4.5) : darkenToContrast(primary, 4.5);
      }
    }

    // Accent: most vivid palette color, else nav accent, else fall back to primary.
    let accent =
      pickVivid(palette, primary) || resolve(data?.desktopTheme?.components?.navigation?.accentColor) || String(primary);
    // On a dark surface the accent is a real text/graphic color too, not just a
    // pill fill, so it has to clear contrast the same way primary does.
    if (surface === "dark" && isHex(String(accent))) accent = lightenToContrast(String(accent), 3);

    return {
      primary: isHex(String(primary)) ? String(primary) : undefined,
      accent: isHex(String(accent)) ? String(accent) : undefined,
    };
  } catch {
    return {};
  }
}
