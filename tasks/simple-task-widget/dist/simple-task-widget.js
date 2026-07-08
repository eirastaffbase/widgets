/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ../shared/i18n.ts
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
async function translateMap(texts, send) {
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
        resp = await send(payload);
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

;// ../shared/theming.ts
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
async function fetchThemeColors(baseUrl, apiToken, themeId = "primary") {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
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
        if (!res.ok)
            return {};
        const data = await res.json();
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
}

;// ./strings.ts
const STRINGS = {
    en_US: {
        loading: "Loading…",
        empty: "No tasks to show",
        noneConfigured: "No tasks configured yet.",
        errorToggle: "Couldn't update the task. Please try again.",
        toggleTask: "Toggle task",
        markDone: "Mark as done",
        reopen: "Reopen task",
        description: "Description",
        noDescription: "No description provided.",
        dueLabel: "Due",
        overdueLabel: "Overdue",
        high: "High",
        medium: "Med",
        normal: "Low",
        recurring: "Recurring",
        attachments: "Attachments",
        add: "Add",
        noAttachments: "No attachments",
        comments: "Comments",
        addComment: "Add a comment…",
        noCommentsYet: "No comments yet.",
        couldntLoadComments: "Couldn't load comments.",
        send: "Send",
        attachFile: "Attach file",
        translateBtn: "Translate",
        showOriginal: "Show original",
        translating: "Translating…",
        noPreview: "No preview available",
    },
    de_DE: {
        loading: "Wird geladen…",
        empty: "Keine Aufgaben vorhanden",
        noneConfigured: "Noch keine Aufgaben konfiguriert.",
        errorToggle: "Aufgabe konnte nicht aktualisiert werden. Bitte erneut versuchen.",
        toggleTask: "Aufgabe umschalten",
        markDone: "Als erledigt markieren",
        reopen: "Aufgabe wieder öffnen",
        description: "Beschreibung",
        noDescription: "Keine Beschreibung vorhanden.",
        dueLabel: "Fällig",
        overdueLabel: "Überfällig",
        high: "Hoch",
        medium: "Mittel",
        normal: "Niedrig",
        recurring: "Wiederkehrend",
        attachments: "Anhänge",
        add: "Hinzufügen",
        noAttachments: "Keine Anhänge",
        comments: "Kommentare",
        addComment: "Kommentar hinzufügen…",
        noCommentsYet: "Noch keine Kommentare.",
        couldntLoadComments: "Kommentare konnten nicht geladen werden.",
        send: "Senden",
        attachFile: "Datei anhängen",
        translateBtn: "Übersetzen",
        showOriginal: "Original anzeigen",
        translating: "Wird übersetzt…",
        noPreview: "Keine Vorschau verfügbar",
    },
    ar_SA: {
        loading: "جارٍ التحميل…",
        empty: "لا توجد مهام لعرضها",
        noneConfigured: "لم يتم تكوين أي مهام بعد.",
        errorToggle: "تعذّر تحديث المهمة. يرجى المحاولة مرة أخرى.",
        toggleTask: "تبديل المهمة",
        markDone: "وضع علامة كمكتملة",
        reopen: "إعادة فتح المهمة",
        description: "الوصف",
        noDescription: "لا يوجد وصف.",
        dueLabel: "الاستحقاق",
        overdueLabel: "متأخرة",
        high: "عالية",
        medium: "متوسطة",
        normal: "منخفضة",
        recurring: "متكررة",
        attachments: "المرفقات",
        add: "إضافة",
        noAttachments: "لا توجد مرفقات",
        comments: "التعليقات",
        addComment: "أضف تعليقًا…",
        noCommentsYet: "لا توجد تعليقات بعد.",
        couldntLoadComments: "تعذّر تحميل التعليقات.",
        send: "إرسال",
        attachFile: "إرفاق ملف",
        translateBtn: "ترجمة",
        showOriginal: "إظهار الأصل",
        translating: "جارٍ الترجمة…",
        noPreview: "لا تتوفر معاينة",
    },
};

;// ./simple-task-widget.ts



// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_API_TOKEN = "";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#da2e32";
const DEFAULT_ACCENT_COLOR = "#da2e32";
// ── Config schema ─────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        tasklist: { type: "string", title: "Tasks (store ID / task ID per line)", default: "" },
        showcompleted: { type: "boolean", title: "Show Completed Tasks", default: true },
        allowtoggle: { type: "boolean", title: "Allow Check Off", default: true },
        enablecomments: { type: "boolean", title: "Enable Comments", default: true },
        onlyassignedtome: { type: "boolean", title: "Only Show Tasks Assigned To Me", default: false },
        usethemecolors: { type: "boolean", title: "Use Theme Colors", default: false },
        backgroundcolor: { type: "string", title: "Background Color", default: "" },
        limitheight: { type: "boolean", title: "Limit Height", default: false },
    },
    // When "Use Theme Colors" is off, expose the manual Primary/Accent pickers.
    // When "Limit Height" is on, reveal the Max Height field.
    dependencies: {
        usethemecolors: {
            oneOf: [
                { properties: { usethemecolors: { const: false },
                        primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY_COLOR },
                        accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT_COLOR } } },
                { properties: { usethemecolors: { const: true } } },
            ],
        },
        limitheight: {
            oneOf: [
                { properties: { limitheight: { const: false } } },
                { properties: { limitheight: { const: true }, maxheight: { type: "string", title: "Max Height (px)", default: "600" } } },
            ],
        },
    },
};
const uiSchema = {
    apitoken: { "ui:widget": "password", "ui:help": "Staffbase Basic auth token" },
    baseurl: { "ui:help": "Staffbase API base URL" },
    tasklist: { "ui:widget": "textarea", "ui:help": "One task per line, as storeID/taskID — the store (installation) ID and the task ID, separated by a / or :. Both IDs appear in the task's URL and in the Tasks API responses." },
    showcompleted: { "ui:help": "When off, tasks already marked done are hidden from the checklist" },
    allowtoggle: { "ui:help": "Let viewers check tasks off (marks them done via the API). Turn off for a read-only checklist." },
    enablecomments: { "ui:help": "Show a comments section in the task detail panel (uses the logged-in user's session)" },
    onlyassignedtome: { "ui:help": "Filter this list down to tasks assigned directly to the viewer, or to a group the viewer belongs to — same matching the My Tasks widget uses" },
    usethemecolors: { "ui:help": "Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
    primarycolor: { "ui:widget": "color", "ui:help": "Primary brand color" },
    accentcolor: { "ui:widget": "color", "ui:help": "Accent / secondary color" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background color — leave blank for transparent" },
    limitheight: { "ui:help": "Cap the widget's height — anything taller scrolls inside a styled scrollbar" },
    maxheight: { "ui:help": "Maximum height in pixels (e.g. 600). You can also include a CSS unit like 600px or 70vh." },
};
// ── Utilities ───────────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    return `${parseInt(h.slice(0, 2), 16) || 0},${parseInt(h.slice(2, 4), 16) || 0},${parseInt(h.slice(4, 6), 16) || 0}`;
}
function contrastColor(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.45 ? "#1a1a1a" : "#ffffff";
}
const TYPE_REGEX = /\[type:\s*([^\]]+)\]/i;
const RECUR_REGEX = /\[recur:\s*[^\]]+\]/i;
// Recurring Tasks widget stamps unfired templates with [type: recur-template] — treat
// that as the "Recurring" badge rather than a literal type badge.
const RECUR_TEMPLATE_TYPE = "recur-template";
function parseTaskType(text) { const m = TYPE_REGEX.exec(text); return m ? m[1].trim().toLowerCase() : null; }
// Strip the hidden bracket markers other task widgets stamp into titles/descriptions.
function stripTags(text) {
    return text.replace(/\[[a-zA-Z]+:[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim();
}
// Type-badge color — deterministic per type (no palette config on this widget).
const TYPE_COLORS = {
    storetask: "#da2e32", compliance: "#8B4513", maintenance: "#2E7D4A",
    training: "#4A90A4", audit: "#7C3AED", safety: "#D97706", inventory: "#0369A1",
    finance: "#0369A1", operations: "#2E7D4A", merchandising: "#7C3AED",
};
function typeColor(type) {
    const key = type.toLowerCase();
    if (TYPE_COLORS[key])
        return TYPE_COLORS[key];
    let h = 0;
    for (let i = 0; i < key.length; i++)
        h = (h * 31 + key.charCodeAt(i)) & 0xffffff;
    return `hsl(${((h >> 16) & 0xff) % 360},55%,40%)`;
}
function priorityColor(p) { return p === "Priority_1" ? "#C41E3A" : p === "Priority_2" ? "#D97706" : "#6b7280"; }
// ── Widget factory ────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class SimpleTaskWidget extends BaseBlockClass {
        constructor() { super(); }
        async renderBlock(container) {
            const apiToken = this.getAttribute("apitoken") || DEFAULT_API_TOKEN;
            const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
            let primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
            let accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT_COLOR;
            const bgColor = this.getAttribute("backgroundcolor") || "";
            if (this.getAttribute("usethemecolors") === "true") {
                const themed = await fetchThemeColors(baseUrl, apiToken);
                if (themed.primary)
                    primaryColor = themed.primary;
                if (themed.accent)
                    accentColor = themed.accent;
            }
            const showCompleted = this.getAttribute("showcompleted") !== "false";
            const allowToggle = this.getAttribute("allowtoggle") !== "false";
            const enableComments = this.getAttribute("enablecomments") !== "false";
            const onlyMine = this.getAttribute("onlyassignedtome") === "true";
            // ── Limit height / scroll (same pattern as the other task widgets) ──
            const limitHeight = this.getAttribute("limitheight") === "true";
            let maxHeight = (this.getAttribute("maxheight") || "").trim();
            if (!maxHeight)
                maxHeight = "600px";
            else if (/^\d+(\.\d+)?$/.test(maxHeight))
                maxHeight += "px";
            const primaryRgb = hexToRgb(primaryColor);
            const accentRgb = hexToRgb(accentColor);
            const primaryText = contrastColor(primaryColor);
            const p = "stw";
            const refs = (this.getAttribute("tasklist") || "")
                .split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
                .map(s => { const m = s.split(/[\/:]/).map(x => x.trim()).filter(Boolean); return m.length >= 2 ? { installId: m[0], taskId: m[1] } : null; })
                .filter((x) => !!x);
            let tasks = [];
            let locale = (/* inlined export .DEFAULT_LOCALE */"en_US");
            let tr = makeT(STRINGS, locale);
            let currentUserId = "";
            let userGroupIds = [];
            // ── Content translation (titles + description) ──────────────────────
            let contentTranslated = false, translateBusy = false;
            const ctCache = {};
            const ct = (s) => { if (!contentTranslated || !s)
                return s; return ctCache[s.trim()] || s; };
            // Comment translation (independent of content translation)
            let cmtTranslated = false, cmtTrBusy = false;
            const cmtCache = {};
            let lastCmt = null;
            const groupMap = new Map();
            let groupsLoaded = false;
            // ── Auth / fetch helpers ────────────────────────────────────────────
            const apiOpts = (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: { Authorization: `Basic ${apiToken}`, "Content-Type": "application/json" } }));
            function readCsrf() {
                var _a, _b;
                const w = window;
                try {
                    const t = (_b = (_a = w.we) === null || _a === void 0 ? void 0 : _a.authMgr) === null || _b === void 0 ? void 0 : _b.csrfToken;
                    if (t)
                        return String(t);
                }
                catch (_) { }
                if (w.csrfToken)
                    return String(w.csrfToken);
                const m = document.cookie.match(/(?:^|;\s*)(?:csrf|XSRF-TOKEN|csrftoken)=([^;]+)/i);
                if (m)
                    return decodeURIComponent(m[1]);
                const meta = document.querySelector('meta[name="csrf-token"]');
                return (meta === null || meta === void 0 ? void 0 : meta.content) || "";
            }
            function sessionOpts(extra) {
                const csrf = readCsrf();
                return Object.assign(Object.assign({}, extra), { credentials: "include", headers: Object.assign(Object.assign({}, (csrf ? { "x-csrf-token": csrf } : {})), ((extra === null || extra === void 0 ? void 0 : extra.headers) || {})) });
            }
            const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const isDone = (s) => s === "DONE" || s === "done" || s === "CLOSED";
            // ── Date / labels ───────────────────────────────────────────────────
            function formatDate(iso) {
                if (!iso)
                    return { text: "", overdue: false };
                const datePart = iso.split("T")[0];
                if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart))
                    return { text: "", overdue: false };
                const [year, month, day] = datePart.split("-").map(Number);
                const d = new Date(year, month - 1, day);
                if (isNaN(d.getTime()))
                    return { text: "", overdue: false };
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const overdue = d < now;
                let text;
                try {
                    text = d.toLocaleDateString(locale.replace("_", "-"), { month: "short", day: "numeric", year: "numeric" });
                }
                catch (_) {
                    text = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                }
                return { text, overdue };
            }
            function prioLabel(pr) { return pr === "Priority_1" ? tr("high") : pr === "Priority_2" ? tr("medium") : tr("normal"); }
            // ── Media / attachments ─────────────────────────────────────────────
            const MEDIA_MAX = 25 * 1024 * 1024;
            function humanSize(b) { if (b < 1024)
                return `${b} B`; if (b < 1048576)
                return `${(b / 1024).toFixed(0)} KB`; return `${(b / 1048576).toFixed(1)} MB`; }
            function b64utf8(s) { let out = ""; const bytes = new TextEncoder().encode(s); for (const byte of bytes)
                out += String.fromCharCode(byte); return btoa(out); }
            async function uploadMedia(file) {
                var _a, _b, _c, _d;
                const create = await fetch(`${baseUrl}/media/tus`, { method: "POST", credentials: "omit",
                    headers: { Authorization: `Basic ${apiToken}`, "Tus-Resumable": "1.0.0", "Upload-Length": String(file.size),
                        "Upload-Metadata": `filename ${b64utf8(file.name)},filetype ${b64utf8(file.type || "application/octet-stream")}` } });
                if (create.status !== 201)
                    throw new Error(`upload init failed (${create.status})`);
                const loc = create.headers.get("Location");
                if (!loc)
                    throw new Error("no upload URL");
                const buf = await file.arrayBuffer();
                const CHUNK = 5 * 1024 * 1024;
                let offset = 0;
                let media = null;
                while (offset < buf.byteLength) {
                    const end = Math.min(offset + CHUNK, buf.byteLength);
                    const res = await fetch(loc, { method: "PATCH", credentials: "omit",
                        headers: { Authorization: `Basic ${apiToken}`, "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
                        body: buf.slice(offset, end) });
                    if (!res.ok)
                        throw new Error(`upload failed (${res.status})`);
                    offset = end;
                    try {
                        media = await res.clone().json();
                    }
                    catch (_) { }
                }
                if (!(media === null || media === void 0 ? void 0 : media.id))
                    throw new Error("no media id returned");
                const url = ((_a = media.resourceInfo) === null || _a === void 0 ? void 0 : _a.url) || ((_d = (_c = (_b = media.transformations) === null || _b === void 0 ? void 0 : _b.t_preview) === null || _c === void 0 ? void 0 : _c.resourceInfo) === null || _d === void 0 ? void 0 : _d.url) || "";
                return { id: media.id, url };
            }
            async function mediaMeta(id) { try {
                const r = await fetch(`${baseUrl}/media/medium/${id}/metadata`, apiOpts());
                return r.ok ? await r.json() : null;
            }
            catch (_) {
                return null;
            } }
            function originalUrl(m) {
                var _a;
                const t = ((_a = m === null || m === void 0 ? void 0 : m.thumbnail) === null || _a === void 0 ? void 0 : _a.url) || "";
                if (!t)
                    return "";
                const ext = ((String((m === null || m === void 0 ? void 0 : m.fileName) || "").match(/\.[a-z0-9]+$/i)) || [])[0] || ((m === null || m === void 0 ? void 0 : m.type) === "pdf" ? ".pdf" : "");
                let u = t.replace(/\/upload\/[^/]+\//, "/upload/");
                if (ext)
                    u = u.replace(/\.[a-z0-9]+($|\?)/i, ext + "$1");
                return u;
            }
            function attKind(m) {
                const fn = String((m === null || m === void 0 ? void 0 : m.fileName) || "");
                const mime = String((m === null || m === void 0 ? void 0 : m.mimeType) || (m === null || m === void 0 ? void 0 : m.contentType) || "").toLowerCase();
                if (/^image\//.test(mime) || /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(fn))
                    return "img";
                if (mime.indexOf("pdf") >= 0 || (m === null || m === void 0 ? void 0 : m.type) === "pdf" || /\.pdf$/i.test(fn))
                    return "pdf";
                return "other";
            }
            const mediaCache = new Map();
            async function metaCached(id) { if (mediaCache.has(id))
                return mediaCache.get(id); const m = await mediaMeta(id); mediaCache.set(id, m); return m; }
            const ATT_TOKEN = /\[attachment:([A-Za-z0-9]+)\]/g;
            function resolveAttachments(html) {
                return html.replace(ATT_TOKEN, (_m, id) => {
                    var _a;
                    const meta = mediaCache.get(id);
                    const name = esc((meta === null || meta === void 0 ? void 0 : meta.fileName) || "attachment");
                    const fn = (meta === null || meta === void 0 ? void 0 : meta.fileName) || "attachment";
                    const turl = ((_a = meta === null || meta === void 0 ? void 0 : meta.thumbnail) === null || _a === void 0 ? void 0 : _a.url) || "";
                    const full = originalUrl(meta) || turl;
                    const kind = attKind(meta);
                    const data = `data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}"`;
                    if (kind === "img" && turl)
                        return `<a href="${esc(full)}" target="_blank" rel="noopener" ${data}><img class="${p}-cmt-att-img" src="${esc(turl)}" alt="${name}"></a>`;
                    return `<a class="${p}-cmt-att" href="${esc(full) || "#"}" target="_blank" rel="noopener" ${data}>${iClip}<span>${name}</span></a>`;
                });
            }
            // ── Comments ────────────────────────────────────────────────────────
            const CMT_CREATE_CT = "application/vnd.staffbase.tasks.comment-create.v1+json";
            const CMT_HTML_ACCEPT = "application/vnd.staffbase.tasks.comment.html-content.v1+json";
            function commentDoc(text) { const html = `<p>${esc(text)}</p>`; return { blocks: { b1: { type: "text", children: [], config: { html, text } } }, content: ["b1"] }; }
            async function loadComments(task) {
                const url = `${baseUrl}/tasks/${task.installId}/task/${task.id}/comments${currentUserId ? `?viewedBy=${currentUserId}` : ""}`;
                const r = await fetch(url, apiOpts({ headers: { Accept: CMT_HTML_ACCEPT } }));
                if (!r.ok)
                    throw new Error(`HTTP ${r.status}`);
                let d;
                try {
                    d = await r.json();
                }
                catch (_) {
                    d = [];
                }
                const arr = Array.isArray(d) ? d : (d.data || []);
                // Hide the hidden [tasks:edit] audit comments other widgets stamp.
                return arr.filter(c => commentText(c).replace(/<[^>]+>/g, " ").trim().indexOf("[tasks:edit]") !== 0);
            }
            async function postComment(task, text) {
                const url = `${baseUrl}/tasks/${task.installId}/task/${task.id}/comments`;
                const r = await fetch(url, sessionOpts({ method: "POST", headers: { "Content-Type": CMT_CREATE_CT, Accept: CMT_HTML_ACCEPT }, body: JSON.stringify({ content: commentDoc(text) }) }));
                if (!r.ok)
                    throw new Error(`HTTP ${r.status}`);
                try {
                    return await r.json();
                }
                catch (_) {
                    return null;
                }
            }
            // Hidden activity comment ([tasks:edit] prefix) — feeds the Manager Tasks
            // activity feed and the My Tasks calendar's completion date. Best-effort;
            // these comments are filtered out of the visible list above.
            async function postEditComment(task, action) {
                try {
                    await postComment(task, `[tasks:edit] ${action}`);
                }
                catch (_) { }
            }
            function commentText(c) {
                const ctn = c.content;
                if (typeof ctn === "string")
                    return ctn;
                if (ctn === null || ctn === void 0 ? void 0 : ctn.html)
                    return ctn.html;
                if (ctn === null || ctn === void 0 ? void 0 : ctn.blocks) {
                    const order = Array.isArray(ctn.content) ? ctn.content : Object.keys(ctn.blocks);
                    const parts = order.map((id) => { const b = ctn.blocks[id]; const cfg = b && b.config || {}; return cfg.html || (cfg.text ? `<p>${esc(cfg.text)}</p>` : ""); }).filter(Boolean);
                    if (parts.length)
                        return parts.join("");
                }
                if (c.text)
                    return c.text;
                return "";
            }
            function commentAuthorId(c) { var _a; return c.authorId || c.authorID || ((_a = c.author) === null || _a === void 0 ? void 0 : _a.id) || ""; }
            function commentTime(iso) {
                const t = Date.parse(iso);
                if (isNaN(t))
                    return "";
                const s = Math.floor((Date.now() - t) / 1000);
                if (s < 60)
                    return "just now";
                if (s < 3600)
                    return `${Math.floor(s / 60)}m ago`;
                if (s < 86400)
                    return `${Math.floor(s / 3600)}h ago`;
                if (s < 604800)
                    return `${Math.floor(s / 86400)}d ago`;
                return new Date(t).toLocaleDateString();
            }
            // ── Users / avatars ─────────────────────────────────────────────────
            const userCache = new Map();
            async function fetchUser(id) {
                var _a, _b, _c, _d, _e, _f;
                if (!id)
                    return { name: "User", avatar: "" };
                const hit = userCache.get(id);
                if (hit)
                    return hit;
                let info = { name: "User", avatar: "" };
                try {
                    const r = await fetch(`${baseUrl}/users/${id}`, apiOpts());
                    if (r.ok) {
                        const u = await r.json();
                        const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "User";
                        const avatar = ((_b = (_a = u.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = u.avatar) === null || _c === void 0 ? void 0 : _c.thumb) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = u.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "";
                        info = { name, avatar };
                    }
                }
                catch (_) { }
                userCache.set(id, info);
                return info;
            }
            async function fetchGroups() {
                var _a, _b, _c, _d, _e, _f;
                if (groupsLoaded)
                    return;
                groupsLoaded = true;
                try {
                    const r = await fetch(`${baseUrl}/groups?limit=200`, apiOpts());
                    if (r.ok) {
                        const d = await r.json();
                        for (const g of (d.data || [])) {
                            const name = ((_c = (_b = (_a = g.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || ((_f = (_e = (_d = g.config) === null || _d === void 0 ? void 0 : _d.localization) === null || _e === void 0 ? void 0 : _e.en_US) === null || _f === void 0 ? void 0 : _f.name) || g.name || g.id;
                            if (g.id && name)
                                groupMap.set(g.id, name);
                        }
                    }
                }
                catch (_) { }
            }
            function initials(name) { var _a, _b; const parts = name.trim().split(/\s+/); return ((((_a = parts[0]) === null || _a === void 0 ? void 0 : _a[0]) || "") + (((_b = parts[1]) === null || _b === void 0 ? void 0 : _b[0]) || "")).toUpperCase() || "?"; }
            function avatarHtml(info) {
                if (info.avatar)
                    return `<img class="${p}-cmt-av" src="${esc(info.avatar)}" alt="${esc(info.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="${p}-cmt-av ${p}-cmt-av-fb" style="display:none">${esc(initials(info.name))}</span>`;
                return `<span class="${p}-cmt-av ${p}-cmt-av-fb">${esc(initials(info.name))}</span>`;
            }
            // ── Translation network (user-session) ──────────────────────────────
            async function translateSend(payload) {
                var _a;
                const r = await fetch(`${baseUrl}/translations`, sessionOpts({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceLanguage: (/* inlined export .DEFAULT_LOCALE */"en_US"), targetLanguage: locale, contents: { value: payload } }) }));
                if (!r.ok)
                    throw new Error("translate " + r.status);
                const d = await r.json();
                return ((_a = d === null || d === void 0 ? void 0 : d.contents) === null || _a === void 0 ? void 0 : _a.value) || "";
            }
            // ── Icons ───────────────────────────────────────────────────────────
            const iconCheck = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
            const iClip = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
            const iFileGeneric = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
            const iXsmall = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            const iSend = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
            const iGlobe = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>`;
            const iCal = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
            const iUser = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
            const iGroup = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
            const iconRecur = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
            const limitCss = limitHeight ? `
          .${p}.${p}-limited{max-height:${maxHeight};overflow-y:auto;box-sizing:border-box;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(${primaryRgb},.45) transparent}
          .${p}.${p}-limited::-webkit-scrollbar{width:10px;height:10px}
          .${p}.${p}-limited::-webkit-scrollbar-track{background:transparent;margin:6px 0}
          .${p}.${p}-limited::-webkit-scrollbar-thumb{background:rgba(${primaryRgb},.32);border-radius:8px;border:3px solid transparent;background-clip:padding-box}
          .${p}.${p}-limited::-webkit-scrollbar-thumb:hover{background:rgba(${primaryRgb},.55);background-clip:padding-box}` : "";
            // ── Cleanup any panels from a prior render of this instance ──────────
            const self = this;
            if (self._stwOverlay) {
                self._stwOverlay.remove();
                self._stwOverlay = undefined;
            }
            if (self._stwDetail) {
                self._stwDetail.remove();
                self._stwDetail = undefined;
            }
            if (self._stwAModal) {
                self._stwAModal.remove();
                self._stwAModal = undefined;
            }
            if (self._stwDocKey) {
                document.removeEventListener("keydown", self._stwDocKey);
                self._stwDocKey = undefined;
            }
            if (self._stwVV && window.visualViewport) {
                window.visualViewport.removeEventListener("resize", self._stwVV);
                window.visualViewport.removeEventListener("scroll", self._stwVV);
                self._stwVV = undefined;
            }
            const instId = Math.random().toString(36).slice(2);
            try {
                container.setAttribute("dir", isRtl(locale) ? "rtl" : "ltr");
            }
            catch (_) { }
            // ── Skeleton ───────────────────────────────────────────────────────
            container.innerHTML = `
        <style>
          .${p}{--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent:${accentColor};--accent-rgb:${accentRgb};--primary-text:${primaryText};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bgColor || "transparent"};padding:16px}
          .${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
          .${p}-banner{display:none;margin-bottom:10px;padding:9px 12px;border-radius:var(--r-md);font-size:12.5px;font-weight:600;background:rgba(196,30,58,.08);color:var(--error);border:1px solid rgba(196,30,58,.2)}
          .${p}-top{display:flex;justify-content:flex-end;margin-bottom:10px}
          .${p} .${p}-tr-btn{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px!important;border:1.5px solid var(--border)!important;border-radius:var(--r-md)!important;background:#fff!important;color:var(--gray)!important;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;width:auto!important;margin:0!important;line-height:normal!important}
          .${p} .${p}-tr-btn:hover{border-color:var(--primary)!important;color:var(--primary)!important}
          .${p}-tr-btn svg{stroke:currentColor!important}
          .${p}-list{display:flex;flex-direction:column;gap:8px}
          .${p}-row{display:flex;align-items:flex-start;gap:12px;padding:11px 13px;background:#fff;border:1px solid var(--border);border-radius:var(--r-md);box-shadow:0 1px 3px rgba(0,0,0,.05),0 1px 2px rgba(0,0,0,.04);transition:opacity .25s ease,transform .15s ease,box-shadow .15s ease;cursor:pointer}
          .${p}-row:hover{box-shadow:0 4px 14px rgba(0,0,0,.09);transform:translateY(-1px)}
          .${p}-row.done{opacity:.65}
          .${p}-check-wrap{flex-shrink:0;padding-top:1px;position:relative}
          .${p} .${p}-check{width:20px!important;height:20px;border-radius:50%!important;border:2px solid #d1d5db!important;background:#fff!important;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;padding:0!important;margin:0!important;line-height:0;font-family:inherit}
          .${p} .${p}-check:hover{border-color:var(--primary)!important;background:rgba(var(--primary-rgb),.06)!important}
          .${p} .${p}-check.checked{background:var(--success)!important;border-color:var(--success)!important}
          .${p} .${p}-check:disabled{cursor:default}
          .${p} .${p}-check.checked:disabled{border-color:var(--success)!important;background:var(--success)!important}
          .${p}-check-icon{display:none}
          .${p}-check.checked .${p}-check-icon{display:block}
          .${p}-row-main{flex:1;min-width:0;padding-top:1px}
          .${p}-row-title{font-size:14px;font-weight:600;color:var(--dark);line-height:1.45;word-break:break-word;position:relative;display:inline}
          .${p}-row-title::after{content:"";position:absolute;left:0;top:50%;height:1.5px;background:var(--gray);width:0;transform:translateY(-50%);transition:width .35s ease;display:block}
          .${p}-row.done .${p}-row-title{color:var(--gray)}
          .${p}-row.done .${p}-row-title::after{width:100%}
          .${p}-row-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:5px}
          .${p}-row-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;font-size:9.5px;font-weight:700;line-height:1.4;letter-spacing:.4px;text-transform:uppercase;color:#fff;flex-shrink:0}
          .${p}-row-due{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--gray-lt);font-weight:500}
          .${p}-row-due svg{width:12px;height:12px;flex-shrink:0}
          .${p}-row-due.overdue{color:var(--error);font-weight:700}
          .${p}-row.done .${p}-row-due,.${p}-row.done .${p}-row-badge{opacity:.75}
          .${p}-state{padding:22px 8px;text-align:center;color:var(--gray);font-size:13px}
          .${p}-spin{width:18px;height:18px;border-radius:50%;border:2.5px solid rgba(var(--primary-rgb),.2);border-top-color:var(--primary);animation:${p}-spin .7s linear infinite;display:inline-block;vertical-align:middle;margin-right:7px}
          @keyframes ${p}-spin{to{transform:rotate(360deg)}}
          @keyframes ${p}-check-pop{0%{transform:scale(1)}35%{transform:scale(1.35);box-shadow:0 0 0 6px rgba(var(--primary-rgb),.12)}65%{transform:scale(.88)}100%{transform:scale(1);box-shadow:none}}
          @keyframes ${p}-uncheck-pop{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1)}}
          .${p}-check.pop-done{animation:${p}-check-pop .38s cubic-bezier(.34,1.56,.64,1) forwards}
          .${p}-check.pop-undone{animation:${p}-uncheck-pop .28s cubic-bezier(.34,1.56,.64,1) forwards}
          @keyframes ${p}-spark{0%{transform:scale(0) translate(0,0);opacity:1}100%{transform:scale(1) translate(var(--tx),var(--ty));opacity:0}}
          .${p}-spark{position:absolute;width:5px;height:5px;border-radius:50%;pointer-events:none;animation:${p}-spark .5s ease-out forwards}

          /* ── Detail panel ── */
          .${p}-overlay{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .25s ease}
          .${p}-overlay.open{opacity:1;pointer-events:auto}
          .${p}-detail{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#fff;border-radius:20px 20px 0 0;max-height:88vh;display:flex;flex-direction:column;transform:translateY(102%);transition:transform .32s cubic-bezier(.32,.72,0,1);overflow:hidden}
          .${p}-detail.open{transform:translateY(0)}
          .${p}-detail.side{left:50%;top:50%;right:auto;bottom:auto;width:min(460px,92vw);max-height:min(86vh,760px);border-radius:20px;transform:translate(-50%,-48%) scale(.97);opacity:0;pointer-events:none;box-shadow:0 24px 64px rgba(0,0,0,.28);transition:opacity .2s ease,transform .26s cubic-bezier(.32,.72,0,1)}
          .${p}-detail.side.open{transform:translate(-50%,-50%) scale(1);opacity:1;pointer-events:auto}
          .${p}-detail button{margin:0!important;box-sizing:border-box}
          .${p}-detail-handle{width:40px;height:5px;border-radius:3px;background:var(--border);margin:9px auto 2px;flex-shrink:0;cursor:grab;touch-action:none}
          .${p}-detail.side .${p}-detail-handle{display:none}
          .${p}-detail-head{display:flex;align-items:center;gap:10px;padding:16px 20px 12px;flex-shrink:0;border-bottom:1px solid var(--border);touch-action:none}
          .${p}-detail-head-badges{display:flex;gap:6px;flex-wrap:wrap;flex:1;align-items:center}
          .${p}-detail-close{width:28px;height:28px;border-radius:50%;border:none;background:#f3f4f6;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gray);flex-shrink:0;transition:background .15s,color .15s;font-family:inherit}
          .${p}-detail-close:hover{background:var(--border);color:var(--dark)}
          .${p}-detail-body{flex:1;overflow-y:auto;padding:20px;min-height:0}
          .${p}-detail-title{font-size:18px;font-weight:800;color:var(--dark);line-height:1.3;margin-bottom:14px;word-break:break-word}
          .${p}-detail-title.done{text-decoration:line-through;color:var(--gray)}
          .${p}-detail-meta{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
          .${p}-detail-meta-row{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--gray)}
          .${p}-detail-meta-row svg{flex-shrink:0;color:var(--gray-lt)}
          .${p}-detail-meta-row.overdue{color:var(--error);font-weight:600}
          .${p}-detail-meta-av{width:20px;height:20px;border-radius:50%;object-fit:cover;background:#e5e7eb;flex-shrink:0}
          .${p}-detail-desc-label{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt);margin-bottom:6px}
          .${p}-detail-desc{font-size:13px;color:var(--gray);line-height:1.65;white-space:pre-wrap;word-break:break-word}
          .${p}-detail-desc.empty{font-style:italic;color:var(--gray-lt)}
          .${p}-detail-foot{padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0}
          .${p}-detail-toggle-btn{width:100%;padding:11px;border-radius:var(--r-md);border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:8px}
          .${p}-detail-toggle-btn.done-btn{background:rgba(var(--primary-rgb),.08);border:1.5px solid rgba(var(--primary-rgb),.2);color:var(--primary)}
          .${p}-detail-toggle-btn.done-btn:hover{background:var(--primary);color:var(--primary-text)}
          .${p}-detail-toggle-btn.open-btn{background:#f3f4f6;border:1.5px solid var(--border);color:var(--gray)}
          .${p}-detail-toggle-btn.open-btn:hover{background:var(--border);color:var(--dark)}
          .${p}-type-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;line-height:1.4;letter-spacing:.5px;text-transform:uppercase;color:#fff;flex-shrink:0}
          .${p}-prio-badge{display:inline-flex;align-items:center;padding:1.5px 7px;border-radius:4px;font-size:10px;font-weight:700;line-height:1.4;letter-spacing:.3px;flex-shrink:0;border:1.5px solid currentColor}
          .${p}-recur-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.3px;flex-shrink:0;text-transform:uppercase;background:rgba(var(--primary-rgb),.1);color:var(--primary)}
          .${p}-recur-badge svg{width:9px;height:9px}
          /* ── Attachments ── */
          .${p}-att{margin-top:16px}
          .${p}-att-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
          .${p}-att-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--gray-lt)}
          .${p}-att-add{display:inline-flex!important;width:auto!important;margin:0!important;align-items:center;gap:5px;font-size:12px;font-weight:600;line-height:normal!important;color:var(--gray);background:none!important;border:none!important;cursor:pointer;font-family:inherit;padding:3px 6px!important;border-radius:var(--r-sm);transition:color .15s,background .15s}
          .${p}-att-add:hover{color:var(--primary);background:rgba(var(--primary-rgb),.06)}
          .${p}-att-add:disabled{opacity:.5;cursor:default}
          .${p}-att-grid{display:flex;flex-wrap:wrap;gap:8px}
          .${p}-att-tile{display:flex;align-items:center;gap:8px;padding:6px 9px;border:1px solid var(--border);border-radius:var(--r-md);background:#fafafa;font-size:12px;color:var(--dark);transition:border-color .15s,background .15s}
          .${p}-att-tile:hover{border-color:var(--primary);background:#fff}
          .${p}-att-link{display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;min-width:0;cursor:pointer}
          .${p}-att-thumb{width:34px;height:34px;border-radius:var(--r-sm);object-fit:cover;flex-shrink:0;background:#f3f4f6}
          .${p}-att-ico{width:34px;height:34px;border-radius:var(--r-sm);background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:var(--gray-lt);flex-shrink:0}
          .${p}-att-meta{min-width:0;display:flex;flex-direction:column;gap:1px}
          .${p}-att-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;font-weight:500}
          .${p}-att-size{color:var(--gray-lt);font-size:11px}
          .${p}-att-x{width:auto!important;margin:0 0 0 2px!important;border:none!important;background:none!important;color:var(--gray-lt);cursor:pointer;padding:3px!important;display:flex!important;border-radius:50%;flex-shrink:0;transition:color .15s,background .15s}
          .${p}-att-x:hover{color:var(--error);background:rgba(196,30,58,.08)}
          .${p}-att-empty{font-size:12px;color:var(--gray-lt)}
          /* Attachment preview modal */
          .${p}-amodal{position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;padding:16px}
          .${p}-amodal.open{display:flex}
          .${p}-amodal-card{background:#fff;border-radius:var(--r-lg);width:100%;max-width:min(900px,96vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.4)}
          .${p}-amodal-head{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid var(--border);flex-shrink:0}
          .${p}-amodal-name{flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .${p}-amodal-dl{display:inline-flex!important;align-items:center;gap:6px;width:auto!important;margin:0!important;font-family:inherit;font-size:13px;font-weight:700;line-height:normal!important;border:none!important;border-radius:var(--r-md)!important;background:var(--primary)!important;color:var(--primary-text,#fff)!important;cursor:pointer;padding:8px 14px!important;flex-shrink:0}
          .${p}-amodal-x{width:32px;height:32px;flex-shrink:0;border:none!important;border-radius:50%;background:#f3f4f6!important;color:var(--gray)!important;cursor:pointer;display:flex!important;align-items:center;justify-content:center;padding:0!important;margin:0!important}
          .${p}-amodal-body{flex:1;min-height:0;overflow:auto;background:#f1f3f5;display:flex;align-items:center;justify-content:center}
          .${p}-amodal-body img{max-width:100%;max-height:88vh;object-fit:contain;display:block}
          .${p}-amodal-body iframe,.${p}-amodal-body object,.${p}-amodal-pdf{width:100%;height:84vh;border:none;background:#fff}
          .${p}-amodal-none{display:flex;flex-direction:column;align-items:center;gap:12px;padding:48px 24px;color:var(--gray-lt);font-size:13px}
          /* ── Comments ── */
          .${p}-cmt{margin-top:18px;border-top:1px solid var(--border);padding-top:14px}
          .${p}-cmt-list{display:flex;flex-direction:column;gap:14px;margin-bottom:14px}
          .${p}-cmt-item{display:flex;gap:10px;align-items:flex-start;position:relative}
          .${p}-cmt-tr{position:absolute;top:-2px;inset-inline-end:0;display:none;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--primary)!important;background:#fff!important;border:1px solid var(--border)!important;border-radius:12px;padding:2px 8px;cursor:pointer;font-family:inherit;z-index:3;line-height:1.4}
          .${p}-cmt-tr svg{stroke:currentColor!important}
          .${p}-cmt-item:hover .${p}-cmt-tr,.${p}-cmt-item.show-tr .${p}-cmt-tr{display:inline-flex}
          .${p}-cmt-av{width:32px;height:32px;border-radius:50%;flex-shrink:0;object-fit:cover;background:#e5e7eb}
          .${p}-cmt-av-fb{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;background:var(--primary);text-transform:uppercase}
          .${p}-cmt-main{flex:1;min-width:0;background:#f6f7f9;border-radius:0 var(--r-md) var(--r-md) var(--r-md);padding:8px 12px}
          .${p}-cmt-head{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
          .${p}-cmt-author{font-size:13px;font-weight:700;color:var(--dark)}
          .${p}-cmt-time{font-size:11px;color:var(--gray-lt);flex-shrink:0}
          .${p}-cmt-body{font-size:13px;line-height:1.5;color:var(--dark);word-break:break-word}
          .${p}-cmt-body p{margin:0 0 4px}.${p}-cmt-body p:last-child{margin-bottom:0}
          .${p}-cmt-empty{font-size:12px;color:var(--gray-lt);padding:4px 0}
          .${p}-cmt-compose{display:flex;align-items:flex-start;gap:10px}
          .${p}-cmt-av-slot{flex-shrink:0}
          .${p}-cmt-field{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fafafa;padding:10px 13px;transition:border-color .15s,box-shadow .15s}
          .${p}-cmt-field:focus-within{border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
          .${p}-cmt-input{width:100%;resize:none;max-height:140px;min-height:38px;font-family:inherit;font-size:14px;line-height:1.5;border:none;background:none;color:var(--dark)}
          .${p}-cmt-input:focus{outline:none}
          .${p}-cmt-bar{display:none;align-items:center;gap:6px;margin-top:8px}
          .${p}-cmt-bar.show{display:flex}
          .${p}-cmt-attach{display:inline-flex!important;width:38px!important;height:38px;margin:0!important;align-items:center;justify-content:center;border:none!important;background:none!important;color:var(--gray);cursor:pointer;padding:0!important;border-radius:50%;line-height:normal!important;font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
          .${p}-cmt-attach:hover,.${p}-cmt-attach:active{color:var(--primary);background:rgba(var(--primary-rgb),.1)}
          .${p}-cmt-attach svg{width:18px;height:18px}
          .${p}-cmt-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0);pointer-events:none}
          .${p}-cmt-send{display:none!important;width:auto!important;margin:0!important;align-items:center!important;gap:7px!important;font-family:inherit!important;font-size:13px!important;font-weight:700!important;line-height:normal!important;white-space:nowrap!important;border:none!important;border-radius:var(--r-md)!important;background:var(--primary)!important;color:var(--primary-text,#fff)!important;cursor:pointer!important;padding:9px 16px!important;box-shadow:0 3px 10px rgba(var(--primary-rgb),.3)!important;transition:all .15s!important}
          .${p}-cmt-send.show{display:inline-flex!important}
          .${p}-cmt-send svg{width:14px;height:14px}
          .${p}-cmt-send:hover{filter:brightness(.9)!important;transform:translateY(-1px)!important}
          .${p}-cmt-chips{display:flex;flex-wrap:nowrap;gap:5px;flex:1;min-width:0;overflow-x:auto;margin:0;scrollbar-width:none}
          .${p}-cmt-chips::-webkit-scrollbar{display:none}
          .${p}-cmt-chip{display:inline-flex;align-items:center;gap:5px;max-width:130px;flex-shrink:0;font-size:11px;font-weight:600;background:rgba(var(--primary-rgb),.08);color:var(--primary);border-radius:12px;padding:3px 4px 3px 9px}
          .${p}-cmt-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .${p}-cmt-chip button{width:auto!important;margin:0!important;border:none!important;background:none!important;cursor:pointer;color:inherit;padding:1px!important;display:flex!important;opacity:.7}
          .${p}-cmt-chip button:hover{opacity:1}
          .${p}-cmt-att{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--primary)!important;text-decoration:none;background:rgba(var(--primary-rgb),.08);border-radius:6px;padding:3px 9px;margin:3px 4px 3px 0}
          .${p}-cmt-att svg{width:12px;height:12px;flex-shrink:0}
          .${p}-cmt-att-img{max-width:180px;max-height:140px;border-radius:8px;display:block;margin:5px 0;border:1px solid var(--border);cursor:pointer}
          @keyframes ${p}-cmt-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
          .${p}-cmt-item{animation:${p}-cmt-in .32s ease both}
          ${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `.${p}-cmt-list .${p}-cmt-item:nth-child(${n}){animation-delay:${(n - 1) * 0.04}s}`).join("")}
          @media (prefers-reduced-motion:reduce){.${p}-cmt-item{animation:none!important}}
          ${limitCss}
        </style>

        <div class="${p}${limitHeight ? ` ${p}-limited` : ""}">
          <div class="${p}-banner" id="${p}-banner"></div>
          <div class="${p}-top" id="${p}-top" style="display:none">
            <button type="button" class="${p}-tr-btn" id="${p}-translate" title="${tr("translateBtn")}">${iGlobe}<span id="${p}-translate-lbl">${tr("translateBtn")}</span></button>
          </div>
          <div class="${p}-list" id="${p}-list">
            <div class="${p}-state"><span class="${p}-spin"></span>${tr("loading")}</div>
          </div>
        </div>
      `;
            const listEl = container.querySelector(`#${p}-list`);
            const bannerEl = container.querySelector(`#${p}-banner`);
            const topEl = container.querySelector(`#${p}-top`);
            function showError(msg) {
                bannerEl.textContent = msg;
                bannerEl.style.display = "block";
                window.clearTimeout(bannerEl._t);
                bannerEl._t = window.setTimeout(() => { bannerEl.style.display = "none"; }, 4000);
            }
            // ── Overlay + detail panel + attachment modal (appended to body) ────
            const overlayEl = document.createElement("div");
            overlayEl.className = `${p}-overlay`;
            overlayEl.dataset.sbPortal = instId;
            document.body.appendChild(overlayEl);
            self._stwOverlay = overlayEl;
            const detailEl = document.createElement("div");
            detailEl.className = `${p}-detail`;
            detailEl.dataset.sbPortal = instId;
            detailEl.innerHTML = `
        <div class="${p}-detail-handle"></div>
        <div class="${p}-detail-head">
          <div class="${p}-detail-head-badges" id="${p}-detail-badges-${instId}"></div>
          <button type="button" class="${p}-detail-close" id="${p}-detail-close-${instId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="${p}-detail-body" id="${p}-detail-body-${instId}"></div>
        <div class="${p}-detail-foot"><button type="button" class="${p}-detail-toggle-btn" id="${p}-detail-toggle-${instId}"></button></div>
      `;
            document.body.appendChild(detailEl);
            self._stwDetail = detailEl;
            const detailBadges = detailEl.querySelector(`#${p}-detail-badges-${instId}`);
            const detailBody = detailEl.querySelector(`#${p}-detail-body-${instId}`);
            const detailToggle = detailEl.querySelector(`#${p}-detail-toggle-${instId}`);
            const detailClose = detailEl.querySelector(`#${p}-detail-close-${instId}`);
            const attModal = document.createElement("div");
            attModal.className = `${p}-amodal`;
            attModal.dataset.sbPortal = instId;
            attModal.innerHTML = `
        <div class="${p}-amodal-card">
          <div class="${p}-amodal-head">
            <span class="${p}-amodal-name" id="${p}-amodal-name-${instId}"></span>
            <button type="button" class="${p}-amodal-dl" id="${p}-amodal-dl-${instId}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>
            <button type="button" class="${p}-amodal-x" id="${p}-amodal-x-${instId}" aria-label="Close"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="${p}-amodal-body" id="${p}-amodal-body-${instId}"></div>
        </div>`;
            document.body.appendChild(attModal);
            self._stwAModal = attModal;
            const aName = attModal.querySelector(`#${p}-amodal-name-${instId}`);
            const aBody = attModal.querySelector(`#${p}-amodal-body-${instId}`);
            const aDl = attModal.querySelector(`#${p}-amodal-dl-${instId}`);
            const aX = attModal.querySelector(`#${p}-amodal-x-${instId}`);
            let dlUrl = "", dlName = "";
            function openAttModal(previewUrl, downloadUrl, name, kind) {
                dlUrl = downloadUrl || previewUrl;
                dlName = name || "file";
                aName.textContent = dlName;
                const none = `<div class="${p}-amodal-none"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${tr("noPreview")}</span></div>`;
                if (kind === "pdf" && downloadUrl) {
                    aBody.innerHTML = `<object class="${p}-amodal-pdf" data="${esc(downloadUrl)}" type="application/pdf"><iframe src="${esc(downloadUrl)}" title="${esc(dlName)}"></iframe></object>`;
                }
                else if (kind === "img") {
                    aBody.innerHTML = `<img alt="${esc(dlName)}">`;
                    const img = aBody.querySelector("img");
                    img.src = downloadUrl || previewUrl;
                    img.onerror = () => { if (previewUrl && img.getAttribute("src") !== previewUrl) {
                        img.src = previewUrl;
                    } };
                }
                else {
                    aBody.innerHTML = none;
                }
                attModal.classList.add("open");
            }
            function closeAttModal() { attModal.classList.remove("open"); aBody.innerHTML = ""; }
            aX.addEventListener("click", closeAttModal);
            attModal.addEventListener("click", e => { if (e.target === attModal)
                closeAttModal(); });
            aDl.addEventListener("click", async () => {
                if (!dlUrl)
                    return;
                const name = dlName;
                try {
                    const res = await fetch(dlUrl);
                    const blob = await res.blob();
                    const navAny = navigator;
                    const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
                    if (navAny.canShare && navAny.canShare({ files: [file] })) {
                        await navAny.share({ files: [file], title: name });
                        return;
                    }
                    const obj = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = obj;
                    a.download = name;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(obj), 5000);
                }
                catch (_) {
                    window.open(dlUrl, "_blank");
                }
            });
            detailBody.addEventListener("click", e => {
                const a = e.target.closest("[data-att-url]");
                if (!a)
                    return;
                e.preventDefault();
                openAttModal(a.dataset.attPreview || a.dataset.attUrl || "", a.dataset.attUrl || "", a.dataset.attName || "file", a.dataset.attKind || "other");
            });
            // ── Drag-to-dismiss the bottom sheet (mobile only) ──────────────────
            (function setupSheetDrag() {
                let startY = 0, dy = 0, dragging = false;
                const begin = (y) => { if (detailEl.classList.contains("side"))
                    return; dragging = true; startY = y; dy = 0; detailEl.style.transition = "none"; };
                const move = (y) => { if (!dragging)
                    return; dy = Math.max(0, y - startY); detailEl.style.transform = `translateY(${dy}px)`; overlayEl.style.opacity = String(Math.max(0, 1 - dy / 420)); };
                const end = () => { if (!dragging)
                    return; dragging = false; detailEl.style.transition = ""; detailEl.style.transform = ""; overlayEl.style.opacity = ""; if (dy > 110)
                    closeDetail(); };
                [`.${p}-detail-handle`, `.${p}-detail-head`].forEach(sel => {
                    const el = detailEl.querySelector(sel);
                    if (!el)
                        return;
                    el.addEventListener("touchstart", (e) => begin(e.touches[0].clientY), { passive: true });
                    el.addEventListener("touchmove", (e) => { move(e.touches[0].clientY); if (dragging && dy > 0)
                        e.preventDefault(); }, { passive: false });
                    el.addEventListener("touchend", end);
                    el.addEventListener("touchcancel", end);
                });
            })();
            detailEl.addEventListener("click", e => e.stopPropagation());
            overlayEl.addEventListener("click", closeDetail);
            detailClose.addEventListener("click", e => { e.stopPropagation(); closeDetail(); });
            const onDocKey = (e) => { if (e.key === "Escape" && detailTask)
                closeDetail(); };
            document.addEventListener("keydown", onDocKey);
            self._stwDocKey = onDocKey;
            // Lift the bottom-sheet above the on-screen keyboard (mobile).
            const vv = window.visualViewport;
            const onViewport = () => {
                if (!detailTask || detailEl.classList.contains("side")) {
                    detailEl.style.bottom = "";
                    return;
                }
                if (!vv)
                    return;
                const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
                detailEl.style.bottom = kb > 80 ? kb + "px" : "";
            };
            if (vv) {
                vv.addEventListener("resize", onViewport);
                vv.addEventListener("scroll", onViewport);
                self._stwVV = onViewport;
            }
            detailToggle.addEventListener("click", async () => {
                if (!detailTask)
                    return;
                const task = detailTask;
                const wasDone = isDone(task.status);
                const next = wasDone ? "OPEN" : "CLOSED";
                detailToggle.disabled = true;
                try {
                    const res = await fetch(`${baseUrl}/tasks/${task.installId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ status: next }) }));
                    if (!res.ok)
                        throw new Error(`HTTP ${res.status}`);
                    task.status = next;
                    renderDetailContent(task);
                    render();
                    // Record the status change so it surfaces in the activity feed / calendar.
                    postEditComment(task, `${next === "CLOSED" ? "completed" : "reopened"} “${task.title}”`);
                }
                catch (e) {
                    showError(tr("errorToggle"));
                }
                detailToggle.disabled = false;
            });
            // ── Sparkle burst ───────────────────────────────────────────────────
            function spawnSparks(wrap, color) {
                [0, 45, 90, 135, 180, 225, 270, 315].forEach(deg => {
                    const spark = document.createElement("div");
                    spark.className = `${p}-spark`;
                    const rad = (deg * Math.PI) / 180;
                    const dist = 14 + Math.random() * 8;
                    spark.style.cssText = `background:${color};left:50%;top:50%;margin:-2.5px;--tx:${Math.cos(rad) * dist}px;--ty:${Math.sin(rad) * dist}px;`;
                    wrap.appendChild(spark);
                    spark.addEventListener("animationend", () => spark.remove());
                });
            }
            // ── Comments rendering ──────────────────────────────────────────────
            async function renderComments(task) {
                const list = detailBody.querySelector(`#${p}-cmt-list-${instId}`);
                if (!list)
                    return;
                list.innerHTML = `<div class="${p}-cmt-empty">${tr("loading")}</div>`;
                let comments = [];
                try {
                    comments = await loadComments(task);
                }
                catch (e) {
                    if (detailTask !== task)
                        return;
                    list.innerHTML = `<div class="${p}-cmt-empty">${tr("couldntLoadComments")}</div>`;
                    return;
                }
                if (detailTask !== task)
                    return;
                if (!comments.length) {
                    list.innerHTML = `<div class="${p}-cmt-empty">${tr("noCommentsYet")}</div>`;
                    return;
                }
                const authors = await Promise.all(comments.map(c => fetchUser(commentAuthorId(c))));
                const bodies = comments.map(c => commentText(c));
                const attIds = new Set();
                bodies.forEach(b => { let m; ATT_TOKEN.lastIndex = 0; while ((m = ATT_TOKEN.exec(b)))
                    attIds.add(m[1]); });
                if (attIds.size)
                    await Promise.all([...attIds].map(metaCached));
                if (detailTask !== task)
                    return;
                cmtTranslated = false;
                cmtTrBusy = false;
                lastCmt = { comments, authors, bodies, task };
                paintComments();
            }
            function paintComments() {
                if (!lastCmt)
                    return;
                const list = detailBody.querySelector(`#${p}-cmt-list-${instId}`);
                if (!list || detailTask !== lastCmt.task)
                    return;
                const { comments, authors, bodies } = lastCmt;
                const showBtn = locale !== (/* inlined export .DEFAULT_LOCALE */"en_US");
                const btnLbl = cmtTrBusy ? tr("translating") : cmtTranslated ? tr("showOriginal") : tr("translateBtn");
                list.innerHTML = comments.map((c, i) => {
                    const a = authors[i];
                    const body = cmtTranslated ? (cmtCache[bodies[i].trim()] || bodies[i]) : bodies[i];
                    return `
          <div class="${p}-cmt-item">
            ${showBtn ? `<button type="button" class="${p}-cmt-tr" title="${btnLbl}">${iGlobe}<span>${btnLbl}</span></button>` : ""}
            ${avatarHtml(a)}
            <div class="${p}-cmt-main">
              <div class="${p}-cmt-head"><span class="${p}-cmt-author">${esc(a.name)}</span><span class="${p}-cmt-time">${esc(commentTime(c.createdAt || c.created || ""))}</span></div>
              <div class="${p}-cmt-body" dir="auto">${resolveAttachments(body) || "<em>(empty)</em>"}</div>
            </div>
          </div>`;
                }).join("");
                list.querySelectorAll(`.${p}-cmt-item`).forEach(it => it.addEventListener("click", () => it.classList.toggle("show-tr")));
                list.querySelectorAll(`.${p}-cmt-tr`).forEach(b => b.addEventListener("click", e => { e.stopPropagation(); toggleComments(); }));
            }
            async function toggleComments() {
                if (cmtTrBusy || !lastCmt)
                    return;
                if (!cmtTranslated) {
                    cmtTrBusy = true;
                    paintComments();
                    const map = await translateMap(lastCmt.bodies, translateSend);
                    Object.assign(cmtCache, map);
                    cmtTrBusy = false;
                    cmtTranslated = true;
                }
                else {
                    cmtTranslated = false;
                }
                paintComments();
            }
            // ── Attachments rendering ───────────────────────────────────────────
            async function renderAttachments(task) {
                const grid = detailBody.querySelector(`#${p}-att-grid-${instId}`);
                if (!grid)
                    return;
                const ids = task.attachmentIds || [];
                if (!ids.length) {
                    grid.innerHTML = `<span class="${p}-att-empty">${tr("noAttachments")}</span>`;
                    return;
                }
                grid.innerHTML = `<span class="${p}-att-empty">${tr("loading")}</span>`;
                const metas = await Promise.all(ids.map(metaCached));
                if (detailTask !== task)
                    return;
                grid.innerHTML = ids.map((id, i) => {
                    var _a, _b;
                    const m = metas[i];
                    const name = esc((m === null || m === void 0 ? void 0 : m.fileName) || "file");
                    const size = (m === null || m === void 0 ? void 0 : m.size) ? `<span class="${p}-att-size">${humanSize(m.size)}</span>` : "";
                    const thumb = ((_a = m === null || m === void 0 ? void 0 : m.thumbnail) === null || _a === void 0 ? void 0 : _a.url) ? `<img class="${p}-att-thumb" src="${esc(m.thumbnail.url)}" alt="">` : `<span class="${p}-att-ico">${iFileGeneric}</span>`;
                    const fn = (m === null || m === void 0 ? void 0 : m.fileName) || "file";
                    const turl = ((_b = m === null || m === void 0 ? void 0 : m.thumbnail) === null || _b === void 0 ? void 0 : _b.url) || "";
                    const full = originalUrl(m) || turl;
                    const kind = attKind(m);
                    return `<div class="${p}-att-tile">
            <a class="${p}-att-link" href="${esc(full)}" target="_blank" rel="noopener" data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}">
              ${thumb}<span class="${p}-att-meta"><span class="${p}-att-name">${name}</span>${size}</span>
            </a>
            <button type="button" class="${p}-att-x" data-id="${esc(id)}" title="Remove">${iXsmall}</button>
          </div>`;
                }).join("");
                grid.querySelectorAll(`.${p}-att-x`).forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const rid = btn.dataset.id || "";
                        const nextIds = (task.attachmentIds || []).filter(x => x !== rid);
                        btn.disabled = true;
                        try {
                            const res = await fetch(`${baseUrl}/tasks/${task.installId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: nextIds }) }));
                            if (!res.ok)
                                throw new Error(`HTTP ${res.status}`);
                            task.attachmentIds = nextIds;
                            renderAttachments(task);
                        }
                        catch (e) {
                            showError(`Could not remove: ${e.message}`);
                            btn.disabled = false;
                        }
                    });
                });
            }
            // ── Detail content ──────────────────────────────────────────────────
            let detailTask = null;
            function openDetail(task) {
                detailTask = task;
                const isWide = window.innerWidth >= 720;
                detailEl.classList.toggle("side", isWide);
                renderDetailContent(task);
                overlayEl.classList.add("open");
                void detailEl.offsetWidth; // commit the closed (centered) state so the first open animates from it, not from the bottom
                requestAnimationFrame(() => detailEl.classList.add("open"));
            }
            function closeDetail() {
                overlayEl.classList.remove("open");
                detailEl.classList.remove("open");
                detailEl.style.bottom = "";
                detailTask = null;
            }
            function renderDetailContent(task) {
                const done = isDone(task.status);
                const dueInfo = formatDate(task.dueDate);
                const typeCol = task.taskType ? typeColor(task.taskType) : "";
                const typeText = task.taskType ? contrastColor(typeCol) : "";
                const prioCol = priorityColor(task.priority);
                const cleanDesc = task.description ? stripTags(task.description) : "";
                detailBadges.innerHTML = `
          ${task.taskType ? `<span class="${p}-type-badge" style="background:${typeCol};color:${typeText}" dir="auto">${esc(ct(task.taskType))}</span>` : ""}
          ${task.isRecurring ? `<span class="${p}-recur-badge">${iconRecur}${tr("recurring")}</span>` : ""}
          ${(task.priority && task.priority !== "Priority_3") ? `<span class="${p}-prio-badge" style="color:${prioCol};border-color:${prioCol}">${prioLabel(task.priority)}</span>` : ""}`;
                const groupRows = task.groupIds.map(gid => `<div class="${p}-detail-meta-row">${iGroup} ${esc(groupMap.get(gid) || gid)}</div>`).join("");
                const personRows = task.assigneeIds.map(aid => `<div class="${p}-detail-meta-row" data-uid="${esc(aid)}">${iUser} <span>${esc(aid)}</span></div>`).join("");
                detailBody.innerHTML = `
          <div class="${p}-detail-title ${done ? "done" : ""}" dir="auto">${esc(ct(task.title))}</div>
          <div class="${p}-detail-meta">
            ${dueInfo.text ? `<div class="${p}-detail-meta-row ${dueInfo.overdue && !done ? "overdue" : ""}">${iCal}${dueInfo.overdue && !done ? tr("overdueLabel") + " · " : tr("dueLabel") + " "}<span dir="auto">${dueInfo.text}</span></div>` : ""}
            ${groupRows}${personRows}
          </div>
          ${cleanDesc
                    ? `<div class="${p}-detail-desc-label">${tr("description")}</div><div class="${p}-detail-desc" dir="auto">${esc(ct(cleanDesc))}</div>`
                    : `<div class="${p}-detail-desc empty">${tr("noDescription")}</div>`}
          <div class="${p}-att">
            <div class="${p}-att-head">
              <span class="${p}-att-label">${tr("attachments")}</span>
              <label class="${p}-att-add" id="${p}-att-add-${instId}" for="${p}-att-input-${instId}">${iClip} ${tr("add")}</label>
            </div>
            <div class="${p}-att-grid" id="${p}-att-grid-${instId}"></div>
            <input type="file" multiple class="${p}-cmt-file" id="${p}-att-input-${instId}">
          </div>
          ${enableComments ? `
          <div class="${p}-cmt">
            <div class="${p}-att-head"><span class="${p}-att-label">${tr("comments")}</span></div>
            <div class="${p}-cmt-list" id="${p}-cmt-list-${instId}"></div>
            <div class="${p}-cmt-compose">
              <span class="${p}-cmt-av-slot" id="${p}-cmt-me-${instId}"><span class="${p}-cmt-av ${p}-cmt-av-fb">·</span></span>
              <div class="${p}-cmt-field">
                <textarea class="${p}-cmt-input" id="${p}-cmt-input-${instId}" rows="2" placeholder="${tr("addComment")}"></textarea>
                <div class="${p}-cmt-bar" id="${p}-cmt-bar-${instId}">
                  <div class="${p}-cmt-chips" id="${p}-cmt-chips-${instId}"></div>
                  <label class="${p}-cmt-attach" id="${p}-cmt-attach-${instId}" for="${p}-cmt-file-${instId}" title="${tr("attachFile")}">${iClip}</label>
                  <button type="button" class="${p}-cmt-send" id="${p}-cmt-send-${instId}">${iSend} ${tr("send")}</button>
                </div>
                <input type="file" multiple class="${p}-cmt-file" id="${p}-cmt-file-${instId}">
              </div>
            </div>
          </div>` : ""}
        `;
                // Footer toggle button
                const iconUndo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`;
                const iconChk = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                if (done) {
                    detailToggle.className = `${p}-detail-toggle-btn open-btn`;
                    detailToggle.innerHTML = `${iconUndo} ${tr("reopen")}`;
                }
                else {
                    detailToggle.className = `${p}-detail-toggle-btn done-btn`;
                    detailToggle.innerHTML = `${iconChk} ${tr("markDone")}`;
                }
                renderAttachments(task);
                // Resolve assignee IDs → names (avatars too).
                detailBody.querySelectorAll(`.${p}-detail-meta-row[data-uid]`).forEach(row => {
                    const uid = row.dataset.uid || "";
                    fetchUser(uid).then(u => {
                        if (detailTask !== task)
                            return;
                        const s = row.querySelector("span");
                        if (s && u.name)
                            s.textContent = u.name;
                        if (u.avatar) {
                            const svg = row.querySelector("svg");
                            if (svg) {
                                const img = document.createElement("img");
                                img.className = `${p}-detail-meta-av`;
                                img.src = u.avatar;
                                img.alt = "";
                                svg.replaceWith(img);
                            }
                        }
                    });
                });
                if (enableComments) {
                    renderComments(task);
                    if (currentUserId)
                        fetchUser(currentUserId).then(me => { if (detailTask !== task)
                            return; const slot = detailBody.querySelector(`#${p}-cmt-me-${instId}`); if (slot)
                            slot.innerHTML = avatarHtml(me); });
                    wireCompose(task);
                }
            }
            function wireCompose(task) {
                const cInput = detailBody.querySelector(`#${p}-cmt-input-${instId}`);
                const cSend = detailBody.querySelector(`#${p}-cmt-send-${instId}`);
                const cBar = detailBody.querySelector(`#${p}-cmt-bar-${instId}`);
                const cAttach = detailBody.querySelector(`#${p}-cmt-attach-${instId}`);
                const cFile = detailBody.querySelector(`#${p}-cmt-file-${instId}`);
                const cChips = detailBody.querySelector(`#${p}-cmt-chips-${instId}`);
                if (!cInput || !cSend)
                    return;
                const pending = [];
                const hasContent = () => !!(cInput.value.trim() || pending.length);
                const updateSendVisibility = () => { if (cBar)
                    cBar.classList.toggle("show", document.activeElement === cInput || hasContent()); cSend.classList.toggle("show", hasContent()); };
                const isTouch = (() => { try {
                    return window.matchMedia("(pointer:coarse)").matches;
                }
                catch (_) {
                    return "ontouchstart" in window;
                } })();
                cInput.addEventListener("focus", () => { cBar === null || cBar === void 0 ? void 0 : cBar.classList.add("show"); if (!isTouch)
                    return; detailBody.style.paddingBottom = "55vh"; setTimeout(() => cInput.scrollIntoView({ block: "center", behavior: "smooth" }), 350); });
                cInput.addEventListener("blur", () => { setTimeout(() => { if (isTouch)
                    detailBody.style.paddingBottom = ""; if (!hasContent())
                    cBar === null || cBar === void 0 ? void 0 : cBar.classList.remove("show"); }, 200); });
                cSend.addEventListener("mousedown", e => e.preventDefault());
                const renderChips = () => {
                    if (!cChips)
                        return;
                    cChips.innerHTML = pending.map((f, i) => `<span class="${p}-cmt-chip"><span>${esc(f.name)}</span><button type="button" data-idx="${i}">${iXsmall}</button></span>`).join("");
                    cChips.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { const idx = parseInt(b.dataset.idx || "-1", 10); if (idx >= 0) {
                        pending.splice(idx, 1);
                        renderChips();
                        updateSendVisibility();
                    } }));
                };
                cInput.addEventListener("input", () => { cInput.style.height = "auto"; cInput.style.height = Math.min(cInput.scrollHeight, 140) + "px"; updateSendVisibility(); });
                cFile === null || cFile === void 0 ? void 0 : cFile.addEventListener("change", async () => {
                    const files = Array.from(cFile.files || []);
                    cFile.value = "";
                    if (!files.length)
                        return;
                    const tooBig = files.find(f => f.size > MEDIA_MAX);
                    if (tooBig) {
                        showError(`"${tooBig.name}" exceeds ${humanSize(MEDIA_MAX)}.`);
                        return;
                    }
                    if (cAttach)
                        cAttach.disabled = true;
                    try {
                        for (const f of files) {
                            const m = await uploadMedia(f);
                            pending.push({ id: m.id, url: m.url, name: f.name });
                        }
                    }
                    catch (e) {
                        showError(`Upload failed: ${e.message}`);
                    }
                    if (cAttach)
                        cAttach.disabled = false;
                    renderChips();
                    updateSendVisibility();
                });
                const submit = async () => {
                    const text = cInput.value.trim();
                    if ((!text && !pending.length))
                        return;
                    cSend.disabled = true;
                    cInput.disabled = true;
                    let ok = false;
                    try {
                        const tokens = pending.map(f => `[attachment:${f.id}]`).join(" ");
                        const full = [text, tokens].filter(Boolean).join(text && tokens ? "\n" : "");
                        await postComment(task, full);
                        if (pending.length) {
                            const nextIds = [...(task.attachmentIds || []), ...pending.map(f => f.id)];
                            try {
                                await fetch(`${baseUrl}/tasks/${task.installId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: nextIds }) }));
                                task.attachmentIds = nextIds;
                                renderAttachments(task);
                            }
                            catch (_) { }
                        }
                        cInput.value = "";
                        cInput.style.height = "auto";
                        pending.length = 0;
                        renderChips();
                        cSend.classList.remove("show");
                        cBar === null || cBar === void 0 ? void 0 : cBar.classList.remove("show");
                        await renderComments(task);
                        ok = true;
                    }
                    catch (e) {
                        showError(`Couldn't post comment: ${e.message}`);
                    }
                    cSend.disabled = false;
                    cInput.disabled = false;
                    if (ok)
                        cInput.blur();
                    else
                        cInput.focus();
                };
                cSend.addEventListener("click", submit);
                cInput.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                    submit(); });
            }
            // ── Content translate toggle ────────────────────────────────────────
            function updateTranslateBtn() { const lbl = container.querySelector(`#${p}-translate-lbl`); if (lbl)
                lbl.textContent = translateBusy ? tr("translating") : contentTranslated ? tr("showOriginal") : tr("translateBtn"); }
            async function toggleTranslate() {
                if (translateBusy)
                    return;
                if (!contentTranslated) {
                    const texts = [];
                    for (const t of tasks) {
                        if (!t.ok)
                            continue;
                        if (t.title)
                            texts.push(t.title);
                        if (t.taskType)
                            texts.push(t.taskType);
                        const cd = t.description ? stripTags(t.description) : "";
                        if (cd)
                            texts.push(cd);
                    }
                    if (texts.length) {
                        translateBusy = true;
                        updateTranslateBtn();
                        const map = await translateMap(texts, translateSend);
                        Object.assign(ctCache, map);
                        translateBusy = false;
                    }
                    contentTranslated = true;
                }
                else {
                    contentTranslated = false;
                }
                updateTranslateBtn();
                render();
                if (detailTask)
                    renderDetailContent(detailTask);
            }
            // ── List ────────────────────────────────────────────────────────────
            function rowHtml(t) {
                const done = isDone(t.status);
                const dueInfo = formatDate(t.dueDate);
                const typeCol = t.taskType ? typeColor(t.taskType) : "";
                const typeText = t.taskType ? contrastColor(typeCol) : "";
                const meta = [];
                if (t.taskType)
                    meta.push(`<span class="${p}-row-badge" style="background:${typeCol};color:${typeText}" dir="auto">${esc(ct(t.taskType))}</span>`);
                if (t.isRecurring)
                    meta.push(`<span class="${p}-recur-badge">${iconRecur}${tr("recurring")}</span>`);
                if (dueInfo.text)
                    meta.push(`<span class="${p}-row-due${dueInfo.overdue && !done ? " overdue" : ""}">${iCal}${dueInfo.overdue && !done ? `${tr("overdueLabel")} · ${esc(dueInfo.text)}` : esc(dueInfo.text)}</span>`);
                return `<div class="${p}-row${done ? " done" : ""}" data-id="${esc(t.id)}" data-inst="${esc(t.installId)}">
          <div class="${p}-check-wrap">
            <button type="button" class="${p}-check${done ? " checked" : ""}" aria-label="${esc(tr("toggleTask"))}"${allowToggle ? "" : " disabled"}>
              <span class="${p}-check-icon">${iconCheck}</span>
            </button>
          </div>
          <div class="${p}-row-main">
            <span class="${p}-row-title" dir="auto">${esc(ct(t.title))}</span>
            ${meta.length ? `<div class="${p}-row-meta">${meta.join("")}</div>` : ""}
          </div>
        </div>`;
            }
            // Same "mine" match as the My Tasks widget: direct assignment or via a group I'm in.
            function isMyTask(t) {
                if (!currentUserId)
                    return true;
                const direct = t.assigneeIds.indexOf(currentUserId) !== -1;
                const grp = t.groupIds.some(gid => userGroupIds.indexOf(gid) !== -1);
                return direct || grp;
            }
            function render() {
                const visible = tasks.filter(t => t.ok && (showCompleted || !isDone(t.status)) && (!onlyMine || isMyTask(t)));
                if (!visible.length) {
                    listEl.innerHTML = `<div class="${p}-state">${refs.length ? tr("empty") : tr("noneConfigured")}</div>`;
                    return;
                }
                listEl.innerHTML = visible.map(rowHtml).join("");
                listEl.querySelectorAll(`.${p}-row`).forEach(row => {
                    const id = row.dataset.id, inst = row.dataset.inst;
                    const t = tasks.find(x => x.id === id && x.installId === inst);
                    const check = row.querySelector(`.${p}-check`);
                    if (allowToggle && check)
                        check.addEventListener("click", e => { e.stopPropagation(); toggle(check); });
                    row.addEventListener("click", () => { if (t)
                        openDetail(t); });
                });
            }
            async function toggle(btn) {
                const row = btn.closest(`.${p}-row`);
                const t = tasks.find(x => x.id === row.dataset.id && x.installId === row.dataset.inst);
                if (!t)
                    return;
                const done = isDone(t.status);
                const next = done ? "OPEN" : "CLOSED";
                const wrap = btn.closest(`.${p}-check-wrap`);
                btn.classList.remove("pop-done", "pop-undone");
                void btn.offsetWidth;
                btn.classList.add(done ? "pop-undone" : "pop-done");
                if (!done) {
                    btn.classList.add("checked");
                    row.classList.add("done");
                    spawnSparks(wrap, primaryColor);
                }
                else {
                    btn.classList.remove("checked");
                    row.classList.remove("done");
                }
                btn.disabled = true;
                try {
                    const res = await fetch(`${baseUrl}/tasks/${t.installId}/task/${t.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ status: next }) }));
                    if (!res.ok)
                        throw new Error(`HTTP ${res.status}`);
                    t.status = next;
                    // Record the status change so it surfaces in the activity feed / calendar.
                    postEditComment(t, `${next === "CLOSED" ? "completed" : "reopened"} “${t.title}”`);
                    if (detailTask === t)
                        renderDetailContent(t);
                    if (!showCompleted && next === "CLOSED")
                        setTimeout(render, 420);
                }
                catch (e) {
                    if (!done) {
                        btn.classList.remove("checked");
                        row.classList.remove("done");
                    }
                    else {
                        btn.classList.add("checked");
                        row.classList.add("done");
                    }
                    showError(tr("errorToggle"));
                }
                if (allowToggle)
                    btn.disabled = false;
            }
            // ── Locale ──────────────────────────────────────────────────────────
            async function applyLocale() {
                var _a;
                const available = Object.keys(STRINGS);
                let configLocale = "";
                try {
                    const prof = await widgetApi.getUserInformation();
                    currentUserId = (prof === null || prof === void 0 ? void 0 : prof.id) || "";
                    userGroupIds = (prof === null || prof === void 0 ? void 0 : prof.groupIDs) || [];
                    if (currentUserId) {
                        const r = await fetch(`${baseUrl}/users/${currentUserId}`, apiOpts());
                        if (r.ok) {
                            const u = await r.json();
                            configLocale = ((_a = u === null || u === void 0 ? void 0 : u.config) === null || _a === void 0 ? void 0 : _a.locale) || "";
                        }
                    }
                }
                catch (_) { }
                locale = detectLocale({ configLocale, available });
                tr = makeT(STRINGS, locale);
                const rtl = isRtl(locale);
                const dir = rtl ? "rtl" : "ltr";
                try {
                    container.setAttribute("dir", dir);
                }
                catch (_) { }
                try {
                    overlayEl.setAttribute("dir", dir);
                    detailEl.setAttribute("dir", dir);
                    attModal.setAttribute("dir", dir);
                }
                catch (_) { }
                // Translate button only meaningful off the default locale.
                if (locale !== (/* inlined export .DEFAULT_LOCALE */"en_US")) {
                    topEl.style.display = "";
                    updateTranslateBtn();
                    const b = container.querySelector(`#${p}-translate`);
                    if (b)
                        b.addEventListener("click", toggleTranslate);
                }
                else
                    topEl.style.display = "none";
            }
            // ── Load ────────────────────────────────────────────────────────────
            async function load() {
                await applyLocale();
                if (!refs.length) {
                    listEl.innerHTML = `<div class="${p}-state">${tr("noneConfigured")}</div>`;
                    return;
                }
                const needGroups = true; // groups resolved lazily; fetch once up front (cheap)
                if (needGroups)
                    fetchGroups();
                tasks = await Promise.all(refs.map(async (r) => {
                    const base = { id: r.taskId, installId: r.installId, title: "", description: "", status: "", dueDate: null, priority: "Priority_3", taskType: null, isRecurring: false, groupIds: [], assigneeIds: [], attachmentIds: [], ok: false };
                    try {
                        const res = await fetch(`${baseUrl}/tasks/${r.installId}/task/${r.taskId}`, apiOpts());
                        if (!res.ok)
                            return base;
                        const d = await res.json();
                        const desc = d.description || "";
                        const rawType = parseTaskType(d.title || "") || parseTaskType(desc);
                        const isTemplate = rawType === RECUR_TEMPLATE_TYPE;
                        return { id: d.id || r.taskId, installId: r.installId,
                            title: stripTags(d.title || "") || "(untitled)", description: desc, status: d.status || "OPEN",
                            dueDate: d.dueDate || null, priority: d.priority || "Priority_3",
                            taskType: isTemplate ? null : rawType, isRecurring: isTemplate || RECUR_REGEX.test(desc),
                            groupIds: d.groupIds || [], assigneeIds: d.assigneeIds || [], attachmentIds: d.attachmentIds || [], ok: true };
                    }
                    catch (_) {
                        return base;
                    }
                }));
                render();
            }
            load();
        }
    };
};
// ── Block registration ──────────────────────────────────────────────────────────────
const blockDefinition = {
    name: "simple-task-widget",
    label: "Simple Tasks Widget",
    attributes: ["apitoken", "baseurl", "tasklist", "showcompleted", "allowtoggle", "enablecomments", "onlyassignedtome", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor", "limitheight", "maxheight"],
    factory, configurationSchema, uiSchema, blockLevel: "block",
    iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzE2QTM0QSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzLjUgNDMuNSkgc2NhbGUoMy41KSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIxIDEwLjVWMTlhMiAyIDAgMCAxLTIgMkg1YTIgMiAwIDAgMS0yLTJWNWEyIDIgMCAwIDEgMi0yaDEyLjUiLz48cGF0aCBkPSJtOSAxMSAzIDNMMjIgNCIvPjwvZz48L3N2Zz4=",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" });

/******/ })()
;