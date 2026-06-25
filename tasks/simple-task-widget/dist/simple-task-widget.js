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
// with the same Basic-auth API token the widgets already use (the session cookie
// is unreliable inside the native mobile apps, so token auth is preferred here).
//
// GET {baseUrl}/theming/themes/{themeId}  ->
//   { globalTheme: { customColors: [ {id, color}, ... ], interfaceColor },
//     desktopTheme: { components: { navigation: { accentColor }, ... } } }
//
// Note: a color field (e.g. navigation.accentColor) may hold either a literal
// hex ("#FF6720") OR an *id* that references one of globalTheme.customColors
// ("legacy-text-color"), so we resolve references against the customColors map.
const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
// Pure white/black are useless as an accent (invisible on light UIs / harsh),
// so we treat them as "no usable accent" and fall through to the next candidate.
const isNeutralExtreme = (s) => {
    const x = s.replace("#", "").toLowerCase();
    return x === "ffffff" || x === "fff" || x === "000000" || x === "000";
};
async function fetchThemeColors(baseUrl, apiToken, themeId = "primary") {
    var _a, _b, _c, _d, _e;
    try {
        const res = await fetch(`${baseUrl}/theming/themes/${themeId}`, {
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
        // Primary: the brand color, falling back to legacy bg / interface color.
        let primary = resolve("primary-brand-color") ||
            customs["legacy-background-color"] ||
            (typeof ((_b = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _b === void 0 ? void 0 : _b.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "");
        // Accent: nav accent, then secondary brand, then primary — skipping any
        // unresolved / pure-white-or-black value (which wouldn't read as an accent).
        let accent = resolve((_e = (_d = (_c = data === null || data === void 0 ? void 0 : data.desktopTheme) === null || _c === void 0 ? void 0 : _c.components) === null || _d === void 0 ? void 0 : _d.navigation) === null || _e === void 0 ? void 0 : _e.accentColor);
        if (!isHex(accent) || isNeutralExtreme(accent) || accent.toLowerCase() === String(primary).toLowerCase()) {
            accent = resolve("secondary-brand-color");
        }
        if (!isHex(accent) || isNeutralExtreme(accent))
            accent = String(primary);
        return {
            primary: isHex(String(primary)) ? String(primary) : undefined,
            accent: isHex(String(accent)) ? String(accent) : undefined,
        };
    }
    catch (_f) {
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
    },
    de_DE: {
        loading: "Wird geladen…",
        empty: "Keine Aufgaben vorhanden",
        noneConfigured: "Noch keine Aufgaben konfiguriert.",
        errorToggle: "Aufgabe konnte nicht aktualisiert werden. Bitte erneut versuchen.",
        toggleTask: "Aufgabe umschalten",
    },
    ar_SA: {
        loading: "جارٍ التحميل…",
        empty: "لا توجد مهام لعرضها",
        noneConfigured: "لم يتم تكوين أي مهام بعد.",
        errorToggle: "تعذّر تحديث المهمة. يرجى المحاولة مرة أخرى.",
        toggleTask: "تبديل المهمة",
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
    usethemecolors: { "ui:help": "Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
    primarycolor: { "ui:widget": "color", "ui:help": "Primary brand color" },
    accentcolor: { "ui:widget": "color", "ui:help": "Accent / secondary color" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background color — leave blank for transparent" },
    limitheight: { "ui:help": "Cap the widget's height — anything taller scrolls inside a styled scrollbar" },
    maxheight: { "ui:help": "Maximum height in pixels (e.g. 600). You can also include a CSS unit like 600px or 70vh." },
};
// ── Color utilities ───────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    return `${parseInt(h.slice(0, 2), 16) || 0},${parseInt(h.slice(2, 4), 16) || 0},${parseInt(h.slice(4, 6), 16) || 0}`;
}
// Hidden bracket markers other task widgets stamp into titles ([type:…], [by:…],
// [lvl:…], [recur:…], [rrule:…]). Strip them so the checklist shows clean text.
function stripTags(text) {
    return text.replace(/\[[a-zA-Z]+:[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim();
}
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
            // ── Limit height / scroll (same pattern as the other task widgets) ──
            const limitHeight = this.getAttribute("limitheight") === "true";
            let maxHeight = (this.getAttribute("maxheight") || "").trim();
            if (!maxHeight)
                maxHeight = "600px";
            else if (/^\d+(\.\d+)?$/.test(maxHeight))
                maxHeight += "px";
            const primaryRgb = hexToRgb(primaryColor);
            const accentRgb = hexToRgb(accentColor);
            const p = "stw";
            const refs = (this.getAttribute("tasklist") || "")
                .split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
                .map(s => { const m = s.split(/[\/:]/).map(x => x.trim()).filter(Boolean); return m.length >= 2 ? { installId: m[0], taskId: m[1] } : null; })
                .filter((x) => !!x);
            let locale = (/* inlined export .DEFAULT_LOCALE */"en_US");
            let tr = makeT(STRINGS, locale);
            const apiOpts = (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: { Authorization: `Basic ${apiToken}`, "Content-Type": "application/json" } }));
            const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const isDone = (s) => s === "DONE" || s === "done" || s === "CLOSED";
            const iconCheck = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
            const limitCss = limitHeight ? `
          .${p}.${p}-limited{max-height:${maxHeight};overflow-y:auto;box-sizing:border-box;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(${primaryRgb},.45) transparent}
          .${p}.${p}-limited::-webkit-scrollbar{width:10px;height:10px}
          .${p}.${p}-limited::-webkit-scrollbar-track{background:transparent;margin:6px 0}
          .${p}.${p}-limited::-webkit-scrollbar-thumb{background:rgba(${primaryRgb},.32);border-radius:8px;border:3px solid transparent;background-clip:padding-box}
          .${p}.${p}-limited::-webkit-scrollbar-thumb:hover{background:rgba(${primaryRgb},.55);background-clip:padding-box}` : "";
            try {
                container.setAttribute("dir", isRtl(locale) ? "rtl" : "ltr");
            }
            catch (_) { }
            // ── Skeleton ───────────────────────────────────────────────────────
            container.innerHTML = `
        <style>
          .${p}{--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent:${accentColor};--accent-rgb:${accentRgb};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-md:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bgColor || "transparent"};padding:16px}
          .${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
          .${p}-banner{display:none;margin-bottom:10px;padding:9px 12px;border-radius:var(--r-md);font-size:12.5px;font-weight:600;background:rgba(196,30,58,.08);color:var(--error);border:1px solid rgba(196,30,58,.2)}
          .${p}-list{display:flex;flex-direction:column;gap:8px}
          .${p}-row{display:flex;align-items:flex-start;gap:12px;padding:11px 13px;background:#fff;border:1px solid var(--border);border-radius:var(--r-md);box-shadow:0 1px 3px rgba(0,0,0,.05),0 1px 2px rgba(0,0,0,.04);transition:opacity .25s ease}
          .${p}-row.done{opacity:.65}
          .${p}-check-wrap{flex-shrink:0;padding-top:1px;position:relative}
          .${p} .${p}-check{width:20px!important;height:20px;border-radius:50%!important;border:2px solid #d1d5db!important;background:#fff!important;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;padding:0!important;margin:0!important;line-height:0;font-family:inherit}
          .${p} .${p}-check:hover{border-color:var(--primary)!important;background:rgba(var(--primary-rgb),.06)!important}
          .${p} .${p}-check.checked{background:var(--success)!important;border-color:var(--success)!important}
          .${p} .${p}-check:disabled{cursor:default}
          .${p} .${p}-check:disabled:hover{border-color:#d1d5db!important;background:#fff!important}
          .${p} .${p}-check.checked:disabled:hover{border-color:var(--success)!important;background:var(--success)!important}
          .${p}-check-icon{display:none}
          .${p}-check.checked .${p}-check-icon{display:block}
          .${p}-title{flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--dark);line-height:1.45;word-break:break-word;padding-top:1px}
          .${p}-row.done .${p}-title{color:var(--gray);text-decoration:line-through;text-decoration-color:var(--gray-lt)}
          .${p}-state{padding:22px 8px;text-align:center;color:var(--gray);font-size:13px}
          .${p}-spin{width:18px;height:18px;border-radius:50%;border:2.5px solid rgba(var(--primary-rgb),.2);border-top-color:var(--primary);animation:${p}-spin .7s linear infinite;display:inline-block;vertical-align:middle;margin-right:7px}
          @keyframes ${p}-spin{to{transform:rotate(360deg)}}
          @keyframes ${p}-check-pop{0%{transform:scale(1)}35%{transform:scale(1.35);box-shadow:0 0 0 6px rgba(var(--primary-rgb),.12)}65%{transform:scale(.88)}100%{transform:scale(1);box-shadow:none}}
          @keyframes ${p}-uncheck-pop{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1)}}
          .${p}-check.pop-done{animation:${p}-check-pop .38s cubic-bezier(.34,1.56,.64,1) forwards}
          .${p}-check.pop-undone{animation:${p}-uncheck-pop .28s cubic-bezier(.34,1.56,.64,1) forwards}
          @keyframes ${p}-spark{0%{transform:scale(0) translate(0,0);opacity:1}100%{transform:scale(1) translate(var(--tx),var(--ty));opacity:0}}
          .${p}-spark{position:absolute;width:5px;height:5px;border-radius:50%;pointer-events:none;animation:${p}-spark .5s ease-out forwards}
          ${limitCss}
        </style>

        <div class="${p}${limitHeight ? ` ${p}-limited` : ""}">
          <div class="${p}-banner" id="${p}-banner"></div>
          <div class="${p}-list" id="${p}-list">
            <div class="${p}-state"><span class="${p}-spin"></span>${tr("loading")}</div>
          </div>
        </div>
      `;
            const listEl = container.querySelector(`#${p}-list`);
            const bannerEl = container.querySelector(`#${p}-banner`);
            function showError(msg) {
                bannerEl.textContent = msg;
                bannerEl.style.display = "block";
                window.clearTimeout(bannerEl._t);
                bannerEl._t = window.setTimeout(() => { bannerEl.style.display = "none"; }, 4000);
            }
            // ── Locale (best-effort; first paint is en_US) ──────────────────────
            async function applyLocale() {
                var _a;
                const available = Object.keys(STRINGS);
                let configLocale = "";
                try {
                    const prof = await widgetApi.getUserInformation();
                    const uid = (prof === null || prof === void 0 ? void 0 : prof.id) || "";
                    if (uid) {
                        const r = await fetch(`${baseUrl}/users/${uid}`, apiOpts());
                        if (r.ok) {
                            const u = await r.json();
                            configLocale = ((_a = u === null || u === void 0 ? void 0 : u.config) === null || _a === void 0 ? void 0 : _a.locale) || "";
                        }
                    }
                }
                catch (_) { }
                locale = detectLocale({ configLocale, available });
                tr = makeT(STRINGS, locale);
                try {
                    container.setAttribute("dir", isRtl(locale) ? "rtl" : "ltr");
                }
                catch (_) { }
            }
            // ── Sparkle burst on check ──────────────────────────────────────────
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
            let tasks = [];
            function rowHtml(t) {
                const done = isDone(t.status);
                return `<div class="${p}-row${done ? " done" : ""}" data-id="${esc(t.id)}" data-inst="${esc(t.installId)}">
          <div class="${p}-check-wrap">
            <button type="button" class="${p}-check${done ? " checked" : ""}" aria-label="${esc(tr("toggleTask"))}"${allowToggle ? "" : " disabled"}>
              <span class="${p}-check-icon">${iconCheck}</span>
            </button>
          </div>
          <span class="${p}-title">${esc(t.title)}</span>
        </div>`;
            }
            function render() {
                const visible = tasks.filter(t => t.ok && (showCompleted || !isDone(t.status)));
                if (!visible.length) {
                    listEl.innerHTML = `<div class="${p}-state">${refs.length ? tr("empty") : tr("noneConfigured")}</div>`;
                    return;
                }
                listEl.innerHTML = visible.map(rowHtml).join("");
                if (allowToggle) {
                    listEl.querySelectorAll(`.${p}-check`).forEach(btn => btn.addEventListener("click", () => toggle(btn)));
                }
            }
            async function toggle(btn) {
                const row = btn.closest(`.${p}-row`);
                const t = tasks.find(x => x.id === row.dataset.id && x.installId === row.dataset.inst);
                if (!t)
                    return;
                const done = isDone(t.status);
                const next = done ? "OPEN" : "CLOSED";
                const wrap = btn.closest(`.${p}-check-wrap`);
                // Optimistic UI + check animation
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
                    // If completed items are hidden, drop it once the animation settles.
                    if (!showCompleted && next === "CLOSED")
                        setTimeout(render, 420);
                }
                catch (e) {
                    // Revert on failure
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
            // ── Load ────────────────────────────────────────────────────────────
            async function load() {
                await applyLocale();
                if (!refs.length) {
                    listEl.innerHTML = `<div class="${p}-state">${tr("noneConfigured")}</div>`;
                    return;
                }
                tasks = await Promise.all(refs.map(async (r) => {
                    try {
                        const res = await fetch(`${baseUrl}/tasks/${r.installId}/task/${r.taskId}`, apiOpts());
                        if (!res.ok)
                            return { id: r.taskId, installId: r.installId, title: "", status: "", ok: false };
                        const d = await res.json();
                        return { id: d.id || r.taskId, installId: r.installId, title: stripTags(d.title || "") || "(untitled)", status: d.status || "OPEN", ok: true };
                    }
                    catch (_) {
                        return { id: r.taskId, installId: r.installId, title: "", status: "", ok: false };
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
    attributes: ["apitoken", "baseurl", "tasklist", "showcompleted", "allowtoggle", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor", "limitheight", "maxheight"],
    factory, configurationSchema, uiSchema, blockLevel: "block",
    iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzE2QTM0QSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzLjUgNDMuNSkgc2NhbGUoMy41KSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIxIDEwLjVWMTlhMiAyIDAgMCAxLTIgMkg1YTIgMiAwIDAgMS0yLTJWNWEyIDIgMCAwIDEgMi0yaDEyLjUiLz48cGF0aCBkPSJtOSAxMSAzIDNMMjIgNCIvPjwvZz48L3N2Zz4=",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" });

/******/ })()
;