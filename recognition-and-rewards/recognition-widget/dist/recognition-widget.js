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
const DEFAULT_CHANNEL = "698f5d37a8522a33d4e1dac5";
const DEFAULT_ADMIN_ID = "699dc05555c71158d37594e7";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#DA2E32";
const DEFAULT_ACCENT_COLOR = "#F59E0B";
const DEFAULT_REWARD_TYPES = [
    { name: "Teamwork", icon: "ti-users", points: 50 },
    { name: "Innovation", icon: "ti-bulb", points: 75 },
    { name: "Leadership", icon: "ti-star", points: 100 },
    { name: "Customer focus", icon: "ti-target", points: 50 },
    { name: "Above & beyond", icon: "ti-rocket", points: 150 },
];
// Regex to parse recognition metadata from post title:
// format: "FromName recognized ToName · Type · +Xpts"
const RECOG_TITLE_RE = /^(.+?) recognized (.+?) · (.+?) · \+(\d+)pts$/;
// ── Inline SVG chrome icons (data-driven reward-type icons stay Tabler) ────────
const ICONS = {
    heart: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12.572 12 20l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.566Z"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
    send: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    sparkle: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
};
function buildCss(p) {
    return `
.${p}{--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--bg-soft:#f7f7f9;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:16px;--shadow-sm:0 1px 2px rgba(0,0,0,.04),0 1px 3px rgba(0,0,0,.06);--shadow-md:0 6px 22px rgba(0,0,0,.09);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);padding:20px}
.${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
.${p}-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.${p}-title{font-size:18px;font-weight:800;letter-spacing:-.01em;color:var(--dark);display:flex;align-items:center;gap:10px}
.${p}-title-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--primary-text);background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 4px 12px rgba(var(--primary-rgb),.28);flex-shrink:0}
.${p}-sub{font-size:11px;font-weight:600;letter-spacing:.3px;color:var(--gray-lt);text-transform:uppercase}
.${p}-tabs{display:inline-flex;gap:2px;padding:3px;background:var(--bg-soft);border-radius:var(--r-md);margin-bottom:18px}
.${p}-tab{padding:7px 16px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;color:var(--gray);background:none;font-family:inherit;transition:color .18s,background .18s,box-shadow .18s;white-space:nowrap}
.${p}-tab.active{background:#fff;color:var(--primary);box-shadow:var(--shadow-sm)}
.${p}-filters{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}
.${p}-filter{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border:1.5px solid var(--border);border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;background:#fff;color:var(--gray);font-family:inherit;transition:all .15s;white-space:nowrap}
.${p}-filter:hover{border-color:rgba(var(--primary-rgb),.4);color:var(--primary)}
.${p}-filter.active{background:rgba(var(--primary-rgb),.08);border-color:transparent;color:var(--primary)}
.${p}-filter i{font-size:13px}
.${p}-feed{display:flex;flex-direction:column;gap:11px}
.${p}-feed.intro>*{animation:${p}-rise .42s cubic-bezier(.22,.9,.3,1) backwards}
.${p}-feed.intro>*:nth-child(1){animation-delay:.02s}
.${p}-feed.intro>*:nth-child(2){animation-delay:.07s}
.${p}-feed.intro>*:nth-child(3){animation-delay:.12s}
.${p}-feed.intro>*:nth-child(4){animation-delay:.17s}
.${p}-feed.intro>*:nth-child(n+5){animation-delay:.22s}
@keyframes ${p}-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.${p}-card{position:relative;background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:15px 16px;transition:transform .16s,box-shadow .16s,border-color .16s}
.${p}-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:transparent}
.${p}-card::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:3px;background:linear-gradient(var(--primary),var(--accent));opacity:0;transition:opacity .16s}
.${p}-card:hover::before{opacity:1}
.${p}-card-head{display:flex;align-items:center;gap:11px;margin-bottom:9px}
.${p}-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent))}
.${p}-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.${p}-av-stack{position:relative;width:54px;height:36px;flex-shrink:0}
.${p}-av-from{position:absolute;left:0;top:0}
.${p}-av-to{position:absolute;right:0;bottom:-3px;width:26px!important;height:26px!important;font-size:9px!important;border:2.5px solid #fff}
.${p}-edit-btn{position:absolute;bottom:10px;right:12px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.06);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gray);opacity:0;transition:opacity .15s,background .15s,color .15s}
.${p}-card:hover .${p}-edit-btn{opacity:1}
.${p}-edit-btn:hover{background:rgba(var(--primary-rgb),.12)!important;color:var(--primary)!important}
.${p}-edit-area{width:100%;font-family:inherit;font-size:13px;color:var(--dark);background:#fafafa;border:1.5px solid var(--border);border-radius:var(--r-md);padding:9px 11px;resize:vertical;min-height:64px;line-height:1.55;margin-left:65px;width:calc(100% - 65px);transition:border-color .15s}
.${p}-edit-area:focus{outline:none;border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
.${p}-edit-actions{display:flex;gap:7px;justify-content:flex-end;margin-top:8px}
.${p}-save-btn{padding:7px 15px;border-radius:var(--r-sm);border:none;background:var(--primary);color:var(--primary-text);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.${p}-cancel-btn{padding:7px 13px;border-radius:var(--r-sm);border:1.5px solid var(--border);background:#fff;color:var(--gray);font-family:inherit;font-size:12px;font-weight:600;cursor:pointer}
.${p}-who{flex:1;min-width:0}
.${p}-from{font-size:13px;font-weight:700;color:var(--dark);display:flex;align-items:center;gap:5px;line-height:1.3;flex-wrap:nowrap;overflow:hidden;min-width:0}
.${p}-from-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex-shrink:1}
.${p}-from .${p}-to{font-weight:700;color:var(--primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex-shrink:1}
.${p}-from svg{color:var(--gray-lt);flex-shrink:0;display:block}
.${p}-time{font-size:11px;color:var(--gray-lt);margin-top:1px}
.${p}-badges{display:flex;align-items:center;gap:5px;flex-shrink:0;align-self:flex-start}
.${p}-type-badge{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:5px;white-space:nowrap;background:rgba(0,0,0,.05);color:var(--gray)}
.${p}-type-badge i{font-size:11px}
.${p}-pts-badge{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:5px;white-space:nowrap;background:rgba(0,0,0,.05);color:var(--gray)}
.${p}-msg{font-size:13px;color:var(--gray);line-height:1.55;padding-left:65px}
.${p}-give{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;box-shadow:var(--shadow-sm)}
.${p}-fld{margin-bottom:20px;position:relative}
.${p}-fld:last-of-type{margin-bottom:0}
.${p}-label{display:block;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt);margin-bottom:9px}
.${p}-search-wrap{position:relative}
.${p}-search-ic{position:absolute;left:15px;top:50%;transform:translateY(-50%);color:var(--gray-lt);pointer-events:none;display:flex}
.${p}-in{width:100%;font-family:inherit;font-size:14px;color:var(--dark);background:#fafafa;border:1.5px solid var(--border);border-radius:var(--r-md);padding:13px 14px;transition:border-color .15s,box-shadow .15s,background .15s}
.${p}-in::placeholder{color:var(--gray-lt)}
.${p}-search-wrap .${p}-in{padding-left:42px}
.${p}-in:focus{outline:none;border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
textarea.${p}-in{resize:vertical;min-height:84px;line-height:1.55}
.${p}-dropdown{position:absolute;top:calc(100% + 6px);left:0;right:0;background:#fff;border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--shadow-md);z-index:50;max-height:210px;overflow-y:auto;display:none;padding:6px}
.${p}-opt{display:flex;align-items:center;gap:11px;padding:9px 11px;font-size:13.5px;font-weight:600;cursor:pointer;color:var(--dark);border-radius:var(--r-sm);transition:background .12s}
.${p}-opt:hover{background:var(--bg-soft)}
.${p}-opt-av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0;overflow:hidden}
.${p}-opt-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.${p}-opt-empty{padding:10px 12px;font-size:13px;color:var(--gray-lt)}
/* selected recipient card (replaces the search once a colleague is chosen) */
.${p}-recipient{display:flex;align-items:center;gap:13px;padding:13px 14px;border-radius:var(--r-md);border:1.5px solid transparent;background:linear-gradient(rgba(var(--primary-rgb),.05),rgba(var(--accent-rgb),.05));box-shadow:0 0 0 1.5px rgba(var(--primary-rgb),.18) inset;animation:${p}-rise .3s cubic-bezier(.22,.9,.3,1)}
.${p}-recipient-av{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0;overflow:hidden}
.${p}-recipient-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.${p}-recipient-info{flex:1;min-width:0}
.${p}-recipient-eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--primary);display:flex;align-items:center;gap:5px}
.${p}-recipient-eyebrow svg{width:11px;height:11px}
.${p}-recipient-name{font-size:16px;font-weight:800;letter-spacing:-.01em;color:var(--dark);line-height:1.25;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.${p}-recipient-change{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--gray);background:rgba(0,0,0,.04);cursor:pointer;transition:background .15s,color .15s}
.${p}-recipient-change:hover{background:rgba(var(--primary-rgb),.12);color:var(--primary)}
.${p}-ktypes{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:9px}
.${p}-ktype{display:flex;flex-direction:column;align-items:center;gap:8px;border:1.5px solid var(--border);border-radius:var(--r-md);padding:14px 6px;cursor:pointer;background:#fff;transition:transform .15s,border-color .15s,box-shadow .15s;font-family:inherit}
.${p}-ktype:hover{border-color:rgba(var(--primary-rgb),.4);transform:translateY(-2px);box-shadow:var(--shadow-sm)}
.${p}-ktype.selected{border-color:var(--primary)}
.${p}-ktype-ic{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-soft);color:var(--gray-lt);transition:background .15s,color .15s}
.${p}-ktype.selected .${p}-ktype-ic{background:linear-gradient(135deg,var(--primary),var(--accent));color:var(--primary-text)}
.${p}-ktype-name{font-size:11.5px;font-weight:600;color:var(--gray);line-height:1.2}
.${p}-ktype.selected .${p}-ktype-name{color:var(--primary);font-weight:700}
.${p}-ktype-pts{font-size:10px;font-weight:600;color:var(--gray-lt)}
.${p}-ktype.selected .${p}-ktype-pts{color:var(--primary)}
.${p}-submit-row{display:flex;justify-content:flex-end;margin-top:14px}
.${p}-submit{padding:11px 22px;border-radius:var(--r-md);border:none;color:var(--primary-text);font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 4px 14px rgba(var(--primary-rgb),.32);transition:transform .15s,box-shadow .15s,filter .15s}
.${p}-submit:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.04)}
.${p}-empty{text-align:center;padding:34px 16px;color:var(--gray-lt);font-size:13px;font-weight:500}
.${p}-toast{position:absolute;bottom:18px;left:50%;transform:translate(-50%,8px);background:var(--dark);color:#fff;padding:11px 18px;border-radius:var(--r-md);font-size:13px;font-weight:700;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;white-space:nowrap;z-index:10;box-shadow:var(--shadow-md);display:flex;align-items:center;gap:8px}
.${p}-toast.show{opacity:1;transform:translate(-50%,0)}
.${p}-view-wrap{position:relative;min-height:130px}
.${p}-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:${p}-spin .7s linear infinite;display:inline-block}
@keyframes ${p}-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.${p}-feed.intro>*{animation:none!important}}
/* ── Neutralize Staffbase global button rules (margin:auto / width:90% / blue+red
      hover/focus/active backgrounds). Their rules aren't !important, so these win. */
.${p} button{width:auto!important;margin:0!important;box-sizing:border-box;font-family:inherit;line-height:normal!important}
.${p} button:focus,.${p} button:focus-visible{outline:none!important;box-shadow:none}

.${p}-tab,.${p}-tab:hover,.${p}-tab:focus,.${p}-tab:active{background:none!important;color:var(--gray)!important}
.${p}-tab.active,.${p}-tab.active:hover,.${p}-tab.active:focus,.${p}-tab.active:active{background:#fff!important;color:var(--primary)!important}
.${p}-filter,.${p}-filter:focus,.${p}-filter:active{background:#fff!important;color:var(--gray)!important}
.${p}-filter:hover{color:var(--primary)!important}
.${p}-filter.active,.${p}-filter.active:hover,.${p}-filter.active:focus,.${p}-filter.active:active{background:rgba(var(--primary-rgb),.08)!important;color:var(--primary)!important}
.${p}-ktype,.${p}-ktype:hover,.${p}-ktype:focus,.${p}-ktype:active{background:#fff!important;color:var(--dark)!important}
.${p}-ktype.selected,.${p}-ktype.selected:hover,.${p}-ktype.selected:focus,.${p}-ktype.selected:active{background:rgba(var(--primary-rgb),.05)!important}
.${p}-submit,.${p}-submit:hover,.${p}-submit:focus,.${p}-submit:active{background:linear-gradient(135deg,var(--primary),var(--accent))!important;color:var(--primary-text)!important;border:none!important}
.${p}-submit:disabled{background:var(--border)!important;color:var(--gray-lt)!important;cursor:not-allowed;box-shadow:none!important;transform:none!important;filter:none!important}
`;
}
function makeApiOpts(token, extra) {
    return Object.assign(Object.assign({}, extra), { credentials: "omit", headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" } });
}
function getInitials(name) {
    return name.split(" ").map(p => p[0] || "").join("").toUpperCase().slice(0, 2);
}
function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)
        return "just now";
    if (m < 60)
        return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)
        return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
// ── Color utilities (shared idiom with the task widgets) ───────────────────────
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
// Pull Primary/Accent from the Staffbase branding theme (token-auth GET).
function fetchThemeColors(baseUrl, apiToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
        const isNeutralExtreme = (s) => {
            const x = s.replace("#", "").toLowerCase();
            return x === "ffffff" || x === "fff" || x === "000000" || x === "000";
        };
        try {
            const res = yield fetch(`${baseUrl}/theming/themes/primary`, {
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
            let primary = resolve("primary-brand-color") || customs["legacy-background-color"] ||
                (typeof ((_b = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _b === void 0 ? void 0 : _b.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "");
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
    });
}
const factory = (BaseBlockClass, widgetApi) => {
    return class RecognitionWidget extends BaseBlockClass {
        constructor() {
            super();
        }
        renderBlock(container) {
            return __awaiter(this, void 0, void 0, function* () {
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
                const channelId = this.getAttribute("channelid") || DEFAULT_CHANNEL;
                const token = this.getAttribute("apitoken") || "";
                const pointsField = this.getAttribute("pointsfield") || "points";
                const adminId = this.getAttribute("adminuserid") || DEFAULT_ADMIN_ID;
                const notificationLink = this.getAttribute("notificationlink") || "";
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
                const p = "rcw";
                let rewardTypes = DEFAULT_REWARD_TYPES;
                try {
                    const raw = this.getAttribute("rewardtypes");
                    if (raw)
                        rewardTypes = JSON.parse(raw);
                }
                catch (_a) { }
                let currentUser = null;
                try {
                    const prof = yield widgetApi.getUserInformation();
                    const id = prof.id || "";
                    if (id) {
                        // Fetch full profile for name (getUserInformation may omit fields on some versions)
                        const r = yield fetch(`${baseUrl}/users/${id}`, apiOpts());
                        const data = yield r.json();
                        currentUser = {
                            id,
                            firstName: data.firstName || prof.firstName || "",
                            lastName: data.lastName || prof.lastName || "",
                        };
                    }
                }
                catch (_b) { }
                // --- Build HTML ---
                container.innerHTML = `<style>${buildCss(p)}</style>
<div class="${p}" style="--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent:${accentColor};--accent-rgb:${accentRgb};--primary-text:${primaryText};background:${bgColor || "transparent"}">
  <div class="${p}-header">
    <div class="${p}-title">
      <span class="${p}-title-icon">${ICONS.heart}</span>
      Recognition
    </div>
    <span class="${p}-sub">Team kudos</span>
  </div>

  <div class="${p}-tabs">
    <button class="${p}-tab active" data-tab="wall">Kudos wall</button>
    <button class="${p}-tab" data-tab="give">Give kudos</button>
  </div>

  <div class="${p}-view-wrap">
    <div id="view-wall">
      <div class="${p}-filters">
        <button class="${p}-filter active" data-filter="all">All</button>
        ${rewardTypes.map(t => `<button class="${p}-filter" data-filter="${t.name}"><i class="ti ${t.icon}"></i>${t.name}</button>`).join("")}
      </div>
      <div class="${p}-feed" id="kudosFeed">
        <div class="${p}-empty">Loading…</div>
      </div>
    </div>

    <div id="view-give" style="display:none">
      <div class="${p}-give">
        <div class="${p}-fld">
          <label class="${p}-label" id="recipLabel">Recognize a colleague</label>
          <div class="${p}-search-wrap" id="searchWrap">
            <span class="${p}-search-ic">${ICONS.search}</span>
            <input class="${p}-in" id="recipSearch" type="text" placeholder="Search for a colleague by name…" autocomplete="off">
          </div>
          <div class="${p}-dropdown" id="userDropdown"></div>
          <div class="${p}-recipient" id="recipCard" style="display:none">
            <div class="${p}-recipient-av" id="recipCardAv"></div>
            <div class="${p}-recipient-info">
              <div class="${p}-recipient-eyebrow">${ICONS.heart}Recognizing</div>
              <div class="${p}-recipient-name" id="recipCardName"></div>
            </div>
            <button type="button" class="${p}-recipient-change" id="recipChange" title="Choose someone else" aria-label="Choose someone else">${ICONS.close}</button>
          </div>
          <input type="hidden" id="recipId">
          <input type="hidden" id="recipName">
        </div>
        <div class="${p}-fld">
          <label class="${p}-label">Recognition type</label>
          <div class="${p}-ktypes" id="ktypeGrid">
            ${rewardTypes.map((t, i) => `
              <button class="${p}-ktype" data-idx="${i}" data-name="${t.name}" data-pts="${t.points}">
                <div class="${p}-ktype-ic"><i class="ti ${t.icon}"></i></div>
                <div class="${p}-ktype-name">${t.name}</div>
                <div class="${p}-ktype-pts">+${t.points} pts</div>
              </button>`).join("")}
          </div>
        </div>
        <div class="${p}-fld">
          <label class="${p}-label">Message</label>
          <textarea class="${p}-in" id="kudosMsg" placeholder="Write something meaningful…"></textarea>
        </div>
        <div class="${p}-submit-row">
          <button class="${p}-submit" id="submitBtn" disabled>${ICONS.send}Send recognition</button>
        </div>
      </div>
    </div>

    <div class="${p}-toast" id="toast"></div>
  </div>
</div>`;
                // --- State ---
                let wallFilter = "all";
                let selectedType = null;
                let searchTimeout = null;
                const feed = container.querySelector("#kudosFeed");
                const recipSearch = container.querySelector("#recipSearch");
                const recipId = container.querySelector("#recipId");
                const recipName = container.querySelector("#recipName");
                const userDropdown = container.querySelector("#userDropdown");
                const searchWrap = container.querySelector("#searchWrap");
                const recipCard = container.querySelector("#recipCard");
                const recipCardAv = container.querySelector("#recipCardAv");
                const recipCardName = container.querySelector("#recipCardName");
                const recipChange = container.querySelector("#recipChange");
                const recipLabel = container.querySelector("#recipLabel");
                const kudosMsg = container.querySelector("#kudosMsg");
                const submitBtn = container.querySelector("#submitBtn");
                const toast = container.querySelector("#toast");
                const SEND_DEFAULT = `${ICONS.send}Send recognition`;
                // Swap the search field for a prominent "Recognizing <name>" card.
                function selectRecipient(id, name, avatar) {
                    recipId.value = id;
                    recipName.value = name;
                    recipCardAv.innerHTML = avatar
                        ? `<img src="${avatar}" alt="" onerror="this.parentElement.textContent='${getInitials(name)}'">`
                        : getInitials(name);
                    recipCardName.textContent = name;
                    userDropdown.style.display = "none";
                    searchWrap.style.display = "none";
                    recipCard.style.display = "flex";
                    recipLabel.textContent = "Recipient";
                    const first = name.split(" ")[0] || name;
                    submitBtn.innerHTML = `${ICONS.send}Recognize ${first}`;
                    updateSubmitState();
                }
                function clearRecipient() {
                    recipId.value = "";
                    recipName.value = "";
                    recipSearch.value = "";
                    recipCard.style.display = "none";
                    searchWrap.style.display = "";
                    recipLabel.textContent = "Recognize a colleague";
                    submitBtn.innerHTML = SEND_DEFAULT;
                    updateSubmitState();
                    recipSearch.focus();
                }
                recipChange.addEventListener("click", clearRecipient);
                function showToast(msg, ok = true) {
                    toast.innerHTML = (ok ? ICONS.sparkle : "") + msg;
                    toast.style.background = ok ? "var(--dark)" : "var(--error)";
                    toast.classList.add("show");
                    setTimeout(() => toast.classList.remove("show"), 2800);
                }
                function updateSubmitState() {
                    submitBtn.disabled = !recipId.value || !selectedType || !kudosMsg.value.trim();
                }
                // --- Tabs ---
                container.querySelectorAll(`.${p}-tab`).forEach(btn => {
                    btn.addEventListener("click", () => {
                        const t = btn.dataset.tab;
                        container.querySelectorAll(`.${p}-tab`).forEach(b => b.classList.remove("active"));
                        btn.classList.add("active");
                        container.querySelector("#view-wall").style.display = t === "wall" ? "" : "none";
                        container.querySelector("#view-give").style.display = t === "give" ? "" : "none";
                    });
                });
                // --- Wall filters ---
                container.querySelectorAll(`.${p}-filter`).forEach(btn => {
                    btn.addEventListener("click", () => {
                        wallFilter = btn.dataset.filter;
                        container.querySelectorAll(`.${p}-filter`).forEach(b => b.classList.remove("active"));
                        btn.classList.add("active");
                        renderFeedFromCache();
                    });
                });
                // --- Recognition type selection ---
                container.querySelectorAll(`.${p}-ktype`).forEach(btn => {
                    btn.addEventListener("click", () => {
                        container.querySelectorAll(`.${p}-ktype`).forEach(b => b.classList.remove("selected"));
                        btn.classList.add("selected");
                        const idx = parseInt(btn.dataset.idx);
                        selectedType = rewardTypes[idx];
                        updateSubmitState();
                    });
                });
                // --- User search ---
                recipSearch.addEventListener("input", () => {
                    if (searchTimeout)
                        clearTimeout(searchTimeout);
                    const q = recipSearch.value.trim();
                    if (!q) {
                        userDropdown.style.display = "none";
                        recipId.value = "";
                        recipName.value = "";
                        updateSubmitState();
                        return;
                    }
                    searchTimeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            let users = [];
                            const res = yield widgetApi.getUserList({ limit: 20, filter: q });
                            users = (res.data || []).map((u) => {
                                var _a, _b, _c, _d, _e, _f;
                                return ({
                                    id: u.id || "",
                                    firstName: u.firstName || "",
                                    lastName: u.lastName || "",
                                    avatar: ((_b = (_a = u.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = u.avatar) === null || _c === void 0 ? void 0 : _c.thumb) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = u.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "",
                                });
                            });
                            if (users.length === 0) {
                                userDropdown.innerHTML = `<div class="${p}-opt-empty">No results</div>`;
                            }
                            else {
                                userDropdown.innerHTML = users
                                    .map(u => {
                                    const nm = `${u.firstName} ${u.lastName}`.trim();
                                    // Show profile picture when available; fall back to gradient initials on missing/broken image.
                                    const av = u.avatar
                                        ? `<span class="${p}-opt-av"><img src="${u.avatar}" alt="" onerror="this.parentElement.textContent='${getInitials(nm)}'"></span>`
                                        : `<span class="${p}-opt-av">${getInitials(nm)}</span>`;
                                    return `<div class="${p}-opt" data-id="${u.id}" data-name="${nm}" data-avatar="${u.avatar}">${av}${nm}</div>`;
                                })
                                    .join("");
                                userDropdown.querySelectorAll(`.${p}-opt[data-id]`).forEach(opt => {
                                    opt.addEventListener("click", () => {
                                        const el = opt;
                                        selectRecipient(el.dataset.id, el.dataset.name, el.dataset.avatar || "");
                                    });
                                });
                            }
                            userDropdown.style.display = "block";
                        }
                        catch (_a) {
                            userDropdown.style.display = "none";
                        }
                    }), 300);
                });
                document.addEventListener("click", (e) => {
                    if (!userDropdown.contains(e.target) && e.target !== recipSearch) {
                        userDropdown.style.display = "none";
                    }
                });
                kudosMsg.addEventListener("input", updateSubmitState);
                // --- Submit ---
                submitBtn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    if (!selectedType || !recipId.value || !kudosMsg.value.trim())
                        return;
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<span class="${p}-spin"></span>Sending…`;
                    const fromName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "A colleague";
                    const toId = recipId.value;
                    const toName = recipName.value;
                    const type = selectedType;
                    const message = kudosMsg.value.trim();
                    try {
                        // 1. Post to social wall
                        // Title embeds structured metadata parseable via RECOG_TITLE_RE — no hidden elements needed.
                        const postTitle = `${fromName} recognized ${toName} · ${type.name} · +${type.points}pts`;
                        const postContent = `<p>${message}</p>`;
                        yield fetch(`${baseUrl}/channels/${channelId}/posts`, Object.assign({}, apiOpts({ method: "POST", body: JSON.stringify({
                                contents: { en_US: { title: postTitle, content: postContent } },
                                status: "published",
                            }) })));
                        // 2. Update recipient points
                        try {
                            const userResp = yield fetch(`${baseUrl}/users/${toId}`, apiOpts()).then(r => r.json());
                            const currentPts = parseInt(((_a = userResp === null || userResp === void 0 ? void 0 : userResp.profile) === null || _a === void 0 ? void 0 : _a[pointsField]) || "0", 10);
                            const newPts = currentPts + type.points;
                            yield fetch(`${baseUrl}/users/${toId}`, Object.assign(Object.assign({}, apiOpts({
                                method: "PUT",
                                body: JSON.stringify({ profile: { [pointsField]: String(newPts) } }),
                            })), { headers: Object.assign(Object.assign({}, makeApiOpts(token).headers), { USERID: adminId }) }));
                        }
                        catch (_b) { }
                        // 3. Send notification (best effort)
                        try {
                            yield fetch(`${baseUrl}/branch/notifications`, Object.assign({}, apiOpts({
                                method: "POST",
                                body: JSON.stringify(Object.assign({ accessorIds: [toId], channels: ["notificationCenter"], content: {
                                        en_US: {
                                            title: `You've been recognized!`,
                                            text: `${fromName} recognized you for ${type.name} and awarded you ${type.points} points.`,
                                        },
                                    } }, (notificationLink ? { link: notificationLink } : {}))),
                            })));
                        }
                        catch (_c) { }
                        showToast(`Recognition sent! +${type.points} pts awarded`);
                        // Reset form
                        kudosMsg.value = "";
                        selectedType = null;
                        container.querySelectorAll(`.${p}-ktype`).forEach(b => b.classList.remove("selected"));
                        clearRecipient(); // restores the search field + default submit label
                        updateSubmitState();
                        // Refresh wall
                        yield loadWallPosts();
                    }
                    catch (err) {
                        showToast("Something went wrong. Please try again.", false);
                        submitBtn.innerHTML = SEND_DEFAULT;
                        updateSubmitState();
                    }
                }));
                // --- Load wall posts ---
                let cachedPosts = [];
                let introUsed = false;
                function renderFeedFromCache() {
                    const filtered = wallFilter === "all"
                        ? cachedPosts
                        : cachedPosts.filter(p => p.type === wallFilter);
                    if (filtered.length === 0) {
                        feed.classList.remove("intro");
                        feed.innerHTML = `<div class="${p}-empty">No recognitions yet${wallFilter !== "all" ? ` for ${wallFilter}` : ""}.</div>`;
                        return;
                    }
                    if (!introUsed) {
                        feed.classList.add("intro");
                        introUsed = true;
                    }
                    else
                        feed.classList.remove("intro");
                    feed.innerHTML = filtered.map(post => {
                        const fromName = post.fromName || post.title.slice(0, 10);
                        const fromInitials = getInitials(fromName);
                        const toInitials = post.toName ? getInitials(post.toName) : "";
                        const typeData = rewardTypes.find(r => r.name === post.type);
                        const iconCls = (typeData === null || typeData === void 0 ? void 0 : typeData.icon) || "ti-star";
                        const isOwn = currentUser && post.postAuthorId === currentUser.id;
                        const isRecipient = currentUser && `${currentUser.firstName} ${currentUser.lastName}`.trim() === post.toName;
                        const fromAvDiv = post.fromAvatar
                            ? `<div class="${p}-av ${p}-av-from"><img src="${post.fromAvatar}" alt="" onerror="this.parentElement.innerHTML='${fromInitials}'"></div>`
                            : `<div class="${p}-av ${p}-av-from">${fromInitials}</div>`;
                        const toAvDiv = post.toName
                            ? `<div class="${p}-av ${p}-av-to">${toInitials}</div>`
                            : "";
                        return `<div class="${p}-card" data-post-id="${post.id}">
  <div class="${p}-card-head">
    <div class="${p}-av-stack">${fromAvDiv}${toAvDiv}</div>
    <div class="${p}-who">
      <div class="${p}-from"><span class="${p}-from-name">${fromName}</span>${post.toName ? `${ICONS.arrow}<span class="${p}-to">${post.toName}</span>` : ""}</div>
      <div class="${p}-time">${timeAgo(post.created)}</div>
    </div>
    ${post.type || (isRecipient && post.pts) ? `<div class="${p}-badges">${post.type ? `<span class="${p}-type-badge"><i class="ti ${iconCls}"></i>${post.type}</span>` : ""}${isRecipient && post.pts ? `<span class="${p}-pts-badge">+${post.pts} pts</span>` : ""}</div>` : ""}
  </div>
  ${post.message ? `<div class="${p}-msg">${post.message}</div>` : ""}
  ${isOwn ? `<button class="${p}-edit-btn" title="Edit" aria-label="Edit">${ICONS.edit}</button>` : ""}
</div>`;
                    }).join("");
                    if (currentUser) {
                        feed.querySelectorAll(`.${p}-edit-btn`).forEach(btn => {
                            btn.addEventListener("click", () => {
                                const card = btn.closest(`.${p}-card`);
                                const postId = card.dataset.postId;
                                const post = cachedPosts.find(cp => cp.id === postId);
                                const msgDiv = card.querySelector(`.${p}-msg`);
                                if (!post || card.querySelector(`.${p}-edit-area`))
                                    return;
                                const currentMsg = post.message;
                                if (msgDiv)
                                    msgDiv.style.display = "none";
                                btn.style.opacity = "0";
                                btn.style.pointerEvents = "none";
                                const editArea = document.createElement("textarea");
                                editArea.className = `${p}-edit-area`;
                                editArea.value = currentMsg;
                                const actionsDiv = document.createElement("div");
                                actionsDiv.className = `${p}-edit-actions`;
                                actionsDiv.innerHTML = `<button class="${p}-cancel-btn">Cancel</button><button class="${p}-save-btn">${ICONS.check}Save</button>`;
                                card.appendChild(editArea);
                                card.appendChild(actionsDiv);
                                editArea.focus();
                                actionsDiv.querySelector(`.${p}-cancel-btn`).addEventListener("click", () => {
                                    editArea.remove();
                                    actionsDiv.remove();
                                    if (msgDiv)
                                        msgDiv.style.display = "";
                                    btn.style.opacity = "";
                                    btn.style.pointerEvents = "";
                                });
                                actionsDiv.querySelector(`.${p}-save-btn`).addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                                    const newMsg = editArea.value.trim();
                                    if (!newMsg)
                                        return;
                                    try {
                                        yield fetch(`${baseUrl}/channels/${channelId}/posts/${postId}`, Object.assign({}, apiOpts({
                                            method: "PUT",
                                            body: JSON.stringify({
                                                contents: { en_US: { title: post.title, content: `<p>${newMsg}</p>` } },
                                                status: "published",
                                            }),
                                        })));
                                        post.message = newMsg;
                                        if (msgDiv) {
                                            msgDiv.textContent = newMsg;
                                            msgDiv.style.display = "";
                                        }
                                        editArea.remove();
                                        actionsDiv.remove();
                                        btn.style.opacity = "";
                                        btn.style.pointerEvents = "";
                                        showToast("Recognition updated!");
                                    }
                                    catch (_a) {
                                        showToast("Could not save changes.", false);
                                    }
                                }));
                            });
                        });
                    }
                }
                function loadWallPosts() {
                    return __awaiter(this, void 0, void 0, function* () {
                        try {
                            const resp = yield fetch(`${baseUrl}/channels/${channelId}/posts?limit=30`, apiOpts()).then(r => r.json());
                            const posts = resp.data || [];
                            cachedPosts = posts.map((post) => {
                                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
                                const title = ((_b = (_a = post.contents) === null || _a === void 0 ? void 0 : _a.en_US) === null || _b === void 0 ? void 0 : _b.title) || "";
                                const content = ((_d = (_c = post.contents) === null || _c === void 0 ? void 0 : _c.en_US) === null || _d === void 0 ? void 0 : _d.content) || "";
                                const m = RECOG_TITLE_RE.exec(title);
                                const fromName = (m === null || m === void 0 ? void 0 : m[1]) || "";
                                const toName = (m === null || m === void 0 ? void 0 : m[2]) || "";
                                const type = (m === null || m === void 0 ? void 0 : m[3]) || "";
                                const pts = m ? parseInt(m[4], 10) : 0;
                                const message = content.replace(/<[^>]+>/g, "").trim();
                                const fromAvatar = ((_g = (_f = (_e = post.author) === null || _e === void 0 ? void 0 : _e.avatar) === null || _f === void 0 ? void 0 : _f.thumb) === null || _g === void 0 ? void 0 : _g.url) || ((_k = (_j = (_h = post.author) === null || _h === void 0 ? void 0 : _h.avatar) === null || _j === void 0 ? void 0 : _j.icon) === null || _k === void 0 ? void 0 : _k.url) || ((_o = (_m = (_l = post.author) === null || _l === void 0 ? void 0 : _l.avatar) === null || _m === void 0 ? void 0 : _m.original) === null || _o === void 0 ? void 0 : _o.url) || "";
                                const postAuthorId = ((_p = post.author) === null || _p === void 0 ? void 0 : _p.id) || "";
                                return { id: post.id, title, content, created: post.created || new Date().toISOString(), type, pts, fromName, toName, message, fromAvatar, postAuthorId };
                            });
                            renderFeedFromCache();
                        }
                        catch (_a) {
                            feed.classList.remove("intro");
                            feed.innerHTML = `<div class="${p}-empty">Could not load recognitions.</div>`;
                        }
                    });
                }
                yield loadWallPosts();
            });
        }
        static get observedAttributes() {
            return ["apitoken", "baseurl", "channelid", "rewardtypes", "pointsfield", "adminuserid", "notificationlink", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor"];
        }
    };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token" },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        channelid: { type: "string", title: "Social Wall Channel ID" },
        rewardtypes: { type: "string", title: "Reward Types (JSON array)" },
        pointsfield: { type: "string", title: "Points Profile Field Slug", default: "points" },
        adminuserid: { type: "string", title: "Admin User ID (for profile updates)" },
        notificationlink: { type: "string", title: "Notification Link (page path)" },
        usethemecolors: { type: "boolean", title: "Use Theme Colors", default: false },
        backgroundcolor: { type: "string", title: "Background Color", default: "" },
    },
    // When "Use Theme Colors" is off, expose the manual Primary/Accent pickers.
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
    apitoken: { "ui:widget": "password", "ui:help": "Base64-encoded API token (e.g. from *.staffbase.com or *.staffbase.rocks)" },
    baseurl: { "ui:help": "API base URL e.g. https://yourorg.staffbase.com/api" },
    channelid: { "ui:help": "ID of the Social Wall channel where recognitions will be posted" },
    rewardtypes: { "ui:widget": "textarea", "ui:help": 'JSON: [{"name":"Teamwork","icon":"ti-users","points":50}] — icon is any Tabler icon class' },
    pointsfield: { "ui:help": "Profile field slug to store/read points (default: points)" },
    adminuserid: { "ui:help": "Admin user ID used as USERID header when updating user profiles" },
    notificationlink: { "ui:help": "Page path the notification links to e.g. /content/page/abc123" },
    usethemecolors: { "ui:help": "Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
    primarycolor: { "ui:widget": "color", "ui:help": "Primary brand color" },
    accentcolor: { "ui:widget": "color", "ui:help": "Accent / secondary color (used for gradients & points)" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background color — leave blank for transparent" },
};
const blockDefinition = {
    name: "recognition-widget",
    label: "Recognition Widget",
    attributes: ["apitoken", "baseurl", "channelid", "rewardtypes", "pointsfield", "adminuserid", "notificationlink", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor"],
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