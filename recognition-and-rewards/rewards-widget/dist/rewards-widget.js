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
const DEFAULT_ADMIN_ID = "699dc05555c71158d37594e7";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#DA2E32";
const DEFAULT_ACCENT_COLOR = "#F59E0B";
// ── Inline SVG chrome icons (data-driven catalog icons stay Tabler) ───────────
const ICONS = {
    gift: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
    spark: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none"><path d="M12 2 9.6 8.4 3 11l6.6 2.6L12 20l2.4-6.4L21 11l-6.6-2.6Z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    medal: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="15" r="6"/><path d="M12 12v3l2 1M8.5 9 6 3M15.5 9 18 3M9 4h6"/></svg>`,
};
// Catalog icons are Tabler webfont classes (ti-*). Staffbase doesn't bundle that
// font, so the widget loads it itself — otherwise the icons render blank in the app
// (they only worked in preview.html because that file links the CDN directly).
const TABLER_ICONS_HREF = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css";
function ensureTablerIcons() {
    if (typeof document === "undefined")
        return;
    if (document.getElementById("sb-tabler-icons"))
        return;
    const link = document.createElement("link");
    link.id = "sb-tabler-icons";
    link.rel = "stylesheet";
    link.href = TABLER_ICONS_HREF;
    document.head.appendChild(link);
}
function makeApiOpts(token, extra) {
    return Object.assign(Object.assign({}, extra), { credentials: "omit", headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" } });
}
const DEFAULT_CATALOG = [
    { id: "1", name: "Amazon $10 credit", desc: "Applied to your Amazon account", icon: "ti-brand-amazon", pts: 100, cat: "giftcard" },
    { id: "2", name: "Amazon $25 credit", desc: "Applied to your Amazon account", icon: "ti-brand-amazon", pts: 250, cat: "giftcard" },
    { id: "3", name: "Amazon $50 credit", desc: "Applied to your Amazon account", icon: "ti-brand-amazon", pts: 500, cat: "giftcard" },
    { id: "4", name: "Starbucks $15", desc: "Digital gift card via email", icon: "ti-coffee", pts: 150, cat: "giftcard" },
    { id: "5", name: "Spotify 3 months", desc: "Premium subscription gift code", icon: "ti-music", pts: 200, cat: "giftcard" },
    { id: "6", name: "Netflix 1 month", desc: "Streaming subscription code", icon: "ti-player-play", pts: 300, cat: "giftcard" },
    { id: "7", name: "Company hoodie", desc: "Premium branded hoodie, your size", icon: "ti-shirt", pts: 350, cat: "swag" },
    { id: "8", name: "Company water bottle", desc: "Insulated 32oz with logo", icon: "ti-droplet", pts: 175, cat: "swag" },
    { id: "9", name: "Company tote bag", desc: "Canvas tote with embroidered logo", icon: "ti-basket", pts: 80, cat: "swag" },
    { id: "10", name: "Team lunch voucher", desc: "$30 lunch for you and a teammate", icon: "ti-tools-kitchen-2", pts: 400, cat: "experience" },
    { id: "11", name: "Learning course", desc: "Udemy or LinkedIn Learning course", icon: "ti-school", pts: 500, cat: "experience" },
    { id: "12", name: "Extra PTO day", desc: "One additional vacation day", icon: "ti-beach", pts: 1200, cat: "experience" },
];
const TIERS = [
    { name: "Bronze", min: 0, max: 500 },
    { name: "Silver", min: 500, max: 1000 },
    { name: "Gold", min: 1000, max: 2500 },
    { name: "Platinum", min: 2500, max: 5000 },
];
function getTier(pts) {
    return TIERS.slice().reverse().find(t => pts >= t.min) || TIERS[0];
}
function getNextTier(pts) {
    return TIERS.find(t => pts < t.max);
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
function buildCss(p) {
    return `
.${p}{--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--bg-soft:#f7f7f9;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:16px;--shadow-sm:0 1px 2px rgba(0,0,0,.04),0 1px 3px rgba(0,0,0,.06);--shadow-md:0 6px 22px rgba(0,0,0,.09);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);padding:20px}
.${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
.${p}-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.${p}-title{font-size:18px;font-weight:800;letter-spacing:-.01em;color:var(--dark);display:flex;align-items:center;gap:10px}
.${p}-title-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--primary-text);background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 4px 12px rgba(var(--primary-rgb),.28);flex-shrink:0}
.${p}-sub{font-size:11px;font-weight:600;letter-spacing:.3px;color:var(--gray-lt);text-transform:uppercase}
/* ── Hero / balance card ── */
.${p}-hero{position:relative;overflow:hidden;border-radius:var(--r-lg);padding:18px;margin-bottom:16px;color:var(--primary-text);background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 10px 28px rgba(var(--primary-rgb),.3)}
.${p}-hero::after{content:"";position:absolute;right:-40px;top:-40px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.12)}
.${p}-hero::before{content:"";position:absolute;right:30px;bottom:-50px;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.08)}
.${p}-hero-top{display:flex;align-items:center;gap:12px;position:relative;z-index:1}
.${p}-av{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.22);color:var(--primary-text);font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;backdrop-filter:blur(4px)}
.${p}-name{font-size:15px;font-weight:800;line-height:1.2}
.${p}-utitle{font-size:12px;font-weight:500;opacity:.85;margin-top:1px}
.${p}-pts-box{margin-left:auto;text-align:right}
.${p}-pts-num{font-size:30px;font-weight:800;line-height:1;letter-spacing:-.02em}
.${p}-pts-label{font-size:10px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;opacity:.85;margin-top:3px}
.${p}-prog{position:relative;z-index:1;margin-top:16px}
.${p}-prog-meta{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;margin-bottom:7px}
.${p}-prog-meta .${p}-tier{display:inline-flex;align-items:center;gap:5px;font-weight:800}
.${p}-prog-bar{height:7px;background:rgba(255,255,255,.25);border-radius:4px;overflow:hidden}
.${p}-prog-fill{height:100%;background:#fff;border-radius:4px;transition:width .5s cubic-bezier(.22,.9,.3,1)}
.${p}-prog-scale{display:flex;justify-content:space-between;font-size:10px;font-weight:600;opacity:.8;margin-top:5px}
/* ── Tabs ── */
.${p}-tabs{display:inline-flex;gap:2px;padding:3px;background:var(--bg-soft);border-radius:var(--r-md);margin-bottom:16px}
.${p}-tab{padding:7px 16px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;color:var(--gray);background:none;font-family:inherit;transition:color .18s,background .18s,box-shadow .18s;white-space:nowrap}
.${p}-tab.active{background:#fff;color:var(--primary);box-shadow:var(--shadow-sm)}
.${p}-cats{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}
.${p}-cat{padding:6px 13px;border:1.5px solid var(--border);border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;background:#fff;color:var(--gray);font-family:inherit;transition:all .15s;white-space:nowrap}
.${p}-cat:hover{border-color:rgba(var(--primary-rgb),.4);color:var(--primary)}
.${p}-cat.active{background:rgba(var(--primary-rgb),.08);border-color:transparent;color:var(--primary)}
/* ── Rewards grid ── */
.${p}-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px}
.${p}-grid.intro>*{animation:${p}-rise .42s cubic-bezier(.22,.9,.3,1) backwards}
.${p}-grid.intro>*:nth-child(1){animation-delay:.02s}
.${p}-grid.intro>*:nth-child(2){animation-delay:.06s}
.${p}-grid.intro>*:nth-child(3){animation-delay:.1s}
.${p}-grid.intro>*:nth-child(4){animation-delay:.14s}
.${p}-grid.intro>*:nth-child(n+5){animation-delay:.18s}
@keyframes ${p}-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.${p}-rcard{position:relative;background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:15px;display:flex;flex-direction:column;gap:7px;transition:transform .16s,box-shadow .16s,border-color .16s}
.${p}-rcard.afford{cursor:pointer}
.${p}-rcard.afford:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:transparent}
.${p}-rcard.locked{opacity:.62}
.${p}-ricon{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:linear-gradient(135deg,rgba(var(--primary-rgb),.1),rgba(var(--accent-rgb),.14));color:var(--primary);margin-bottom:2px}
.${p}-rcard.locked .${p}-ricon{background:var(--bg-soft);color:var(--gray-lt)}
.${p}-rname{font-size:13px;font-weight:700;color:var(--dark);line-height:1.3}
.${p}-rdesc{font-size:11px;color:var(--gray);line-height:1.45}
.${p}-rpts{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;padding:4px 9px;border-radius:8px;margin-top:auto;align-self:flex-start}
.${p}-rpts.afford{color:var(--primary);background:rgba(var(--primary-rgb),.09)}
.${p}-rpts.pricey{color:var(--gray-lt);background:var(--bg-soft)}
.${p}-rpts svg{opacity:.85}
.${p}-redeem{width:100%;margin-top:3px;padding:9px 0;border-radius:var(--r-md);border:none;color:var(--primary-text);font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,var(--primary),var(--accent));box-shadow:0 3px 10px rgba(var(--primary-rgb),.28);transition:filter .15s,transform .15s}
.${p}-redeem:hover{filter:brightness(1.05);transform:translateY(-1px)}
.${p}-lockb{position:absolute;top:13px;right:13px;color:var(--gray-lt);display:flex}
/* ── History ── */
.${p}-sec-label{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt);margin-bottom:11px}
.${p}-hist{display:flex;flex-direction:column;gap:9px}
.${p}-hitem{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--border);border-radius:var(--r-md);padding:11px 14px;transition:border-color .15s}
.${p}-hitem:hover{border-color:rgba(var(--primary-rgb),.3)}
.${p}-hicon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;background:linear-gradient(135deg,rgba(var(--primary-rgb),.1),rgba(var(--accent-rgb),.14));color:var(--primary);flex-shrink:0}
.${p}-hinfo{flex:1;min-width:0}
.${p}-hname{font-size:13px;font-weight:700;color:var(--dark)}
.${p}-hdate{font-size:11px;color:var(--gray-lt);margin-top:1px}
.${p}-hpts{font-size:13px;font-weight:800;color:var(--primary);white-space:nowrap}
/* ── Modal ── */
.${p}-modal-bg{position:fixed;inset:0;background:rgba(20,20,25,.4);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:100000;opacity:0;pointer-events:none;transition:opacity .2s;padding:20px}
.${p}-modal-bg.open{opacity:1;pointer-events:all}
.${p}-modal{background:#fff;border-radius:var(--r-lg);padding:22px;max-width:340px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,.25);transform:translateY(12px) scale(.97);transition:transform .25s cubic-bezier(.22,.9,.3,1)}
.${p}-modal-bg.open .${p}-modal{transform:none}
.${p}-modal-ic{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--primary-text);background:linear-gradient(135deg,var(--primary),var(--accent));margin-bottom:13px}
.${p}-modal-ic svg{width:22px;height:22px}
.${p}-modal-title{font-size:17px;font-weight:800;margin-bottom:6px;color:var(--dark)}
.${p}-modal-sub{font-size:13px;color:var(--gray);margin-bottom:18px;line-height:1.55}
.${p}-modal-sub strong{color:var(--dark);font-weight:700}
.${p}-modal-actions{display:flex;gap:9px}
.${p}-mbtn{flex:1;padding:11px;border-radius:var(--r-md);font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;transition:filter .15s,background .15s}
.${p}-mcancel{background:var(--bg-soft);border:none;color:var(--gray)}
.${p}-mconfirm{background:linear-gradient(135deg,var(--primary),var(--accent));border:none;color:var(--primary-text);box-shadow:0 4px 12px rgba(var(--primary-rgb),.3)}
.${p}-mconfirm:hover{filter:brightness(1.05)}
.${p}-mconfirm:disabled{opacity:.6;cursor:default;filter:none}
/* checkout: processing + success states */
.${p}-modal.center{text-align:center}
.${p}-modal-ic.ok{background:linear-gradient(135deg,var(--success),#3FB068);margin-left:auto;margin-right:auto}
.${p}-modal-spin{width:42px;height:42px;border-radius:50%;border:3px solid rgba(var(--primary-rgb),.18);border-top-color:var(--primary);animation:${p}-spin .7s linear infinite;margin:6px auto 16px}
@keyframes ${p}-spin{to{transform:rotate(360deg)}}
.${p}-receipt{margin-top:14px;border:1px solid var(--border);border-radius:var(--r-md);padding:4px 13px;background:var(--bg-soft)}
.${p}-receipt-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:9px 0;color:var(--gray)}
.${p}-receipt-row+.${p}-receipt-row{border-top:1px dashed var(--border)}
.${p}-receipt-row strong{font-weight:800;color:var(--dark)}
.${p}-receipt-row .${p}-rc-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;color:var(--dark)}
/* ── Toast / empty ── */
.${p}-toast{position:fixed;bottom:22px;left:50%;transform:translate(-50%,8px);background:var(--dark);color:#fff;padding:11px 18px;border-radius:var(--r-md);font-size:13px;font-weight:700;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;white-space:nowrap;z-index:100001;box-shadow:var(--shadow-md);display:flex;align-items:center;gap:8px}
.${p}-toast.show{opacity:1;transform:translate(-50%,0)}
.${p}-empty{text-align:center;padding:34px 16px;color:var(--gray-lt);font-size:13px;font-weight:500}
/* ── Neutralize Staffbase global button rules (margin:auto / width:90% / blue+red
      hover/focus/active backgrounds). Their rules aren't !important, so these win. */
.${p} button{width:auto!important;margin:0!important;box-sizing:border-box;font-family:inherit;line-height:normal!important}
.${p} button:focus,.${p} button:focus-visible{outline:none!important;box-shadow:none}
.${p}-redeem,.${p}-mbtn{width:100%!important}
.${p}-tab,.${p}-tab:hover,.${p}-tab:focus,.${p}-tab:active{background:none!important;color:var(--gray)!important}
.${p}-tab.active,.${p}-tab.active:hover,.${p}-tab.active:focus,.${p}-tab.active:active{background:#fff!important;color:var(--primary)!important}
.${p}-cat,.${p}-cat:focus,.${p}-cat:active{background:#fff!important;color:var(--gray)!important}
.${p}-cat:hover{color:var(--primary)!important}
.${p}-cat.active,.${p}-cat.active:hover,.${p}-cat.active:focus,.${p}-cat.active:active{background:rgba(var(--primary-rgb),.08)!important;color:var(--primary)!important}
.${p}-redeem,.${p}-redeem:hover,.${p}-redeem:focus,.${p}-redeem:active,
.${p}-mconfirm,.${p}-mconfirm:hover,.${p}-mconfirm:focus,.${p}-mconfirm:active{background:linear-gradient(135deg,var(--primary),var(--accent))!important;color:var(--primary-text)!important;border:none!important}
.${p}-mcancel,.${p}-mcancel:hover,.${p}-mcancel:focus,.${p}-mcancel:active{background:var(--bg-soft)!important;color:var(--gray)!important;border:none!important}
@media (prefers-reduced-motion:reduce){.${p}-grid.intro>*{animation:none!important}}
`;
}
const factory = (BaseBlockClass, widgetApi) => {
    return class RewardsWidget extends BaseBlockClass {
        constructor() {
            super();
        }
        renderBlock(container) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a;
                ensureTablerIcons(); // load the icon font so catalog icons render inside Staffbase
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
                const token = this.getAttribute("apitoken") || "";
                const pointsField = this.getAttribute("pointsfield") || "points";
                const adminId = this.getAttribute("adminuserid") || DEFAULT_ADMIN_ID;
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
                const p = "rwd";
                let catalog = DEFAULT_CATALOG;
                try {
                    const raw = this.getAttribute("catalogjson");
                    if (raw)
                        catalog = JSON.parse(raw);
                }
                catch (_b) { }
                // Get current user via widget API, then fetch full profile for custom fields
                let userId = "";
                let userName = "";
                let userTitle = "";
                let userInitials = "??";
                let userPts = 0;
                try {
                    const prof = yield widgetApi.getUserInformation();
                    userId = prof.id || "";
                    if (userId) {
                        const r = yield fetch(`${baseUrl}/users/${userId}`, apiOpts());
                        const data = yield r.json();
                        const firstName = data.firstName || prof.firstName || "";
                        const lastName = data.lastName || prof.lastName || "";
                        userName = `${firstName} ${lastName}`.trim();
                        userTitle = [data.position || prof.position, data.location || prof.location].filter(Boolean).join(" · ");
                        userInitials = ((firstName[0] || "") + (lastName[0] || "")).toUpperCase() || "??";
                        userPts = parseInt(((_a = data === null || data === void 0 ? void 0 : data.profile) === null || _a === void 0 ? void 0 : _a[pointsField]) || "0", 10);
                    }
                }
                catch (_c) { }
                const historyKey = `rewards-history-${userId || "anon"}`;
                let history = [];
                try {
                    history = JSON.parse(localStorage.getItem(historyKey) || "[]");
                }
                catch (_d) { }
                // Compute tier
                function renderTierBar(pts) {
                    const tier = getTier(pts);
                    const next = getNextTier(pts);
                    if (!next || tier.name === "Platinum") {
                        return `<div class="${p}-prog-meta"><span class="${p}-tier">${ICONS.medal}${tier.name}</span><span>Max tier reached</span></div>
<div class="${p}-prog-bar"><div class="${p}-prog-fill" style="width:100%"></div></div>`;
                    }
                    const pct = Math.max(2, Math.round(((pts - tier.min) / (next.max - tier.min)) * 100));
                    const toGo = next.max - pts;
                    return `<div class="${p}-prog-meta"><span class="${p}-tier">${ICONS.medal}${tier.name}</span><span id="tierPtsLeft">${toGo.toLocaleString()} pts to ${next.name}</span></div>
<div class="${p}-prog-bar"><div class="${p}-prog-fill" style="width:${pct}%"></div></div>
<div class="${p}-prog-scale"><span>${tier.min.toLocaleString()}</span><span>${next.max.toLocaleString()}</span></div>`;
                }
                const cats = ["all", ...Array.from(new Set(catalog.map(c => c.cat)))];
                container.innerHTML = `<style>${buildCss(p)}</style>
<div class="${p}" style="--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent:${accentColor};--accent-rgb:${accentRgb};--primary-text:${primaryText};background:${bgColor || "transparent"}">
  <div class="${p}-header">
    <div class="${p}-title">
      <span class="${p}-title-icon">${ICONS.gift}</span>
      Rewards
    </div>
    <span class="${p}-sub">Redeem points</span>
  </div>

  <div class="${p}-hero">
    <div class="${p}-hero-top">
      <div class="${p}-av">${userInitials}</div>
      <div>
        <div class="${p}-name">${userName || "Loading…"}</div>
        <div class="${p}-utitle">${userTitle}</div>
      </div>
      <div class="${p}-pts-box">
        <div class="${p}-pts-num" id="ptsDisplay">${userPts.toLocaleString()}</div>
        <div class="${p}-pts-label">available points</div>
      </div>
    </div>
    <div class="${p}-prog" id="tierBar">${renderTierBar(userPts)}</div>
  </div>

  <div class="${p}-tabs">
    <button class="${p}-tab active" data-tab="shop">Rewards shop</button>
    <button class="${p}-tab" data-tab="history">History</button>
  </div>

  <div id="view-shop">
    <div class="${p}-cats">
      ${cats.map(c => `<button class="${p}-cat${c === "all" ? " active" : ""}" data-cat="${c}">${c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}</button>`).join("")}
    </div>
    <div class="${p}-grid" id="rewardsGrid"></div>
  </div>

  <div id="view-history" style="display:none">
    <div class="${p}-sec-label">Redemption history</div>
    <div class="${p}-hist" id="histList"></div>
  </div>
</div>

<div class="${p}-modal-bg" id="modalBg">
  <div class="${p}-modal" id="modalBox"></div>
</div>

<div class="${p}-toast" id="toast"></div>`;
                // --- State ---
                let currentPts = userPts;
                let catFilter = "all";
                let pendingItem = null;
                let gridIntroUsed = false;
                let checkoutBusy = false; // guards against double-submit while points are persisting
                const ptsDisplay = container.querySelector("#ptsDisplay");
                const tierBar = container.querySelector("#tierBar");
                const rewardsGrid = container.querySelector("#rewardsGrid");
                const histList = container.querySelector("#histList");
                const modalBg = container.querySelector("#modalBg");
                const modalBox = container.querySelector("#modalBox");
                const toast = container.querySelector("#toast");
                function showToast(msg, ok = true) {
                    toast.innerHTML = (ok ? ICONS.check : "") + msg;
                    toast.style.background = ok ? "var(--success)" : "var(--error)";
                    toast.classList.add("show");
                    setTimeout(() => toast.classList.remove("show"), 3000);
                }
                function updatePtsDisplay() {
                    ptsDisplay.textContent = currentPts.toLocaleString();
                    tierBar.innerHTML = renderTierBar(currentPts);
                }
                function renderGrid() {
                    const items = catFilter === "all" ? catalog : catalog.filter(c => c.cat === catFilter);
                    if (items.length === 0) {
                        rewardsGrid.classList.remove("intro");
                        rewardsGrid.innerHTML = `<div class="${p}-empty" style="grid-column:1/-1">No items in this category.</div>`;
                        return;
                    }
                    if (!gridIntroUsed) {
                        rewardsGrid.classList.add("intro");
                        gridIntroUsed = true;
                    }
                    else
                        rewardsGrid.classList.remove("intro");
                    rewardsGrid.innerHTML = items.map(item => {
                        const canAfford = currentPts >= item.pts;
                        return `<div class="${p}-rcard ${canAfford ? "afford" : "locked"}" data-id="${item.id}">
  <div class="${p}-ricon"><i class="ti ${item.icon}" aria-hidden="true"></i></div>
  <div class="${p}-rname">${item.name}</div>
  <div class="${p}-rdesc">${item.desc}</div>
  <div class="${p}-rpts ${canAfford ? "afford" : "pricey"}">${ICONS.spark}${item.pts.toLocaleString()}</div>
  ${canAfford
                            ? `<button class="${p}-redeem" data-id="${item.id}">Redeem</button>`
                            : `<span class="${p}-lockb">${ICONS.lock}</span>`}
</div>`;
                    }).join("");
                    rewardsGrid.querySelectorAll(`.${p}-redeem`).forEach(btn => {
                        btn.addEventListener("click", (e) => {
                            e.stopPropagation();
                            const id = btn.dataset.id;
                            const item = catalog.find(c => c.id === id);
                            if (!item)
                                return;
                            openCheckout(item);
                        });
                    });
                }
                function renderHistory() {
                    if (history.length === 0) {
                        histList.innerHTML = `<div class="${p}-empty">No redemptions yet.</div>`;
                        return;
                    }
                    histList.innerHTML = history.map(h => `
<div class="${p}-hitem">
  <div class="${p}-hicon"><i class="ti ${h.icon}" aria-hidden="true"></i></div>
  <div class="${p}-hinfo">
    <div class="${p}-hname">${h.name}</div>
    <div class="${p}-hdate">${h.date}</div>
  </div>
  <div class="${p}-hpts">-${h.pts.toLocaleString()} pts</div>
</div>`).join("");
                }
                // --- Tabs ---
                container.querySelectorAll(`.${p}-tab`).forEach(btn => {
                    btn.addEventListener("click", () => {
                        const t = btn.dataset.tab;
                        container.querySelectorAll(`.${p}-tab`).forEach(b => b.classList.remove("active"));
                        btn.classList.add("active");
                        container.querySelector("#view-shop").style.display = t === "shop" ? "" : "none";
                        container.querySelector("#view-history").style.display = t === "history" ? "" : "none";
                        if (t === "history")
                            renderHistory();
                    });
                });
                // --- Category filters ---
                container.querySelectorAll(`.${p}-cat`).forEach(btn => {
                    btn.addEventListener("click", () => {
                        catFilter = btn.dataset.cat;
                        container.querySelectorAll(`.${p}-cat`).forEach(b => b.classList.remove("active"));
                        btn.classList.add("active");
                        gridIntroUsed = false; // re-stagger on category change
                        renderGrid();
                    });
                });
                // ── Checkout flow ───────────────────────────────────────────────────
                // A (mock) gift-card checkout that DOES really deduct the user's points
                // from their Staffbase profile. Three steps: confirm → processing → done.
                function closeCheckout() {
                    if (checkoutBusy)
                        return; // don't dismiss mid-transaction
                    modalBg.classList.remove("open");
                    pendingItem = null;
                }
                function openCheckout(item) {
                    pendingItem = item;
                    modalBox.classList.remove("center");
                    modalBox.innerHTML = `
          <div class="${p}-modal-ic">${ICONS.gift}</div>
          <div class="${p}-modal-title">Confirm redemption</div>
          <div class="${p}-modal-sub">You're about to redeem <strong>${item.name}</strong> for <strong>${item.pts.toLocaleString()} pts</strong>.<br><br>Your balance after: <strong>${(currentPts - item.pts).toLocaleString()} pts</strong></div>
          <div class="${p}-modal-actions">
            <button class="${p}-mbtn ${p}-mcancel" data-act="cancel">Cancel</button>
            <button class="${p}-mbtn ${p}-mconfirm" data-act="confirm">Redeem now</button>
          </div>`;
                    bindModal();
                    modalBg.classList.add("open");
                }
                function showProcessing() {
                    checkoutBusy = true;
                    modalBox.classList.add("center");
                    modalBox.innerHTML = `
          <div class="${p}-modal-spin"></div>
          <div class="${p}-modal-title">Processing…</div>
          <div class="${p}-modal-sub">Confirming your redemption and updating your balance.</div>`;
                }
                function showSuccess(item) {
                    checkoutBusy = false;
                    const orderNo = "RWD-" + Date.now().toString(36).toUpperCase().slice(-6);
                    modalBox.classList.add("center");
                    modalBox.innerHTML = `
          <div class="${p}-modal-ic ok">${ICONS.check}</div>
          <div class="${p}-modal-title">You're all set!</div>
          <div class="${p}-modal-sub" style="text-align:left">
            <strong>${item.name}</strong> is on its way — we'll email you the details shortly.
            <div class="${p}-receipt">
              <div class="${p}-receipt-row"><span>Order</span><span class="${p}-rc-mono">${orderNo}</span></div>
              <div class="${p}-receipt-row"><span>Redeemed</span><strong>-${item.pts.toLocaleString()} pts</strong></div>
              <div class="${p}-receipt-row"><span>New balance</span><strong>${currentPts.toLocaleString()} pts</strong></div>
            </div>
          </div>
          <div class="${p}-modal-actions">
            <button class="${p}-mbtn ${p}-mconfirm" data-act="done">Done</button>
          </div>`;
                    bindModal();
                }
                function bindModal() {
                    modalBox.querySelectorAll("[data-act]").forEach(btn => {
                        btn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                            const act = btn.dataset.act;
                            if (act === "cancel" || act === "done") {
                                closeCheckout();
                                return;
                            }
                            if (act === "confirm" && pendingItem)
                                yield runRedemption(pendingItem);
                        }));
                    });
                }
                function runRedemption(item) {
                    return __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        showProcessing();
                        try {
                            // Re-read the live balance to avoid races, then deduct against it.
                            let latestPts = currentPts;
                            if (userId) {
                                const resp = yield fetch(`${baseUrl}/users/${userId}`, apiOpts());
                                const data = yield resp.json();
                                latestPts = parseInt(((_a = data === null || data === void 0 ? void 0 : data.profile) === null || _a === void 0 ? void 0 : _a[pointsField]) || "0", 10);
                            }
                            if (latestPts < item.pts) {
                                currentPts = latestPts;
                                updatePtsDisplay();
                                renderGrid();
                                checkoutBusy = false;
                                closeCheckout();
                                showToast("Not enough points to redeem this item.", false);
                                return;
                            }
                            const newPts = latestPts - item.pts;
                            // Persist the deduction to the user's profile (the real part of the flow).
                            if (userId) {
                                const resp = yield fetch(`${baseUrl}/users/${userId}`, Object.assign(Object.assign({}, apiOpts({
                                    method: "PUT",
                                    body: JSON.stringify({ profile: { [pointsField]: String(newPts) } }),
                                })), { headers: Object.assign(Object.assign({}, makeApiOpts(token).headers), { USERID: adminId }) }));
                                if (!resp.ok)
                                    throw new Error("Failed to update points");
                            }
                            currentPts = newPts;
                            updatePtsDisplay();
                            renderGrid();
                            // Save to history
                            const entry = {
                                name: item.name,
                                icon: item.icon,
                                pts: item.pts,
                                date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
                            };
                            history.unshift(entry);
                            try {
                                localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 50)));
                            }
                            catch (_b) { }
                            showSuccess(item);
                        }
                        catch (_c) {
                            checkoutBusy = false;
                            closeCheckout();
                            showToast("Redemption failed. Please try again.", false);
                        }
                    });
                }
                modalBg.addEventListener("click", (e) => {
                    if (e.target === modalBg)
                        closeCheckout();
                });
                renderGrid();
                renderHistory();
            });
        }
        static get observedAttributes() {
            return ["apitoken", "baseurl", "pointsfield", "catalogjson", "adminuserid", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor"];
        }
    };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token" },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        pointsfield: { type: "string", title: "Points Profile Field Slug", default: "points" },
        adminuserid: { type: "string", title: "Admin User ID" },
        catalogjson: { type: "string", title: "Catalog Items (JSON array)", default: JSON.stringify(DEFAULT_CATALOG, null, 2) },
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
    apitoken: { "ui:widget": "password", "ui:help": "Base64-encoded API token (e.g. from *.staffbase.com or *.staffbase.rocks)" },
    baseurl: { "ui:help": "API base URL e.g. https://yourorg.staffbase.com/api" },
    pointsfield: { "ui:help": "Profile field slug that stores points (default: points)" },
    adminuserid: { "ui:help": "Admin user ID for USERID header when updating user profiles" },
    catalogjson: {
        "ui:widget": "textarea",
        "ui:help": 'JSON array of {"id","name","desc","icon","pts","cat"}. "cat" groups items into filter tabs (e.g. giftcard, swag, experience). "icon" is a Tabler icon class — suggested: ti-brand-amazon, ti-coffee, ti-music, ti-player-play, ti-shirt, ti-droplet, ti-basket, ti-tools-kitchen-2, ti-school, ti-beach, ti-gift, ti-ticket, ti-device-laptop, ti-headphones, ti-book, ti-plane, ti-cup, ti-pizza. Browse all at tabler.io/icons.',
    },
    usethemecolors: { "ui:help": "Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
    primarycolor: { "ui:widget": "color", "ui:help": "Primary brand color" },
    accentcolor: { "ui:widget": "color", "ui:help": "Accent / secondary color (used for gradients & tier hero)" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background color — leave blank for transparent" },
};
const blockDefinition = {
    name: "rewards-widget",
    label: "Rewards Widget",
    attributes: ["apitoken", "baseurl", "pointsfield", "catalogjson", "adminuserid", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor"],
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