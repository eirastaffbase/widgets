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

export type ThemeColors = { primary?: string; accent?: string };

const isHex = (s: string): boolean => /^#[0-9a-fA-F]{3,8}$/.test(s);

// Pure white/black are useless as an accent (invisible on light UIs / harsh),
// so we treat them as "no usable accent" and fall through to the next candidate.
const isNeutralExtreme = (s: string): boolean => {
  const x = s.replace("#", "").toLowerCase();
  return x === "ffffff" || x === "fff" || x === "000000" || x === "000";
};

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

    // Primary: the brand color, falling back to legacy bg / interface color.
    let primary =
      resolve("primary-brand-color") ||
      customs["legacy-background-color"] ||
      (typeof data?.globalTheme?.interfaceColor === "string" ? data.globalTheme.interfaceColor : "");

    // Accent: nav accent, then secondary brand, then primary — skipping any
    // unresolved / pure-white-or-black value (which wouldn't read as an accent).
    let accent = resolve(data?.desktopTheme?.components?.navigation?.accentColor);
    if (!isHex(accent) || isNeutralExtreme(accent) || accent.toLowerCase() === String(primary).toLowerCase()) {
      accent = resolve("secondary-brand-color");
    }
    if (!isHex(accent) || isNeutralExtreme(accent)) accent = String(primary);

    return {
      primary: isHex(String(primary)) ? String(primary) : undefined,
      accent: isHex(String(accent)) ? String(accent) : undefined,
    };
  } catch {
    return {};
  }
}
