/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#DA2E32";
const DEFAULT_ACCENT_COLOR = "#F59E0B";
const DEFAULT_TITLE = "Log in as";
const DEFAULT_SUB = "Switch user";
const DEFAULT_USERS = (/* unused pure expression or super */ null && ([
    { id: "" },
]));
// ── Inline SVG chrome icons ────────────────────────────────────────────────────
const ICONS = {
    // header: "enter / log in" door-arrow (the widget's icon)
    login: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>`,
    // small arrow used inside the "Log in as" button
    enter: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
    user: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>`,
};
function buildCss(p) {
    return `
.${p}{--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--bg-soft:#f7f7f9;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:16px;--shadow-sm:0 1px 2px rgba(0,0,0,.04),0 1px 3px rgba(0,0,0,.06);--shadow-md:0 6px 22px rgba(0,0,0,.09);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);padding:20px}
.${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
.${p}-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px}
.${p}-title{font-size:18px;font-weight:800;letter-spacing:-.01em;color:var(--dark);display:flex;align-items:center;gap:10px;min-width:0}
.${p}-title-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.${p}-title-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--primary-text);background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 4px 12px rgba(var(--primary-rgb),.28);flex-shrink:0}
.${p}-sub{font-size:11px;font-weight:600;letter-spacing:.3px;color:var(--gray-lt);text-transform:uppercase;white-space:nowrap;flex-shrink:0}
/* "Signed in as" chip */
.${p}-current{display:flex;align-items:center;gap:10px;padding:10px 13px;border-radius:var(--r-md);background:var(--bg-soft);margin-bottom:16px}
.${p}-current-av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0;overflow:hidden}
.${p}-current-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.${p}-current-txt{min-width:0;line-height:1.3}
.${p}-current-eyebrow{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt)}
.${p}-current-name{font-size:13.5px;font-weight:700;color:var(--dark);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* search */
.${p}-search-wrap{position:relative;margin-bottom:14px}
.${p}-search-ic{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--gray-lt);pointer-events:none;display:flex}
.${p}-in{width:100%;font-family:inherit;font-size:14px;color:var(--dark);background:#fafafa;border:1.5px solid var(--border);border-radius:var(--r-md);padding:11px 14px 11px 40px;transition:border-color .15s,box-shadow .15s,background .15s}
.${p}-in::placeholder{color:var(--gray-lt)}
.${p}-in:focus{outline:none;border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
/* list */
.${p}-list{display:flex;flex-direction:column;gap:10px}
.${p}-list.intro>*{animation:${p}-rise .42s cubic-bezier(.22,.9,.3,1) backwards}
.${p}-list.intro>*:nth-child(1){animation-delay:.02s}
.${p}-list.intro>*:nth-child(2){animation-delay:.07s}
.${p}-list.intro>*:nth-child(3){animation-delay:.12s}
.${p}-list.intro>*:nth-child(4){animation-delay:.17s}
.${p}-list.intro>*:nth-child(n+5){animation-delay:.22s}
@keyframes ${p}-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.${p}-card{position:relative;display:flex;align-items:center;gap:13px;background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:13px 15px;transition:transform .16s,box-shadow .16s,border-color .16s;overflow:hidden}
.${p}-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:transparent}
.${p}-card::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:3px;background:linear-gradient(var(--primary),var(--accent));opacity:0;transition:opacity .16s}
.${p}-card:hover::before{opacity:1}
.${p}-card.is-current{border-color:rgba(var(--primary-rgb),.45);box-shadow:0 0 0 1.5px rgba(var(--primary-rgb),.18) inset}
.${p}-av{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent))}
.${p}-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.${p}-who{flex:1;min-width:0}
.${p}-name{font-size:14.5px;font-weight:700;color:var(--dark);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.${p}-meta{font-size:12px;color:var(--gray-lt);line-height:1.35;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.${p}-meta.err{color:var(--error);display:flex;align-items:center;gap:4px}
.${p}-you-tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--primary);background:rgba(var(--primary-rgb),.1);padding:2px 7px;border-radius:20px;margin-left:6px;vertical-align:middle}
.${p}-login-btn{flex-shrink:0;padding:9px 15px;border-radius:var(--r-md);border:none;color:var(--primary-text);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 3px 10px rgba(var(--primary-rgb),.28);transition:transform .15s,box-shadow .15s,filter .15s;white-space:nowrap}
.${p}-login-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.05)}
.${p}-login-btn:active:not(:disabled){transform:translateY(0)}
.${p}-login-btn svg{flex-shrink:0}
.${p}-empty{text-align:center;padding:30px 16px;color:var(--gray-lt);font-size:13px;font-weight:500;line-height:1.6}
.${p}-skel{height:70px;border-radius:var(--r-lg);background:linear-gradient(100deg,#f1f1f4 30%,#f7f7f9 50%,#f1f1f4 70%);background-size:220% 100%;animation:${p}-shim 1.2s linear infinite}
@keyframes ${p}-shim{from{background-position:180% 0}to{background-position:-40% 0}}
.${p}-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;animation:${p}-spin .7s linear infinite;display:inline-block}
@keyframes ${p}-spin{to{transform:rotate(360deg)}}
.${p}-toast{position:absolute;bottom:18px;left:50%;transform:translate(-50%,8px);background:var(--dark);color:#fff;padding:11px 18px;border-radius:var(--r-md);font-size:13px;font-weight:700;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;white-space:nowrap;z-index:10;box-shadow:var(--shadow-md);display:flex;align-items:center;gap:8px}
.${p}-toast.show{opacity:1;transform:translate(-50%,0)}
.${p}-wrap{position:relative;min-height:90px}
@media (prefers-reduced-motion:reduce){.${p}-list.intro>*{animation:none!important}}
/* ── Neutralize Staffbase global button rules (margin:auto / width:90% / blue+red
      hover/focus/active backgrounds). Their rules aren't !important, so these win. */
.${p} button{width:auto!important;margin:0!important;box-sizing:border-box;font-family:inherit;line-height:normal!important}
.${p} button:focus,.${p} button:focus-visible{outline:none!important;box-shadow:none}
.${p} .${p}-login-btn,.${p} .${p}-login-btn:hover,.${p} .${p}-login-btn:focus,.${p} .${p}-login-btn:active{background:linear-gradient(135deg,var(--primary),var(--accent))!important;color:var(--primary-text)!important;border:none!important}
.${p} .${p}-login-btn:disabled{background:var(--border)!important;color:var(--gray-lt)!important;cursor:not-allowed;box-shadow:none!important;transform:none!important;filter:none!important}
`;
}
function makeApiOpts(token, extra) {
    return Object.assign(Object.assign({}, extra), { credentials: "omit", headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" } });
}
function getInitials(name) {
    return name.split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}
function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// ── Color utilities (shared idiom with the recognition / task widgets) ──────────
function hexToRgb(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    return `${parseInt(h.slice(0, 2), 16) || 0},${parseInt(h.slice(2, 4), 16) || 0},${parseInt(h.slice(4, 6), 16) || 0}`;
}
function relLuminance(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastColor(hex) {
    return relLuminance(hex) > 0.45 ? "#1a1a1a" : "#ffffff";
}
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
function darkenToContrast(hex, target = 4.5) {
    let { h, s, l } = hexToHsl(hex);
    let out = hex;
    for (let i = 0; i < 50 && contrastOnWhite(out) < target && l > 0.04; i++) {
        l = Math.max(0, l - 0.02);
        out = hslToHex(h, s, l);
    }
    return out;
}
function pickOnWhite(cands) {
    const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
    const scored = cands.filter(isHex).map(hex => (Object.assign(Object.assign({ hex }, hexToHsl(hex)), { contrast: contrastOnWhite(hex) })));
    let pool = scored.filter(c => c.s >= 0.35 && c.l >= 0.12 && c.l <= 0.85);
    if (!pool.length)
        pool = scored.filter(c => c.s >= 0.2 && c.l <= 0.9);
    if (!pool.length)
        return "";
    pool.sort((a, b) => (b.contrast - a.contrast) || (b.s - a.s));
    return darkenToContrast(pool[0].hex, 4.5);
}
function pickVivid(cands, exclude = "") {
    const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
    const pool = cands.filter(isHex).map(hex => (Object.assign({ hex }, hexToHsl(hex))))
        .filter(c => c.s >= 0.3 && c.l >= 0.15 && c.l <= 0.92)
        .sort((a, b) => b.s - a.s);
    if (!pool.length)
        return "";
    return (pool.find(c => c.hex.toLowerCase() !== exclude.toLowerCase()) || pool[0]).hex;
}
// Pull Primary/Accent from the Staffbase branding theme (token-auth GET).
function fetchThemeColors(baseUrl, apiToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
        const isNeutralExtreme = (s) => {
            const x = s.replace("#", "").toLowerCase();
            return x === "ffffff" || x === "fff" || x === "000000" || x === "000";
        };
        try {
            const res = yield fetch(`${baseUrl}/theming/themes/primary`, {
                credentials: "omit",
                headers: { Authorization: `Basic ${apiToken}`, Accept: "application/json" },
            });
            if (!res.ok)
                return {};
            const data = yield res.json();
            const customs = {};
            for (const c of ((_a = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _a === void 0 ? void 0 : _a.customColors) || []) {
                if (c && c.id && c.color)
                    customs[c.id] = c.color;
            }
            const resolve = (v) => !v ? "" : (v[0] === "#" ? v : (customs[v] || ""));
            const palette = [
                ...Object.values(customs),
                typeof ((_b = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _b === void 0 ? void 0 : _b.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "",
                resolve((_e = (_d = (_c = data === null || data === void 0 ? void 0 : data.desktopTheme) === null || _c === void 0 ? void 0 : _c.components) === null || _d === void 0 ? void 0 : _d.navigation) === null || _e === void 0 ? void 0 : _e.accentColor),
            ].filter(c => isHex(c) && !isNeutralExtreme(c));
            let primary = pickOnWhite(palette);
            if (!primary) {
                primary = resolve("primary-brand-color") || customs["legacy-background-color"] ||
                    (typeof ((_f = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _f === void 0 ? void 0 : _f.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "");
                if (isHex(primary))
                    primary = darkenToContrast(primary, 4.5);
            }
            let accent = pickVivid(palette, primary) || resolve((_j = (_h = (_g = data === null || data === void 0 ? void 0 : data.desktopTheme) === null || _g === void 0 ? void 0 : _g.components) === null || _h === void 0 ? void 0 : _h.navigation) === null || _j === void 0 ? void 0 : _j.accentColor) || primary;
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
const factory = (BaseBlockClass, widgetApi) => {
    return class LoginAsWidget extends BaseBlockClass {
        constructor() {
            super();
        }
        renderBlock(container) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e, _f;
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
                const token = this.getAttribute("apitoken") || "";
                const sharedPassword = this.getAttribute("sharedpassword") || "";
                const redirectUrl = this.getAttribute("redirecturl") || "";
                const locale = this.getAttribute("locale") || "en_US";
                const title = this.getAttribute("title") || DEFAULT_TITLE;
                const apiOpts = (extra) => makeApiOpts(token, extra);
                // ── Theming ────────────────────────────────────────────────────────
                let primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
                let accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT_COLOR;
                const bgColor = this.getAttribute("backgroundcolor") || "";
                if (this.getAttribute("usethemecolors") === "true" && token) {
                    const themed = yield fetchThemeColors(baseUrl, token);
                    if (themed.primary)
                        primaryColor = themed.primary;
                    if (themed.accent)
                        accentColor = themed.accent;
                }
                const primaryRgb = hexToRgb(primaryColor);
                const accentRgb = hexToRgb(accentColor);
                const primaryText = contrastColor(primaryColor);
                const p = "law";
                // Parse configured users.
                let entries = [];
                try {
                    const raw = this.getAttribute("users");
                    if (raw)
                        entries = JSON.parse(raw);
                }
                catch (_g) { }
                entries = (Array.isArray(entries) ? entries : []).filter(e => e && e.id && String(e.id).trim());
                // ── Shell ────────────────────────────────────────────────────────────
                container.innerHTML = `<style>${buildCss(p)}</style>
<div class="${p}" style="--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent:${accentColor};--accent-rgb:${accentRgb};--primary-text:${primaryText};background:${bgColor || "transparent"}">
  <div class="${p}-header">
    <div class="${p}-title">
      <span class="${p}-title-icon">${ICONS.login}</span>
      <span class="${p}-title-text">${escapeHtml(title)}</span>
    </div>
    <span class="${p}-sub">${escapeHtml(DEFAULT_SUB)}</span>
  </div>
  <div class="${p}-current" id="lawCurrent" style="display:none"></div>
  <div class="${p}-search-wrap" id="lawSearchWrap" style="display:none">
    <span class="${p}-search-ic">${ICONS.search}</span>
    <input class="${p}-in" id="lawSearch" type="text" placeholder="Search users…" autocomplete="off">
  </div>
  <div class="${p}-wrap">
    <div class="${p}-list" id="lawList">
      ${entries.length
                    ? entries.map(() => `<div class="${p}-skel"></div>`).join("")
                    : `<div class="${p}-empty">No users configured yet.<br>Add user IDs &amp; passwords in the widget settings.</div>`}
    </div>
    <div class="${p}-toast" id="lawToast"></div>
  </div>
</div>`;
                const listEl = container.querySelector("#lawList");
                const toast = container.querySelector("#lawToast");
                const currentEl = container.querySelector("#lawCurrent");
                const searchWrap = container.querySelector("#lawSearchWrap");
                const searchInput = container.querySelector("#lawSearch");
                function showToast(msg, ok = true) {
                    toast.innerHTML = (ok ? ICONS.check : ICONS.alert) + escapeHtml(msg);
                    toast.style.background = ok ? "var(--dark)" : "var(--error)";
                    toast.classList.add("show");
                    setTimeout(() => toast.classList.remove("show"), 3200);
                }
                if (!entries.length)
                    return;
                // ── Resolve each user from the Users API (name / avatar / email) ──────
                const resolveIdentifier = (data, override) => {
                    if (override)
                        return override;
                    const emails = Array.isArray(data === null || data === void 0 ? void 0 : data.emails) ? data.emails : [];
                    const primary = emails.find(e => e && e.primary && e.value);
                    const anyEmail = emails.find(e => e && e.value);
                    return (primary === null || primary === void 0 ? void 0 : primary.value) || (anyEmail === null || anyEmail === void 0 ? void 0 : anyEmail.value) || (data === null || data === void 0 ? void 0 : data.email) || (data === null || data === void 0 ? void 0 : data.username) || (data === null || data === void 0 ? void 0 : data.userName) || "";
                };
                const personas = yield Promise.all(entries.map((entry) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c, _d, _e, _f, _g;
                    const id = String(entry.id).trim();
                    const password = (entry.password || sharedPassword || "").trim();
                    let name = entry.label || "";
                    let avatar = "";
                    let identifier = entry.identifier || "";
                    let meta = "";
                    let error = "";
                    try {
                        const r = yield fetch(`${baseUrl}/users/${id}`, apiOpts());
                        if (r.ok) {
                            const data = yield r.json();
                            name = name || [data.firstName, data.lastName].filter(Boolean).join(" ") || data.displayName || data.userName || data.username || "";
                            avatar = ((_b = (_a = data.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = data.avatar) === null || _c === void 0 ? void 0 : _c.thumb) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = data.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "";
                            identifier = identifier || resolveIdentifier(data);
                            const position = data.position || ((_g = data.profile) === null || _g === void 0 ? void 0 : _g.position) || "";
                            meta = identifier || position || "";
                        }
                        else {
                            error = `User not found (HTTP ${r.status})`;
                        }
                    }
                    catch (_h) {
                        error = "Couldn't load this user";
                    }
                    if (!name)
                        name = identifier || id;
                    if (!error && !identifier)
                        error = "No email on file — can't log in";
                    if (!error && !password)
                        error = "No password configured";
                    return { id, name, identifier, avatar, meta, password, error };
                })));
                // ── Current viewer chip ───────────────────────────────────────────────
                let currentUserId = "";
                try {
                    const prof = yield widgetApi.getUserInformation();
                    currentUserId = (prof === null || prof === void 0 ? void 0 : prof.id) || "";
                    let curName = [prof === null || prof === void 0 ? void 0 : prof.firstName, prof === null || prof === void 0 ? void 0 : prof.lastName].filter(Boolean).join(" ") || "";
                    let curAvatar = "";
                    if (currentUserId) {
                        try {
                            const r = yield fetch(`${baseUrl}/users/${currentUserId}`, apiOpts());
                            if (r.ok) {
                                const d = yield r.json();
                                curName = curName || [d.firstName, d.lastName].filter(Boolean).join(" ") || d.userName || "";
                                curAvatar = ((_b = (_a = d.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = d.avatar) === null || _c === void 0 ? void 0 : _c.thumb) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = d.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "";
                            }
                        }
                        catch (_h) { }
                    }
                    if (curName) {
                        const initials = getInitials(curName);
                        currentEl.innerHTML = `
            <span class="${p}-current-av">${curAvatar ? `<img src="${escapeHtml(curAvatar)}" alt="" onerror="this.parentElement.textContent='${initials}'">` : initials}</span>
            <span class="${p}-current-txt">
              <span class="${p}-current-eyebrow">Signed in as</span>
              <span class="${p}-current-name">${escapeHtml(curName)}</span>
            </span>`;
                        currentEl.style.display = "flex";
                    }
                }
                catch (_j) { }
                // ── Render the persona list ───────────────────────────────────────────
                let introUsed = false;
                function renderList(filter = "") {
                    const q = filter.trim().toLowerCase();
                    const shown = q
                        ? personas.filter(u => u.name.toLowerCase().includes(q) || u.meta.toLowerCase().includes(q))
                        : personas;
                    if (!shown.length) {
                        listEl.classList.remove("intro");
                        listEl.innerHTML = `<div class="${p}-empty">No users match “${escapeHtml(filter.trim())}”.</div>`;
                        return;
                    }
                    // Only play the entrance animation once — not on every search keystroke.
                    if (!introUsed) {
                        listEl.classList.add("intro");
                        introUsed = true;
                    }
                    else
                        listEl.classList.remove("intro");
                    listEl.innerHTML = shown.map(u => {
                        const initials = getInitials(u.name);
                        const av = u.avatar
                            ? `<span class="${p}-av"><img src="${escapeHtml(u.avatar)}" alt="" onerror="this.parentElement.textContent='${initials}'"></span>`
                            : `<span class="${p}-av">${initials}</span>`;
                        const isCurrent = !!currentUserId && u.id === currentUserId;
                        const metaHtml = u.error
                            ? `<div class="${p}-meta err">${ICONS.alert}${escapeHtml(u.error)}</div>`
                            : (u.meta ? `<div class="${p}-meta">${escapeHtml(u.meta)}</div>` : "");
                        const youTag = isCurrent ? `<span class="${p}-you-tag">${ICONS.user}You</span>` : "";
                        const btn = isCurrent
                            ? `<button class="${p}-login-btn" disabled>${ICONS.check}Current</button>`
                            : `<button class="${p}-login-btn" data-id="${escapeHtml(u.id)}"${u.error ? " disabled" : ""}>${ICONS.enter}Log in as</button>`;
                        return `<div class="${p}-card${isCurrent ? " is-current" : ""}">
  ${av}
  <div class="${p}-who">
    <div class="${p}-name">${escapeHtml(u.name)}${youTag}</div>
    ${metaHtml}
  </div>
  ${btn}
</div>`;
                    }).join("");
                    listEl.querySelectorAll(`.${p}-login-btn[data-id]`).forEach(btnEl => {
                        btnEl.addEventListener("click", () => {
                            const id = btnEl.dataset.id;
                            const persona = personas.find(u => u.id === id);
                            if (persona)
                                loginAs(persona, btnEl);
                        });
                    });
                }
                // ── The actual "log in as" — create a fresh session, then reload ──────
                // Same call replify injects into the Staffbase tab, but here we're already
                // on the page so we POST it directly (same-origin, credentials:include so the
                // new session cookie sticks).
                function loginAs(persona, btn) {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (persona.error || !persona.identifier || !persona.password)
                            return;
                        const original = btn.innerHTML;
                        btn.disabled = true;
                        btn.innerHTML = `<span class="${p}-spin"></span>Signing in…`;
                        try {
                            const res = yield fetch(`${baseUrl}/sessions`, {
                                method: "POST",
                                credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ identifier: persona.identifier, secret: persona.password, locale }),
                            });
                            if (!res.ok) {
                                let msg = `HTTP ${res.status}`;
                                try {
                                    const e = yield res.json();
                                    msg = (e === null || e === void 0 ? void 0 : e.message) || (e === null || e === void 0 ? void 0 : e.error) || msg;
                                }
                                catch (_a) { }
                                throw new Error(msg);
                            }
                            showToast(`Logged in as ${persona.name} — reloading…`, true);
                            setTimeout(() => {
                                if (redirectUrl)
                                    window.location.href = redirectUrl;
                                else
                                    window.location.reload();
                            }, 900);
                        }
                        catch (err) {
                            showToast(`Couldn't log in as ${persona.name}: ${err instanceof Error ? err.message : String(err)}`, false);
                            btn.disabled = false;
                            btn.innerHTML = original;
                        }
                    });
                }
                // Show the search box once the list gets long enough to warrant it.
                if (personas.length > 5) {
                    searchWrap.style.display = "block";
                    let t = null;
                    searchInput.addEventListener("input", () => {
                        if (t)
                            clearTimeout(t);
                        t = setTimeout(() => renderList(searchInput.value), 120);
                    });
                }
                renderList();
            });
        }
        static get observedAttributes() {
            return ["apitoken", "baseurl", "users", "sharedpassword", "redirecturl", "locale", "title", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor"];
        }
    };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token" },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        title: { type: "string", title: "Widget Title", default: DEFAULT_TITLE },
        users: {
            type: "string",
            title: "Users (JSON array)",
            default: JSON.stringify([{ id: "USER_ID_1", password: "" }, { id: "USER_ID_2", identifier: "jane@acme.com", password: "" }], null, 2),
        },
        sharedpassword: { type: "string", title: "Shared Password" },
        redirecturl: { type: "string", title: "Redirect After Login (optional)" },
        locale: { type: "string", title: "Login Locale", default: "en_US" },
        usethemecolors: { type: "boolean", title: "Use Theme Colors", default: false },
        backgroundcolor: { type: "string", title: "Background Color", default: "" },
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
                {
                    properties: { usethemecolors: { const: true } },
                },
            ],
        },
    },
};
const uiSchema = {
    apitoken: { "ui:widget": "password", "ui:help": "Base64-encoded API token, used to read each user's name, avatar & email." },
    baseurl: { "ui:help": "API base URL e.g. https://yourorg.staffbase.com/api" },
    title: { "ui:help": "Heading shown at the top of the widget." },
    users: {
        "ui:widget": "textarea",
        "ui:help": 'JSON array of users to offer. Each: {"id": required user ID, "password": optional (else uses Shared Password), "identifier": optional login email/username override, "label": optional display-name override}.',
    },
    sharedpassword: { "ui:widget": "password", "ui:help": "Password used for any user that doesn't specify its own (e.g. a shared demo password)." },
    redirecturl: { "ui:help": "Page to open after a successful switch. Leave blank to just reload the current page." },
    locale: { "ui:help": "Locale sent with the login request (default en_US)." },
    usethemecolors: { "ui:help": "Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
    primarycolor: { "ui:widget": "color", "ui:help": "Primary brand color" },
    accentcolor: { "ui:widget": "color", "ui:help": "Accent / secondary color (used for gradients)" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background color — leave blank for transparent" },
};
const blockDefinition = {
    name: "login-as-widget",
    label: "Login As Widget",
    attributes: ["apitoken", "baseurl", "users", "sharedpassword", "redirecturl", "locale", "title", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor"],
    factory,
    configurationSchema,
    uiSchema,
    blockLevel: "block",
    iconUrl: "",
};
const externalBlockDefinition = {
    blockDefinition,
    author: "Staffbase",
    version: "1.0.0",
};
window.defineBlock(externalBlockDefinition);


/******/ })()
;