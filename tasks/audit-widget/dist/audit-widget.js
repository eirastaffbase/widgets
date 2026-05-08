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
// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlqYwqZ6gaq-nwDbIQ0M1spl77Qu5_fZtOwytNYYAsBKC_baY7WGUOEmM60Y6edInr/exec";
const DEFAULT_API_TOKEN = "NjljMjU3N2JjZmFjZWYxMzc4MzIzYTNkOkp6VEpkaGlfclRyRDk4bjlBZ2pIdXFkcmI3UjQhdl1LTm1RV1hwOHBIdUd+Unl3clk7MjYhSS1JdiprLGdOaVI=";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY = "#da2e32";
const DEFAULT_ACCENT = "#da2e32";
const DEFAULT_THRESHOLD = "90";
const DUMMY_QUESTIONS = [
    { id: "EXT-001", cat: "Exterior", text: "Parking lot is free of trash and debris", type: "pf", pts: 3, critical: false, task: true, taskTitle: "Clean parking lot", taskRole: "Crew Member", taskPriority: "High", taskDue: 1 },
    { id: "DR-001", cat: "Dining Room", text: "All tables are clean and sanitized", type: "pf", pts: 3, critical: false, task: true, taskTitle: "Sanitize all dining room tables", taskRole: "Crew Member", taskPriority: "High", taskDue: 1 },
    { id: "ST-001", cat: "Serving Table", text: "Hot food holding temps are within range (≥140°F)", type: "temp", pts: 5, critical: true, task: true, taskTitle: "Adjust holding temp — FOOD SAFETY RISK", taskRole: "Manager", taskPriority: "Critical", taskDue: 0 },
    { id: "BOH-001", cat: "Back of House", text: "Walk-in cooler temps within range (35–41°F)", type: "temp", pts: 5, critical: true, task: true, taskTitle: "Adjust cooler temp — FOOD SAFETY RISK", taskRole: "Manager", taskPriority: "Critical", taskDue: 0 },
];
// ── Config schema ─────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        appsscripturl: { type: "string", title: "Apps Script URL", default: DEFAULT_APPS_SCRIPT_URL },
        apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY },
        accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT },
        backgroundcolor: { type: "string", title: "Background Color", default: "" },
        storelabelsingular: { type: "string", title: "Store Label (singular)", default: "Store" },
        storelabelplural: { type: "string", title: "Store Label (plural)", default: "Stores" },
        passthreshold: { type: "string", title: "Pass Threshold (%)", default: DEFAULT_THRESHOLD },
    },
};
const uiSchema = {
    apitoken: { "ui:widget": "password", "ui:help": "Staffbase Basic auth token" },
    appsscripturl: { "ui:help": "Deployed Google Apps Script URL returning audit questions" },
    baseurl: { "ui:help": "Staffbase API base URL" },
    primarycolor: { "ui:widget": "color" },
    accentcolor: { "ui:widget": "color" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Leave blank for transparent" },
    storelabelsingular: { "ui:help": "e.g. Store, Location, Branch" },
    storelabelplural: { "ui:help": "e.g. Stores, Locations, Branches" },
    passthreshold: { "ui:help": "Score % required to pass (default 90)" },
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
    return L > 0.179 ? "#1a1a1a" : "#ffffff";
}
function fuzzyMatchGroup(role, groups) {
    const rl = role.toLowerCase();
    const exact = groups.find(g => g.name.toLowerCase().includes(rl) || rl.includes(g.name.toLowerCase()));
    if (exact)
        return exact.id;
    const words = rl.split(/\s+/);
    let best = 0, bestId = null;
    for (const g of groups) {
        const gl = g.name.toLowerCase();
        const hits = words.filter(w => w.length > 2 && gl.includes(w)).length;
        if (hits > best) {
            best = hits;
            bestId = g.id;
        }
    }
    return bestId;
}
// ── Widget factory ────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class AuditWidget extends BaseBlockClass {
        constructor() { super(); }
        renderBlock(container) {
            return __awaiter(this, void 0, void 0, function* () {
                const appsScriptUrl = this.getAttribute("appsscripturl") || DEFAULT_APPS_SCRIPT_URL;
                const apiToken = this.getAttribute("apitoken") || DEFAULT_API_TOKEN;
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
                const primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY;
                const accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT;
                const bgColor = this.getAttribute("backgroundcolor") || "";
                const storeS = this.getAttribute("storelabelsingular") || "Store";
                const storeP = this.getAttribute("storelabelplural") || "Stores";
                const passThreshold = parseFloat(this.getAttribute("passthreshold") || DEFAULT_THRESHOLD);
                const primaryRgb = hexToRgb(primaryColor);
                const primaryText = contrastColor(primaryColor);
                const p = "aw";
                // ── State ──────────────────────────────────────────────────────────
                let questions = [];
                let categories = [];
                let installations = [];
                let allGroups = [];
                let selectedInstId = "";
                let activeCat = "";
                let auditorName = "";
                let auditDate = new Date().toISOString().split("T")[0];
                let auditNotes = "";
                const responses = {};
                const taskGroupOverrides = {};
                let step = "setup";
                // ── HTML skeleton ──────────────────────────────────────────────────
                container.innerHTML = `
        <style>
          .${p}{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;--shadow-sm:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);--shadow-md:0 4px 16px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bgColor || "transparent"};padding:20px}
          .${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
          .${p}-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
          .${p}-title{font-size:18px;font-weight:800;color:var(--dark);display:flex;align-items:center;gap:10px}
          .${p}-title-dot{width:10px;height:10px;border-radius:50%;background:var(--primary);flex-shrink:0}
          .${p}-card{background:#fff;border-radius:var(--r-lg);box-shadow:var(--shadow-sm);border:1px solid var(--border);border-left:3px solid var(--primary);margin-bottom:12px;overflow:visible}
          .${p}-card-head{display:flex;align-items:center;gap:10px;padding:14px 18px 12px;border-bottom:1px solid var(--border)}
          .${p}-step{width:22px;height:22px;border-radius:50%;background:var(--primary);color:var(--primary-text);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
          .${p}-card-title{font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--dark);flex:1}
          .${p}-card-body{padding:16px 18px}
          .${p}-label{display:block;font-size:12px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}
          .${p}-input,.${p}-select{width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:14px;font-family:inherit;color:var(--dark);background:#fafafa;transition:border-color .15s,box-shadow .15s}
          .${p}-input::placeholder{color:var(--gray-lt)}
          .${p}-input:focus,.${p}-select:focus{outline:none;border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.1)}
          .${p}-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
          @media(max-width:480px){.${p}-row{grid-template-columns:1fr}}
          .${p}-field{display:flex;flex-direction:column;gap:5px}
          .${p}-prog-label{font-size:11px;color:var(--gray-lt);margin-bottom:5px;display:flex;justify-content:space-between}
          .${p}-prog-wrap{background:#f3f4f6;border-radius:3px;height:5px;overflow:hidden;margin-bottom:14px}
          .${p}-prog-fill{height:100%;border-radius:3px;transition:width .3s ease;background:var(--primary)}
          .${p}-cat-tabs{display:flex;gap:0;overflow-x:auto;scrollbar-width:none;border-bottom:2px solid var(--border);margin-bottom:16px}
          .${p}-cat-tabs::-webkit-scrollbar{display:none}
          .${p}-cat-tab{flex-shrink:0;padding:9px 14px;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;border-bottom:2.5px solid transparent;margin-bottom:-2px;white-space:nowrap;background:none;border-left:none;border-right:none;border-top:none;font-family:inherit;transition:color .15s,border-color .15s}
          .${p}-cat-tab:hover{color:var(--dark)}
          .${p}-cat-tab.active{color:var(--primary);border-bottom-color:var(--primary)}
          .${p}-cat-badge{display:inline-flex;align-items:center;justify-content:center;background:var(--error);color:#fff;border-radius:9px;font-size:9px;font-weight:700;padding:1px 5px;margin-left:4px}
          .${p}-question{border-bottom:1px solid var(--border);padding:14px 0}
          .${p}-question:last-child{border-bottom:none}
          .${p}-q-header{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px}
          .${p}-q-id{background:#f3f4f6;color:var(--gray);font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid var(--border);flex-shrink:0;margin-top:2px;white-space:nowrap}
          .${p}-q-text{font-size:14px;line-height:1.4;flex:1}
          .${p}-q-chips{display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap}
          .${p}-chip{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;display:inline-flex;align-items:center;gap:3px}
          .${p}-chip-pts{background:#eef2ff;color:#3730a3}
          .${p}-chip-crit{background:rgba(196,30,58,.08);color:var(--error);border:1px solid rgba(196,30,58,.2)}
          .${p}-chip-task{background:#fffbeb;color:#92400e;border:1px solid #fde68a}
          .${p}-pf-row{display:flex;gap:8px}
          .${p}-pf-btn{flex:1;padding:9px 6px;border-radius:var(--r-md);font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid var(--border);background:#fafafa;color:var(--gray);font-family:inherit;transition:all .15s;text-align:center;display:flex;align-items:center;justify-content:center;gap:4px}
          .${p}-pf-btn:hover{border-color:var(--primary);color:var(--primary)}
          .${p}-pf-btn.pass{background:rgba(46,125,74,.08);border-color:var(--success);color:var(--success)}
          .${p}-pf-btn.fail{background:rgba(196,30,58,.08);border-color:var(--error);color:var(--error)}
          .${p}-pf-btn.na{background:#f3f4f6;border-color:#9ca3af;color:var(--gray)}
          .${p}-rating-row{display:flex;gap:6px}
          .${p}-rating-btn{flex:1;padding:9px 4px;border-radius:var(--r-md);font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid var(--border);background:#fafafa;color:var(--gray);font-family:inherit;transition:all .15s;text-align:center}
          .${p}-rating-btn.low{background:rgba(196,30,58,.08);border-color:var(--error);color:var(--error)}
          .${p}-rating-btn.mid{background:#fffbeb;border-color:#d97706;color:#d97706}
          .${p}-rating-btn.hi{background:rgba(46,125,74,.08);border-color:var(--success);color:var(--success)}
          .${p}-rating-hint{display:flex;justify-content:space-between;font-size:10px;color:var(--gray-lt);margin-top:4px}
          .${p}-temp-input{width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:18px;font-weight:700;font-family:inherit;color:var(--dark);background:#fafafa;text-align:center;transition:border-color .15s,background .15s}
          .${p}-temp-input:focus{outline:none;border-color:var(--primary);background:#fff}
          .${p}-temp-input.ok{border-color:var(--success);background:rgba(46,125,74,.05)}
          .${p}-temp-input.bad{border-color:var(--error);background:rgba(196,30,58,.05)}
          .${p}-temp-hint{font-size:11px;color:var(--gray-lt);text-align:center;margin-top:4px}
          .${p}-task-flag{background:#fffbeb;border:1px solid #fde68a;border-radius:var(--r-md);padding:10px 12px;margin-top:10px;display:none}
          .${p}-task-flag.show{display:block}
          .${p}-task-flag-title{font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px;display:flex;align-items:center;gap:5px}
          .${p}-task-flag p{font-size:12px;color:#78350f;line-height:1.4}
          .${p}-score-big{font-size:42px;font-weight:800;line-height:1;margin-bottom:4px}
          .${p}-score-bar-wrap{background:#f3f4f6;border-radius:4px;height:8px;overflow:hidden;margin:12px 0 4px}
          .${p}-score-bar{height:100%;border-radius:4px;transition:width .6s ease}
          .${p}-meta-grid{background:#f9fafb;border-radius:var(--r-md);padding:12px;display:grid;gap:6px;font-size:12px;color:var(--gray);margin-bottom:16px}
          .${p}-meta-row{display:flex;justify-content:space-between;align-items:center}
          .${p}-cat-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px}
          .${p}-cat-row:last-child{border-bottom:none}
          .${p}-fail-item{padding:12px 0;border-bottom:1px solid var(--border)}
          .${p}-fail-item:last-child{border-bottom:none}
          .${p}-fail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px}
          .${p}-fail-title{font-size:14px;font-weight:700}
          .${p}-fail-meta{font-size:11px;color:var(--gray-lt);margin-bottom:8px}
          .${p}-prio{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;flex-shrink:0}
          .${p}-prio-critical{background:rgba(196,30,58,.1);color:var(--error)}
          .${p}-prio-high{background:rgba(163,45,45,.08);color:#a32d2d}
          .${p}-prio-medium{background:#fffbeb;color:#92400e}
          .${p}-prio-low{background:rgba(46,125,74,.08);color:var(--success)}
          .${p}-btn{padding:10px 16px;border:none;border-radius:var(--r-md);font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .2s;white-space:nowrap}
          .${p}-btn:disabled{opacity:.4;cursor:not-allowed}
          .${p}-btn-primary{background:var(--primary);color:var(--primary-text);box-shadow:0 3px 10px rgba(var(--primary-rgb),.3)}
          .${p}-btn-primary:hover:not(:disabled){filter:brightness(.88);transform:translateY(-1px)}
          .${p}-btn-ghost{background:#f3f4f6;color:var(--gray);border:1.5px solid var(--border)}
          .${p}-btn-ghost:hover:not(:disabled){border-color:var(--primary);color:var(--primary)}
          .${p}-btn-full{width:100%;justify-content:center}
          .${p}-nav{display:flex;gap:8px;margin-top:8px}
          .${p}-nav>.${p}-btn{flex:1;justify-content:center}
          .${p}-submit-prog{display:none;background:#fff;border-radius:var(--r-md);padding:14px 16px;border:1px solid var(--border);margin-top:12px}
          .${p}-submit-prog-meta{display:flex;justify-content:space-between;font-size:12px;color:var(--gray);margin-bottom:7px}
          .${p}-submit-bar-wrap{height:6px;background:#f3f4f6;border-radius:3px;overflow:hidden}
          .${p}-submit-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,var(--primary),color-mix(in srgb,var(--primary) 60%,#ff6b00));border-radius:3px;transition:width .3s ease}
          .${p}-submit-log{margin-top:10px;max-height:90px;overflow-y:auto;font-size:12px}
          .${p}-log-item{padding:3px 0;border-bottom:1px solid #f3f4f6;color:var(--gray)}
          .${p}-log-item.ok{color:var(--success)}
          .${p}-log-item.err{color:var(--error)}
          .${p}-banner{display:none;padding:10px 14px;border-radius:var(--r-md);margin-bottom:12px;font-size:13px;line-height:1.5}
          .${p}-banner.error{background:rgba(196,30,58,.08);border:1px solid rgba(196,30,58,.25);color:var(--error)}
          .${p}-banner.info{background:rgba(var(--primary-rgb),.06);border:1px solid rgba(var(--primary-rgb),.2);color:var(--primary)}
          .${p}-banner.success{background:rgba(46,125,74,.08);border:1px solid rgba(46,125,74,.25);color:var(--success)}
          .${p}-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(var(--primary-rgb),.25);border-top-color:var(--primary);animation:${p}-spin .7s linear infinite;display:inline-block;flex-shrink:0}
          @keyframes ${p}-spin{to{transform:rotate(360deg)}}
          .${p}-state{padding:36px 20px;text-align:center;color:var(--gray-lt);font-size:13px}
          .${p}-state strong{display:block;color:var(--gray);font-size:14px;margin-bottom:4px}
          .${p}-group-lbl{font-size:11px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px}
        </style>

        <div class="${p}">
          <div class="${p}-header">
            <div class="${p}-title"><span class="${p}-title-dot"></span>Audit Form</div>
            <span class="${p}-spin" id="${p}-hspin" style="display:none"></span>
          </div>
          <div class="${p}-banner" id="${p}-banner"></div>
          <div id="${p}-content"></div>
        </div>
      `;
                const contentEl = container.querySelector(`#${p}-content`);
                const bannerEl = container.querySelector(`#${p}-banner`);
                const hspinEl = container.querySelector(`#${p}-hspin`);
                // ── Helpers ───────────────────────────────────────────────────────
                const apiOpts = (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: { Authorization: `Basic ${apiToken}`, "Content-Type": "application/json" } }));
                function esc(s) { return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
                function showBanner(t, msg) { bannerEl.className = `${p}-banner ${t}`; bannerEl.style.display = "block"; bannerEl.textContent = msg; }
                function hideBanner() { bannerEl.style.display = "none"; }
                function prioClass(pr) {
                    if (pr === "Critical")
                        return `${p}-prio-critical`;
                    if (pr === "High")
                        return `${p}-prio-high`;
                    if (pr === "Medium")
                        return `${p}-prio-medium`;
                    return `${p}-prio-low`;
                }
                // ── SVG icons ─────────────────────────────────────────────────────
                const iCheck = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                const iX = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                const iFlag = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
                const iWarn = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
                const iSend = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
                const iStore = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                const iUser = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                const iPrev = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
                const iNext = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
                // ── Question logic ────────────────────────────────────────────────
                function isPass(q, val) {
                    if (!val)
                        return null;
                    if (q.type === "pf")
                        return val === "pass";
                    if (q.type === "rating")
                        return parseInt(val) >= 3;
                    if (q.type === "temp") {
                        const n = parseFloat(val);
                        const isCooler = q.id.startsWith("BOH") || q.text.toLowerCase().includes("cooler");
                        return isCooler ? (n >= 35 && n <= 41) : n >= 140;
                    }
                    return null;
                }
                function getScore() {
                    let earned = 0, total = 0, answered = 0;
                    for (const q of questions) {
                        total += q.pts;
                        const r = isPass(q, responses[q.id] || "");
                        if (r !== null) {
                            answered++;
                            if (r)
                                earned += q.pts;
                        }
                    }
                    return { earned, total, answered, count: questions.length };
                }
                function failedTasks() {
                    return questions.filter(q => {
                        if (!q.task)
                            return false;
                        return isPass(q, responses[q.id] || "") === false;
                    });
                }
                // ── Sheet parsing ─────────────────────────────────────────────────
                function parseRows(rows) {
                    if (!rows || rows.length < 3)
                        return [];
                    let hIdx = 0;
                    for (let i = 0; i < Math.min(4, rows.length); i++) {
                        if (rows[i].some((c) => /question|text|id/i.test(String(c || "")))) {
                            hIdx = i;
                            break;
                        }
                    }
                    const hdrs = rows[hIdx].map((c) => String(c || "").toLowerCase().trim());
                    const col = (...names) => { for (const n of names) {
                        const i = hdrs.findIndex(h => h.includes(n));
                        if (i >= 0)
                            return i;
                    } return -1; };
                    const iId = col("question id", "id");
                    const iCat = col("category", "cat");
                    const iText = col("question text", "text", "question");
                    const iType = col("type");
                    const iPts = col("pts", "point");
                    const iCrit = col("critical");
                    const iTask = col("task flag", "auto-task", "task");
                    const iTitle = col("task title", "title");
                    const iRole = col("task role", "role");
                    const iPrio = col("priority");
                    const iDue = col("due");
                    const iActive = 13;
                    const out = [];
                    for (let i = hIdx + 1; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r || !r.length)
                            continue;
                        const av = String(r[iActive] || "").toLowerCase();
                        if (av === "false" || av === "no" || av === "0")
                            continue;
                        const text = iText >= 0 ? String(r[iText] || "").trim() : "";
                        if (!text)
                            continue;
                        out.push({
                            id: iId >= 0 ? String(r[iId] || `Q${i}`) : `Q${i}`,
                            cat: iCat >= 0 ? String(r[iCat] || "General").trim() : "General",
                            text,
                            type: iType >= 0 ? String(r[iType] || "pf").toLowerCase() : "pf",
                            pts: iPts >= 0 ? parseInt(String(r[iPts] || "1")) || 1 : 1,
                            critical: iCrit >= 0 ? /true|yes/i.test(String(r[iCrit] || "")) : false,
                            task: iTask >= 0 ? /true|yes/i.test(String(r[iTask] || "")) : false,
                            taskTitle: iTitle >= 0 ? String(r[iTitle] || "").trim() : text,
                            taskRole: iRole >= 0 ? String(r[iRole] || "").trim() : "",
                            taskPriority: iPrio >= 0 ? String(r[iPrio] || "Medium").trim() : "Medium",
                            taskDue: iDue >= 0 ? parseInt(String(r[iDue] || "1")) || 1 : 1,
                        });
                    }
                    return out;
                }
                // ── Data fetch ────────────────────────────────────────────────────
                function fetchAll() {
                    return __awaiter(this, void 0, void 0, function* () {
                        hspinEl.style.display = "";
                        try {
                            const [instRes, grpRes] = yield Promise.all([
                                fetch(`${baseUrl}/installations?limit=200`, apiOpts()),
                                fetch(`${baseUrl}/groups?limit=200`, apiOpts()),
                            ]);
                            if (instRes.ok) {
                                const d = yield instRes.json();
                                installations = (d.data || d)
                                    .filter((i) => i.pluginID === "tasks" || i.pluginId === "tasks")
                                    .map((i) => { var _a, _b, _c; return ({ id: i.id, title: ((_c = (_b = (_a = i.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || i.title || i.name || i.id }); })
                                    .sort((a, b) => a.title.localeCompare(b.title));
                            }
                            if (grpRes.ok) {
                                const d = yield grpRes.json();
                                allGroups = (d.data || []).map((g) => { var _a, _b, _c; return ({ id: g.id, name: ((_c = (_b = (_a = g.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || g.name || g.id }); })
                                    .sort((a, b) => a.name.localeCompare(b.name));
                            }
                            try {
                                const prof = yield widgetApi.getUserInformation();
                                auditorName = (`${prof.firstName || ""} ${prof.lastName || ""}`).trim() || prof.id || "";
                            }
                            catch (_) { }
                            try {
                                const sr = yield fetch(appsScriptUrl);
                                if (sr.ok) {
                                    const data = yield sr.json();
                                    const raw = data.data || data;
                                    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
                                        const key = Object.keys(raw).find(k => k.includes("Audit Questions"));
                                        if (key) {
                                            const parsed = parseRows(raw[key]);
                                            if (parsed.length > 0)
                                                questions = parsed;
                                        }
                                    }
                                    else if (Array.isArray(data.questions)) {
                                        questions = data.questions;
                                    }
                                }
                            }
                            catch (_) { }
                            if (!questions.length)
                                questions = [...DUMMY_QUESTIONS];
                            const seen = new Set();
                            categories = [];
                            for (const q of questions) {
                                if (!seen.has(q.cat)) {
                                    seen.add(q.cat);
                                    categories.push(q.cat);
                                }
                            }
                            activeCat = categories[0] || "";
                        }
                        catch (e) {
                            showBanner("error", `Failed to load: ${e.message}`);
                            questions = [...DUMMY_QUESTIONS];
                            categories = [...new Set(questions.map(q => q.cat))];
                            activeCat = categories[0] || "";
                        }
                        hspinEl.style.display = "none";
                        // Re-render setup now that installs are loaded
                        if (step === "setup")
                            renderSetup();
                    });
                }
                // ── Render dispatch ───────────────────────────────────────────────
                function render() {
                    if (step === "setup")
                        renderSetup();
                    else if (step === "audit")
                        renderAudit();
                    else if (step === "generate")
                        renderGenerate();
                }
                // ── Step 1: Setup ─────────────────────────────────────────────────
                function renderSetup() {
                    const opts = installations.map(i => `<option value="${esc(i.id)}"${i.id === selectedInstId ? " selected" : ""}>${esc(i.title)}</option>`).join("");
                    contentEl.innerHTML = `
          <div class="${p}-card">
            <div class="${p}-card-head"><span class="${p}-step">1</span><span class="${p}-card-title">Store &amp; Auditor Details</span></div>
            <div class="${p}-card-body">
              <div class="${p}-row">
                <div class="${p}-field">
                  <label class="${p}-label">${esc(storeS)}</label>
                  <select class="${p}-select" id="${p}-store">
                    <option value="">Select a ${esc(storeS)}…</option>${opts}
                  </select>
                </div>
                <div class="${p}-field">
                  <label class="${p}-label">Audit Date</label>
                  <input type="date" class="${p}-input" id="${p}-adate" value="${auditDate}">
                </div>
              </div>
              <div class="${p}-row full" style="grid-template-columns:1fr">
                <div class="${p}-field">
                  <label class="${p}-label">Auditor Name</label>
                  <input type="text" class="${p}-input" id="${p}-aname" placeholder="Your name" value="${esc(auditorName)}">
                </div>
              </div>
              <div class="${p}-row full" style="grid-template-columns:1fr;margin-bottom:12px">
                <div class="${p}-field">
                  <label class="${p}-label">Auditor Notes <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:var(--gray-lt)">(optional)</span></label>
                  <textarea class="${p}-input" id="${p}-anotes" rows="2" placeholder="Context for this audit session…" style="resize:none;line-height:1.5">${esc(auditNotes)}</textarea>
                </div>
              </div>
              ${installations.length === 0 ? `<div style="font-size:12px;color:var(--gray-lt);margin-bottom:10px"><span class="${p}-spin" style="width:12px;height:12px;border-width:1.5px;vertical-align:middle;margin-right:5px"></span>Loading ${esc(storeP.toLowerCase())}…</div>` : ""}
              <button type="button" class="${p}-btn ${p}-btn-primary ${p}-btn-full" id="${p}-begin">${iCheck} Begin Audit</button>
            </div>
          </div>`;
                    const storeSel = contentEl.querySelector(`#${p}-store`);
                    if (selectedInstId)
                        storeSel.value = selectedInstId;
                    contentEl.querySelector(`#${p}-begin`).addEventListener("click", () => {
                        selectedInstId = contentEl.querySelector(`#${p}-store`).value;
                        auditorName = contentEl.querySelector(`#${p}-aname`).value.trim();
                        auditDate = contentEl.querySelector(`#${p}-adate`).value;
                        auditNotes = contentEl.querySelector(`#${p}-anotes`).value.trim();
                        if (!selectedInstId) {
                            showBanner("error", `Please select a ${storeS}.`);
                            return;
                        }
                        if (!auditorName) {
                            showBanner("error", "Please enter your name.");
                            return;
                        }
                        hideBanner();
                        step = "audit";
                        renderAudit();
                    });
                }
                // ── Step 2: Questions ─────────────────────────────────────────────
                function renderAudit() {
                    const sc = getScore();
                    const pct = sc.count > 0 ? Math.round((sc.answered / sc.count) * 100) : 0;
                    const catQs = questions.filter(q => q.cat === activeCat);
                    const idx = categories.indexOf(activeCat);
                    const isFirst = idx === 0, isLast = idx === categories.length - 1;
                    const tabsHtml = categories.map(cat => {
                        const fails = questions.filter(q => q.cat === cat && isPass(q, responses[q.id] || "") === false).length;
                        const badge = fails > 0 ? `<span class="${p}-cat-badge">${fails}</span>` : "";
                        return `<button type="button" class="${p}-cat-tab${cat === activeCat ? " active" : ""}" data-cat="${esc(cat)}">${esc(cat)}${badge}</button>`;
                    }).join("");
                    const qHtml = catQs.map(renderQuestion).join("");
                    contentEl.innerHTML = `
          <div style="margin-bottom:14px">
            <div class="${p}-prog-label"><span>${sc.answered} of ${sc.count} answered</span><span style="font-weight:700;color:var(--dark)">${pct}%</span></div>
            <div class="${p}-prog-wrap"><div class="${p}-prog-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="${p}-card">
            <div class="${p}-card-head" style="padding:0;border-bottom:none">
              <div class="${p}-cat-tabs" style="flex:1;padding:0 4px">${tabsHtml}</div>
            </div>
            <div class="${p}-card-body" id="${p}-qwrap">
              ${qHtml || `<div class="${p}-state"><strong>No questions</strong></div>`}
            </div>
          </div>
          <div class="${p}-nav">
            <button type="button" class="${p}-btn ${p}-btn-ghost" id="${p}-prev">${iPrev} ${isFirst ? "Setup" : "Prev"}</button>
            ${isLast
                        ? `<button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-gen">${iFlag} Generate Tasks</button>`
                        : `<button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-next">Next ${iNext}</button>`}
          </div>`;
                    contentEl.querySelectorAll(`.${p}-cat-tab`).forEach(btn => {
                        btn.addEventListener("click", () => { activeCat = btn.dataset.cat || activeCat; renderAudit(); });
                    });
                    const prevBtn = contentEl.querySelector(`#${p}-prev`);
                    prevBtn.addEventListener("click", () => {
                        if (isFirst) {
                            step = "setup";
                            renderSetup();
                        }
                        else {
                            activeCat = categories[idx - 1];
                            renderAudit();
                        }
                    });
                    const nextBtn = contentEl.querySelector(`#${p}-next`);
                    if (nextBtn)
                        nextBtn.addEventListener("click", () => { activeCat = categories[idx + 1]; renderAudit(); });
                    const genBtn = contentEl.querySelector(`#${p}-gen`);
                    if (genBtn)
                        genBtn.addEventListener("click", () => {
                            hideBanner();
                            for (const q of failedTasks()) {
                                if (!taskGroupOverrides[q.id] && q.taskRole) {
                                    const m = fuzzyMatchGroup(q.taskRole, allGroups);
                                    if (m)
                                        taskGroupOverrides[q.id] = m;
                                }
                            }
                            step = "generate";
                            renderGenerate();
                        });
                    bindControls();
                }
                function renderQuestion(q) {
                    const val = responses[q.id] || "";
                    const passed = isPass(q, val);
                    const showFlag = q.task && passed === false;
                    let ctrl = "";
                    if (q.type === "pf") {
                        ctrl = `<div class="${p}-pf-row">
            <button type="button" class="${p}-pf-btn${val === "pass" ? " pass" : ""}" data-qid="${esc(q.id)}" data-val="pass">Pass</button>
            <button type="button" class="${p}-pf-btn${val === "fail" ? " fail" : ""}" data-qid="${esc(q.id)}" data-val="fail">Fail</button>
            <button type="button" class="${p}-pf-btn${val === "na" ? " na" : ""}" data-qid="${esc(q.id)}" data-val="na">N/A</button>
          </div>`;
                    }
                    else if (q.type === "rating") {
                        const rv = val ? parseInt(val) : 0;
                        ctrl = `<div class="${p}-rating-row">${[1, 2, 3, 4, 5].map(n => {
                            let cls = "";
                            if (rv === n)
                                cls = n <= 2 ? "low" : n === 3 ? "mid" : "hi";
                            return `<button type="button" class="${p}-rating-btn${cls ? " " + cls : ""}" data-qid="${esc(q.id)}" data-val="${n}">${n}</button>`;
                        }).join("")}</div><div class="${p}-rating-hint"><span>Poor</span><span>Excellent</span></div>`;
                    }
                    else if (q.type === "temp") {
                        const isCooler = q.id.startsWith("BOH") || q.text.toLowerCase().includes("cooler");
                        const hint = isCooler ? "35–41°F (walk-in cooler)" : "≥140°F (hot holding) · ≥165°F (cooking)";
                        let tcls = "";
                        if (val) {
                            const n = parseFloat(val);
                            tcls = (isCooler ? (n >= 35 && n <= 41) : n >= 140) ? " ok" : " bad";
                        }
                        ctrl = `<input type="number" class="${p}-temp-input${tcls}" inputmode="decimal" placeholder="°F" value="${esc(val)}" data-qid="${esc(q.id)}" data-dtype="temp">
                <div class="${p}-temp-hint">${hint}</div>`;
                    }
                    const flagHtml = showFlag && q.taskTitle ? `
          <div class="${p}-task-flag show">
            <div class="${p}-task-flag-title">${iFlag} Task will be generated</div>
            <p><strong>${esc(q.taskTitle)}</strong> · ${esc(q.taskRole)} · ${esc(q.taskPriority)} · Due: ${q.taskDue === 0 ? "Immediately" : `${q.taskDue}d`}</p>
          </div>` : "";
                    return `<div class="${p}-question" data-qid="${esc(q.id)}">
          <div class="${p}-q-header"><span class="${p}-q-id">${esc(q.id)}</span><span class="${p}-q-text">${esc(q.text)}</span></div>
          <div class="${p}-q-chips">
            <span class="${p}-chip ${p}-chip-pts">${q.pts} pts</span>
            ${q.critical ? `<span class="${p}-chip ${p}-chip-crit">${iWarn} Critical</span>` : ""}
            ${q.task ? `<span class="${p}-chip ${p}-chip-task">${iFlag} Auto-task</span>` : ""}
          </div>
          ${ctrl}${flagHtml}
        </div>`;
                }
                function bindControls() {
                    contentEl.querySelectorAll(`.${p}-pf-btn`).forEach(btn => {
                        btn.addEventListener("click", () => {
                            const { qid, val } = btn.dataset;
                            responses[qid] = val;
                            refreshQuestion(qid);
                        });
                    });
                    contentEl.querySelectorAll(`.${p}-rating-btn`).forEach(btn => {
                        btn.addEventListener("click", () => {
                            const { qid, val } = btn.dataset;
                            responses[qid] = val;
                            refreshQuestion(qid);
                        });
                    });
                    contentEl.querySelectorAll(`[data-dtype="temp"]`).forEach(inp => {
                        inp.addEventListener("change", () => {
                            const qid = inp.dataset.qid;
                            responses[qid] = inp.value;
                            refreshQuestion(qid);
                        });
                    });
                }
                function refreshQuestion(qid) {
                    const q = questions.find(x => x.id === qid);
                    if (!q)
                        return;
                    const el = contentEl.querySelector(`.${p}-question[data-qid="${qid}"]`);
                    if (!el)
                        return;
                    el.outerHTML = renderQuestion(q);
                    bindControls();
                    // progress bar
                    const sc = getScore();
                    const pct = sc.count > 0 ? Math.round((sc.answered / sc.count) * 100) : 0;
                    const fill = contentEl.querySelector(`.${p}-prog-fill`);
                    const lbl = contentEl.querySelector(`.${p}-prog-label`);
                    if (fill)
                        fill.style.width = `${pct}%`;
                    if (lbl)
                        lbl.innerHTML = `<span>${sc.answered} of ${sc.count} answered</span><span style="font-weight:700;color:var(--dark)">${pct}%</span>`;
                    // tab badges
                    categories.forEach(cat => {
                        const fails = questions.filter(q => q.cat === cat && isPass(q, responses[q.id] || "") === false).length;
                        const tab = contentEl.querySelector(`.${p}-cat-tab[data-cat="${cat}"]`);
                        if (!tab)
                            return;
                        let badge = tab.querySelector(`.${p}-cat-badge`);
                        if (fails > 0) {
                            if (badge)
                                badge.textContent = String(fails);
                            else
                                tab.insertAdjacentHTML("beforeend", `<span class="${p}-cat-badge">${fails}</span>`);
                        }
                        else
                            badge === null || badge === void 0 ? void 0 : badge.remove();
                    });
                }
                // ── Step 3: Generate / Review ─────────────────────────────────────
                function renderGenerate() {
                    const sc = getScore();
                    const pct = sc.total > 0 && sc.answered > 0 ? Math.round((sc.earned / sc.total) * 100) : 0;
                    const passing = pct >= passThreshold;
                    const ft = failedTasks();
                    const inst = installations.find(i => i.id === selectedInstId);
                    const scoreColor = passing ? "var(--success)" : "var(--error)";
                    const catRows = categories.map(cat => {
                        const qs = questions.filter(q => q.cat === cat);
                        const earned = qs.reduce((a, q) => a + (isPass(q, responses[q.id] || "") ? q.pts : 0), 0);
                        const tot = qs.reduce((a, q) => a + q.pts, 0);
                        const ans = qs.filter(q => isPass(q, responses[q.id] || "") !== null).length;
                        const cp = tot > 0 && ans > 0 ? Math.round((earned / tot) * 100) : null;
                        const col = cp === null ? "var(--gray-lt)" : cp >= passThreshold ? "var(--success)" : "var(--error)";
                        return `<div class="${p}-cat-row"><span>${esc(cat)}</span><span style="font-size:12px;color:var(--gray-lt);margin-right:8px">${ans}/${qs.length}</span><span style="font-weight:700;color:${col}">${cp !== null ? cp + "%" : "—"}</span></div>`;
                    }).join("");
                    const failHtml = ft.length === 0
                        ? `<div class="${p}-state"><strong>No failures</strong>All answered questions passed or were marked N/A.</div>`
                        : ft.map(q => {
                            const gid = taskGroupOverrides[q.id] || "";
                            const groupOpts = allGroups.map(g => `<option value="${esc(g.id)}"${g.id === gid ? " selected" : ""}>${esc(g.name)}</option>`).join("");
                            const due = q.taskDue === 0 ? "Immediately" : `Within ${q.taskDue}d`;
                            return `<div class="${p}-fail-item">
              <div class="${p}-fail-head">
                <div class="${p}-fail-title">${esc(q.taskTitle || q.text)}</div>
                <span class="${p}-prio ${prioClass(q.taskPriority)}">${esc(q.taskPriority)}</span>
              </div>
              <div class="${p}-fail-meta">${esc(q.id)} · Due: ${due}</div>
              <div class="${p}-group-lbl">Assign to group</div>
              <select class="${p}-select" style="margin-top:4px" data-task-qid="${esc(q.id)}">
                <option value="">— No group —</option>${groupOpts}
              </select>
            </div>`;
                        }).join("");
                    contentEl.innerHTML = `
          <div class="${p}-card">
            <div class="${p}-card-head"><span class="${p}-step">${iCheck}</span><span class="${p}-card-title">Audit Summary</span></div>
            <div class="${p}-card-body">
              <div style="text-align:center;padding:6px 0 14px">
                <div class="${p}-score-big" style="color:${scoreColor}">${pct}%</div>
                <div style="font-size:14px;font-weight:700;color:${scoreColor};margin-top:2px">${passing ? "Passing" : "Failing"}</div>
                <div style="font-size:12px;color:var(--gray-lt);margin-top:4px">${sc.earned} / ${sc.total} pts · ${sc.answered} of ${sc.count} answered</div>
                <div class="${p}-score-bar-wrap"><div class="${p}-score-bar" style="width:${pct}%;background:${scoreColor}"></div></div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--gray-lt);margin-top:2px"><span>0%</span><span style="color:${scoreColor}">${passThreshold}% threshold</span><span>100%</span></div>
              </div>
              <div class="${p}-meta-grid">
                <div class="${p}-meta-row"><span>${iStore} ${esc(storeS)}</span><span style="font-weight:600">${esc((inst === null || inst === void 0 ? void 0 : inst.title) || "—")}</span></div>
                <div class="${p}-meta-row"><span>${iUser} Auditor</span><span>${esc(auditorName)}</span></div>
                <div class="${p}-meta-row"><span>Date</span><span>${esc(auditDate)}</span></div>
                <div class="${p}-meta-row"><span>Tasks flagged</span><span style="font-weight:700;color:${ft.length > 0 ? "var(--error)" : "var(--success)"}">${ft.length}</span></div>
                ${auditNotes ? `<div class="${p}-meta-row" style="flex-direction:column;align-items:flex-start;gap:3px"><span style="color:var(--gray-lt);font-size:11px;text-transform:uppercase;letter-spacing:.3px">Notes</span><span style="line-height:1.5">${esc(auditNotes)}</span></div>` : ""}
              </div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray-lt);margin-bottom:8px">Category Breakdown</div>
              ${catRows}
            </div>
          </div>

          ${ft.length > 0 ? `
          <div class="${p}-card">
            <div class="${p}-card-head"><span class="${p}-step">${iFlag}</span><span class="${p}-card-title">Tasks to Create <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:var(--gray-lt)">(${ft.length})</span></span></div>
            <div class="${p}-card-body">${failHtml}</div>
          </div>` : ""}

          <div class="${p}-nav">
            <button type="button" class="${p}-btn ${p}-btn-ghost" id="${p}-back">${iPrev} Back</button>
            <button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-submit">${iSend} Submit &amp; Create Tasks</button>
          </div>
          <div class="${p}-submit-prog" id="${p}-sprog">
            <div class="${p}-submit-prog-meta"><span id="${p}-slabel">Working…</span><span id="${p}-spct">0%</span></div>
            <div class="${p}-submit-bar-wrap"><div class="${p}-submit-bar-fill" id="${p}-sfill"></div></div>
            <div class="${p}-submit-log" id="${p}-slog"></div>
          </div>`;
                    contentEl.querySelectorAll(`[data-task-qid]`).forEach(sel => {
                        if (sel.tagName !== "SELECT")
                            return;
                        sel.addEventListener("change", () => {
                            taskGroupOverrides[sel.dataset.taskQid] = sel.value;
                        });
                    });
                    contentEl.querySelector(`#${p}-back`).addEventListener("click", () => {
                        step = "audit";
                        activeCat = categories[categories.length - 1] || categories[0];
                        renderAudit();
                    });
                    contentEl.querySelector(`#${p}-submit`).addEventListener("click", submitAudit);
                }
                // ── Submit ────────────────────────────────────────────────────────
                function submitAudit() {
                    return __awaiter(this, void 0, void 0, function* () {
                        var _a, _b;
                        const submitBtn = contentEl.querySelector(`#${p}-submit`);
                        const progEl = contentEl.querySelector(`#${p}-sprog`);
                        const sFill = contentEl.querySelector(`#${p}-sfill`);
                        const sLabel = contentEl.querySelector(`#${p}-slabel`);
                        const sPct = contentEl.querySelector(`#${p}-spct`);
                        const sLog = contentEl.querySelector(`#${p}-slog`);
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = `<span class="${p}-spin" style="border-top-color:#fff;border-color:rgba(255,255,255,.3)"></span> Submitting…`;
                        progEl.style.display = "block";
                        sLog.innerHTML = "";
                        hideBanner();
                        const ft = failedTasks();
                        const sc = getScore();
                        const pct = sc.total > 0 && sc.answered > 0 ? Math.round((sc.earned / sc.total) * 100) : 0;
                        const passing = pct >= passThreshold;
                        const inst = installations.find(i => i.id === selectedInstId);
                        const now = new Date();
                        const listName = `Audit — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
                        const totalOps = 1 + 1 + ft.length;
                        let done = 0;
                        function setProgress(n, label) {
                            const pc = Math.round((n / totalOps) * 100);
                            sFill.style.width = `${pc}%`;
                            sPct.textContent = `${pc}%`;
                            sLabel.textContent = label;
                        }
                        function logLine(text, cls = "") {
                            const d = document.createElement("div");
                            d.className = `${p}-log-item ${cls}`;
                            d.textContent = text;
                            sLog.appendChild(d);
                            sLog.scrollTop = sLog.scrollHeight;
                        }
                        try {
                            setProgress(0, "Creating task list…");
                            const listRes = yield fetch(`${baseUrl}/tasks/${selectedInstId}/lists`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify({ name: listName, color: passing ? "#2E7D4A" : "#C41E3A" }) }));
                            if (!listRes.ok)
                                throw new Error(`List creation failed (${listRes.status})`);
                            const listData = yield listRes.json();
                            const listId = (_a = listData.id) !== null && _a !== void 0 ? _a : (_b = listData.data) === null || _b === void 0 ? void 0 : _b.id;
                            if (!listId)
                                throw new Error("No list ID in response");
                            done++;
                            logLine(`Created list: ${listName}`, "ok");
                            // Category breakdown for JSON blob
                            const catBreakdown = {};
                            for (const cat of categories) {
                                const qs = questions.filter(q => q.cat === cat);
                                const earned = qs.reduce((a, q) => a + (isPass(q, responses[q.id] || "") ? q.pts : 0), 0);
                                const tot = qs.reduce((a, q) => a + q.pts, 0);
                                catBreakdown[cat] = { earned, total: tot, pct: tot > 0 ? Math.round((earned / tot) * 100) : 0 };
                            }
                            const blob = JSON.stringify({
                                score: pct, passing, auditor: auditorName, date: auditDate,
                                notes: auditNotes || undefined,
                                store: (inst === null || inst === void 0 ? void 0 : inst.title) || selectedInstId, storeId: selectedInstId,
                                taskCount: ft.length, categories: catBreakdown,
                            });
                            setProgress(done, "Creating audit summary task…");
                            const sysRes = yield fetch(`${baseUrl}/tasks/${selectedInstId}/task`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify({
                                    title: `Audit — ${(inst === null || inst === void 0 ? void 0 : inst.title) || selectedInstId} — ${pct}% — ${passing ? "Passing" : "Failing"}`,
                                    description: `[type: audit-result]\n${blob}`,
                                    status: "OPEN", priority: "Priority_3", taskListId: listId,
                                }) }));
                            done++;
                            if (sysRes.ok)
                                logLine("Created audit summary task", "ok");
                            else
                                logLine(`Warning: summary task failed (${sysRes.status})`, "err");
                            for (let i = 0; i < ft.length; i++) {
                                const q = ft[i];
                                setProgress(done, `Task ${i + 1}/${ft.length}…`);
                                const gid = taskGroupOverrides[q.id] || "";
                                const due = q.taskDue === 0
                                    ? new Date().toISOString()
                                    : new Date(Date.now() + q.taskDue * 86400000).toISOString().split("T")[0] + "T00:00:00.000Z";
                                const prio = q.taskPriority === "Critical" || q.taskPriority === "High" ? "Priority_1" : q.taskPriority === "Medium" ? "Priority_2" : "Priority_3";
                                try {
                                    const body = {
                                        title: q.taskTitle || q.text,
                                        description: `Audit finding: ${q.id} — ${q.text}\nAudit: ${listName}\nAuditor: ${auditorName}`,
                                        status: "OPEN", priority: prio, taskListId: listId, dueDate: due,
                                    };
                                    if (gid)
                                        body.groupIds = [gid];
                                    const r = yield fetch(`${baseUrl}/tasks/${selectedInstId}/task`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify(body) }));
                                    if (r.ok)
                                        logLine(`✓ ${q.taskTitle || q.text}`, "ok");
                                    else
                                        logLine(`✗ ${q.taskTitle || q.text} (${r.status})`, "err");
                                }
                                catch (_) {
                                    logLine(`✗ ${q.taskTitle || q.text} (network error)`, "err");
                                }
                                done++;
                                yield new Promise(res => setTimeout(res, 50));
                            }
                            setProgress(totalOps, "Done!");
                            showBanner("success", `Audit submitted! "${listName}" created with ${ft.length + 1} tasks.`);
                        }
                        catch (e) {
                            showBanner("error", `Submission failed: ${e.message}`);
                            logLine(`Error: ${e.message}`, "err");
                        }
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = `${iSend} Submit &amp; Create Tasks`;
                    });
                }
                // ── Init ──────────────────────────────────────────────────────────
                renderSetup();
                fetchAll();
            });
        }
        static get observedAttributes() {
            return ["appsscripturl", "apitoken", "baseurl", "primarycolor", "accentcolor", "backgroundcolor", "storelabelsingular", "storelabelplural", "passthreshold"];
        }
    };
};
// ── Block registration ────────────────────────────────────────────────────────
const blockDefinition = {
    name: "audit-widget", label: "Audit Widget",
    attributes: ["appsscripturl", "apitoken", "baseurl", "primarycolor", "accentcolor", "backgroundcolor", "storelabelsingular", "storelabelplural", "passthreshold"],
    factory, configurationSchema, uiSchema, blockLevel: "block", iconUrl: "",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" });


/******/ })()
;