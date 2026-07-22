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
// format: "FromName recognized ToName · Type · +Xpts" (the "· +Xpts" suffix is
// optional — it's omitted when points are disabled, so older/newer posts both parse).
const RECOG_TITLE_RE = /^(.+?) recognized (.+?) · (.+?)(?: · \+(\d+)pts)?$/;
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
    pin: `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none"><path d="M12 0A8 8 0 0 0 4 8c0 3.5 5 12 7.15 15.52a1 1 0 0 0 1.7 0C15 20 20 11.5 20 8a8 8 0 0 0-8-8Zm0 11.5A3.5 3.5 0 1 1 15.5 8 3.5 3.5 0 0 1 12 11.5Z"/></svg>`,
};
// The reward-type icons are Tabler webfont classes (ti-*). Staffbase doesn't bundle
// that font, so the widget loads it itself — otherwise the icons render blank in the
// app (they only worked in preview.html because that file links the CDN directly).
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
/* Profile links on names + avatars */
.${p}-plink{color:inherit;text-decoration:none;cursor:pointer}
.${p}-from-name.${p}-plink:hover,.${p}-to.${p}-plink:hover{text-decoration:underline}
a.${p}-av{cursor:pointer}
/* Custom profile hovercard (mirrors the platform's native card) */
.${p}-hovercard{position:fixed;z-index:99999;width:264px;background:#fff;border-radius:16px;box-shadow:0 14px 44px rgba(0,0,0,.18);overflow:hidden;opacity:0;transform:translateY(5px) scale(.98);transition:opacity .14s,transform .14s;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.${p}-hovercard *{box-sizing:border-box;margin:0;padding:0}
.${p}-hovercard.show{opacity:1;transform:none;pointer-events:auto}
.${p}-hc-banner{height:58px;background:linear-gradient(135deg,var(--primary),var(--accent))}
.${p}-hc-av{width:70px;height:70px;border-radius:50%;margin:-35px auto 0;border:4px solid #fff;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;overflow:hidden;position:relative;z-index:1}
.${p}-hc-av img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.${p}-hc-name{text-align:center;font-size:16px;font-weight:800;color:var(--dark);margin-top:11px;padding:0 16px;line-height:1.3}
.${p}-hc-pron{font-size:12px;font-weight:500;color:var(--gray-lt)}
.${p}-hc-pos{text-align:center;font-size:13px;font-weight:700;color:var(--gray);margin-top:7px;padding:0 16px;line-height:1.4}
.${p}-hc-dept{text-align:center;font-size:13px;color:var(--gray);padding:0 16px;line-height:1.4}
.${p}-hc-headline{text-align:center;font-size:13px;color:var(--gray-lt);margin-top:7px;padding:0 16px;line-height:1.45}
.${p}-hc-loc{display:flex;align-items:center;justify-content:center;gap:5px;font-size:12.5px;color:var(--gray);margin-top:9px}
.${p}-hc-loc svg{color:var(--gray-lt);flex-shrink:0}
.${p}-hc-btn{display:block;margin:14px;padding:9px;text-align:center;font-size:13px;font-weight:700;border-radius:10px;background:rgba(var(--primary-rgb),.09);color:var(--primary)!important;text-decoration:none;transition:background .15s}
.${p}-hc-btn:hover{background:rgba(var(--primary-rgb),.16);text-decoration:none}
/* Actions, bottom-right: like is always visible (borderless icon); edit reveals on
   hover to its right, so the like nudges left to make room. */
.${p}-actions{position:absolute;bottom:11px;right:14px;display:flex;align-items:center;gap:10px}
.${p}-like-btn{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--gray-lt);background:none;border:none;cursor:pointer;font-family:inherit;padding:0;line-height:1;transition:color .15s}
.${p}-like-btn svg{width:17px;height:17px;transition:transform .12s}
.${p}-like-btn:hover{color:var(--primary)}
.${p}-like-btn:active svg{transform:scale(.8)}
.${p}-like-btn.liked{color:var(--primary)}
.${p}-like-btn.liked svg{fill:var(--primary);stroke:var(--primary)}
.${p}-like-count{font-variant-numeric:tabular-nums}
.${p}-like-count:empty{display:none}
.${p}-edit-btn{display:none;width:30px;height:30px;border-radius:50%;background:#fff;border:1px solid var(--border);box-shadow:var(--shadow-sm);cursor:pointer;align-items:center;justify-content:center;color:var(--gray);transition:color .15s,border-color .15s}
.${p}-card:hover .${p}-edit-btn,.${p}-card:focus-within .${p}-edit-btn{display:flex}
.${p}-edit-btn:hover{color:var(--primary);border-color:rgba(var(--primary-rgb),.4)}
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
.${p}-opt-head{padding:6px 11px 5px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt)}
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

.${p}-tab,.${p}-tab:hover,.${p}-tab:focus,.${p}-tab:active{background:none!important;color:var(--gray)!important;border:none!important}
.${p}-tab.active,.${p}-tab.active:hover,.${p}-tab.active:focus,.${p}-tab.active:active{background:#fff!important;color:var(--primary)!important;border:none!important}
/* Force a true 30px circle — beats the host's button{width:90%;padding:10px} and our own width:auto reset (needs >.${p} button specificity) */
.${p} .${p}-recipient-change,.${p} .${p}-recipient-change:hover,.${p} .${p}-recipient-change:focus,.${p} .${p}-recipient-change:active{width:30px!important;height:30px!important;min-width:0!important;padding:0!important;border:none!important;border-radius:50%!important;display:flex!important;align-items:center;justify-content:center;flex-shrink:0}
/* Beat the host's .mouse button:hover / .touch .button.active red background */
.${p} .${p}-recipient-change,.${p} .${p}-recipient-change:focus{background:rgba(0,0,0,.04)!important;color:var(--gray)!important}
.${p} .${p}-recipient-change:hover,.${p} .${p}-recipient-change:active{background:rgba(var(--primary-rgb),.12)!important;color:var(--primary)!important}
/* Same fix for the edit (pencil) button — keep it a true 28px circle */
.${p} .${p}-edit-btn,.${p} .${p}-edit-btn:hover,.${p} .${p}-edit-btn:focus,.${p} .${p}-edit-btn:active{width:30px!important;height:30px!important;min-width:0!important;padding:0!important;border:1px solid var(--border)!important;border-radius:50%!important;align-items:center;justify-content:center;background:#fff!important}
.${p} .${p}-edit-btn,.${p} .${p}-edit-btn:focus,.${p} .${p}-edit-btn:active{color:var(--gray)!important}
.${p} .${p}-edit-btn:hover{color:var(--primary)!important;border-color:rgba(var(--primary-rgb),.4)!important}
/* like button: borderless icon; transparent bg beats host .mouse button:hover red */
.${p} .${p}-like-btn,.${p} .${p}-like-btn:hover,.${p} .${p}-like-btn:focus,.${p} .${p}-like-btn:active{background:none!important;width:auto!important;border:none!important;padding:0!important}
.${p} .${p}-like-btn,.${p} .${p}-like-btn:focus,.${p} .${p}-like-btn:active{color:var(--gray-lt)!important}
.${p} .${p}-like-btn:hover,.${p} .${p}-like-btn.liked{color:var(--primary)!important}
/* Beat host "a,a:visited,.branch-colored{color:#E50914}" on our author links */
.${p} .${p}-from-name,.${p} .${p}-from-name:visited{color:var(--dark)!important}
.${p} .${p}-to,.${p} .${p}-to:visited{color:var(--primary)!important}
.${p} a.${p}-av,.${p} a.${p}-av:visited{color:#fff!important}
.${p}-filter,.${p}-filter:focus,.${p}-filter:active{background:#fff!important;color:var(--gray)!important}
.${p}-filter:hover{color:var(--primary)!important}
.${p}-filter.active,.${p}-filter.active:hover,.${p}-filter.active:focus,.${p}-filter.active:active{background:rgba(var(--primary-rgb),.08)!important;color:var(--primary)!important}
.${p}-ktype,.${p}-ktype:hover,.${p}-ktype:focus,.${p}-ktype:active{background:#fff!important;color:var(--dark)!important}
.${p}-ktype.selected,.${p}-ktype.selected:hover,.${p}-ktype.selected:focus,.${p}-ktype.selected:active{background:rgba(var(--primary-rgb),.05)!important}
/* Lock our intended borders so the host's button / button:focus border can't bleed through */
.${p}-filter,.${p}-filter:hover,.${p}-filter:focus,.${p}-filter:active{border:1.5px solid var(--border)!important}
.${p}-filter.active,.${p}-filter.active:hover,.${p}-filter.active:focus,.${p}-filter.active:active{border-color:transparent!important}
.${p}-ktype,.${p}-ktype:hover,.${p}-ktype:focus,.${p}-ktype:active{border:1.5px solid var(--border)!important}
.${p}-ktype.selected,.${p}-ktype.selected:hover,.${p}-ktype.selected:focus,.${p}-ktype.selected:active{border-color:var(--primary)!important}
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
function relLuminance(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastColor(hex) {
    return relLuminance(hex) > 0.45 ? "#1a1a1a" : "#ffffff";
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
// From a palette, pick the color to use ON WHITE (names, active tab, etc.): the
// darkest one that's still clearly saturated, then darken further if it's still
// too light to read. Returns "" if nothing usable (caller falls back).
function pickOnWhite(cands) {
    const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
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
                // Token-only: omit the session cookie so the request is evaluated as the
                // service identity, not the viewing user (who may lack theme access).
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
            // Gather every color the theme exposes, then choose intelligently:
            //  - primary  = darkest still-saturated color (it sits on the white widget bg)
            //  - accent   = most vivid color (only used in gradients, on colored bg)
            // A configured brand color can be too light (e.g. #F7DDED) to read on white,
            // so we never just trust primary-brand-color for on-white text.
            const palette = [
                ...Object.values(customs),
                typeof ((_b = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _b === void 0 ? void 0 : _b.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "",
                resolve((_e = (_d = (_c = data === null || data === void 0 ? void 0 : data.desktopTheme) === null || _c === void 0 ? void 0 : _c.components) === null || _d === void 0 ? void 0 : _d.navigation) === null || _e === void 0 ? void 0 : _e.accentColor),
            ].filter(c => isHex(c) && !isNeutralExtreme(c));
            let primary = pickOnWhite(palette);
            // Fallback to the old resolution if the palette had nothing saturated.
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
// ── Session auth (for posting / liking AS the logged-in user) ─────────────────
// Same approach the my-tasks widget uses for comments: ride the browser session
// (credentials:include) but supply the CSRF token from the page's auth manager.
// This is required for posts to carry a real `author` (id + avatar) and for likes.
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
const factory = (BaseBlockClass, widgetApi) => {
    return class RecognitionWidget extends BaseBlockClass {
        constructor() {
            super();
        }
        renderBlock(container) {
            return __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e, _f;
                ensureTablerIcons(); // load the icon font so reward-type icons render inside Staffbase
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
                const channelId = this.getAttribute("channelid") || DEFAULT_CHANNEL;
                const token = this.getAttribute("apitoken") || "";
                const pointsField = this.getAttribute("pointsfield") || "points";
                const pointsEnabled = this.getAttribute("enablepoints") !== "false";
                const adminId = this.getAttribute("adminuserid") || DEFAULT_ADMIN_ID;
                const notificationLink = this.getAttribute("notificationlink") || "";
                const apiOpts = (extra) => makeApiOpts(token, extra);
                // Staffbase binds its native profile hovercard to author links of the form
                // <a class="internal-link clickable" href="/profile/<id>">. Matching that markup
                // exactly (relative href + those classes) makes the hovercard pop on our links too.
                const profileUrl = (id) => `/profile/${id}`;
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
                catch (_g) { }
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
                            avatar: ((_b = (_a = data.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = data.avatar) === null || _c === void 0 ? void 0 : _c.thumb) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = data.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "",
                        };
                    }
                }
                catch (_h) { }
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
                ${pointsEnabled ? `<div class="${p}-ktype-pts">+${t.points} pts</div>` : ""}
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
                        if (t === "give")
                            loadUsers(); // warm the directory cache so search is instant
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
                let allUsers = [];
                let usersLoaded = false;
                let usersLoading = null;
                const userById = new Map();
                function loadUsers() {
                    if (usersLoaded)
                        return Promise.resolve();
                    if (usersLoading)
                        return usersLoading;
                    usersLoading = (() => __awaiter(this, void 0, void 0, function* () {
                        let list = [];
                        const mapUser = (u) => {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                            return ({
                                id: u.id || "",
                                name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "",
                                avatar: ((_b = (_a = u.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = u.avatar) === null || _c === void 0 ? void 0 : _c.thumb) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = u.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "",
                                position: u.position || ((_g = u.profile) === null || _g === void 0 ? void 0 : _g.position) || "",
                                department: u.department || ((_h = u.profile) === null || _h === void 0 ? void 0 : _h.department) || "",
                                location: u.location || ((_j = u.profile) === null || _j === void 0 ? void 0 : _j.location) || "",
                                pronouns: ((_k = u.profile) === null || _k === void 0 ? void 0 : _k.pronouns) || u.pronouns || "",
                                headline: u.profileHeadline || ((_l = u.profile) === null || _l === void 0 ? void 0 : _l.profileHeadline) || "",
                            });
                        };
                        try {
                            const r = yield fetch(`${baseUrl}/users?limit=200`, apiOpts());
                            if (r.ok) {
                                const d = yield r.json();
                                list = (d.data || d || []).map(mapUser);
                            }
                        }
                        catch (_a) { }
                        // Fallback to the SDK only if REST returned nothing.
                        if (list.length === 0) {
                            try {
                                const res = yield widgetApi.getUserList({ limit: 100 });
                                list = (res.data || []).map(mapUser);
                            }
                            catch (_b) { }
                        }
                        allUsers = list.filter(u => u.id && u.name && u.id !== ((currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || ""));
                        for (const u of list)
                            if (u.id)
                                userById.set(u.id, u);
                        usersLoaded = true;
                    }))();
                    return usersLoading;
                }
                function renderUserOptions(q) {
                    const ql = q.trim().toLowerCase();
                    const matches = ql ? allUsers.filter(u => u.name.toLowerCase().includes(ql)) : allUsers.slice(0, 8);
                    if (allUsers.length === 0) {
                        userDropdown.innerHTML = `<div class="${p}-opt-empty">No colleagues found</div>`;
                    }
                    else if (matches.length === 0) {
                        userDropdown.innerHTML = `<div class="${p}-opt-empty">No matches for “${q.trim()}”</div>`;
                    }
                    else {
                        userDropdown.innerHTML = (ql ? "" : `<div class="${p}-opt-head">Suggested</div>`) + matches
                            .map(u => {
                            // Show profile picture when available; fall back to gradient initials on missing/broken image.
                            const av = u.avatar
                                ? `<span class="${p}-opt-av"><img src="${u.avatar}" alt="" onerror="this.parentElement.textContent='${getInitials(u.name)}'"></span>`
                                : `<span class="${p}-opt-av">${getInitials(u.name)}</span>`;
                            return `<div class="${p}-opt" data-id="${u.id}" data-name="${u.name}" data-avatar="${u.avatar}">${av}${u.name}</div>`;
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
                function openUserDropdown() {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (recipId.value)
                            return; // a recipient is already chosen
                        if (!usersLoaded) {
                            userDropdown.innerHTML = `<div class="${p}-opt-empty">Loading colleagues…</div>`;
                            userDropdown.style.display = "block";
                        }
                        yield loadUsers();
                        renderUserOptions(recipSearch.value);
                    });
                }
                recipSearch.addEventListener("focus", openUserDropdown);
                recipSearch.addEventListener("input", () => {
                    if (searchTimeout)
                        clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                        yield loadUsers();
                        renderUserOptions(recipSearch.value);
                    }), 150);
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
                        const postTitle = pointsEnabled
                            ? `${fromName} recognized ${toName} · ${type.name} · +${type.points}pts`
                            : `${fromName} recognized ${toName} · ${type.name}`;
                        const postContent = `<p>${message}</p>`;
                        // Create AS the logged-in user (session+CSRF) so the post carries a real
                        // author (id + avatar) and likes/ownership work. `published:true` publishes
                        // immediately. No comments, no push/email — but keep likes on.
                        yield fetch(`${baseUrl}/channels/${channelId}/posts`, sessionOpts({
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                contents: { en_US: { title: postTitle, content: postContent } },
                                published: true,
                                commentingEnabled: false,
                                likingEnabled: true,
                                notificationChannels: [],
                            }),
                        }));
                        // 2. Update recipient points (only when the points capability is enabled)
                        if (pointsEnabled) {
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
                        }
                        // 3. Send notification (best effort)
                        try {
                            yield fetch(`${baseUrl}/branch/notifications`, Object.assign({}, apiOpts({
                                method: "POST",
                                body: JSON.stringify(Object.assign({ accessorIds: [toId], channels: ["notificationCenter"], content: {
                                        en_US: {
                                            title: `You've been recognized!`,
                                            text: pointsEnabled
                                                ? `${fromName} recognized you for ${type.name} and awarded you ${type.points} points.`
                                                : `${fromName} recognized you for ${type.name}.`,
                                        },
                                    } }, (notificationLink ? { link: notificationLink } : {}))),
                            })));
                        }
                        catch (_c) { }
                        showToast(pointsEnabled ? `Recognition sent! +${type.points} pts awarded` : "Recognition sent!");
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
                let cachedPosts = [];
                let introUsed = false;
                // ── Likes (session+CSRF reactions API) ──────────────────────────────
                function fetchLikeData(postId) {
                    return __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        try {
                            const reqs = [
                                fetch(`${baseUrl}/reactions-count?parentId=${postId}&parentType=post`, sessionOpts()),
                            ];
                            if (currentUser)
                                reqs.push(fetch(`${baseUrl}/reactions?parentId=${postId}&parentType=post&userId=${currentUser.id}`, sessionOpts()));
                            const res = yield Promise.all(reqs);
                            const countJson = yield res[0].json();
                            const count = ((_a = (countJson.data || []).find((x) => x.type === "LIKE")) === null || _a === void 0 ? void 0 : _a.count) || 0;
                            let mine = false;
                            if (res[1]) {
                                const mineJson = yield res[1].json();
                                mine = (mineJson.data || []).some((x) => x.type === "LIKE");
                            }
                            return { count, mine };
                        }
                        catch (_b) {
                            return { count: 0, mine: false };
                        }
                    });
                }
                function updateLikeButton(post) {
                    const btn = feed.querySelector(`.${p}-card[data-post-id="${post.id}"] .${p}-like-btn`);
                    if (!btn)
                        return;
                    btn.classList.toggle("liked", post.likedByMe);
                    const c = btn.querySelector(`.${p}-like-count`);
                    if (c)
                        c.textContent = post.likeCount ? String(post.likeCount) : "";
                }
                function toggleLike(post) {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (!currentUser)
                            return;
                        const liking = !post.likedByMe;
                        post.likedByMe = liking;
                        post.likeCount = Math.max(0, post.likeCount + (liking ? 1 : -1));
                        updateLikeButton(post);
                        try {
                            if (liking) {
                                yield fetch(`${baseUrl}/reactions`, sessionOpts({
                                    method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ parentId: post.id, parentType: "post", type: "LIKE" }),
                                }));
                            }
                            else {
                                yield fetch(`${baseUrl}/reactions?parentId=${post.id}&parentType=post`, sessionOpts({ method: "DELETE" }));
                            }
                        }
                        catch (_a) {
                            // revert on failure
                            post.likedByMe = !liking;
                            post.likeCount = Math.max(0, post.likeCount + (liking ? -1 : 1));
                            updateLikeButton(post);
                            showToast("Couldn't update your like.", false);
                        }
                    });
                }
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
                        const myName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : "";
                        // Prefer the real author id; fall back to a name match for older app-authored posts.
                        const isOwn = !!currentUser && (post.fromId ? post.fromId === currentUser.id : myName === post.fromName);
                        const isRecipient = !!myName && myName === post.toName;
                        // Wrap avatars / names in internal-link author anchors so Staffbase's native
                        // profile hovercard pops on hover (matches the platform's own author links).
                        const fromInner = post.fromAvatar ? `<img src="${post.fromAvatar}" alt="" onerror="this.parentElement.innerHTML='${fromInitials}'">` : fromInitials;
                        const fromAvDiv = post.fromId
                            ? `<a class="${p}-av ${p}-av-from internal-link clickable" href="${profileUrl(post.fromId)}" data-uid="${post.fromId}">${fromInner}</a>`
                            : `<div class="${p}-av ${p}-av-from">${fromInner}</div>`;
                        const toInner = post.toAvatar ? `<img src="${post.toAvatar}" alt="" onerror="this.parentElement.innerHTML='${toInitials}'">` : toInitials;
                        const toAvDiv = post.toName
                            ? (post.toId
                                ? `<a class="${p}-av ${p}-av-to internal-link clickable" href="${profileUrl(post.toId)}" data-uid="${post.toId}">${toInner}</a>`
                                : `<div class="${p}-av ${p}-av-to">${toInner}</div>`)
                            : "";
                        const fromNameEl = post.fromId
                            ? `<a class="${p}-from-name ${p}-plink internal-link clickable" href="${profileUrl(post.fromId)}" data-uid="${post.fromId}">${fromName}</a>`
                            : `<span class="${p}-from-name">${fromName}</span>`;
                        const toNameEl = post.toId
                            ? `<a class="${p}-to ${p}-plink internal-link clickable" href="${profileUrl(post.toId)}" data-uid="${post.toId}">${post.toName}</a>`
                            : `<span class="${p}-to">${post.toName}</span>`;
                        return `<div class="${p}-card" data-post-id="${post.id}">
  <div class="${p}-card-head">
    <div class="${p}-av-stack">${fromAvDiv}${toAvDiv}</div>
    <div class="${p}-who">
      <div class="${p}-from">${fromNameEl}${post.toName ? `${ICONS.arrow}${toNameEl}` : ""}</div>
      <div class="${p}-time">${timeAgo(post.created)}</div>
    </div>
    ${post.type || (isRecipient && post.pts) ? `<div class="${p}-badges">${post.type ? `<span class="${p}-type-badge"><i class="ti ${iconCls}"></i>${post.type}</span>` : ""}${isRecipient && post.pts ? `<span class="${p}-pts-badge">+${post.pts} pts</span>` : ""}</div>` : ""}
  </div>
  ${post.message ? `<div class="${p}-msg">${post.message}</div>` : ""}
  <div class="${p}-actions">
    <button class="${p}-like-btn${post.likedByMe ? " liked" : ""}" data-post-id="${post.id}" aria-label="Like">${ICONS.heart}<span class="${p}-like-count">${post.likeCount || ""}</span></button>
    ${isOwn ? `<button class="${p}-edit-btn" title="Edit" aria-label="Edit">${ICONS.edit}</button>` : ""}
  </div>
</div>`;
                    }).join("");
                    feed.querySelectorAll(`.${p}-like-btn`).forEach(btn => {
                        btn.addEventListener("click", () => {
                            const id = btn.dataset.postId;
                            const post = cachedPosts.find(cp => cp.id === id);
                            if (post)
                                toggleLike(post);
                        });
                    });
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
                                        yield fetch(`${baseUrl}/posts/${postId}`, sessionOpts({
                                            method: "PUT",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                                contents: { en_US: { title: post.title, content: `<p>${newMsg}</p>` } },
                                                // Preserve the original publish timestamp so the edit doesn't unpublish or reorder it.
                                                published: post.created,
                                            }),
                                        }));
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
                // ── Custom profile hovercard ────────────────────────────────────────
                // The platform's native hovercard is React/Radix-bound to its own nodes and
                // can't attach to our injected links, so we render our own (same look) on
                // hover of any [data-uid] author link, using the cached directory profile.
                const hc = document.createElement("div");
                hc.className = `${p}-hovercard`;
                // Appended to <body> (not the widget root) so position:fixed is viewport-relative
                // and can't be thrown off by a transformed ancestor. Carry the theme vars inline.
                hc.style.cssText = `--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent:${accentColor};--accent-rgb:${accentRgb};--primary-text:${primaryText};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb`;
                document.body.appendChild(hc);
                let hcShowTimer = null;
                let hcHideTimer = null;
                function positionHover(anchor) {
                    const r = anchor.getBoundingClientRect();
                    const w = 264, gap = 8;
                    let left = r.left + r.width / 2 - w / 2;
                    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
                    const h = hc.offsetHeight || 230;
                    let top = r.bottom + gap;
                    if (top + h > window.innerHeight - 8)
                        top = Math.max(8, r.top - gap - h); // flip above
                    hc.style.left = `${left}px`;
                    hc.style.top = `${top}px`;
                }
                function showHover(id, anchor) {
                    const u = userById.get(id);
                    if (!u)
                        return;
                    const initials = getInitials(u.name);
                    const av = u.avatar
                        ? `<img src="${u.avatar}" alt="" onerror="this.parentElement.innerHTML='${initials}'">`
                        : initials;
                    hc.innerHTML = `
          <div class="${p}-hc-banner"></div>
          <div class="${p}-hc-av">${av}</div>
          <div class="${p}-hc-name">${u.name}${u.pronouns ? ` <span class="${p}-hc-pron">(${u.pronouns})</span>` : ""}</div>
          ${u.position ? `<div class="${p}-hc-pos">${u.position}</div>` : ""}
          ${u.department ? `<div class="${p}-hc-dept">${u.department}</div>` : ""}
          ${u.headline ? `<div class="${p}-hc-headline">${u.headline}</div>` : ""}
          ${u.location ? `<div class="${p}-hc-loc">${ICONS.pin}${u.location}</div>` : ""}
          <a class="${p}-hc-btn internal-link clickable" href="${profileUrl(id)}">View profile</a>`;
                    hc.classList.add("show");
                    positionHover(anchor);
                }
                function hideHover() { hc.classList.remove("show"); }
                feed.addEventListener("mouseover", (e) => {
                    const a = e.target.closest(`[data-uid]`);
                    if (!a || !feed.contains(a))
                        return;
                    if (hcHideTimer)
                        clearTimeout(hcHideTimer);
                    if (hcShowTimer)
                        clearTimeout(hcShowTimer);
                    hcShowTimer = setTimeout(() => showHover(a.getAttribute("data-uid"), a), 220);
                });
                feed.addEventListener("mouseout", (e) => {
                    const a = e.target.closest(`[data-uid]`);
                    if (!a)
                        return;
                    if (hcShowTimer)
                        clearTimeout(hcShowTimer);
                    hcHideTimer = setTimeout(hideHover, 180);
                });
                hc.addEventListener("mouseenter", () => { if (hcHideTimer)
                    clearTimeout(hcHideTimer); });
                hc.addEventListener("mouseleave", () => { hcHideTimer = setTimeout(hideHover, 150); });
                // Prefer the session read (posts carry a real `author` → sender avatar + edit
                // ownership). If it fails (no session / permission), fall back to the API token —
                // posts still load, but the sender avatar falls back to a directory name-match.
                function fetchWallPosts() {
                    return __awaiter(this, void 0, void 0, function* () {
                        const url = `${baseUrl}/channels/${channelId}/posts?limit=30`;
                        try {
                            const r = yield fetch(url, sessionOpts());
                            if (r.ok) {
                                const j = yield r.json();
                                console.log(`[recognition] wall loaded via SESSION — ${(j.data || []).length} posts`);
                                return j.data || [];
                            }
                            console.warn(`[recognition] session wall read failed (HTTP ${r.status}); falling back to API token`);
                        }
                        catch (e) {
                            console.warn("[recognition] session wall read errored; falling back to API token", e);
                        }
                        try {
                            const r2 = yield fetch(url, apiOpts());
                            const j2 = yield r2.json();
                            console.log(`[recognition] wall loaded via API TOKEN (fallback) — ${(j2.data || []).length} posts; sender avatars resolve by name, not author`);
                            return j2.data || [];
                        }
                        catch (e) {
                            console.error("[recognition] token wall read also failed", e);
                            return [];
                        }
                    });
                }
                function loadWallPosts() {
                    return __awaiter(this, void 0, void 0, function* () {
                        try {
                            // Read via session so each post carries its real `author` (id + avatar).
                            // The recipient (toName) isn't the author, so resolve their photo from the
                            // directory; for older app-authored posts (no author) we fall back to the
                            // directory for the sender too.
                            yield loadUsers();
                            const avatarByName = new Map();
                            const idByName = new Map();
                            for (const u of allUsers) {
                                const key = u.name.trim().toLowerCase();
                                if (u.avatar)
                                    avatarByName.set(key, u.avatar);
                                if (u.id)
                                    idByName.set(key, u.id);
                            }
                            if (currentUser) {
                                const meKey = `${currentUser.firstName} ${currentUser.lastName}`.trim().toLowerCase();
                                if (currentUser.avatar)
                                    avatarByName.set(meKey, currentUser.avatar);
                                idByName.set(meKey, currentUser.id);
                            }
                            const posts = yield fetchWallPosts();
                            cachedPosts = posts.map((post) => {
                                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                                const title = ((_b = (_a = post.contents) === null || _a === void 0 ? void 0 : _a.en_US) === null || _b === void 0 ? void 0 : _b.title) || "";
                                const content = ((_d = (_c = post.contents) === null || _c === void 0 ? void 0 : _c.en_US) === null || _d === void 0 ? void 0 : _d.content) || "";
                                const m = RECOG_TITLE_RE.exec(title);
                                const fromName = (m === null || m === void 0 ? void 0 : m[1]) || "";
                                const toName = (m === null || m === void 0 ? void 0 : m[2]) || "";
                                const type = (m === null || m === void 0 ? void 0 : m[3]) || "";
                                const pts = m && m[4] ? parseInt(m[4], 10) : 0;
                                const message = content.replace(/<[^>]+>/g, "").trim();
                                const author = post.author || null;
                                const authorAvatar = ((_f = (_e = author === null || author === void 0 ? void 0 : author.avatar) === null || _e === void 0 ? void 0 : _e.icon) === null || _f === void 0 ? void 0 : _f.url) || ((_h = (_g = author === null || author === void 0 ? void 0 : author.avatar) === null || _g === void 0 ? void 0 : _g.thumb) === null || _h === void 0 ? void 0 : _h.url) || ((_k = (_j = author === null || author === void 0 ? void 0 : author.avatar) === null || _j === void 0 ? void 0 : _j.original) === null || _k === void 0 ? void 0 : _k.url) || "";
                                const fromId = (author === null || author === void 0 ? void 0 : author.id) || idByName.get(fromName.trim().toLowerCase()) || "";
                                const toId = idByName.get(toName.trim().toLowerCase()) || "";
                                const fromAvatar = authorAvatar || avatarByName.get(fromName.trim().toLowerCase()) || "";
                                const toAvatar = avatarByName.get(toName.trim().toLowerCase()) || "";
                                return { id: post.id, title, content, created: post.created || new Date().toISOString(), type, pts, fromName, fromId, toName, toId, message, fromAvatar, toAvatar, likeCount: 0, likedByMe: false };
                            });
                            renderFeedFromCache();
                            // Hydrate like counts + own-like state in parallel, then refresh each button.
                            cachedPosts.forEach((cp) => __awaiter(this, void 0, void 0, function* () {
                                const { count, mine } = yield fetchLikeData(cp.id);
                                cp.likeCount = count;
                                cp.likedByMe = mine;
                                updateLikeButton(cp);
                            }));
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
            return ["apitoken", "baseurl", "channelid", "rewardtypes", "enablepoints", "pointsfield", "adminuserid", "notificationlink", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor"];
        }
    };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token" },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        channelid: { type: "string", title: "Social Wall Channel ID" },
        rewardtypes: { type: "string", title: "Reward Types (JSON array)", default: JSON.stringify(DEFAULT_REWARD_TYPES, null, 2) },
        enablepoints: { type: "boolean", title: "Enable Points", default: true },
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
        // Only expose the points profile-field slug when the points capability is enabled.
        enablepoints: {
            oneOf: [
                {
                    properties: {
                        enablepoints: { const: true },
                        pointsfield: { type: "string", title: "Points Profile Field Slug", default: "points" },
                    },
                },
                {
                    properties: { enablepoints: { const: false } },
                },
            ],
        },
    },
};
const uiSchema = {
    apitoken: { "ui:widget": "password", "ui:help": "Base64-encoded API token (e.g. from *.staffbase.com or *.staffbase.rocks)" },
    baseurl: { "ui:help": "API base URL e.g. https://yourorg.staffbase.com/api" },
    channelid: { "ui:help": "ID of the Social Wall channel where recognitions will be posted" },
    rewardtypes: {
        "ui:widget": "textarea",
        "ui:help": 'JSON array of {"name","icon","points"}. "points" is optional and ignored when "Enable Points" is off. "icon" is a Tabler icon class — suggested: ti-users, ti-bulb, ti-star, ti-rocket, ti-target, ti-heart, ti-trophy, ti-award, ti-medal, ti-crown, ti-thumb-up, ti-flame, ti-bolt, ti-shield, ti-confetti, ti-mood-happy, ti-hand-love-you, ti-diamond. Browse all at tabler.io/icons.',
    },
    enablepoints: { "ui:help": "Award and display points for recognitions. Turn off for kudos-only mode — the points UI, profile updates, and the \"points\" field in Reward Types are all skipped." },
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
    attributes: ["apitoken", "baseurl", "channelid", "rewardtypes", "enablepoints", "pointsfield", "adminuserid", "notificationlink", "usethemecolors", "primarycolor", "accentcolor", "backgroundcolor"],
    factory,
    configurationSchema,
    uiSchema,
    blockLevel: "block",
    iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iI0RBMkUzMiIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzLjUgNDMuNSkgc2NhbGUoMy41KSIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSJub25lIj48cGF0aCBkPSJNMTkuNSAxMi41NzIgMTIgMjBsLTcuNS03LjQyOEE1IDUgMCAxIDEgMTIgNi4wMDZhNSA1IDAgMSAxIDcuNSA2LjU2NloiLz48L2c+PC9zdmc+",
};
const externalBlockDefinition = {
    blockDefinition,
    author: "Staffbase",
    version: "1.0.0",
};
window.defineBlock(externalBlockDefinition);


/******/ })()
;