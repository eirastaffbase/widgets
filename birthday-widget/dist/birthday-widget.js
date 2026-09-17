/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ../tasks/shared/i18n.ts
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
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const DEFAULT_LOCALE = "en_US";
// Language prefixes that render right-to-left (from the Staffbase locale table:
// every entry flagged `direction: right_to_left`).
const RTL_LANGS = ["ar", "fa", "he", "ur", "ps"];
/** Split a raw locale string into a normalized `{ lang, region }`. */
function parts(raw) {
    // Accept `en-US`, `en_US`, `EN`, `zh-hk`, etc.
    const cleaned = (raw || "").trim().replace(/-/g, "_");
    const seg = cleaned.split("_");
    const lang = (seg[0] || "").toLowerCase();
    const region = (seg[1] || "").toUpperCase();
    return { lang, region };
}
/** Normalize any locale string to canonical `lang_REGION` (or just `lang`). */
function normalizeLocale(raw) {
    const { lang, region } = parts(raw);
    if (!lang)
        return "";
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
function resolveLocale(raw, available) {
    const norm = normalizeLocale(raw);
    if (!norm)
        return DEFAULT_LOCALE;
    // Exact (compare normalized on both sides so casing/dashes don't matter).
    for (const a of available) {
        if (normalizeLocale(a) === norm)
            return a;
    }
    // Same language, any region.
    const lang = parts(norm).lang;
    for (const a of available) {
        if (parts(a).lang === lang)
            return a;
    }
    return DEFAULT_LOCALE;
}
/** True when the locale's language renders right-to-left. */
function isRtl(locale) {
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
function detectLocale(opts) {
    const navLang = typeof navigator !== "undefined"
        ? navigator.language || ""
        : "";
    const candidates = [opts.configLocale || "", navLang];
    for (const c of candidates) {
        if (!c)
            continue;
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
/**
 * Build a translation function bound to `locale`.
 * Lookup order per key: requested locale → DEFAULT_LOCALE → the key itself.
 * Missing translations therefore degrade to English, never to blank/broken UI.
 *
 *   const t = makeT(STRINGS, "de_DE");
 *   t("refresh") // German if present, else English, else "refresh"
 */
// ─────────────────────────────────────────────────────────────────────────────
// On-demand content translation (Phase B "Translate" button).
//
// Free-text user content (task titles, descriptions, custom type names,
// comments) is translated on demand via Staffbase's POST /api/translations.
// Items are batched into one request as indexed <p> tags — the endpoint
// preserves tags and translates only text nodes, so we map results back by
// index. Transport/auth is supplied by the caller via `send` so this module
// stays free of endpoint/auth concerns.
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function unescHtml(s) {
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
/**
 * Translate a set of strings in a single batched request.
 * Returns a map of original-text → translated-text (only for non-empty inputs).
 * On any failure the map is empty (caller falls back to originals).
 *
 * `send(payload)` must POST the payload to /api/translations and resolve with
 * the translated `contents.value` string.
 */
function translateMap(texts, send) {
    return __awaiter(this, void 0, void 0, function* () {
        const map = {};
        const uniq = [];
        const seen = {};
        for (const raw of texts) {
            const t = (raw || "").trim();
            if (t && !seen[t]) {
                seen[t] = true;
                uniq.push(t);
            }
        }
        if (!uniq.length)
            return map;
        const payload = uniq.map((t, i) => `<p data-i="${i}">${escHtml(t)}</p>`).join("");
        let resp;
        try {
            resp = yield send(payload);
        }
        catch (_) {
            return map;
        }
        const re = /<p data-i="(\d+)">([\s\S]*?)<\/p>/g;
        let m;
        while ((m = re.exec(resp))) {
            const i = parseInt(m[1], 10);
            if (uniq[i] != null)
                map[uniq[i]] = unescHtml(m[2]);
        }
        return map;
    });
}
function makeT(bundles, locale) {
    const primary = bundles[locale] || {};
    const fallback = bundles[DEFAULT_LOCALE] || {};
    return function t(key) {
        if (primary[key] != null)
            return primary[key];
        if (fallback[key] != null)
            return fallback[key];
        return key;
    };
}

;// ../tasks/shared/theming.ts
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
var theming_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
// Pure white/black are useless as an accent (invisible on light UIs / harsh),
// so we treat them as "no usable accent" and fall through to the next candidate.
const isNeutralExtreme = (s) => {
    const x = s.replace("#", "").toLowerCase();
    return x === "ffffff" || x === "fff" || x === "000000" || x === "000";
};
// ── Color math (used to pick readable colors off the theme palette) ────────────
function relLuminance(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
// Contrast ratio of a color against white (the widget's background).
function contrastOnWhite(hex) {
    return 1.05 / (relLuminance(hex) + 0.05);
}
// Contrast ratio against the near-black stage the leaderboard renders on.
function contrastOnDark(hex) {
    return (relLuminance(hex) + 0.05) / (relLuminance("#0b0d12") + 0.05);
}
function hexToHsl(hex) {
    const x = (hex.replace("#", "") + "000000").slice(0, 6);
    const r = parseInt(x.slice(0, 2), 16) / 255, g = parseInt(x.slice(2, 4), 16) / 255, b = parseInt(x.slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2;
    let s = 0, h = 0;
    if (d) {
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        if (mx === r)
            h = ((g - b) / d) % 6;
        else if (mx === g)
            h = (b - r) / d + 2;
        else
            h = (r - g) / d + 4;
        h *= 60;
        if (h < 0)
            h += 360;
    }
    return { h, s, l };
}
function hslToHex(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60)
        [r, g, b] = [c, x, 0];
    else if (h < 120)
        [r, g, b] = [x, c, 0];
    else if (h < 180)
        [r, g, b] = [0, c, x];
    else if (h < 240)
        [r, g, b] = [0, x, c];
    else if (h < 300)
        [r, g, b] = [x, 0, c];
    else
        [r, g, b] = [c, 0, x];
    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return `#${to(r)}${to(g)}${to(b)}`;
}
// Darken a color (keep hue/saturation) until it reads on a white background.
function darkenToContrast(hex, target = 4.5) {
    let { h, s, l } = hexToHsl(hex);
    let out = hex;
    for (let i = 0; i < 50 && contrastOnWhite(out) < target && l > 0.04; i++) {
        l = Math.max(0, l - 0.02);
        out = hslToHex(h, s, l);
    }
    return out;
}
// Lighten a color (keep hue/saturation) until it reads on the dark stage.
function lightenToContrast(hex, target = 4.5) {
    let { h, s, l } = hexToHsl(hex);
    let out = hex;
    for (let i = 0; i < 60 && contrastOnDark(out) < target && l < 0.96; i++) {
        l = Math.min(1, l + 0.02);
        out = hslToHex(h, s, l);
    }
    return out;
}
// From a palette, pick the color to use ON A DARK STAGE (headlines, bars, glow):
// the most saturated color, lightened only as far as legibility demands so the
// brand hue survives. Returns "" if nothing usable.
function pickOnDark(cands) {
    const scored = cands.filter(isHex).map(hex => (Object.assign(Object.assign({ hex }, hexToHsl(hex)), { contrast: contrastOnDark(hex) })));
    let pool = scored.filter(c => c.s >= 0.35 && c.l >= 0.15 && c.l <= 0.92);
    if (!pool.length)
        pool = scored.filter(c => c.s >= 0.2);
    if (!pool.length)
        return "";
    // Most saturated first, then whichever already reads best on dark.
    pool.sort((a, b) => (b.s - a.s) || (b.contrast - a.contrast));
    return lightenToContrast(pool[0].hex, 4.5);
}
// From a palette, pick the color to use ON WHITE (names, active states, borders):
// the darkest one that's still clearly saturated, then darken further if it's
// still too light to read. Returns "" if nothing usable (caller falls back).
function pickOnWhite(cands) {
    const scored = cands.filter(isHex).map(hex => (Object.assign(Object.assign({ hex }, hexToHsl(hex)), { contrast: contrastOnWhite(hex) })));
    // Saturated, not near-white / near-black / gray.
    let pool = scored.filter(c => c.s >= 0.35 && c.l >= 0.12 && c.l <= 0.85);
    if (!pool.length)
        pool = scored.filter(c => c.s >= 0.2 && c.l <= 0.9);
    if (!pool.length)
        return "";
    // Darkest first (highest contrast on white); tie-break toward more saturated.
    pool.sort((a, b) => (b.contrast - a.contrast) || (b.s - a.s));
    return darkenToContrast(pool[0].hex, 4.5);
}
// Most vivid color in the palette (used for gradient accents, where it sits on a
// colored background so light/bright is fine). Avoids matching `exclude`.
function pickVivid(cands, exclude = "") {
    const pool = cands.filter(isHex).map(hex => (Object.assign({ hex }, hexToHsl(hex))))
        .filter(c => c.s >= 0.3 && c.l >= 0.15 && c.l <= 0.92)
        .sort((a, b) => b.s - a.s);
    if (!pool.length)
        return "";
    return (pool.find(c => c.hex.toLowerCase() !== exclude.toLowerCase()) || pool[0]).hex;
}
function fetchThemeColors(baseUrl_1, apiToken_1) {
    return theming_awaiter(this, arguments, void 0, function* (baseUrl, apiToken, themeId = "primary", surface = "light") {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        try {
            const res = yield fetch(`${baseUrl}/theming/themes/${themeId}`, {
                // Omit the session cookie so the request is authenticated purely by the
                // Basic API token (the service identity). Otherwise, when the viewer is
                // logged in as another user (e.g. via the login-as widget), the cookie is
                // sent and the theming endpoint is evaluated as that user — who may lack
                // theme access — so it returns nothing and brand colors silently fail.
                credentials: "omit",
                headers: { Authorization: `Basic ${apiToken}`, Accept: "application/json" },
            });
            if (!res.ok)
                return {};
            const data = yield res.json();
            // Build id -> hex map from customColors.
            const customs = {};
            for (const c of ((_a = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _a === void 0 ? void 0 : _a.customColors) || []) {
                if (c && c.id && c.color)
                    customs[c.id] = c.color;
            }
            // Resolve a value that's either a hex or a customColors id reference.
            const resolve = (v) => {
                if (!v)
                    return "";
                if (v[0] === "#")
                    return v;
                return customs[v] || "";
            };
            // Gather every color the theme exposes (skip pure white/black), then choose:
            //  - primary = darkest still-saturated color (it sits on the white widget bg)
            //  - accent  = most vivid color (only used in gradients, on colored bg)
            // A configured brand color can be too light (e.g. #F7DDED) to read on white,
            // so we never just trust primary-brand-color for on-white text.
            const palette = [
                ...Object.values(customs),
                typeof ((_b = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _b === void 0 ? void 0 : _b.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "",
                resolve((_e = (_d = (_c = data === null || data === void 0 ? void 0 : data.desktopTheme) === null || _c === void 0 ? void 0 : _c.components) === null || _d === void 0 ? void 0 : _d.navigation) === null || _e === void 0 ? void 0 : _e.accentColor),
            ].filter(c => isHex(c) && !isNeutralExtreme(c));
            // Primary: best on-white color from the palette; fall back to the older
            // brand-color resolution (darkened for contrast) if nothing was saturated.
            let primary = surface === "dark" ? pickOnDark(palette) : pickOnWhite(palette);
            if (!primary) {
                primary =
                    resolve("primary-brand-color") ||
                        customs["legacy-background-color"] ||
                        (typeof ((_f = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _f === void 0 ? void 0 : _f.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "");
                if (isHex(primary)) {
                    primary = surface === "dark" ? lightenToContrast(primary, 4.5) : darkenToContrast(primary, 4.5);
                }
            }
            // Accent: most vivid palette color, else nav accent, else fall back to primary.
            let accent = pickVivid(palette, primary) ||
                resolve((_j = (_h = (_g = data === null || data === void 0 ? void 0 : data.desktopTheme) === null || _g === void 0 ? void 0 : _g.components) === null || _h === void 0 ? void 0 : _h.navigation) === null || _j === void 0 ? void 0 : _j.accentColor) ||
                String(primary);
            // On the dark stage the accent is a real text/graphic color too, not just a
            // gradient stop, so it has to clear contrast the same way primary does.
            if (surface === "dark" && isHex(String(accent)))
                accent = lightenToContrast(String(accent), 3);
            return {
                primary: isHex(String(primary)) ? String(primary) : undefined,
                accent: isHex(String(accent)) ? String(accent) : undefined,
            };
        }
        catch (_k) {
            return {};
        }
    });
}
/**
 * A categorical ramp anchored to the tenant's own brand.
 *
 * Categorical palettes are usually picked off the shelf, which drops saturated
 * web-safe hues (#0EA5E9, #EF4444) onto a brand-tinted surface and makes the
 * chart read as a foreign object. This walks the hue wheel from the primary
 * instead, holding saturation and lightness at the values that survive the
 * given surface, so every slice is distinguishable *and* clearly related.
 */
function reactionRamp(primary, surface, n = 6) {
    const { h, s, l } = hexToHsl(primary);
    // hexToHsl/hslToHex work in 0-1 fractions, not percentages. Passing 0-100
    // here silently produces malformed hex, which paints nothing at all.
    const sat = Math.min(0.85, Math.max(0.52, s));
    const lit = surface === "dark"
        ? Math.min(0.68, Math.max(0.52, l))
        : Math.min(0.50, Math.max(0.38, l));
    const out = [];
    for (let i = 0; i < n; i++) {
        // 47 degrees is coprime enough with 360 to avoid repeats over a short ramp
        // while keeping neighbouring slices clearly apart.
        const hue = (h + i * 47) % 360;
        // Alternate a small lightness step so adjacent slices differ even for
        // viewers who cannot separate the hues.
        const step = i % 2 === 0 ? 0 : (surface === "dark" ? 0.10 : -0.08);
        out.push(hslToHex(hue, sat, Math.min(0.78, Math.max(0.30, lit + step))));
    }
    return out;
}

;// ./strings.ts
const AVAILABLE_LOCALES = ["en_US", "es_MX"];
const BUNDLES = {
    en_US: {
        "widget.title": "Upcoming Birthdays",
        "state.empty": "Add names in the widget settings to get started.",
        "countdown.today": "Today!",
        "countdown.tomorrow": "Tomorrow",
        "countdown.days": "In {n} days",
    },
    es_MX: {
        "widget.title": "Próximos cumpleaños",
        "state.empty": "Agrega nombres en la configuración del widget para comenzar.",
        "countdown.today": "¡Hoy!",
        "countdown.tomorrow": "Mañana",
        "countdown.days": "En {n} días",
    },
};

;// ./birthday-widget.ts
var birthday_widget_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};



const P = "sbbd";
const DEFAULT_PRIMARY = "#3DDC97";
const DEFAULT_ACCENT = "#7C5CFF";
// ── Config schema ─────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token", default: "" },
        baseurl: { type: "string", title: "Base URL (e.g. https://acme.staffbase.com/api)", default: "" },
        people: { type: "string", title: "People — one per line: Name, +N days", default: "" },
        widgettitle: { type: "string", title: "Widget Title (optional override)", default: "" },
        usethemecolors: { type: "boolean", title: "Use Theme Colors", default: true },
    },
    dependencies: {
        usethemecolors: {
            oneOf: [
                {
                    properties: {
                        usethemecolors: { const: false },
                        primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY },
                        accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT },
                    },
                },
                { properties: { usethemecolors: { const: true } } },
            ],
        },
    },
};
const uiSchema = {
    apitoken: { "ui:help": "Used only to load brand colors from the theming endpoint." },
    baseurl: { "ui:help": "Must include /api, e.g. https://acme.staffbase.com/api" },
    people: { "ui:widget": "textarea", "ui:help": "One person per line. Format: Name, +N (N = days from today when their birthday is)" },
};
// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function initials(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length)
        return "?";
    return ((words[0][0] || "") + (words.length > 1 ? words[words.length - 1][0] || "" : "")).toUpperCase();
}
function hexToRgb(hex) {
    const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
    return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}
function readableOn(hex) {
    const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const l = 0.2126 * lin(parseInt(h.slice(0, 2), 16) / 255)
        + 0.7152 * lin(parseInt(h.slice(2, 4), 16) / 255)
        + 0.0722 * lin(parseInt(h.slice(4, 6), 16) / 255);
    return l > 0.45 ? "#111827" : "#FFFFFF";
}
function parsePeople(raw) {
    return raw.split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
        const m = line.match(/^(.+?),\s*\+?(\d+)\s*$/);
        if (!m)
            return null;
        const days = parseInt(m[2], 10);
        return isFinite(days) && days >= 0 ? { name: m[1].trim(), daysUntil: days } : null;
    })
        .filter((p) => p !== null);
}
function birthdayDateLabel(daysFromNow, locale) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    try {
        return d.toLocaleDateString(locale.replace("_", "-"), { month: "long", day: "numeric" });
    }
    catch (_) {
        return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
    }
}
function countdownLabel(days, t) {
    if (days === 0)
        return t("countdown.today");
    if (days === 1)
        return t("countdown.tomorrow");
    return t("countdown.days").replace("{n}", String(days));
}
// ── CSS ───────────────────────────────────────────────────────────────────────
const HOST_RESET = `
.${P}-root button{
  width:auto!important;min-width:0!important;margin:0!important;
  background:none!important;border:0!important;box-shadow:none!important;
  color:inherit!important;font-family:inherit!important;line-height:normal!important;
  text-transform:none!important;letter-spacing:inherit!important;outline:none!important;
  padding:0;border-radius:0;cursor:pointer;-webkit-appearance:none;appearance:none;
  display:inline-flex;align-items:center;justify-content:center}
.${P}-root ol,.${P}-root ul{list-style:none!important;margin:0!important;padding:0!important}
.${P}-root li{margin:0!important;padding:0!important;list-style:none!important}
.${P}-root h1,.${P}-root h2,.${P}-root h3,.${P}-root h4,.${P}-root h5,.${P}-root h6,
.${P}-root p,.${P}-root figure{margin:0!important;padding:0!important;font-family:inherit!important}
.${P}-root p{color:inherit!important;font-size:inherit!important;font-weight:inherit!important;
  font-style:normal!important;line-height:inherit!important}
.${P}-root img{max-width:none!important;margin:0!important;border-radius:0}
.${P}-root *,.${P}-root *::before,.${P}-root *::after{box-sizing:border-box}
`;
const CSS = `
${HOST_RESET}

.${P}-root{
  background:#fff;
  border-radius:16px;
  box-shadow:0 2px 12px rgba(0,0,0,.08);
  padding:20px 22px;
  font-family:inherit;
  color:#111827;
  -webkit-font-smoothing:antialiased;
}

.${P}-header{
  display:flex;align-items:center;gap:10px;margin-bottom:18px;
}
.${P}-mark{
  width:4px;height:22px;border-radius:99px;flex:0 0 auto;
  background:var(--sbbd-primary,${DEFAULT_PRIMARY});
}
.${P}-title{
  font-size:16px;font-weight:700;color:#111827;flex:1 1 auto;min-width:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.${P}-count{
  display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;flex:0 0 auto;
  font-size:11.5px;font-weight:600;letter-spacing:.01em;
  background:rgba(var(--sbbd-primary-rgb),.10);color:var(--sbbd-primary,${DEFAULT_PRIMARY});
}

.${P}-list{display:flex;flex-direction:column;gap:8px}

.${P}-card{
  display:flex;align-items:center;gap:14px;padding:14px 16px;
  border:1px solid #e5e7eb;border-radius:12px;background:#fff;
  transition:transform .2s ease,box-shadow .2s ease;
  animation:${P}-rise .45s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(var(--i,0)*60ms);
}
.${P}-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.10)}

.${P}-av{
  width:44px;height:44px;border-radius:50%;flex:0 0 auto;
  display:inline-flex;align-items:center;justify-content:center;
  background:linear-gradient(140deg,var(--sbbd-primary,${DEFAULT_PRIMARY}),var(--sbbd-accent,${DEFAULT_ACCENT}));
  color:var(--sbbd-primary-text,#fff);font-weight:700;font-size:16px;letter-spacing:-.01em;
}
.${P}-av::after{content:attr(data-ini)}

.${P}-info{flex:1 1 auto;min-width:0}
.${P}-root .${P}-name{
  font-size:14px!important;font-weight:700!important;color:#111827!important;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3!important;
}
.${P}-root .${P}-date{
  font-size:12px!important;color:#6b7280!important;margin-top:2px!important;line-height:1.4!important;
}

.${P}-pill{
  flex:0 0 auto;padding:4px 12px;border-radius:99px;
  font-size:12px;font-weight:600;white-space:nowrap;
  background:rgba(var(--sbbd-primary-rgb),.10);
  color:var(--sbbd-primary,${DEFAULT_PRIMARY});
}
.${P}-pill.is-today{
  background:rgba(var(--sbbd-primary-rgb),.18);
  box-shadow:0 0 10px rgba(var(--sbbd-primary-rgb),.25);
}

.${P}-root .${P}-empty{
  text-align:center;padding:36px 16px;
  color:#9ca3af!important;font-size:13px!important;line-height:1.5!important;
}

@keyframes ${P}-rise{
  from{opacity:0;transform:translateY(10px)}
  to{opacity:1;transform:none}
}

@media(max-width:400px){
  .${P}-card{flex-wrap:wrap}
  .${P}-pill{margin-top:4px;margin-left:calc(44px + 14px)}
}

@media(prefers-reduced-motion:reduce){
  .${P}-root *,.${P}-root *::before,.${P}-root *::after{
    animation:none!important;transition:none!important}
}
`;
// ── Factory ───────────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class BirthdayWidget extends BaseBlockClass {
        constructor() { super(); }
        renderBlock(container) {
            return birthday_widget_awaiter(this, void 0, void 0, function* () {
                var _a;
                const attr = (k) => this.getAttribute(k) || "";
                const bool = (k, dflt) => {
                    const v = this.getAttribute(k);
                    return v == null || v === "" ? dflt : v !== "false";
                };
                const apiToken = attr("apitoken");
                const baseUrl = attr("baseurl").replace(/\/+$/, "");
                let primary = attr("primarycolor") || DEFAULT_PRIMARY;
                let accent = attr("accentcolor") || DEFAULT_ACCENT;
                if (bool("usethemecolors", true) && apiToken && baseUrl) {
                    try {
                        const themed = yield fetchThemeColors(baseUrl, apiToken, "primary", "light");
                        if (themed.primary)
                            primary = themed.primary;
                        if (themed.accent)
                            accent = themed.accent;
                    }
                    catch (_) { /* leave defaults */ }
                }
                if (accent.toLowerCase() === primary.toLowerCase())
                    accent = DEFAULT_ACCENT;
                const locale = detectLocale({
                    configLocale: ((_a = widgetApi === null || widgetApi === void 0 ? void 0 : widgetApi.getContentLanguage) === null || _a === void 0 ? void 0 : _a.call(widgetApi)) || null,
                    available: AVAILABLE_LOCALES,
                });
                const t = makeT(BUNDLES, locale);
                const rtl = isRtl(locale);
                const people = parsePeople(attr("people"));
                people.sort((a, b) => a.daysUntil - b.daysUntil);
                const heading = attr("widgettitle") || t("widget.title");
                const cardsHtml = people.length
                    ? `<ul class="${P}-list">${people.map((p, i) => {
                        const dateStr = birthdayDateLabel(p.daysUntil, locale);
                        const countdown = countdownLabel(p.daysUntil, t);
                        const isToday = p.daysUntil === 0;
                        return `<li class="${P}-card" style="--i:${i}">
              <span class="${P}-av" data-ini="${esc(initials(p.name))}" aria-hidden="true"></span>
              <div class="${P}-info">
                <p class="${P}-name">${esc(p.name)}</p>
                <p class="${P}-date">${esc(dateStr)}</p>
              </div>
              <span class="${P}-pill${isToday ? " is-today" : ""}">${esc(countdown)}</span>
            </li>`;
                    }).join("")}</ul>`
                    : `<p class="${P}-empty">${esc(t("state.empty"))}</p>`;
                container.innerHTML = `<style>${CSS}</style>
        <div class="${P}-root" dir="${rtl ? "rtl" : "ltr"}" style="
          --sbbd-primary:${esc(primary)};
          --sbbd-accent:${esc(accent)};
          --sbbd-primary-rgb:${hexToRgb(primary)};
          --sbbd-primary-text:${readableOn(primary)}">
          <div class="${P}-header">
            <span class="${P}-mark"></span>
            <span class="${P}-title">${esc(heading)}</span>
            ${people.length ? `<span class="${P}-count">${esc(String(people.length))}</span>` : ""}
          </div>
          ${cardsHtml}
        </div>`;
            });
        }
        disconnectedCallback() {
            // No async timers or listeners to clean up.
        }
        static get observedAttributes() {
            return ATTRS;
        }
    };
};
const ATTRS = [
    "apitoken", "baseurl", "people", "widgettitle",
    "usethemecolors", "primarycolor", "accentcolor",
];
// ── Block registration ────────────────────────────────────────────────────────
const blockDefinition = {
    name: "birthday-widget",
    label: "Upcoming Birthdays",
    attributes: ATTRS,
    factory,
    configurationSchema,
    uiSchema,
    blockLevel: "block",
    iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='10' fill='%233DDC97'/%3E%3Cg fill='%23fff'%3E%3Crect x='8' y='20' width='24' height='13' rx='3'/%3E%3Crect x='11' y='14' width='18' height='8' rx='2'/%3E%3Crect x='19' y='7' width='2' height='6' rx='1'/%3E%3Crect x='13' y='8' width='2' height='5' rx='1'/%3E%3Crect x='25' y='8' width='2' height='5' rx='1'/%3E%3C/g%3E%3C/svg%3E",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" });

/******/ })()
;