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
        apitoken: {
            type: "string",
            title: "API Token",
            default: DEFAULT_API_TOKEN,
        },
        baseurl: {
            type: "string",
            title: "Base URL",
            default: DEFAULT_BASE_URL,
        },
        primarycolor: {
            type: "string",
            title: "Primary Color",
            default: DEFAULT_PRIMARY_COLOR,
        },
        accentcolor: {
            type: "string",
            title: "Accent Color",
            default: DEFAULT_ACCENT_COLOR,
        },
        backgroundcolor: {
            type: "string",
            title: "Background Color",
            default: "",
        },
        storelabelsingular: {
            type: "string",
            title: "Store Label (singular)",
            default: "Store",
        },
        storelabelplural: {
            type: "string",
            title: "Store Label (plural)",
            default: "Stores",
        },
        showalltasks: {
            type: "boolean",
            title: "Show All Tasks (not just mine)",
            default: false,
        },
        showdonetasks: {
            type: "boolean",
            title: "Include Completed Tasks",
            default: true,
        },
    },
};
const uiSchema = {
    apitoken: {
        "ui:widget": "password",
        "ui:help": "Staffbase Basic auth token",
    },
    baseurl: {
        "ui:help": "Staffbase API base URL",
    },
    primarycolor: {
        "ui:widget": "color",
        "ui:help": "Primary brand color",
    },
    accentcolor: {
        "ui:widget": "color",
        "ui:help": "Accent / secondary color",
    },
    backgroundcolor: {
        "ui:widget": "color",
        "ui:help": "Widget background color — leave blank for transparent",
    },
    storelabelsingular: {
        "ui:help": "e.g. Store, Location, Branch",
    },
    storelabelplural: {
        "ui:help": "e.g. Stores, Locations, Branches",
    },
    showalltasks: {
        "ui:help": "When enabled, tasks from all users are shown — not just yours",
    },
    showdonetasks: {
        "ui:help": "When enabled, completed tasks are included in the view",
    },
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
    storetask: "#da2e32",
    compliance: "#8B4513",
    maintenance: "#2E7D4A",
    training: "#4A90A4",
    audit: "#7C3AED",
    safety: "#D97706",
    inventory: "#0369A1",
};
function typeColor(type) {
    if (TYPE_COLORS[type])
        return TYPE_COLORS[type];
    // Simple hash for unknown types
    let h = 0;
    for (let i = 0; i < type.length; i++)
        h = (h * 31 + type.charCodeAt(i)) & 0xffffff;
    const hue = ((h >> 16) & 0xff) % 360;
    return `hsl(${hue}, 55%, 40%)`;
}
// ── Priority helpers ──────────────────────────────────────────────────────────
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
        constructor() {
            super();
        }
        renderBlock(container) {
            return __awaiter(this, void 0, void 0, function* () {
                const apiToken = this.getAttribute("apitoken") || DEFAULT_API_TOKEN;
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
                const primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
                const accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT_COLOR;
                const bgColor = this.getAttribute("backgroundcolor") || "";
                const showAll = this.getAttribute("showalltasks") === "true";
                const showDone = this.getAttribute("showdonetasks") !== "false";
                const primaryRgb = hexToRgb(primaryColor);
                const primaryText = contrastColor(primaryColor);
                const p = "mtw";
                let allTasks = [];
                let activeTypeFilters = new Set(); // empty = "All"
                let activeStatusFilter = "open";
                let activeInstallFilter = "all";
                // ── Render skeleton ────────────────────────────────────────────────
                container.innerHTML = `
        <style>
          .${p} {
            --primary:      ${primaryColor};
            --primary-rgb:  ${primaryRgb};
            --primary-text: ${primaryText};
            --accent:       ${accentColor};
            --dark:    #1A1A1A;
            --gray:    #6b7280;
            --gray-lt: #9ca3af;
            --border:  #e5e7eb;
            --success: #2E7D4A;
            --error:   #C41E3A;
            --r-sm: 6px; --r-md: 10px; --r-lg: 14px;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
            --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: var(--dark);
            background: ${bgColor || "transparent"};
            padding: 20px;
          }
          .${p} *, .${p} *::before, .${p} *::after {
            box-sizing: border-box; margin: 0; padding: 0;
          }

          /* ── Header ────────────────────────────────────────── */
          .${p}-header {
            display: flex; align-items: center;
            justify-content: space-between; margin-bottom: 16px;
          }
          .${p}-title {
            font-size: 18px; font-weight: 800; color: var(--dark);
            display: flex; align-items: center; gap: 10px;
          }
          .${p}-title-dot {
            width: 10px; height: 10px; border-radius: 50%;
            background: var(--primary); flex-shrink: 0;
          }
          .${p}-badge-count {
            background: var(--primary); color: var(--primary-text);
            padding: 2px 9px; border-radius: 20px;
            font-size: 11px; font-weight: 700;
          }
          .${p}-refresh-btn {
            width: 34px; height: 34px; border: 1.5px solid var(--border);
            border-radius: var(--r-md); background: #fff; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: var(--gray); transition: all .15s;
          }
          .${p}-refresh-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(var(--primary-rgb),.05); }
          .${p}-refresh-btn:disabled { opacity: .4; cursor: not-allowed; }
          .${p}-spin {
            width: 14px; height: 14px; border-radius: 50%;
            border: 2px solid rgba(var(--primary-rgb),.25); border-top-color: var(--primary);
            animation: ${p}-spin .7s linear infinite; flex-shrink: 0; display: inline-block;
          }
          @keyframes ${p}-spin { to { transform: rotate(360deg); } }

          /* ── Detail panel ──────────────────────────────────── */
          .${p}-overlay {
            position: fixed; inset: 0; z-index: 99998;
            background: rgba(0,0,0,.45);
            opacity: 0; pointer-events: none;
            transition: opacity .25s ease;
          }
          .${p}-overlay.open { opacity: 1; pointer-events: auto; }

          /* bottom-sheet (default / narrow) */
          .${p}-detail {
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 99999;
            background: #fff; border-radius: 20px 20px 0 0;
            max-height: 88vh; display: flex; flex-direction: column;
            transform: translateY(102%);
            transition: transform .32s cubic-bezier(.32,.72,0,1);
            overflow: hidden;
          }
          .${p}-detail.open { transform: translateY(0); }

          /* side-panel (wide) */
          .${p}-detail.side {
            left: auto; top: 0; right: 0; bottom: 0;
            width: min(420px, 92vw); max-height: none;
            border-radius: 20px 0 0 20px;
            transform: translateX(102%);
          }
          .${p}-detail.side.open { transform: translateX(0); }

          /* drag handle (bottom-sheet only) */
          .${p}-detail-handle {
            width: 36px; height: 4px; border-radius: 2px;
            background: var(--border); margin: 10px auto 0; flex-shrink: 0;
          }
          .${p}-detail.side .${p}-detail-handle { display: none; }

          /* header */
          .${p}-detail-head {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 16px 20px 12px; flex-shrink: 0;
            border-bottom: 1px solid var(--border);
          }
          .${p}-detail-head-badges { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
          .${p}-detail-close {
            width: 28px; height: 28px; border-radius: 50%;
            border: none; background: #f3f4f6; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: var(--gray); flex-shrink: 0; font-size: 14px;
            transition: background .15s, color .15s; font-family: inherit;
          }
          .${p}-detail-close:hover { background: var(--border); color: var(--dark); }

          /* scrollable body */
          .${p}-detail-body { flex: 1; overflow-y: auto; padding: 20px; min-height: 0; }
          .${p}-detail-title {
            font-size: 18px; font-weight: 800; color: var(--dark);
            line-height: 1.3; margin-bottom: 14px; word-break: break-word;
          }
          .${p}-detail-title.done {
            text-decoration: line-through; color: var(--gray);
          }
          .${p}-detail-meta {
            display: flex; flex-direction: column; gap: 8px;
            margin-bottom: 18px;
          }
          .${p}-detail-meta-row {
            display: flex; align-items: center; gap: 8px;
            font-size: 13px; color: var(--gray);
          }
          .${p}-detail-meta-row svg { flex-shrink: 0; color: var(--gray-lt); }
          .${p}-detail-meta-row.overdue { color: var(--error); font-weight: 600; }
          .${p}-detail-desc-label {
            font-size: 11px; font-weight: 700; letter-spacing: .5px;
            text-transform: uppercase; color: var(--gray-lt); margin-bottom: 6px;
          }
          .${p}-detail-desc {
            font-size: 13px; color: var(--gray); line-height: 1.65;
            white-space: pre-wrap; word-break: break-word;
          }
          .${p}-detail-desc.empty { font-style: italic; color: var(--gray-lt); }

          /* footer */
          .${p}-detail-foot {
            padding: 14px 20px; border-top: 1px solid var(--border);
            flex-shrink: 0;
          }
          .${p}-detail-toggle-btn {
            width: 100%; padding: 11px; border-radius: var(--r-md);
            border: none; font-size: 13px; font-weight: 700;
            cursor: pointer; font-family: inherit; transition: all .15s;
            display: flex; align-items: center; justify-content: center; gap: 8px;
          }
          .${p}-detail-toggle-btn.done-btn {
            background: rgba(var(--primary-rgb),.08);
            border: 1.5px solid rgba(var(--primary-rgb),.2);
            color: var(--primary);
          }
          .${p}-detail-toggle-btn.done-btn:hover {
            background: var(--primary); color: var(--primary-text);
          }
          .${p}-detail-toggle-btn.open-btn {
            background: #f3f4f6; border: 1.5px solid var(--border); color: var(--gray);
          }
          .${p}-detail-toggle-btn.open-btn:hover {
            background: var(--border); color: var(--dark);
          }

          /* ── Store tabs ─────────────────────────────────────── */
          .${p}-store-tabs {
            display: flex; flex-wrap: wrap; gap: 4px;
            margin-bottom: 14px;
          }
          .${p}-store-tab {
            display: inline-flex; align-items: center; width: auto;
            padding: 5px 12px; border-radius: 20px;
            border: 1.5px solid var(--border); background: #fff;
            font-size: 12px; font-weight: 600; color: var(--gray);
            cursor: pointer; font-family: inherit; transition: all .15s;
            white-space: nowrap; flex-shrink: 0;
          }
          .${p}-store-tab:hover { border-color: var(--primary); color: var(--primary); }
          .${p}-store-tab.active {
            background: var(--primary); border-color: var(--primary);
            color: var(--primary-text);
          }

          /* ── Filter bar ────────────────────────────────────── */
          .${p}-filters {
            display: flex; gap: 8px; margin-bottom: 16px; align-items: center;
          }

          /* Type dropdown */
          .${p}-type-wrap { position: relative; flex: 1; min-width: 0; }
          .${p}-type-btn {
            width: 100%; display: flex; align-items: center;
            justify-content: space-between; gap: 6px;
            padding: 7px 11px; border: 1.5px solid var(--border);
            border-radius: var(--r-md); background: #fff;
            font-size: 12px; font-weight: 600; color: var(--gray);
            cursor: pointer; font-family: inherit; transition: all .15s; text-align: left;
          }
          .${p}-type-btn:hover, .${p}-type-btn.open {
            border-color: var(--primary); color: var(--primary);
          }
          .${p}-type-btn svg { flex-shrink: 0; transition: transform .15s; }
          .${p}-type-btn.open svg { transform: rotate(180deg); }
          .${p}-type-menu {
            display: none; position: absolute; top: calc(100% + 4px);
            left: 0; right: 0; background: #fff;
            border: 1.5px solid var(--border); border-radius: var(--r-md);
            box-shadow: var(--shadow-md); z-index: 100; overflow: hidden;
          }
          .${p}-type-menu.open { display: block; }
          .${p}-type-opt {
            display: flex; align-items: center; gap: 8px;
            width: 100%; padding: 8px 12px; border: none; background: none;
            font-size: 12px; font-weight: 500; color: var(--gray);
            cursor: pointer; font-family: inherit; text-align: left; transition: background .1s;
          }
          .${p}-type-opt:hover { background: rgba(0,0,0,.04); color: var(--dark); }
          .${p}-type-opt.active { font-weight: 700; color: var(--dark); background: rgba(var(--primary-rgb),.06); }
          .${p}-type-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

          /* Status toggle */
          .${p}-status-toggle {
            display: flex; border: 1.5px solid var(--border);
            border-radius: var(--r-md); overflow: hidden; background: #fff;
            flex-shrink: 0;
          }
          .${p}-status-opt {
            padding: 7px 13px; font-size: 12px; font-weight: 600;
            cursor: pointer; color: var(--gray); font-family: inherit;
            border: none; background: none; transition: all .15s;
          }
          .${p}-status-opt.active { background: var(--primary); color: var(--primary-text); }

          /* ── Task cards ────────────────────────────────────── */
          .${p}-list { display: flex; flex-direction: column; gap: 8px; }

          .${p}-card {
            background: #fff;
            border-radius: var(--r-lg);
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border);
            border-left: 3px solid var(--primary);
            overflow: hidden;
            cursor: pointer;
            transition: transform .15s ease, box-shadow .15s ease, border-left-color .35s ease, opacity .35s ease;
          }
          .${p}-card:hover:not(.done) {
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(0,0,0,.09);
            border-left-color: var(--accent);
          }
          .${p}-card:active:not(.done) { transform: translateY(0); box-shadow: var(--shadow-sm); }
          .${p}-card.done {
            border-left-color: var(--border);
            opacity: .72;
          }
          .${p}-card.done:hover { opacity: .88; }

          .${p}-card-inner {
            display: flex; align-items: flex-start; gap: 12px;
            padding: 13px 16px;
          }

          /* Checkbox area */
          .${p}-check-wrap {
            flex-shrink: 0; padding-top: 2px; position: relative;
          }
          .${p}-check {
            width: 18px; height: 18px; border-radius: 50%;
            border: 2px solid #d1d5db; background: #fff;
            cursor: pointer; display: flex; align-items: center;
            justify-content: center; transition: all .15s; flex-shrink: 0;
          }
          .${p}-check:hover { border-color: var(--primary); background: rgba(var(--primary-rgb),.05); }
          .${p}-check.checked { background: var(--success); border-color: var(--success); }
          .${p}-check-icon { display: none; }
          .${p}-check.checked .${p}-check-icon { display: block; }

          /* Card body */
          .${p}-card-body { flex: 1; min-width: 0; }
          .${p}-card-top {
            display: flex; align-items: center; gap: 7px;
            margin-bottom: 4px; flex-wrap: wrap;
          }
          .${p}-type-badge {
            padding: 2px 8px; border-radius: 4px;
            font-size: 10px; font-weight: 700; letter-spacing: .5px;
            text-transform: uppercase; color: #fff; flex-shrink: 0;
          }
          .${p}-prio-badge {
            padding: 2px 7px; border-radius: 4px;
            font-size: 10px; font-weight: 700; letter-spacing: .3px;
            flex-shrink: 0; border: 1.5px solid currentColor;
          }
          .${p}-card-title {
            font-size: 14px; font-weight: 700; color: var(--dark);
            line-height: 1.3; word-break: break-word;
          }
          /* done state & animations */
          .${p}-card.done { border-left-color: var(--border); opacity: .68; }
          .${p}-card.done:hover { opacity: .84; transform: none !important; box-shadow: var(--shadow-sm) !important; }
          .${p}-card-title { transition: color .3s ease; }
          .${p}-card.done .${p}-card-title { color: var(--gray); }
          .${p}-card-title > span { position: relative; display: inline; }
          .${p}-card-title > span::after {
            content: ""; position: absolute;
            left: 0; top: 50%; height: 1.5px;
            background: var(--gray); width: 0; transform: translateY(-50%);
            transition: width .35s ease; display: block;
          }
          .${p}-card.done .${p}-card-title > span::after { width: 100%; }

          /* check animation */
          @keyframes ${p}-check-pop {
            0%   { transform: scale(1); }
            35%  { transform: scale(1.35); box-shadow: 0 0 0 6px rgba(var(--primary-rgb),.12); }
            65%  { transform: scale(.88); }
            100% { transform: scale(1); box-shadow: none; }
          }
          @keyframes ${p}-uncheck-pop {
            0%   { transform: scale(1); }
            40%  { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
          .${p}-check.pop-done    { animation: ${p}-check-pop   .38s cubic-bezier(.34,1.56,.64,1) forwards; }
          .${p}-check.pop-undone  { animation: ${p}-uncheck-pop .28s cubic-bezier(.34,1.56,.64,1) forwards; }

          /* sparkle burst on completion */
          @keyframes ${p}-spark {
            0%   { transform: scale(0) translate(0,0); opacity: 1; }
            100% { transform: scale(1) translate(var(--tx), var(--ty)); opacity: 0; }
          }
          .${p}-spark {
            position: absolute; width: 5px; height: 5px;
            border-radius: 50%; pointer-events: none;
            animation: ${p}-spark .5s ease-out forwards;
          }
          .${p}-card-desc {
            font-size: 12px; color: var(--gray); margin-top: 3px;
            line-height: 1.45; word-break: break-word;
            display: -webkit-box; -webkit-line-clamp: 2;
            -webkit-box-orient: vertical; overflow: hidden;
          }
          .${p}-card-meta {
            display: flex; flex-wrap: wrap; gap: 10px;
            margin-top: 7px; align-items: center;
          }
          .${p}-meta-item {
            display: flex; align-items: center; gap: 4px;
            font-size: 11px; color: var(--gray-lt);
          }
          .${p}-meta-item svg { flex-shrink: 0; }
          .${p}-meta-item.overdue { color: var(--error); font-weight: 600; }

          /* ── Empty / loading states ─────────────────────────── */
          .${p}-state {
            padding: 40px 20px; text-align: center;
            color: var(--gray-lt); font-size: 13px; line-height: 1.6;
          }
          .${p}-state-icon {
            font-size: 32px; margin-bottom: 8px; display: block;
          }
          .${p}-state strong { color: var(--gray); display: block; font-size: 14px; margin-bottom: 4px; }

          /* ── Status banner ──────────────────────────────────── */
          .${p}-banner {
            display: none; padding: 10px 14px; border-radius: var(--r-md);
            margin-bottom: 12px; font-size: 13px; line-height: 1.5;
          }
          .${p}-banner.error { background: rgba(196,30,58,.08); border: 1px solid rgba(196,30,58,.25); color: var(--error); }
          .${p}-banner.info  { background: rgba(var(--primary-rgb),.06); border: 1px solid rgba(var(--primary-rgb),.2); color: var(--primary); }

          /* ── Section divider ────────────────────────────────── */
          .${p}-section-label {
            font-size: 11px; font-weight: 700; letter-spacing: .5px;
            text-transform: uppercase; color: var(--gray-lt);
            padding: 4px 0 8px; margin-top: 4px;
          }

        </style>

        <div class="${p}">
          <div class="${p}-header">
            <div class="${p}-title">
              <span class="${p}-title-dot"></span>
              My Tasks
              <span class="${p}-badge-count" id="${p}-count">0</span>
            </div>
            <button type="button" class="${p}-refresh-btn" id="${p}-refresh" title="Refresh">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>

          <div class="${p}-store-tabs" id="${p}-store-tabs" style="display:none"></div>

          <div class="${p}-banner" id="${p}-banner"></div>

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
          </div>

          <div id="${p}-list-wrap">
            <div class="${p}-state">
              <span class="${p}-spin" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px;display:block"></span>
              Loading your tasks…
            </div>
          </div>
        </div>

      `;
                // ── DOM refs ──────────────────────────────────────────────────────
                const countEl = container.querySelector(`#${p}-count`);
                const bannerEl = container.querySelector(`#${p}-banner`);
                const storeTabs = container.querySelector(`#${p}-store-tabs`);
                const listWrap = container.querySelector(`#${p}-list-wrap`);
                const typeBtn = container.querySelector(`#${p}-type-btn`);
                const typeLabelEl = container.querySelector(`#${p}-type-label`);
                const typeMenu = container.querySelector(`#${p}-type-menu`);
                const refreshBtn = container.querySelector(`#${p}-refresh`);
                // Overlay and detail panel live on document.body so position:fixed works
                // regardless of any CSS transform/overflow on ancestor elements in Staffbase.
                // Remove any stale panels from previous renders of this widget instance.
                document.querySelectorAll(`[data-mtw-inst="${container.dataset.mtwInst || ""}"]`).forEach(el => el.remove());
                const instId = Math.random().toString(36).slice(2);
                container.dataset.mtwInst = instId;
                const overlayEl = document.createElement("div");
                overlayEl.className = `${p}-overlay`;
                overlayEl.dataset.mtwInst = instId;
                document.body.appendChild(overlayEl);
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
                const detailBadges = detailEl.querySelector(`#${p}-detail-badges-${instId}`);
                const detailBody = detailEl.querySelector(`#${p}-detail-body-${instId}`);
                const detailToggle = detailEl.querySelector(`#${p}-detail-toggle-${instId}`);
                const detailClose = detailEl.querySelector(`#${p}-detail-close-${instId}`);
                // ── Helpers ───────────────────────────────────────────────────────
                const apiOpts = (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: {
                        Authorization: `Basic ${apiToken}`,
                        "Content-Type": "application/json",
                    } }));
                function esc(s) {
                    return s
                        .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
                        .replace(/</g, "&lt;").replace(/>/g, "&gt;");
                }
                function showBanner(type, msg) {
                    bannerEl.className = `${p}-banner ${type}`;
                    bannerEl.style.display = "block";
                    bannerEl.textContent = msg;
                }
                function hideBanner() {
                    bannerEl.style.display = "none";
                }
                function formatDate(iso) {
                    if (!iso)
                        return { text: "", overdue: false };
                    // Extract YYYY-MM-DD directly from the ISO string to avoid timezone shifts
                    // (new Date("2026-05-01T00:00:00Z") renders as Apr 30 in negative-offset zones)
                    const datePart = iso.split("T")[0];
                    if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart))
                        return { text: "", overdue: false };
                    const [year, month, day] = datePart.split("-").map(Number);
                    const d = new Date(year, month - 1, day); // local midnight — correct for overdue comparison
                    if (isNaN(d.getTime()))
                        return { text: "", overdue: false };
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const overdue = d < now;
                    const text = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    return { text, overdue };
                }
                // ── Distinct task types for visible install ───────────────────────
                function getTypes() {
                    const types = new Set();
                    let hasUntyped = false;
                    for (const t of allTasks) {
                        if (activeInstallFilter !== "all" && t.installationId !== activeInstallFilter)
                            continue;
                        if (t.taskType)
                            types.add(t.taskType);
                        else
                            hasUntyped = true;
                    }
                    const sorted = Array.from(types).sort().map(k => ({ key: k, label: k }));
                    if (hasUntyped)
                        sorted.push({ key: "__none__", label: "No Type" });
                    return sorted;
                }
                // ── Filtered view ─────────────────────────────────────────────────
                function filteredTasks() {
                    return allTasks.filter(t => {
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
                // ── Store tab rendering ───────────────────────────────────────────
                function renderStoreTabs() {
                    // Collect installs that actually have tasks
                    const instMap = new Map();
                    for (const t of allTasks) {
                        if (!instMap.has(t.installationId)) {
                            instMap.set(t.installationId, { title: t.installationTitle, count: 0 });
                        }
                        instMap.get(t.installationId).count++;
                    }
                    if (instMap.size <= 1) {
                        storeTabs.style.display = "none";
                        return;
                    }
                    storeTabs.style.display = "flex";
                    const total = allTasks.length;
                    storeTabs.innerHTML = `
          <button type="button" class="${p}-store-tab ${activeInstallFilter === "all" ? "active" : ""}" data-inst="all">
            All <span style="opacity:.6;font-weight:400">(${total})</span>
          </button>
          ${Array.from(instMap.entries()).map(([id, info]) => `
            <button type="button"
              class="${p}-store-tab ${activeInstallFilter === id ? "active" : ""}"
              data-inst="${esc(id)}">
              ${esc(info.title || id)} <span style="opacity:.6;font-weight:400">(${info.count})</span>
            </button>
          `).join("")}
        `;
                    storeTabs.querySelectorAll(`.${p}-store-tab`).forEach((btn) => {
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
                // ── Type dropdown (multi-select) ──────────────────────────────────
                let dropdownOpen = false;
                function typeDropdownLabel() {
                    if (activeTypeFilters.size === 0)
                        return "All Types";
                    const types = getTypes();
                    const selected = types.filter(t => activeTypeFilters.has(t.key));
                    if (selected.length === 1)
                        return selected[0].label;
                    return `${selected.length} types`;
                }
                function renderTypeFilters() {
                    const types = getTypes();
                    // Update button label + open state
                    typeLabelEl.textContent = typeDropdownLabel();
                    typeBtn.classList.toggle("open", dropdownOpen);
                    typeMenu.classList.toggle("open", dropdownOpen);
                    const iconCheck = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    // Rebuild menu
                    const allActive = activeTypeFilters.size === 0;
                    typeMenu.innerHTML = `
          <button type="button" class="${p}-type-opt ${allActive ? "active" : ""}" data-key="__all__">
            <span style="width:12px;display:flex;align-items:center;justify-content:center">${allActive ? iconCheck : ""}</span>
            All Types
          </button>
          <div style="height:1px;background:var(--border);margin:2px 0"></div>
          ${types.map(({ key, label }) => {
                        const checked = activeTypeFilters.has(key);
                        const dot = key !== "__none__"
                            ? `<span class="${p}-type-dot" style="background:${typeColor(key)}"></span>`
                            : `<span class="${p}-type-dot" style="background:var(--border)"></span>`;
                        return `
              <button type="button" class="${p}-type-opt ${checked ? "active" : ""}" data-key="${esc(key)}">
                <span style="width:12px;display:flex;align-items:center;justify-content:center">${checked ? iconCheck : ""}</span>
                ${dot}
                ${esc(label)}
              </button>`;
                    }).join("")}
        `;
                    typeMenu.querySelectorAll(`.${p}-type-opt`).forEach((btn) => {
                        btn.addEventListener("click", (e) => {
                            e.stopPropagation();
                            const key = btn.dataset.key;
                            if (key === "__all__") {
                                activeTypeFilters.clear();
                            }
                            else if (activeTypeFilters.has(key)) {
                                activeTypeFilters.delete(key);
                            }
                            else {
                                activeTypeFilters.add(key);
                            }
                            renderTypeFilters();
                            renderList();
                        });
                    });
                }
                // Toggle dropdown open/close
                typeBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    dropdownOpen = !dropdownOpen;
                    renderTypeFilters();
                });
                // Close on outside click
                document.addEventListener("click", () => {
                    if (dropdownOpen) {
                        dropdownOpen = false;
                        renderTypeFilters();
                    }
                });
                // ── Render task list ──────────────────────────────────────────────
                function renderList() {
                    const tasks = filteredTasks();
                    countEl.textContent = String(tasks.length);
                    if (!tasks.length) {
                        const emptyMsg = allTasks.length === 0
                            ? "No tasks found"
                            : activeStatusFilter === "open"
                                ? "No open tasks — you're all caught up!"
                                : "No completed tasks yet";
                        listWrap.innerHTML = `
            <div class="${p}-state">
              <span class="${p}-state-icon">${activeStatusFilter === "open" && allTasks.length > 0 ? "✓" : "📋"}</span>
              <strong>${emptyMsg}</strong>
              ${allTasks.length === 0 ? "Tasks assigned to you will appear here once they're created." : ""}
            </div>`;
                        return;
                    }
                    // Group by task type
                    const grouped = new Map();
                    for (const t of tasks) {
                        const key = t.taskType || "__none__";
                        if (!grouped.has(key))
                            grouped.set(key, []);
                        grouped.get(key).push(t);
                    }
                    // Sort: typed groups first (alphabetically), then "no type"
                    const orderedKeys = [...grouped.keys()].sort((a, b) => {
                        if (a === "__none__")
                            return 1;
                        if (b === "__none__")
                            return -1;
                        return a.localeCompare(b);
                    });
                    let html = `<div class="${p}-list">`;
                    for (const key of orderedKeys) {
                        const group = grouped.get(key);
                        const label = key === "__none__" ? "No Type" : key;
                        const color = key === "__none__" ? "var(--gray-lt)" : typeColor(key);
                        html += `<div class="${p}-section-label" style="color:${color}">${esc(label)} <span style="font-weight:400">(${group.length})</span></div>`;
                        for (const task of group) {
                            html += renderTaskCard(task);
                        }
                    }
                    html += `</div>`;
                    listWrap.innerHTML = html;
                    // Bind complete/reopen buttons
                    listWrap.querySelectorAll(`.${p}-check`).forEach((btn) => {
                        btn.addEventListener("click", () => toggleTask(btn));
                    });
                    // Bind card click → detail panel
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
                function renderTaskCard(task) {
                    const isDone = task.status === "DONE" || task.status === "done" || task.status === "CLOSED";
                    const dueInfo = formatDate(task.dueDate);
                    const desc = task.description ? esc(stripTypeTag(task.description)) : "";
                    const typeCol = task.taskType ? typeColor(task.taskType) : "";
                    const typeText = task.taskType ? contrastColor(typeCol) : "";
                    const prioCol = priorityColor(task.priority);
                    const typeBadge = task.taskType
                        ? `<span class="${p}-type-badge" style="background:${typeCol};color:${typeText}">${esc(task.taskType)}</span>`
                        : "";
                    const prioBadge = task.priority && task.priority !== "Priority_3"
                        ? `<span class="${p}-prio-badge" style="color:${prioCol};border-color:${prioCol}">${priorityLabel(task.priority)}</span>`
                        : "";
                    const iconCal = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                    const iconStore = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                    const iconList = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
                    const iconCheck = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                    return `
          <div class="${p}-card ${isDone ? "done" : ""}" data-task-id="${esc(task.id)}" data-install-id="${esc(task.installationId)}">
            <div class="${p}-card-inner">
              <div class="${p}-check-wrap">
                <div class="${p}-check ${isDone ? "checked" : ""}"
                     data-task-id="${esc(task.id)}"
                     data-install-id="${esc(task.installationId)}"
                     data-status="${esc(task.status)}"
                     title="${isDone ? "Mark as open" : "Mark as done"}">
                  <span class="${p}-check-icon">${iconCheck}</span>
                </div>
              </div>
              <div class="${p}-card-body">
                <div class="${p}-card-top">
                  ${typeBadge}
                  ${prioBadge}
                </div>
                <div class="${p}-card-title"><span>${esc(task.title)}</span></div>
                ${desc ? `<div class="${p}-card-desc">${desc}</div>` : ""}
                <div class="${p}-card-meta">
                  ${dueInfo.text ? `
                    <span class="${p}-meta-item ${dueInfo.overdue && !isDone ? "overdue" : ""}">
                      ${iconCal} ${dueInfo.overdue && !isDone ? "Overdue: " : ""}${dueInfo.text}
                    </span>` : ""}
                  ${task.installationTitle ? `
                    <span class="${p}-meta-item">
                      ${iconStore} ${esc(task.installationTitle)}
                    </span>` : ""}
                  ${task.listName ? `
                    <span class="${p}-meta-item">
                      ${iconList} ${esc(task.listName)}
                    </span>` : ""}
                </div>
              </div>
            </div>
          </div>`;
                }
                // ── Detail panel ─────────────────────────────────────────────────
                let detailTask = null;
                function openDetail(task) {
                    detailTask = task;
                    const isWide = container.offsetWidth >= 520;
                    detailEl.classList.toggle("side", isWide);
                    renderDetailContent(task);
                    overlayEl.classList.add("open");
                    requestAnimationFrame(() => detailEl.classList.add("open"));
                }
                function closeDetail() {
                    overlayEl.classList.remove("open");
                    detailEl.classList.remove("open");
                    detailTask = null;
                }
                // Stop panel clicks from bubbling to overlay / document handlers
                detailEl.addEventListener("click", (e) => e.stopPropagation());
                function renderDetailContent(task) {
                    const isDone = task.status === "DONE" || task.status === "done" || task.status === "CLOSED";
                    const dueInfo = formatDate(task.dueDate);
                    const typeCol = task.taskType ? typeColor(task.taskType) : "";
                    const typeText = task.taskType ? contrastColor(typeCol) : "";
                    const prioCol = priorityColor(task.priority);
                    // Badges in header
                    detailBadges.innerHTML = `
          ${task.taskType ? `<span class="${p}-type-badge" style="background:${typeCol};color:${typeText}">${esc(task.taskType)}</span>` : ""}
          ${task.priority && task.priority !== "Priority_3"
                        ? `<span class="${p}-prio-badge" style="color:${prioCol};border-color:${prioCol}">${priorityLabel(task.priority)}</span>`
                        : ""}
        `;
                    // Icons
                    const iCal = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
                    const iStore = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
                    const iList = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
                    const cleanDesc = task.description ? stripTypeTag(task.description).trim() : "";
                    detailBody.innerHTML = `
          <div class="${p}-detail-title ${isDone ? "done" : ""}">${esc(task.title)}</div>
          <div class="${p}-detail-meta">
            ${dueInfo.text ? `
              <div class="${p}-detail-meta-row ${dueInfo.overdue && !isDone ? "overdue" : ""}">
                ${iCal}
                ${dueInfo.overdue && !isDone ? "Overdue · " : "Due "}${dueInfo.text}
              </div>` : ""}
            ${task.installationTitle ? `
              <div class="${p}-detail-meta-row">${iStore} ${esc(task.installationTitle)}</div>` : ""}
            ${task.listName ? `
              <div class="${p}-detail-meta-row">${iList} ${esc(task.listName)}</div>` : ""}
          </div>
          ${cleanDesc ? `
            <div class="${p}-detail-desc-label">Description</div>
            <div class="${p}-detail-desc">${esc(cleanDesc)}</div>
          ` : `<div class="${p}-detail-desc empty">No description</div>`}
        `;
                    // Toggle button
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
                // Wire detail close — overlay click, X button, and Escape key
                overlayEl.addEventListener("click", closeDetail);
                detailClose.addEventListener("click", (e) => { e.stopPropagation(); closeDetail(); });
                document.addEventListener("keydown", (e) => {
                    if (e.key === "Escape" && detailTask)
                        closeDetail();
                });
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
                        // Also animate the card in the list if visible
                        const cardEl = listWrap.querySelector(`[data-task-id="${task.id}"]`);
                        if (cardEl) {
                            if (!isDone)
                                cardEl.classList.add("done");
                            else
                                cardEl.classList.remove("done");
                        }
                        setTimeout(() => { renderTypeFilters(); renderList(); }, 380);
                    }
                    catch (e) {
                        showBanner("error", `Could not update: ${e.message}`);
                    }
                    detailToggle.disabled = false;
                }));
                // ── Sparkle burst ─────────────────────────────────────────────────
                function spawnSparks(wrap, color) {
                    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
                    angles.forEach(deg => {
                        const spark = document.createElement("div");
                        spark.className = `${p}-spark`;
                        const rad = (deg * Math.PI) / 180;
                        const dist = 14 + Math.random() * 8;
                        spark.style.cssText = `
            background:${color};
            left:50%; top:50%; margin:-2.5px;
            --tx:${Math.cos(rad) * dist}px;
            --ty:${Math.sin(rad) * dist}px;
          `;
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
                        // Immediate visual feedback — animate check, flip card state
                        checkEl.style.pointerEvents = "none";
                        checkEl.classList.remove("pop-done", "pop-undone");
                        void checkEl.offsetWidth; // force reflow to restart animation
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
                            // Delay re-render slightly so the animation is visible
                            setTimeout(() => { renderTypeFilters(); renderList(); }, 420);
                        }
                        catch (e) {
                            // Revert visual state on error
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
                // ── Status filter binding ─────────────────────────────────────────
                container.querySelectorAll(`.${p}-status-opt`).forEach((btn) => {
                    btn.addEventListener("click", () => {
                        container.querySelectorAll(`.${p}-status-opt`).forEach((b) => b.classList.remove("active"));
                        btn.classList.add("active");
                        activeStatusFilter = btn.dataset.status || "open";
                        renderList();
                    });
                });
                // ── Load data ─────────────────────────────────────────────────────
                function load() {
                    return __awaiter(this, void 0, void 0, function* () {
                        refreshBtn.disabled = true;
                        refreshBtn.innerHTML = `<span class="${p}-spin" style="width:14px;height:14px;border-width:2px"></span>`;
                        hideBanner();
                        allTasks = [];
                        activeInstallFilter = "all";
                        activeTypeFilters.clear();
                        dropdownOpen = false;
                        listWrap.innerHTML = `<div class="${p}-state"><span class="${p}-spin" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px;display:block"></span>Loading your tasks…</div>`;
                        try {
                            // 1. Fetch task installations (token auth works fine for this)
                            const instRes = yield fetch(`${baseUrl}/installations?limit=200`, apiOpts());
                            if (!instRes.ok)
                                throw new Error(`Could not load installations (HTTP ${instRes.status})`);
                            const instData = yield instRes.json();
                            const installations = (instData.data || instData)
                                .filter((i) => i.pluginID === "tasks" || i.pluginId === "tasks")
                                .map((i) => {
                                var _a, _b, _c;
                                return ({
                                    id: i.id,
                                    title: ((_c = (_b = (_a = i.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) ||
                                        i.title || i.name || i.id,
                                });
                            });
                            if (!installations.length) {
                                listWrap.innerHTML = `<div class="${p}-state"><span class="${p}-state-icon">📋</span><strong>No task spaces found</strong>Make sure at least one Tasks installation exists.</div>`;
                                return;
                            }
                            // 2. Get current user ID + group IDs from widget SDK.
                            //    Used to filter tasks by direct assignment or group membership when showAll=false.
                            let currentUserId = "";
                            let userGroupIds = [];
                            if (!showAll) {
                                try {
                                    const profile = yield widgetApi.getUserInformation();
                                    currentUserId = profile.id;
                                    userGroupIds = profile.groupIDs || [];
                                }
                                catch (_) { /* proceed without filtering */ }
                            }
                            // 3. Per-installation: fetch lists, then tasks per list via /task?listId=
                            //    (bare /task?limit=200 → HTTP 500; /task/my-tasks requires session auth)
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
                                    }
                                    const perList = yield Promise.all(listIds.map(lid => fetch(`${baseUrl}/tasks/${inst.id}/task?listId=${lid}`, apiOpts())
                                        .then(r => r.ok ? r.json() : null)
                                        .catch(() => null)));
                                    const seen = new Set();
                                    for (const result of perList) {
                                        if (!result)
                                            continue;
                                        const arr = Array.isArray(result) ? result : (result.data || []);
                                        for (const t of arr) {
                                            if (!t.id || seen.has(t.id))
                                                continue;
                                            // When not showing all, only include tasks assigned to the current user
                                            // (directly via assigneeIds, or via a group the user belongs to)
                                            if (!showAll && currentUserId) {
                                                const assigneeIds = t.assigneeIds || [];
                                                const taskGroupIds = t.groupIds || [];
                                                const directMatch = assigneeIds.indexOf(currentUserId) !== -1;
                                                const groupMatch = taskGroupIds.some((gid) => userGroupIds.indexOf(gid) !== -1);
                                                if (!directMatch && !groupMatch)
                                                    continue;
                                            }
                                            seen.add(t.id);
                                            const desc = t.description || "";
                                            const taskType = parseTaskType(t.title || "") || parseTaskType(desc);
                                            allTasks.push({
                                                id: t.id,
                                                title: t.title || "(no title)",
                                                description: desc,
                                                status: t.status || "OPEN",
                                                priority: t.priority || "Priority_3",
                                                dueDate: t.dueDate || null,
                                                taskType,
                                                installationId: inst.id,
                                                installationTitle: inst.title,
                                                listName: t.taskListId ? (listMap.get(t.taskListId) || "") : "",
                                            });
                                        }
                                    }
                                }
                                catch (_) { /* skip failed installation */ }
                            }
                            // Sort: open first, then by due date ascending
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
                            renderStoreTabs();
                            renderTypeFilters();
                            renderList();
                            if (allTasks.length === 0) {
                                showBanner("info", "No tasks found. Your manager can enable \"Show All Tasks\" to see all store tasks.");
                            }
                        }
                        catch (e) {
                            listWrap.innerHTML = `<div class="${p}-state"><span class="${p}-state-icon">⚠</span><strong>Failed to load tasks</strong>${esc(e.message)}</div>`;
                        }
                        refreshBtn.disabled = false;
                        refreshBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
                    });
                }
                refreshBtn.addEventListener("click", load);
                load();
            });
        }
        static get observedAttributes() {
            return [
                "apitoken",
                "baseurl",
                "primarycolor",
                "accentcolor",
                "backgroundcolor",
                "storelabelsingular",
                "storelabelplural",
                "showalltasks",
                "showdonetasks",
            ];
        }
    };
};
// ── Block registration ────────────────────────────────────────────────────────
const blockDefinition = {
    name: "my-tasks-widget",
    label: "My Tasks Widget",
    attributes: [
        "apitoken",
        "baseurl",
        "primarycolor",
        "accentcolor",
        "backgroundcolor",
        "storelabelsingular",
        "storelabelplural",
        "showalltasks",
        "showdonetasks",
    ],
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