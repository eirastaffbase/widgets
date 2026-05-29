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
const DEFAULT_API_TOKEN = "NjljMjU3N2JjZmFjZWYxMzc4MzIzYTNkOkp6VEpkaGlfclRyRDk4bjlBZ2pIdXFkcmI3UjQhdl1LTm1RV1hwOHBIdUd+Unl3clk7MjYhSS1JdiprLGdOaVI=";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#da2e32";
const DEFAULT_ACCENT_COLOR = "#da2e32";
// ── Config schema ─────────────────────────────────────────────────────────────
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY_COLOR },
        accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT_COLOR },
        backgroundcolor: { type: "string", title: "Background Color", default: "" },
        storelabelsingular: { type: "string", title: "Store Label (singular)", default: "Store" },
        storelabelplural: { type: "string", title: "Store Label (plural)", default: "Stores" },
        showalltasks: { type: "boolean", title: "Show All Tasks (not just mine)", default: false },
        showdonetasks: { type: "boolean", title: "Include Completed Tasks", default: true },
        auditmode: { type: "boolean", title: "Audit Mode", default: false },
        enablecomments: { type: "boolean", title: "Enable Comments (experimental)", default: false },
        allowtaskcreation: { type: "boolean", title: "Allow Task Creation", default: false },
        allowtaskassignment: { type: "boolean", title: "Allow Task Assignment (audit mode)", default: false },
        debugmode: { type: "boolean", title: "Debug Mode (on-screen logs)", default: false },
    },
};
const uiSchema = {
    apitoken: { "ui:widget": "password", "ui:help": "Staffbase Basic auth token" },
    baseurl: { "ui:help": "Staffbase API base URL" },
    primarycolor: { "ui:widget": "color", "ui:help": "Primary brand color" },
    accentcolor: { "ui:widget": "color", "ui:help": "Accent / secondary color" },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background color — leave blank for transparent" },
    storelabelsingular: { "ui:help": "e.g. Store, Location, Branch" },
    storelabelplural: { "ui:help": "e.g. Stores, Locations, Branches" },
    showalltasks: { "ui:help": "When enabled, tasks from all users are shown — not just yours" },
    showdonetasks: { "ui:help": "When enabled, completed tasks are included in the view" },
    auditmode: { "ui:help": "When enabled, shows audit results and history instead of regular tasks" },
    enablecomments: { "ui:help": "Experimental: show a comments section in the task detail panel (uses the logged-in user's session)" },
    allowtaskcreation: { "ui:help": "Show a “New Task” button so users can create tasks from this widget" },
    allowtaskassignment: { "ui:help": "In audit mode, allow reassigning a task (to a group or person) from its detail panel" },
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
    return L > 0.179 ? "#1a1a1a" : "#ffffff";
}
// ── Task type parsing ─────────────────────────────────────────────────────────
const TYPE_REGEX = /\[type:\s*([^\]]+)\]/i;
function parseTaskType(text) {
    const m = TYPE_REGEX.exec(text);
    return m ? m[1].trim().toLowerCase() : null;
}
function stripTypeTag(text) {
    return text.replace(TYPE_REGEX, "").replace(/\s{2,}/g, " ").trim();
}
// ── Color palette for type badges ─────────────────────────────────────────────
const TYPE_COLORS = {
    storetask: "#da2e32", compliance: "#8B4513", maintenance: "#2E7D4A",
    training: "#4A90A4", audit: "#7C3AED", safety: "#D97706", inventory: "#0369A1",
};
function typeColor(type) {
    if (TYPE_COLORS[type])
        return TYPE_COLORS[type];
    let h = 0;
    for (let i = 0; i < type.length; i++)
        h = (h * 31 + type.charCodeAt(i)) & 0xffffff;
    return `hsl(${((h >> 16) & 0xff) % 360},55%,40%)`;
}
function priorityLabel(p) {
    if (p === "Priority_1")
        return "High";
    if (p === "Priority_2")
        return "Med";
    return "Low";
}
function priorityColor(p) {
    if (p === "Priority_1")
        return "#C41E3A";
    if (p === "Priority_2")
        return "#D97706";
    return "#6b7280";
}
// ── Widget factory ────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class MyTasksWidget extends BaseBlockClass {
        constructor() { super(); }
        renderBlock(container) {
            return __awaiter(this, void 0, void 0, function* () {
                const apiToken = this.getAttribute("apitoken") || DEFAULT_API_TOKEN;
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
                const primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
                const accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT_COLOR;
                const bgColor = this.getAttribute("backgroundcolor") || "";
                const showAll = this.getAttribute("showalltasks") === "true";
                const showDone = this.getAttribute("showdonetasks") !== "false";
                const auditMode = this.getAttribute("auditmode") === "true";
                const enableComments = this.getAttribute("enablecomments") === "true";
                const allowCreate = this.getAttribute("allowtaskcreation") === "true";
                const allowAssign = this.getAttribute("allowtaskassignment") === "true";
                const storeSingular = this.getAttribute("storelabelsingular") || "Store";
                const debugMode = this.getAttribute("debugmode") === "true";
                const primaryRgb = hexToRgb(primaryColor);
                const primaryText = contrastColor(primaryColor);
                const p = "mtw";
                let allTasks = [];
                let activeTypeFilters = new Set();
                let activeStatusFilter = "open";
                let activeInstallFilter = "all";
                let activeAuditListId = "";
                let auditLists = [];
                let showCompletedAudit = false;
                let showOtherAuditTasks = false;
                let introUsed = false; // staggered entrance only on first list render
                let currentUserId = "";
                let allInstalls = []; // for task creation
                const listsByInst = new Map();
                let usersList = null; // lazy, for reassign picker
                let userGroupIds = [];
                const groupMap = new Map(); // groupId → name
                // ── Render skeleton ────────────────────────────────────────────────
                container.innerHTML = `
        <style>
          .${p}{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;--shadow-sm:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);--shadow-md:0 4px 16px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bgColor || "transparent"};padding:20px}
          .${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
          /* Neutralize Staffbase's global button rule (margin:auto/width:90%) inside the
             body-appended panels, which sit outside the .${p} reset above. */
          .${p}-detail button,.${p}-create button{margin:0!important;box-sizing:border-box}
          .${p}-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
          .${p}-title{font-size:18px;font-weight:800;color:var(--dark);display:flex;align-items:center;gap:10px}
          .${p}-title-dot{width:10px;height:10px;border-radius:50%;background:var(--primary);flex-shrink:0}
          .${p}-badge-count{background:var(--primary);color:var(--primary-text);padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700}
          .${p}-refresh-btn{width:34px;height:34px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gray);transition:all .15s}
          .${p}-refresh-btn:hover{border-color:var(--primary);color:var(--primary);background:rgba(var(--primary-rgb),.05)}
          .${p}-refresh-btn:disabled{opacity:.4;cursor:not-allowed}
          .${p}-header-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
          .${p}-new-btn{display:inline-flex!important;width:auto!important;align-items:center;gap:6px;height:34px;padding:0 14px!important;border:none!important;border-radius:var(--r-md);background:var(--primary)!important;color:var(--primary-text,#fff)!important;font-family:inherit;font-size:13px;font-weight:700;line-height:normal!important;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(var(--primary-rgb),.3);transition:all .15s}
          .${p}-new-btn:hover{filter:brightness(.9);transform:translateY(-1px)}
          /* ── Create task sheet ── */
          .${p}-create{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--error:#C41E3A;--r-sm:6px;--r-md:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;left:0;right:0;bottom:0;z-index:100001;background:#fff;border-radius:20px 20px 0 0;max-height:90vh;display:flex;flex-direction:column;transform:translateY(102%);transition:transform .32s cubic-bezier(.32,.72,0,1);overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,.18)}
          .${p}-create.open{transform:translateY(0)}
          .${p}-create-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid var(--border)}
          .${p}-create-head h3{margin:0;font-size:16px;font-weight:800;color:var(--dark)}
          .${p}-create-close{width:30px;height:30px;border:none;background:#f3f4f6;border-radius:50%;cursor:pointer;color:var(--gray);display:flex;align-items:center;justify-content:center}
          .${p}-create-body{padding:16px 18px;overflow-y:auto}
          .${p}-fld{margin-bottom:14px}
          .${p}-fld label{display:block;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--gray-lt);margin-bottom:6px}
          .${p}-in,.${p}-sel{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fafafa;color:var(--dark);font-family:inherit;font-size:14px;line-height:1.4}
          .${p}-in:focus,.${p}-sel:focus{outline:none;border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
          textarea.${p}-in{resize:vertical;min-height:64px}
          .${p}-fld-row{display:flex;gap:10px}
          .${p}-fld-row .${p}-fld{flex:1;min-width:0}
          .${p}-create-foot{display:flex;gap:10px;padding:14px 18px;border-top:1px solid var(--border)}
          .${p}-create-foot button{flex:1;padding:12px!important;border-radius:var(--r-md)!important;font-family:inherit;font-size:14px;font-weight:700;line-height:normal!important;cursor:pointer;width:auto!important}
          .${p}-btn-cancel{background:#f3f4f6!important;border:none!important;color:var(--gray)}
          .${p}-btn-save{background:var(--primary)!important;border:none!important;color:var(--primary-text,#fff)!important;box-shadow:0 3px 10px rgba(var(--primary-rgb),.3)}
          .${p}-btn-save:disabled{opacity:.5;cursor:default}
          .${p}-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(var(--primary-rgb),.25);border-top-color:var(--primary);animation:${p}-spin .7s linear infinite;flex-shrink:0;display:inline-block}
          @keyframes ${p}-spin{to{transform:rotate(360deg)}}
          /* ── Detail panel ── */
          .${p}-overlay{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .25s ease}
          .${p}-overlay.open{opacity:1;pointer-events:auto}
          .${p}-detail{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#fff;border-radius:20px 20px 0 0;max-height:88vh;display:flex;flex-direction:column;transform:translateY(102%);transition:transform .32s cubic-bezier(.32,.72,0,1);overflow:hidden}
          .${p}-detail.open{transform:translateY(0)}
          .${p}-detail.side{left:auto;top:0;right:0;bottom:0;width:min(420px,92vw);max-height:none;border-radius:20px 0 0 20px;transform:translateX(102%)}
          .${p}-detail.side.open{transform:translateX(0)}
          .${p}-detail-handle{width:36px;height:4px;border-radius:2px;background:var(--border);margin:10px auto 0;flex-shrink:0}
          .${p}-detail.side .${p}-detail-handle{display:none}
          .${p}-detail-head{display:flex;align-items:flex-start;gap:10px;padding:16px 20px 12px;flex-shrink:0;border-bottom:1px solid var(--border)}
          .${p}-detail-head-badges{display:flex;gap:6px;flex-wrap:wrap;flex:1}
          .${p}-detail-close{width:28px;height:28px;border-radius:50%;border:none;background:#f3f4f6;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gray);flex-shrink:0;transition:background .15s,color .15s;font-family:inherit}
          .${p}-detail-close:hover{background:var(--border);color:var(--dark)}
          .${p}-detail-body{flex:1;overflow-y:auto;padding:20px;min-height:0}
          .${p}-detail-title{font-size:18px;font-weight:800;color:var(--dark);line-height:1.3;margin-bottom:14px;word-break:break-word}
          .${p}-detail-title.done{text-decoration:line-through;color:var(--gray)}
          .${p}-detail-meta{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
          .${p}-detail-meta-row{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--gray)}
          .${p}-detail-meta-row svg{flex-shrink:0;color:var(--gray-lt)}
          .${p}-detail-meta-row.overdue{color:var(--error);font-weight:600}
          .${p}-detail-desc-label{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt);margin-bottom:6px}
          .${p}-detail-desc{font-size:13px;color:var(--gray);line-height:1.65;white-space:pre-wrap;word-break:break-word}
          .${p}-detail-desc.empty{font-style:italic;color:var(--gray-lt)}
          /* Audit finding (parsed, audit mode only) */
          .${p}-af{margin-top:2px}
          .${p}-af-code{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--primary);background:rgba(var(--primary-rgb),.1);border-radius:6px;padding:3px 9px;margin-bottom:9px}
          .${p}-af-finding{font-size:14px;font-weight:600;line-height:1.5;color:var(--dark);margin-bottom:11px}
          .${p}-af-pills{display:flex;flex-wrap:wrap;gap:6px}
          .${p}-af-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--gray);background:#f3f4f6;border:1px solid var(--border);border-radius:20px;padding:5px 11px}
          .${p}-af-pill svg{width:12px;height:12px;opacity:.7;flex-shrink:0}
          .${p}-detail-foot{padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0}
          .${p}-detail-toggle-btn{width:100%;padding:11px;border-radius:var(--r-md);border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:8px}
          .${p}-detail-toggle-btn.done-btn{background:rgba(var(--primary-rgb),.08);border:1.5px solid rgba(var(--primary-rgb),.2);color:var(--primary)}
          .${p}-detail-toggle-btn.done-btn:hover{background:var(--primary);color:var(--primary-text)}
          .${p}-detail-toggle-btn.open-btn{background:#f3f4f6;border:1.5px solid var(--border);color:var(--gray)}
          .${p}-detail-toggle-btn.open-btn:hover{background:var(--border);color:var(--dark)}
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
          .${p}-att-link{display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;min-width:0}
          .${p}-att-thumb{width:34px;height:34px;border-radius:var(--r-sm);object-fit:cover;flex-shrink:0;background:#f3f4f6}
          .${p}-att-ico{width:34px;height:34px;border-radius:var(--r-sm);background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:var(--gray-lt);flex-shrink:0}
          .${p}-att-meta{min-width:0;display:flex;flex-direction:column;gap:1px}
          .${p}-att-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;font-weight:500}
          .${p}-att-size{color:var(--gray-lt);font-size:11px}
          .${p}-att-x{width:auto!important;margin:0 0 0 2px!important;border:none!important;background:none!important;color:var(--gray-lt);cursor:pointer;padding:3px!important;display:flex!important;border-radius:50%;flex-shrink:0;transition:color .15s,background .15s}
          .${p}-att-x:hover{color:var(--error);background:rgba(196,30,58,.08)}
          .${p}-att-empty{font-size:12px;color:var(--gray-lt)}
          /* ── Comments ── */
          .${p}-cmt{margin-top:18px;border-top:1px solid var(--border);padding-top:14px}
          .${p}-cmt-list{display:flex;flex-direction:column;gap:14px;margin-bottom:14px}
          .${p}-cmt-item{display:flex;gap:10px;align-items:flex-start}
          .${p}-cmt-av{width:32px;height:32px;border-radius:50%;flex-shrink:0;object-fit:cover;background:#e5e7eb}
          .${p}-cmt-av-fb{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;background:var(--primary);text-transform:uppercase}
          .${p}-cmt-main{flex:1;min-width:0;background:#f6f7f9;border-radius:0 var(--r-md) var(--r-md) var(--r-md);padding:8px 12px}
          .${p}-cmt-head{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
          .${p}-cmt-author{font-size:13px;font-weight:700;color:var(--dark)}
          .${p}-cmt-time{font-size:11px;color:var(--gray-lt);flex-shrink:0}
          .${p}-cmt-body{font-size:13px;line-height:1.5;color:var(--dark);word-break:break-word}
          .${p}-cmt-body p{margin:0 0 4px}
          .${p}-cmt-body p:last-child{margin-bottom:0}
          .${p}-cmt-empty{font-size:12px;color:var(--gray-lt);padding:4px 0}
          .${p}-cmt-compose{display:flex;align-items:flex-start;gap:10px}
          .${p}-cmt-av-slot{flex-shrink:0}
          .${p}-cmt-field{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fafafa;padding:10px 13px;transition:border-color .15s,box-shadow .15s}
          .${p}-cmt-field:focus-within{border-color:var(--primary);background:#fff;box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
          .${p}-cmt-input{width:100%;resize:none;max-height:140px;min-height:38px;font-family:inherit;font-size:14px;line-height:1.5;border:none;background:none;color:var(--dark)}
          .${p}-cmt-input:focus{outline:none}
          .${p}-cmt-bar{display:none;align-items:center;justify-content:flex-end;gap:6px;margin-top:8px}
          .${p}-cmt-bar.show{display:flex}
          .${p}-cmt-attach{display:inline-flex!important;width:38px!important;height:38px;margin:0!important;align-items:center;justify-content:center;border:none!important;background:none!important;color:var(--gray);cursor:pointer;padding:0!important;border-radius:50%;line-height:normal!important;font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
          .${p}-cmt-attach:hover,.${p}-cmt-attach:active{color:var(--primary);background:rgba(var(--primary-rgb),.1)}
          .${p}-cmt-attach svg{width:18px;height:18px}
          .${p}-cmt-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0);pointer-events:none}
          .${p}-cmt-send{display:none!important;width:auto!important;margin:0!important;align-items:center!important;gap:7px!important;font-family:inherit!important;font-size:13px!important;font-weight:700!important;line-height:normal!important;white-space:nowrap!important;border:none!important;border-radius:var(--r-md)!important;background:var(--primary)!important;color:var(--primary-text,#fff)!important;cursor:pointer!important;padding:9px 16px!important;box-shadow:0 3px 10px rgba(var(--primary-rgb),.3)!important;transition:all .15s!important}
          .${p}-cmt-send.show{display:inline-flex!important}
          .${p}-cmt-send svg{width:14px;height:14px}
          .${p}-cmt-send:hover{filter:brightness(.9)!important;transform:translateY(-1px)!important}
          .${p}-cmt-send:active{transform:translateY(0)!important}
          .${p}-cmt-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
          .${p}-cmt-chip{display:inline-flex;align-items:center;gap:5px;max-width:180px;font-size:11px;font-weight:600;background:rgba(var(--primary-rgb),.08);color:var(--primary);border-radius:12px;padding:3px 4px 3px 9px}
          .${p}-cmt-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .${p}-cmt-chip button{width:auto!important;margin:0!important;border:none!important;background:none!important;cursor:pointer;color:inherit;padding:1px!important;display:flex!important;opacity:.7}
          .${p}-cmt-chip button:hover{opacity:1}
          .${p}-cmt-att{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--primary)!important;text-decoration:none;background:rgba(var(--primary-rgb),.08);border-radius:6px;padding:3px 9px;margin:3px 4px 3px 0}
          .${p}-cmt-att svg{width:12px;height:12px;flex-shrink:0}
          .${p}-cmt-att-img{max-width:180px;max-height:140px;border-radius:8px;display:block;margin:5px 0;border:1px solid var(--border)}
          /* ── Debug panel ── */
          .${p}-dbg{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#0d1117;color:#e6edf3;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border-top:2px solid var(--primary);box-shadow:0 -4px 16px rgba(0,0,0,.3);max-height:45vh;display:flex;flex-direction:column}
          .${p}-dbg.collapsed .${p}-dbg-body{display:none}
          .${p}-dbg-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#161b22;flex-shrink:0}
          .${p}-dbg-title{font-size:12px;font-weight:700;letter-spacing:.5px}
          .${p}-dbg-actions{display:flex;gap:6px}
          .${p}-dbg-btn{font-family:inherit;font-size:12px;font-weight:600;color:#e6edf3;background:#21262d;border:1px solid #30363d;border-radius:6px;padding:5px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent}
          .${p}-dbg-btn:active{background:var(--primary);border-color:var(--primary)}
          .${p}-dbg-body{margin:0;padding:8px 10px;overflow:auto;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-word;-webkit-overflow-scrolling:touch}
          /* ── Audit tabs ── */
          .${p}-audit-tab-wrap{margin-bottom:12px}
          .${p}-audit-tab-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray-lt);margin-bottom:6px}
          .${p}-audit-scroll{display:flex;align-items:stretch;border-bottom:2px solid var(--border)}
          .${p}-audit-tabs{display:flex;overflow-x:auto;scrollbar-width:none;flex:1;scroll-behavior:smooth}
          .${p}-audit-tabs::-webkit-scrollbar{display:none}
          .${p}-audit-arrow{flex-shrink:0;width:30px;margin:0!important;padding:0!important;border:none!important;background:linear-gradient(90deg,#fff,#fff);color:var(--gray);cursor:pointer;display:none;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
          .${p}-audit-arrow.show{display:flex}
          .${p}-audit-arrow:active{color:var(--primary)}
          .${p}-audit-tab{flex-shrink:0;padding:8px 14px;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;border-bottom:2.5px solid transparent;margin-bottom:-2px;white-space:nowrap;background:none;border:none;font-family:inherit;transition:color .15s,border-color .15s;display:flex;align-items:center;gap:6px;user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none}
          .${p}-audit-tab:hover{color:var(--dark);background:rgba(var(--primary-rgb),.04)}
          .${p}-audit-tab.active{color:var(--primary);border-bottom-color:var(--primary)}
          .${p}-audit-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
          /* ── Store tabs ── */
          .${p}-store-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px}
          .${p}-store-tab{display:inline-flex;align-items:center;width:auto;padding:5px 12px;border-radius:20px;border:1.5px solid var(--border);background:#fff;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;flex-shrink:0;user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none}
          .${p}-store-tab:hover{border-color:var(--primary);color:var(--primary)}
          .${p}-store-tab.active{background:var(--primary);border-color:var(--primary);color:var(--primary-text)}
          /* ── Filter bar ── */
          .${p}-filters{display:flex;gap:8px;margin-bottom:16px;align-items:center}
          .${p}-type-wrap{position:relative;flex:1;min-width:0}
          .${p}-type-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 11px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;font-family:inherit;transition:all .15s;text-align:left}
          .${p}-type-btn:hover,.${p}-type-btn.open{border-color:var(--primary);color:var(--primary)}
          .${p}-type-btn svg{flex-shrink:0;transition:transform .15s}
          .${p}-type-btn.open svg{transform:rotate(180deg)}
          .${p}-type-menu{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid var(--border);border-radius:var(--r-md);box-shadow:var(--shadow-md);z-index:100;overflow:hidden}
          .${p}-type-menu.open{display:block}
          .${p}-type-opt{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:none;font-size:12px;font-weight:500;color:var(--gray);cursor:pointer;font-family:inherit;text-align:left;transition:background .1s}
          .${p}-type-opt:hover{background:rgba(0,0,0,.04);color:var(--dark)}
          .${p}-type-opt.active{font-weight:700;color:var(--dark);background:rgba(var(--primary-rgb),.06)}
          .${p}-type-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
          .${p}-status-toggle{display:flex;border:1.5px solid var(--border);border-radius:var(--r-md);overflow:hidden;background:#fff;flex-shrink:0}
          .${p}-status-opt{padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer;color:var(--gray);font-family:inherit;border:none;background:none;transition:all .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none;user-select:none}
          .${p}-status-opt.active{background:var(--primary);color:var(--primary-text)}
          /* ── Task cards ── */
          .${p}-list{display:flex;flex-direction:column;gap:8px}
          .${p}-card{background:#fff;border-radius:var(--r-lg);box-shadow:var(--shadow-sm);border:1px solid var(--border);border-left:3px solid var(--primary);overflow:hidden;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-left-color .35s ease,opacity .35s ease}
          .${p}-card:hover:not(.done){transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.09);border-left-color:var(--accent)}
          .${p}-card:active:not(.done){transform:translateY(0);box-shadow:var(--shadow-sm)}
          .${p}-card.done{border-left-color:var(--border);opacity:.72}
          .${p}-card.done:hover{opacity:.88}
          .${p}-card-inner{display:flex;align-items:flex-start;gap:12px;padding:13px 16px}
          .${p}-check-wrap{flex-shrink:0;padding-top:2px;position:relative}
          .${p}-check{width:18px;height:18px;border-radius:50%;border:2px solid #d1d5db;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
          .${p}-check:hover{border-color:var(--primary);background:rgba(var(--primary-rgb),.05)}
          .${p}-check.checked{background:var(--success);border-color:var(--success)}
          .${p}-check-icon{display:none}
          .${p}-check.checked .${p}-check-icon{display:block}
          .${p}-card-body{flex:1;min-width:0}
          .${p}-card-top{display:flex;align-items:center;gap:7px;margin-bottom:4px;flex-wrap:wrap}
          .${p}-type-badge{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#fff;flex-shrink:0}
          .${p}-prio-badge{padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.3px;flex-shrink:0;border:1.5px solid currentColor}
          .${p}-card-title{font-size:14px;font-weight:700;color:var(--dark);line-height:1.3;word-break:break-word;transition:color .3s ease}
          .${p}-card.done .${p}-card-title{color:var(--gray)}
          .${p}-card-title>span{position:relative;display:inline}
          .${p}-card-title>span::after{content:"";position:absolute;left:0;top:50%;height:1.5px;background:var(--gray);width:0;transform:translateY(-50%);transition:width .35s ease;display:block}
          .${p}-card.done .${p}-card-title>span::after{width:100%}
          .${p}-card-desc{font-size:12px;color:var(--gray);margin-top:3px;line-height:1.45;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
          .${p}-card-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:7px;align-items:center}
          .${p}-meta-item{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--gray-lt)}
          .${p}-meta-item svg{flex-shrink:0}
          .${p}-meta-item.overdue{color:var(--error);font-weight:600}
          @keyframes ${p}-check-pop{0%{transform:scale(1)}35%{transform:scale(1.35);box-shadow:0 0 0 6px rgba(var(--primary-rgb),.12)}65%{transform:scale(.88)}100%{transform:scale(1);box-shadow:none}}
          @keyframes ${p}-uncheck-pop{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1)}}
          .${p}-check.pop-done{animation:${p}-check-pop .38s cubic-bezier(.34,1.56,.64,1) forwards}
          .${p}-check.pop-undone{animation:${p}-uncheck-pop .28s cubic-bezier(.34,1.56,.64,1) forwards}
          @keyframes ${p}-spark{0%{transform:scale(0) translate(0,0);opacity:1}100%{transform:scale(1) translate(var(--tx),var(--ty));opacity:0}}
          .${p}-spark{position:absolute;width:5px;height:5px;border-radius:50%;pointer-events:none;animation:${p}-spark .5s ease-out forwards}
          /* Staggered list entrance (first render only) */
          @keyframes ${p}-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
          .${p}-list.intro>*{animation:${p}-rise .42s cubic-bezier(.22,1,.36,1) both}
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `.${p}-list.intro>*:nth-child(${n}){animation-delay:${(n - 1) * 0.05}s}`).join("")}
          .${p}-list.intro>*:nth-child(n+11){animation-delay:.5s}
          /* Comment entrance */
          @keyframes ${p}-cmt-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
          .${p}-cmt-item{animation:${p}-cmt-in .32s ease both}
          ${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `.${p}-cmt-list .${p}-cmt-item:nth-child(${n}){animation-delay:${(n - 1) * 0.04}s}`).join("")}
          @media (prefers-reduced-motion:reduce){.${p}-list.intro>*,.${p}-cmt-item{animation:none!important}}
          /* ── Audit result card ── */
          .${p}-audit-card{border-radius:var(--r-lg);padding:16px;margin-bottom:12px;border:1px solid}
          .${p}-audit-card.pass{background:rgba(46,125,74,.05);border-color:rgba(46,125,74,.25)}
          .${p}-audit-card.fail{background:rgba(196,30,58,.05);border-color:rgba(196,30,58,.25)}
          .${p}-audit-card-score{font-size:36px;font-weight:800;line-height:1}
          .${p}-audit-card-meta{font-size:12px;color:var(--gray);display:flex;flex-direction:column;gap:4px;margin-top:10px}
          .${p}-audit-card-meta span{display:flex;align-items:center;gap:5px}
          .${p}-audit-card{cursor:pointer;transition:transform .12s,box-shadow .15s;-webkit-tap-highlight-color:transparent}
          .${p}-audit-card:hover{box-shadow:var(--shadow-md)}
          .${p}-audit-card:active{transform:scale(.99)}
          .${p}-audit-card-cta{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:13px;padding-top:11px;border-top:1px solid rgba(0,0,0,.07);font-size:12px;font-weight:700;color:var(--gray)}
          .${p}-reassign{margin-top:8px;position:relative}
          .${p}-reassign-btn{display:inline-flex!important;width:auto!important;margin:0!important;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--primary);background:rgba(var(--primary-rgb),.07)!important;border:none!important;border-radius:var(--r-sm);cursor:pointer;font-family:inherit;padding:6px 11px!important;line-height:normal!important}
          .${p}-reassign-btn:hover{background:rgba(var(--primary-rgb),.13)!important}
          .${p}-reassign-pop{margin-top:8px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;box-shadow:var(--shadow-md);overflow:hidden}
          .${p}-reassign-search{width:100%;border:none;border-bottom:1px solid var(--border);padding:10px 12px;font-family:inherit;font-size:13px;color:var(--dark);background:#fafafa}
          .${p}-reassign-search:focus{outline:none;background:#fff}
          .${p}-reassign-results{max-height:240px;overflow-y:auto}
          .${p}-reassign-h{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray-lt);padding:8px 12px 4px}
          .${p}-reassign-opt{display:flex;align-items:center;gap:8px;padding:9px 12px;font-size:13px;color:var(--dark);cursor:pointer}
          .${p}-reassign-opt:hover{background:rgba(var(--primary-rgb),.06)}
          .${p}-reassign-opt span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .${p}-reassign-opt.unassign{color:var(--error);border-top:1px solid var(--border);font-weight:600}
          .${p}-reassign-empty{padding:9px 12px;font-size:12px;color:var(--gray-lt)}
          .${p}-audit-detail-score{font-size:52px;font-weight:800;line-height:1;letter-spacing:-1px}
          .${p}-audit-detail-sub{font-size:14px;font-weight:700;margin:4px 0 16px}
          .${p}-detail.audit-view .${p}-detail-foot{display:none}
          .${p}-cat-chart{display:flex;flex-direction:column;gap:10px;margin-top:13px}
          .${p}-cat-top{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-bottom:4px}
          .${p}-cat-name{color:var(--dark);font-weight:400}
          .${p}-cat-pct{color:var(--gray);font-weight:700;flex-shrink:0;margin-left:8px}
          .${p}-cat-bar{height:7px;background:rgba(0,0,0,.08);border-radius:4px;overflow:hidden}
          .${p}-cat-fill{display:block;height:100%;border-radius:4px;transition:width .45s ease}
          .${p}-cat-fill.hi{background:var(--success)}
          .${p}-cat-fill.mid{background:#d97706}
          .${p}-cat-fill.lo{background:var(--error)}
          /* ── Assignee tab toggle in detail ── */
          .${p}-assign-tabs{display:flex;gap:4px;margin:8px 0}
          .${p}-assign-tab{flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-weight:600;background:#f9fafb;color:var(--gray);cursor:pointer;text-align:center;transition:all .15s;font-family:inherit}
          .${p}-assign-tab.active{background:var(--primary);color:var(--primary-text);border-color:var(--primary)}
          /* ── States ── */
          .${p}-state{padding:40px 20px;text-align:center;color:var(--gray-lt);font-size:13px;line-height:1.6}
          .${p}-state-icon{font-size:32px;margin-bottom:8px;display:block}
          .${p}-state strong{color:var(--gray);display:block;font-size:14px;margin-bottom:4px}
          .${p}-banner{display:none;padding:10px 14px;border-radius:var(--r-md);margin-bottom:12px;font-size:13px;line-height:1.5}
          .${p}-banner.error{background:rgba(196,30,58,.08);border:1px solid rgba(196,30,58,.25);color:var(--error)}
          .${p}-banner.info{background:rgba(var(--primary-rgb),.06);border:1px solid rgba(var(--primary-rgb),.2);color:var(--primary)}
          .${p}-section-label{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt);padding:4px 0 8px;margin-top:4px}
          /* ── Ghost cards (other audit tasks) ── */
          .${p}-card.ghost{opacity:.55;border-left-color:var(--border)}
          .${p}-card.ghost:hover{opacity:.8}
          .${p}-other-toggle{width:100%;padding:9px 14px;background:none;border:1.5px dashed var(--border);border-radius:var(--r-md);font-size:12px;font-weight:600;color:var(--gray-lt);cursor:pointer;text-align:center;font-family:inherit;transition:all .15s;touch-action:manipulation;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px}
          .${p}-other-toggle:hover{border-color:var(--gray);color:var(--gray)}
        </style>

        <div class="${p}">
          <div class="${p}-header">
            <div class="${p}-title">
              <span class="${p}-title-dot"></span>
              ${auditMode ? "Audit Results" : "My Tasks"}
              <span class="${p}-badge-count" id="${p}-count">0</span>
            </div>
            <div class="${p}-header-actions">
              ${allowCreate && !auditMode ? `<button type="button" class="${p}-new-btn" id="${p}-new" title="New task"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>New</span></button>` : ""}
              <button type="button" class="${p}-refresh-btn" id="${p}-refresh" title="Refresh">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
          </div>

          ${auditMode ? `<div class="${p}-audit-tab-wrap" id="${p}-audit-tab-wrap" style="display:none">
            <div class="${p}-audit-tab-label">Audit History</div>
            <div class="${p}-audit-scroll">
              <button type="button" class="${p}-audit-arrow" id="${p}-audit-prev" aria-label="Scroll left"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
              <div class="${p}-audit-tabs" id="${p}-audit-tabs"></div>
              <button type="button" class="${p}-audit-arrow" id="${p}-audit-next" aria-label="Scroll right"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
            </div>
          </div>` : ""}

          <div class="${p}-store-tabs" id="${p}-store-tabs" style="display:none"></div>
          <div class="${p}-banner" id="${p}-banner"></div>

          ${!auditMode ? `
          <div class="${p}-filters">
            <div class="${p}-type-wrap" id="${p}-type-wrap">
              <button type="button" class="${p}-type-btn" id="${p}-type-btn">
                <span id="${p}-type-label">All Types</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="${p}-type-menu" id="${p}-type-menu"></div>
            </div>
            <div class="${p}-status-toggle">
              <button type="button" class="${p}-status-opt active" data-status="open">Open</button>
              <button type="button" class="${p}-status-opt" data-status="done">Done</button>
              ${showDone ? `<button type="button" class="${p}-status-opt" data-status="all">Both</button>` : ""}
            </div>
          </div>` : ""}

          <div id="${p}-list-wrap">
            <div class="${p}-state">
              <span class="${p}-spin" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px;display:block"></span>
              Loading…
            </div>
          </div>
        </div>
      `;
                // ── DOM refs ──────────────────────────────────────────────────────
                const countEl = container.querySelector(`#${p}-count`);
                const bannerEl = container.querySelector(`#${p}-banner`);
                const storeTabs = container.querySelector(`#${p}-store-tabs`);
                const listWrap = container.querySelector(`#${p}-list-wrap`);
                const refreshBtn = container.querySelector(`#${p}-refresh`);
                const typeBtn = !auditMode ? container.querySelector(`#${p}-type-btn`) : null;
                const typeLabelEl = !auditMode ? container.querySelector(`#${p}-type-label`) : null;
                const typeMenu = !auditMode ? container.querySelector(`#${p}-type-menu`) : null;
                const auditTabWrap = auditMode ? container.querySelector(`#${p}-audit-tab-wrap`) : null;
                const auditTabsEl = auditMode ? container.querySelector(`#${p}-audit-tabs`) : null;
                const auditPrev = auditMode ? container.querySelector(`#${p}-audit-prev`) : null;
                const auditNext = auditMode ? container.querySelector(`#${p}-audit-next`) : null;
                function updateAuditArrows() {
                    if (!auditTabsEl || !auditPrev || !auditNext)
                        return;
                    const max = auditTabsEl.scrollWidth - auditTabsEl.clientWidth;
                    const overflow = max > 4;
                    auditPrev.classList.toggle("show", overflow && auditTabsEl.scrollLeft > 2);
                    auditNext.classList.toggle("show", overflow && auditTabsEl.scrollLeft < max - 2);
                }
                if (auditTabsEl && auditPrev && auditNext) {
                    const step = () => Math.max(160, auditTabsEl.clientWidth * 0.7);
                    auditPrev.addEventListener("click", () => auditTabsEl.scrollBy({ left: -step(), behavior: "smooth" }));
                    auditNext.addEventListener("click", () => auditTabsEl.scrollBy({ left: step(), behavior: "smooth" }));
                    auditTabsEl.addEventListener("scroll", updateAuditArrows, { passive: true });
                    window.addEventListener("resize", updateAuditArrows);
                }
                // Detail panel — appended to body so position:fixed works in Staffbase.
                // Body-appended elements + document listeners don't get cleaned up on
                // SPA navigation when the host element is removed, so we manage their
                // lifecycle explicitly via refs stashed on `this`.
                const self = this;
                // Tear down artifacts from a previous render of this same host (re-renders)
                if (self._mtwOverlay) {
                    self._mtwOverlay.remove();
                    self._mtwOverlay = undefined;
                }
                if (self._mtwDetail) {
                    self._mtwDetail.remove();
                    self._mtwDetail = undefined;
                }
                if (self._mtwCreate) {
                    self._mtwCreate.remove();
                    self._mtwCreate = undefined;
                }
                if (self._mtwDocClick) {
                    document.removeEventListener("click", self._mtwDocClick);
                    self._mtwDocClick = undefined;
                }
                if (self._mtwDocKey) {
                    document.removeEventListener("keydown", self._mtwDocKey);
                    self._mtwDocKey = undefined;
                }
                // Defensive sweep for orphans from prior navigations where
                // disconnectedCallback never ran (e.g. parent innerHTML wipe).
                document.querySelectorAll(`.${p}-overlay[data-mtw-inst], .${p}-detail[data-mtw-inst]`).forEach(el => {
                    const inst = el.dataset.mtwInst;
                    if (!inst) {
                        el.remove();
                        return;
                    }
                    const hostStillAlive = !!document.querySelector(`[data-mtw-inst="${inst}"]:not(.${p}-overlay):not(.${p}-detail)`);
                    if (!hostStillAlive)
                        el.remove();
                });
                const instId = Math.random().toString(36).slice(2);
                container.dataset.mtwInst = instId;
                const overlayEl = document.createElement("div");
                overlayEl.className = `${p}-overlay`;
                overlayEl.dataset.mtwInst = instId;
                document.body.appendChild(overlayEl);
                self._mtwOverlay = overlayEl;
                const detailEl = document.createElement("div");
                detailEl.className = `${p}-detail`;
                detailEl.dataset.mtwInst = instId;
                detailEl.innerHTML = `
        <div class="${p}-detail-handle"></div>
        <div class="${p}-detail-head">
          <div class="${p}-detail-head-badges" id="${p}-detail-badges-${instId}"></div>
          <button type="button" class="${p}-detail-close" id="${p}-detail-close-${instId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="${p}-detail-body" id="${p}-detail-body-${instId}"></div>
        <div class="${p}-detail-foot">
          <button type="button" class="${p}-detail-toggle-btn" id="${p}-detail-toggle-${instId}"></button>
        </div>
      `;
                document.body.appendChild(detailEl);
                self._mtwDetail = detailEl;
                const detailBadges = detailEl.querySelector(`#${p}-detail-badges-${instId}`);
                const detailBody = detailEl.querySelector(`#${p}-detail-body-${instId}`);
                const detailToggle = detailEl.querySelector(`#${p}-detail-toggle-${instId}`);
                const detailClose = detailEl.querySelector(`#${p}-detail-close-${instId}`);
                // ── Helpers ───────────────────────────────────────────────────────
                const apiOpts = (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: { Authorization: `Basic ${apiToken}`, "Content-Type": "application/json" } }));
                function esc(s) { return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
                function showBanner(type, msg) { bannerEl.className = `${p}-banner ${type}`; bannerEl.style.display = "block"; bannerEl.textContent = msg; }
                function hideBanner() { bannerEl.style.display = "none"; }
                // ── On-screen debug log (for mobile webview where console is hidden) ──
                const debugLog = [];
                let debugBodyEl = null;
                function dlog(...args) {
                    const ts = new Date().toISOString().slice(11, 23);
                    const line = ts + " " + args.map(a => {
                        if (typeof a === "string")
                            return a;
                        try {
                            return JSON.stringify(a);
                        }
                        catch (_) {
                            return String(a);
                        }
                    }).join(" ");
                    debugLog.push(line);
                    if (debugLog.length > 500)
                        debugLog.shift();
                    try {
                        console.log("[mtw]", ...args);
                    }
                    catch (_) { }
                    if (debugBodyEl) {
                        debugBodyEl.textContent = debugLog.join("\n");
                        debugBodyEl.scrollTop = debugBodyEl.scrollHeight;
                    }
                }
                function buildDebugPanel() {
                    if (!debugMode)
                        return;
                    const panel = document.createElement("div");
                    panel.className = `${p}-dbg`;
                    panel.innerHTML = `
          <div class="${p}-dbg-bar">
            <span class="${p}-dbg-title">Debug</span>
            <div class="${p}-dbg-actions">
              <button type="button" class="${p}-dbg-btn" data-act="copy">Copy</button>
              <button type="button" class="${p}-dbg-btn" data-act="clear">Clear</button>
              <button type="button" class="${p}-dbg-btn" data-act="toggle">Hide</button>
            </div>
          </div>
          <pre class="${p}-dbg-body"></pre>`;
                    document.body.appendChild(panel);
                    debugBodyEl = panel.querySelector(`.${p}-dbg-body`);
                    const body = debugBodyEl;
                    const copyBtn = panel.querySelector(`[data-act="copy"]`);
                    panel.querySelector(`[data-act="clear"]`).addEventListener("click", () => { debugLog.length = 0; if (body)
                        body.textContent = ""; });
                    panel.querySelector(`[data-act="toggle"]`).addEventListener("click", (e) => {
                        const collapsed = panel.classList.toggle("collapsed");
                        e.target.textContent = collapsed ? "Show" : "Hide";
                    });
                    copyBtn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                        const text = debugLog.join("\n");
                        let ok = false;
                        try {
                            yield navigator.clipboard.writeText(text);
                            ok = true;
                        }
                        catch (_) {
                            // Fallback for webviews without async clipboard.
                            try {
                                const ta = document.createElement("textarea");
                                ta.value = text;
                                ta.style.position = "fixed";
                                ta.style.opacity = "0";
                                document.body.appendChild(ta);
                                ta.focus();
                                ta.select();
                                ok = document.execCommand("copy");
                                document.body.removeChild(ta);
                            }
                            catch (_) {
                                ok = false;
                            }
                        }
                        copyBtn.textContent = ok ? "Copied!" : "Copy failed";
                        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
                    }));
                    dlog("debug panel ready · origin", location.origin, "· comments", enableComments);
                }
                buildDebugPanel();
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
                    return { text: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), overdue };
                }
                function groupName(id) { return groupMap.get(id) || id; }
                // ── Attachments (Staffbase media TUS upload) ──────────────────────
                const MEDIA_MAX = 25 * 1024 * 1024; // 25 MB
                function humanSize(b) {
                    if (b < 1024)
                        return `${b} B`;
                    if (b < 1048576)
                        return `${(b / 1024).toFixed(0)} KB`;
                    return `${(b / 1048576).toFixed(1)} MB`;
                }
                function b64utf8(s) {
                    let out = "";
                    const bytes = new TextEncoder().encode(s);
                    for (const byte of bytes)
                        out += String.fromCharCode(byte);
                    return btoa(out);
                }
                // Upload a File to Staffbase media via the resumable TUS protocol.
                function uploadMedia(file) {
                    return __awaiter(this, void 0, void 0, function* () {
                        var _a, _b, _c, _d;
                        const create = yield fetch(`${baseUrl}/media/tus`, {
                            method: "POST", credentials: "omit",
                            headers: {
                                Authorization: `Basic ${apiToken}`,
                                "Tus-Resumable": "1.0.0",
                                "Upload-Length": String(file.size),
                                "Upload-Metadata": `filename ${b64utf8(file.name)},filetype ${b64utf8(file.type || "application/octet-stream")}`,
                            },
                        });
                        if (create.status !== 201)
                            throw new Error(`upload init failed (${create.status})`);
                        const loc = create.headers.get("Location");
                        if (!loc)
                            throw new Error("no upload URL");
                        const buf = yield file.arrayBuffer();
                        const CHUNK = 5 * 1024 * 1024;
                        let offset = 0;
                        let media = null;
                        while (offset < buf.byteLength) {
                            const end = Math.min(offset + CHUNK, buf.byteLength);
                            const res = yield fetch(loc, {
                                method: "PATCH", credentials: "omit",
                                headers: {
                                    Authorization: `Basic ${apiToken}`,
                                    "Tus-Resumable": "1.0.0",
                                    "Upload-Offset": String(offset),
                                    "Content-Type": "application/offset+octet-stream",
                                },
                                body: buf.slice(offset, end),
                            });
                            if (!res.ok)
                                throw new Error(`upload failed (${res.status})`);
                            offset = end;
                            try {
                                media = yield res.clone().json();
                            }
                            catch (_) { }
                        }
                        if (!(media === null || media === void 0 ? void 0 : media.id))
                            throw new Error("no media id returned");
                        const url = ((_a = media.resourceInfo) === null || _a === void 0 ? void 0 : _a.url) || ((_d = (_c = (_b = media.transformations) === null || _b === void 0 ? void 0 : _b.t_preview) === null || _c === void 0 ? void 0 : _c.resourceInfo) === null || _d === void 0 ? void 0 : _d.url) || "";
                        return { id: media.id, url };
                    });
                }
                function mediaMeta(id) {
                    return __awaiter(this, void 0, void 0, function* () {
                        try {
                            const r = yield fetch(`${baseUrl}/media/medium/${id}/metadata`, apiOpts());
                            return r.ok ? yield r.json() : null;
                        }
                        catch (_) {
                            return null;
                        }
                    });
                }
                const iClip = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
                const iFileGeneric = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
                const iXsmall = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
                const iSend = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
                // ── Comments (user-session auth; NOT the Basic token) ──────────────
                // Comments must be attributed to a person, so the POST uses the logged-in
                // user's session (cookie + CSRF) — see comments.md. We target the real
                // API host (baseUrl), NOT location.origin: on mobile the app runs under a
                // capacitor:// origin, where location.origin/api hits the local app shell
                // and returns index.html instead of reaching Staffbase.
                function readCsrf() {
                    var _a, _b;
                    // Confirmed source (web + mobile widget context): window.we.authMgr.csrfToken.
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
                const CMT_CREATE_CT = "application/vnd.staffbase.tasks.comment-create.v1+json";
                const CMT_HTML_ACCEPT = "application/vnd.staffbase.tasks.comment.html-content.v1+json";
                // Build the Designer content document the create endpoint expects.
                function commentDoc(text) {
                    const html = `<p>${esc(text)}</p>`;
                    // `config` carries the visible text. Exact key is still being
                    // confirmed in-app (see comments.md); send the likely variants.
                    return { blocks: { b1: { type: "text", children: [], config: { html, text } } }, content: ["b1"] };
                }
                // Reading comments works with the Basic token (confirmed). Only the
                // POST needs the user session, so the read uses the token path here.
                function loadComments(task) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const url = `${baseUrl}/tasks/${task.installationId}/task/${task.id}/comments${currentUserId ? `?viewedBy=${currentUserId}` : ""}`;
                        dlog("GET comments", url);
                        const r = yield fetch(url, apiOpts({ headers: { Accept: CMT_HTML_ACCEPT } }));
                        const raw = yield r.text();
                        dlog("GET comments ←", r.status, raw.slice(0, 400));
                        if (!r.ok)
                            throw new Error(`HTTP ${r.status}`);
                        let d;
                        try {
                            d = JSON.parse(raw);
                        }
                        catch (_) {
                            d = [];
                        }
                        return Array.isArray(d) ? d : (d.data || []);
                    });
                }
                // User lookup (for avatars + names on comments), cached.
                const userCache = new Map();
                function fetchUser(id) {
                    return __awaiter(this, void 0, void 0, function* () {
                        var _a, _b, _c, _d, _e, _f;
                        if (!id)
                            return { name: "User", avatar: "" };
                        const hit = userCache.get(id);
                        if (hit)
                            return hit;
                        let info = { name: "User", avatar: "" };
                        try {
                            const r = yield fetch(`${baseUrl}/users/${id}`, apiOpts());
                            if (r.ok) {
                                const u = yield r.json();
                                const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "User";
                                const avatar = ((_b = (_a = u.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = u.avatar) === null || _c === void 0 ? void 0 : _c.thumb) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = u.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "";
                                info = { name, avatar };
                            }
                        }
                        catch (_) { }
                        userCache.set(id, info);
                        return info;
                    });
                }
                function fetchUsers() {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (usersList)
                            return usersList;
                        try {
                            const r = yield fetch(`${baseUrl}/users?limit=200`, apiOpts());
                            if (r.ok) {
                                const d = yield r.json();
                                usersList = (d.data || d || []).map((u) => ({ id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || u.id }));
                            }
                            else
                                usersList = [];
                        }
                        catch (_) {
                            usersList = [];
                        }
                        return usersList;
                    });
                }
                // Reassign picker (audit mode). Searchable groups + people; PATCHes the task.
                function wireReassign(task) {
                    const root = detailBody.querySelector(`#${p}-reassign-${instId}`);
                    if (!root)
                        return;
                    const btn = root.querySelector(`.${p}-reassign-btn`);
                    const pop = root.querySelector(`.${p}-reassign-pop`);
                    const search = root.querySelector(`.${p}-reassign-search`);
                    const results = root.querySelector(`.${p}-reassign-results`);
                    const gIco = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
                    const uIco = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    const groupsArr = () => { const o = []; groupMap.forEach((name, id) => o.push({ id, name })); return o.sort((a, b) => a.name.localeCompare(b.name)); };
                    const renderResults = (q) => {
                        const ql = q.trim().toLowerCase();
                        const groups = groupsArr().filter(g => !ql || g.name.toLowerCase().includes(ql)).slice(0, 15);
                        const users = (usersList || []).filter(u => !ql || u.name.toLowerCase().includes(ql)).slice(0, 15);
                        let html = "";
                        if (groups.length) {
                            html += `<div class="${p}-reassign-h">Groups</div>` + groups.map(g => `<div class="${p}-reassign-opt" data-type="group" data-id="${esc(g.id)}">${gIco}<span>${esc(g.name)}</span></div>`).join("");
                        }
                        html += `<div class="${p}-reassign-h">People</div>` + (users.length ? users.map(u => `<div class="${p}-reassign-opt" data-type="user" data-id="${esc(u.id)}">${uIco}<span>${esc(u.name)}</span></div>`).join("") : `<div class="${p}-reassign-empty">${usersList ? "No matches" : "Loading…"}</div>`);
                        html += `<div class="${p}-reassign-opt unassign" data-type="none" data-id="">Unassign</div>`;
                        results.innerHTML = html;
                        results.querySelectorAll(`.${p}-reassign-opt`).forEach(o => o.addEventListener("click", () => apply(o.dataset.type, o.dataset.id)));
                    };
                    const apply = (type, id) => __awaiter(this, void 0, void 0, function* () {
                        const body = type === "group" ? { groupIds: [id], assigneeIds: [] } : type === "user" ? { assigneeIds: [id], groupIds: [] } : { assigneeIds: [], groupIds: [] };
                        pop.style.display = "none";
                        btn.disabled = true;
                        try {
                            const r = yield fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify(body) }));
                            if (!r.ok)
                                throw new Error(`HTTP ${r.status}`);
                            task.groupIds = body.groupIds;
                            task.assigneeIds = body.assigneeIds;
                            hideBanner();
                            renderDetailContent(task);
                            load();
                        }
                        catch (e) {
                            showBanner("error", `Couldn't reassign: ${e.message}`);
                            btn.disabled = false;
                        }
                    });
                    btn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                        if (pop.style.display !== "none") {
                            pop.style.display = "none";
                            return;
                        }
                        pop.style.display = "block";
                        renderResults("");
                        search.value = "";
                        search.focus();
                        if (!usersList) {
                            yield fetchUsers();
                            if (detailTask === task)
                                renderResults(search.value);
                        }
                    }));
                    search.addEventListener("input", () => renderResults(search.value));
                }
                function initials(name) {
                    var _a, _b;
                    const parts = name.trim().split(/\s+/);
                    return ((((_a = parts[0]) === null || _a === void 0 ? void 0 : _a[0]) || "") + (((_b = parts[1]) === null || _b === void 0 ? void 0 : _b[0]) || "")).toUpperCase() || "?";
                }
                function avatarHtml(info) {
                    if (info.avatar)
                        return `<img class="${p}-cmt-av" src="${esc(info.avatar)}" alt="${esc(info.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="${p}-cmt-av ${p}-cmt-av-fb" style="display:none">${esc(initials(info.name))}</span>`;
                    return `<span class="${p}-cmt-av ${p}-cmt-av-fb">${esc(initials(info.name))}</span>`;
                }
                function postComment(task, text) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const url = `${baseUrl}/tasks/${task.installationId}/task/${task.id}/comments`;
                        const body = JSON.stringify({ content: commentDoc(text) });
                        dlog("POST comment", url, "csrf?", readCsrf() ? "yes" : "no", "body", body);
                        const r = yield fetch(url, sessionOpts({
                            method: "POST",
                            headers: { "Content-Type": CMT_CREATE_CT, Accept: CMT_HTML_ACCEPT },
                            body,
                        }));
                        const raw = yield r.text();
                        // Capture the real shape of the first successful create for tuning.
                        dlog("POST comment ←", r.status, raw.slice(0, 600));
                        if (!r.ok)
                            throw new Error(`HTTP ${r.status}`);
                        try {
                            return JSON.parse(raw);
                        }
                        catch (_) {
                            return null;
                        }
                    });
                }
                function commentText(c) {
                    const ct = c.content;
                    if (typeof ct === "string")
                        return ct; // rendered HTML
                    if (ct === null || ct === void 0 ? void 0 : ct.html)
                        return ct.html;
                    // Structured Designer document: pull html/text from its blocks in order.
                    if (ct === null || ct === void 0 ? void 0 : ct.blocks) {
                        const order = Array.isArray(ct.content) ? ct.content : Object.keys(ct.blocks);
                        const parts = order.map((id) => {
                            const b = ct.blocks[id];
                            const cfg = b && b.config || {};
                            return cfg.html || (cfg.text ? `<p>${esc(cfg.text)}</p>` : "");
                        }).filter(Boolean);
                        if (parts.length)
                            return parts.join("");
                    }
                    if (c.text)
                        return c.text;
                    return "";
                }
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
                function commentAuthorId(c) {
                    var _a;
                    return c.authorId || c.authorID || ((_a = c.author) === null || _a === void 0 ? void 0 : _a.id) || "";
                }
                // Inline comment attachments: comment text carries [attachment:<id>] tokens.
                const mediaCache = new Map();
                function metaCached(id) {
                    return __awaiter(this, void 0, void 0, function* () { if (mediaCache.has(id))
                        return mediaCache.get(id); const m = yield mediaMeta(id); mediaCache.set(id, m); return m; });
                }
                const ATT_TOKEN = /\[attachment:([A-Za-z0-9]+)\]/g;
                function resolveAttachments(html) {
                    return html.replace(ATT_TOKEN, (_m, id) => {
                        var _a, _b;
                        const meta = mediaCache.get(id);
                        const name = esc((meta === null || meta === void 0 ? void 0 : meta.fileName) || "attachment");
                        const href = ((_a = meta === null || meta === void 0 ? void 0 : meta.thumbnail) === null || _a === void 0 ? void 0 : _a.url) || "";
                        const isImg = /^image\//.test((meta === null || meta === void 0 ? void 0 : meta.mimeType) || "");
                        if (isImg && ((_b = meta === null || meta === void 0 ? void 0 : meta.thumbnail) === null || _b === void 0 ? void 0 : _b.url)) {
                            return `<a href="${esc(href)}" target="_blank" rel="noopener"><img class="${p}-cmt-att-img" src="${esc(meta.thumbnail.url)}" alt="${name}"></a>`;
                        }
                        return `<a class="${p}-cmt-att" href="${esc(href) || "#"}" target="_blank" rel="noopener">${iClip}<span>${name}</span></a>`;
                    });
                }
                // Render the comments list inside the open detail panel.
                function renderComments(task) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const list = detailBody.querySelector(`#${p}-cmt-list-${instId}`);
                        if (!list)
                            return;
                        list.innerHTML = `<div class="${p}-cmt-empty">Loading…</div>`;
                        let comments = [];
                        try {
                            comments = yield loadComments(task);
                        }
                        catch (e) {
                            if (detailTask !== task)
                                return;
                            list.innerHTML = `<div class="${p}-cmt-empty">Couldn't load comments (${esc(e.message)}).</div>`;
                            return;
                        }
                        if (detailTask !== task)
                            return; // panel changed while loading
                        if (!comments.length) {
                            list.innerHTML = `<div class="${p}-cmt-empty">No comments yet. Be the first to comment.</div>`;
                            return;
                        }
                        // Resolve author profiles (avatars + names) in parallel.
                        const authors = yield Promise.all(comments.map(c => fetchUser(commentAuthorId(c))));
                        // Prefetch metadata for any inline [attachment:id] tokens.
                        const bodies = comments.map(c => commentText(c));
                        const attIds = new Set();
                        bodies.forEach(b => { let m; ATT_TOKEN.lastIndex = 0; while ((m = ATT_TOKEN.exec(b)))
                            attIds.add(m[1]); });
                        if (attIds.size)
                            yield Promise.all([...attIds].map(metaCached));
                        if (detailTask !== task)
                            return;
                        list.innerHTML = comments.map((c, i) => {
                            const a = authors[i];
                            return `
          <div class="${p}-cmt-item">
            ${avatarHtml(a)}
            <div class="${p}-cmt-main">
              <div class="${p}-cmt-head"><span class="${p}-cmt-author">${esc(a.name)}</span><span class="${p}-cmt-time">${esc(commentTime(c.createdAt || c.created || ""))}</span></div>
              <div class="${p}-cmt-body">${resolveAttachments(bodies[i]) || "<em>(empty)</em>"}</div>
            </div>
          </div>`;
                        }).join("");
                    });
                }
                // Render the attachment tiles inside the open detail panel for a task.
                function renderAttachments(task) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const grid = detailBody.querySelector(`#${p}-att-grid-${instId}`);
                        if (!grid)
                            return;
                        const ids = task.attachmentIds || [];
                        if (!ids.length) {
                            grid.innerHTML = `<span class="${p}-att-empty">No attachments</span>`;
                            return;
                        }
                        grid.innerHTML = `<span class="${p}-att-empty">Loading…</span>`;
                        const metas = yield Promise.all(ids.map(mediaMeta));
                        if (detailTask !== task)
                            return; // panel changed while loading
                        grid.innerHTML = ids.map((id, i) => {
                            var _a, _b;
                            const m = metas[i];
                            const name = esc((m === null || m === void 0 ? void 0 : m.fileName) || "file");
                            const size = (m === null || m === void 0 ? void 0 : m.size) ? `<span class="${p}-att-size">${humanSize(m.size)}</span>` : "";
                            const thumb = ((_a = m === null || m === void 0 ? void 0 : m.thumbnail) === null || _a === void 0 ? void 0 : _a.url)
                                ? `<img class="${p}-att-thumb" src="${esc(m.thumbnail.url)}" alt="">`
                                : `<span class="${p}-att-ico">${iFileGeneric}</span>`;
                            const href = ((_b = m === null || m === void 0 ? void 0 : m.thumbnail) === null || _b === void 0 ? void 0 : _b.url) || "";
                            return `<div class="${p}-att-tile">
            <a class="${p}-att-link" href="${esc(href)}" target="_blank" rel="noopener">
              ${thumb}<span class="${p}-att-meta"><span class="${p}-att-name">${name}</span>${size}</span>
            </a>
            <button type="button" class="${p}-att-x" data-id="${esc(id)}" title="Remove">${iXsmall}</button>
          </div>`;
                        }).join("");
                        grid.querySelectorAll(`.${p}-att-x`).forEach(btn => {
                            btn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                                const rid = btn.dataset.id || "";
                                const next = (task.attachmentIds || []).filter(x => x !== rid);
                                btn.disabled = true;
                                try {
                                    const res = yield fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: next }) }));
                                    if (!res.ok)
                                        throw new Error(`HTTP ${res.status}`);
                                    task.attachmentIds = next;
                                    renderAttachments(task);
                                }
                                catch (e) {
                                    showBanner("error", `Could not remove: ${e.message}`);
                                    btn.disabled = false;
                                }
                            }));
                        });
                    });
                }
                // ── Distinct types for visible install ────────────────────────────
                function getTypes() {
                    const types = new Set();
                    let hasUntyped = false;
                    for (const t of allTasks) {
                        if (t.taskType === "audit-result")
                            continue;
                        if (activeInstallFilter !== "all" && t.installationId !== activeInstallFilter)
                            continue;
                        if (t.taskType)
                            types.add(t.taskType);
                        else
                            hasUntyped = true;
                    }
                    const sorted = [...types].sort().map(k => ({ key: k, label: k }));
                    if (hasUntyped)
                        sorted.push({ key: "__none__", label: "No Type" });
                    return sorted;
                }
                // ── Filtered tasks (normal mode) ──────────────────────────────────
                function filteredTasks() {
                    return allTasks.filter(t => {
                        if (t.taskType === "audit-result")
                            return false; // always hide system tasks
                        if (activeInstallFilter !== "all" && t.installationId !== activeInstallFilter)
                            return false;
                        if (activeTypeFilters.size > 0) {
                            const key = t.taskType || "__none__";
                            if (!activeTypeFilters.has(key))
                                return false;
                        }
                        const isDone = t.status === "DONE" || t.status === "done" || t.status === "CLOSED";
                        if (activeStatusFilter === "open" && isDone)
                            return false;
                        if (activeStatusFilter === "done" && !isDone)
                            return false;
                        return true;
                    });
                }
                // ── Store tabs ────────────────────────────────────────────────────
                function renderStoreTabs() {
                    if (auditMode) {
                        // In audit mode: pills built from auditLists unique installs
                        const instMap = new Map();
                        for (const al of auditLists) {
                            if (!instMap.has(al.installId))
                                instMap.set(al.installId, { title: al.instTitle || al.installId, count: 0 });
                            instMap.get(al.installId).count++;
                        }
                        if (instMap.size <= 1) {
                            storeTabs.style.display = "none";
                            return;
                        }
                        storeTabs.style.display = "flex";
                        storeTabs.innerHTML = `
            <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter === "all" ? "active" : ""}" data-inst="all">
              All <span style="opacity:.6;font-weight:400">(${auditLists.length})</span>
            </div>
            ${[...instMap.entries()].map(([id, info]) => `
              <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter === id ? "active" : ""}" data-inst="${esc(id)}">
                ${esc(info.title || id)} <span style="opacity:.6;font-weight:400">(${info.count})</span>
              </div>`).join("")}`;
                        storeTabs.querySelectorAll(`.${p}-store-tab`).forEach(btn => {
                            btn.addEventListener("click", () => {
                                var _a;
                                activeInstallFilter = btn.dataset.inst || "all";
                                // If current audit belongs to a different store, reset to first match
                                const filtered = activeInstallFilter === "all" ? auditLists : auditLists.filter(al => al.installId === activeInstallFilter);
                                if (!filtered.find(al => al.listId === activeAuditListId))
                                    activeAuditListId = ((_a = filtered[0]) === null || _a === void 0 ? void 0 : _a.listId) || "";
                                renderStoreTabs();
                                renderAuditTabs();
                                renderList();
                            });
                        });
                        return;
                    }
                    // Normal mode
                    const instMap = new Map();
                    for (const t of allTasks) {
                        if (t.taskType === "audit-result")
                            continue;
                        if (!instMap.has(t.installationId))
                            instMap.set(t.installationId, { title: t.installationTitle, count: 0 });
                        instMap.get(t.installationId).count++;
                    }
                    if (instMap.size <= 1) {
                        storeTabs.style.display = "none";
                        return;
                    }
                    storeTabs.style.display = "flex";
                    const total = allTasks.filter(t => t.taskType !== "audit-result").length;
                    storeTabs.innerHTML = `
          <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter === "all" ? "active" : ""}" data-inst="all">
            All <span style="opacity:.6;font-weight:400">(${total})</span>
          </div>
          ${[...instMap.entries()].map(([id, info]) => `
            <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter === id ? "active" : ""}" data-inst="${esc(id)}">
              ${esc(info.title || id)} <span style="opacity:.6;font-weight:400">(${info.count})</span>
            </div>`).join("")}`;
                    storeTabs.querySelectorAll(`.${p}-store-tab`).forEach(btn => {
                        btn.addEventListener("click", () => {
                            activeInstallFilter = btn.dataset.inst || "all";
                            activeTypeFilters.clear();
                            dropdownOpen = false;
                            renderStoreTabs();
                            renderTypeFilters();
                            renderList();
                        });
                    });
                }
                // ── Audit tabs ────────────────────────────────────────────────────
                function renderAuditTabs() {
                    if (!auditMode || !auditTabWrap || !auditTabsEl)
                        return;
                    if (auditLists.length === 0) {
                        auditTabWrap.style.display = "none";
                        return;
                    }
                    // Filter by active store pill
                    const visible = activeInstallFilter === "all" ? auditLists : auditLists.filter(al => al.installId === activeInstallFilter);
                    if (visible.length === 0) {
                        auditTabWrap.style.display = "none";
                        return;
                    }
                    auditTabWrap.style.display = "";
                    auditTabsEl.innerHTML = visible.map(al => {
                        var _a;
                        const pa = al.parsedAudit;
                        const passing = (_a = pa === null || pa === void 0 ? void 0 : pa.passing) !== null && _a !== void 0 ? _a : null;
                        const pct = (pa === null || pa === void 0 ? void 0 : pa.score) != null ? pa.score + "%" : "—";
                        const dotColor = passing === true ? "var(--success)" : passing === false ? "var(--error)" : "var(--gray-lt)";
                        const label = al.listName.replace(/^Audit\s*—\s*/i, "").trim() || al.listName;
                        return `<div role="button" tabindex="0" class="${p}-audit-tab${al.listId === activeAuditListId ? " active" : ""}" data-list-id="${esc(al.listId)}" data-inst-id="${esc(al.installId)}">
            <span class="${p}-audit-dot" style="background:${dotColor}"></span>
            ${esc(label)} <span style="opacity:.55;font-size:10px">${pct}</span>
          </div>`;
                    }).join("");
                    auditTabsEl.querySelectorAll(`.${p}-audit-tab`).forEach(btn => {
                        btn.addEventListener("click", () => {
                            activeAuditListId = btn.dataset.listId || "";
                            showOtherAuditTasks = false;
                            renderAuditTabs();
                            renderList();
                        });
                    });
                    // Keep the active tab in view + refresh scroll arrows.
                    const active = auditTabsEl.querySelector(`.${p}-audit-tab.active`);
                    if (active)
                        active.scrollIntoView({ inline: "center", block: "nearest" });
                    requestAnimationFrame(updateAuditArrows);
                }
                // ── Type dropdown ─────────────────────────────────────────────────
                let dropdownOpen = false;
                function typeDropdownLabel() {
                    if (activeTypeFilters.size === 0)
                        return "All Types";
                    const types = getTypes();
                    const sel = types.filter(t => activeTypeFilters.has(t.key));
                    if (sel.length === 1)
                        return sel[0].label;
                    return `${sel.length} types`;
                }
                function renderTypeFilters() {
                    if (!typeBtn || !typeLabelEl || !typeMenu)
                        return;
                    const types = getTypes();
                    typeLabelEl.textContent = typeDropdownLabel();
                    typeBtn.classList.toggle("open", dropdownOpen);
                    typeMenu.classList.toggle("open", dropdownOpen);
                    const iconCheck = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    const allActive = activeTypeFilters.size === 0;
                    typeMenu.innerHTML = `
          <button type="button" class="${p}-type-opt ${allActive ? "active" : ""}" data-key="__all__">
            <span style="width:12px;display:flex;align-items:center;justify-content:center">${allActive ? iconCheck : ""}</span>All Types
          </button>
          <div style="height:1px;background:var(--border);margin:2px 0"></div>
          ${types.map(({ key, label }) => {
                        const checked = activeTypeFilters.has(key);
                        const dot = key !== "__none__"
                            ? `<span class="${p}-type-dot" style="background:${typeColor(key)}"></span>`
                            : `<span class="${p}-type-dot" style="background:var(--border)"></span>`;
                        return `<button type="button" class="${p}-type-opt ${checked ? "active" : ""}" data-key="${esc(key)}">
              <span style="width:12px;display:flex;align-items:center;justify-content:center">${checked ? iconCheck : ""}</span>
              ${dot}${esc(label)}</button>`;
                    }).join("")}`;
                    typeMenu.querySelectorAll(`.${p}-type-opt`).forEach(btn => {
                        btn.addEventListener("click", e => {
                            e.stopPropagation();
                            const key = btn.dataset.key;
                            if (key === "__all__")
                                activeTypeFilters.clear();
                            else if (activeTypeFilters.has(key))
                                activeTypeFilters.delete(key);
                            else
                                activeTypeFilters.add(key);
                            renderTypeFilters();
                            renderList();
                        });
                    });
                }
                if (typeBtn)
                    typeBtn.addEventListener("click", e => { e.stopPropagation(); dropdownOpen = !dropdownOpen; renderTypeFilters(); });
                const onDocClick = () => { if (dropdownOpen) {
                    dropdownOpen = false;
                    renderTypeFilters();
                } };
                document.addEventListener("click", onDocClick);
                self._mtwDocClick = onDocClick;
                // ── Render task list ──────────────────────────────────────────────
                function renderList() {
                    if (auditMode) {
                        renderAuditContent();
                        return;
                    }
                    const tasks = filteredTasks();
                    countEl.textContent = String(tasks.length);
                    if (!tasks.length) {
                        const emptyMsg = allTasks.filter(t => t.taskType !== "audit-result").length === 0
                            ? "No tasks found"
                            : activeStatusFilter === "open" ? "No open tasks — you're all caught up!" : "No completed tasks yet";
                        listWrap.innerHTML = `<div class="${p}-state">
            <span class="${p}-state-icon">${activeStatusFilter === "open" && allTasks.length > 0 ? "✓" : "📋"}</span>
            <strong>${emptyMsg}</strong>
          </div>`;
                        return;
                    }
                    const grouped = new Map();
                    for (const t of tasks) {
                        const key = t.taskType || "__none__";
                        if (!grouped.has(key))
                            grouped.set(key, []);
                        grouped.get(key).push(t);
                    }
                    const orderedKeys = [...grouped.keys()].sort((a, b) => { if (a === "__none__")
                        return 1; if (b === "__none__")
                        return -1; return a.localeCompare(b); });
                    let html = `<div class="${p}-list${introUsed ? "" : " intro"}">`;
                    introUsed = true;
                    for (const key of orderedKeys) {
                        const group = grouped.get(key);
                        const label = key === "__none__" ? "No Type" : key;
                        const color = key === "__none__" ? "var(--gray-lt)" : typeColor(key);
                        html += `<div class="${p}-section-label" style="color:${color}">${esc(label)} <span style="font-weight:400">(${group.length})</span></div>`;
                        for (const task of group)
                            html += renderTaskCard(task);
                    }
                    html += `</div>`;
                    listWrap.innerHTML = html;
                    bindListEvents();
                }
                // ── Audit mode content ────────────────────────────────────────────
                function renderAuditContent() {
                    var _a, _b;
                    if (auditLists.length === 0) {
                        countEl.textContent = "0";
                        listWrap.innerHTML = `<div class="${p}-state"><strong>No audits found</strong>Submit an audit using the Audit Widget to see results here.</div>`;
                        return;
                    }
                    const al = auditLists.find(a => a.listId === activeAuditListId) || auditLists[0];
                    if (!al) {
                        listWrap.innerHTML = `<div class="${p}-state">Select an audit above.</div>`;
                        return;
                    }
                    // Ensure active is set
                    if (!activeAuditListId)
                        activeAuditListId = al.listId;
                    const pa = al.parsedAudit;
                    const passing = (_a = pa === null || pa === void 0 ? void 0 : pa.passing) !== null && _a !== void 0 ? _a : null;
                    const pct = (_b = pa === null || pa === void 0 ? void 0 : pa.score) !== null && _b !== void 0 ? _b : null;
                    const passClass = passing === true ? "pass" : passing === false ? "fail" : "";
                    // Audit summary card
                    const iconStore_ = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                    const iconUser_ = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    const iconCal_ = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                    const iconNote_ = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
                    const scoreColor = passing === true ? "var(--success)" : passing === false ? "var(--error)" : "var(--gray)";
                    const summaryHtml = pa ? `
          <div class="${p}-audit-card ${passClass}" id="${p}-audit-card" role="button" tabindex="0">
            <div style="display:flex;align-items:flex-start;justify-content:space-between">
              <div>
                <div class="${p}-audit-card-score" style="color:${scoreColor}">${pct != null ? pct + "%" : "—"}</div>
                <div style="font-size:13px;font-weight:700;color:${scoreColor};margin-top:3px">${passing === true ? "Passing" : passing === false ? "Failing" : "—"}</div>
              </div>
              <div style="font-size:11px;color:var(--gray-lt);text-align:right;line-height:1.6">
                ${pa.taskCount != null ? `<div style="font-weight:600;color:${scoreColor}">${pa.taskCount} task${pa.taskCount !== 1 ? "s" : ""} flagged</div>` : ""}
              </div>
            </div>
            <div class="${p}-audit-card-meta">
              ${pa.store ? `<span>${iconStore_} ${esc(pa.store)}</span>` : ""}
              ${pa.auditor ? `<span>${iconUser_} ${esc(pa.auditor)}</span>` : ""}
              ${pa.date ? `<span>${iconCal_} ${esc(pa.date)}</span>` : ""}
              ${pa.notes ? `<span style="align-items:flex-start">${iconNote_} <span style="line-height:1.5;font-style:italic">${esc(pa.notes)}</span></span>` : ""}
            </div>
          </div>` : "";
                    // All failure tasks in this audit (excluding system task)
                    const allAuditTasks = allTasks.filter(t => t.listId === al.listId && t.installationId === al.installId && t.taskType !== "audit-result");
                    const isDoneTask = (t) => t.status === "DONE" || t.status === "done" || t.status === "CLOSED";
                    // Split into "mine" vs "other" — uses widget-level currentUserId + userGroupIds
                    const isMyTask = (t) => {
                        if (!currentUserId)
                            return true; // if we have no user info, treat everything as mine
                        const direct = t.assigneeIds.indexOf(currentUserId) !== -1;
                        const grp = t.groupIds.some(gid => userGroupIds.indexOf(gid) !== -1);
                        return direct || grp;
                    };
                    const myTasks = allAuditTasks.filter(t => isMyTask(t));
                    // Other people's tasks are only available when "Show All Tasks" is on.
                    const otherTasks = showAll ? allAuditTasks.filter(t => !isMyTask(t)) : [];
                    const doneMine = myTasks.filter(isDoneTask);
                    const visibleMine = showCompletedAudit ? myTasks : myTasks.filter(t => !isDoneTask(t));
                    const allMyDone = myTasks.length > 0 && doneMine.length === myTasks.length;
                    countEl.textContent = String(visibleMine.length);
                    // "Show completed" toggle header
                    const completedToggleHtml = doneMine.length > 0 ? `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--gray-lt)">
              My tasks (${myTasks.length})
            </span>
            <button id="${p}-audit-toggle" type="button" style="font-size:11px;font-weight:600;color:var(--primary);background:none;border:none;cursor:pointer;padding:3px 7px;border-radius:4px;font-family:inherit;touch-action:manipulation">
              ${showCompletedAudit ? "Hide completed" : "Show completed (" + doneMine.length + ")"}
            </button>
          </div>` :
                        myTasks.length > 0 ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--gray-lt);margin-bottom:10px">My tasks (${myTasks.length})</div>` : "";
                    // Main task list HTML
                    let taskHtml;
                    if (allAuditTasks.length === 0) {
                        taskHtml = `<div style="text-align:center;padding:20px;color:var(--gray-lt);font-size:13px">No failure tasks in this audit.</div>`;
                    }
                    else if (myTasks.length === 0) {
                        taskHtml = `<div style="text-align:center;padding:20px;color:var(--gray-lt);font-size:13px">No tasks assigned to you in this audit.</div>`;
                    }
                    else if (allMyDone && !showCompletedAudit) {
                        taskHtml = `<div style="text-align:center;padding:20px 16px;background:rgba(46,125,74,.06);border:1px solid rgba(46,125,74,.2);border-radius:10px">
            <div style="font-size:22px;margin-bottom:6px">✓</div>
            <div style="font-size:14px;font-weight:700;color:var(--success)">All tasks completed for this audit!</div>
            <div style="font-size:12px;color:var(--gray-lt);margin-top:4px">${doneMine.length} task${doneMine.length !== 1 ? "s" : ""} marked done</div>
          </div>`;
                    }
                    else if (visibleMine.length === 0) {
                        taskHtml = `<div style="text-align:center;padding:20px;color:var(--gray-lt);font-size:13px">No open tasks — all caught up!</div>`;
                    }
                    else {
                        taskHtml = `<div class="${p}-list${introUsed ? "" : " intro"}">${visibleMine.map(t => renderTaskCard(t)).join("")}</div>`;
                        introUsed = true;
                    }
                    // "Other tasks" section (greyed but clickable) — only when Show All is on
                    let otherHtml = "";
                    if (showAll && otherTasks.length > 0) {
                        const iChev = showOtherAuditTasks
                            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
                            : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
                        const ghostCards = otherTasks.map(t => {
                            const card = renderTaskCard(t);
                            // inject ghost class and remove checkbox
                            return card.replace(`class="${p}-card `, `class="${p}-card ghost `).replace(`class="${p}-card"`, `class="${p}-card ghost"`);
                        }).join("");
                        otherHtml = `
            <button id="${p}-other-toggle" type="button" class="${p}-other-toggle">
              ${iChev} ${showOtherAuditTasks ? "Hide" : "Show"} ${otherTasks.length} other task${otherTasks.length !== 1 ? "s" : ""} in this audit
            </button>
            ${showOtherAuditTasks ? `<div class="${p}-list" style="margin-top:8px">${ghostCards}</div>` : ""}`;
                    }
                    listWrap.innerHTML = summaryHtml + completedToggleHtml + taskHtml + otherHtml;
                    // Wire "show completed" toggle
                    const toggleBtn = listWrap.querySelector(`#${p}-audit-toggle`);
                    if (toggleBtn)
                        toggleBtn.addEventListener("click", () => { showCompletedAudit = !showCompletedAudit; renderAuditContent(); });
                    // Wire "other tasks" toggle
                    const otherBtn = listWrap.querySelector(`#${p}-other-toggle`);
                    if (otherBtn)
                        otherBtn.addEventListener("click", () => { showOtherAuditTasks = !showOtherAuditTasks; renderAuditContent(); });
                    // Click the audit summary card → open it in the sidebar with the chart
                    const auditCard = listWrap.querySelector(`#${p}-audit-card`);
                    if (auditCard && pa)
                        auditCard.addEventListener("click", () => openAuditSummary(pa, al.listName || "Audit"));
                    bindListEvents();
                }
                function bindListEvents() {
                    listWrap.querySelectorAll(`.${p}-check`).forEach((btn) => {
                        btn.addEventListener("click", () => toggleTask(btn));
                    });
                    listWrap.querySelectorAll(`.${p}-card`).forEach((card) => {
                        card.addEventListener("click", (e) => {
                            if (e.target.closest(`.${p}-check-wrap`))
                                return;
                            const taskId = card.dataset.taskId;
                            const task = allTasks.find(t => t.id === taskId);
                            if (task)
                                openDetail(task);
                        });
                    });
                }
                // ── Task card ─────────────────────────────────────────────────────
                function renderTaskCard(task) {
                    const isDone = task.status === "DONE" || task.status === "done" || task.status === "CLOSED";
                    const dueInfo = formatDate(task.dueDate);
                    const desc = task.description ? esc(stripTypeTag(task.description)) : "";
                    const typeCol = task.taskType ? typeColor(task.taskType) : "";
                    const typeText = task.taskType ? contrastColor(typeCol) : "";
                    const isCrit = (task.auditSeverity || "").toLowerCase() === "critical";
                    const prioCol = isCrit ? "#9B1C2E" : priorityColor(task.priority);
                    const prioLbl = isCrit ? "Critical" : priorityLabel(task.priority);
                    const typeBadge = task.taskType ? `<span class="${p}-type-badge" style="background:${typeCol};color:${typeText}">${esc(task.taskType)}</span>` : "";
                    const prioBadge = (isCrit || (task.priority && task.priority !== "Priority_3")) ? `<span class="${p}-prio-badge${isCrit ? " crit" : ""}" style="color:${prioCol};border-color:${prioCol}">${prioLbl}</span>` : "";
                    const iconCal = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                    const iconStore = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                    const iconList = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
                    const iconGroup = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
                    const iconCheck = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    // Group names
                    const groupNames = task.groupIds.map(gid => groupName(gid)).filter(Boolean);
                    return `
          <div class="${p}-card ${isDone ? "done" : ""}" data-task-id="${esc(task.id)}" data-install-id="${esc(task.installationId)}">
            <div class="${p}-card-inner">
              <div class="${p}-check-wrap">
                <div class="${p}-check ${isDone ? "checked" : ""}"
                     data-task-id="${esc(task.id)}" data-install-id="${esc(task.installationId)}" data-status="${esc(task.status)}"
                     title="${isDone ? "Mark as open" : "Mark as done"}">
                  <span class="${p}-check-icon">${iconCheck}</span>
                </div>
              </div>
              <div class="${p}-card-body">
                <div class="${p}-card-top">${typeBadge}${prioBadge}</div>
                <div class="${p}-card-title"><span>${esc(task.title)}</span></div>
                ${desc ? `<div class="${p}-card-desc">${desc}</div>` : ""}
                <div class="${p}-card-meta">
                  ${dueInfo.text ? `<span class="${p}-meta-item ${dueInfo.overdue && !isDone ? "overdue" : ""}">${iconCal} ${dueInfo.overdue && !isDone ? "Overdue: " : ""}${dueInfo.text}</span>` : ""}
                  ${task.installationTitle ? `<span class="${p}-meta-item">${iconStore} ${esc(task.installationTitle)}</span>` : ""}
                  ${task.listName ? `<span class="${p}-meta-item">${iconList} ${esc(task.listName)}</span>` : ""}
                  ${groupNames.map(gn => `<span class="${p}-meta-item">${iconGroup} ${esc(gn)}</span>`).join("")}
                </div>
              </div>
            </div>
          </div>`;
                }
                // ── Detail panel ──────────────────────────────────────────────────
                let detailTask = null;
                let detailAudit = null; // when the panel shows an audit summary instead of a task
                let detailAssignTab = "group";
                function openDetail(task) {
                    detailTask = task;
                    detailAudit = null;
                    detailAssignTab = "group";
                    const isWide = container.offsetWidth >= 520;
                    detailEl.classList.toggle("side", isWide);
                    detailEl.classList.remove("audit-view");
                    renderDetailContent(task);
                    overlayEl.classList.add("open");
                    requestAnimationFrame(() => detailEl.classList.add("open"));
                }
                // Open the audit summary in the same sidebar/sheet, with an animated
                // category breakdown chart.
                function openAuditSummary(pa, label) {
                    detailAudit = pa;
                    detailTask = null;
                    const isWide = container.offsetWidth >= 520;
                    detailEl.classList.toggle("side", isWide);
                    detailEl.classList.add("audit-view"); // hides the task footer
                    renderAuditSummaryDetail(pa, label);
                    overlayEl.classList.add("open");
                    requestAnimationFrame(() => detailEl.classList.add("open"));
                }
                function renderAuditSummaryDetail(pa, label) {
                    var _a, _b;
                    const passing = (_a = pa === null || pa === void 0 ? void 0 : pa.passing) !== null && _a !== void 0 ? _a : null;
                    const pct = (_b = pa === null || pa === void 0 ? void 0 : pa.score) !== null && _b !== void 0 ? _b : null;
                    const scoreColor = passing === true ? "var(--success)" : passing === false ? "var(--error)" : "var(--gray)";
                    detailBadges.innerHTML = `<span class="${p}-prio-badge" style="color:${scoreColor};border-color:${scoreColor}">${passing === true ? "Passing" : passing === false ? "Failing" : "—"}</span>`;
                    const cats = (pa === null || pa === void 0 ? void 0 : pa.categories) && typeof pa.categories === "object" ? Object.keys(pa.categories) : [];
                    const iCal2 = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                    const iStore2 = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                    const iUser2 = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    const bars = cats.map((name, i) => {
                        const c = pa.categories[name];
                        const v = Math.max(0, Math.min(100, (c === null || c === void 0 ? void 0 : c.pct) != null ? c.pct : ((c === null || c === void 0 ? void 0 : c.total) ? Math.round((c.earned / c.total) * 100) : 0)));
                        const tier = v >= 80 ? "hi" : v >= 50 ? "mid" : "lo";
                        const detail = c && c.total != null ? `${c.earned}/${c.total}` : "";
                        return `<div class="${p}-cat-row">
            <div class="${p}-cat-top"><span class="${p}-cat-name">${esc(name)}</span><span class="${p}-cat-pct">${detail ? `<span style="color:var(--gray-lt);font-weight:500;margin-right:6px">${detail}</span>` : ""}${v}%</span></div>
            <div class="${p}-cat-bar"><span class="${p}-cat-fill ${tier}" data-pct="${v}" style="width:0;transition-delay:${i * 60}ms"></span></div>
          </div>`;
                    }).join("");
                    detailBody.innerHTML = `
          <div class="${p}-detail-title">${esc(label.replace(/^Audit\s*[—–-]\s*/i, "").trim() || label)}</div>
          <div class="${p}-audit-detail-score" style="color:${scoreColor}">${pct != null ? pct + "%" : "—"}</div>
          <div class="${p}-audit-detail-sub" style="color:${scoreColor}">${passing === true ? "Passing" : passing === false ? "Failing" : "Not scored"}</div>
          <div class="${p}-detail-meta" style="margin-bottom:18px">
            ${(pa === null || pa === void 0 ? void 0 : pa.store) ? `<div class="${p}-detail-meta-row">${iStore2} ${esc(pa.store)}</div>` : ""}
            ${(pa === null || pa === void 0 ? void 0 : pa.auditor) ? `<div class="${p}-detail-meta-row">${iUser2} ${esc(pa.auditor)}</div>` : ""}
            ${(pa === null || pa === void 0 ? void 0 : pa.date) ? `<div class="${p}-detail-meta-row">${iCal2} ${esc(pa.date)}</div>` : ""}
            ${(pa === null || pa === void 0 ? void 0 : pa.taskCount) != null ? `<div class="${p}-detail-meta-row">${iClip} ${pa.taskCount} task${pa.taskCount !== 1 ? "s" : ""} flagged</div>` : ""}
          </div>
          ${(pa === null || pa === void 0 ? void 0 : pa.notes) ? `<div class="${p}-detail-desc-label">Notes</div><div class="${p}-detail-desc" style="margin-bottom:18px">${esc(pa.notes)}</div>` : ""}
          ${cats.length ? `<div class="${p}-detail-desc-label">Category breakdown</div><div class="${p}-cat-chart">${bars}</div>` : ""}
        `;
                    const reduceMotion = (() => { try {
                        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                    }
                    catch (_) {
                        return false;
                    } })();
                    // Animate the bars from 0 → their value once laid out.
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        detailBody.querySelectorAll(`.${p}-cat-fill`).forEach(el => {
                            el.style.width = (el.dataset.pct || "0") + "%";
                        });
                    }));
                    // Count the score up from 0 → pct.
                    const scoreEl = detailBody.querySelector(`.${p}-audit-detail-score`);
                    if (scoreEl && pct != null && !reduceMotion) {
                        const target = pct, dur = 750, t0 = performance.now();
                        scoreEl.textContent = "0%";
                        const tick = (now) => {
                            if (detailAudit !== pa)
                                return; // panel changed
                            const k = Math.min(1, (now - t0) / dur);
                            const eased = 1 - Math.pow(1 - k, 3);
                            scoreEl.textContent = Math.round(eased * target) + "%";
                            if (k < 1)
                                requestAnimationFrame(tick);
                        };
                        requestAnimationFrame(tick);
                    }
                }
                function closeDetail() {
                    overlayEl.classList.remove("open");
                    detailEl.classList.remove("open");
                    detailEl.style.bottom = "";
                    detailTask = null;
                    detailAudit = null;
                }
                detailEl.addEventListener("click", e => e.stopPropagation());
                // Lift the bottom-sheet above the on-screen keyboard (mobile). Pinning to
                // bottom:0 puts the composer behind the keyboard and it can't scroll past
                // its own end, so we raise the whole sheet by the keyboard height instead.
                const vv = window.visualViewport;
                const onViewport = () => {
                    if ((!detailTask && !detailAudit) || detailEl.classList.contains("side")) {
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
                    self._mtwVV = onViewport;
                }
                // Parse an audit-generated description into structured fields.
                // Matches the format produced by the audit widget:
                //   Audit finding: EXT-007 — Building exterior walls are clean
                //   Audit: Audit — May 28, 2026 9:12 AM
                //   Auditor: Nicole Adams
                function parseAuditFinding(desc) {
                    const lines = desc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    let code = "", finding = "", audit = "", auditor = "";
                    for (const ln of lines) {
                        let m;
                        if ((m = ln.match(/^Audit finding:\s*(.+)$/i))) {
                            const rest = m[1].trim();
                            const d = rest.match(/^([A-Za-z0-9][\w.-]*)\s*[—–-]\s*(.+)$/);
                            if (d) {
                                code = d[1];
                                finding = d[2].trim();
                            }
                            else {
                                finding = rest;
                            }
                        }
                        else if ((m = ln.match(/^Audit:\s*(.+)$/i))) {
                            audit = m[1].trim();
                        }
                        else if ((m = ln.match(/^Auditor:\s*(.+)$/i))) {
                            auditor = m[1].trim();
                        }
                    }
                    if (!finding && !audit && !auditor)
                        return null;
                    return { code, finding, audit, auditor };
                }
                function renderDetailContent(task) {
                    const isDone = task.status === "DONE" || task.status === "done" || task.status === "CLOSED";
                    const dueInfo = formatDate(task.dueDate);
                    const typeCol = task.taskType ? typeColor(task.taskType) : "";
                    const typeText = task.taskType ? contrastColor(typeCol) : "";
                    const isCrit = (task.auditSeverity || "").toLowerCase() === "critical";
                    const prioCol = isCrit ? "#9B1C2E" : priorityColor(task.priority);
                    const prioLbl = isCrit ? "Critical" : priorityLabel(task.priority);
                    const cleanDesc = task.description ? stripTypeTag(task.description).trim() : "";
                    detailBadges.innerHTML = `
          ${task.taskType ? `<span class="${p}-type-badge" style="background:${typeCol};color:${typeText}">${esc(task.taskType)}</span>` : ""}
          ${(isCrit || (task.priority && task.priority !== "Priority_3")) ? `<span class="${p}-prio-badge${isCrit ? " crit" : ""}" style="color:${prioCol};border-color:${prioCol}">${prioLbl}</span>` : ""}`;
                    const iCal = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                    const iStore = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                    const iList = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
                    const iGroup = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
                    const iUser = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    // Assignee section: group vs person tabs (only shown when there are groups or assignees)
                    const hasGroup = task.groupIds.length > 0;
                    const hasAssignee = task.assigneeIds.length > 0;
                    const showAssignTabs = (hasGroup || hasAssignee) && auditMode;
                    let assigneeHtml = "";
                    if (hasGroup || hasAssignee) {
                        if (showAssignTabs) {
                            const groupNames = task.groupIds.map(gid => groupName(gid)).filter(Boolean);
                            const groupHtml = groupNames.map(gn => `<div class="${p}-detail-meta-row">${iGroup} ${esc(gn)}</div>`).join("") || "<div style='font-size:12px;color:var(--gray-lt)'>No group assigned</div>";
                            const personHtml = task.assigneeIds.length > 0 ? task.assigneeIds.map(aid => `<div class="${p}-detail-meta-row" data-uid="${esc(aid)}">${iUser} <span>${esc(aid)}</span></div>`).join("") : "<div style='font-size:12px;color:var(--gray-lt)'>No individual assignee</div>";
                            assigneeHtml = `
              <div class="${p}-assign-tabs" id="${p}-assign-tabs-${instId}">
                <button type="button" class="${p}-assign-tab${detailAssignTab === "group" ? " active" : ""}" data-tab="group">Group</button>
                <button type="button" class="${p}-assign-tab${detailAssignTab === "person" ? " active" : ""}" data-tab="person">Person</button>
              </div>
              <div id="${p}-assign-content-${instId}">
                ${detailAssignTab === "group" ? groupHtml : personHtml}
              </div>`;
                        }
                        else {
                            const groupNames = task.groupIds.map(gid => groupName(gid)).filter(Boolean);
                            assigneeHtml = groupNames.map(gn => `<div class="${p}-detail-meta-row">${iGroup} ${esc(gn)}</div>`).join("");
                        }
                    }
                    detailBody.innerHTML = `
          <div class="${p}-detail-title ${isDone ? "done" : ""}">${esc(task.title)}</div>
          <div class="${p}-detail-meta">
            ${dueInfo.text ? `<div class="${p}-detail-meta-row ${dueInfo.overdue && !isDone ? "overdue" : ""}">${iCal}${dueInfo.overdue && !isDone ? "Overdue · " : "Due "}${dueInfo.text}</div>` : ""}
            ${task.installationTitle ? `<div class="${p}-detail-meta-row">${iStore} ${esc(task.installationTitle)}</div>` : ""}
            ${task.listName ? `<div class="${p}-detail-meta-row">${iList} ${esc(task.listName)}</div>` : ""}
            ${assigneeHtml}
            ${auditMode && allowAssign ? `<div class="${p}-reassign" id="${p}-reassign-${instId}">
              <button type="button" class="${p}-reassign-btn" data-act="open"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> ${(task.groupIds.length || task.assigneeIds.length) ? "Reassign" : "Assign"}</button>
              <div class="${p}-reassign-pop" style="display:none">
                <input type="text" class="${p}-reassign-search" placeholder="Search people or groups…">
                <div class="${p}-reassign-results"></div>
              </div>
            </div>` : ""}
          </div>
          ${(() => {
                        const af = auditMode && cleanDesc ? parseAuditFinding(cleanDesc) : null;
                        if (af) {
                            return `<div class="${p}-detail-desc-label">Audit Finding</div>
                <div class="${p}-af">
                  ${af.code ? `<span class="${p}-af-code">${esc(af.code)}</span>` : ""}
                  ${af.finding ? `<div class="${p}-af-finding">${esc(af.finding)}</div>` : ""}
                  <div class="${p}-af-pills">
                    ${af.audit ? `<span class="${p}-af-pill">${iCal}<span>${esc(af.audit)}</span></span>` : ""}
                    ${af.auditor ? `<span class="${p}-af-pill">${iUser}<span>${esc(af.auditor)}</span></span>` : ""}
                  </div>
                </div>`;
                        }
                        return cleanDesc
                            ? `<div class="${p}-detail-desc-label">Description</div><div class="${p}-detail-desc">${esc(cleanDesc)}</div>`
                            : `<div class="${p}-detail-desc empty">No description</div>`;
                    })()}
          <div class="${p}-att">
            <div class="${p}-att-head">
              <span class="${p}-att-label">Attachments</span>
              <label class="${p}-att-add" id="${p}-att-add-${instId}" for="${p}-att-input-${instId}">${iClip} Add</label>
            </div>
            <div class="${p}-att-grid" id="${p}-att-grid-${instId}"></div>
            <input type="file" multiple class="${p}-cmt-file" id="${p}-att-input-${instId}">
          </div>
          ${enableComments ? `
          <div class="${p}-cmt">
            <div class="${p}-att-head"><span class="${p}-att-label">Comments</span></div>
            <div class="${p}-cmt-list" id="${p}-cmt-list-${instId}"></div>
            <div class="${p}-cmt-compose">
              <span class="${p}-cmt-av-slot" id="${p}-cmt-me-${instId}"><span class="${p}-cmt-av ${p}-cmt-av-fb">·</span></span>
              <div class="${p}-cmt-field">
                <textarea class="${p}-cmt-input" id="${p}-cmt-input-${instId}" rows="2" placeholder="Add a comment…"></textarea>
                <div class="${p}-cmt-chips" id="${p}-cmt-chips-${instId}"></div>
                <div class="${p}-cmt-bar" id="${p}-cmt-bar-${instId}">
                  <label class="${p}-cmt-attach" id="${p}-cmt-attach-${instId}" for="${p}-cmt-file-${instId}" title="Attach file">${iClip}</label>
                  <button type="button" class="${p}-cmt-send" id="${p}-cmt-send-${instId}">${iSend} Send</button>
                </div>
                <input type="file" multiple class="${p}-cmt-file" id="${p}-cmt-file-${instId}">
              </div>
            </div>
          </div>` : ""}
        `;
                    renderAttachments(task);
                    // Resolve assignee IDs → names (shown in the Person tab).
                    detailBody.querySelectorAll(`.${p}-detail-meta-row[data-uid]`).forEach(row => {
                        const uid = row.dataset.uid || "";
                        fetchUser(uid).then(u => { const s = row.querySelector("span"); if (s && u.name)
                            s.textContent = u.name; });
                    });
                    // Reassign control (audit mode + allowtaskassignment)
                    if (auditMode && allowAssign)
                        wireReassign(task);
                    if (enableComments) {
                        renderComments(task);
                        // Current user's avatar next to the composer.
                        if (currentUserId)
                            fetchUser(currentUserId).then(me => {
                                if (detailTask !== task)
                                    return;
                                const slot = detailBody.querySelector(`#${p}-cmt-me-${instId}`);
                                if (slot)
                                    slot.innerHTML = avatarHtml(me);
                            });
                        const cInput = detailBody.querySelector(`#${p}-cmt-input-${instId}`);
                        const cSend = detailBody.querySelector(`#${p}-cmt-send-${instId}`);
                        const cBar = detailBody.querySelector(`#${p}-cmt-bar-${instId}`);
                        const cAttach = detailBody.querySelector(`#${p}-cmt-attach-${instId}`);
                        const cFile = detailBody.querySelector(`#${p}-cmt-file-${instId}`);
                        const cChips = detailBody.querySelector(`#${p}-cmt-chips-${instId}`);
                        // Files attached to the comment-in-progress (also become task attachments).
                        const pending = [];
                        const hasContent = () => !!((cInput === null || cInput === void 0 ? void 0 : cInput.value.trim()) || pending.length);
                        // Bar (attach + send) shows on focus or when there's content; Send shows only with content.
                        const updateSendVisibility = () => {
                            if (cBar)
                                cBar.classList.toggle("show", document.activeElement === cInput || hasContent());
                            if (cSend)
                                cSend.classList.toggle("show", hasContent());
                        };
                        // Only do the keyboard avoidance on touch devices — on desktop there's
                        // no on-screen keyboard, so the extra padding/scroll is unwanted.
                        const isTouch = (() => { try {
                            return window.matchMedia("(pointer:coarse)").matches;
                        }
                        catch (_) {
                            return "ontouchstart" in window;
                        } })();
                        cInput === null || cInput === void 0 ? void 0 : cInput.addEventListener("focus", () => {
                            cBar === null || cBar === void 0 ? void 0 : cBar.classList.add("show");
                            if (!isTouch)
                                return;
                            // The composer is the last element, so there's nothing below it to
                            // scroll into — add temporary room so it can clear the keyboard, then
                            // scroll it into the visible (keyboard-reduced) viewport.
                            detailBody.style.paddingBottom = "55vh";
                            setTimeout(() => cInput.scrollIntoView({ block: "center", behavior: "smooth" }), 350);
                        });
                        cInput === null || cInput === void 0 ? void 0 : cInput.addEventListener("blur", () => { setTimeout(() => { if (isTouch)
                            detailBody.style.paddingBottom = ""; if (!hasContent())
                            cBar === null || cBar === void 0 ? void 0 : cBar.classList.remove("show"); }, 200); });
                        // Send keeps textarea focus until its click fires; attach is a <label for>
                        // that opens the picker natively (reliable on mobile, no input.click()).
                        cSend === null || cSend === void 0 ? void 0 : cSend.addEventListener("mousedown", e => e.preventDefault());
                        const renderChips = () => {
                            if (!cChips)
                                return;
                            cChips.innerHTML = pending.map((f, i) => `<span class="${p}-cmt-chip"><span>${esc(f.name)}</span><button type="button" data-idx="${i}">${iXsmall}</button></span>`).join("");
                            cChips.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
                                const idx = parseInt(b.dataset.idx || "-1", 10);
                                if (idx >= 0) {
                                    pending.splice(idx, 1);
                                    renderChips();
                                    updateSendVisibility();
                                }
                            }));
                        };
                        // Auto-grow textarea + reveal Send when there's text or attachments.
                        cInput === null || cInput === void 0 ? void 0 : cInput.addEventListener("input", () => {
                            cInput.style.height = "auto";
                            cInput.style.height = Math.min(cInput.scrollHeight, 140) + "px";
                            updateSendVisibility();
                        });
                        cFile === null || cFile === void 0 ? void 0 : cFile.addEventListener("change", () => __awaiter(this, void 0, void 0, function* () {
                            const files = Array.from(cFile.files || []);
                            cFile.value = "";
                            if (!files.length)
                                return;
                            const tooBig = files.find(f => f.size > MEDIA_MAX);
                            if (tooBig) {
                                showBanner("error", `"${tooBig.name}" exceeds ${humanSize(MEDIA_MAX)}.`);
                                return;
                            }
                            if (cAttach)
                                cAttach.disabled = true;
                            try {
                                for (const f of files) {
                                    const m = yield uploadMedia(f);
                                    pending.push({ id: m.id, url: m.url, name: f.name });
                                }
                                hideBanner();
                            }
                            catch (e) {
                                showBanner("error", `Upload failed: ${e.message}`);
                            }
                            if (cAttach)
                                cAttach.disabled = false;
                            renderChips();
                            updateSendVisibility();
                        }));
                        const submit = () => __awaiter(this, void 0, void 0, function* () {
                            const text = ((cInput === null || cInput === void 0 ? void 0 : cInput.value) || "").trim();
                            if ((!text && !pending.length) || !cSend || !cInput)
                                return;
                            cSend.disabled = true;
                            cInput.disabled = true;
                            let ok = false;
                            try {
                                const tokens = pending.map(f => `[attachment:${f.id}]`).join(" ");
                                const full = [text, tokens].filter(Boolean).join(text && tokens ? "\n" : "");
                                yield postComment(task, full);
                                // Also attach the files to the task itself (so they appear in Attachments).
                                if (pending.length) {
                                    const next = [...(task.attachmentIds || []), ...pending.map(f => f.id)];
                                    try {
                                        yield fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: next }) }));
                                        task.attachmentIds = next;
                                        renderAttachments(task);
                                    }
                                    catch (_) { }
                                }
                                cInput.value = "";
                                cInput.style.height = "auto";
                                pending.length = 0;
                                renderChips();
                                cSend === null || cSend === void 0 ? void 0 : cSend.classList.remove("show");
                                cBar === null || cBar === void 0 ? void 0 : cBar.classList.remove("show");
                                hideBanner();
                                yield renderComments(task);
                                ok = true;
                            }
                            catch (e) {
                                showBanner("error", `Couldn't post comment: ${e.message}`);
                            }
                            cSend.disabled = false;
                            cInput.disabled = false;
                            // On success, blur so the mobile keyboard dismisses; on failure keep
                            // focus so they can retry without re-tapping the field.
                            if (ok)
                                cInput.blur();
                            else
                                cInput.focus();
                        });
                        cSend === null || cSend === void 0 ? void 0 : cSend.addEventListener("click", submit);
                        cInput === null || cInput === void 0 ? void 0 : cInput.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                            submit(); });
                    }
                    // ── Attachment add / upload ────────────────────────────────────
                    const attAdd = detailBody.querySelector(`#${p}-att-add-${instId}`);
                    const attInput = detailBody.querySelector(`#${p}-att-input-${instId}`);
                    if (attAdd && attInput) {
                        // attAdd is a <label for> → opens the picker natively (mobile-reliable).
                        attInput.addEventListener("change", () => __awaiter(this, void 0, void 0, function* () {
                            const files = Array.from(attInput.files || []);
                            attInput.value = "";
                            if (!files.length)
                                return;
                            const oversize = files.find(f => f.size > MEDIA_MAX);
                            if (oversize) {
                                showBanner("error", `"${oversize.name}" exceeds ${humanSize(MEDIA_MAX)}.`);
                                return;
                            }
                            attAdd.disabled = true;
                            attAdd.innerHTML = `<span class="${p}-spin" style="width:12px;height:12px;border-width:2px"></span> Uploading…`;
                            try {
                                const ids = [];
                                for (const f of files) {
                                    const m = yield uploadMedia(f);
                                    ids.push(m.id);
                                }
                                const next = [...(task.attachmentIds || []), ...ids];
                                const res = yield fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ attachmentIds: next }) }));
                                if (!res.ok)
                                    throw new Error(`HTTP ${res.status}`);
                                task.attachmentIds = next;
                                hideBanner();
                            }
                            catch (e) {
                                showBanner("error", `Upload failed: ${e.message}`);
                            }
                            attAdd.disabled = false;
                            attAdd.innerHTML = `${iClip} Add`;
                            renderAttachments(task);
                        }));
                    }
                    // Wire assignee tab switch
                    detailBody.querySelectorAll(`.${p}-assign-tab`).forEach(btn => {
                        btn.addEventListener("click", () => {
                            detailAssignTab = btn.dataset.tab;
                            if (detailTask)
                                renderDetailContent(detailTask);
                        });
                    });
                    const iconCheck = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    const iconUndo = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`;
                    if (isDone) {
                        detailToggle.className = `${p}-detail-toggle-btn open-btn`;
                        detailToggle.innerHTML = `${iconUndo} Reopen task`;
                    }
                    else {
                        detailToggle.className = `${p}-detail-toggle-btn done-btn`;
                        detailToggle.innerHTML = `${iconCheck} Mark as done`;
                    }
                }
                overlayEl.addEventListener("click", closeDetail);
                detailClose.addEventListener("click", e => { e.stopPropagation(); closeDetail(); });
                const onDocKey = (e) => { if (e.key === "Escape" && (detailTask || detailAudit))
                    closeDetail(); };
                document.addEventListener("keydown", onDocKey);
                self._mtwDocKey = onDocKey;
                detailToggle.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                    if (!detailTask)
                        return;
                    const task = detailTask;
                    const isDone = task.status === "DONE" || task.status === "done" || task.status === "CLOSED";
                    const newStatus = isDone ? "OPEN" : "CLOSED";
                    detailToggle.disabled = true;
                    try {
                        const res = yield fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ status: newStatus }) }));
                        if (!res.ok)
                            throw new Error(`HTTP ${res.status}`);
                        task.status = newStatus;
                        renderDetailContent(task);
                        const cardEl = listWrap.querySelector(`[data-task-id="${task.id}"]`);
                        if (cardEl) {
                            if (!isDone)
                                cardEl.classList.add("done");
                            else
                                cardEl.classList.remove("done");
                        }
                        setTimeout(() => { if (!auditMode) {
                            renderTypeFilters();
                            renderList();
                        }
                        else
                            renderList(); }, 380);
                    }
                    catch (e) {
                        showBanner("error", `Could not update: ${e.message}`);
                    }
                    detailToggle.disabled = false;
                }));
                // ── Sparkle burst ─────────────────────────────────────────────────
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
                // ── Toggle task status ────────────────────────────────────────────
                function toggleTask(checkEl) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const taskId = checkEl.dataset.taskId;
                        const installId = checkEl.dataset.installId;
                        const currentStatus = checkEl.dataset.status;
                        const isDone = currentStatus === "DONE" || currentStatus === "done" || currentStatus === "CLOSED";
                        const newStatus = isDone ? "OPEN" : "CLOSED";
                        const cardEl = checkEl.closest(`.${p}-card`);
                        const wrap = checkEl.closest(`.${p}-check-wrap`);
                        checkEl.style.pointerEvents = "none";
                        checkEl.classList.remove("pop-done", "pop-undone");
                        void checkEl.offsetWidth;
                        checkEl.classList.add(isDone ? "pop-undone" : "pop-done");
                        if (!isDone) {
                            checkEl.classList.add("checked");
                            if (cardEl)
                                cardEl.classList.add("done");
                            if (wrap)
                                spawnSparks(wrap, primaryColor);
                        }
                        else {
                            checkEl.classList.remove("checked");
                            if (cardEl)
                                cardEl.classList.remove("done");
                        }
                        try {
                            const res = yield fetch(`${baseUrl}/tasks/${installId}/task/${taskId}`, Object.assign(Object.assign({ method: "PATCH" }, apiOpts()), { body: JSON.stringify({ status: newStatus }) }));
                            if (!res.ok)
                                throw new Error(`HTTP ${res.status}`);
                            const task = allTasks.find(t => t.id === taskId);
                            if (task)
                                task.status = newStatus;
                            setTimeout(() => { if (!auditMode) {
                                renderTypeFilters();
                                renderList();
                            }
                            else
                                renderList(); }, 420);
                        }
                        catch (e) {
                            if (!isDone) {
                                checkEl.classList.remove("checked");
                                if (cardEl)
                                    cardEl.classList.remove("done");
                            }
                            else {
                                checkEl.classList.add("checked");
                                if (cardEl)
                                    cardEl.classList.add("done");
                            }
                            showBanner("error", `Could not update task: ${e.message}`);
                            checkEl.style.pointerEvents = "";
                        }
                    });
                }
                // ── Status filter ─────────────────────────────────────────────────
                if (!auditMode) {
                    container.querySelectorAll(`.${p}-status-opt`).forEach((btn) => {
                        btn.addEventListener("click", () => {
                            container.querySelectorAll(`.${p}-status-opt`).forEach((b) => b.classList.remove("active"));
                            btn.classList.add("active");
                            activeStatusFilter = btn.dataset.status || "open";
                            renderList();
                        });
                    });
                }
                // ── Load data ─────────────────────────────────────────────────────
                function load() {
                    return __awaiter(this, void 0, void 0, function* () {
                        var _a, _b, _c, _d, _e, _f;
                        refreshBtn.disabled = true;
                        refreshBtn.innerHTML = `<span class="${p}-spin" style="width:14px;height:14px;border-width:2px"></span>`;
                        hideBanner();
                        allTasks = [];
                        auditLists = [];
                        activeAuditListId = "";
                        activeInstallFilter = "all";
                        activeTypeFilters.clear();
                        dropdownOpen = false;
                        listWrap.innerHTML = `<div class="${p}-state"><span class="${p}-spin" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px;display:block"></span>Loading…</div>`;
                        try {
                            // Fetch installations
                            const instRes = yield fetch(`${baseUrl}/installations?limit=200`, apiOpts());
                            if (!instRes.ok)
                                throw new Error(`Could not load installations (HTTP ${instRes.status})`);
                            const instData = yield instRes.json();
                            const installations = (instData.data || instData)
                                .filter((i) => i.pluginID === "tasks" || i.pluginId === "tasks")
                                .map((i) => { var _a, _b, _c; return ({ id: i.id, title: ((_c = (_b = (_a = i.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || i.title || i.name || i.id }); });
                            allInstalls = installations; // expose for task creation
                            if (!installations.length) {
                                listWrap.innerHTML = `<div class="${p}-state"><strong>No task spaces found</strong>Make sure at least one Tasks installation exists.</div>`;
                                return;
                            }
                            // Fetch current user (always — needed for "other tasks" split in audit mode)
                            try {
                                const profile = yield widgetApi.getUserInformation();
                                currentUserId = profile.id || "";
                                userGroupIds = profile.groupIDs || [];
                                dlog("user", currentUserId, "groups", userGroupIds.length);
                            }
                            catch (e) {
                                dlog("getUserInformation failed", (e === null || e === void 0 ? void 0 : e.message) || String(e));
                            }
                            // Fetch groups → build groupMap (search endpoint + /groups supplement)
                            try {
                                const [searchRes, legacyRes] = yield Promise.all([
                                    fetch(`${baseUrl}/groups/search?limit=100&sort=name_ASC`, apiOpts()),
                                    fetch(`${baseUrl}/groups?limit=200`, apiOpts()),
                                ]);
                                const seen = new Set();
                                if (searchRes.ok) {
                                    const d = yield searchRes.json();
                                    const parseEntry = (e) => { var _a, _b, _c, _d, _e, _f; const inner = e.data || e; return { id: inner.id, name: ((_c = (_b = (_a = inner.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.name) || ((_f = (_e = (_d = inner.config) === null || _d === void 0 ? void 0 : _d.localization) === null || _e === void 0 ? void 0 : _e.en_US) === null || _f === void 0 ? void 0 : _f.title) || inner.name || inner.id }; };
                                    for (const e of (d.entries || d.data || d.results || d.items || (Array.isArray(d) ? d : []))) {
                                        const { id, name } = parseEntry(e);
                                        if (id && name && !seen.has(id)) {
                                            groupMap.set(id, name);
                                            seen.add(id);
                                        }
                                    }
                                }
                                if (legacyRes.ok) {
                                    const gd = yield legacyRes.json();
                                    for (const g of (gd.data || [])) {
                                        const name = ((_c = (_b = (_a = g.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) || ((_f = (_e = (_d = g.config) === null || _d === void 0 ? void 0 : _d.localization) === null || _e === void 0 ? void 0 : _e.en_US) === null || _f === void 0 ? void 0 : _f.name) || g.name || g.id;
                                        if (g.id && name && !seen.has(g.id)) {
                                            groupMap.set(g.id, name);
                                            seen.add(g.id);
                                        }
                                    }
                                }
                            }
                            catch (_) { }
                            // Fetch tasks per installation
                            for (const inst of installations) {
                                try {
                                    const listRes = yield fetch(`${baseUrl}/tasks/${inst.id}/lists`, apiOpts());
                                    const listMap = new Map();
                                    const listIds = [];
                                    if (listRes.ok) {
                                        const listsRaw = yield listRes.json();
                                        const lists = Array.isArray(listsRaw) ? listsRaw : (listsRaw.data || []);
                                        for (const l of lists) {
                                            listMap.set(l.id, l.name || "");
                                            if (l.id)
                                                listIds.push(l.id);
                                        }
                                        listsByInst.set(inst.id, lists.map((l) => ({ id: l.id, name: l.name || l.id })));
                                    }
                                    const perList = yield Promise.all(listIds.map(lid => fetch(`${baseUrl}/tasks/${inst.id}/task?listId=${lid}`, apiOpts())
                                        .then(r => r.ok ? r.json() : null).catch(() => null)));
                                    const seen = new Set();
                                    for (const result of perList) {
                                        if (!result)
                                            continue;
                                        const arr = Array.isArray(result) ? result : (result.data || []);
                                        for (const t of arr) {
                                            if (!t.id || seen.has(t.id))
                                                continue;
                                            if (!showAll && currentUserId && !auditMode) {
                                                // In normal mode: only include tasks assigned to current user/groups
                                                const assigneeIds = t.assigneeIds || [];
                                                const taskGroupIds = t.groupIds || [];
                                                const taskType_ = parseTaskType(t.title || "") || parseTaskType(t.description || "");
                                                if (taskType_ !== "audit-result") {
                                                    const directMatch = assigneeIds.indexOf(currentUserId) !== -1;
                                                    const groupMatch = taskGroupIds.some((gid) => userGroupIds.indexOf(gid) !== -1);
                                                    if (!directMatch && !groupMatch)
                                                        continue;
                                                }
                                            }
                                            // In auditMode: always load all tasks — "mine" vs "other" split happens at render time
                                            seen.add(t.id);
                                            const desc = t.description || "";
                                            const lname = t.taskListId ? (listMap.get(t.taskListId) || "") : "";
                                            let taskType = parseTaskType(t.title || "") || parseTaskType(desc);
                                            // Audit-generated tasks have no [type] tag — surface them as an
                                            // "Audit" type so they're filterable in the normal (non-audit) view.
                                            if (!taskType && (/^\s*Audit finding:/i.test(desc) || /^\s*Audit\s*[—–-]/i.test(lname)))
                                                taskType = "Audit";
                                            const sevM = desc.match(/(?:^|\n)\s*Severity:\s*([A-Za-z]+)/i);
                                            allTasks.push({
                                                id: t.id, title: t.title || "(no title)", description: desc,
                                                status: t.status || "OPEN", priority: t.priority || "Priority_3",
                                                dueDate: t.dueDate || null, taskType,
                                                installationId: inst.id, installationTitle: inst.title,
                                                listId: t.taskListId || "",
                                                listName: lname,
                                                groupIds: t.groupIds || [], assigneeIds: t.assigneeIds || [],
                                                attachmentIds: t.attachmentIds || [],
                                                auditSeverity: sevM ? sevM[1] : undefined,
                                            });
                                        }
                                    }
                                }
                                catch (_) { }
                            }
                            // Sort: open first, then by due date
                            allTasks.sort((a, b) => {
                                const aDone = a.status === "DONE" || a.status === "done" || a.status === "CLOSED";
                                const bDone = b.status === "DONE" || b.status === "done" || b.status === "CLOSED";
                                if (aDone !== bDone)
                                    return aDone ? 1 : -1;
                                if (a.dueDate && b.dueDate)
                                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                                if (a.dueDate)
                                    return -1;
                                if (b.dueDate)
                                    return 1;
                                return 0;
                            });
                            // Identify audit lists (lists containing an audit-result system task)
                            const auditListIds = new Map(); // listId → system task
                            for (const t of allTasks) {
                                if (t.taskType === "audit-result" && t.listId && !auditListIds.has(t.listId)) {
                                    auditListIds.set(t.listId, t);
                                }
                            }
                            // Build AuditList entries
                            for (const [listId, sysTask] of auditListIds) {
                                let parsedAudit = null;
                                try {
                                    const desc = sysTask.description || "";
                                    const jsonStart = desc.indexOf("{");
                                    if (jsonStart >= 0)
                                        parsedAudit = JSON.parse(desc.slice(jsonStart));
                                }
                                catch (_) { }
                                auditLists.push({
                                    listId, listName: sysTask.listName,
                                    installId: sysTask.installationId, instTitle: sysTask.installationTitle,
                                    systemTask: sysTask, parsedAudit,
                                });
                            }
                            // Sort audits newest first — parse the datetime out of the list name
                            // ("Audit — May 8, 2026 3:19 PM"); the name carries the time, so it
                            // disambiguates same-day audits that parsedAudit.date (day-only) cannot.
                            const auditTime = (al) => {
                                var _a;
                                const fromName = Date.parse(al.listName.replace(/^Audit\s*—\s*/i, "").trim());
                                if (!isNaN(fromName))
                                    return fromName;
                                const fromJson = ((_a = al.parsedAudit) === null || _a === void 0 ? void 0 : _a.date) ? Date.parse(al.parsedAudit.date) : NaN;
                                return isNaN(fromJson) ? 0 : fromJson;
                            };
                            auditLists.sort((a, b) => auditTime(b) - auditTime(a));
                            if (auditLists.length > 0)
                                activeAuditListId = auditLists[0].listId;
                            if (auditMode) {
                                renderStoreTabs(); // store pills based on audit installs
                                renderAuditTabs();
                                renderList();
                            }
                            else {
                                renderStoreTabs();
                                renderTypeFilters();
                                renderList();
                                if (allTasks.filter(t => t.taskType !== "audit-result").length === 0) {
                                    showBanner("info", "No tasks found. Your manager can enable \"Show All Tasks\" to see all store tasks.");
                                }
                            }
                        }
                        catch (e) {
                            listWrap.innerHTML = `<div class="${p}-state"><strong>Failed to load tasks</strong>${esc(e.message)}</div>`;
                        }
                        refreshBtn.disabled = false;
                        refreshBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
                    });
                }
                refreshBtn.addEventListener("click", load);
                // ── Create task sheet ─────────────────────────────────────────────────
                if (allowCreate && !auditMode) {
                    const newBtn = container.querySelector(`#${p}-new`);
                    let createEl = null;
                    const closeCreate = () => { if (!createEl)
                        return; createEl.classList.remove("open"); overlayEl.classList.remove("open"); };
                    const openCreate = () => {
                        var _a;
                        if (!allInstalls.length) {
                            showBanner("error", "No task spaces available yet — try Refresh.");
                            return;
                        }
                        if (!createEl) {
                            createEl = document.createElement("div");
                            createEl.className = `${p}-create`;
                            document.body.appendChild(createEl);
                            self._mtwCreate = createEl;
                        }
                        const instOpts = allInstalls.map(i => `<option value="${esc(i.id)}">${esc(i.title)}</option>`).join("");
                        const firstInst = allInstalls[0].id;
                        const listOpts = (id) => (listsByInst.get(id) || []).map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("");
                        createEl.innerHTML = `
            <div class="${p}-create-head"><h3>New Task</h3>
              <button type="button" class="${p}-create-close" id="${p}-c-x"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div class="${p}-create-body">
              <div class="${p}-fld"><label>Title</label><input class="${p}-in" id="${p}-c-title" placeholder="What needs to be done?"></div>
              <div class="${p}-fld"><label>Description</label><textarea class="${p}-in" id="${p}-c-desc" placeholder="Add details (optional)"></textarea></div>
              ${allInstalls.length > 1 ? `<div class="${p}-fld"><label>${esc(storeSingular)}</label><select class="${p}-sel" id="${p}-c-inst">${instOpts}</select></div>` : `<input type="hidden" id="${p}-c-inst" value="${esc(firstInst)}">`}
              <div class="${p}-fld"><label>List</label><select class="${p}-sel" id="${p}-c-list">${listOpts(firstInst)}</select></div>
              <div class="${p}-fld-row">
                <div class="${p}-fld"><label>Due date</label><input type="date" class="${p}-in" id="${p}-c-due"></div>
                <div class="${p}-fld"><label>Priority</label><select class="${p}-sel" id="${p}-c-prio"><option value="Priority_3">Normal</option><option value="Priority_2">Medium</option><option value="Priority_1">High</option></select></div>
              </div>
            </div>
            <div class="${p}-create-foot">
              <button type="button" class="${p}-btn-cancel" id="${p}-c-cancel">Cancel</button>
              <button type="button" class="${p}-btn-save" id="${p}-c-save">Create Task</button>
            </div>`;
                        const $ = (id) => createEl.querySelector(`#${p}-${id}`);
                        const instSel = $("c-inst");
                        const listSel = $("c-list");
                        if (instSel && instSel.tagName === "SELECT") {
                            instSel.addEventListener("change", () => { listSel.innerHTML = listOpts(instSel.value); });
                        }
                        $("c-x").addEventListener("click", closeCreate);
                        $("c-cancel").addEventListener("click", closeCreate);
                        $("c-save").addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                            const title = ($("c-title").value || "").trim();
                            if (!title) {
                                $("c-title").focus();
                                return;
                            }
                            const instId2 = $("c-inst").value;
                            const listId = listSel.value;
                            if (!listId) {
                                showBanner("error", "That space has no list to add the task to.");
                                return;
                            }
                            const desc = ($("c-desc").value || "").trim();
                            const due = $("c-due").value; // yyyy-mm-dd
                            const prio = $("c-prio").value || "Priority_3";
                            const saveBtn = $("c-save");
                            saveBtn.disabled = true;
                            saveBtn.textContent = "Creating…";
                            try {
                                const body = { title, status: "OPEN", priority: prio, taskListId: listId };
                                if (desc)
                                    body.description = desc;
                                if (due)
                                    body.dueDate = `${due}T00:00:00.000Z`;
                                const r = yield fetch(`${baseUrl}/tasks/${instId2}/task`, Object.assign(Object.assign({ method: "POST" }, apiOpts()), { body: JSON.stringify(body) }));
                                if (!r.ok)
                                    throw new Error(`HTTP ${r.status}`);
                                closeCreate();
                                hideBanner();
                                yield load();
                            }
                            catch (e) {
                                showBanner("error", `Couldn't create task: ${e.message}`);
                                saveBtn.disabled = false;
                                saveBtn.textContent = "Create Task";
                            }
                        }));
                        overlayEl.classList.add("open");
                        requestAnimationFrame(() => createEl.classList.add("open"));
                        (_a = $("c-title")) === null || _a === void 0 ? void 0 : _a.focus();
                    };
                    newBtn === null || newBtn === void 0 ? void 0 : newBtn.addEventListener("click", openCreate);
                    overlayEl.addEventListener("click", closeCreate);
                }
                load();
            });
        }
        disconnectedCallback() {
            const self = this;
            if (self._mtwOverlay) {
                self._mtwOverlay.remove();
                self._mtwOverlay = undefined;
            }
            if (self._mtwDetail) {
                self._mtwDetail.remove();
                self._mtwDetail = undefined;
            }
            if (self._mtwCreate) {
                self._mtwCreate.remove();
                self._mtwCreate = undefined;
            }
            if (self._mtwDocClick) {
                document.removeEventListener("click", self._mtwDocClick);
                self._mtwDocClick = undefined;
            }
            if (self._mtwDocKey) {
                document.removeEventListener("keydown", self._mtwDocKey);
                self._mtwDocKey = undefined;
            }
            if (self._mtwVV && window.visualViewport) {
                window.visualViewport.removeEventListener("resize", self._mtwVV);
                window.visualViewport.removeEventListener("scroll", self._mtwVV);
                self._mtwVV = undefined;
            }
        }
        static get observedAttributes() {
            return ["apitoken", "baseurl", "primarycolor", "accentcolor", "backgroundcolor", "storelabelsingular", "storelabelplural", "showalltasks", "showdonetasks", "auditmode", "enablecomments", "allowtaskcreation", "allowtaskassignment", "debugmode"];
        }
    };
};
// ── Block registration ────────────────────────────────────────────────────────
const blockDefinition = {
    name: "my-tasks-widget", label: "My Tasks Widget",
    attributes: ["apitoken", "baseurl", "primarycolor", "accentcolor", "backgroundcolor", "storelabelsingular", "storelabelplural", "showalltasks", "showdonetasks", "auditmode", "enablecomments", "allowtaskcreation", "allowtaskassignment", "debugmode"],
    factory, configurationSchema, uiSchema, blockLevel: "block", iconUrl: "",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" });


/******/ })()
;