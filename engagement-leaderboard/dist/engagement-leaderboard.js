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
    return theming_awaiter(this, arguments, void 0, function* (baseUrl, apiToken, themeId = "primary") {
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
            let primary = pickOnWhite(palette);
            if (!primary) {
                primary =
                    resolve("primary-brand-color") ||
                        customs["legacy-background-color"] ||
                        (typeof ((_f = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _f === void 0 ? void 0 : _f.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "");
                if (isHex(primary))
                    primary = darkenToContrast(primary, 4.5);
            }
            // Accent: most vivid palette color, else nav accent, else fall back to primary.
            let accent = pickVivid(palette, primary) ||
                resolve((_j = (_h = (_g = data === null || data === void 0 ? void 0 : data.desktopTheme) === null || _g === void 0 ? void 0 : _g.components) === null || _h === void 0 ? void 0 : _h.navigation) === null || _j === void 0 ? void 0 : _j.accentColor) ||
                String(primary);
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
                return rows
                    .map(r => ({ userId: r.userId || r.userID || "", at: r.createdAt || r.created || "", type: r.type || "LIKE" }))
                    .filter(r => r.userId);
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
            return rows
                .map(r => ({ userId: r.userID || r.userId || "", at: r.created || "" }))
                .filter(r => r.userId);
        }
        catch (_) {
            return null;
        }
    });
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
        let typedReactions = false;
        const events = [];
        const results = yield http.mapLimit(posts, (post) => api_awaiter(this, void 0, void 0, function* () {
            var _a;
            const rows = yield fetchPostReactions(http, base, post.id, reactionSession, general, inlineUsers);
            done++;
            (_a = opts.onProgress) === null || _a === void 0 ? void 0 : _a.call(opts, done, posts.length);
            return { post, rows };
        }));
        for (const { post, rows } of results) {
            if (rows === null) {
                skippedPosts++;
                continue;
            }
            for (const r of rows) {
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
        return { events, posts, people, rankings, skippedPosts, typedReactions, fetchedAt: Date.now() };
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
        const u = Date.parse(customUntil || "");
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

;// ./charts.ts
// ─────────────────────────────────────────────────────────────────────────────
// Charts — hand-rolled HTML/CSS/SVG. No chart library.
//
// The deciding constraint is the avatar: every data point is a person's photo,
// and photos 404 often enough that a gradient-initials fallback is mandatory.
// That fallback is an `<img onerror>`, which only works for real DOM images —
// so canvas (chart.js) is out, and inside SVG the avatars are absolutely
// positioned HTML `<img>` overlays rather than `<image>` elements, which have
// no usable error-fallback path.
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
/**
 * Avatar markup.
 *
 * Wrapped in `internal-link clickable` + `/profile/<id>` + `data-uid`, which is
 * the markup Staffbase's own author links use — that is what makes the native
 * profile hovercard attach to a chart node instead of it being an inert image.
 */
function avatar(e, size, cls = "") {
    const p = e.person;
    const ini = esc(initials(p.name));
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`;
    const inner = p.avatar
        ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('${P}-av-fb');this.remove()">`
        : "";
    const body = `<span class="${P}-av ${cls} ${p.avatar ? "" : `${P}-av-fb`}" style="${style}" data-ini="${ini}">${inner}</span>`;
    if (!p.id)
        return body;
    return `<a class="${P}-avlink internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}" title="${esc(p.name)}">${body}</a>`;
}
function nameCell(e) {
    const p = e.person;
    const meta = [p.position, p.department].filter(Boolean).join(" · ");
    const label = p.id
        ? `<a class="${P}-nm internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}">${esc(p.name)}</a>`
        : `<span class="${P}-nm">${esc(p.name)}</span>`;
    const sub = e.subtitle || meta;
    return `${label}${sub ? `<span class="${P}-meta">${esc(sub)}</span>` : ""}`;
}
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString();
/** Describe the underlying numbers for screen readers, since the visual
 *  encoding (bar length, pillar height, arc angle) conveys nothing to them. */
function ariaLabel(tile) {
    const rows = tile.entries.map((e, i) => `${i + 1}. ${e.person.name}, ${fmt(e.value)} ${tile.unit}`);
    return esc(`${tile.title}. ${rows.join(". ")}`);
}
function chartOpen(tile, kind) {
    return `<div class="${P}-chart ${P}-${kind}" role="img" aria-label="${ariaLabel(tile)}">`;
}
// ── Podium ───────────────────────────────────────────────────────────────────
/** 2nd–1st–3rd, winner centre and tallest. Heights are proportional to score
 *  but floored at 28% so a runaway winner doesn't flatten the others to
 *  invisible slivers. */
function podium(tile) {
    const e = tile.entries;
    if (e.length < 2)
        return solo(tile);
    const max = Math.max(...e.map(x => x.value)) || 1;
    const order = [1, 0, 2].filter(i => i < e.length);
    const pillars = order.map(i => {
        const entry = e[i];
        const h = Math.max(28, Math.round((entry.value / max) * 100));
        return `<div class="${P}-pil ${P}-pil-${i + 1}">
      ${avatar(entry, i === 0 ? 56 : 42, `${P}-av-ring`)}
      <span class="${P}-pil-nm">${esc(entry.person.name)}</span>
      <span class="${P}-pil-v">${fmt(entry.value)}</span>
      <div class="${P}-pil-bar" style="--h:${h}%"><span>${i + 1}</span></div>
    </div>`;
    }).join("");
    return `${chartOpen(tile, "podium")}${pillars}</div>${composition(tile)}`;
}
/** Fewer than two data points can't be a chart — show the winner plainly
 *  rather than a one-bar "chart" that implies a comparison. */
function solo(tile) {
    const e = tile.entries[0];
    if (!e)
        return "";
    return `<div class="${P}-solo">
    ${avatar(e, 64, `${P}-av-ring`)}
    <div class="${P}-solo-txt">${nameCell(e)}</div>
    <div class="${P}-solo-v">${fmt(e.value)}<span>${esc(tile.unit)}</span></div>
  </div>`;
}
// ── Horizontal bars ──────────────────────────────────────────────────────────
function bars(tile) {
    if (tile.entries.length < 2)
        return solo(tile);
    const max = Math.max(...tile.entries.map(x => x.value)) || 1;
    const rows = tile.entries.map((e, i) => {
        const w = Math.max(4, Math.round((e.value / max) * 100));
        return `<div class="${P}-row${i === 0 ? ` ${P}-row-win` : ""}">
      ${avatar(e, i === 0 ? 40 : 32)}
      <div class="${P}-row-body">
        <div class="${P}-row-top">${nameCell(e)}</div>
        <div class="${P}-track"><div class="${P}-fill" style="--w:${w}%"></div></div>
      </div>
      <div class="${P}-row-v">${fmt(e.value)}</div>
    </div>`;
    }).join("");
    return `${chartOpen(tile, "bars")}${rows}</div>`;
}
// ── Two-tone share/click bars (Social Advocacy) ───────────────────────────────
/** Post-level by necessity — the API has no per-user share log — so the row is
 *  the post, with the author's avatar attached to keep a person in frame. */
function shareBars(tile) {
    if (!tile.entries.length)
        return "";
    const max = Math.max(...tile.entries.map(e => Math.max(...(e.parts || []).map(p => p.value), e.value))) || 1;
    const rows = tile.entries.map(e => {
        const parts = e.parts || [{ label: tile.unit, value: e.value, color: "var(--sbel-primary)" }];
        const segs = parts.map(p => `
      <div class="${P}-sb-row">
        <span class="${P}-sb-lbl">${esc(p.label)}</span>
        <div class="${P}-track"><div class="${P}-fill" style="--w:${Math.max(2, Math.round((p.value / max) * 100))}%;background:${esc(p.color)}"></div></div>
        <span class="${P}-sb-v">${fmt(p.value)}</span>
      </div>`).join("");
        return `<div class="${P}-sb">
      <div class="${P}-sb-head">${avatar(e, 32)}<div class="${P}-row-top">${nameCell(e)}</div></div>
      ${segs}
    </div>`;
    }).join("");
    return `${chartOpen(tile, "sharebars")}${rows}</div>`;
}
// ── Donut of reaction types ──────────────────────────────────────────────────
/**
 * Only rendered when session auth resolved reaction *types* (the token-only
 * `/posts/{id}/likes` path yields untyped likes, where a donut of one slice
 * would be meaningless). The winner's avatar sits in the hole as an HTML
 * overlay, not an SVG `<image>`, so the initials fallback still works.
 */
function donut(tile) {
    const win = tile.entries[0];
    const parts = ((win === null || win === void 0 ? void 0 : win.parts) || []).filter(p => p.value > 0);
    if (!win || parts.length < 2)
        return bars(tile);
    const total = parts.reduce((a, p) => a + p.value, 0) || 1;
    const r = 54, c = 2 * Math.PI * r;
    let offset = 0;
    const arcs = parts.map(p => {
        const len = (p.value / total) * c;
        const seg = `<circle class="${P}-arc" cx="70" cy="70" r="${r}" fill="none"
      stroke="${esc(p.color)}" stroke-width="16" stroke-linecap="butt"
      stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}"
      transform="rotate(-90 70 70)"><title>${esc(p.label)}: ${fmt(p.value)}</title></circle>`;
        offset += len;
        return seg;
    }).join("");
    const legend = parts.map(p => `<li><i style="background:${esc(p.color)}"></i>${esc(p.label)}<b>${fmt(p.value)}</b></li>`).join("");
    return `${chartOpen(tile, "donut")}
    <div class="${P}-donut-wrap">
      <svg viewBox="0 0 140 140" width="140" height="140" aria-hidden="true">
        <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--sbel-track)" stroke-width="16"></circle>
        ${arcs}
      </svg>
      <div class="${P}-donut-mid">${avatar(win, 64)}</div>
    </div>
    <div class="${P}-donut-side">
      <div class="${P}-row-top">${nameCell(win)}</div>
      <ul class="${P}-legend">${legend}</ul>
    </div>
  </div>`;
}
// ── Slope chart (Rising Star) ────────────────────────────────────────────────
/** Growth is a two-point comparison, so a slope is the honest encoding: a bar
 *  chart of the current value would hide the delta that defines the metric. */
function slope(tile) {
    const e = tile.entries;
    if (!e.length)
        return "";
    const max = Math.max(...e.map(x => Math.max(x.value, x.previous || 0))) || 1;
    const W = 220, H = 120, pad = 14;
    const y = (v) => pad + (1 - v / max) * (H - pad * 2);
    const lines = e.map((x, i) => {
        const col = i === 0 ? "var(--sbel-primary)" : "var(--sbel-muted-line)";
        return `<line x1="${pad}" y1="${y(x.previous || 0)}" x2="${W - pad}" y2="${y(x.value)}"
      stroke="${col}" stroke-width="${i === 0 ? 3 : 2}" stroke-linecap="round" opacity="${i === 0 ? 1 : 0.55}"/>
      <circle cx="${pad}" cy="${y(x.previous || 0)}" r="3.5" fill="${col}" opacity="${i === 0 ? 1 : 0.55}"/>`;
    }).join("");
    const win = e[0];
    const delta = win.value - (win.previous || 0);
    const topPct = (y(win.value) / H) * 100;
    return `${chartOpen(tile, "slope")}
    <div class="${P}-slope-wrap" style="--sw:${W}px;--sh:${H}px">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
      <div class="${P}-slope-av" style="top:${topPct}%">${avatar(win, 40, `${P}-av-ring`)}</div>
    </div>
    <div class="${P}-slope-info">
      <div class="${P}-row-top">${nameCell(win)}</div>
      <div class="${P}-delta">▲ +${fmt(delta)} <span>${esc(tile.unit)}</span></div>
    </div>
  </div>`;
}
// ── Stacked composition bar ──────────────────────────────────────────────────
/** Explains a weighted score by decomposing it. Without this the "Most engaged"
 *  number is a magic value nobody can audit. */
function composition(tile) {
    const win = tile.entries[0];
    const parts = ((win === null || win === void 0 ? void 0 : win.parts) || []).filter(p => p.value > 0);
    if (!win || parts.length < 2)
        return "";
    const total = parts.reduce((a, p) => a + p.value, 0) || 1;
    const segs = parts.map(p => `<span class="${P}-cseg" style="--w:${(p.value / total) * 100}%;background:${esc(p.color)}" title="${esc(p.label)}: ${fmt(p.value)}"></span>`).join("");
    const legend = parts.map(p => `<li><i style="background:${esc(p.color)}"></i>${esc(p.label)}</li>`).join("");
    return `<div class="${P}-comp"><div class="${P}-cbar">${segs}</div><ul class="${P}-legend ${P}-legend-h">${legend}</ul></div>`;
}
// ── Bubble map (optional, full width) ────────────────────────────────────────
/**
 * x = breadth (distinct posts touched), y = volume (total actions), radius ∝
 * score. Avatars are HTML overlays positioned in percentages over an SVG grid.
 */
function bubbleMap(points, label) {
    if (points.length < 3)
        return "";
    const maxX = Math.max(...points.map(p => p.x)) || 1;
    const maxY = Math.max(...points.map(p => p.y)) || 1;
    const maxS = Math.max(...points.map(p => p.size)) || 1;
    const nodes = points.map(p => {
        const size = 24 + Math.round((p.size / maxS) * 28);
        const left = 6 + (p.x / maxX) * 86;
        const bottom = 8 + (p.y / maxY) * 80;
        return `<div class="${P}-bub" style="left:${left}%;bottom:${bottom}%">${avatar(p.entry, size)}</div>`;
    }).join("");
    const grid = [25, 50, 75].map(v => `<line x1="0" y1="${v}" x2="100" y2="${v}" stroke="var(--sbel-track)" stroke-width="0.4"/>
     <line x1="${v}" y1="0" x2="${v}" y2="100" stroke="var(--sbel-track)" stroke-width="0.4"/>`).join("");
    return `<div class="${P}-bubwrap" role="img" aria-label="${esc(label)}">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${grid}</svg>
    ${nodes}
  </div>`;
}
/** Dispatch a tile to its visualization. */
function renderChart(tile) {
    switch (tile.chart) {
        case "podium": return podium(tile);
        case "donut": return donut(tile);
        case "slope": return slope(tile);
        case "share_bars": return shareBars(tile);
        default: return bars(tile);
    }
}

;// ./engagement-leaderboard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Engagement Leaderboard — a grid of engagement metric tiles computed live from
// branch data.
//
// The Staffbase API exposes no per-user engagement endpoint (the analytics
// `groupBy` enum accepts only `channelId`/`spaceId`, and
// `/branch/analytics/users/rankings` is feature-flag gated), so every
// person-level metric here is derived client-side from one pass over posts,
// reactions and comments. See `api.ts` for the auth ladder and `aggregate.ts`
// for the derivation.
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
const DEFAULT_PRIMARY_COLOR = "#0EA5E9";
const DEFAULT_ACCENT_COLOR = "#7C3AED";
const ALL_METRICS = [
    "most_active", "most_engaged", "top_commenter", "top_reactor",
    "advocacy", "most_appreciated", "top_contributor", "rising_star",
];
const CACHE_PREFIX = "sbel:v1:";
// ── Config schema ────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
        baseurl: { type: "string", title: "Base URL (e.g. https://app.staffbase.com/api)", default: DEFAULT_BASE_URL },
        authmode: { type: "string", title: "Authentication", enum: ["auto", "token", "session"], default: "auto" },
        timewindow: {
            type: "string", title: "Time Period",
            enum: ["all", "7d", "30d", "90d", "12m", "custom"], default: "90d",
        },
        autowiden: { type: "boolean", title: "Fall Back to All Time When a Period Is Empty", default: true },
        showwindowpicker: { type: "boolean", title: "Let Viewers Change the Period", default: true },
        metrics: {
            type: "array", title: "Metrics",
            items: { type: "string", enum: ALL_METRICS },
            uniqueItems: true,
            default: ALL_METRICS,
        },
        topn: { type: "number", title: "People Per Tile", default: 3 },
        channels: { type: "string", title: "Limit to Channel IDs (comma-separated)", default: "" },
        excludeuserids: { type: "string", title: "Exclude User IDs (comma-separated)", default: "" },
        maxposts: { type: "number", title: "Max Posts to Scan", default: 200 },
        cachettl: { type: "number", title: "Cache Lifetime (minutes)", default: 15 },
        showbubblemap: { type: "boolean", title: "Show Engagement Map", default: false },
        animate: { type: "boolean", title: "Animate Charts", default: true },
        usethemecolors: { type: "boolean", title: "Use Theme Colors", default: false },
        showsample: { type: "boolean", title: "Show Sample Data When Unconfigured", default: true },
        debugmode: { type: "boolean", title: "Debug Mode (on-screen logs)", default: false },
    },
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
        // Custom ranges are the only case that needs explicit dates, so the fields
        // stay hidden otherwise.
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
        // Weight overrides only make sense when "Most engaged" is on the grid.
        metrics: {},
    },
};
// Left unannotated: the widget SDK bundles its own copy of the rjsf UiSchema
// type, so an explicit annotation from @rjsf/utils is a nominal mismatch.
const uiSchema = {
    apitoken: { "ui:help": "Basic API token. Stored in the widget configuration, not in source." },
    baseurl: { "ui:help": "Must include /api, e.g. https://acme.staffbase.com/api" },
    authmode: {
        "ui:help": "Auto tries the API token first and upgrades to the signed-in session where that unlocks richer data (typed reactions).",
    },
    metrics: { "ui:widget": "checkboxes" },
    maxposts: { "ui:help": "Each post costs one extra request for its reaction list. Lower this on large branches." },
    showbubblemap: { "ui:help": "Full-width scatter of participation breadth against volume." },
};
// ── Sample data ──────────────────────────────────────────────────────────────
/** So the editor and preview always render something. Clearly badged. */
function sampleRaw() {
    const names = [
        "Nicole Adams", "Davide Bonchamp", "Fred Duchamp", "Henry Fitz",
        "Frank Fox", "Maria Apathangelou", "Kay Lion", "Edward Hall",
    ];
    const people = names.map((n, i) => ({
        id: `u${i}`, name: n, avatar: "",
        position: ["Engineer", "Designer", "Analyst", "Manager"][i % 4],
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
    return { events, posts, people, rankings, skippedPosts: 0, typedReactions: false, fetchedAt: now };
}
// ── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
.${(/* inlined export .P */"sbel")}-root{--${(/* inlined export .P */"sbel")}-r:14px;--sbel-track:rgba(0,0,0,.08);--sbel-muted-line:rgba(0,0,0,.18);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:#111827;box-sizing:border-box}
.${(/* inlined export .P */"sbel")}-root *,.${(/* inlined export .P */"sbel")}-root *::before,.${(/* inlined export .P */"sbel")}-root *::after{box-sizing:inherit}
.${(/* inlined export .P */"sbel")}-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.${(/* inlined export .P */"sbel")}-h{font-size:18px;font-weight:700;margin:0;flex:1 1 auto}
.${(/* inlined export .P */"sbel")}-sel,.${(/* inlined export .P */"sbel")}-btn{font:inherit;font-size:13px;padding:6px 10px;border:1px solid rgba(0,0,0,.14);
  border-radius:8px;background:#fff;color:inherit;cursor:pointer}
.${(/* inlined export .P */"sbel")}-btn:hover,.${(/* inlined export .P */"sbel")}-sel:hover{border-color:var(--sbel-primary)}
.${(/* inlined export .P */"sbel")}-badge{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;
  padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.06);color:#4b5563}
.${(/* inlined export .P */"sbel")}-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.${(/* inlined export .P */"sbel")}-card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:var(--${(/* inlined export .P */"sbel")}-r);
  padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.05);display:flex;flex-direction:column;min-width:0}
.${(/* inlined export .P */"sbel")}-card-wide{grid-column:1/-1}
.${(/* inlined export .P */"sbel")}-ct{font-size:14px;font-weight:700;margin:0}
.${(/* inlined export .P */"sbel")}-cs{font-size:12px;color:#6b7280;margin:2px 0 12px}
.${(/* inlined export .P */"sbel")}-note{font-size:11px;color:#92400e;background:#fef3c7;border-radius:6px;padding:4px 8px;margin-bottom:10px}
.${(/* inlined export .P */"sbel")}-empty{font-size:13px;color:#9ca3af;padding:18px 0;text-align:center}

/* Avatars — the gradient-initials fallback is driven by data-ini so a 404 image
   degrades to a labelled circle instead of a broken-image glyph. */
.${(/* inlined export .P */"sbel")}-av{position:relative;display:inline-flex;align-items:center;justify-content:center;
  border-radius:50%;overflow:hidden;flex:0 0 auto;background:rgba(0,0,0,.06);color:#fff;font-weight:700}
.${(/* inlined export .P */"sbel")}-av img{width:100%;height:100%;object-fit:cover;display:block}
.${(/* inlined export .P */"sbel")}-av-fb{background:linear-gradient(135deg,var(--sbel-primary),var(--sbel-accent))}
.${(/* inlined export .P */"sbel")}-av-fb::after{content:attr(data-ini)}
.${(/* inlined export .P */"sbel")}-av-ring{box-shadow:0 0 0 3px var(--sbel-primary),0 0 0 5px #fff}
.${(/* inlined export .P */"sbel")}-avlink{text-decoration:none;display:inline-flex}
.${(/* inlined export .P */"sbel")}-nm{font-size:13px;font-weight:600;color:inherit;text-decoration:none;display:block;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
a.${(/* inlined export .P */"sbel")}-nm:hover{text-decoration:underline}
.${(/* inlined export .P */"sbel")}-meta{font-size:11px;color:#6b7280;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Bars */
.${(/* inlined export .P */"sbel")}-row{display:flex;align-items:center;gap:10px;padding:6px 0;min-width:0}
.${(/* inlined export .P */"sbel")}-row-body{flex:1 1 auto;min-width:0}
.${(/* inlined export .P */"sbel")}-row-v{font-size:14px;font-weight:700;flex:0 0 auto;font-variant-numeric:tabular-nums}
.${(/* inlined export .P */"sbel")}-row-win .${(/* inlined export .P */"sbel")}-row-v{color:var(--sbel-primary)}
.${(/* inlined export .P */"sbel")}-track{height:8px;border-radius:999px;background:var(--sbel-track);overflow:hidden;margin-top:5px}
.${(/* inlined export .P */"sbel")}-fill{height:100%;border-radius:999px;background:rgba(0,0,0,.25);width:var(--w);
  transform-origin:left center}
.${(/* inlined export .P */"sbel")}-row .${(/* inlined export .P */"sbel")}-fill{background:rgba(0,0,0,.18)}
.${(/* inlined export .P */"sbel")}-row-win .${(/* inlined export .P */"sbel")}-fill{background:var(--sbel-primary)}

/* Podium */
.${(/* inlined export .P */"sbel")}-podium{display:flex;align-items:flex-end;justify-content:center;gap:10px;min-height:170px}
.${(/* inlined export .P */"sbel")}-pil{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1 1 0;min-width:0}
.${(/* inlined export .P */"sbel")}-pil-nm{font-size:11px;font-weight:600;text-align:center;max-width:100%;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.${(/* inlined export .P */"sbel")}-pil-v{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
.${(/* inlined export .P */"sbel")}-pil-bar{width:100%;height:var(--h);min-height:22px;max-height:104px;border-radius:8px 8px 0 0;
  background:rgba(0,0,0,.10);display:flex;align-items:flex-start;justify-content:center;
  padding-top:4px;font-size:11px;font-weight:700;color:rgba(0,0,0,.45)}
.${(/* inlined export .P */"sbel")}-pil-1 .${(/* inlined export .P */"sbel")}-pil-bar{background:var(--sbel-primary);color:#fff}

/* Solo (fewer than two data points — a one-bar chart implies a comparison
   that isn't there) */
.${(/* inlined export .P */"sbel")}-solo{display:flex;align-items:center;gap:12px;padding:10px 0}
.${(/* inlined export .P */"sbel")}-solo-txt{flex:1 1 auto;min-width:0}
.${(/* inlined export .P */"sbel")}-solo-v{font-size:26px;font-weight:800;color:var(--sbel-primary);line-height:1;text-align:right}
.${(/* inlined export .P */"sbel")}-solo-v span{display:block;font-size:11px;font-weight:600;color:#6b7280}

/* Composition + legends */
.${(/* inlined export .P */"sbel")}-comp{margin-top:12px}
.${(/* inlined export .P */"sbel")}-cbar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--sbel-track)}
.${(/* inlined export .P */"sbel")}-cseg{width:var(--w);display:block}
.${(/* inlined export .P */"sbel")}-legend{list-style:none;margin:8px 0 0;padding:0;font-size:11px;color:#4b5563}
.${(/* inlined export .P */"sbel")}-legend li{display:flex;align-items:center;gap:6px;padding:2px 0}
.${(/* inlined export .P */"sbel")}-legend b{margin-left:auto;font-variant-numeric:tabular-nums}
.${(/* inlined export .P */"sbel")}-legend-h{display:flex;flex-wrap:wrap;gap:10px}
.${(/* inlined export .P */"sbel")}-legend i{width:8px;height:8px;border-radius:2px;display:inline-block;flex:0 0 auto}

/* Donut */
.${(/* inlined export .P */"sbel")}-donut{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.${(/* inlined export .P */"sbel")}-donut-wrap{position:relative;flex:0 0 auto;line-height:0}
.${(/* inlined export .P */"sbel")}-donut-mid{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.${(/* inlined export .P */"sbel")}-donut-side{flex:1 1 130px;min-width:0}

/* Slope */
.${(/* inlined export .P */"sbel")}-slope{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.${(/* inlined export .P */"sbel")}-slope-wrap{position:relative;flex:1 1 180px;height:var(--sh);min-width:150px}
.${(/* inlined export .P */"sbel")}-slope-wrap svg{width:100%;height:100%;overflow:visible}
.${(/* inlined export .P */"sbel")}-slope-av{position:absolute;right:-6px;transform:translateY(-50%)}
.${(/* inlined export .P */"sbel")}-slope-info{flex:1 1 120px;min-width:0}
.${(/* inlined export .P */"sbel")}-delta{font-size:16px;font-weight:800;color:#059669;margin-top:4px}
.${(/* inlined export .P */"sbel")}-delta span{font-size:11px;font-weight:600;color:#6b7280}

/* Share bars */
.${(/* inlined export .P */"sbel")}-sb{padding:8px 0;border-top:1px solid rgba(0,0,0,.06)}
.${(/* inlined export .P */"sbel")}-sb:first-child{border-top:0;padding-top:0}
.${(/* inlined export .P */"sbel")}-sb-head{display:flex;align-items:center;gap:10px;margin-bottom:6px;min-width:0}
.${(/* inlined export .P */"sbel")}-sb-row{display:flex;align-items:center;gap:8px;font-size:11px;color:#4b5563}
.${(/* inlined export .P */"sbel")}-sb-lbl{flex:0 0 46px}
.${(/* inlined export .P */"sbel")}-sb-row .${(/* inlined export .P */"sbel")}-track{flex:1 1 auto;margin-top:0}
.${(/* inlined export .P */"sbel")}-sb-v{flex:0 0 auto;font-weight:700;font-variant-numeric:tabular-nums}

/* Bubble map */
.${(/* inlined export .P */"sbel")}-bubwrap{position:relative;height:230px;margin-top:6px}
.${(/* inlined export .P */"sbel")}-bubwrap svg{position:absolute;inset:0;width:100%;height:100%}
.${(/* inlined export .P */"sbel")}-bub{position:absolute;transform:translate(-50%,50%)}

/* Skeleton */
.${(/* inlined export .P */"sbel")}-sk{border-radius:8px;background:linear-gradient(90deg,rgba(0,0,0,.06),rgba(0,0,0,.11),rgba(0,0,0,.06));
  background-size:200% 100%;animation:${(/* inlined export .P */"sbel")}-sh 1.3s linear infinite;height:110px;margin-top:8px}
@keyframes ${(/* inlined export .P */"sbel")}-sh{0%{background-position:200% 0}100%{background-position:-200% 0}}

.${(/* inlined export .P */"sbel")}-log{margin-top:12px;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
  background:#111827;color:#d1d5db;border-radius:8px;padding:10px;max-height:200px;overflow:auto;
  white-space:pre-wrap;word-break:break-word}

/* Animation is opt-in per render and always yields to the OS preference. */
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-fill{animation:${(/* inlined export .P */"sbel")}-w .7s cubic-bezier(.2,.8,.2,1) both}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-pil-bar{animation:${(/* inlined export .P */"sbel")}-h .7s cubic-bezier(.2,.8,.2,1) both}
.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-arc{animation:${(/* inlined export .P */"sbel")}-d .9s ease-out both}
@keyframes ${(/* inlined export .P */"sbel")}-w{from{width:0}}
@keyframes ${(/* inlined export .P */"sbel")}-h{from{height:0}}
@keyframes ${(/* inlined export .P */"sbel")}-d{from{stroke-dasharray:0 9999}}
@media (prefers-reduced-motion:reduce){
  .${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-fill,.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-pil-bar,.${(/* inlined export .P */"sbel")}-anim .${(/* inlined export .P */"sbel")}-arc,.${(/* inlined export .P */"sbel")}-sk{animation:none}
}
@media (max-width:420px){
  .${(/* inlined export .P */"sbel")}-grid{grid-template-columns:1fr}
}
`;
// ── Factory ──────────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class EngagementLeaderboard extends BaseBlockClass {
        constructor() { super(); }
        renderBlock(container) {
            return engagement_leaderboard_awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const attr = (k) => this.getAttribute(k) || "";
                const bool = (k, dflt) => {
                    const v = this.getAttribute(k);
                    return v == null || v === "" ? dflt : v === "true";
                };
                const int = (k, dflt) => {
                    const n = parseInt(attr(k), 10);
                    return isFinite(n) && n > 0 ? n : dflt;
                };
                const apiToken = attr("apitoken") || DEFAULT_API_TOKEN;
                const baseUrl = (attr("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
                const authMode = (attr("authmode") || "auto");
                const debug = bool("debugmode", false);
                const animate = bool("animate", true);
                const autoWiden = bool("autowiden", true);
                const showPicker = bool("showwindowpicker", true);
                const showBubble = bool("showbubblemap", false);
                const showSample = bool("showsample", true);
                const topN = Math.max(1, Math.min(10, int("topn", 3)));
                const maxPosts = Math.min(1000, int("maxposts", 200));
                const cacheTtl = int("cachettl", 15) * 60000;
                const csv = (k) => attr(k).split(",").map(s => s.trim()).filter(Boolean);
                const exclude = new Set(csv("excludeuserids"));
                const channels = csv("channels");
                let metrics = ALL_METRICS.slice();
                const rawMetrics = attr("metrics");
                if (rawMetrics) {
                    let picked = [];
                    try {
                        const j = JSON.parse(rawMetrics);
                        if (Array.isArray(j))
                            picked = j.map(String);
                    }
                    catch (_) {
                        picked = rawMetrics.split(",").map(s => s.trim());
                    }
                    const valid = picked.filter(m => ALL_METRICS.indexOf(m) >= 0);
                    if (valid.length)
                        metrics = valid;
                }
                let primary = attr("primarycolor") || DEFAULT_PRIMARY_COLOR;
                let accent = attr("accentcolor") || DEFAULT_ACCENT_COLOR;
                if (bool("usethemecolors", false) && apiToken && baseUrl) {
                    const themed = yield fetchThemeColors(baseUrl, apiToken);
                    if (themed.primary)
                        primary = themed.primary;
                    if (themed.accent)
                        accent = themed.accent;
                }
                const locale = detectLocale({
                    configLocale: ((_a = widgetApi === null || widgetApi === void 0 ? void 0 : widgetApi.getContentLanguage) === null || _a === void 0 ? void 0 : _a.call(widgetApi)) || null,
                    available: AVAILABLE_LOCALES,
                });
                const t = makeT(BUNDLES, locale);
                const rtl = isRtl(locale);
                // ── Debug log ──────────────────────────────────────────────────────────
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
                // ── Shell ──────────────────────────────────────────────────────────────
                let windowKey = (attr("timewindow") || "90d");
                const customSince = attr("customsince");
                const customUntil = attr("customuntil");
                container.innerHTML = `<style>${CSS}</style>
        <div class="${(/* inlined export .P */"sbel")}-root" dir="${rtl ? "rtl" : "ltr"}"
             style="--sbel-primary:${esc(primary)};--sbel-accent:${esc(accent)}">
          <div class="${(/* inlined export .P */"sbel")}-bar">
            <h3 class="${(/* inlined export .P */"sbel")}-h">${esc(t("widget.title"))}</h3>
            <span class="${(/* inlined export .P */"sbel")}-badge ${(/* inlined export .P */"sbel")}-status" hidden></span>
            ${showPicker ? `<select class="${(/* inlined export .P */"sbel")}-sel ${(/* inlined export .P */"sbel")}-window" aria-label="${esc(t("window.custom"))}">
              ${["all", "7d", "30d", "90d", "12m"].map(k => `<option value="${k}"${k === windowKey ? " selected" : ""}>${esc(t(`window.${k}`))}</option>`).join("")}
            </select>` : ""}
            <button class="${(/* inlined export .P */"sbel")}-btn ${(/* inlined export .P */"sbel")}-refresh" type="button">${esc(t("state.refresh"))}</button>
          </div>
          <div class="${(/* inlined export .P */"sbel")}-grid ${(/* inlined export .P */"sbel")}-body"></div>
          ${debug ? `<pre class="${(/* inlined export .P */"sbel")}-log"></pre>` : ""}
        </div>`;
                const root = container.querySelector(`.${(/* inlined export .P */"sbel")}-root`);
                const body = container.querySelector(`.${(/* inlined export .P */"sbel")}-body`);
                const status = container.querySelector(`.${(/* inlined export .P */"sbel")}-status`);
                const picker = container.querySelector(`.${(/* inlined export .P */"sbel")}-window`);
                const setStatus = (text) => {
                    status.textContent = text;
                    status.hidden = !text;
                };
                const skeleton = () => {
                    body.innerHTML = metrics.map(() => `<div class="${(/* inlined export .P */"sbel")}-card"><div class="${(/* inlined export .P */"sbel")}-sk"></div></div>`).join("");
                };
                // ── Data ───────────────────────────────────────────────────────────────
                const cacheKey = `${CACHE_PREFIX}${baseUrl}|${channels.join(",")}|${maxPosts}`;
                // The window is deliberately *not* part of the key: raw events are cached
                // un-windowed so changing the period re-filters in memory with no
                // requests. Rankings are the exception — they can only be filtered
                // server-side — so they are cached per window.
                const rankingCache = new Map();
                let raw = null;
                let isSample = false;
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
                // ── Render ─────────────────────────────────────────────────────────────
                const render = () => engagement_leaderboard_awaiter(this, void 0, void 0, function* () {
                    if (!raw)
                        return;
                    const now = Date.now();
                    const win = resolveWindow(windowKey, now, customSince, customUntil);
                    const wantsAdvocacy = metrics.indexOf("advocacy") >= 0;
                    let rankings = raw.rankings;
                    let rankingsAll = raw.rankings;
                    if (wantsAdvocacy && !isSample) {
                        rankingsAll = yield rankingsFor(undefined, undefined);
                        rankings = windowKey === "all"
                            ? rankingsAll
                            : yield rankingsFor(new Date(win.since), new Date(win.until));
                    }
                    const tiles = buildTiles({
                        raw, window: win, weights: DEFAULT_WEIGHTS, topN, metrics, exclude,
                        autoWiden, rankings, rankingsAllTime: rankingsAll, t,
                        colors: {
                            comment: primary,
                            reaction: accent,
                            post: "#F59E0B",
                            breadth: "#10B981",
                        },
                    });
                    const cards = tiles.map(tile => card(tile, t)).join("");
                    const bubble = showBubble && !isSample ? bubbleCard(raw, win, exclude, t) : "";
                    body.innerHTML = cards + bubble || `<div class="${(/* inlined export .P */"sbel")}-empty">${esc(t("state.empty"))}</div>`;
                    body.classList.toggle(`${(/* inlined export .P */"sbel")}-anim`, animate);
                    const parts = [];
                    if (isSample)
                        parts.push(t("state.sample"));
                    if (raw.skippedPosts)
                        parts.push(t("state.partial"));
                    setStatus(parts.join(" · "));
                    dlog(`rendered ${tiles.length} tiles for window ${windowKey}`);
                });
                const bubbleCard = (d, win, ex, tr) => {
                    const stats = aggregate(d.events, win, ex);
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
                    const svg = bubbleMap(points.slice(0, 24), `${tr("metric.mostActive")} — ${tr("part.breadth")}`);
                    if (!svg)
                        return "";
                    return `<div class="${(/* inlined export .P */"sbel")}-card ${(/* inlined export .P */"sbel")}-card-wide">
          <h4 class="${(/* inlined export .P */"sbel")}-ct">${esc(tr("metric.mostEngaged"))}</h4>
          <p class="${(/* inlined export .P */"sbel")}-cs">${esc(tr("part.breadth"))} × ${esc(tr("unit.actions"))}</p>
          ${svg}
        </div>`;
                };
                // ── Load ───────────────────────────────────────────────────────────────
                const load = (force) => engagement_leaderboard_awaiter(this, void 0, void 0, function* () {
                    skeleton();
                    setStatus("");
                    if (!baseUrl || (!apiToken && authMode === "token")) {
                        if (showSample) {
                            raw = sampleRaw();
                            isSample = true;
                            yield render();
                            setStatus(t("state.sample"));
                        }
                        else {
                            body.innerHTML = `<div class="${(/* inlined export .P */"sbel")}-empty">${esc(t("state.configure"))}</div>`;
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
                        raw = yield loadRawData({
                            baseUrl, apiToken, authMode, maxPosts, concurrency: 4, log: dlog,
                        });
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
                            body.innerHTML = `<div class="${(/* inlined export .P */"sbel")}-empty">${esc(t("state.error"))}
              <br><button class="${(/* inlined export .P */"sbel")}-btn ${(/* inlined export .P */"sbel")}-retry" type="button">${esc(t("state.retry"))}</button></div>`;
                            const retry = body.querySelector(`.${(/* inlined export .P */"sbel")}-retry`);
                            retry === null || retry === void 0 ? void 0 : retry.addEventListener("click", () => void load(true));
                        }
                    }
                });
                picker === null || picker === void 0 ? void 0 : picker.addEventListener("change", () => {
                    windowKey = picker.value;
                    void render();
                });
                (_b = container.querySelector(`.${(/* inlined export .P */"sbel")}-refresh`)) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
                    rankingCache.clear();
                    try {
                        sessionStorage.removeItem(cacheKey);
                    }
                    catch (_) { /* ignore */ }
                    void load(true);
                });
                // Non-null assertion avoided: root is guaranteed by the innerHTML above.
                if (root && rtl)
                    root.setAttribute("dir", "rtl");
                yield load(false);
            });
        }
        static get observedAttributes() {
            return [
                "apitoken", "baseurl", "authmode", "timewindow", "customsince", "customuntil",
                "autowiden", "showwindowpicker", "metrics", "topn", "channels", "excludeuserids",
                "maxposts", "cachettl", "showbubblemap", "animate", "usethemecolors",
                "primarycolor", "accentcolor", "showsample", "debugmode",
            ];
        }
    };
};
function card(tile, t) {
    const inner = tile.entries.length
        ? renderChart(tile)
        : `<div class="${(/* inlined export .P */"sbel")}-empty">${esc(t("state.emptyTile"))}</div>`;
    // Each tile labels its own period: share data and person data have very
    // different recency, so a single global header would misreport one of them.
    const note = tile.widened ? `<div class="${(/* inlined export .P */"sbel")}-note">${esc(t("window.widened"))}</div>` : "";
    return `<div class="${(/* inlined export .P */"sbel")}-card" data-metric="${esc(tile.id)}">
    <h4 class="${(/* inlined export .P */"sbel")}-ct">${esc(tile.title)}</h4>
    <p class="${(/* inlined export .P */"sbel")}-cs">${esc(tile.subtitle)}</p>
    ${note}${inner}
  </div>`;
}
// ── Block registration ───────────────────────────────────────────────────────
const blockDefinition = {
    name: "engagement-leaderboard",
    label: "Engagement Leaderboard",
    attributes: [
        "apitoken", "baseurl", "authmode", "timewindow", "customsince", "customuntil",
        "autowiden", "showwindowpicker", "metrics", "topn", "channels", "excludeuserids",
        "maxposts", "cachettl", "showbubblemap", "animate", "usethemecolors",
        "primarycolor", "accentcolor", "showsample", "debugmode",
    ],
    factory,
    configurationSchema,
    uiSchema,
    blockLevel: "block",
    iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzBFQTVFOSIvPjxnIGZpbGw9IiNmZmYiPjxyZWN0IHg9IjM4IiB5PSI5MCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjQ0IiByeD0iNCIvPjxyZWN0IHg9IjcxIiB5PSI2NCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjcwIiByeD0iNCIvPjxyZWN0IHg9IjEwNCIgeT0iMTA0IiB3aWR0aD0iMjgiIGhlaWdodD0iMzAiIHJ4PSI0Ii8+PGNpcmNsZSBjeD0iODUiIGN5PSI0MiIgcj0iMTQiLz48L2c+PC9zdmc+",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" });

/******/ })()
;