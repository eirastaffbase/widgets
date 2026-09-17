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
// ── Config schema ─────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token", default: "" },
        baseurl: { type: "string", title: "Base URL (e.g. https://acme.staffbase.com/api)", default: "" },
        people: { type: "string", title: "People (semicolon-separated: Name, +N; Name, +N)", default: "" },
        widgettitle: { type: "string", title: "Widget Title (optional override)", default: "" },
    },
};
const uiSchema = {
    apitoken: { "ui:help": "Used to load profile photos from the API." },
    baseurl: { "ui:help": "Must include /api, e.g. https://acme.staffbase.com/api" },
    people: { "ui:help": "Semicolon-separated. Format: Name, +N; Name, +N (N = days from today)" },
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
function parsePeople(raw) {
    return raw.split(";")
        .map(entry => entry.trim())
        .filter(Boolean)
        .map(entry => {
        const m = entry.match(/^(.+?),\s*\+?(\d+)\s*$/);
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
/** Fetch all users and return a lowercase-name → avatar URL map. */
function fetchUserAvatars(baseUrl, apiToken) {
    return birthday_widget_awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const map = new Map();
        try {
            const headers = { Accept: "application/json" };
            if (apiToken)
                headers.Authorization = `Basic ${apiToken}`;
            let offset = 0;
            const limit = 100;
            while (true) {
                const res = yield fetch(`${baseUrl}/users?limit=${limit}&offset=${offset}`, { headers, credentials: "omit" });
                if (!res.ok)
                    break;
                const data = yield res.json();
                const rows = (data === null || data === void 0 ? void 0 : data.data) || [];
                for (const u of rows) {
                    const name = ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "").trim();
                    const avatar = ((_b = (_a = u.avatar) === null || _a === void 0 ? void 0 : _a.thumb) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = u.avatar) === null || _c === void 0 ? void 0 : _c.icon) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = u.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "";
                    if (name && avatar)
                        map.set(name.toLowerCase(), avatar);
                }
                const total = Number((_g = data === null || data === void 0 ? void 0 : data.total) !== null && _g !== void 0 ? _g : 0);
                offset += rows.length;
                if (rows.length < limit || offset >= total)
                    break;
            }
        }
        catch (_) { /* leave empty — initials fallback */ }
        return map;
    });
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
  background:transparent;
  padding:20px 22px;
  font-family:inherit;
  color:#111827;
  -webkit-font-smoothing:antialiased;
}

.${P}-header{
  display:flex;align-items:center;gap:10px;margin-bottom:16px;
}
.${P}-balloon{
  flex:0 0 auto;color:#9ca3af;display:inline-flex;align-items:center;
}
.${P}-title{
  font-size:16px;font-weight:700;color:#111827;flex:1 1 auto;min-width:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.${P}-count{
  display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;flex:0 0 auto;
  font-size:11.5px;font-weight:600;letter-spacing:.01em;
  background:#f3f4f6;color:#6b7280;
}

.${P}-list{display:flex;flex-direction:column;gap:10px}

.${P}-card{
  display:flex;align-items:center;gap:14px;padding:12px 14px;
  border-radius:12px;background:transparent;
  transition:background .18s ease,transform .18s ease;
  animation:${P}-rise .45s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(var(--i,0)*60ms);
}
.${P}-card:hover{background:#f9fafb;transform:translateX(3px)}

/* Avatar circle — neutral gray gradient, white initials */
.${P}-av{
  width:44px;height:44px;border-radius:50%;flex:0 0 auto;
  display:inline-flex;align-items:center;justify-content:center;overflow:hidden;
  background:linear-gradient(140deg,#d1d5db,#9ca3af);
  color:#fff;font-weight:700;font-size:16px;letter-spacing:-.01em;
}
.${P}-av-fb::after{content:attr(data-ini)}
.${P}-av img{width:100%;height:100%;object-fit:cover;display:block}

.${P}-info{flex:1 1 auto;min-width:0}
.${P}-root .${P}-name{
  font-size:14px!important;font-weight:600!important;color:#111827!important;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3!important;
}
.${P}-root .${P}-date{
  font-size:12px!important;color:#6b7280!important;margin-top:2px!important;line-height:1.4!important;
}

.${P}-pill{
  flex:0 0 auto;padding:4px 11px;border-radius:99px;
  font-size:12px;font-weight:600;white-space:nowrap;
  background:#f3f4f6;color:#374151;
}
.${P}-pill.is-today{
  background:#e5e7eb;color:#111827;
}

.${P}-root .${P}-empty{
  text-align:center;padding:36px 16px;
  color:#9ca3af!important;font-size:13px!important;line-height:1.5!important;
}

@keyframes ${P}-rise{
  from{opacity:0;transform:translateY(8px)}
  to{opacity:1;transform:none}
}

@media(max-width:380px){
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
                const apiToken = attr("apitoken");
                const baseUrl = attr("baseurl").replace(/\/+$/, "");
                const avatarMap = (apiToken && baseUrl)
                    ? yield fetchUserAvatars(baseUrl, apiToken)
                    : new Map();
                const locale = detectLocale({
                    configLocale: ((_a = widgetApi === null || widgetApi === void 0 ? void 0 : widgetApi.getContentLanguage) === null || _a === void 0 ? void 0 : _a.call(widgetApi)) || null,
                    available: AVAILABLE_LOCALES,
                });
                const t = makeT(BUNDLES, locale);
                const rtl = isRtl(locale);
                const people = parsePeople(attr("people"));
                people.sort((a, b) => a.daysUntil - b.daysUntil);
                const heading = attr("widgettitle") || t("widget.title");
                const cardHtml = (p, i) => {
                    const avatarUrl = avatarMap.get(p.name.toLowerCase()) || "";
                    const ini = initials(p.name);
                    const imgHtml = avatarUrl
                        ? `<img src="${esc(avatarUrl)}" alt="" onerror="this.parentElement.setAttribute('data-ini','${esc(ini)}');this.parentElement.classList.add('${P}-av-fb');this.remove()">`
                        : "";
                    const avClass = `${P}-av${avatarUrl ? "" : ` ${P}-av-fb`}`;
                    const isToday = p.daysUntil === 0;
                    return `<li class="${P}-card" style="--i:${i}">
          <span class="${avClass}" data-ini="${esc(ini)}" aria-hidden="true">${imgHtml}</span>
          <div class="${P}-info">
            <p class="${P}-name">${esc(p.name)}</p>
            <p class="${P}-date">${esc(birthdayDateLabel(p.daysUntil, locale))}</p>
          </div>
          <span class="${P}-pill${isToday ? " is-today" : ""}">${esc(countdownLabel(p.daysUntil, t))}</span>
        </li>`;
                };
                const cardsHtml = people.length
                    ? `<ul class="${P}-list">${people.map(cardHtml).join("")}</ul>`
                    : `<p class="${P}-empty">${esc(t("state.empty"))}</p>`;
                container.innerHTML = `<style>${CSS}</style>
        <div class="${P}-root" dir="${rtl ? "rtl" : "ltr"}">
          <div class="${P}-header">
            <span class="${P}-balloon" aria-hidden="true"><svg width="18" height="24" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="9" cy="8.5" rx="7.5" ry="8.5" fill="currentColor"/><path d="M9 17 L8.5 19.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M7 20 Q9 23 11 20" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/><ellipse cx="6.5" cy="5.5" rx="1.8" ry="2.5" fill="white" opacity="0.25" transform="rotate(-30 6.5 5.5)"/></svg></span>
            <span class="${P}-title">${esc(heading)}</span>
            ${people.length ? `<span class="${P}-count">${esc(String(people.length))}</span>` : ""}
          </div>
          ${cardsHtml}
        </div>`;
            });
        }
        disconnectedCallback() {
            // No timers or listeners to tear down.
        }
        static get observedAttributes() {
            return ATTRS;
        }
    };
};
const ATTRS = ["apitoken", "baseurl", "people", "widgettitle"];
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