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

;// ./strings.ts
// i18n bundles. `en_US` is the source of truth; the branch's
// `availableLocales` on verizon-demo are fr_CA, en_US, es_MX, es_ES, fr_FR,
// de_DE and nl_NL, so all seven ship here.
const AVAILABLE_LOCALES = ["en_US", "de_DE", "fr_FR", "fr_CA", "es_ES", "es_MX", "nl_NL"];
const BUNDLES = {
    en_US: {
        "widget.title": "Engagement leaderboard",
        "state.loading": "Loading engagement data…",
        "state.error": "Could not load engagement data.",
        "state.empty": "No engagement activity yet.",
        "state.emptyTile": "No activity in this period.",
        "state.retry": "Try again",
        "state.refresh": "Refresh",
        "state.sample": "Sample data",
        "state.partial": "Partial data — some channels were not readable.",
        "state.configure": "Set the base URL and API token in the widget settings.",
        "window.all": "All time",
        "window.7d": "Last 7 days",
        "window.30d": "Last 30 days",
        "window.90d": "Last 90 days",
        "window.12m": "Last 12 months",
        "window.custom": "Custom range",
        "window.widened": "No activity in the selected period — showing all time.",
        "window.updated": "Updated",
        "metric.mostActive": "Most active",
        "metric.mostActive.sub": "Comments, reactions and posts combined",
        "metric.mostEngaged": "Most engaged",
        "metric.mostEngaged.sub": "Weighted for depth and breadth of participation",
        "metric.topCommenter": "Top commenter",
        "metric.topCommenter.sub": "Most comments written",
        "metric.topReactor": "Top reactor",
        "metric.topReactor.sub": "Most reactions given",
        "metric.mostAppreciated": "Most appreciated",
        "metric.mostAppreciated.sub": "Most reactions received on their posts",
        "metric.topContributor": "Top contributor",
        "metric.topContributor.sub": "Most posts published",
        "metric.risingStar": "Rising star",
        "metric.risingStar.sub": "Biggest increase over the previous period",
        "metric.advocacy": "Social advocacy",
        "metric.advocacy.sub": "Most shared posts, credited to their author",
        "part.comments": "Comments",
        "part.reactions": "Reactions",
        "part.posts": "Posts",
        "part.breadth": "Breadth",
        "part.shares": "Shares",
        "part.clicks": "Clicks",
        "unit.actions": "actions",
        "unit.points": "points",
        "unit.comments": "comments",
        "unit.reactions": "reactions",
        "unit.received": "reactions received",
        "unit.posts": "posts",
        "unit.shares": "shares",
        "advocacy.unknownPost": "Unknown post",
        "chart.previous": "Previous",
        "chart.current": "Current",
        "chart.breakdown": "How the score breaks down",
        "chart.mix": "Reaction mix",
        "nav.previous": "Previous metric",
        "nav.next": "Next metric",
        "map.title": "The engagement map",
        "map.sub": "Breadth of participation against sheer volume",
        "map.label": "Engagement map: participation breadth against total actions",
        "map.axisX": "Breadth",
        "map.axisY": "Volume",
        "window.from": "From",
        "window.to": "To",
        "state.partialN": "Partial data — {n} of {total} posts could not be read.",
        "a11y.rank": "Rank",
    },
    de_DE: {
        "widget.title": "Engagement-Bestenliste",
        "state.loading": "Engagement-Daten werden geladen…",
        "state.error": "Engagement-Daten konnten nicht geladen werden.",
        "state.empty": "Noch keine Engagement-Aktivität.",
        "state.emptyTile": "Keine Aktivität in diesem Zeitraum.",
        "state.retry": "Erneut versuchen",
        "state.refresh": "Aktualisieren",
        "state.sample": "Beispieldaten",
        "state.partial": "Unvollständige Daten – einige Kanäle waren nicht lesbar.",
        "state.configure": "Basis-URL und API-Token in den Widget-Einstellungen festlegen.",
        "window.all": "Gesamter Zeitraum",
        "window.7d": "Letzte 7 Tage",
        "window.30d": "Letzte 30 Tage",
        "window.90d": "Letzte 90 Tage",
        "window.12m": "Letzte 12 Monate",
        "window.custom": "Eigener Zeitraum",
        "window.widened": "Keine Aktivität im gewählten Zeitraum – gesamter Zeitraum wird angezeigt.",
        "window.updated": "Aktualisiert",
        "metric.mostActive": "Aktivste Person",
        "metric.mostActive.sub": "Kommentare, Reaktionen und Beiträge zusammen",
        "metric.mostEngaged": "Höchstes Engagement",
        "metric.mostEngaged.sub": "Gewichtet nach Tiefe und Breite der Beteiligung",
        "metric.topCommenter": "Top-Kommentator",
        "metric.topCommenter.sub": "Die meisten Kommentare geschrieben",
        "metric.topReactor": "Top-Reaktionen",
        "metric.topReactor.sub": "Die meisten Reaktionen gegeben",
        "metric.mostAppreciated": "Größte Wertschätzung",
        "metric.mostAppreciated.sub": "Die meisten Reaktionen auf eigene Beiträge",
        "metric.topContributor": "Top-Autor",
        "metric.topContributor.sub": "Die meisten Beiträge veröffentlicht",
        "metric.risingStar": "Aufsteiger",
        "metric.risingStar.sub": "Größter Zuwachs gegenüber dem Vorzeitraum",
        "metric.advocacy": "Social Advocacy",
        "metric.advocacy.sub": "Meistgeteilte Beiträge, dem Autor zugeordnet",
        "part.comments": "Kommentare",
        "part.reactions": "Reaktionen",
        "part.posts": "Beiträge",
        "part.breadth": "Reichweite",
        "part.shares": "Geteilt",
        "part.clicks": "Klicks",
        "unit.actions": "Aktionen",
        "unit.points": "Punkte",
        "unit.comments": "Kommentare",
        "unit.reactions": "Reaktionen",
        "unit.received": "Reaktionen erhalten",
        "unit.posts": "Beiträge",
        "unit.shares": "Mal geteilt",
        "advocacy.unknownPost": "Unbekannter Beitrag",
        "chart.previous": "Vorher",
        "chart.current": "Aktuell",
        "chart.breakdown": "Zusammensetzung der Punktzahl",
        "chart.mix": "Reaktionsmix",
        "nav.previous": "Vorherige Kennzahl",
        "nav.next": "Nächste Kennzahl",
        "map.title": "Die Engagement-Karte",
        "map.sub": "Breite der Beteiligung im Verhältnis zur Menge",
        "map.label": "Engagement-Karte: Beteiligungsbreite gegenüber Gesamtaktionen",
        "map.axisX": "Breite",
        "map.axisY": "Menge",
        "window.from": "Von",
        "window.to": "Bis",
        "state.partialN": "Unvollständige Daten – {n} von {total} Beiträgen konnten nicht gelesen werden.",
        "a11y.rank": "Rang",
    },
    fr_FR: {
        "widget.title": "Classement d'engagement",
        "state.loading": "Chargement des données d'engagement…",
        "state.error": "Impossible de charger les données d'engagement.",
        "state.empty": "Aucune activité d'engagement pour l'instant.",
        "state.emptyTile": "Aucune activité sur cette période.",
        "state.retry": "Réessayer",
        "state.refresh": "Actualiser",
        "state.sample": "Données d'exemple",
        "state.partial": "Données partielles — certains canaux n'ont pas pu être lus.",
        "state.configure": "Définissez l'URL de base et le jeton d'API dans les paramètres du widget.",
        "window.all": "Depuis le début",
        "window.7d": "7 derniers jours",
        "window.30d": "30 derniers jours",
        "window.90d": "90 derniers jours",
        "window.12m": "12 derniers mois",
        "window.custom": "Période personnalisée",
        "window.widened": "Aucune activité sur la période choisie — affichage depuis le début.",
        "window.updated": "Mis à jour",
        "metric.mostActive": "Le plus actif",
        "metric.mostActive.sub": "Commentaires, réactions et publications cumulés",
        "metric.mostEngaged": "Le plus engagé",
        "metric.mostEngaged.sub": "Pondéré selon l'intensité et la diversité de la participation",
        "metric.topCommenter": "Top commentateur",
        "metric.topCommenter.sub": "Le plus de commentaires rédigés",
        "metric.topReactor": "Top réactions",
        "metric.topReactor.sub": "Le plus de réactions données",
        "metric.mostAppreciated": "Le plus apprécié",
        "metric.mostAppreciated.sub": "Le plus de réactions reçues sur ses publications",
        "metric.topContributor": "Top contributeur",
        "metric.topContributor.sub": "Le plus de publications",
        "metric.risingStar": "Étoile montante",
        "metric.risingStar.sub": "Plus forte progression par rapport à la période précédente",
        "metric.advocacy": "Relais social",
        "metric.advocacy.sub": "Publications les plus partagées, attribuées à leur auteur",
        "part.comments": "Commentaires",
        "part.reactions": "Réactions",
        "part.posts": "Publications",
        "part.breadth": "Diversité",
        "part.shares": "Partages",
        "part.clicks": "Clics",
        "unit.actions": "actions",
        "unit.points": "points",
        "unit.comments": "commentaires",
        "unit.reactions": "réactions",
        "unit.received": "réactions reçues",
        "unit.posts": "publications",
        "unit.shares": "partages",
        "advocacy.unknownPost": "Publication inconnue",
        "chart.previous": "Précédent",
        "chart.current": "Actuel",
        "chart.breakdown": "Composition du score",
        "chart.mix": "Répartition des réactions",
        "nav.previous": "Indicateur précédent",
        "nav.next": "Indicateur suivant",
        "map.title": "La carte d'engagement",
        "map.sub": "Diversité de la participation face au volume",
        "map.label": "Carte d'engagement : diversité de participation et actions totales",
        "map.axisX": "Diversité",
        "map.axisY": "Volume",
        "window.from": "Du",
        "window.to": "Au",
        "state.partialN": "Données partielles — {n} publications sur {total} n'ont pas pu être lues.",
        "a11y.rank": "Rang",
    },
    es_ES: {
        "widget.title": "Clasificación de participación",
        "state.loading": "Cargando datos de participación…",
        "state.error": "No se pudieron cargar los datos de participación.",
        "state.empty": "Todavía no hay actividad.",
        "state.emptyTile": "Sin actividad en este periodo.",
        "state.retry": "Reintentar",
        "state.refresh": "Actualizar",
        "state.sample": "Datos de ejemplo",
        "state.partial": "Datos parciales: algunos canales no se pudieron leer.",
        "state.configure": "Configura la URL base y el token de API en los ajustes del widget.",
        "window.all": "Desde siempre",
        "window.7d": "Últimos 7 días",
        "window.30d": "Últimos 30 días",
        "window.90d": "Últimos 90 días",
        "window.12m": "Últimos 12 meses",
        "window.custom": "Periodo personalizado",
        "window.widened": "Sin actividad en el periodo seleccionado: se muestra desde siempre.",
        "window.updated": "Actualizado",
        "metric.mostActive": "Más activo",
        "metric.mostActive.sub": "Comentarios, reacciones y publicaciones combinados",
        "metric.mostEngaged": "Mayor participación",
        "metric.mostEngaged.sub": "Ponderado por profundidad y amplitud de la participación",
        "metric.topCommenter": "Top comentarista",
        "metric.topCommenter.sub": "Más comentarios escritos",
        "metric.topReactor": "Top reacciones",
        "metric.topReactor.sub": "Más reacciones dadas",
        "metric.mostAppreciated": "Más valorado",
        "metric.mostAppreciated.sub": "Más reacciones recibidas en sus publicaciones",
        "metric.topContributor": "Top colaborador",
        "metric.topContributor.sub": "Más publicaciones publicadas",
        "metric.risingStar": "Promesa emergente",
        "metric.risingStar.sub": "Mayor aumento respecto al periodo anterior",
        "metric.advocacy": "Difusión social",
        "metric.advocacy.sub": "Publicaciones más compartidas, atribuidas a su autor",
        "part.comments": "Comentarios",
        "part.reactions": "Reacciones",
        "part.posts": "Publicaciones",
        "part.breadth": "Amplitud",
        "part.shares": "Compartidos",
        "part.clicks": "Clics",
        "unit.actions": "acciones",
        "unit.points": "puntos",
        "unit.comments": "comentarios",
        "unit.reactions": "reacciones",
        "unit.received": "reacciones recibidas",
        "unit.posts": "publicaciones",
        "unit.shares": "veces compartido",
        "advocacy.unknownPost": "Publicación desconocida",
        "chart.previous": "Anterior",
        "chart.current": "Actual",
        "chart.breakdown": "Desglose de la puntuación",
        "chart.mix": "Mezcla de reacciones",
        "nav.previous": "Métrica anterior",
        "nav.next": "Métrica siguiente",
        "map.title": "El mapa de participación",
        "map.sub": "Amplitud de la participación frente al volumen",
        "map.label": "Mapa de participación: amplitud frente a acciones totales",
        "map.axisX": "Amplitud",
        "map.axisY": "Volumen",
        "window.from": "Desde",
        "window.to": "Hasta",
        "state.partialN": "Datos parciales: no se pudieron leer {n} de {total} publicaciones.",
        "a11y.rank": "Puesto",
    },
    nl_NL: {
        "widget.title": "Betrokkenheidsklassement",
        "state.loading": "Betrokkenheidsgegevens laden…",
        "state.error": "Betrokkenheidsgegevens konden niet worden geladen.",
        "state.empty": "Nog geen activiteit.",
        "state.emptyTile": "Geen activiteit in deze periode.",
        "state.retry": "Opnieuw proberen",
        "state.refresh": "Vernieuwen",
        "state.sample": "Voorbeeldgegevens",
        "state.partial": "Onvolledige gegevens — sommige kanalen konden niet worden gelezen.",
        "state.configure": "Stel de basis-URL en het API-token in bij de widgetinstellingen.",
        "window.all": "Alle tijd",
        "window.7d": "Laatste 7 dagen",
        "window.30d": "Laatste 30 dagen",
        "window.90d": "Laatste 90 dagen",
        "window.12m": "Laatste 12 maanden",
        "window.custom": "Aangepaste periode",
        "window.widened": "Geen activiteit in de gekozen periode — alle tijd wordt getoond.",
        "window.updated": "Bijgewerkt",
        "metric.mostActive": "Meest actief",
        "metric.mostActive.sub": "Reacties, likes en berichten samen",
        "metric.mostEngaged": "Meest betrokken",
        "metric.mostEngaged.sub": "Gewogen naar diepte en breedte van deelname",
        "metric.topCommenter": "Topreageerder",
        "metric.topCommenter.sub": "De meeste reacties geschreven",
        "metric.topReactor": "Meeste likes gegeven",
        "metric.topReactor.sub": "De meeste reacties gegeven",
        "metric.mostAppreciated": "Meest gewaardeerd",
        "metric.mostAppreciated.sub": "De meeste likes op eigen berichten",
        "metric.topContributor": "Topbijdrager",
        "metric.topContributor.sub": "De meeste berichten gepubliceerd",
        "metric.risingStar": "Rijzende ster",
        "metric.risingStar.sub": "Grootste stijging ten opzichte van de vorige periode",
        "metric.advocacy": "Sociale ambassadeurs",
        "metric.advocacy.sub": "Meest gedeelde berichten, toegeschreven aan de auteur",
        "part.comments": "Reacties",
        "part.reactions": "Likes",
        "part.posts": "Berichten",
        "part.breadth": "Bereik",
        "part.shares": "Gedeeld",
        "part.clicks": "Kliks",
        "unit.actions": "acties",
        "unit.points": "punten",
        "unit.comments": "reacties",
        "unit.reactions": "likes",
        "unit.received": "likes ontvangen",
        "unit.posts": "berichten",
        "unit.shares": "keer gedeeld",
        "advocacy.unknownPost": "Onbekend bericht",
        "chart.previous": "Vorige",
        "chart.current": "Huidig",
        "chart.breakdown": "Opbouw van de score",
        "chart.mix": "Verdeling van likes",
        "nav.previous": "Vorige maatstaf",
        "nav.next": "Volgende maatstaf",
        "map.title": "De betrokkenheidskaart",
        "map.sub": "Breedte van deelname tegenover puur volume",
        "map.label": "Betrokkenheidskaart: breedte van deelname tegenover totaal aantal acties",
        "map.axisX": "Breedte",
        "map.axisY": "Volume",
        "window.from": "Van",
        "window.to": "Tot",
        "state.partialN": "Onvolledige gegevens — {n} van {total} berichten konden niet worden gelezen.",
        "a11y.rank": "Positie",
    },
};
// fr_CA and es_MX differ only in a handful of conventions; they inherit the
// European bundle wholesale rather than duplicating 40 identical strings.
BUNDLES.fr_CA = Object.assign(Object.assign({}, BUNDLES.fr_FR), { "metric.advocacy": "Partage social" });
BUNDLES.es_MX = Object.assign(Object.assign({}, BUNDLES.es_ES), { "metric.advocacy": "Difusión social" });

;// ./api.ts
// ─────────────────────────────────────────────────────────────────────────────
// API layer + auth ladder.
//
// Two identities are available to a widget, and they can reach different data:
//
//   token   — Basic API token. A *service* identity, not a user. Works for
//             /posts, /comments, /posts/{id}/likes, /users and the branch
//             analytics rankings.
//   session — the logged-in viewer's cookie + CSRF. Required for endpoints the
//             backend declares `@Authenticated(types=[USER])`, which a token
//             identity does not satisfy.
//
// Verified against verizon-demo:
//   GET /reactions?parentId=&parentType=post → 403 under token (even with
//   `Accept: application/json`), because it is USER-only. Under session it also
//   returns the reaction *type*, which upgrades Top Reactor from a flat like
//   count to a typed breakdown. So that one endpoint tries session *first*.
//
// Both helpers are ported from `tasks/my-tasks-widget.ts` (apiOpts:1207,
// readCsrf/sessionOpts:1388-1405) — the current pattern, not the older
// cookie-only `fetch()` used by analytics-email-open-viewer.
// ─────────────────────────────────────────────────────────────────────────────
var api_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// ── Identities ───────────────────────────────────────────────────────────────
const makeApiOpts = (apiToken) => (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: Object.assign({ Authorization: `Basic ${apiToken}`, "Content-Type": "application/json" }, ((extra === null || extra === void 0 ? void 0 : extra.headers) || {})) }));
/** Confirmed CSRF source in both web and mobile widget contexts is
 *  `window.we.authMgr.csrfToken`; the rest are defensive fallbacks. */
function readCsrf() {
    var _a, _b;
    const w = window;
    try {
        const t = (_b = (_a = w.we) === null || _a === void 0 ? void 0 : _a.authMgr) === null || _b === void 0 ? void 0 : _b.csrfToken;
        if (t)
            return String(t);
    }
    catch (_) { /* not available */ }
    if (w.csrfToken)
        return String(w.csrfToken);
    const m = document.cookie.match(/(?:^|;\s*)(?:csrf|XSRF-TOKEN|csrftoken)=([^;]+)/i);
    if (m)
        return decodeURIComponent(m[1]);
    const meta = document.querySelector('meta[name="csrf-token"]');
    return (meta === null || meta === void 0 ? void 0 : meta.content) || "";
}
const sessionOpts = (extra) => {
    const csrf = readCsrf();
    return Object.assign(Object.assign({}, extra), { credentials: "include", headers: Object.assign(Object.assign({}, (csrf ? { "x-csrf-token": csrf } : {})), ((extra === null || extra === void 0 ? void 0 : extra.headers) || {})) });
};
const RETRY_STATUS = [429, 500, 502, 503, 504];
class Http {
    constructor(concurrency, log) {
        this.concurrency = concurrency;
        this.log = log;
        this.active = 0;
        this.queue = [];
    }
    acquire() {
        if (this.active < this.concurrency) {
            this.active++;
            return Promise.resolve();
        }
        return new Promise(resolve => this.queue.push(() => { this.active++; resolve(); }));
    }
    release() {
        this.active--;
        const next = this.queue.shift();
        if (next)
            next();
    }
    /** GET JSON with backoff. Throws `HTTP <status>` on a non-retryable failure. */
    getJson(url_1, makeOpts_1) {
        return api_awaiter(this, arguments, void 0, function* (url, makeOpts, tries = 3) {
            yield this.acquire();
            try {
                let lastErr = new Error("no attempt");
                for (let i = 0; i < tries; i++) {
                    try {
                        const res = yield fetch(url, makeOpts({ headers: { Accept: "application/json" } }));
                        if (res.ok)
                            return yield res.json();
                        // A burst-403 is the rate limiter, but a genuine 403 (restricted
                        // channel / wrong identity) must surface immediately on the last try.
                        const retryable = RETRY_STATUS.indexOf(res.status) >= 0 || (res.status === 403 && i < tries - 1);
                        if (!retryable)
                            throw new Error(`HTTP ${res.status}`);
                        const retryAfter = Number(res.headers.get("Retry-After") || 0);
                        yield sleep(retryAfter > 0 ? retryAfter * 1000 : 400 * Math.pow(2, i));
                        lastErr = new Error(`HTTP ${res.status}`);
                    }
                    catch (e) {
                        lastErr = e instanceof Error ? e : new Error(String(e));
                        if (/^HTTP (4\d\d)$/.test(lastErr.message) && !/HTTP 429/.test(lastErr.message))
                            throw lastErr;
                        if (i < tries - 1)
                            yield sleep(400 * Math.pow(2, i));
                    }
                }
                throw lastErr;
            }
            finally {
                this.release();
            }
        });
    }
    /** Try `token` then `session` (or the reverse), returning the first success. */
    ladder(url, order, label) {
        return api_awaiter(this, void 0, void 0, function* () {
            let lastErr = new Error("no identity available");
            for (let i = 0; i < order.length; i++) {
                try {
                    return yield this.getJson(url, order[i]);
                }
                catch (e) {
                    lastErr = e;
                    this.log(`${label}: identity ${i + 1}/${order.length} failed —`, e.message);
                }
            }
            throw lastErr;
        });
    }
    /** Map with bounded concurrency (the queue above already caps in-flight
     *  requests; this just avoids building a huge promise array eagerly). */
    mapLimit(items, fn) {
        return api_awaiter(this, void 0, void 0, function* () {
            return Promise.all(items.map(fn));
        });
    }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// ── Normalizers ──────────────────────────────────────────────────────────────
/** Avatar URL preference, largest-to-smallest fallback — matches
 *  `recognition-widget.ts:661`. `icon` is 48px (chart nodes), `thumb` 200px. */
function avatarUrl(a, prefer = "icon") {
    var _a, _b, _c;
    if (!a)
        return "";
    const icon = ((_a = a.icon) === null || _a === void 0 ? void 0 : _a.url) || "";
    const thumb = ((_b = a.thumb) === null || _b === void 0 ? void 0 : _b.url) || "";
    const orig = ((_c = a.original) === null || _c === void 0 ? void 0 : _c.url) || "";
    return prefer === "thumb" ? (thumb || icon || orig) : (icon || thumb || orig);
}
function toPerson(u) {
    var _a, _b, _c, _d, _e;
    return {
        id: u.id || "",
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "",
        avatar: avatarUrl(u.avatar),
        position: u.position || ((_a = u.profile) === null || _a === void 0 ? void 0 : _a.position) || "",
        department: u.department || ((_b = u.profile) === null || _b === void 0 ? void 0 : _b.department) || "",
        location: u.location || ((_c = u.profile) === null || _c === void 0 ? void 0 : _c.location) || "",
        pronouns: ((_d = u.profile) === null || _d === void 0 ? void 0 : _d.pronouns) || u.pronouns || "",
        headline: u.profileHeadline || ((_e = u.profile) === null || _e === void 0 ? void 0 : _e.profileHeadline) || "",
    };
}
// ── Endpoints ────────────────────────────────────────────────────────────────
const PAGE = 100;
/** Page an offset-based `{total, data[]}` list endpoint to `cap` items. */
function pageAll(http, base, path, order, label, cap) {
    return api_awaiter(this, void 0, void 0, function* () {
        var _a;
        const out = [];
        for (let offset = 0; offset < cap; offset += PAGE) {
            const limit = Math.min(PAGE, cap - offset);
            const sep = path.indexOf("?") >= 0 ? "&" : "?";
            const d = yield http.ladder(`${base}${path}${sep}limit=${limit}&offset=${offset}`, order, label);
            const data = (d === null || d === void 0 ? void 0 : d.data) || [];
            for (const x of data)
                out.push(x);
            const total = Number((_a = d === null || d === void 0 ? void 0 : d.total) !== null && _a !== void 0 ? _a : out.length);
            if (data.length < limit || out.length >= total)
                break;
        }
        return out;
    });
}
function fetchUsers(http, base, order, cap) {
    return api_awaiter(this, void 0, void 0, function* () {
        const rows = yield pageAll(http, base, "/users", order, "users", cap);
        return rows.map(toPerson).filter(p => p.id);
    });
}
function fetchPosts(http, base, order, cap, inlineUsers) {
    return api_awaiter(this, void 0, void 0, function* () {
        var _a;
        const rows = yield pageAll(http, base, "/posts", order, "posts", cap);
        if (inlineUsers)
            for (const p of rows)
                if ((_a = p === null || p === void 0 ? void 0 : p.author) === null || _a === void 0 ? void 0 : _a.id)
                    inlineUsers.push(p.author);
        return rows.map((p) => {
            var _a;
            return ({
                id: p.id || "",
                authorId: p.authorID || ((_a = p.author) === null || _a === void 0 ? void 0 : _a.id) || "",
                channelId: p.channelID || "",
                created: p.created || "",
                published: p.published || p.created || "",
                title: pickTitle(p),
                likingEnabled: p.likingEnabled !== false,
            });
        }).filter(p => p.id);
    });
}
/** Posts carry localized `contents`; take the first title we find. */
function pickTitle(p) {
    var _a;
    const c = p === null || p === void 0 ? void 0 : p.contents;
    if (c && typeof c === "object") {
        const keys = Object.keys(c);
        for (const k of ["en_US", ...keys]) {
            const t = (_a = c[k]) === null || _a === void 0 ? void 0 : _a.title;
            if (t)
                return String(t);
        }
    }
    return (p === null || p === void 0 ? void 0 : p.title) || "";
}
/**
 * Comments, windowed server-side via the SCIM2 `filter` param.
 * Verified live: `created gt "2026-08-01T00:00:00.000Z"` → total 0, vs. 34
 * all-time, so the filter genuinely applies.
 */
function fetchComments(http, base, order, cap, since, until) {
    return api_awaiter(this, void 0, void 0, function* () {
        const clauses = [];
        if (since)
            clauses.push(`created ge "${since.toISOString()}"`);
        if (until)
            clauses.push(`created le "${until.toISOString()}"`);
        const q = clauses.length ? `?filter=${encodeURIComponent(clauses.join(" and "))}` : "";
        return pageAll(http, base, `/comments${q}`, order, "comments", cap);
    });
}
/**
 * Who reacted to a post.
 *
 * `/reactions` is USER-only, so it is tried under session first — success adds
 * the reaction *type*. `/posts/{id}/likes` is the token-friendly fallback and
 * yields untyped likes.
 *
 * Returns `null` when the post is unreadable (restricted channel), so the
 * caller can count it as skipped rather than failing the whole load.
 */
function fetchPostReactions(http, base, postId, sessionFirst, tokenOnly, inlineUsers) {
    return api_awaiter(this, void 0, void 0, function* () {
        var _a;
        if (sessionFirst.length) {
            try {
                const d = yield http.getJson(`${base}/reactions?parentId=${postId}&parentType=post`, sessionFirst[0]);
                const rows = (d === null || d === void 0 ? void 0 : d.data) || [];
                return { rows: rows
                        .map(r => ({ userId: r.userId || r.userID || "", at: r.createdAt || r.created || "", type: r.type || "LIKE" }))
                        .filter(r => r.userId) };
            }
            catch (_) { /* fall through to /likes */ }
        }
        try {
            const d = yield http.ladder(`${base}/posts/${postId}/likes?limit=${PAGE}`, tokenOnly, `likes ${postId}`);
            const rows = (d === null || d === void 0 ? void 0 : d.data) || [];
            if (inlineUsers)
                for (const r of rows)
                    if ((_a = r === null || r === void 0 ? void 0 : r.user) === null || _a === void 0 ? void 0 : _a.id)
                        inlineUsers.push(r.user);
            return { rows: rows
                    .map(r => ({ userId: r.userID || r.userId || "", at: r.created || "" }))
                    .filter(r => r.userId) };
        }
        catch (e) {
            // Keep the reason. "Some channels were not readable" is useless on its own;
            // the caller needs to be able to name the post and the HTTP status.
            return { skipped: (e === null || e === void 0 ? void 0 : e.message) || String(e) };
        }
    });
}
/**
 * Full-resolution profile photo for one user.
 *
 * `/users` only carries the 48px `icon` and 200px `thumb` derivatives, which are
 * visibly soft behind the 132px champion avatar on a 2x display.
 * `/profiles/public/{id}` returns a 200px square `avatarUrl` built from a
 * Cloudinary-style transform chain, and that chain can be re-written to ask for
 * a larger render.
 *
 * USER-authenticated (a bare request returns NotLoggedInException), so this is
 * session-first and strictly optional — if it fails the existing avatar stands.
 */
function fetchPublicProfile(http, base, id, ladder) {
    return api_awaiter(this, void 0, void 0, function* () {
        try {
            const d = yield http.ladder(`${base}/profiles/public/${id}`, ladder, `profile ${id}`);
            if (!d || !d.id)
                return null;
            return {
                avatar: d.avatarUrl || "",
                position: d.position || "",
                department: d.department || "",
            };
        }
        catch (_) {
            return null;
        }
    });
}
/**
 * Ask the media pipeline for a larger render of the same image.
 *
 * The URL ends in `.../c_fill,w_200,h_200/<hash>.png`. Raising those numbers is
 * the documented way to get a sharper derivative, but it is a guess about a URL
 * shape we do not own — so callers must keep the original as an onerror
 * fallback rather than trusting this.
 */
function hiResAvatar(url, px) {
    if (!url || !/\/c_fill,w_\d+,h_\d+\//.test(url))
        return url;
    return url.replace(/\/c_fill,w_\d+,h_\d+\//, `/c_fill,w_${px},h_${px}/`);
}
/**
 * Post-level share/click analytics.
 *
 * ⚠ The time-range params are `since` / `until` in RFC3339. `from`/`to`,
 * `start`/`end`, `startDate`/`endDate` and `dateFrom`/`dateTo` all return 200
 * but are **silently ignored** — verified live, and an easy trap.
 */
function fetchPostRankings(http, base, order, since, until) {
    return api_awaiter(this, void 0, void 0, function* () {
        var _a;
        const qs = [`limit=${PAGE}`, "orderBy=shares_DESC"];
        if (since)
            qs.push(`since=${rfc3339(since)}`);
        if (until)
            qs.push(`until=${rfc3339(until)}`);
        const d = yield http.ladder(`${base}/branch/analytics/posts/rankings?${qs.join("&")}`, order, "post rankings");
        const posts = ((_a = d === null || d === void 0 ? void 0 : d.entities) === null || _a === void 0 ? void 0 : _a.posts) || {};
        const rows = (d === null || d === void 0 ? void 0 : d.ranking) || [];
        return rows.map((r) => {
            var _a, _b, _c, _d;
            const postId = ((_a = r === null || r === void 0 ? void 0 : r.group) === null || _a === void 0 ? void 0 : _a.postId) || "";
            return {
                postId,
                channelId: ((_b = r === null || r === void 0 ? void 0 : r.group) === null || _b === void 0 ? void 0 : _b.channelId) || "",
                title: ((_c = posts[postId]) === null || _c === void 0 ? void 0 : _c.title) || "",
                shares: num(r.shares),
                clicks: num(r.clicks),
                comments: num(r.comments),
                likes: num((_d = r.likes) !== null && _d !== void 0 ? _d : r.postLikes),
                visitors: num(r.registeredVisitors) + num(r.unregisteredVisitors),
            };
        }).filter(r => r.postId);
    });
}
const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
/** The analytics endpoint parses `2006-01-02T15:04:05`, so send seconds
 *  precision without milliseconds. */
function rfc3339(d) {
    return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}
// ── Capability probe ─────────────────────────────────────────────────────────
/** `/users/me` 404s for a token (it is not a user) and succeeds for a real
 *  session, which makes it a clean session probe. */
function sessionWorks(http, base) {
    return api_awaiter(this, void 0, void 0, function* () {
        try {
            const d = yield http.getJson(`${base}/users/me`, sessionOpts, 1);
            return !!(d && (d.id || d.userName));
        }
        catch (_) {
            return false;
        }
    });
}
/**
 * One pass over every source, returning the *un-windowed* event set. The time
 * window is applied afterwards in memory (see `aggregate.ts`) so switching
 * windows never re-fetches.
 */
function loadRawData(opts) {
    return api_awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const { baseUrl: base, apiToken, authMode, maxPosts, log } = opts;
        const http = new Http(opts.concurrency, log);
        const apiOpts = makeApiOpts(apiToken);
        const haveToken = !!apiToken;
        // Identity order per resource, following what we measured.
        let useSession = authMode === "session";
        if (authMode === "auto") {
            useSession = yield sessionWorks(http, base);
            log("session probe:", useSession ? "available" : "unavailable");
        }
        const general = [];
        if (authMode !== "session" && haveToken)
            general.push(apiOpts);
        if (authMode !== "token")
            general.push(sessionOpts);
        if (!general.length)
            general.push(sessionOpts);
        // /reactions is USER-only, so session leads; /likes covers the token case.
        const reactionSession = (authMode !== "token" && useSession) ? [sessionOpts] : [];
        // Directory pages can miss people who are deactivated or beyond the cap, so
        // inline author/user objects are collected as a backfill source.
        const inlineUsers = [];
        const [people, posts] = yield Promise.all([
            fetchUsers(http, base, general, 500).catch(e => { log("users failed —", e.message); return []; }),
            fetchPosts(http, base, general, maxPosts, inlineUsers).catch(e => { log("posts failed —", e.message); return []; }),
        ]);
        log(`loaded ${people.length} users, ${posts.length} posts`);
        // Comments are fetched un-windowed; windowing happens in memory so the cache
        // stays window-independent.
        const commentRows = yield fetchComments(http, base, general, 1000)
            .catch(e => { log("comments failed —", e.message); return []; });
        log(`loaded ${commentRows.length} comments`);
        const rankings = yield fetchPostRankings(http, base, general)
            .catch(e => { log("post rankings failed —", e.message); return []; });
        log(`loaded ${rankings.length} ranking rows`);
        // Fan-out: one reaction list per post.
        let done = 0;
        let skippedPosts = 0;
        const skipped = [];
        let typedReactions = false;
        const events = [];
        const results = yield http.mapLimit(posts, (post) => api_awaiter(this, void 0, void 0, function* () {
            var _a;
            const res = yield fetchPostReactions(http, base, post.id, reactionSession, general, inlineUsers);
            done++;
            (_a = opts.onProgress) === null || _a === void 0 ? void 0 : _a.call(opts, done, posts.length);
            return { post, res };
        }));
        for (const { post, res } of results) {
            if ("skipped" in res) {
                skippedPosts++;
                skipped.push({ postId: post.id, channelId: post.channelId || "", reason: res.skipped });
                continue;
            }
            for (const r of res.rows) {
                if (r.type)
                    typedReactions = true;
                events.push({
                    kind: "reaction",
                    userId: r.userId,
                    postId: post.id,
                    channelId: post.channelId,
                    at: r.at || post.published,
                    reactionType: r.type,
                });
            }
        }
        const postById = new Map(posts.map(p => [p.id, p]));
        for (const c of commentRows) {
            const authorId = c.authorID || ((_a = c.author) === null || _a === void 0 ? void 0 : _a.id) || "";
            if (!authorId)
                continue; // deleted / anonymized comment
            const rootId = c.rootID || c.parentID || "";
            events.push({
                kind: "comment",
                userId: authorId,
                postId: rootId,
                channelId: ((_b = postById.get(rootId)) === null || _b === void 0 ? void 0 : _b.channelId) || c.installationID || "",
                at: c.created || "",
            });
        }
        for (const p of posts) {
            if (!p.authorId)
                continue;
            events.push({ kind: "post", userId: p.authorId, postId: p.id, channelId: p.channelId, at: p.published || p.created });
        }
        // Backfill anyone the directory did not return, so a chart node still gets a
        // name and avatar instead of rendering as "Unknown".
        const known = new Set(people.map(p => p.id));
        for (const c of commentRows)
            if ((_c = c === null || c === void 0 ? void 0 : c.author) === null || _c === void 0 ? void 0 : _c.id)
                inlineUsers.push(c.author);
        for (const a of inlineUsers) {
            if (a.id && !known.has(a.id)) {
                known.add(a.id);
                people.push(toPerson(a));
            }
        }
        log(`built ${events.length} events, skipped ${skippedPosts} restricted posts, typed reactions: ${typedReactions}`);
        if (skipped.length) {
            const byChannel = new Map();
            for (const sk of skipped)
                byChannel.set(sk.channelId, (byChannel.get(sk.channelId) || 0) + 1);
            for (const [ch, n] of byChannel)
                log(`  unreadable: ${n} post(s) in channel ${ch || "(unknown)"}`);
            for (const sk of skipped.slice(0, 5))
                log(`  post ${sk.postId} -> ${sk.reason}`);
            if (skipped.length > 5)
                log(`  ...and ${skipped.length - 5} more`);
        }
        return { events, posts, people, rankings, skippedPosts, skipped, typedReactions, fetchedAt: Date.now() };
    });
}

;// ./aggregate.ts
// ─────────────────────────────────────────────────────────────────────────────
// Windowing + aggregation.
//
// The whole widget is driven by one `RawData.events` array. Applying a time
// window is a pure in-memory filter, so switching windows re-renders without a
// single new request.
//
// There is no per-user engagement endpoint anywhere in the Staffbase API
// (verified: the analytics `groupBy` enum accepts only `channelId`/`spaceId`,
// and `/branch/analytics/users/rankings` is feature-flag gated), so every
// person-level metric is derived here. The weighting mirrors the product's own
// internal notion of engagement (likes + comments + shares), inverted from a
// post key to a user key.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_WEIGHTS = {
    comment: 3, reaction: 1, post: 5, breadthPost: 2, breadthChannel: 4,
};
/** Resolve a window key to absolute bounds. `all` spans everything. */
function resolveWindow(key, now, customSince, customUntil) {
    const day = 86400000;
    const spans = { "7d": 7 * day, "30d": 30 * day, "90d": 90 * day, "12m": 365 * day };
    if (key === "custom") {
        const s = Date.parse(customSince || "");
        let u = Date.parse(customUntil || "");
        // A bare YYYY-MM-DD parses to midnight, which would silently exclude the
        // whole of the end day the viewer just picked. Run it to the last instant.
        if (isFinite(u) && /^\d{4}-\d{2}-\d{2}$/.test((customUntil || "").trim()))
            u += day - 1;
        return { since: isFinite(s) ? s : 0, until: isFinite(u) ? u : now };
    }
    if (key === "all" || !spans[key])
        return { since: 0, until: now };
    return { since: now - spans[key], until: now };
}
/** The immediately preceding equal-length window — what Rising Star compares
 *  against. An all-time window has no meaningful predecessor. */
function previousWindow(w) {
    const len = w.until - w.since;
    if (!isFinite(len) || len <= 0 || w.since === 0)
        return null;
    return { since: w.since - len, until: w.since };
}
const inWindow = (e, w) => {
    const t = Date.parse(e.at);
    return isFinite(t) && t >= w.since && t <= w.until;
};
// ── Aggregation ──────────────────────────────────────────────────────────────
function aggregate(events, w, exclude) {
    var _a, _b;
    const out = new Map();
    const posts = new Map();
    const channels = new Map();
    // Who authored which post, so reactions/comments can be credited to the
    // author as "received".
    const authorOf = new Map();
    for (const e of events)
        if (e.kind === "post")
            authorOf.set(e.postId, e.userId);
    const get = (id) => {
        let s = out.get(id);
        if (!s) {
            s = {
                userId: id, comments: 0, reactionsGiven: 0, reactionsReceived: 0,
                commentsReceived: 0, postsAuthored: 0, distinctPosts: 0, distinctChannels: 0,
                lastActiveAt: 0, reactionTypes: {},
            };
            out.set(id, s);
            posts.set(id, new Set());
            channels.set(id, new Set());
        }
        return s;
    };
    for (const e of events) {
        if (!e.userId || exclude.has(e.userId))
            continue;
        if (!inWindow(e, w))
            continue;
        const s = get(e.userId);
        const t = Date.parse(e.at);
        if (isFinite(t) && t > s.lastActiveAt)
            s.lastActiveAt = t;
        if (e.kind === "comment")
            s.comments++;
        else if (e.kind === "post")
            s.postsAuthored++;
        else {
            s.reactionsGiven++;
            if (e.reactionType)
                s.reactionTypes[e.reactionType] = (s.reactionTypes[e.reactionType] || 0) + 1;
        }
        // Breadth counts only *engagement* (not authoring your own posts), so a
        // prolific author doesn't automatically win the breadth-weighted metric.
        if (e.kind !== "post") {
            if (e.postId)
                posts.get(e.userId).add(e.postId);
            if (e.channelId)
                channels.get(e.userId).add(e.channelId);
        }
        // Credit the post's author on the receiving side.
        const author = authorOf.get(e.postId);
        if (author && author !== e.userId && !exclude.has(author)) {
            const a = get(author);
            if (e.kind === "comment")
                a.commentsReceived++;
            else if (e.kind === "reaction")
                a.reactionsReceived++;
        }
    }
    for (const [id, s] of out) {
        s.distinctPosts = ((_a = posts.get(id)) === null || _a === void 0 ? void 0 : _a.size) || 0;
        s.distinctChannels = ((_b = channels.get(id)) === null || _b === void 0 ? void 0 : _b.size) || 0;
    }
    return out;
}
const activityScore = (s) => s.comments + s.reactionsGiven + s.postsAuthored;
const engagementScore = (s, w) => w.comment * s.comments +
    w.reaction * s.reactionsGiven +
    w.post * s.postsAuthored +
    w.breadthPost * s.distinctPosts +
    w.breadthChannel * s.distinctChannels;
// ── Ranking ──────────────────────────────────────────────────────────────────
/**
 * Deterministic ordering: value, then a secondary signal, then recency, then
 * name. Without the tail-breakers the leaderboard would reshuffle between
 * renders whenever people tie — which is common on low-volume windows.
 */
function rank(stats, people, value, secondary, topN) {
    const rows = [];
    for (const [id, s] of stats) {
        const v = value(s);
        if (v <= 0)
            continue;
        // Deleted/system authors resolve to nothing — omitting them is better than
        // an "Unknown" row that can't be clicked through to a profile.
        const p = people.get(id);
        if (!p || !p.name)
            continue;
        rows.push({ s, p, v });
    }
    rows.sort((a, b) => b.v - a.v ||
        secondary(b.s) - secondary(a.s) ||
        b.s.lastActiveAt - a.s.lastActiveAt ||
        a.p.name.localeCompare(b.p.name));
    return rows.slice(0, topN).map(r => ({ person: r.p, value: r.v }));
}
/**
 * Build every requested tile.
 *
 * Auto-widen is deliberately **per tile**: on a demo branch the share data can
 * be healthy for the last 90 days while comments and reactions are months old,
 * so a single global widen would either discard good share data or leave most
 * tiles blank. Each tile therefore reports the window it actually used.
 */
function buildTiles(o) {
    var _a;
    const people = new Map(o.raw.people.map(p => [p.id, p]));
    const all = { since: 0, until: Date.now() };
    const primary = aggregate(o.raw.events, o.window, o.exclude);
    let widened = null;
    const widenedStats = () => {
        if (!widened)
            widened = aggregate(o.raw.events, all, o.exclude);
        return widened;
    };
    const prevW = previousWindow(o.window);
    const prev = prevW ? aggregate(o.raw.events, prevW, o.exclude) : new Map();
    const tiles = [];
    /** Rank against the window; if empty and auto-widen is on, retry all-time. */
    const ranked = (value, secondary) => {
        const e = rank(primary, people, value, secondary, o.topN);
        if (e.length || !o.autoWiden)
            return { entries: e, widened: false };
        return { entries: rank(widenedStats(), people, value, secondary, o.topN), widened: true };
    };
    for (const id of o.metrics) {
        switch (id) {
            case "most_active": {
                const r = ranked(activityScore, s => s.comments);
                const src = r.widened ? widenedStats() : primary;
                // The headline number is a sum, so show what it is a sum of.
                for (const e of r.entries) {
                    const s = src.get(e.person.id);
                    if (!s)
                        continue;
                    e.parts = [
                        { label: o.t("part.comments"), value: s.comments, color: o.colors.comment },
                        { label: o.t("part.reactions"), value: s.reactionsGiven, color: o.colors.reaction },
                        { label: o.t("part.posts"), value: s.postsAuthored, color: o.colors.post },
                    ].filter(x => x.value > 0);
                }
                tiles.push(tile(id, o.t("metric.mostActive"), o.t("metric.mostActive.sub"), "podium", r, o.t("unit.actions")));
                break;
            }
            case "most_engaged": {
                const r = ranked(s => engagementScore(s, o.weights), activityScore);
                const src = r.widened ? widenedStats() : primary;
                // Attach the score breakdown so the composition bar can explain the
                // weighted number instead of presenting it as a magic value.
                for (const e of r.entries) {
                    const s = src.get(e.person.id);
                    if (!s)
                        continue;
                    e.parts = [
                        { label: o.t("part.comments"), value: o.weights.comment * s.comments, color: o.colors.comment },
                        { label: o.t("part.reactions"), value: o.weights.reaction * s.reactionsGiven, color: o.colors.reaction },
                        { label: o.t("part.posts"), value: o.weights.post * s.postsAuthored, color: o.colors.post },
                        { label: o.t("part.breadth"), value: o.weights.breadthPost * s.distinctPosts + o.weights.breadthChannel * s.distinctChannels, color: o.colors.breadth },
                    ].filter(x => x.value > 0);
                }
                tiles.push(tile(id, o.t("metric.mostEngaged"), o.t("metric.mostEngaged.sub"), "podium", r, o.t("unit.points")));
                break;
            }
            case "top_commenter": {
                const r = ranked(s => s.comments, s => s.reactionsGiven);
                tiles.push(tile(id, o.t("metric.topCommenter"), o.t("metric.topCommenter.sub"), "bars", r, o.t("unit.comments")));
                break;
            }
            case "top_reactor": {
                const r = ranked(s => s.reactionsGiven, s => s.comments);
                const src = r.widened ? widenedStats() : primary;
                // A typed donut is only meaningful when session auth resolved reaction
                // types; under token auth every reaction is an untyped LIKE.
                const typed = o.raw.typedReactions && r.entries.length > 0 &&
                    Object.keys(((_a = src.get(r.entries[0].person.id)) === null || _a === void 0 ? void 0 : _a.reactionTypes) || {}).length > 1;
                if (typed) {
                    for (const e of r.entries) {
                        const s = src.get(e.person.id);
                        if (!s)
                            continue;
                        e.parts = Object.keys(s.reactionTypes).map((k, i) => ({
                            label: k, value: s.reactionTypes[k], color: REACTION_COLORS[i % REACTION_COLORS.length],
                        }));
                    }
                }
                tiles.push(tile(id, o.t("metric.topReactor"), o.t("metric.topReactor.sub"), typed ? "donut" : "bars", r, o.t("unit.reactions")));
                break;
            }
            case "most_appreciated": {
                const r = ranked(s => s.reactionsReceived, s => s.commentsReceived);
                tiles.push(tile(id, o.t("metric.mostAppreciated"), o.t("metric.mostAppreciated.sub"), "bars", r, o.t("unit.received")));
                break;
            }
            case "top_contributor": {
                const r = ranked(s => s.postsAuthored, s => s.reactionsReceived);
                tiles.push(tile(id, o.t("metric.topContributor"), o.t("metric.topContributor.sub"), "bars", r, o.t("unit.posts")));
                break;
            }
            case "rising_star": {
                // Growth, not volume: biggest increase over the preceding window.
                const entries = [];
                if (prevW) {
                    const rows = [];
                    for (const [uid, s] of primary) {
                        const p0 = prev.get(uid);
                        const before = p0 ? activityScore(p0) : 0;
                        const now = activityScore(s);
                        const p = people.get(uid);
                        if (p && now - before > 0)
                            rows.push({ p, now, before });
                    }
                    rows.sort((a, b) => (b.now - b.before) - (a.now - a.before) || b.now - a.now || a.p.name.localeCompare(b.p.name));
                    for (const r of rows.slice(0, o.topN))
                        entries.push({ person: r.p, value: r.now, previous: r.before });
                }
                tiles.push(tile(id, o.t("metric.risingStar"), o.t("metric.risingStar.sub"), "slope", { entries, widened: false }, o.t("unit.actions")));
                break;
            }
            case "advocacy": {
                // Post-level by necessity: the API exposes no per-user share log, and
                // the analytics `groupBy` has no user dimension. We surface the most
                // shared post and credit its author.
                let rows = o.rankings.filter(r => r.shares > 0);
                let didWiden = false;
                if (!rows.length && o.autoWiden) {
                    rows = o.rankingsAllTime.filter(r => r.shares > 0);
                    didWiden = rows.length > 0;
                }
                rows = rows.slice().sort((a, b) => b.shares - a.shares || b.clicks - a.clicks).slice(0, o.topN);
                const postAuthor = new Map(o.raw.posts.map(p => [p.id, p.authorId]));
                const entries = rows.map(r => {
                    const author = people.get(postAuthor.get(r.postId) || "");
                    return {
                        person: author || { id: "", name: r.title || o.t("advocacy.unknownPost"), avatar: "", position: "", department: "", location: "", pronouns: "", headline: "" },
                        value: r.shares,
                        subtitle: r.title,
                        parts: [
                            { label: o.t("part.shares"), value: r.shares, color: o.colors.post },
                            { label: o.t("part.clicks"), value: r.clicks, color: o.colors.breadth },
                        ],
                    };
                });
                tiles.push(tile(id, o.t("metric.advocacy"), o.t("metric.advocacy.sub"), "share_bars", { entries, widened: didWiden }, o.t("unit.shares")));
                break;
            }
        }
    }
    return tiles;
}
const REACTION_COLORS = ["#0EA5E9", "#F59E0B", "#EF4444", "#10B981", "#8B5CF6", "#EC4899"];
function tile(id, title, subtitle, chart, r, unit) {
    return { id, title, subtitle, chart, entries: r.entries, unit, widened: r.widened };
}

;// ./icons.ts
// Authored icon set — one consistent 24px grid, 1.75 stroke, round caps/joins.
// Deliberately not emoji or unicode glyphs: those inherit the host font, render
// differently per platform, and cannot take `currentColor`.
const svg = (body, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const PATHS = {
    chevronLeft: `<path d="M15 5 8 12l7 7"/>`,
    chevronRight: `<path d="m9 5 7 7-7 7"/>`,
    comment: `<path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/>`,
    heart: `<path d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.65 12 20 12 20Z"/>`,
    share: `<path d="M18 8a2.5 2.5 0 1 0-2.45-3L8.9 8.6a2.5 2.5 0 1 0 0 6.8l6.65 3.6A2.5 2.5 0 1 0 18 16"/>`,
    click: `<path d="M9 4v3M4 9h3M6.3 6.3 8 8"/><path d="m11 11 9 3.2-4 1.4-1.4 4Z"/>`,
    pen: `<path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5Z"/><path d="m13.5 6.5 4 4"/>`,
    trophy: `<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M16 5h3v2a3 3 0 0 1-3 3M8 5H5v2a3 3 0 0 0 3 3"/><path d="M12 13v3m-3 4h6"/>`,
    spark: `<path d="M12 4v6m0 4v6M4 12h6m4 0h6"/><path d="m7.5 7.5 3 3m3 3 3 3m0-6-3 3m-3 3-3 3"/>`,
    arrowUp: `<path d="M12 19V6"/><path d="m6 12 6-6 6 6"/>`,
    refresh: `<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v4h-4"/>`,
    people: `<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5M17 14.4A6 6 0 0 1 21 20"/>`,
    play: `<path d="M8 5.5v13l10-6.5Z"/>`,
    pause: `<path d="M9 5v14M15 5v14"/>`,
    // Metric marks. Each metric gets its own silhouette rather than a shared
    // sparkle, so the chapter rail is scannable by shape before it is read.
    pulse: `<path d="M3 12h3.5l2.5-6 4 13 2.5-7H21"/>`,
    target: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>`,
    medal: `<circle cx="12" cy="15" r="5"/><path d="M9.2 10.4 6.5 3M14.8 10.4 17.5 3M9 3h6"/><path d="m12 13 .8 1.7 1.8.2-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.2Z"/>`,
    trendUp: `<path d="M3 17.5 9 11l4 3.5 5-6.5"/><path d="M14.5 8H18v3.5"/>`,
    // States and chrome.
    clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
    history: `<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v4.5h4.5"/><path d="M12 7.5V12l3.2 2"/>`,
    beaker: `<path d="M9.5 3v6.2L4.8 17A2 2 0 0 0 6.5 20h11a2 2 0 0 0 1.7-3l-4.7-7.8V3"/><path d="M8 3h8"/><path d="M6.6 14h10.8"/>`,
    alert: `<path d="M12 4.5 21 19H3Z"/><path d="M12 10v4"/><path d="M12 16.6v.1"/>`,
    inbox: `<path d="M3.5 13.5h4l1.2 2.4h6.6l1.2-2.4h4"/><path d="M5.6 5h12.8l2.1 8.5V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-4.5Z"/>`,
    scatter: `<path d="M4 4v16h16"/><circle cx="9" cy="15" r="1.7"/><circle cx="13" cy="9.5" r="1.7"/><circle cx="17.5" cy="13" r="1.7"/><circle cx="8" cy="8" r="1.2"/>`,
    star: `<path d="m12 4 2.5 5.1 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8Z"/>`,
    bolt: `<path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13Z"/>`,
    flame: `<path d="M12 3s5.5 4.3 5.5 9a5.5 5.5 0 0 1-11 0c0-2 1-3.6 2-4.7.3 1.4 1 2.2 1.8 2.2 1.3 0 1.7-1.6 1.7-6.5Z"/>`,
    eye: `<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/>`,
    check: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
    sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2 7 7M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8"/>`,
    moon: `<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>`,
    pin: `<path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/>`,
    badge: `<path d="M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v15l-7-3.2L5 20V5a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M9 8h6"/>`,
};
function icon(name, size = 18) {
    return svg(PATHS[name] || PATHS.spark, size);
}
/** Which icon represents each metric in the chapter rail and slide header. */
const METRIC_ICON = {
    most_active: "pulse",
    most_engaged: "target",
    top_commenter: "comment",
    top_reactor: "heart",
    advocacy: "share",
    most_appreciated: "medal",
    top_contributor: "pen",
    rising_star: "trendUp",
};

;// ./charts.ts
// ─────────────────────────────────────────────────────────────────────────────
// Charts — hand-rolled HTML/CSS/SVG. No chart library.
//
// The deciding constraint is the avatar: every data point is a person's photo,
// and photos 404 often enough that a gradient-initials fallback is mandatory.
// That fallback is an `<img onerror>`, which only works for real DOM images —
// so canvas (chart.js) is out, and inside SVG the avatars are absolutely
// positioned HTML overlays rather than `<image>` elements, which have no usable
// error-fallback path.
//
// Every tile shares one anatomy so the deck reads as a single broadcast rather
// than eight unrelated widgets:
//
//   champion  — the winner, at full scale, with the headline number
//   field     — the ranked runners-up as avatar-led bars
//   flourish  — one metric-specific graphic that explains *why* they won
//
// Only the flourish changes per metric.
// ─────────────────────────────────────────────────────────────────────────────

const P = "sbel"; // class prefix
function esc(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length)
        return "?";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
    return (first + last).toUpperCase();
}
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString();
/**
 * Avatar markup.
 *
 * Wrapped in `internal-link clickable` + `/profile/<id>` + `data-uid`, which is
 * the markup Staffbase's own author links use — that is what makes the native
 * profile hovercard attach to a chart node instead of leaving it an inert
 * image.
 */
function avatar(e, size, cls = "") {
    const p = e.person;
    const ini = esc(initials(p.name));
    const style = `--av:${size}px`;
    const inner = p.avatar
        ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('${P}-av-fb');this.remove()">`
        : "";
    const body = `<span class="${P}-av ${cls}${p.avatar ? "" : ` ${P}-av-fb`}" style="${style}" data-ini="${ini}">${inner}</span>`;
    if (!p.id)
        return body;
    return `<a class="${P}-avlink internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}" tabindex="-1" aria-label="${esc(p.name)}">${body}</a>`;
}
function personLink(e, cls) {
    const p = e.person;
    return p.id
        ? `<a class="${cls} internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}">${esc(p.name)}</a>`
        : `<span class="${cls}">${esc(p.name)}</span>`;
}
/** Describe the underlying numbers for screen readers — the visual encoding
 *  (bar length, arc angle, slope) conveys nothing to them. */
function ariaLabel(tile) {
    const rows = tile.entries.map((e, i) => `${i + 1}. ${e.person.name}, ${fmt(e.value)} ${tile.unit}`);
    return esc(`${tile.title}. ${rows.join(". ")}`);
}
// ── Champion ─────────────────────────────────────────────────────────────────
/**
 * The winner at full scale. The number carries `data-count` so it can be
 * counted up on reveal; it renders its final value immediately so a failed
 * script never leaves the slide blank.
 */
function champion(tile, size) {
    const e = tile.entries[0];
    if (!e)
        return "";
    const p = e.person;
    const meta = [p.position, p.department].filter(Boolean).join(" · ");
    const av = size === "stage" ? 132 : 64;
    return `<div class="${P}-champ">
    <div class="${P}-champ-av">
      ${avatar(e, av, `${P}-av-hero`)}
      <span class="${P}-crown">${icon("trophy", size === "stage" ? 18 : 14)}</span>
    </div>
    <div class="${P}-champ-txt">
      ${personLink(e, `${P}-champ-nm`)}
      ${meta ? `<span class="${P}-champ-meta">${esc(meta)}</span>` : ""}
      ${e.subtitle && e.subtitle !== meta ? `<span class="${P}-champ-sub">${esc(e.subtitle)}</span>` : ""}
    </div>
    <div class="${P}-champ-num">
      <span class="${P}-num" data-count="${e.value}">${fmt(e.value)}</span>
      <span class="${P}-unit">${esc(tile.unit)}</span>
    </div>
  </div>`;
}
// ── The field ────────────────────────────────────────────────────────────────
/** Ranked runners-up. Bars are scaled against the leader, with a floor so a
 *  runaway winner doesn't flatten everyone else into invisible slivers. */
function field(tile) {
    var _a;
    const rest = tile.entries.slice(1);
    if (!rest.length)
        return "";
    const max = ((_a = tile.entries[0]) === null || _a === void 0 ? void 0 : _a.value) || 1;
    const rows = rest.map((e, i) => `
    <li class="${P}-frow" style="--i:${i}">
      <span class="${P}-rank">${i + 2}</span>
      ${avatar(e, 30)}
      <div class="${P}-frow-body">
        <div class="${P}-frow-top">
          ${personLink(e, `${P}-frow-nm`)}
          <span class="${P}-frow-v">${fmt(e.value)}</span>
        </div>
        <span class="${P}-track"><span class="${P}-fill" style="--w:${Math.max(5, Math.round((e.value / max) * 100))}%"></span></span>
      </div>
    </li>`).join("");
    return `<ol class="${P}-field" role="img" aria-label="${ariaLabel(tile)}">${rows}</ol>`;
}
// ── Flourishes ───────────────────────────────────────────────────────────────
/** Stacked composition bar — decomposes a weighted score so the number is
 *  auditable instead of magic. */
function composition(e, label) {
    const parts = (e.parts || []).filter(x => x.value > 0);
    if (parts.length < 2)
        return "";
    const total = parts.reduce((a, x) => a + x.value, 0) || 1;
    const segs = parts.map((x, i) => `<span class="${P}-cseg" style="--w:${(x.value / total) * 100}%;--d:${i * 70}ms;background:${esc(x.color)}"></span>`).join("");
    const legend = parts.map(x => `<li><i style="background:${esc(x.color)}"></i>${esc(x.label)}<b>${fmt(x.value)}</b></li>`).join("");
    return `<div class="${P}-fl">
    <span class="${P}-fl-h">${esc(label)}</span>
    <div class="${P}-cbar">${segs}</div>
    <ul class="${P}-legend">${legend}</ul>
  </div>`;
}
/**
 * Reaction-type ring. Only meaningful when session auth resolved reaction
 * *types* — under token auth every reaction is an untyped LIKE, where a
 * one-slice donut would say nothing.
 */
function ring(e, label) {
    const parts = (e.parts || []).filter(x => x.value > 0);
    if (parts.length < 2)
        return "";
    const total = parts.reduce((a, x) => a + x.value, 0) || 1;
    const r = 46, c = 2 * Math.PI * r;
    let offset = 0;
    const arcs = parts.map((x, i) => {
        const len = (x.value / total) * c;
        const seg = `<circle class="${P}-arc" cx="60" cy="60" r="${r}" fill="none" stroke="${esc(x.color)}"
      stroke-width="13" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 60 60)" style="--d:${i * 90}ms"
      ><title>${esc(x.label)}: ${fmt(x.value)}</title></circle>`;
        offset += len;
        return seg;
    }).join("");
    const legend = parts.map(x => `<li><i style="background:${esc(x.color)}"></i>${esc(x.label)}<b>${fmt(x.value)}</b></li>`).join("");
    return `<div class="${P}-fl ${P}-fl-ring">
    <span class="${P}-fl-h">${esc(label)}</span>
    <div class="${P}-ringwrap">
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="13"/>
        ${arcs}
      </svg>
      <span class="${P}-ring-mid">${fmt(total)}</span>
    </div>
    <ul class="${P}-legend">${legend}</ul>
  </div>`;
}
/** Growth is a two-point comparison, so a slope is the honest encoding — a bar
 *  of the current value would hide the delta that defines the metric. */
function slope(e, prevLabel, nowLabel) {
    const before = e.previous || 0;
    const now = e.value;
    const max = Math.max(before, now) || 1;
    const W = 200, H = 84, pad = 10;
    const y = (v) => pad + (1 - v / max) * (H - pad * 2);
    return `<div class="${P}-fl">
    <div class="${P}-slope">
      <div class="${P}-slope-plot">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="${P}-sg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="var(--sbel-accent)"/><stop offset="1" stop-color="var(--sbel-primary)"/>
        </linearGradient></defs>
        <path class="${P}-sarea" d="M${pad},${y(before)} L${W - pad},${y(now)} L${W - pad},${H} L${pad},${H} Z"/>
        <line class="${P}-sline" x1="${pad}" y1="${y(before)}" x2="${W - pad}" y2="${y(now)}"
          stroke="url(#${P}-sg)" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <!-- The SVG is stretched with preserveAspectRatio="none" so the line always
           spans the column, which turns any <circle> inside it into an ellipse.
           The endpoint dots are therefore HTML, positioned in percentages over
           the same box — the same reason avatars are never SVG <image> here. -->
      <span class="${P}-sdot ${P}-sdot-a" style="left:${(pad / W) * 100}%;top:${(y(before) / H) * 100}%"></span>
      <span class="${P}-sdot ${P}-sdot-b" style="left:${((W - pad) / W) * 100}%;top:${(y(now) / H) * 100}%"></span>
      </div>
      <div class="${P}-slope-ends">
        <span>${esc(prevLabel)}<b>${fmt(before)}</b></span>
        <span class="${P}-slope-now">${esc(nowLabel)}<b>${fmt(now)}</b></span>
      </div>
    </div>
  </div>`;
}
/** Shares against clicks for the winning post. */
function shareSplit(e) {
    const parts = (e.parts || []).filter(x => x.value > 0);
    if (!parts.length)
        return "";
    const max = Math.max(...parts.map(x => x.value)) || 1;
    const rows = parts.map((x, i) => `
    <li style="--i:${i}">
      <span class="${P}-sl-ic">${icon(i === 0 ? "share" : "click", 15)}</span>
      <span class="${P}-sl-lbl">${esc(x.label)}</span>
      <span class="${P}-track"><span class="${P}-fill" style="--w:${Math.max(5, Math.round((x.value / max) * 100))}%;background:${esc(x.color)}"></span></span>
      <b>${fmt(x.value)}</b>
    </li>`).join("");
    return `<div class="${P}-fl"><ul class="${P}-split">${rows}</ul></div>`;
}
/** The one metric-specific graphic per slide. */
function flourish(tile, L) {
    const e = tile.entries[0];
    if (!e)
        return "";
    switch (tile.chart) {
        case "donut": return ring(e, L.mix);
        case "podium": return composition(e, L.breakdown);
        case "slope": return slope(e, L.previous, L.current);
        case "share_bars": return shareSplit(e);
        default: return "";
    }
}
// ── Engagement map ───────────────────────────────────────────────────────────
/**
 * x = breadth (distinct posts touched), y = volume (total actions), radius ∝
 * score. Avatars are HTML overlays positioned in percentages over an SVG grid.
 */
function bubbleMap(points, label, axisX, axisY) {
    if (points.length < 3)
        return "";
    const maxX = Math.max(...points.map(p => p.x)) || 1;
    const maxY = Math.max(...points.map(p => p.y)) || 1;
    const maxS = Math.max(...points.map(p => p.size)) || 1;
    const nodes = points.map((p, i) => {
        const size = 26 + Math.round((p.size / maxS) * 30);
        const left = 7 + (p.x / maxX) * 84;
        const bottom = 10 + (p.y / maxY) * 78;
        return `<div class="${P}-bub" style="left:${left}%;bottom:${bottom}%;--i:${i}">${avatar(p.entry, size)}</div>`;
    }).join("");
    const grid = [25, 50, 75].map(v => `<line x1="0" y1="${v}" x2="100" y2="${v}"/><line x1="${v}" y1="0" x2="${v}" y2="100"/>`).join("");
    return `<div class="${P}-bubwrap" role="img" aria-label="${esc(label)}">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" class="${P}-bubgrid">${grid}</svg>
    ${nodes}
    <span class="${P}-axis ${P}-axis-x">${esc(axisX)}</span>
    <span class="${P}-axis ${P}-axis-y">${esc(axisY)}</span>
  </div>`;
}

;// ./engagement-leaderboard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Engagement Leaderboard — a broadcast-style deck of engagement metrics
// computed live from branch data.
//
// The Staffbase API exposes no per-user engagement endpoint (the analytics
// `groupBy` enum accepts only `channelId`/`spaceId`, and
// `/branch/analytics/users/rankings` is feature-flag gated), so every
// person-level metric here is derived client-side from one pass over posts,
// reactions and comments. See `api.ts` for the auth ladder and `aggregate.ts`
// for the derivation.
//
// Presentation: the widget renders a dark "stage" lit with the tenant's own
// brand color, showing one champion at a time. A leaderboard is an awards
// broadcast, not a spreadsheet — so the deck rotates like title cards, and the
// motion is one rehearsed reveal rather than scattered effects.
// ─────────────────────────────────────────────────────────────────────────────
var engagement_leaderboard_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};







// ── Defaults ─────────────────────────────────────────────────────────────────
// Ships empty on purpose: the token is a runtime editor value, never a
// committed secret.
const DEFAULT_API_TOKEN = "";
const DEFAULT_BASE_URL = "";
const DEFAULT_PRIMARY_COLOR = "#3DDC97";
const DEFAULT_ACCENT_COLOR = "#7C5CFF";
/** Metric id ⇄ config attribute. Individual booleans rather than a multi-select
 *  array: the editor renders them as plain checkboxes, and an attribute string
 *  cannot silently arrive in a shape the widget has to guess at. */
const METRIC_ATTRS = [
    { id: "most_active", attr: "showmostactive", label: "Most Active" },
    { id: "most_engaged", attr: "showmostengaged", label: "Most Engaged" },
    { id: "top_commenter", attr: "showtopcommenter", label: "Top Commenter" },
    { id: "top_reactor", attr: "showtopreactor", label: "Top Reactor" },
    { id: "most_appreciated", attr: "showmostappreciated", label: "Most Appreciated" },
    { id: "top_contributor", attr: "showtopcontributor", label: "Top Contributor" },
    { id: "rising_star", attr: "showrisingstar", label: "Rising Star" },
    { id: "advocacy", attr: "showadvocacy", label: "Social Advocacy" },
];
const CACHE_PREFIX = "sbel:v2:";
// ── Config schema ────────────────────────────────────────────────────────────
const metricProps = {};
for (const m of METRIC_ATTRS) {
    metricProps[m.attr] = { type: "boolean", title: `Show “${m.label}”`, default: true };
}
const configurationSchema = {
    properties: Object.assign(Object.assign({ apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN }, baseurl: { type: "string", title: "Base URL (e.g. https://acme.staffbase.com/api)", default: DEFAULT_BASE_URL }, authmode: { type: "string", title: "Authentication", enum: ["auto", "token", "session"], default: "auto" }, displaymode: { type: "string", title: "Layout", enum: ["slideshow", "grid"], default: "slideshow" }, colorscheme: { type: "string", title: "Color Scheme", enum: ["dark", "light", "auto"], default: "dark" }, timewindow: {
            type: "string", title: "Time Period",
            enum: ["all", "7d", "30d", "90d", "12m", "custom"], default: "90d",
        }, autowiden: { type: "boolean", title: "Fall Back to All Time When a Period Is Empty", default: true }, showwindowpicker: { type: "boolean", title: "Let Viewers Change the Period", default: true } }, metricProps), { topn: { type: "number", title: "People Per Metric", default: 5 }, channels: { type: "string", title: "Limit to Channel IDs (comma-separated)", default: "" }, excludeuserids: { type: "string", title: "Exclude User IDs (comma-separated)", default: "" }, maxposts: { type: "number", title: "Max Posts to Scan", default: 200 }, cachettl: { type: "number", title: "Cache Lifetime (minutes)", default: 15 }, showbubblemap: { type: "boolean", title: "Show Engagement Map", default: false }, animate: { type: "boolean", title: "Animate", default: true }, usethemecolors: { type: "boolean", title: "Use Theme Colors", default: true }, showsample: { type: "boolean", title: "Show Sample Data When Unconfigured", default: true }, debugmode: { type: "boolean", title: "Debug Mode (on-screen logs)", default: false } }),
    dependencies: {
        usethemecolors: {
            oneOf: [
                {
                    properties: {
                        usethemecolors: { const: false },
                        primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY_COLOR },
                        accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT_COLOR },
                    },
                },
                { properties: { usethemecolors: { const: true } } },
            ],
        },
        // Auto-advance only exists in the rotating layout.
        displaymode: {
            oneOf: [
                { properties: { displaymode: { const: "grid" } } },
                {
                    properties: {
                        displaymode: { const: "slideshow" },
                        autoplay: { type: "boolean", title: "Advance Automatically", default: true },
                        autoplayseconds: { type: "number", title: "Seconds Per Metric", default: 8 },
                    },
                },
            ],
        },
        // Custom ranges are the only case that needs explicit dates.
        timewindow: {
            oneOf: [
                { properties: { timewindow: { enum: ["all", "7d", "30d", "90d", "12m"] } } },
                {
                    properties: {
                        timewindow: { const: "custom" },
                        customsince: { type: "string", title: "From (YYYY-MM-DD)", default: "" },
                        customuntil: { type: "string", title: "To (YYYY-MM-DD)", default: "" },
                    },
                },
            ],
        },
    },
};
// Left unannotated: the widget SDK bundles its own copy of the rjsf UiSchema
// type, so an explicit annotation from @rjsf/utils is a nominal mismatch.
const uiSchema = {
    apitoken: { "ui:help": "Basic API token. Stored in the widget configuration, not in source." },
    baseurl: { "ui:help": "Must include /api, e.g. https://acme.staffbase.com/api" },
    authmode: { "ui:help": "Auto uses the API token first and upgrades to the signed-in session where that unlocks richer data." },
    displaymode: { "ui:help": "Slideshow rotates one metric at a time. Grid shows them all at once." },
    colorscheme: { "ui:help": "Auto follows the viewer's device setting." },
    maxposts: { "ui:help": "Each post costs one extra request for its reaction list. Lower this on large branches." },
    usethemecolors: { "ui:help": "Pulls your brand colors from the branding theme." },
};
// ── Color helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
    return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}
/** Black or white, whichever reads on the given fill. */
function readableOn(hex) {
    const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const l = 0.2126 * lin(parseInt(h.slice(0, 2), 16) / 255)
        + 0.7152 * lin(parseInt(h.slice(2, 4), 16) / 255)
        + 0.0722 * lin(parseInt(h.slice(4, 6), 16) / 255);
    return l > 0.45 ? "#0B0D12" : "#FFFFFF";
}
// ── Sample data ──────────────────────────────────────────────────────────────
/** So the editor and preview always render something. Clearly badged. */
function sampleRaw() {
    const names = [
        "Nicole Adams", "Davide Bonchamp", "Fred Duchamp", "Henry Fitz",
        "Frank Fox", "Maria Apathangelou", "Kay Lion", "Edward Hall",
    ];
    const people = names.map((n, i) => ({
        id: `u${i}`, name: n, avatar: "",
        position: ["Field Engineer", "Brand Designer", "Data Analyst", "Regional Manager"][i % 4],
        department: ["Product", "Operations", "Retail"][i % 3],
        location: "", pronouns: "", headline: "",
    }));
    const now = Date.now();
    const events = [];
    const posts = [];
    for (let p = 0; p < 12; p++) {
        const author = people[p % people.length];
        const at = new Date(now - p * 3 * 86400000).toISOString();
        posts.push({ id: `p${p}`, authorId: author.id, channelId: `c${p % 3}`, created: at, published: at, title: `Sample post ${p + 1}`, likingEnabled: true });
        events.push({ kind: "post", userId: author.id, postId: `p${p}`, channelId: `c${p % 3}`, at });
        for (let u = 0; u < people.length; u++) {
            if ((u * 7 + p * 3) % 5 === 0)
                continue;
            const t = new Date(now - (p * 3 + (u % 4)) * 86400000).toISOString();
            events.push({ kind: "reaction", userId: people[u].id, postId: `p${p}`, channelId: `c${p % 3}`, at: t });
            if ((u + p) % 4 === 0)
                events.push({ kind: "comment", userId: people[u].id, postId: `p${p}`, channelId: `c${p % 3}`, at: t });
        }
    }
    const rankings = posts.slice(0, 5).map((p, i) => ({
        postId: p.id, channelId: p.channelId, title: p.title,
        shares: 29 - i * 6, clicks: 18 - i * 4, comments: 4, likes: 12, visitors: 40 - i * 5,
    }));
    return { events, posts, people, rankings, skippedPosts: 0, skipped: [], typedReactions: false, fetchedAt: now };
}
// ── Styles ───────────────────────────────────────────────────────────────────
/**
 * Staffbase ships global element rules that reach inside widgets. The ones that
 * actually bite: `button { width: 90%; margin: auto }`, a blue/red button
 * background on `:hover/:focus/:active`, `button { color:#fff }`, and list and
 * heading margins. Their selectors are low-specificity but not `!important`, so
 * a prefixed descendant selector plus `!important` on exactly those properties
 * wins without turning the whole stylesheet into an override pile.
 */
/* Staffbase ships page-level rules that reach into widget markup. They are not
   !important, but `button:hover` outranks a single-class widget rule, so the
   reset has to be split in two:

   1. Base defaults — everything, stated once on `.<p>-root button`. Kept at low
      specificity (one class + one element) precisely so the widget's own
      component rules can override them normally.
   2. Per-state neutralisation — ONLY the three properties Staffbase actually
      re-declares on :hover/:focus/:active (background, color, box-shadow) plus
      the focus outline.

   Geometry deliberately does NOT appear in (2). Staffbase sets `width:90%` and
   `margin:auto` on the base button rule only, so neutralising them once in (1)
   is enough — whereas repeating them per state raises the specificity above the
   widget's own component rules, which collapsed the round nav buttons into tall
   rounded slivers the moment they were hovered or pressed. */
const HOST_RESET = `
.${(/* inlined export .P */"sbel")}-root button{
  width:auto!important;min-width:0!important;margin:0!important;
  background:none!important;border:0!important;box-shadow:none!important;
  color:inherit!important;font-family:inherit!important;line-height:normal!important;
  text-transform:none!important;letter-spacing:inherit!important;outline:none!important;
  padding:0;border-radius:0;cursor:pointer;-webkit-appearance:none;appearance:none;
  -webkit-tap-highlight-color:transparent;display:inline-flex;align-items:center;justify-content:center}
.${(/* inlined export .P */"sbel")}-root button:hover,
.${(/* inlined export .P */"sbel")}-root button:focus,
.${(/* inlined export .P */"sbel")}-root button:focus-visible,
.${(/* inlined export .P */"sbel")}-root button:active{
  background:none!important;box-shadow:none!important;color:inherit!important;
  outline:none!important}
.${(/* inlined export .P */"sbel")}-root select{font-family:inherit!important;width:auto!important;margin:0!important;
  -webkit-appearance:none;appearance:none}
.${(/* inlined export .P */"sbel")}-root a,.${(/* inlined export .P */"sbel")}-root a:hover,.${(/* inlined export .P */"sbel")}-root a:focus,.${(/* inlined export .P */"sbel")}-root a:active{
  color:inherit!important;text-decoration:none!important;background:none!important}
.${(/* inlined export .P */"sbel")}-root ol,.${(/* inlined export .P */"sbel")}-root ul{list-style:none!important;margin:0!important;padding:0!important}
.${(/* inlined export .P */"sbel")}-root li{margin:0!important;padding:0!important;list-style:none!important}
.${(/* inlined export .P */"sbel")}-root h1,.${(/* inlined export .P */"sbel")}-root h2,.${(/* inlined export .P */"sbel")}-root h3,.${(/* inlined export .P */"sbel")}-root h4,.${(/* inlined export .P */"sbel")}-root h5,.${(/* inlined export .P */"sbel")}-root h6,
.${(/* inlined export .P */"sbel")}-root p,.${(/* inlined export .P */"sbel")}-root figure{
  margin:0!important;padding:0!important;font-family:inherit!important}
/* Staffbase's rich-text styling reaches in with a rule roughly six classes deep:
   .css-<hash>-StyledRichText-getWowRichTextCss p:not(...):not(...)...
   Out-specifying that is not practical, but it carries no !important, so pinning
   the properties it sets wins outright. It is scoped to a bare p element, so
   that is the entire blast radius — without it every paragraph in the widget
   is forced to 16px/26px in #171719, invisible on the dark stage. */
.${(/* inlined export .P */"sbel")}-root p{
  color:inherit!important;font-size:inherit!important;font-weight:inherit!important;
  font-style:normal!important;line-height:inherit!important}
.${(/* inlined export .P */"sbel")}-root img{max-width:none!important;margin:0!important;border-radius:0}
.${(/* inlined export .P */"sbel")}-root svg{display:block;overflow:visible}
.${(/* inlined export .P */"sbel")}-root *,.${(/* inlined export .P */"sbel")}-root *::before,.${(/* inlined export .P */"sbel")}-root *::after{box-sizing:border-box}
`;
const CSS = `
${HOST_RESET}

/* Every surface value is a token, and --tint is the one that makes two schemes
   possible from a single stylesheet: it is the colour laid over the background
   at low alpha to make panels, tracks and hairlines. On the dark stage that is
   white; on the light stage it is near-black. Everything that used a literal
   rgba(255,255,255,x) now reads rgba(var(--tint),x) and simply inverts. */
.${(/* inlined export .P */"sbel")}-root{
  --tint:255,255,255;
  --bg:#0B0D12;
  --bg-2:#12161F;
  --panel:rgba(var(--tint),.045);
  --line:rgba(var(--tint),.10);
  --ink:#F2F5FA;
  --ink-2:#9AA6BD;
  --opt-bg:#141821;
  --warn:#FFD9A0;
  --wash-1:.30;
  --wash-2:.26;
  --glow-a:.24;
  --grain-a:.5;
  --grain-c:.055;
  --num-glow:.45;
  --drop:0 24px 60px -24px rgba(0,0,0,.7);
  --inset:0 2px 0 0 rgba(255,255,255,.05) inset;
  --hero-shadow:0 22px 45px -18px rgba(0,0,0,.9);
  --p-rgb:var(--sbel-primary-rgb);
  --r:20px;--r-sm:12px;
  font-family:inherit;
  color:var(--ink);
  position:relative;
  border-radius:var(--r);
  background:
    radial-gradient(120% 90% at 88% -10%,rgba(var(--sbel-accent-rgb),var(--wash-1)),transparent 62%),
    radial-gradient(95% 80% at 6% 4%,rgba(var(--p-rgb),var(--wash-2)),transparent 60%),
    linear-gradient(180deg,var(--bg-2) 0%,var(--bg) 58%);
  box-shadow:var(--drop),var(--inset);
  overflow:hidden;
  isolation:isolate;
  -webkit-font-smoothing:antialiased;
}

/* Light scheme. Deliberately not a straight inversion: the brand washes and the
   ambient glow are pulled right back, because the same intensity that reads as
   atmosphere on black reads as a stain on white. */
.${(/* inlined export .P */"sbel")}-root.${(/* inlined export .P */"sbel")}-light{
  --tint:16,22,34;
  --bg:#FFFFFF;
  --bg-2:#F6F8FC;
  --panel:rgba(var(--tint),.035);
  --line:rgba(var(--tint),.13);
  --ink:#0E1420;
  --ink-2:#5B6880;
  --opt-bg:#FFFFFF;
  --shade:16,22,34;
  --warn:#8A5300;
  --wash-1:.13;
  --wash-2:.11;
  --glow-a:.13;
  --grain-a:.35;
  --grain-c:.05;
  --num-glow:0;
  --drop:0 18px 44px -22px rgba(16,22,34,.30);
  --inset:0 0 0 1px rgba(var(--tint),.09) inset;
  --hero-shadow:0 18px 38px -18px rgba(16,22,34,.45);
}

/* Ambient stage light. Purely atmospheric, so it stops whenever the widget is
   offscreen or the tab is hidden rather than burning a phone battery. */
.${(/* inlined export .P */"sbel")}-glow{
  position:absolute;inset:-30% -10% auto -10%;height:78%;z-index:0;pointer-events:none;
  background:radial-gradient(50% 50% at 50% 50%,rgba(var(--p-rgb),var(--glow-a)),transparent 70%);
  filter:blur(28px);opacity:.9}
.${(/* inlined export .P */"sbel")}-live .${(/* inlined export .P */"sbel")}-glow{animation:${(/* inlined export .P */"sbel")}-drift 19s ease-in-out infinite alternate}
@keyframes ${(/* inlined export .P */"sbel")}-drift{
  from{transform:translate3d(-7%,0,0) scale(1)}
  to{transform:translate3d(9%,4%,0) scale(1.16)}}

.${(/* inlined export .P */"sbel")}-grain{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:var(--grain-a);
  background-image:radial-gradient(rgba(var(--tint),var(--grain-c)) 1px,transparent 1px);
  background-size:3px 3px;mix-blend-mode:overlay}

.${(/* inlined export .P */"sbel")}-inner{position:relative;z-index:1;padding:26px 28px 22px}

/* ── Header ─────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"sbel")}-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:20px}
.${(/* inlined export .P */"sbel")}-eyebrow{display:flex;align-items:center;gap:9px;flex:1 1 auto;min-width:0}
.${(/* inlined export .P */"sbel")}-mark{width:9px;height:26px;border-radius:99px;flex:0 0 auto;
  background:linear-gradient(180deg,var(--sbel-primary),var(--sbel-accent));
  box-shadow:0 0 18px rgba(var(--p-rgb),.65)}
.${(/* inlined export .P */"sbel")}-h{font-size:16px;font-weight:650;letter-spacing:-.012em;color:var(--ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.${(/* inlined export .P */"sbel")}-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;
  border-radius:99px;border:1px solid var(--line);background:var(--panel);
  color:var(--ink-2);font-size:11.5px;font-weight:600;letter-spacing:.01em;white-space:nowrap}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-ctl{width:30px!important;height:30px;border-radius:99px;
  border:1px solid var(--line)!important;background:var(--panel)!important;color:var(--ink-2)!important;
  transition:color .18s,border-color .18s,background .18s,transform .18s}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-ctl:hover{color:var(--ink)!important;border-color:rgba(var(--p-rgb),.65)!important;
  background:rgba(var(--p-rgb),.14)!important}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-ctl:active{transform:scale(.93)}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-ctl:focus-visible{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--sbel-primary)!important}
.${(/* inlined export .P */"sbel")}-root select.${(/* inlined export .P */"sbel")}-sel{height:30px;padding:0 26px 0 11px;border-radius:99px;
  border:1px solid var(--line);background:var(--panel);color:var(--ink-2);
  font-size:11.5px;font-weight:600;cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);
  background-position:calc(100% - 13px) 13px,calc(100% - 9px) 13px;
  background-size:4px 4px,4px 4px;background-repeat:no-repeat}
.${(/* inlined export .P */"sbel")}-root select.${(/* inlined export .P */"sbel")}-sel:hover{color:var(--ink);border-color:rgba(var(--p-rgb),.6)}
.${(/* inlined export .P */"sbel")}-root select.${(/* inlined export .P */"sbel")}-sel option{background:var(--opt-bg);color:var(--ink)}

.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-range{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-range label{display:inline-flex;align-items:center;gap:6px;
  font-size:11px;font-weight:600;color:var(--ink-2);letter-spacing:.02em}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-range input[type="date"]{
  font-family:inherit!important;font-size:12px;height:30px;padding:0 9px!important;
  width:auto!important;margin:0!important;border-radius:99px;
  border:1px solid var(--line)!important;background:var(--panel)!important;
  color:var(--ink)!important;-webkit-appearance:none;appearance:none;
  color-scheme:dark;cursor:pointer}
.${(/* inlined export .P */"sbel")}-root.${(/* inlined export .P */"sbel")}-light .${(/* inlined export .P */"sbel")}-range input[type="date"]{color-scheme:light}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-range input[type="date"]:hover{border-color:rgba(var(--p-rgb),.6)!important}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-range input[type="date"]:focus-visible{
  outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--sbel-primary)!important}
.${(/* inlined export .P */"sbel")}-range[hidden]{display:none}

/* ── Chapter rail ───────────────────────────────────────────────────────── */
/* The rail scrolls when the metrics outrun the width. The mask ends are driven
   from JS rather than hard-coded, so a rail that fits is never clipped and one
   that overflows always says so at the edge it can still scroll toward. */
.${(/* inlined export .P */"sbel")}-rail{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 0 18px;
  padding-bottom:2px;scroll-snap-type:x proximity;--f0:0px;--f1:0px;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 var(--f0),
    #000 calc(100% - var(--f1)),transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 var(--f0),
    #000 calc(100% - var(--f1)),transparent 100%)}
.${(/* inlined export .P */"sbel")}-rail::-webkit-scrollbar{display:none}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-tab{flex:0 0 auto;gap:7px;height:32px;padding:0 13px!important;border-radius:99px;
  border:1px solid transparent!important;background:var(--panel)!important;color:var(--ink-2)!important;
  font-size:12px!important;font-weight:600;letter-spacing:-.005em;white-space:nowrap;
  scroll-snap-align:start;transition:color .2s,background .2s,border-color .2s}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-tab:hover{color:var(--ink)!important;background:rgba(var(--tint),.09)!important}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-tab[aria-selected="true"]{
  background:rgba(var(--p-rgb),.16)!important;color:var(--ink)!important;
  border-color:rgba(var(--p-rgb),.55)!important;box-shadow:0 0 20px -6px rgba(var(--p-rgb),.8)!important}
.${(/* inlined export .P */"sbel")}-tab svg{opacity:.8}
.${(/* inlined export .P */"sbel")}-tab[aria-selected="true"] svg{opacity:1;color:var(--sbel-primary)}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-tab:focus-visible{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--sbel-primary)!important}

/* ── Deck ───────────────────────────────────────────────────────────────── */
/* Slides stack in one grid cell so a slide can cross-fade over its predecessor.
   Stacking alone would make the deck as tall as its *tallest* slide, which left
   a lot of dead space under the short ones — so the height is driven to the
   active slide in JS and eased, giving neither a jump nor a void. */
/* clip + clip-margin lets the champion's glow and the reveal's blur spill a
   little past the box that is being height-animated; overflow:hidden is the
   fallback where clip-margin is unsupported. */
.${(/* inlined export .P */"sbel")}-deck{display:grid;position:relative;overflow:hidden;overflow:clip;
  overflow-clip-margin:28px;transition:height .42s cubic-bezier(.22,1,.36,1)}
.${(/* inlined export .P */"sbel")}-deck>*{grid-area:1/1;align-self:start}
.${(/* inlined export .P */"sbel")}-slide{opacity:0;visibility:hidden;pointer-events:none}
.${(/* inlined export .P */"sbel")}-slide.is-on{opacity:1;visibility:visible;pointer-events:auto}

.${(/* inlined export .P */"sbel")}-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.${(/* inlined export .P */"sbel")}-grid .${(/* inlined export .P */"sbel")}-slide{opacity:1;visibility:visible;pointer-events:auto;
  border:1px solid var(--line);border-radius:var(--r-sm);background:var(--panel);padding:18px}
.${(/* inlined export .P */"sbel")}-grid{position:static;overflow:visible;height:auto!important;transition:none}
.${(/* inlined export .P */"sbel")}-grid>*{grid-area:auto;align-self:stretch}

/* ── Slide anatomy ──────────────────────────────────────────────────────── */
.${(/* inlined export .P */"sbel")}-shead{display:flex;align-items:center;gap:9px;margin-bottom:4px}
.${(/* inlined export .P */"sbel")}-shead-ic{display:inline-flex;width:26px;height:26px;border-radius:8px;align-items:center;
  justify-content:center;color:var(--sbel-primary);background:rgba(var(--p-rgb),.14);
  border:1px solid rgba(var(--p-rgb),.3);flex:0 0 auto}
.${(/* inlined export .P */"sbel")}-stitle{font-size:19px;font-weight:700;letter-spacing:-.022em;color:var(--ink)}
/* <p> and <ul> both get margin:0!important from the host reset above, so every
   spacing rule on a caption or legend must out-specify it or it is a no-op. */
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-ssub{letter-spacing:-.003em;
  font-size:12.5px!important;color:var(--ink-2)!important;line-height:1.45!important;
  margin:0 0 22px!important;padding-bottom:2px!important}

.${(/* inlined export .P */"sbel")}-body{display:grid;gap:26px;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);align-items:start}
.${(/* inlined export .P */"sbel")}-grid .${(/* inlined export .P */"sbel")}-body{grid-template-columns:1fr;gap:16px}

/* Champion */
.${(/* inlined export .P */"sbel")}-champ{display:grid;grid-template-columns:auto 1fr;gap:14px 16px;align-items:center}
/* width:max-content keeps the crown pinned to the avatar's own edge — without it
   the wrapper stretches to the grid column and the crown drifts off to the far
   right once the champion stacks on narrow screens. */
.${(/* inlined export .P */"sbel")}-champ-av{position:relative;grid-row:span 2;width:max-content;justify-self:start}
.${(/* inlined export .P */"sbel")}-champ-txt{align-self:end}
.${(/* inlined export .P */"sbel")}-champ-nm{display:block;font-size:20px;font-weight:700;letter-spacing:-.022em;
  color:var(--ink)!important;line-height:1.15}
a.${(/* inlined export .P */"sbel")}-champ-nm:hover{text-decoration:underline!important;text-underline-offset:3px}
.${(/* inlined export .P */"sbel")}-champ-meta,.${(/* inlined export .P */"sbel")}-champ-sub{display:block;font-size:12.5px;color:var(--ink-2);margin-top:3px;
  overflow:hidden;text-overflow:ellipsis}
.${(/* inlined export .P */"sbel")}-champ-sub{color:var(--sbel-primary);font-weight:600}
.${(/* inlined export .P */"sbel")}-champ-num{grid-column:2;align-self:start;display:flex;align-items:baseline;gap:8px}
.${(/* inlined export .P */"sbel")}-num{font-size:clamp(44px,7vw,72px);font-weight:800;line-height:.9;letter-spacing:-.055em;
  color:var(--ink);font-variant-numeric:tabular-nums;
  text-shadow:0 0 40px rgba(var(--p-rgb),var(--num-glow))}
.${(/* inlined export .P */"sbel")}-unit{font-size:12px;font-weight:600;color:var(--ink-2);letter-spacing:.02em}
.${(/* inlined export .P */"sbel")}-grid .${(/* inlined export .P */"sbel")}-num{font-size:38px}
.${(/* inlined export .P */"sbel")}-grid .${(/* inlined export .P */"sbel")}-champ-nm{font-size:16px}

.${(/* inlined export .P */"sbel")}-crown{position:absolute;right:-2px;bottom:-2px;width:30px;height:30px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  /* Solid primary, not the primary->accent gradient: the glyph colour is
     computed for contrast against primary alone, and on the gradient's accent
     end that pairing stopped holding up. */
  background:var(--sbel-primary);
  color:var(--sbel-primary-text);border:2.5px solid var(--bg);
  box-shadow:0 6px 16px -4px rgba(var(--p-rgb),.9)}
.${(/* inlined export .P */"sbel")}-grid .${(/* inlined export .P */"sbel")}-crown{width:24px;height:24px}

/* Avatars */
.${(/* inlined export .P */"sbel")}-av{position:relative;display:inline-flex;align-items:center;justify-content:center;
  width:var(--av);height:var(--av);border-radius:50%;overflow:hidden;flex:0 0 auto;
  background:rgba(var(--tint),.07);color:var(--sbel-primary-text);font-weight:700;
  font-size:calc(var(--av)*.36);letter-spacing:-.02em}
.${(/* inlined export .P */"sbel")}-av img{width:100%;height:100%;object-fit:cover;display:block}
.${(/* inlined export .P */"sbel")}-av-fb{background:linear-gradient(140deg,var(--sbel-primary),var(--sbel-accent));
  color:var(--sbel-primary-text)}
.${(/* inlined export .P */"sbel")}-av-fb::after{content:attr(data-ini)}
.${(/* inlined export .P */"sbel")}-av-hero{box-shadow:0 0 0 2px rgba(var(--p-rgb),.55),0 0 0 7px rgba(var(--p-rgb),.14),
  var(--hero-shadow)}
/* Profile hovercard. Rendered on <body> so the deck's slide transforms cannot
   re-base its position:fixed — it therefore inherits no scheme tokens and gets
   them copied on at show time. */
.${(/* inlined export .P */"sbel")}-hover{position:fixed;z-index:2147483000;display:flex;gap:11px;align-items:center;
  max-width:290px;padding:12px 14px;border-radius:14px;pointer-events:auto;
  background:linear-gradient(180deg,var(--bg-2,#12161F),var(--bg,#0B0D12));
  border:1px solid var(--line,rgba(255,255,255,.10));
  box-shadow:var(--drop,0 24px 60px -24px rgba(0,0,0,.7));
  color:var(--ink,#F2F5FA);font-family:inherit;
  opacity:0;transform:translateY(4px) scale(.97);transform-origin:50% 100%;
  transition:opacity .16s ease,transform .16s cubic-bezier(.16,1,.3,1);
  visibility:hidden}
.${(/* inlined export .P */"sbel")}-hover.is-on{opacity:1;transform:none;visibility:visible}
.${(/* inlined export .P */"sbel")}-hover-txt{min-width:0}
.${(/* inlined export .P */"sbel")}-hover strong{display:block;font-size:14px;font-weight:700;line-height:1.25;
  letter-spacing:-.01em;color:var(--ink,#F2F5FA)}
.${(/* inlined export .P */"sbel")}-hover ul{list-style:none;margin:5px 0 0;padding:0;display:grid;gap:3px}
.${(/* inlined export .P */"sbel")}-hover li{display:flex;gap:6px;align-items:center;font-size:11.5px;line-height:1.35;
  color:var(--ink-2,#9AA6BD)}
.${(/* inlined export .P */"sbel")}-hover li svg{flex:0 0 auto;opacity:.75}
.${(/* inlined export .P */"sbel")}-hover li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (prefers-reduced-motion:reduce){.${(/* inlined export .P */"sbel")}-hover{transition:none}}
.${(/* inlined export .P */"sbel")}-avlink{display:inline-flex;border-radius:50%}
.${(/* inlined export .P */"sbel")}-avlink:focus-visible{outline:2px solid var(--sbel-primary);outline-offset:3px}

/* The field */
.${(/* inlined export .P */"sbel")}-field{display:flex;flex-direction:column;gap:11px}
.${(/* inlined export .P */"sbel")}-frow{display:flex;align-items:center;gap:11px;min-width:0}
.${(/* inlined export .P */"sbel")}-rank{flex:0 0 14px;font-size:11px;font-weight:700;color:var(--ink-2);
  font-variant-numeric:tabular-nums;text-align:right}
.${(/* inlined export .P */"sbel")}-frow-body{flex:1 1 auto;min-width:0}
.${(/* inlined export .P */"sbel")}-frow-top{display:flex;align-items:baseline;gap:10px;margin-bottom:5px}
.${(/* inlined export .P */"sbel")}-frow-nm{flex:1 1 auto;min-width:0;font-size:13px;font-weight:600;color:var(--ink)!important;
  letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
a.${(/* inlined export .P */"sbel")}-frow-nm:hover{text-decoration:underline!important;text-underline-offset:3px}
.${(/* inlined export .P */"sbel")}-frow-v{flex:0 0 auto;font-size:12.5px;font-weight:700;color:var(--ink-2);
  font-variant-numeric:tabular-nums}
.${(/* inlined export .P */"sbel")}-track{display:block;height:6px;border-radius:99px;background:rgba(var(--tint),.08);
  overflow:hidden}
.${(/* inlined export .P */"sbel")}-fill{display:block;height:100%;width:var(--w);border-radius:99px;
  background:linear-gradient(90deg,rgba(var(--p-rgb),.55),var(--sbel-primary))}

/* Flourish */
.${(/* inlined export .P */"sbel")}-fl{margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}
.${(/* inlined export .P */"sbel")}-body>.${(/* inlined export .P */"sbel")}-fl:first-child{margin-top:0;padding-top:0;border-top:0}
.${(/* inlined export .P */"sbel")}-fl-h{display:block;font-size:10.5px;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:11px}
.${(/* inlined export .P */"sbel")}-cbar{display:flex;height:10px;border-radius:99px;overflow:hidden;background:rgba(var(--tint),.08)}
.${(/* inlined export .P */"sbel")}-cseg{display:block;width:var(--w)}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-legend{display:flex;flex-wrap:wrap;gap:6px 16px;
  margin:11px 0 0!important;padding-bottom:14px!important;
  font-size:11.5px;color:var(--ink-2)}
.${(/* inlined export .P */"sbel")}-legend li{display:flex;align-items:center;gap:6px}
.${(/* inlined export .P */"sbel")}-legend i{width:7px;height:7px;border-radius:2px;flex:0 0 auto}
.${(/* inlined export .P */"sbel")}-legend b{color:var(--ink);font-variant-numeric:tabular-nums}

.${(/* inlined export .P */"sbel")}-fl-ring{display:grid;grid-template-columns:auto 1fr;gap:4px 18px;align-items:center}
.${(/* inlined export .P */"sbel")}-fl-ring .${(/* inlined export .P */"sbel")}-fl-h{grid-column:1/-1}
.${(/* inlined export .P */"sbel")}-ringwrap{position:relative;display:inline-flex}
.${(/* inlined export .P */"sbel")}-ring-mid{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:22px;font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.${(/* inlined export .P */"sbel")}-fl-ring .${(/* inlined export .P */"sbel")}-legend{flex-direction:column;gap:7px}

.${(/* inlined export .P */"sbel")}-slope-plot{position:relative}
.${(/* inlined export .P */"sbel")}-slope svg{width:100%;height:84px;display:block}
.${(/* inlined export .P */"sbel")}-sdot{position:absolute;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
.${(/* inlined export .P */"sbel")}-sdot-a{width:8px;height:8px;background:var(--sbel-accent)}
.${(/* inlined export .P */"sbel")}-sdot-b{width:11px;height:11px;background:var(--sbel-primary);
  box-shadow:0 0 0 4px rgba(var(--p-rgb),.20)}
.${(/* inlined export .P */"sbel")}-sarea{fill:rgba(var(--p-rgb),.14)}
.${(/* inlined export .P */"sbel")}-slope-ends{display:flex;justify-content:space-between;margin-top:8px;font-size:11px;
  color:var(--ink-2)}
.${(/* inlined export .P */"sbel")}-slope-ends span{display:flex;flex-direction:column;gap:2px}
.${(/* inlined export .P */"sbel")}-slope-ends b{font-size:17px;font-weight:800;color:var(--ink);letter-spacing:-.03em;
  font-variant-numeric:tabular-nums}
.${(/* inlined export .P */"sbel")}-slope-now{text-align:right}
.${(/* inlined export .P */"sbel")}-slope-now b{color:var(--sbel-primary)}

.${(/* inlined export .P */"sbel")}-split{display:flex;flex-direction:column;gap:11px}
.${(/* inlined export .P */"sbel")}-split li{display:flex;align-items:center;gap:10px;font-size:11.5px;color:var(--ink-2)}
.${(/* inlined export .P */"sbel")}-sl-ic{display:inline-flex;color:var(--sbel-primary);flex:0 0 auto}
.${(/* inlined export .P */"sbel")}-sl-lbl{flex:0 0 52px}
.${(/* inlined export .P */"sbel")}-split .${(/* inlined export .P */"sbel")}-track{flex:1 1 auto}
.${(/* inlined export .P */"sbel")}-split b{flex:0 0 auto;font-size:13px;color:var(--ink);font-variant-numeric:tabular-nums}

/* Engagement map */
.${(/* inlined export .P */"sbel")}-bubwrap{position:relative;height:260px;margin-top:10px}
.${(/* inlined export .P */"sbel")}-bubgrid{position:absolute;inset:0;width:100%;height:100%;stroke:rgba(var(--tint),.07);
  stroke-width:.35}
.${(/* inlined export .P */"sbel")}-bub{position:absolute;transform:translate(-50%,50%)}
.${(/* inlined export .P */"sbel")}-axis{position:absolute;font-size:10px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-2)}
.${(/* inlined export .P */"sbel")}-axis-x{right:0;bottom:-6px}
.${(/* inlined export .P */"sbel")}-axis-y{left:-2px;top:-6px}

/* ── Footer ─────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"sbel")}-foot{display:flex;align-items:center;gap:12px;margin-top:22px;padding-top:16px;
  border-top:1px solid var(--line)}
.${(/* inlined export .P */"sbel")}-dots{display:flex;gap:6px;flex:1 1 auto;flex-wrap:wrap}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-dot{width:20px!important;height:14px;padding:0!important;border-radius:99px}
.${(/* inlined export .P */"sbel")}-dot::after{content:"";display:block;width:100%;height:3px;border-radius:99px;
  background:rgba(var(--tint),.18);transition:background .25s}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-dot:hover::after{background:rgba(var(--tint),.4)}
.${(/* inlined export .P */"sbel")}-dot[aria-selected="true"]::after{background:var(--sbel-primary);
  box-shadow:0 0 12px rgba(var(--p-rgb),.9)}
.${(/* inlined export .P */"sbel")}-count{font-size:11px;font-weight:700;color:var(--ink-2);font-variant-numeric:tabular-nums;
  letter-spacing:.04em}
.${(/* inlined export .P */"sbel")}-nav{display:flex;gap:7px;flex:0 0 auto}

/* Autoplay progress — a hairline across the top of the stage. */
.${(/* inlined export .P */"sbel")}-prog{position:absolute;top:0;left:0;right:0;height:2px;z-index:2;background:transparent}
.${(/* inlined export .P */"sbel")}-prog span{display:block;height:100%;width:0;
  background:linear-gradient(90deg,var(--sbel-accent),var(--sbel-primary));
  box-shadow:0 0 12px rgba(var(--p-rgb),.8)}
.${(/* inlined export .P */"sbel")}-prog.run span{animation:${(/* inlined export .P */"sbel")}-prog var(--dur) linear forwards}
@keyframes ${(/* inlined export .P */"sbel")}-prog{from{width:0}to{width:100%}}

/* ── States ─────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"sbel")}-note{display:inline-flex;align-items:center;gap:7px;margin-bottom:14px;padding:6px 11px;
  border-radius:99px;font-size:11.5px;font-weight:600;color:var(--warn);
  background:rgba(255,176,60,.11);border:1px solid rgba(255,176,60,.28)}
.${(/* inlined export .P */"sbel")}-empty{padding:44px 10px;text-align:center;color:var(--ink-2);font-size:13px;
  display:flex;flex-direction:column;align-items:center;gap:12px}
.${(/* inlined export .P */"sbel")}-empty svg{opacity:.5}
.${(/* inlined export .P */"sbel")}-root .${(/* inlined export .P */"sbel")}-empty p{font-size:13px!important;color:var(--ink-2)!important;line-height:1.5!important}
.${(/* inlined export .P */"sbel")}-sk{border-radius:var(--r-sm);background:rgba(var(--tint),.05);position:relative;overflow:hidden}
.${(/* inlined export .P */"sbel")}-sk::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
  background:linear-gradient(90deg,transparent,rgba(var(--tint),.07),transparent);
  animation:${(/* inlined export .P */"sbel")}-sweep 1.5s ease-in-out infinite}
@keyframes ${(/* inlined export .P */"sbel")}-sweep{to{transform:translateX(100%)}}
.${(/* inlined export .P */"sbel")}-skwrap{display:grid;gap:26px;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)}

.${(/* inlined export .P */"sbel")}-log{margin-top:16px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
  background:rgba(var(--shade,0,0,0),.45);border:1px solid var(--line);color:var(--ink-2);border-radius:var(--r-sm);
  padding:12px;max-height:190px;overflow:auto;white-space:pre-wrap;word-break:break-word}

/* ── The reveal ─────────────────────────────────────────────────────────── */
/* One rehearsed entrance, replayed per slide — the deck is a rotation, so the
   champion arriving is the same authored moment each time. Everything starts
   from its resting state, so a failed script never hides content. */
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-champ-av{animation:${(/* inlined export .P */"sbel")}-hero .62s cubic-bezier(.16,1,.3,1) both}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-champ-txt{animation:${(/* inlined export .P */"sbel")}-rise .5s cubic-bezier(.16,1,.3,1) .1s both}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-champ-num{animation:${(/* inlined export .P */"sbel")}-rise .5s cubic-bezier(.16,1,.3,1) .17s both}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-shead,
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-ssub{animation:${(/* inlined export .P */"sbel")}-rise .45s cubic-bezier(.16,1,.3,1) both}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-frow{animation:${(/* inlined export .P */"sbel")}-rise .45s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(220ms + var(--i)*55ms)}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-fl{animation:${(/* inlined export .P */"sbel")}-rise .5s cubic-bezier(.16,1,.3,1) .34s both}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-fill{animation:${(/* inlined export .P */"sbel")}-grow .75s cubic-bezier(.16,1,.3,1) .3s both}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-cseg{animation:${(/* inlined export .P */"sbel")}-grow .7s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(400ms + var(--d))}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-arc{animation:${(/* inlined export .P */"sbel")}-arc .8s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(360ms + var(--d))}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-sline{animation:${(/* inlined export .P */"sbel")}-draw .9s cubic-bezier(.16,1,.3,1) .35s both}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-sdot-b{animation:${(/* inlined export .P */"sbel")}-dotpop .5s cubic-bezier(.16,1,.3,1) 1s both}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-on .${(/* inlined export .P */"sbel")}-bub{animation:${(/* inlined export .P */"sbel")}-pop .55s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(200ms + var(--i)*35ms)}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-slide.is-off{animation:${(/* inlined export .P */"sbel")}-out .2s ease-in both}

@keyframes ${(/* inlined export .P */"sbel")}-hero{
  from{opacity:0;transform:scale(.86) translateY(10px);filter:blur(9px)}
  to{opacity:1;transform:none;filter:blur(0)}}
@keyframes ${(/* inlined export .P */"sbel")}-rise{from{opacity:0;transform:translateY(11px)}to{opacity:1;transform:none}}
@keyframes ${(/* inlined export .P */"sbel")}-grow{from{width:0}}
@keyframes ${(/* inlined export .P */"sbel")}-arc{from{stroke-dasharray:0 9999}}
@keyframes ${(/* inlined export .P */"sbel")}-draw{from{stroke-dasharray:0 400}to{stroke-dasharray:400 0}}
@keyframes ${(/* inlined export .P */"sbel")}-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
@keyframes ${(/* inlined export .P */"sbel")}-dotpop{
  from{opacity:0;transform:translate(-50%,-50%) scale(.3)}
  to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes ${(/* inlined export .P */"sbel")}-out{to{opacity:0;transform:translateY(-8px) scale(.985);filter:blur(4px)}}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width:760px){
  .${(/* inlined export .P */"sbel")}-inner{padding:20px 18px 18px}
  .${(/* inlined export .P */"sbel")}-body,.${(/* inlined export .P */"sbel")}-skwrap{grid-template-columns:1fr;gap:20px}
  .${(/* inlined export .P */"sbel")}-fl-ring{grid-template-columns:1fr;justify-items:start}
  .${(/* inlined export .P */"sbel")}-num{font-size:clamp(40px,13vw,56px)}
  .${(/* inlined export .P */"sbel")}-champ{grid-template-columns:auto 1fr}
}
@media (max-width:440px){
  .${(/* inlined export .P */"sbel")}-champ{grid-template-columns:1fr;gap:12px}
  .${(/* inlined export .P */"sbel")}-champ-av{grid-row:auto}
  .${(/* inlined export .P */"sbel")}-champ-num{grid-column:1}
}

@media (prefers-reduced-motion:reduce){
  .${(/* inlined export .P */"sbel")}-root *,.${(/* inlined export .P */"sbel")}-root *::after,.${(/* inlined export .P */"sbel")}-root *::before{
    animation:none!important;transition:none!important}
}
`;
// ── Factory ──────────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class EngagementLeaderboard extends BaseBlockClass {
        constructor() { super(); }
        renderBlock(container) {
            return engagement_leaderboard_awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const self = this;
                // A re-render (attribute change) must not leave the previous instance's
                // timers and listeners running against a detached DOM.
                if (self._sbelCleanup) {
                    try {
                        self._sbelCleanup();
                    }
                    catch (_) { /* ignore */ }
                }
                const cleanups = [];
                const peopleIx = new Map();
                self._sbelCleanup = () => { for (const fn of cleanups.splice(0)) {
                    try {
                        fn();
                    }
                    catch (_) { /* ignore */ }
                } };
                const attr = (k) => this.getAttribute(k) || "";
                const bool = (k, dflt) => {
                    const v = this.getAttribute(k);
                    return v == null || v === "" ? dflt : v !== "false";
                };
                const int = (k, dflt) => {
                    const n = parseInt(attr(k), 10);
                    return isFinite(n) && n > 0 ? n : dflt;
                };
                const apiToken = attr("apitoken") || DEFAULT_API_TOKEN;
                const baseUrl = (attr("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
                const authMode = (attr("authmode") || "auto");
                const mode = attr("displaymode") === "grid" ? "grid" : "slideshow";
                const schemePref = attr("colorscheme") || "dark";
                const prefersLight = typeof matchMedia === "function"
                    && matchMedia("(prefers-color-scheme: light)").matches;
                const scheme = schemePref === "light" ? "light"
                    : schemePref === "auto" ? (prefersLight ? "light" : "dark")
                        : "dark";
                const debug = bool("debugmode", false);
                const autoWiden = bool("autowiden", true);
                const showPicker = bool("showwindowpicker", true);
                const showBubble = bool("showbubblemap", false);
                const showSample = bool("showsample", true);
                const autoplay = mode === "slideshow" && bool("autoplay", true);
                const autoplayMs = Math.max(3, int("autoplayseconds", 8)) * 1000;
                const topN = Math.max(2, Math.min(10, int("topn", 5)));
                const maxPosts = Math.min(1000, int("maxposts", 200));
                const cacheTtl = int("cachettl", 15) * 60000;
                const reduceMotion = typeof matchMedia === "function"
                    && matchMedia("(prefers-reduced-motion: reduce)").matches;
                const animate = bool("animate", true) && !reduceMotion;
                const csv = (k) => attr(k).split(",").map(s => s.trim()).filter(Boolean);
                const exclude = new Set(csv("excludeuserids"));
                const channels = csv("channels");
                let metrics = METRIC_ATTRS.filter(m => bool(m.attr, true)).map(m => m.id);
                if (!metrics.length)
                    metrics = [METRIC_ATTRS[0].id];
                let primary = attr("primarycolor") || DEFAULT_PRIMARY_COLOR;
                let accent = attr("accentcolor") || DEFAULT_ACCENT_COLOR;
                if (bool("usethemecolors", true) && apiToken && baseUrl) {
                    // The surface decides whether a brand hue gets lightened (dark stage) or
                    // darkened (light stage) to reach contrast — get this wrong and a deep
                    // navy either vanishes into black or glares off white.
                    const themed = yield fetchThemeColors(baseUrl, apiToken, "primary", scheme);
                    if (themed.primary)
                        primary = themed.primary;
                    if (themed.accent)
                        accent = themed.accent;
                }
                if (accent.toLowerCase() === primary.toLowerCase())
                    accent = DEFAULT_ACCENT_COLOR;
                const locale = detectLocale({
                    configLocale: ((_a = widgetApi === null || widgetApi === void 0 ? void 0 : widgetApi.getContentLanguage) === null || _a === void 0 ? void 0 : _a.call(widgetApi)) || null,
                    available: AVAILABLE_LOCALES,
                });
                const t = makeT(BUNDLES, locale);
                const rtl = isRtl(locale);
                const logs = [];
                const dlog = (...args) => {
                    const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
                    logs.push(`${new Date().toISOString().slice(11, 19)}  ${line}`);
                    if (debug) {
                        const el = container.querySelector(`.${(/* inlined export .P */"sbel")}-log`);
                        if (el) {
                            el.textContent = logs.join("\n");
                            el.scrollTop = el.scrollHeight;
                        }
                    }
                };
                let windowKey = (attr("timewindow") || "90d");
                let prevKey = windowKey === "custom" ? "90d" : windowKey;
                let customSince = attr("customsince");
                let customUntil = attr("customuntil");
                const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
                // ── Shell ──────────────────────────────────────────────────────────────
                const windowKeys = ["all", "7d", "30d", "90d", "12m", "custom"];
                container.innerHTML = `<style>${CSS}</style>
        <div class="${(/* inlined export .P */"sbel")}-root${scheme === "light" ? ` ${(/* inlined export .P */"sbel")}-light` : ""}${animate ? ` ${(/* inlined export .P */"sbel")}-anim` : ""}"
          dir="${rtl ? "rtl" : "ltr"}" style="
          --sbel-primary:${esc(primary)};--sbel-accent:${esc(accent)};
          --sbel-primary-rgb:${hexToRgb(primary)};--sbel-accent-rgb:${hexToRgb(accent)};
          --sbel-primary-text:${readableOn(primary)}">
          <div class="${(/* inlined export .P */"sbel")}-prog"><span></span></div>
          <div class="${(/* inlined export .P */"sbel")}-glow"></div>
          <div class="${(/* inlined export .P */"sbel")}-grain"></div>
          <div class="${(/* inlined export .P */"sbel")}-inner">
            <div class="${(/* inlined export .P */"sbel")}-top">
              <div class="${(/* inlined export .P */"sbel")}-eyebrow">
                <span class="${(/* inlined export .P */"sbel")}-mark"></span>
                <span class="${(/* inlined export .P */"sbel")}-h">${esc(t("widget.title"))}</span>
              </div>
              <span class="${(/* inlined export .P */"sbel")}-chip ${(/* inlined export .P */"sbel")}-status" hidden></span>
              ${showPicker ? `<select class="${(/* inlined export .P */"sbel")}-sel ${(/* inlined export .P */"sbel")}-window" aria-label="${esc(t("window.custom"))}">
                ${windowKeys.map(k => `<option value="${k}"${k === windowKey ? " selected" : ""}>${esc(t(`window.${k}`))}</option>`).join("")}
              </select>
              <span class="${(/* inlined export .P */"sbel")}-range"${windowKey === "custom" ? "" : " hidden"}>
                <label>${esc(t("window.from"))}
                  <input class="${(/* inlined export .P */"sbel")}-since" type="date" value="${esc(customSince)}"></label>
                <label>${esc(t("window.to"))}
                  <input class="${(/* inlined export .P */"sbel")}-until" type="date" value="${esc(customUntil)}"></label>
              </span>` : ""}
              <button class="${(/* inlined export .P */"sbel")}-ctl ${(/* inlined export .P */"sbel")}-refresh" type="button" aria-label="${esc(t("state.refresh"))}" title="${esc(t("state.refresh"))}">${icon("refresh", 15)}</button>
            </div>
            ${mode === "slideshow" ? `<div class="${(/* inlined export .P */"sbel")}-rail" role="tablist"></div>` : ""}
            <div class="${(/* inlined export .P */"sbel")}-body-host"></div>
            ${debug ? `<pre class="${(/* inlined export .P */"sbel")}-log"></pre>` : ""}
          </div>
        </div>`;
                const root = container.querySelector(`.${(/* inlined export .P */"sbel")}-root`);
                const host = container.querySelector(`.${(/* inlined export .P */"sbel")}-body-host`);
                const rail = container.querySelector(`.${(/* inlined export .P */"sbel")}-rail`);
                const status = container.querySelector(`.${(/* inlined export .P */"sbel")}-status`);
                const progress = container.querySelector(`.${(/* inlined export .P */"sbel")}-prog`);
                const picker = container.querySelector(`.${(/* inlined export .P */"sbel")}-window`);
                const setStatus = (text, mark = "beaker") => {
                    status.innerHTML = text ? `${icon(mark, 13)}<span>${esc(text)}</span>` : "";
                    status.hidden = !text;
                };
                const skeleton = () => {
                    host.innerHTML = `<div class="${(/* inlined export .P */"sbel")}-sk" style="height:22px;width:190px"></div>
          <div class="${(/* inlined export .P */"sbel")}-sk" style="height:14px;width:260px;margin-top:9px"></div>
          <div class="${(/* inlined export .P */"sbel")}-skwrap" style="margin-top:22px">
            <div class="${(/* inlined export .P */"sbel")}-sk" style="height:150px"></div>
            <div class="${(/* inlined export .P */"sbel")}-sk" style="height:150px"></div>
          </div>`;
                };
                // ── Data ───────────────────────────────────────────────────────────────
                const cacheKey = `${CACHE_PREFIX}${baseUrl}|${channels.join(",")}|${maxPosts}`;
                // The window is deliberately not part of the key: raw events are cached
                // un-windowed so changing the period re-filters in memory with no
                // requests. Rankings are the exception — they can only be filtered
                // server-side — so they are cached per window.
                const rankingCache = new Map();
                let raw = null;
                let isSample = false;
                let tiles = [];
                let index = 0;
                const readCache = () => {
                    try {
                        const s = sessionStorage.getItem(cacheKey);
                        if (!s)
                            return null;
                        const d = JSON.parse(s);
                        if (!d || Date.now() - d.fetchedAt > cacheTtl)
                            return null;
                        return d;
                    }
                    catch (_) {
                        return null;
                    }
                };
                const writeCache = (d) => {
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify(d));
                    }
                    catch (_) { /* quota — non-fatal */ }
                };
                const http = new Http(4, dlog);
                const tokenOrder = apiToken && authMode !== "session" ? [makeApiOpts(apiToken)] : [];
                const order = authMode === "session" ? [sessionOpts] : tokenOrder.concat([sessionOpts]);
                const rankingsFor = (since, until) => engagement_leaderboard_awaiter(this, void 0, void 0, function* () {
                    const key = `${since ? since.toISOString() : ""}|${until ? until.toISOString() : ""}`;
                    const hit = rankingCache.get(key);
                    if (hit)
                        return hit;
                    try {
                        const rows = yield fetchPostRankings(http, baseUrl, order, since, until);
                        rankingCache.set(key, rows);
                        return rows;
                    }
                    catch (e) {
                        dlog("rankings failed:", (e === null || e === void 0 ? void 0 : e.message) || String(e));
                        rankingCache.set(key, []);
                        return [];
                    }
                });
                // ── Autoplay ───────────────────────────────────────────────────────────
                let timer = null;
                let paused = false;
                let visible = true;
                const canPlay = () => autoplay && animate && tiles.length > 1 && visible && !paused;
                const stopTimer = () => {
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    progress.classList.remove("run");
                    progress.style.removeProperty("--dur");
                };
                const startTimer = () => {
                    stopTimer();
                    if (!canPlay())
                        return;
                    progress.style.setProperty("--dur", `${autoplayMs}ms`);
                    // Restart the CSS animation from zero on every advance.
                    void progress.offsetWidth;
                    progress.classList.add("run");
                    timer = setTimeout(() => go(index + 1, 1), autoplayMs);
                };
                cleanups.push(stopTimer);
                // ── Reveal ─────────────────────────────────────────────────────────────
                /** Count the headline number up. Cheap, and it is the one moment the
                 *  metric itself deserves emphasis. */
                const countUp = (el) => {
                    const target = Number(el.getAttribute("data-count"));
                    if (!isFinite(target) || !animate || target <= 0)
                        return;
                    const dur = 700, t0 = performance.now();
                    let raf = 0;
                    const tick = (now) => {
                        const k = Math.min(1, (now - t0) / dur);
                        const eased = 1 - Math.pow(1 - k, 3);
                        el.textContent = fmt(Math.round(target * eased * 10) / 10);
                        if (k < 1)
                            raf = requestAnimationFrame(tick);
                        else
                            el.textContent = fmt(target);
                    };
                    raf = requestAnimationFrame(tick);
                    cleanups.push(() => cancelAnimationFrame(raf));
                };
                /* The deck stacks its slides, so it needs to be told how tall the active
                   one is. Measured from scrollHeight (the slide is never itself scrolled)
                   and eased by the CSS transition. */
                const syncHeight = (instant) => {
                    const deck = root.querySelector(`.${(/* inlined export .P */"sbel")}-deck`);
                    if (!deck || deck.classList.contains(`${(/* inlined export .P */"sbel")}-grid`))
                        return;
                    const on = deck.querySelector(`.${(/* inlined export .P */"sbel")}-slide.is-on`);
                    if (!on)
                        return;
                    const h = Math.ceil(on.getBoundingClientRect().height || on.scrollHeight);
                    if (h <= 0)
                        return;
                    if (instant) {
                        // First measurement only: the deck is already at its natural (tallest)
                        // height, so easing to the active slide would read as an unexplained
                        // shrink before the viewer has done anything.
                        deck.style.transition = "none";
                        deck.style.height = `${h}px`;
                        void deck.offsetHeight;
                        deck.style.transition = "";
                        return;
                    }
                    deck.style.height = `${h}px`;
                };
                const railFades = () => {
                    const rail = root.querySelector(`.${(/* inlined export .P */"sbel")}-rail`);
                    if (!rail)
                        return;
                    const over = rail.scrollWidth - rail.clientWidth;
                    const x = rail.scrollLeft;
                    rail.style.setProperty("--f0", over > 2 && x > 2 ? "26px" : "0px");
                    rail.style.setProperty("--f1", over > 2 && x < over - 2 ? "26px" : "0px");
                };
                const go = (next, dir) => {
                    var _a;
                    if (!tiles.length)
                        return;
                    const n = ((next % tiles.length) + tiles.length) % tiles.length;
                    const slides = Array.from(host.querySelectorAll(`.${(/* inlined export .P */"sbel")}-slide`));
                    if (!slides.length)
                        return;
                    const prev = slides[index];
                    index = n;
                    if (prev && prev !== slides[n]) {
                        prev.classList.remove("is-on");
                        prev.classList.add("is-off");
                        setTimeout(() => prev.classList.remove("is-off"), 220);
                    }
                    slides.forEach((s, i) => s.classList.toggle("is-on", i === n));
                    // Re-trigger the entrance by reinserting the node's animation classes.
                    const on = slides[n];
                    (_a = on.getAnimations) === null || _a === void 0 ? void 0 : _a.call(on).forEach(a => { a.cancel(); a.play(); });
                    on.querySelectorAll("*").forEach(el => { var _a; return (_a = el.getAnimations) === null || _a === void 0 ? void 0 : _a.call(el).forEach(a => { a.cancel(); a.play(); }); });
                    const num = on.querySelector(`.${(/* inlined export .P */"sbel")}-num[data-count]`);
                    if (num)
                        countUp(num);
                    root.querySelectorAll(`.${(/* inlined export .P */"sbel")}-tab,.${(/* inlined export .P */"sbel")}-dot`).forEach(el => {
                        const on2 = Number(el.getAttribute("data-i")) === n;
                        el.setAttribute("aria-selected", String(on2));
                        el.setAttribute("tabindex", on2 ? "0" : "-1");
                    });
                    const counter = root.querySelector(`.${(/* inlined export .P */"sbel")}-count`);
                    if (counter)
                        counter.textContent = `${n + 1}/${tiles.length}`;
                    const activeTab = root.querySelector(`.${(/* inlined export .P */"sbel")}-tab[aria-selected="true"]`);
                    activeTab === null || activeTab === void 0 ? void 0 : activeTab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: animate ? "smooth" : "auto" });
                    syncHeight();
                    // The entrance animation changes nothing about layout height, but web
                    // fonts and images settle a beat later, so re-measure once.
                    setTimeout(syncHeight, 260);
                    setTimeout(railFades, 320);
                    startTimer();
                    void dir;
                };
                // ── Render ─────────────────────────────────────────────────────────────
                const slideHtml = (tile, i) => {
                    const L = {
                        breakdown: t("chart.breakdown"), mix: t("chart.mix"),
                        previous: t("chart.previous"), current: t("chart.current"),
                    };
                    const fl = flourish(tile, L);
                    const fieldHtml = field(tile);
                    const note = tile.widened ? `<div class="${(/* inlined export .P */"sbel")}-note">${icon("history", 13)}<span>${esc(t("window.widened"))}</span></div>` : "";
                    const empty = !tile.entries.length;
                    return `<section class="${(/* inlined export .P */"sbel")}-slide${i === 0 ? " is-on" : ""}" role="tabpanel"
          id="${(/* inlined export .P */"sbel")}-panel-${i}" aria-label="${esc(tile.title)}"${mode === "slideshow" ? ` data-i="${i}"` : ""}>
          <header class="${(/* inlined export .P */"sbel")}-shead">
            <span class="${(/* inlined export .P */"sbel")}-shead-ic">${icon(METRIC_ICON[tile.id] || "spark", 15)}</span>
            <h4 class="${(/* inlined export .P */"sbel")}-stitle">${esc(tile.title)}</h4>
          </header>
          <p class="${(/* inlined export .P */"sbel")}-ssub">${esc(tile.subtitle)}</p>
          ${note}
          ${empty
                        ? `<div class="${(/* inlined export .P */"sbel")}-empty">${icon("inbox", 26)}<p>${esc(t("state.emptyTile"))}</p></div>`
                        : `<div class="${(/* inlined export .P */"sbel")}-body">
                 <div>${champion(tile, mode === "grid" ? "card" : "stage")}${fl}</div>
                 ${fieldHtml ? `<div>${fieldHtml}</div>` : ""}
               </div>`}
        </section>`;
                };
                // ── Hi-res avatars ─────────────────────────────────────────────────────
                // `/users` only gives us a 48px icon, which is visibly soft behind the
                // 132px champion portrait. `/profiles/public/{id}` has a 200px original we
                // can ask to be rendered larger. It is USER-authenticated and entirely
                // optional, so it runs *after* the deck is on screen and patches the
                // existing <img> in place — re-rendering would replay every entrance
                // animation for a cosmetic upgrade.
                const cssq = (v) => v.replace(/["\\]/g, "\\$&");
                const profileCache = new Map();
                let upgradeToken = 0;
                const applyAvatar = (uid, url) => {
                    const want = hiResAvatar(url, 400);
                    root.querySelectorAll(`[data-uid="${cssq(uid)}"] img`).forEach(img => {
                        if (img.dataset.hires === "1")
                            return;
                        img.dataset.hires = "1";
                        // The 400px render is a guess about a URL shape we do not own; step
                        // back to the URL the API actually handed us before giving up.
                        img.onerror = () => { img.onerror = null; img.src = url; };
                        img.src = want;
                    });
                };
                const upgradeAvatars = () => engagement_leaderboard_awaiter(this, void 0, void 0, function* () {
                    const mine = ++upgradeToken;
                    const ids = [];
                    root.querySelectorAll("[data-uid]").forEach(el => {
                        const id = el.dataset.uid || "";
                        if (id && ids.indexOf(id) < 0)
                            ids.push(id);
                    });
                    for (const id of ids) {
                        const hit = profileCache.get(id);
                        if (hit)
                            applyAvatar(id, hit);
                    }
                    const missing = ids.filter(id => !profileCache.has(id));
                    if (!missing.length)
                        return;
                    dlog(`upgrading ${missing.length} avatar(s) via /profiles/public`);
                    yield Promise.all(missing.map((id) => engagement_leaderboard_awaiter(this, void 0, void 0, function* () {
                        const prof = yield fetchPublicProfile(http, baseUrl, id, order);
                        profileCache.set(id, (prof === null || prof === void 0 ? void 0 : prof.avatar) || null);
                        if (mine !== upgradeToken)
                            return;
                        const person = peopleIx.get(id);
                        if (person && prof) {
                            if (prof.avatar)
                                person.avatar = prof.avatar;
                            if (!person.position && prof.position)
                                person.position = prof.position;
                            if (!person.department && prof.department)
                                person.department = prof.department;
                        }
                        if (prof === null || prof === void 0 ? void 0 : prof.avatar)
                            applyAvatar(id, prof.avatar);
                    })));
                });
                // ── Profile hovercard ──────────────────────────────────────────────────
                // Lives on <body>, not inside the widget: the deck uses transforms for its
                // slide transitions, and a transformed ancestor re-bases position:fixed,
                // which would drag the card around with the slide.
                let hoverEl = null;
                let hoverFor = null;
                let hoverShow = 0;
                let hoverHide = 0;
                const placeHover = (anchorEl) => {
                    if (!hoverEl)
                        return;
                    const a = anchorEl.getBoundingClientRect();
                    const h = hoverEl.getBoundingClientRect();
                    const pad = 10;
                    let left = a.left + a.width / 2 - h.width / 2;
                    left = Math.max(pad, Math.min(left, window.innerWidth - h.width - pad));
                    // Prefer above; flip below only when there is genuinely no room.
                    let top = a.top - h.height - 10;
                    if (top < pad)
                        top = a.bottom + 10;
                    hoverEl.style.left = `${Math.round(left)}px`;
                    hoverEl.style.top = `${Math.round(top)}px`;
                };
                const hideHover = () => {
                    window.clearTimeout(hoverShow);
                    window.clearTimeout(hoverHide);
                    hoverHide = window.setTimeout(() => {
                        hoverFor = null;
                        if (hoverEl)
                            hoverEl.classList.remove("is-on");
                    }, 180);
                };
                const showHover = (anchorEl) => {
                    const uid = anchorEl.dataset.uid || "";
                    const person = peopleIx.get(uid);
                    if (!person)
                        return;
                    // The avatar and the name are two separate anchors for the same person,
                    // and each has children. Without this guard, crossing between them
                    // cancels and restarts the reveal, so the card visibly blinks.
                    window.clearTimeout(hoverHide);
                    if (hoverFor === anchorEl && (hoverEl === null || hoverEl === void 0 ? void 0 : hoverEl.classList.contains("is-on")))
                        return;
                    hoverFor = anchorEl;
                    window.clearTimeout(hoverShow);
                    hoverShow = window.setTimeout(() => {
                        if (!hoverEl) {
                            hoverEl = document.createElement("div");
                            hoverEl.className = `${(/* inlined export .P */"sbel")}-hover`;
                            document.body.appendChild(hoverEl);
                            hoverEl.addEventListener("mouseenter", () => window.clearTimeout(hoverHide));
                            hoverEl.addEventListener("mouseleave", hideHover);
                        }
                        // The card is outside .sbel-root, so it inherits none of the scheme
                        // tokens — carry the ones it needs across explicitly.
                        const cs = getComputedStyle(root);
                        for (const v of ["--tint", "--bg", "--bg-2", "--panel", "--line", "--ink", "--ink-2",
                            "--p-rgb", "--r-sm", "--drop", "--sbel-primary", "--sbel-accent", "--sbel-primary-text"]) {
                            hoverEl.style.setProperty(v, cs.getPropertyValue(v));
                        }
                        const rows = [];
                        if (person.position)
                            rows.push(`${icon("badge", 13)}<span>${esc(person.position)}</span>`);
                        if (person.department)
                            rows.push(`${icon("people", 13)}<span>${esc(person.department)}</span>`);
                        if (person.location)
                            rows.push(`${icon("pin", 13)}<span>${esc(person.location)}</span>`);
                        const av = person.avatar
                            ? `<img src="${esc(person.avatar)}" alt="" onerror="this.parentElement.classList.add('${(/* inlined export .P */"sbel")}-av-fb');this.remove()">`
                            : "";
                        hoverEl.innerHTML = `
            <span class="${(/* inlined export .P */"sbel")}-av${person.avatar ? "" : ` ${(/* inlined export .P */"sbel")}-av-fb`}" style="--av:46px"
              data-ini="${esc(initials(person.name))}">${av}</span>
            <div class="${(/* inlined export .P */"sbel")}-hover-txt">
              <strong>${esc(person.name)}</strong>
              ${rows.length ? `<ul>${rows.map(r => `<li>${r}</li>`).join("")}</ul>` : ""}
            </div>`;
                        hoverEl.classList.add("is-on");
                        placeHover(anchorEl);
                    }, 220);
                };
                const onHoverOver = (ev) => {
                    var _a, _b;
                    const el = (_b = (_a = ev.target) === null || _a === void 0 ? void 0 : _a.closest) === null || _b === void 0 ? void 0 : _b.call(_a, "[data-uid]");
                    if (el)
                        showHover(el);
                };
                const onHoverOut = (ev) => {
                    var _a, _b;
                    const el = (_b = (_a = ev.target) === null || _a === void 0 ? void 0 : _a.closest) === null || _b === void 0 ? void 0 : _b.call(_a, "[data-uid]");
                    if (!el)
                        return;
                    const to = ev.relatedTarget;
                    if (to && typeof to.closest === "function" && to.closest("[data-uid]") === el)
                        return;
                    hideHover();
                };
                root.addEventListener("mouseover", onHoverOver);
                root.addEventListener("mouseout", onHoverOut);
                root.addEventListener("focusin", onHoverOver);
                root.addEventListener("focusout", onHoverOut);
                cleanups.push(() => {
                    window.clearTimeout(hoverShow);
                    window.clearTimeout(hoverHide);
                    root.removeEventListener("mouseover", onHoverOver);
                    root.removeEventListener("mouseout", onHoverOut);
                    root.removeEventListener("focusin", onHoverOver);
                    root.removeEventListener("focusout", onHoverOut);
                    if (hoverEl && hoverEl.parentNode)
                        hoverEl.parentNode.removeChild(hoverEl);
                    hoverEl = null;
                });
                const render = () => engagement_leaderboard_awaiter(this, void 0, void 0, function* () {
                    if (!raw)
                        return;
                    for (const p of raw.people)
                        peopleIx.set(p.id, p);
                    const now = Date.now();
                    const win = resolveWindow(windowKey, now, customSince, customUntil);
                    const wantsAdvocacy = metrics.indexOf("advocacy") >= 0;
                    let rankings = raw.rankings;
                    let rankingsAll = raw.rankings;
                    if (wantsAdvocacy && !isSample) {
                        rankingsAll = yield rankingsFor(undefined, undefined);
                        rankings = windowKey === "all" ? rankingsAll
                            : yield rankingsFor(new Date(win.since), new Date(win.until));
                    }
                    tiles = buildTiles({
                        raw, window: win, weights: DEFAULT_WEIGHTS, topN, metrics, exclude,
                        autoWiden, rankings, rankingsAllTime: rankingsAll, t,
                        colors: { comment: primary, reaction: accent, post: "#FFB43C", breadth: "#3DDC97" },
                    });
                    if (!tiles.length) {
                        host.innerHTML = `<div class="${(/* inlined export .P */"sbel")}-empty">${icon("inbox", 26)}<p>${esc(t("state.empty"))}</p></div>`;
                        return;
                    }
                    const bubble = showBubble && !isSample ? bubbleCard(raw, win) : "";
                    if (mode === "grid") {
                        host.innerHTML = `<div class="${(/* inlined export .P */"sbel")}-grid">${tiles.map(slideHtml).join("")}</div>${bubble}`;
                        host.querySelectorAll(`.${(/* inlined export .P */"sbel")}-num[data-count]`).forEach(countUp);
                    }
                    else {
                        host.innerHTML = `<div class="${(/* inlined export .P */"sbel")}-deck">${tiles.map(slideHtml).join("")}</div>
            <div class="${(/* inlined export .P */"sbel")}-foot">
              <div class="${(/* inlined export .P */"sbel")}-dots">${tiles.map((tile, i) => `<button class="${(/* inlined export .P */"sbel")}-dot" type="button" data-i="${i}" role="tab"
                  aria-selected="${i === 0}" aria-controls="${(/* inlined export .P */"sbel")}-panel-${i}"
                  aria-label="${esc(tile.title)}"></button>`).join("")}</div>
              <span class="${(/* inlined export .P */"sbel")}-count">1/${tiles.length}</span>
              <div class="${(/* inlined export .P */"sbel")}-nav">
                <button class="${(/* inlined export .P */"sbel")}-ctl ${(/* inlined export .P */"sbel")}-prev" type="button" aria-label="${esc(t("nav.previous"))}">${icon("chevronLeft", 15)}</button>
                <button class="${(/* inlined export .P */"sbel")}-ctl ${(/* inlined export .P */"sbel")}-next" type="button" aria-label="${esc(t("nav.next"))}">${icon("chevronRight", 15)}</button>
              </div>
            </div>${bubble}`;
                        if (rail) {
                            rail.innerHTML = tiles.map((tile, i) => `<button class="${(/* inlined export .P */"sbel")}-tab" type="button" role="tab" data-i="${i}"
                aria-selected="${i === 0}" aria-controls="${(/* inlined export .P */"sbel")}-panel-${i}" tabindex="${i === 0 ? 0 : -1}"
                >${icon(METRIC_ICON[tile.id] || "spark", 14)}<span>${esc(tile.title)}</span></button>`).join("");
                        }
                        index = Math.min(index, tiles.length - 1);
                        wireDeck();
                        go(index, 1);
                    }
                    const parts = [];
                    if (isSample)
                        parts.push(t("state.sample"));
                    if (raw.skippedPosts) {
                        parts.push(t("state.partialN")
                            .replace("{n}", String(raw.skippedPosts))
                            .replace("{total}", String(raw.posts.length + raw.skippedPosts)));
                    }
                    // Sample data is a caveat; skipped posts are a warning. Different mark.
                    setStatus(parts.join(" · "), isSample ? "beaker" : "alert");
                    dlog(`rendered ${tiles.length} tiles for window ${windowKey}`);
                    if (!isSample)
                        void upgradeAvatars();
                });
                const bubbleCard = (d, win) => {
                    const stats = aggregate(d.events, win, exclude);
                    const people = new Map(d.people.map(p => [p.id, p]));
                    const points = [];
                    for (const [id, s] of stats) {
                        const p = people.get(id);
                        const vol = activityScore(s);
                        if (!p || vol <= 0)
                            continue;
                        points.push({ entry: { person: p, value: vol }, x: s.distinctPosts, y: vol, size: vol });
                    }
                    points.sort((a, b) => b.size - a.size);
                    const svg = bubbleMap(points.slice(0, 22), t("map.label"), t("map.axisX"), t("map.axisY"));
                    if (!svg)
                        return "";
                    return `<section class="${(/* inlined export .P */"sbel")}-slide is-on" style="margin-top:26px;padding-top:22px;border-top:1px solid var(--line)">
          <header class="${(/* inlined export .P */"sbel")}-shead"><span class="${(/* inlined export .P */"sbel")}-shead-ic">${icon("scatter", 15)}</span>
            <h4 class="${(/* inlined export .P */"sbel")}-stitle">${esc(t("map.title"))}</h4></header>
          <p class="${(/* inlined export .P */"sbel")}-ssub">${esc(t("map.sub"))}</p>
          ${svg}
        </section>`;
                };
                // ── Deck wiring ────────────────────────────────────────────────────────
                function wireDeck() {
                    const on = (el, ev, fn, opts) => {
                        if (!el)
                            return;
                        el.addEventListener(ev, fn, opts);
                        cleanups.push(() => el.removeEventListener(ev, fn, opts));
                    };
                    on(root.querySelector(`.${(/* inlined export .P */"sbel")}-prev`), "click", () => { paused = false; go(index - 1, -1); });
                    on(root.querySelector(`.${(/* inlined export .P */"sbel")}-next`), "click", () => { paused = false; go(index + 1, 1); });
                    root.querySelectorAll(`.${(/* inlined export .P */"sbel")}-tab,.${(/* inlined export .P */"sbel")}-dot`).forEach(el => on(el, "click", () => {
                        // A deliberate pick outranks the rotation: stop auto-advancing so the
                        // viewer isn't yanked off the metric they just chose.
                        paused = true;
                        stopTimer();
                        go(Number(el.getAttribute("data-i")) || 0, 1);
                    }));
                    on(root, "keydown", (e) => {
                        var _a, _b, _c;
                        const k = e.key;
                        if (k !== "ArrowLeft" && k !== "ArrowRight" && k !== "Home" && k !== "End")
                            return;
                        const inRail = (_b = (_a = e.target) === null || _a === void 0 ? void 0 : _a.closest) === null || _b === void 0 ? void 0 : _b.call(_a, `.${(/* inlined export .P */"sbel")}-rail,.${(/* inlined export .P */"sbel")}-dots`);
                        if (!inRail && document.activeElement !== root)
                            return;
                        e.preventDefault();
                        paused = true;
                        stopTimer();
                        if (k === "Home")
                            go(0, -1);
                        else if (k === "End")
                            go(tiles.length - 1, 1);
                        else
                            go(index + (k === "ArrowRight" ? 1 : -1), k === "ArrowRight" ? 1 : -1);
                        (_c = root.querySelector(`.${(/* inlined export .P */"sbel")}-tab[aria-selected="true"],.${(/* inlined export .P */"sbel")}-dot[aria-selected="true"]`)) === null || _c === void 0 ? void 0 : _c.focus();
                    });
                    // Pointer hold pauses the rotation; swipe moves the deck.
                    let x0 = 0, y0 = 0, down = false;
                    const deck = root.querySelector(`.${(/* inlined export .P */"sbel")}-deck`);
                    on(deck, "pointerdown", (e) => {
                        down = true;
                        x0 = e.clientX;
                        y0 = e.clientY;
                        paused = true;
                        stopTimer();
                    });
                    on(deck, "pointerup", (e) => {
                        if (!down)
                            return;
                        down = false;
                        const dx = e.clientX - x0, dy = e.clientY - y0;
                        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
                            const fwd = rtl ? dx > 0 : dx < 0;
                            go(index + (fwd ? 1 : -1), fwd ? 1 : -1);
                        }
                        paused = false;
                        startTimer();
                    });
                    on(deck, "pointercancel", () => { down = false; paused = false; startTimer(); });
                    on(root, "mouseenter", () => { paused = true; stopTimer(); });
                    on(root, "mouseleave", () => { paused = false; startTimer(); });
                    on(root, "focusin", () => { paused = true; stopTimer(); });
                    on(root.querySelector(`.${(/* inlined export .P */"sbel")}-rail`), "scroll", railFades, { passive: true });
                    railFades();
                    // Height is measured, so it has to be re-measured whenever the widget is
                    // resized — a widget column can change width without the window doing so.
                    syncHeight(true);
                    requestAnimationFrame(() => syncHeight(true));
                    if (typeof ResizeObserver === "function") {
                        let rafId = 0;
                        const ro = new ResizeObserver(() => {
                            cancelAnimationFrame(rafId);
                            rafId = requestAnimationFrame(() => { syncHeight(); railFades(); });
                        });
                        ro.observe(root);
                        cleanups.push(() => { cancelAnimationFrame(rafId); ro.disconnect(); });
                    }
                    else {
                        const onResize = () => { syncHeight(); railFades(); };
                        window.addEventListener("resize", onResize);
                        cleanups.push(() => window.removeEventListener("resize", onResize));
                    }
                }
                // Nonessential motion must not run offscreen or in a hidden tab.
                if (typeof IntersectionObserver === "function") {
                    const io = new IntersectionObserver(entries => {
                        visible = entries.some(en => en.isIntersecting);
                        root.classList.toggle(`${(/* inlined export .P */"sbel")}-live`, visible && animate);
                        if (visible)
                            startTimer();
                        else
                            stopTimer();
                    }, { threshold: 0.15 });
                    io.observe(root);
                    cleanups.push(() => io.disconnect());
                }
                else {
                    root.classList.toggle(`${(/* inlined export .P */"sbel")}-live`, animate);
                }
                const onVis = () => {
                    visible = !document.hidden;
                    root.classList.toggle(`${(/* inlined export .P */"sbel")}-live`, visible && animate);
                    if (visible)
                        startTimer();
                    else
                        stopTimer();
                };
                document.addEventListener("visibilitychange", onVis);
                cleanups.push(() => document.removeEventListener("visibilitychange", onVis));
                // ── Load ───────────────────────────────────────────────────────────────
                const load = (force) => engagement_leaderboard_awaiter(this, void 0, void 0, function* () {
                    stopTimer();
                    skeleton();
                    setStatus("");
                    if (!baseUrl || (!apiToken && authMode === "token")) {
                        if (showSample) {
                            raw = sampleRaw();
                            isSample = true;
                            yield render();
                        }
                        else {
                            host.innerHTML = `<div class="${(/* inlined export .P */"sbel")}-empty">${icon("beaker", 26)}<p>${esc(t("state.configure"))}</p></div>`;
                        }
                        return;
                    }
                    if (!force) {
                        const cached = readCache();
                        if (cached) {
                            raw = cached;
                            isSample = false;
                            dlog("served from cache");
                            yield render();
                            return;
                        }
                    }
                    try {
                        raw = yield loadRawData({ baseUrl, apiToken, authMode, maxPosts, concurrency: 4, log: dlog });
                        isSample = false;
                        writeCache(raw);
                        yield render();
                    }
                    catch (e) {
                        dlog("load failed:", (e === null || e === void 0 ? void 0 : e.message) || String(e));
                        if (showSample) {
                            raw = sampleRaw();
                            isSample = true;
                            yield render();
                        }
                        else {
                            host.innerHTML = `<div class="${(/* inlined export .P */"sbel")}-empty">${icon("alert", 26)}<p>${esc(t("state.error"))}</p>
              <button class="${(/* inlined export .P */"sbel")}-chip ${(/* inlined export .P */"sbel")}-retry" type="button" style="margin-top:12px;cursor:pointer">${esc(t("state.retry"))}</button></div>`;
                            const retry = host.querySelector(`.${(/* inlined export .P */"sbel")}-retry`);
                            retry === null || retry === void 0 ? void 0 : retry.addEventListener("click", () => void load(true));
                        }
                    }
                });
                const range = container.querySelector(`.${(/* inlined export .P */"sbel")}-range`);
                const sinceInput = container.querySelector(`.${(/* inlined export .P */"sbel")}-since`);
                const untilInput = container.querySelector(`.${(/* inlined export .P */"sbel")}-until`);
                picker === null || picker === void 0 ? void 0 : picker.addEventListener("change", () => {
                    windowKey = picker.value;
                    if (range)
                        range.hidden = windowKey !== "custom";
                    if (windowKey === "custom") {
                        // Seed the pickers from whatever period was on screen, so switching to
                        // a custom range starts from where the viewer already was rather than
                        // blank (which would silently mean "all time").
                        const w = resolveWindow(prevKey, Date.now(), customSince, customUntil);
                        if (sinceInput && !sinceInput.value) {
                            customSince = isoDay(w.since || Date.now() - 90 * 86400000);
                            sinceInput.value = customSince;
                        }
                        if (untilInput && !untilInput.value) {
                            customUntil = isoDay(w.until);
                            untilInput.value = customUntil;
                        }
                    }
                    prevKey = windowKey;
                    index = 0;
                    void render();
                });
                const onRangeChange = () => {
                    customSince = (sinceInput === null || sinceInput === void 0 ? void 0 : sinceInput.value) || "";
                    customUntil = (untilInput === null || untilInput === void 0 ? void 0 : untilInput.value) || "";
                    // Guard the inverted range rather than rendering a confusing empty state.
                    if (customSince && customUntil && customSince > customUntil) {
                        if (sinceInput)
                            sinceInput.value = customUntil;
                        customSince = customUntil;
                    }
                    if (sinceInput)
                        sinceInput.max = customUntil || "";
                    if (untilInput)
                        untilInput.min = customSince || "";
                    index = 0;
                    void render();
                };
                sinceInput === null || sinceInput === void 0 ? void 0 : sinceInput.addEventListener("change", onRangeChange);
                untilInput === null || untilInput === void 0 ? void 0 : untilInput.addEventListener("change", onRangeChange);
                (_b = container.querySelector(`.${(/* inlined export .P */"sbel")}-refresh`)) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
                    rankingCache.clear();
                    try {
                        sessionStorage.removeItem(cacheKey);
                    }
                    catch (_) { /* ignore */ }
                    void load(true);
                });
                yield load(false);
            });
        }
        disconnectedCallback() {
            const self = this;
            if (self._sbelCleanup) {
                try {
                    self._sbelCleanup();
                }
                catch (_) { /* ignore */ }
            }
            self._sbelCleanup = undefined;
        }
        static get observedAttributes() {
            return ATTRS;
        }
    };
};
const ATTRS = [
    "apitoken", "baseurl", "authmode", "displaymode", "colorscheme", "timewindow", "customsince", "customuntil",
    "autowiden", "showwindowpicker", "topn", "channels", "excludeuserids", "maxposts", "cachettl",
    "showbubblemap", "animate", "autoplay", "autoplayseconds", "usethemecolors",
    "primarycolor", "accentcolor", "showsample", "debugmode",
].concat(METRIC_ATTRS.map(m => m.attr));
// ── Block registration ───────────────────────────────────────────────────────
const blockDefinition = {
    name: "engagement-leaderboard",
    label: "Engagement Leaderboard",
    attributes: ATTRS,
    factory,
    configurationSchema,
    uiSchema,
    blockLevel: "block",
    iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48cmVjdCB3aWR0aD0iMTcxIiBoZWlnaHQ9IjE3MSIgcng9IjM4IiBmaWxsPSIjMEIwRDEyIi8+PGcgZmlsbD0iIzNEREM5NyI+PHJlY3QgeD0iMzQiIHk9Ijk0IiB3aWR0aD0iMjYiIGhlaWdodD0iNDMiIHJ4PSI2Ii8+PHJlY3QgeD0iNzIiIHk9IjcwIiB3aWR0aD0iMjYiIGhlaWdodD0iNjciIHJ4PSI2Ii8+PC9nPjxyZWN0IHg9IjExMCIgeT0iMTA4IiB3aWR0aD0iMjYiIGhlaWdodD0iMjkiIHJ4PSI2IiBmaWxsPSIjN0M1Q0ZGIi8+PGNpcmNsZSBjeD0iODUiIGN5PSI0NCIgcj0iMTgiIGZpbGw9IiMzRERDOTciLz48L3N2Zz4=",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "2.0.0" });

/******/ })()
;