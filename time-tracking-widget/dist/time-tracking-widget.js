/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

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
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
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
    return __awaiter(this, arguments, void 0, function* (baseUrl, apiToken, themeId = "primary", surface = "light") {
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

;// ./time-tracking-widget.ts
// Time Tracking — clock in / clock out against two user-profile fields.
//
// The whole state of the widget lives on the viewer's Staffbase profile:
//   • a status field   ("clocked-in")   holding a configurable true/false string
//   • a timestamp field ("clocked-time") holding an ISO 8601 string of the last
//     clock event, overwritten on both clock in and clock out
//
// That means the running timer is derived from the server, not from local state,
// so it survives a reload, a different device, or the app being backgrounded.
//
// Verified against the Staffbase API (see notes at readClockState/writeClockState):
// the PUT merges into the profile rather than replacing it, no acting-admin
// header is needed, and an unknown field slug fails with a descriptive 400.
var time_tracking_widget_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#0EA5E9";
const DEFAULT_ACCENT_COLOR = "#0EA5E9";
const DEFAULT_STATUS_FIELD = "clocked-in";
const DEFAULT_TIME_FIELD = "clocked-time";
const DEFAULT_IN_VALUE = "true";
const DEFAULT_OUT_VALUE = "false";
// ── Config schema ─────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token", default: "" },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        statusfield: { type: "string", title: "Status Profile Field Slug", default: DEFAULT_STATUS_FIELD },
        clockedinvalue: { type: "string", title: "Clocked-In Value", default: DEFAULT_IN_VALUE },
        clockedoutvalue: { type: "string", title: "Clocked-Out Value", default: DEFAULT_OUT_VALUE },
        timefield: { type: "string", title: "Clock Time Profile Field Slug", default: DEFAULT_TIME_FIELD },
        targethours: { type: "number", title: "Target Hours Per Day", default: 8 },
        breakminutes: { type: "number", title: "Break (minutes)", default: 30 },
        workedtodaybaseline: { type: "number", title: "Worked Today Baseline (minutes)", default: 0 },
        lastsessionminutes: { type: "number", title: "Last Session (minutes)", default: 0 },
        refreshafterclock: { type: "boolean", title: "Refresh App After Clocking", default: false },
        usethemecolors: { type: "boolean", title: "Use Theme Colors", default: false },
        backgroundcolor: { type: "string", title: "Background Color", default: "" },
        debugmode: { type: "boolean", title: "Debug Mode (on-screen logs)", default: false },
    },
    dependencies: {
        // When "Use Theme Colors" is off, expose the manual Primary/Accent pickers.
        // When on, they're hidden (colors are pulled from the branding theme instead).
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
        // The destination and the desktop opt-in are meaningless unless the refresh
        // is on, so they only appear once it is.
        refreshafterclock: {
            oneOf: [
                { properties: { refreshafterclock: { const: false } } },
                {
                    properties: {
                        refreshafterclock: { const: true },
                        refreshpath: { type: "string", title: "Refresh Destination", default: "" },
                        refreshondesktop: { type: "boolean", title: "Also Refresh On Desktop", default: false },
                    },
                },
            ],
        },
    },
};
// Left untyped on purpose: the SDK resolves @rjsf/utils to a different major
// than a direct dependency would, so annotating with an imported UiSchema makes
// the two structurally-identical types unassignable. Inference sidesteps it.
const uiSchema = {
    apitoken: { "ui:widget": "password", "ui:help": "Staffbase Basic auth token" },
    baseurl: { "ui:help": "Staffbase API base URL, e.g. https://yourorg.staffbase.com/api" },
    statusfield: { "ui:help": "Profile field slug holding the clocked-in flag. Must already exist in Admin → Profile Fields, or saving fails with “Unknown profile field”." },
    clockedinvalue: { "ui:help": "Value written to the status field when clocked in. Matching is case-insensitive." },
    clockedoutvalue: { "ui:help": "Value written to the status field when clocked out." },
    timefield: { "ui:help": "Profile field slug holding the session. Stores “IN:<time> | OUT:<time> | DAY:<minutes>”, so the previous session's length and the day's running total are kept on the server, not just in the browser." },
    targethours: { "ui:help": "Shown as the “of Nh target” sub-line under Worked Today" },
    breakminutes: { "ui:help": "Static break length shown alongside Worked Today. Set to 0 to hide the Break card entirely." },
    workedtodaybaseline: { "ui:help": "Minutes to add on top of what the widget has actually recorded today. Demo seed — leave at 0 for real tracking." },
    lastsessionminutes: { "ui:help": "Fallback “last session” length, shown only until a real session has been completed and recorded. Demo seed." },
    refreshafterclock: { "ui:help": "After clocking in or out, also refresh the surrounding app view. Uses the app's own router, so it is not a full page reload. The widget always refreshes itself regardless of this setting." },
    refreshpath: { "ui:help": "Where to send the user after clocking — a page path like /content/page/123abc, or a full URL. Leave blank to reload the page they're already on." },
    refreshondesktop: { "ui:help": "By default the refresh only runs in the mobile app, where returning to a landing page is the useful behaviour. Turn this on to do it in the desktop browser too." },
    usethemecolors: { "ui:help": "Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
    primarycolor: { "ui:widget": "color", "ui:help": "Primary brand color" },
    accentcolor: { "ui:widget": "color", "ui:help": "Accent / secondary color" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background color — leave blank for transparent" },
    debugmode: { "ui:help": "Show an on-screen log panel with a copy button — useful for debugging inside the mobile app" },
};
// ── Color utilities ───────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    return `${parseInt(h.slice(0, 2), 16) || 0},${parseInt(h.slice(2, 4), 16) || 0},${parseInt(h.slice(4, 6), 16) || 0}`;
}
function contrastColor(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    // Lean toward white text: only genuinely light backgrounds get dark text, so
    // mid-tone/saturated colors read as white rather than harsh black.
    return L > 0.45 ? "#1a1a1a" : "#ffffff";
}
// ── Icons ─────────────────────────────────────────────────────────────────────
const ICONS = {
    clock: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    play: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M8 5.5v13a.75.75 0 0 0 1.15.64l10-6.5a.75.75 0 0 0 0-1.28l-10-6.5A.75.75 0 0 0 8 5.5Z"/></svg>`,
    stop: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
};
// ── Time helpers ──────────────────────────────────────────────────────────────
/** Parse a stored profile timestamp. Returns null for unset/blank/garbage. */
function parseStamp(raw) {
    const s = (raw || "").trim();
    if (!s)
        return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}
/** Elapsed ms between a start and now, clamped at 0 so a skewed device clock
 *  shows 00:00:00 rather than a negative timer. */
function elapsedMs(from) {
    if (!from)
        return 0;
    return Math.max(0, Date.now() - from.getTime());
}
function fmtDuration(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
/** Compact "7h 20min" / "45min" for the summary cards. */
function fmtMinutes(mins) {
    const total = Math.max(0, Math.round(mins));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (!h)
        return `${m}min`;
    return m ? `${h}h ${m}min` : `${h}h`;
}
function fmtClockTime(d) {
    try {
        return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    catch (_a) {
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
}
function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const TOKEN_RE = (name) => new RegExp(`\\b${name}\\s*:\\s*([^|\\s]+)`, "i");
/** Parse the stored value. Tolerates the older bare-ISO form, so fields written
 *  by a previous version of this widget keep working. */
function parseClockValue(raw, clockedIn) {
    const s = (raw || "").trim();
    if (!s)
        return { inAt: null, outAt: null, dayMinutes: 0 };
    const grab = (name) => {
        const m = TOKEN_RE(name).exec(s);
        return m ? parseStamp(m[1]) : null;
    };
    const inAt = grab("IN");
    const outAt = grab("OUT");
    if (!inAt && !outAt) {
        // Legacy: the whole value is a single timestamp. Which end it represents
        // depends on the status field.
        const only = parseStamp(s);
        return { inAt: clockedIn ? only : null, outAt: clockedIn ? null : only, dayMinutes: 0 };
    }
    const dayM = TOKEN_RE("DAY").exec(s);
    const dayMinutes = dayM ? Math.max(0, parseFloat(dayM[1]) || 0) : 0;
    return { inAt, outAt, dayMinutes };
}
function formatClockValue(v) {
    const parts = [];
    if (v.inAt)
        parts.push(`IN:${v.inAt.toISOString()}`);
    if (v.outAt)
        parts.push(`OUT:${v.outAt.toISOString()}`);
    parts.push(`DAY:${Math.max(0, Math.round(v.dayMinutes))}`);
    return parts.join(" | ");
}
/** The most recent event in the value, used to decide whether DAY is stale. */
function latestEvent(v) {
    if (v.outAt && v.inAt)
        return v.outAt.getTime() >= v.inAt.getTime() ? v.outAt : v.inAt;
    return v.outAt || v.inAt;
}
/** Minutes banked today. Zero once the stored day has rolled over, so a stale
 *  DAY from yesterday never leaks into today's total. */
function minutesBankedToday(v) {
    const last = latestEvent(v);
    if (!last || !isSameDay(last, new Date()))
        return 0;
    return v.dayMinutes;
}
/** Length of the completed session, in minutes, or 0 if there isn't one.
 *  Guards against OUT preceding IN, which a clock change could produce. */
function completedSessionMinutes(v) {
    if (!v.inAt || !v.outAt)
        return 0;
    return Math.max(0, (v.outAt.getTime() - v.inAt.getTime()) / 60000);
}
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// The widget only ever writes the profile of the viewer resolved by
// widgetApi.getUserInformation(), and the service token was verified to do that
// without an acting-admin USERID header — so there's nothing else to configure.
function authHeaders(token) {
    return {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/json",
    };
}
/** Pull the API's own error message out of a failed response.
 *  A mistyped field slug returns 400 "Unknown profile field" with the offending
 *  slug in `extended.parameterName`, which is far more useful than a generic
 *  failure message — so it gets surfaced to the user verbatim. */
function apiError(res, fallback) {
    return time_tracking_widget_awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const body = yield res.json();
            const slug = (_a = body === null || body === void 0 ? void 0 : body.extended) === null || _a === void 0 ? void 0 : _a.parameterName;
            const msg = (body === null || body === void 0 ? void 0 : body.message) || (body === null || body === void 0 ? void 0 : body.error);
            if (msg)
                return slug ? `${msg} (${slug})` : String(msg);
        }
        catch ( /* non-JSON body */_b) { /* non-JSON body */ }
        return `${fallback} (HTTP ${res.status})`;
    });
}
function readClockState(cfg, userId) {
    return time_tracking_widget_awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const res = yield fetch(`${cfg.baseUrl}/users/${encodeURIComponent(userId)}`, {
            // Omit the session cookie so the request is authenticated purely by the
            // Basic API token (the service identity) — same reasoning as shared/theming.
            credentials: "omit",
            headers: { Authorization: `Basic ${cfg.token}`, Accept: "application/json" },
        });
        if (!res.ok)
            throw new Error(yield apiError(res, "Could not read your profile"));
        const data = yield res.json();
        const profile = (data === null || data === void 0 ? void 0 : data.profile) || {};
        const rawStatus = String((_a = profile[cfg.statusField]) !== null && _a !== void 0 ? _a : "");
        const rawTime = String((_b = profile[cfg.timeField]) !== null && _b !== void 0 ? _b : "");
        // Unset has two shapes — key missing entirely, or present as "" — and both
        // must read as clocked out, which falls out of the comparison naturally.
        const clockedIn = rawStatus.trim().toLowerCase() === cfg.inValue.trim().toLowerCase();
        return { clockedIn, value: parseClockValue(rawTime, clockedIn), rawStatus, rawTime };
    });
}
/** Write both fields. The PUT merges into the existing profile — other fields
 *  (points, avatar, names…) are left untouched — so a two-key object is safe. */
function writeClockState(cfg, userId, clockIn, value) {
    return time_tracking_widget_awaiter(this, void 0, void 0, function* () {
        const res = yield fetch(`${cfg.baseUrl}/users/${encodeURIComponent(userId)}`, {
            method: "PUT",
            credentials: "omit",
            headers: authHeaders(cfg.token),
            body: JSON.stringify({
                profile: {
                    [cfg.statusField]: clockIn ? cfg.inValue : cfg.outValue,
                    [cfg.timeField]: formatClockValue(value),
                },
            }),
        });
        if (!res.ok)
            throw new Error(yield apiError(res, clockIn ? "Could not clock in" : "Could not clock out"));
    });
}
// ── In-app refresh ────────────────────────────────────────────────────────────
/** True inside the Staffbase mobile app, false in a desktop browser. */
function isNativeApp() {
    const w = window;
    return !!(w.we && w.we.native);
}
/**
 * Work out where the refresh should land.
 *
 * Blank means "wherever we already are". A leading-slash path is used as-is. A
 * full URL on this origin is reduced to its path so the router can handle it
 * in-app; a URL on a *different* origin can't be routed and is flagged external,
 * so the caller does a real navigation instead of handing the router something
 * it would choke on.
 */
function resolveRefreshTarget(raw) {
    const here = location.pathname + location.search;
    const dest = (raw || "").trim();
    if (!dest)
        return { path: here, external: false };
    if (/^https?:\/\//i.test(dest)) {
        try {
            const u = new URL(dest);
            if (u.origin === location.origin)
                return { path: u.pathname + u.search + u.hash, external: false };
            return { path: dest, external: true };
        }
        catch (_a) {
            return { path: here, external: false }; // unparseable — don't strand them
        }
    }
    return { path: dest.startsWith("/") ? dest : "/" + dest, external: false };
}
/**
 * Refresh the surrounding app *without* a full document load.
 *
 * `window.NavigationMgr` is the platform router exposed for custom code; routing
 * to a path re-boots the view in place on both web and mobile. Only if it isn't
 * there do we fall back to a real navigation — which in the mobile app costs the
 * user their place.
 *
 * Gated on platform: a refresh is genuinely useful in the mobile app, but in a
 * desktop browser it yanks the page out from under someone who may be mid-scroll,
 * so desktop is opt-in.
 */
function refreshApp(dest, onDesktop, log) {
    if (!isNativeApp() && !onDesktop) {
        if (log)
            log("refresh · skipped on desktop (enable “Also Refresh On Desktop”)");
        return;
    }
    const w = window;
    const nav = w.NavigationMgr;
    const { path, external } = resolveRefreshTarget(dest);
    if (external) {
        if (log)
            log("refresh · external URL · location.assign", path);
        window.location.assign(path);
        return;
    }
    if (nav && typeof nav.goTo === "function") {
        try {
            if (isNativeApp() && typeof nav.hideAllTabs === "function")
                nav.hideAllTabs();
            if (log)
                log("refresh · NavigationMgr.goTo", path);
            nav.goTo(path);
            return;
        }
        catch (e) {
            if (log)
                log("refresh · goTo THREW", (e && e.message) || String(e), "· falling back");
        }
    }
    else if (log) {
        log("refresh · NavigationMgr unavailable · falling back to a full load");
    }
    // Without the router, going somewhere new needs assign(); staying put needs
    // reload() — assign() to the current URL wouldn't re-run anything.
    if (path === location.pathname + location.search)
        window.location.reload();
    else
        window.location.assign(path);
}
// ── Styles ────────────────────────────────────────────────────────────────────
//
// Staffbase's host CSS reaches into widgets, so every button rule re-declares
// background/color with !important for *all* states. Note the hover/focus/active
// resets carry only background/color/shadow/outline — adding width, margin or
// border-radius there makes buttons visibly collapse or square off on press.
function buildCss(p, primary, accent, bg) {
    const primaryRgb = hexToRgb(primary);
    const accentRgb = hexToRgb(accent);
    const onPrimary = contrastColor(primary);
    return `
.${p}{--primary:${primary};--primary-rgb:${primaryRgb};--accent:${accent};--accent-rgb:${accentRgb};--primary-text:${onPrimary};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--bg-soft:#f7f7f9;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;--shadow-sm:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);--shadow-md:0 4px 16px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bg || "transparent"};padding:20px}
.${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
.${p} ul,.${p} ol{list-style:none}
.${p} h1,.${p} h2,.${p} h3,.${p} h4{font-size:inherit;font-weight:inherit;margin:0;line-height:inherit}
.${p} img{max-width:none}
.${p} button{width:auto!important;margin:0!important;line-height:normal!important;font-family:inherit}

/* ── Header ── */
.${p}-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.${p}-title-dot{width:34px;height:34px;border-radius:var(--r-md);background:linear-gradient(135deg,var(--primary),var(--accent));color:var(--primary-text);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.${p}-title{font-size:18px;font-weight:800;letter-spacing:-.01em;color:var(--dark)}
.${p}-subtitle{font-size:12px;color:var(--gray);margin-top:1px}

/* ── Clock card ── */
.${p}-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);padding:22px 20px;text-align:center}
.${p}-status{display:inline-flex;align-items:center;gap:7px;padding:4px 12px;border-radius:20px;background:var(--bg-soft);font-size:12px;font-weight:700;color:var(--gray)}
.${p}-status.on{background:rgba(46,125,74,.1);color:var(--success)}
.${p}-dot{width:8px;height:8px;border-radius:50%;background:var(--gray-lt);flex-shrink:0}
.${p}-status.on .${p}-dot{background:var(--success);animation:${p}-pulse 2s ease-in-out infinite}
@keyframes ${p}-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.${p}-timer{font-size:40px;font-weight:800;letter-spacing:-.02em;color:var(--dark);margin:14px 0 4px;font-variant-numeric:tabular-nums;line-height:1.1}
.${p}-timer.idle{color:var(--gray-lt)}
.${p}-detail{font-size:13px;color:var(--gray);min-height:18px}

/* ── Clock button ── */
.${p} .${p}-btn{display:inline-flex!important;width:100%!important;align-items:center;justify-content:center;gap:8px;margin-top:18px!important;padding:13px 20px!important;border:none!important;border-radius:var(--r-md)!important;font-size:15px;font-weight:700;cursor:pointer;background:var(--primary)!important;color:var(--primary-text)!important;box-shadow:0 3px 12px rgba(var(--primary-rgb),.3);transition:filter .15s,transform .15s}
.${p} .${p}-btn:hover,.${p} .${p}-btn:focus,.${p} .${p}-btn:focus-visible{background:var(--primary)!important;color:var(--primary-text)!important;outline:none!important}
.${p} .${p}-btn:hover{filter:brightness(.92);transform:translateY(-1px)}
.${p} .${p}-btn:active{background:var(--primary)!important;color:var(--primary-text)!important;transform:translateY(0)}
.${p} .${p}-btn.out{background:var(--error)!important;color:#fff!important;box-shadow:0 3px 12px rgba(196,30,58,.28)}
.${p} .${p}-btn.out:hover,.${p} .${p}-btn.out:focus,.${p} .${p}-btn.out:focus-visible,.${p} .${p}-btn.out:active{background:var(--error)!important;color:#fff!important}
.${p} .${p}-btn:disabled{opacity:.55;cursor:not-allowed;filter:none;transform:none}
.${p} .${p}-btn svg{fill:currentColor!important;stroke:none!important;flex-shrink:0}
.${p}-spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:${p}-spin .7s linear infinite;flex-shrink:0}
@keyframes ${p}-spin{to{transform:rotate(360deg)}}

/* ── Overview cards ── */
.${p}-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.${p}-cards.single{grid-template-columns:1fr}
.${p}-ov{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);padding:14px}
.${p}-ov.hl{background:linear-gradient(135deg,rgba(var(--primary-rgb),.07),rgba(var(--accent-rgb),.04));border-color:rgba(var(--primary-rgb),.25)}
.${p}-ov-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--gray)}
.${p}-ov-val{font-size:22px;font-weight:800;color:var(--dark);margin-top:5px;font-variant-numeric:tabular-nums;line-height:1.15}
.${p}-ov.hl .${p}-ov-val{color:var(--primary)}
.${p}-ov-sub{font-size:11px;color:var(--gray-lt);margin-top:2px}

/* ── Toast ── */
.${p}-toast{margin-top:12px;padding:10px 13px;border-radius:var(--r-md);font-size:13px;font-weight:600;display:none;line-height:1.4}
.${p}-toast.show{display:block}
.${p}-toast.ok{background:rgba(46,125,74,.1);color:var(--success)}
.${p}-toast.err{background:rgba(196,30,58,.08);color:var(--error)}

/* ── Error / debug ── */
.${p}-fatal{background:rgba(196,30,58,.08);color:var(--error);border-radius:var(--r-md);padding:14px;font-size:13px;line-height:1.5}
.${p}-debug{margin-top:12px;background:var(--bg-soft);border:1px solid var(--border);border-radius:var(--r-md);padding:10px}
.${p}-debug pre{font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:var(--gray);max-height:180px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.${p} .${p}-debug-copy{display:inline-flex!important;width:auto!important;align-items:center;margin:0 0 8px 0!important;padding:4px 10px!important;border:1px solid var(--border)!important;border-radius:var(--r-sm)!important;background:#fff!important;color:var(--gray)!important;font-size:11px;font-weight:700;cursor:pointer}
.${p} .${p}-debug-copy:hover,.${p} .${p}-debug-copy:focus,.${p} .${p}-debug-copy:focus-visible,.${p} .${p}-debug-copy:active{background:#fff!important;color:var(--primary)!important;outline:none!important}
`;
}
// ── Widget ────────────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class TimeTrackingWidget extends BaseBlockClass {
        constructor() {
            super();
        }
        renderBlock(container) {
            return time_tracking_widget_awaiter(this, void 0, void 0, function* () {
                const p = "ttw";
                const self = this;
                // A previous render of this same host may have left a ticking interval
                // behind (Staffbase re-renders on attribute changes). Always clear first.
                if (self._ttwTimer) {
                    clearInterval(self._ttwTimer);
                    self._ttwTimer = undefined;
                }
                if (self._ttwObserver) {
                    self._ttwObserver.disconnect();
                    self._ttwObserver = undefined;
                }
                const attr = (n) => this.getAttribute(n) || "";
                const num = (n, d) => {
                    const v = parseFloat(attr(n));
                    return isNaN(v) ? d : v;
                };
                const bool = (n) => attr(n) === "true";
                const token = attr("apitoken");
                const baseUrl = (attr("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
                const debug = bool("debugmode");
                const cfg = {
                    baseUrl,
                    token,
                    statusField: attr("statusfield").trim() || DEFAULT_STATUS_FIELD,
                    timeField: attr("timefield").trim() || DEFAULT_TIME_FIELD,
                    inValue: attr("clockedinvalue") || DEFAULT_IN_VALUE,
                    outValue: attr("clockedoutvalue") || DEFAULT_OUT_VALUE,
                };
                const targetHours = num("targethours", 8);
                const breakMinutes = num("breakminutes", 30);
                const baselineMins = num("workedtodaybaseline", 0);
                const seedLastMins = num("lastsessionminutes", 0);
                const doAppRefresh = bool("refreshafterclock");
                const refreshPath = attr("refreshpath").trim();
                const refreshDeskt = bool("refreshondesktop");
                const bgColor = attr("backgroundcolor");
                // ── Debug log ──
                const logLines = [];
                const dlog = (...args) => {
                    if (!debug)
                        return;
                    logLines.push(`${new Date().toISOString().slice(11, 19)} ${args.join(" ")}`);
                    const pre = container.querySelector(`.${p}-debug pre`);
                    if (pre)
                        pre.textContent = logLines.join("\n");
                };
                // ── Colors ──
                let primary = attr("primarycolor") || DEFAULT_PRIMARY_COLOR;
                let accent = attr("accentcolor") || DEFAULT_ACCENT_COLOR;
                if (bool("usethemecolors") && token) {
                    try {
                        const theme = yield fetchThemeColors(baseUrl, token, "primary", "light");
                        if (theme.primary)
                            primary = theme.primary;
                        if (theme.accent)
                            accent = theme.accent;
                        dlog("theme colors", primary, accent);
                    }
                    catch (e) {
                        dlog("theme colors failed", (e && e.message) || String(e));
                    }
                }
                const css = buildCss(p, primary, accent, bgColor);
                const fatal = (msg) => {
                    container.innerHTML = `<style>${css}</style><div class="${p}"><div class="${p}-fatal">${escapeHtml(msg)}</div></div>`;
                };
                if (!token) {
                    fatal("Time Tracking isn’t configured yet — add an API Token in the widget settings.");
                    return;
                }
                // ── Identify the viewer ──
                let userId = "";
                try {
                    const prof = yield widgetApi.getUserInformation();
                    userId = (prof === null || prof === void 0 ? void 0 : prof.id) || "";
                    dlog("viewer", userId);
                }
                catch (e) {
                    dlog("getUserInformation failed", (e && e.message) || String(e));
                }
                if (!userId) {
                    fatal("Couldn’t identify you — the widget needs a signed-in Staffbase user.");
                    return;
                }
                // ── Initial read ──
                let state;
                try {
                    state = yield readClockState(cfg, userId);
                    dlog("state", `${cfg.statusField}=${JSON.stringify(state.rawStatus)}`, `${cfg.timeField}=${JSON.stringify(state.rawTime)}`);
                }
                catch (e) {
                    fatal((e && e.message) || "Couldn’t read your profile.");
                    return;
                }
                // The session's start and end both live in the time field now, so the
                // previous session's length is read back from the server rather than
                // remembered locally. The configured seed is only a fallback for a profile
                // that has never recorded a complete session.
                let lastSessionMins = seedLastMins;
                // ── Skeleton ──
                const showBreak = breakMinutes > 0;
                container.innerHTML = `
        <style>${css}</style>
        <div class="${p}">
          <div class="${p}-header">
            <div class="${p}-title-dot">${ICONS.clock}</div>
            <div>
              <div class="${p}-title">Time Tracking</div>
              <div class="${p}-subtitle" data-el="today"></div>
            </div>
          </div>

          <div class="${p}-card">
            <div class="${p}-status" data-el="status">
              <span class="${p}-dot"></span>
              <span data-el="status-text">Not clocked in</span>
            </div>
            <div class="${p}-timer idle" data-el="timer">00:00:00</div>
            <div class="${p}-detail" data-el="detail"></div>
            <button type="button" class="${p}-btn" data-el="btn"></button>
          </div>

          <div class="${p}-cards${showBreak ? "" : " single"}">
            <div class="${p}-ov hl">
              <div class="${p}-ov-label">Worked Today</div>
              <div class="${p}-ov-val" data-el="worked">–</div>
              <div class="${p}-ov-sub" data-el="worked-sub"></div>
            </div>
            ${showBreak ? `
            <div class="${p}-ov">
              <div class="${p}-ov-label">Break</div>
              <div class="${p}-ov-val">${escapeHtml(fmtMinutes(breakMinutes))}</div>
              <div class="${p}-ov-sub">excl. from hours</div>
            </div>` : ""}
          </div>

          <div class="${p}-toast" data-el="toast"></div>
          ${debug ? `<div class="${p}-debug"><button type="button" class="${p}-debug-copy" data-el="copy">Copy log</button><pre></pre></div>` : ""}
        </div>
      `;
                const el = (name) => container.querySelector(`[data-el="${name}"]`);
                const statusEl = el("status");
                const statusTxt = el("status-text");
                const timerEl = el("timer");
                const detailEl = el("detail");
                const btnEl = el("btn");
                const workedEl = el("worked");
                const workedSub = el("worked-sub");
                const todayEl = el("today");
                const toastEl = el("toast");
                try {
                    todayEl.textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
                }
                catch (_a) {
                    todayEl.textContent = "";
                }
                if (debug) {
                    const copy = el("copy");
                    if (copy)
                        copy.addEventListener("click", () => {
                            try {
                                navigator.clipboard.writeText(logLines.join("\n"));
                            }
                            catch ( /* clipboard blocked */_a) { /* clipboard blocked */ }
                        });
                    const pre = container.querySelector(`.${p}-debug pre`);
                    if (pre)
                        pre.textContent = logLines.join("\n");
                }
                let toastTimer = null;
                const showToast = (msg, ok) => {
                    toastEl.textContent = msg;
                    toastEl.className = `${p}-toast show ${ok ? "ok" : "err"}`;
                    if (toastTimer)
                        clearTimeout(toastTimer);
                    // Errors stay put — they usually mean a misconfigured field slug and the
                    // admin needs time to read the API's message.
                    if (ok)
                        toastTimer = setTimeout(() => { toastEl.className = `${p}-toast`; }, 4000);
                };
                // ── Rendering ──
                /** Minutes worked today: the configured baseline plus the live session (or
                 *  the one that just finished in this view). */
                const workedMinutes = () => {
                    let mins = baselineMins;
                    // DAY already accounts for every session completed earlier today, so
                    // only the live session is added on top. When the field carries no
                    // recorded session at all, fall back to the configured demo seed —
                    // never to a session from a previous day, which would inflate today.
                    if (state.value.inAt || state.value.outAt)
                        mins += minutesBankedToday(state.value);
                    else
                        mins += seedLastMins;
                    if (state.clockedIn && state.value.inAt)
                        mins += elapsedMs(state.value.inAt) / 60000;
                    return mins;
                };
                const paintCards = () => {
                    workedEl.textContent = fmtMinutes(workedMinutes());
                    workedSub.textContent = targetHours > 0 ? `of ${targetHours}h target` : "";
                };
                const paintTimer = () => {
                    timerEl.textContent = state.clockedIn ? fmtDuration(elapsedMs(state.value.inAt)) : "00:00:00";
                };
                const render = () => {
                    const on = state.clockedIn;
                    const { inAt, outAt } = state.value;
                    // Real length of the last completed session, from the stored IN/OUT pair.
                    const realLast = completedSessionMinutes(state.value);
                    if (realLast > 0)
                        lastSessionMins = realLast;
                    statusEl.className = `${p}-status${on ? " on" : ""}`;
                    statusTxt.textContent = on ? "Clocked in" : "Not clocked in";
                    timerEl.className = `${p}-timer${on ? "" : " idle"}`;
                    paintTimer();
                    if (on && inAt) {
                        detailEl.textContent = isSameDay(inAt, new Date())
                            ? `Started at ${fmtClockTime(inAt)}`
                            : `Started ${inAt.toLocaleDateString()} at ${fmtClockTime(inAt)}`;
                    }
                    else if (!on && outAt && realLast >= 1) {
                        detailEl.textContent = `Last session: ${fmtMinutes(realLast)}, ended ${fmtClockTime(outAt)}`;
                    }
                    else if (!on && outAt) {
                        // Sub-minute session — reporting "Last session: 0min" is just noise.
                        detailEl.textContent = `Last clocked out at ${fmtClockTime(outAt)}`;
                    }
                    else if (!on && lastSessionMins > 0) {
                        detailEl.textContent = `Last session: ${fmtMinutes(lastSessionMins)}`;
                    }
                    else {
                        detailEl.textContent = "Not started today";
                    }
                    btnEl.className = `${p}-btn${on ? " out" : ""}`;
                    btnEl.innerHTML = on
                        ? `${ICONS.stop}<span>Clock Out</span>`
                        : `${ICONS.play}<span>Clock In</span>`;
                    paintCards();
                    startTicking();
                };
                // ── Live timer ──
                //
                // disconnectedCallback is unreliable across Staffbase SPA navigation, so
                // the interval is also torn down by an observer watching for the host
                // leaving the document. Without this a 1s timer keeps running (and keeps
                // the widget alive) long after the user has navigated away.
                const stopTicking = () => {
                    if (self._ttwTimer) {
                        clearInterval(self._ttwTimer);
                        self._ttwTimer = undefined;
                    }
                };
                const startTicking = () => {
                    stopTicking();
                    if (!state.clockedIn || !state.value.inAt)
                        return;
                    self._ttwTimer = setInterval(() => {
                        if (!container.isConnected) {
                            stopTicking();
                            return;
                        }
                        paintTimer();
                        paintCards();
                    }, 1000);
                };
                if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
                    const obs = new MutationObserver(() => {
                        if (!container.isConnected) {
                            stopTicking();
                            obs.disconnect();
                            self._ttwObserver = undefined;
                        }
                    });
                    obs.observe(document.body, { childList: true, subtree: true });
                    self._ttwObserver = obs;
                }
                // ── Clock in / out ──
                let busy = false;
                const clock = () => time_tracking_widget_awaiter(this, void 0, void 0, function* () {
                    if (busy)
                        return;
                    busy = true;
                    const goingIn = !state.clockedIn;
                    const at = new Date();
                    // Compose the value to store. Clocking in starts a fresh session and
                    // carries forward what's already banked today; clocking out closes the
                    // session and folds its length into the day's total.
                    const banked = minutesBankedToday(state.value);
                    const next = goingIn
                        ? { inAt: at, outAt: null, dayMinutes: banked }
                        : {
                            inAt: state.value.inAt,
                            outAt: at,
                            dayMinutes: banked + (state.value.inAt
                                ? Math.max(0, (at.getTime() - state.value.inAt.getTime()) / 60000)
                                : 0),
                        };
                    const prevLabel = btnEl.innerHTML;
                    btnEl.disabled = true;
                    btnEl.innerHTML = `<span class="${p}-spin"></span><span>${goingIn ? "Clocking in…" : "Clocking out…"}</span>`;
                    stopTicking();
                    try {
                        yield writeClockState(cfg, userId, goingIn, next);
                        dlog(goingIn ? "clocked in" : "clocked out", formatClockValue(next));
                        // Re-read rather than trusting the optimistic value: the PUT response
                        // doesn't echo custom profile fields back, so this is the only real
                        // confirmation the write landed — and it keeps the timer honest.
                        state = yield readClockState(cfg, userId);
                        dlog("re-read", `${cfg.statusField}=${JSON.stringify(state.rawStatus)}`, `${cfg.timeField}=${JSON.stringify(state.rawTime)}`);
                        btnEl.disabled = false;
                        render();
                        showToast(goingIn ? "Clocked in." : "Clocked out.", true);
                        if (doAppRefresh)
                            refreshApp(refreshPath, refreshDeskt, dlog);
                    }
                    catch (e) {
                        const msg = (e && e.message) || "Something went wrong.";
                        dlog("clock failed", msg);
                        btnEl.disabled = false;
                        btnEl.innerHTML = prevLabel;
                        // Nothing local changed on failure, so just restore the last known
                        // good state and surface the API's own message.
                        render();
                        showToast(msg, false);
                    }
                    finally {
                        busy = false;
                    }
                });
                btnEl.addEventListener("click", clock);
                render();
            });
        }
        disconnectedCallback() {
            const self = this;
            if (self._ttwTimer) {
                clearInterval(self._ttwTimer);
                self._ttwTimer = undefined;
            }
            if (self._ttwObserver) {
                self._ttwObserver.disconnect();
                self._ttwObserver = undefined;
            }
        }
        static get observedAttributes() {
            return [
                "apitoken", "baseurl", "statusfield", "clockedinvalue", "clockedoutvalue",
                "timefield", "targethours", "breakminutes", "workedtodaybaseline", "lastsessionminutes",
                "refreshafterclock", "refreshpath", "refreshondesktop", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor", "debugmode",
            ];
        }
    };
};
const blockDefinition = {
    name: "time-tracking-widget",
    label: "Time Tracking",
    attributes: [
        "apitoken", "baseurl", "statusfield", "clockedinvalue", "clockedoutvalue",
        "timefield", "targethours", "breakminutes", "workedtodaybaseline", "lastsessionminutes",
        "refreshafterclock", "refreshpath", "refreshondesktop", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor", "debugmode",
    ],
    factory,
    configurationSchema,
    uiSchema,
    blockLevel: "block",
    iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzBFQTVFOSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzLjUgNDMuNSkgc2NhbGUoMy41KSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOSIvPjxwYXRoIGQ9Ik0xMiA3djVsMyAyIi8+PC9nPjwvc3ZnPg==",
};
const externalBlockDefinition = {
    blockDefinition,
    author: "Staffbase",
    version: "1.0.0",
};
window.defineBlock(externalBlockDefinition);

/******/ })()
;