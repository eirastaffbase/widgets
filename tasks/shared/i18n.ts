// ─────────────────────────────────────────────────────────────────────────────
// Shared i18n engine for the Staffbase task widgets.
//
// Imported by each widget via a relative path (e.g. `../shared/i18n`). webpack
// inlines it into each bundle — there is no runtime/package dependency.
//
// Design rules:
//  - Dependency-free, ES2015-compatible (matches each widget's tsconfig target).
//  - DOM/browser globals are accessed defensively (guarded) so the module is
//    safe to load in any widget context.
//  - The default/source locale is always `en_US`. For `en_US` (or any unmatched
//    locale) the helpers resolve to the exact source strings — so a widget that
//    only ships an `en_US` bundle behaves identically to having no i18n at all.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_LOCALE = "en_US";

// Language prefixes that render right-to-left (from the Staffbase locale table:
// every entry flagged `direction: right_to_left`).
const RTL_LANGS = ["ar", "fa", "he", "ur", "ps"];

/** Split a raw locale string into a normalized `{ lang, region }`. */
function parts(raw: string): { lang: string; region: string } {
  // Accept `en-US`, `en_US`, `EN`, `zh-hk`, etc.
  const cleaned = (raw || "").trim().replace(/-/g, "_");
  const seg = cleaned.split("_");
  const lang = (seg[0] || "").toLowerCase();
  const region = (seg[1] || "").toUpperCase();
  return { lang, region };
}

/** Normalize any locale string to canonical `lang_REGION` (or just `lang`). */
export function normalizeLocale(raw: string): string {
  const { lang, region } = parts(raw);
  if (!lang) return "";
  return region ? lang + "_" + region : lang;
}

/**
 * Resolve a requested locale against the set of bundles we actually ship.
 * Match order: exact → same-language → DEFAULT_LOCALE.
 *
 *   resolveLocale("es_MX", ["en_US","es_ES"]) -> "es_ES"
 *   resolveLocale("de-DE", ["en_US","de_DE"]) -> "de_DE"
 *   resolveLocale("pt_PT", ["en_US","de_DE"]) -> "en_US"
 */
export function resolveLocale(raw: string, available: string[]): string {
  const norm = normalizeLocale(raw);
  if (!norm) return DEFAULT_LOCALE;
  // Exact (compare normalized on both sides so casing/dashes don't matter).
  for (const a of available) {
    if (normalizeLocale(a) === norm) return a;
  }
  // Same language, any region.
  const lang = parts(norm).lang;
  for (const a of available) {
    if (parts(a).lang === lang) return a;
  }
  return DEFAULT_LOCALE;
}

/** True when the locale's language renders right-to-left. */
export function isRtl(locale: string): boolean {
  return RTL_LANGS.indexOf(parts(locale).lang) !== -1;
}

/**
 * Pick the best locale for the current viewer.
 * Priority: explicit `configLocale` (authoritative Staffbase user locale) →
 * `navigator.language` (browser fallback) → DEFAULT_LOCALE.
 *
 * `configLocale` is read by the widget from `GET /api/users/{id}` → config.locale
 * (the only field that reflects the user's Staffbase language). It is passed in
 * rather than fetched here so this module stays free of auth/transport concerns.
 */
export function detectLocale(opts: {
  configLocale?: string | null;
  available: string[];
}): string {
  const navLang =
    typeof navigator !== "undefined"
      ? (navigator as any).language || ""
      : "";
  const candidates = [opts.configLocale || "", navLang];
  for (const c of candidates) {
    if (!c) continue;
    const r = resolveLocale(c, opts.available);
    // resolveLocale returns DEFAULT when nothing matched; only accept a
    // candidate if it actually produced a non-default match OR the default is
    // genuinely the best (its own language).
    if (r !== DEFAULT_LOCALE || parts(c).lang === parts(DEFAULT_LOCALE).lang) {
      return r;
    }
  }
  return resolveLocale(DEFAULT_LOCALE, opts.available);
}

export type Bundle = { [key: string]: string };
export type Bundles = { [locale: string]: Bundle };

/**
 * Build a translation function bound to `locale`.
 * Lookup order per key: requested locale → DEFAULT_LOCALE → the key itself.
 * Missing translations therefore degrade to English, never to blank/broken UI.
 *
 *   const t = makeT(STRINGS, "de_DE");
 *   t("refresh") // German if present, else English, else "refresh"
 */
export function makeT(bundles: Bundles, locale: string): (key: string) => string {
  const primary = bundles[locale] || {};
  const fallback = bundles[DEFAULT_LOCALE] || {};
  return function t(key: string): string {
    if (primary[key] != null) return primary[key];
    if (fallback[key] != null) return fallback[key];
    return key;
  };
}
