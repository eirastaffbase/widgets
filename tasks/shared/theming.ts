// Shared theming helper — pulls brand colors from the Staffbase theming API.
//
// Used by the "Use Theme Colors" config option across the task widgets. We fetch
// with the same Basic-auth API token the widgets already use, and explicitly omit
// the session cookie (credentials:"omit") so the request always resolves as the
// token's service identity — never the viewing user, who may be a different,
// theme-less account when impersonating via the login-as widget.
//
// GET {baseUrl}/theming/themes/{themeId}  ->
//   { globalTheme: { customColors: [ {id, color}, ... ], interfaceColor },
//     desktopTheme: { components: { navigation: { accentColor }, ... } } }
//
// Note: a color field (e.g. navigation.accentColor) may hold either a literal
// hex ("#FF6720") OR an *id* that references one of globalTheme.customColors
// ("legacy-text-color"), so we resolve references against the customColors map.
//
// Color choice: a configured brand color can be too light to read on the white
// widget background (widgets use primary for text/icons/borders), so we gather the
// whole palette and choose intelligently:
//   - primary = darkest still-saturated color, darkened further if needed to clear
//               a ~4.5:1 contrast ratio on white
//   - accent  = most vivid color (only used in gradients, on colored backgrounds)

export type ThemeColors = { primary?: string; accent?: string };

const isHex = (s: string): boolean => /^#[0-9a-fA-F]{3,8}$/.test(s);

// Pure white/black are useless as an accent (invisible on light UIs / harsh),
// so we treat them as "no usable accent" and fall through to the next candidate.
const isNeutralExtreme = (s: string): boolean => {
  const x = s.replace("#", "").toLowerCase();
  return x === "ffffff" || x === "fff" || x === "000000" || x === "000";
};

// ── Color math (used to pick readable colors off the theme palette) ────────────
function relLuminance(hex: string): number {
  const h = (hex.replace("#", "") + "000000").slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Contrast ratio of a color against white (the widget's background).
function contrastOnWhite(hex: string): number {
  return 1.05 / (relLuminance(hex) + 0.05);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const x = (hex.replace("#", "") + "000000").slice(0, 6);
  const r = parseInt(x.slice(0, 2), 16) / 255, g = parseInt(x.slice(2, 4), 16) / 255, b = parseInt(x.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const l = (mx + mn) / 2;
  let s = 0, h = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Darken a color (keep hue/saturation) until it reads on a white background.
function darkenToContrast(hex: string, target = 4.5): string {
  let { h, s, l } = hexToHsl(hex);
  let out = hex;
  for (let i = 0; i < 50 && contrastOnWhite(out) < target && l > 0.04; i++) {
    l = Math.max(0, l - 0.02);
    out = hslToHex(h, s, l);
  }
  return out;
}

// From a palette, pick the color to use ON WHITE (names, active states, borders):
// the darkest one that's still clearly saturated, then darken further if it's
// still too light to read. Returns "" if nothing usable (caller falls back).
function pickOnWhite(cands: string[]): string {
  const scored = cands.filter(isHex).map(hex => ({ hex, ...hexToHsl(hex), contrast: contrastOnWhite(hex) }));
  // Saturated, not near-white / near-black / gray.
  let pool = scored.filter(c => c.s >= 0.35 && c.l >= 0.12 && c.l <= 0.85);
  if (!pool.length) pool = scored.filter(c => c.s >= 0.2 && c.l <= 0.9);
  if (!pool.length) return "";
  // Darkest first (highest contrast on white); tie-break toward more saturated.
  pool.sort((a, b) => (b.contrast - a.contrast) || (b.s - a.s));
  return darkenToContrast(pool[0].hex, 4.5);
}

// Most vivid color in the palette (used for gradient accents, where it sits on a
// colored background so light/bright is fine). Avoids matching `exclude`.
function pickVivid(cands: string[], exclude = ""): string {
  const pool = cands.filter(isHex).map(hex => ({ hex, ...hexToHsl(hex) }))
    .filter(c => c.s >= 0.3 && c.l >= 0.15 && c.l <= 0.92)
    .sort((a, b) => b.s - a.s);
  if (!pool.length) return "";
  return (pool.find(c => c.hex.toLowerCase() !== exclude.toLowerCase()) || pool[0]).hex;
}

export async function fetchThemeColors(
  baseUrl: string,
  apiToken: string,
  themeId = "primary"
): Promise<ThemeColors> {
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
    const data: any = await res.json();

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

    // Gather every color the theme exposes (skip pure white/black), then choose:
    //  - primary = darkest still-saturated color (it sits on the white widget bg)
    //  - accent  = most vivid color (only used in gradients, on colored bg)
    // A configured brand color can be too light (e.g. #F7DDED) to read on white,
    // so we never just trust primary-brand-color for on-white text.
    const palette = [
      ...Object.values(customs),
      typeof data?.globalTheme?.interfaceColor === "string" ? data.globalTheme.interfaceColor : "",
      resolve(data?.desktopTheme?.components?.navigation?.accentColor),
    ].filter(c => isHex(c) && !isNeutralExtreme(c));

    // Primary: best on-white color from the palette; fall back to the older
    // brand-color resolution (darkened for contrast) if nothing was saturated.
    let primary = pickOnWhite(palette);
    if (!primary) {
      primary =
        resolve("primary-brand-color") ||
        customs["legacy-background-color"] ||
        (typeof data?.globalTheme?.interfaceColor === "string" ? data.globalTheme.interfaceColor : "");
      if (isHex(primary)) primary = darkenToContrast(primary, 4.5);
    }
    // Accent: most vivid palette color, else nav accent, else fall back to primary.
    let accent =
      pickVivid(palette, primary) ||
      resolve(data?.desktopTheme?.components?.navigation?.accentColor) ||
      String(primary);

    return {
      primary: isHex(String(primary)) ? String(primary) : undefined,
      accent: isHex(String(accent)) ? String(accent) : undefined,
    };
  } catch {
    return {};
  }
}
