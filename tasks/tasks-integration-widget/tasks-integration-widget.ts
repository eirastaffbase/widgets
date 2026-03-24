import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from "@staffbase/widget-sdk";

import { JSONSchema7 } from "json-schema";
import { UiSchema } from "@rjsf/utils";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwhJDxf4hgE_zIfZjvedGmqQnH8_nJ2UIEwMtcQ8Hbk2RBNXnslyqSV718k3k0RYXy1/exec";
const DEFAULT_API_TOKEN =
  "NjljMjU3N2JjZmFjZWYxMzc4MzIzYTNkOkp6VEpkaGlfclRyRDk4bjlBZ2pIdXFkcmI3UjQhdl1LTm1RV1hwOHBIdUd+Unl3clk7MjYhSS1JdiprLGdOaVI=";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#da2e32";
const DEFAULT_ACCENT_COLOR  = "#da2e32";

// ── Config schema ─────────────────────────────────────────────────────────────

const configurationSchema: JSONSchema7 = {
  properties: {
    appsscripturl: {
      type: "string",
      title: "Apps Script URL",
      default: DEFAULT_APPS_SCRIPT_URL,
    },
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
    enabletasklistupdating: {
      type: "boolean",
      title: "Enable Task List Updating",
      default: false,
    },
  },
};

const uiSchema: UiSchema = {
  apitoken: {
    "ui:widget": "password",
    "ui:help": "Staffbase Basic auth token",
  },
  appsscripturl: {
    "ui:help": "Deployed Google Apps Script web app URL (deploy as Anyone)",
  },
  baseurl: {
    "ui:help": "Staffbase API base URL",
  },
  primarycolor: {
    "ui:widget": "color",
    "ui:help": "Primary brand color (default: Panda Express red)",
  },
  accentcolor: {
    "ui:widget": "color",
    "ui:help": "Accent / secondary color (default: Panda Express orange)",
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
  enabletasklistupdating: {
    "ui:help":
      "When enabled, select an existing task list to update instead of always creating a new one",
  },
};

// ── Widget factory ────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, _widgetApi) => {
  return class TasksIntegrationWidget extends BaseBlockClass implements BaseBlock {
    constructor() {
      super();
    }

    async renderBlock(container: any) {
      const appsScriptUrl =
        this.getAttribute("appsscripturl") || DEFAULT_APPS_SCRIPT_URL;
      const apiToken =
        this.getAttribute("apitoken") || DEFAULT_API_TOKEN;
      const baseUrl = (
        this.getAttribute("baseurl") || DEFAULT_BASE_URL
      ).replace(/\/$/, "");
      const primaryColor =
        this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
      const accentColor =
        this.getAttribute("accentcolor") || DEFAULT_ACCENT_COLOR;
      const bgColor =
        this.getAttribute("backgroundcolor") || "";
      const storeS =
        this.getAttribute("storelabelsingular") || "Store";
      const storeP =
        this.getAttribute("storelabelplural") || "Stores";
      const enableUpdating =
        this.getAttribute("enabletasklistupdating") === "true";

      let storeProjects: Array<{ id: string; title: string }> = [];
      let selectedStores: Array<{ id: string; title: string }> = [];

      const p = "tiw";

      // SVG icons (inlined so no external deps needed)
      const iconDownload = `<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M472.7 189.5c-15.76-10-36.21-16.79-58.59-19.54-6.65-39.1-24.22-72.52-51.27-97.26C334.15 46.45 296.21 32 256 32c-35.35 0-68 11.08-94.37 32a149.7 149.7 0 0 0-45.29 60.42c-30.67 4.32-57 14.61-76.71 30C13.7 174.83 0 203.56 0 237.6 0 305 55.92 352 136 352h104V208h32v144h124c72.64 0 116-34.24 116-91.6 0-30.05-13.59-54.57-39.3-70.9zM240 419.42 191.98 371l-22.61 23L256 480l86.63-86-22.61-23L272 419.42V352h-32v67.42z"/></svg>`;
      const iconUpload   = `<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M504 256c0 136.967-111.033 248-248 248S8 392.967 8 256 119.033 8 256 8s248 111.033 248 248zM227.314 387.314l184-184c6.248-6.248 6.248-16.379 0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.628 0L216 308.118l-70.059-70.059c-6.248-6.248-16.379-6.248-22.628 0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249 6.249 16.379 6.249 22.628.001z"/></svg>`;

      container.innerHTML = `
        <style>
          .${p} {
            --primary: ${primaryColor};
            --accent:  ${accentColor};
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

          /* ── Cards ─────────────────────────────────────────── */
          .${p}-card {
            background: #fff;
            border-radius: var(--r-lg);
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border);
            border-left: 3px solid var(--primary);
            margin-bottom: 12px;
            overflow: visible;
          }
          .${p}-card-head {
            display: flex; align-items: center; gap: 10px;
            padding: 14px 18px 12px;
            border-bottom: 1px solid var(--border);
          }
          .${p}-step {
            width: 22px; height: 22px; border-radius: 50%;
            background: var(--primary); color: #fff;
            font-size: 11px; font-weight: 800;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .${p}-card-title {
            font-size: 12px; font-weight: 700; letter-spacing: .4px;
            text-transform: uppercase; color: var(--dark);
          }
          .${p}-card-body { padding: 16px 18px; }

          /* ── Labels / inputs ───────────────────────────────── */
          .${p}-label {
            display: block; font-size: 12px; font-weight: 600;
            color: var(--gray); text-transform: uppercase; letter-spacing: .4px;
            margin-bottom: 6px;
          }
          .${p}-help { font-size: 12px; color: var(--gray-lt); margin-top: 5px; }
          .${p}-input {
            width: 100%; padding: 10px 13px;
            border: 1.5px solid var(--border); border-radius: var(--r-md);
            font-size: 14px; font-family: inherit; color: var(--dark);
            transition: border-color .15s, box-shadow .15s;
            background: #fafafa;
          }
          .${p}-input::placeholder { color: var(--gray-lt); }
          .${p}-input:focus {
            outline: none; border-color: var(--primary); background: #fff;
            box-shadow: 0 0 0 3px rgba(218,46,50,.1);
          }

          /* ── Input + icon-button row ───────────────────────── */
          .${p}-input-group { display: flex; gap: 8px; align-items: stretch; }
          .${p}-input-group .${p}-input { flex: 1; }
          .${p}-icon-btn {
            width: 42px; border: none; border-radius: var(--r-md);
            background: var(--primary); color: #fff; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(218,46,50,.35);
            transition: filter .15s, transform .15s, box-shadow .15s;
          }
          .${p}-icon-btn:hover:not(:disabled) {
            filter: brightness(.88); transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(218,46,50,.4);
          }
          .${p}-icon-btn:active:not(:disabled) { transform: translateY(0); }
          .${p}-icon-btn:disabled { opacity: .4; cursor: not-allowed; }

          /* ── Multi-select ──────────────────────────────────── */
          .${p}-ms-wrap { position: relative; }
          .${p}-ms-trigger {
            width: 100%; min-height: 44px; padding: 8px 36px 8px 11px;
            border: 1.5px solid var(--border); border-radius: var(--r-md);
            background: #fafafa; cursor: pointer;
            display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
            position: relative; transition: border-color .15s;
          }
          .${p}-ms-trigger:hover, .${p}-ms-trigger.open {
            border-color: var(--primary); background: #fff;
          }
          .${p}-ms-trigger::after {
            content: '▾'; position: absolute; right: 11px; top: 50%;
            transform: translateY(-50%); color: var(--gray-lt); pointer-events: none;
            font-size: 13px;
          }
          .${p}-ms-ph { color: var(--gray-lt); font-size: 14px; }
          .${p}-tag {
            display: inline-flex; align-items: center; gap: 4px;
            background: var(--primary); color: #fff;
            padding: 3px 8px; border-radius: 20px;
            font-size: 12px; font-weight: 600;
          }
          .${p}-tag-x { cursor: pointer; opacity: .75; line-height: 1; }
          .${p}-tag-x:hover { opacity: 1; }
          .${p}-dropdown {
            display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
            background: #fff; border: 1.5px solid var(--primary);
            border-radius: var(--r-md); box-shadow: var(--shadow-md);
            overflow: hidden; z-index: 200;
          }
          .${p}-dropdown.show { display: block; animation: ${p}-fade .15s ease; }
          @keyframes ${p}-fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
          .${p}-dd-search { padding: 9px 10px; border-bottom: 1px solid var(--border); }
          .${p}-dd-search input {
            width: 100%; padding: 7px 10px; border: 1.5px solid var(--border);
            border-radius: var(--r-sm); font-size: 13px; background: #fafafa;
          }
          .${p}-dd-search input:focus { outline: none; border-color: var(--primary); background: #fff; }
          .${p}-dd-list { max-height: 210px; overflow-y: auto; }
          .${p}-dd-opt {
            padding: 10px 12px; cursor: pointer;
            display: flex; align-items: center; gap: 9px;
            font-size: 13px; border-bottom: 1px solid #f3f4f6;
            transition: background .1s;
          }
          .${p}-dd-opt:last-child { border-bottom: none; }
          .${p}-dd-opt:hover { background: #fef2f2; }
          .${p}-dd-opt.sel { background: rgba(218,46,50,.06); }
          .${p}-check {
            width: 16px; height: 16px; border: 1.5px solid #d1d5db;
            border-radius: 3px; flex-shrink: 0; font-size: 10px;
            display: flex; align-items: center; justify-content: center; color: transparent;
            transition: all .1s;
          }
          .${p}-dd-opt.sel .${p}-check {
            background: var(--primary); border-color: var(--primary); color: #fff;
          }
          .${p}-dd-msg { padding: 20px; text-align: center; color: var(--gray-lt); font-size: 13px; }

          /* ── Task table ────────────────────────────────────── */
          .${p}-tbl-zone {
            margin-top: 16px;
            position: relative;
            padding-bottom: 10px;
          }
          .${p}-tbl-meta {
            display: flex; align-items: center;
            justify-content: space-between; margin-bottom: 8px;
          }
          .${p}-tbl-label {
            font-size: 12px; font-weight: 700; color: var(--gray);
            text-transform: uppercase; letter-spacing: .4px;
          }
          .${p}-badge-count {
            background: var(--primary); color: #fff;
            padding: 2px 9px; border-radius: 20px;
            font-size: 11px; font-weight: 700;
          }
          .${p}-tbl-wrap {
            border: 1.5px solid var(--border); border-radius: var(--r-md);
            overflow: hidden;
          }
          .${p}-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
          .${p}-tbl th {
            background: #f9fafb; color: var(--gray);
            padding: 9px 12px; text-align: left;
            font-size: 11px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase;
            border-bottom: 1.5px solid var(--border);
          }
          .${p}-tbl td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; }
          .${p}-tbl tr:last-child td { border-bottom: none; }
          .${p}-tbl tr:hover td { background: #fef2f2; }
          .${p}-cell {
            width: 100%; padding: 7px 9px;
            border: 1.5px solid transparent; border-radius: var(--r-sm);
            font-size: 13px; font-family: inherit; color: var(--dark);
            background: transparent; transition: border-color .15s, background .15s;
          }
          .${p}-cell::placeholder { color: #9ca3af; }
          .${p}-cell:hover { border-color: var(--border); background: #f9fafb; }
          .${p}-cell:focus { outline: none; border-color: var(--primary); background: #fff; }
          .${p}-del-row {
            width: 26px; height: 26px; border: none; background: none;
            cursor: pointer; border-radius: var(--r-sm);
            display: flex; align-items: center; justify-content: center;
            color: #d1d5db; transition: all .15s;
          }
          .${p}-del-row:hover { background: #fee2e2; color: var(--error); }
          .${p}-del-row svg { pointer-events: none; }

          /* Add-row — subtle plus below table, visible on hover */
          .${p}-add-row {
            margin: 4px auto 0;
            width: 26px;
            height: 26px;
            border: 1.5px solid #d1d5db;
            border-radius: 999px;
            background: #fff;
            color: #9ca3af;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-family: inherit;
            font-size: 18px;
            font-weight: 400;
            line-height: 1;
            box-shadow: 0 1px 3px rgba(0,0,0,.05);
            opacity: 0; pointer-events: none;
            transition: opacity .16s, border-color .16s, color .16s, background .16s;
          }
          .${p}-tbl-zone:hover .${p}-add-row,
          .${p}-add-row:focus-visible {
            opacity: 1; pointer-events: auto;
          }
          .${p}-add-row:hover,
          .${p}-add-row:focus-visible {
            border-color: var(--primary);
            background: var(--primary);
            color: #fff;
            box-shadow: 0 2px 8px rgba(218,46,50,.22);
            outline: none;
          }

          /* ── Select ────────────────────────────────────────── */
          .${p}-select {
            width: 100%; padding: 10px 13px;
            border: 1.5px solid var(--border); border-radius: var(--r-md);
            font-size: 14px; font-family: inherit; background: #fafafa; color: var(--dark);
          }
          .${p}-select:focus { outline: none; border-color: var(--primary); background: #fff; }

          /* ── Main buttons ──────────────────────────────────── */
          .${p}-btn {
            width: auto !important;
            padding: 9px 14px; border: none; border-radius: var(--r-md);
            font-size: 13px; font-weight: 600; font-family: inherit;
            cursor: pointer; display: inline-flex; align-items: center;
            gap: 6px; white-space: nowrap; flex: 0 0 auto; transition: all .2s;
          }
          .${p}-btn svg { width: 16px; height: 16px; }
          .${p}-btn:disabled { opacity: .4; cursor: not-allowed !important; transform: none !important; box-shadow: none !important; }
          .${p}-btn-primary {
            background: var(--primary); color: #fff;
            box-shadow: 0 3px 10px rgba(218,46,50,.3);
          }
          .${p}-btn-primary:hover:not(:disabled) { filter: brightness(.88); transform: translateY(-1px); box-shadow: 0 5px 16px rgba(218,46,50,.4); }
          .${p}-spin {
            width: 14px; height: 14px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
            animation: ${p}-spin .7s linear infinite; flex-shrink: 0;
          }
          @keyframes ${p}-spin { to { transform: rotate(360deg); } }

          /* ── Progress ──────────────────────────────────────── */
          .${p}-progress {
            display: none; background: #fff; border-radius: var(--r-md);
            padding: 14px 16px; border: 1px solid var(--border); margin-top: 12px;
          }
          .${p}-prog-meta {
            display: flex; justify-content: space-between;
            font-size: 12px; color: var(--gray); margin-bottom: 7px;
          }
          .${p}-prog-bar { height: 6px; background: #f3f4f6; border-radius: 3px; overflow: hidden; }
          .${p}-prog-fill {
            height: 100%; width: 0%;
            background: linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 60%, #ff6b00));
            border-radius: 3px; transition: width .3s ease;
          }
          .${p}-prog-log { margin-top: 10px; max-height: 90px; overflow-y: auto; font-size: 12px; }
          .${p}-log-item { padding: 3px 0; border-bottom: 1px solid #f3f4f6; color: var(--gray); }
          .${p}-log-item.ok  { color: var(--success); }
          .${p}-log-item.err { color: var(--error); }

          /* ── Status banner ─────────────────────────────────── */
          .${p}-status {
            display: none; padding: 11px 15px; border-radius: var(--r-md);
            margin-top: 12px; font-size: 13px; line-height: 1.5;
          }
          .${p}-status.success { background: rgba(46,125,74,.08); border: 1px solid rgba(46,125,74,.25); color: var(--success); }
          .${p}-status.error   { background: rgba(196,30,58,.08); border: 1px solid rgba(196,30,58,.25); color: var(--error); }
          .${p}-status.info    { background: rgba(218,46,50,.06); border: 1px solid rgba(218,46,50,.2); color: var(--primary); }
        </style>

        <div class="${p}">

          <!-- 1. Target stores -->
          <div class="${p}-card">
            <div class="${p}-card-head">
              <span class="${p}-step">1</span>
              <span class="${p}-card-title">Target ${storeP}</span>
            </div>
            <div class="${p}-card-body">
              <label class="${p}-label">Find ${storeP}</label>
              <div class="${p}-ms-wrap">
                <div class="${p}-ms-trigger" id="${p}-trigger">
                  <span class="${p}-ms-ph">Loading ${storeP.toLowerCase()}…</span>
                </div>
                <div class="${p}-dropdown" id="${p}-dropdown">
                  <div class="${p}-dd-search">
                    <input type="text" id="${p}-search" placeholder="Search ${storeP.toLowerCase()}…">
                  </div>
                  <div class="${p}-dd-list" id="${p}-opts">
                    <div class="${p}-dd-msg">Loading…</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Pull & review -->
          <div class="${p}-card">
            <div class="${p}-card-head">
              <span class="${p}-step">2</span>
              <span class="${p}-card-title">Pull &amp; Review Tasks</span>
            </div>
            <div class="${p}-card-body">
              <label class="${p}-label">Task List Name</label>
              <div class="${p}-input-group">
                <input type="text" class="${p}-input" id="${p}-listname"
                       placeholder="e.g., Q2 Store Checklist">
                <button type="button" class="${p}-icon-btn" id="${p}-pull-btn" title="Pull from External Services">
                  ${iconDownload}
                </button>
              </div>

              <!-- Editable task table — shown after pull -->
              <div class="${p}-tbl-zone" id="${p}-tbl-section" style="display:none">
                <div class="${p}-tbl-meta">
                  <span class="${p}-tbl-label">Review &amp; Edit Tasks</span>
                  <span class="${p}-badge-count" id="${p}-task-count">0 tasks</span>
                </div>
                <div class="${p}-tbl-wrap">
                  <table class="${p}-tbl">
                    <thead>
                      <tr>
                        <th style="width:30%">Title</th>
                        <th>Description</th>
                        <th style="width:140px">Due Date</th>
                        <th style="width:36px"></th>
                      </tr>
                    </thead>
                    <tbody id="${p}-tbody"></tbody>
                  </table>
                </div>
                <button type="button" class="${p}-add-row" id="${p}-add-row" aria-label="Add task">+</button>
              </div>
            </div>
          </div>

          <!-- 3. Optional: update existing list -->
          ${enableUpdating ? `
          <div class="${p}-card">
            <div class="${p}-card-head">
              <span class="${p}-step">3</span>
              <span class="${p}-card-title">Update Existing List <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:#9ca3af">(optional)</span></span>
            </div>
            <div class="${p}-card-body">
              <label class="${p}-label">Select a list to update</label>
              <select class="${p}-select" id="${p}-existing">
                <option value="">— Create a new list —</option>
              </select>
              <p class="${p}-help">If selected, all tasks in that list are replaced. Leave blank to create a new list.</p>
            </div>
          </div>
          ` : ""}

          <!-- Submit -->
          <div style="margin-top:4px">
            <button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-submit" disabled>
              ${iconUpload} update your tasks
            </button>
          </div>

          <div class="${p}-progress" id="${p}-progress">
            <div class="${p}-prog-meta">
              <span id="${p}-prog-label">Working…</span>
              <span id="${p}-prog-pct">0%</span>
            </div>
            <div class="${p}-prog-bar">
              <div class="${p}-prog-fill" id="${p}-prog-fill"></div>
            </div>
            <div class="${p}-prog-log" id="${p}-prog-log"></div>
          </div>

          <div class="${p}-status" id="${p}-status"></div>

        </div>
      `;

      // ── DOM refs ──────────────────────────────────────────────────────
      const trigger    = container.querySelector(`#${p}-trigger`)!;
      const dropdown   = container.querySelector(`#${p}-dropdown`)!;
      const searchInp  = container.querySelector(`#${p}-search`) as HTMLInputElement;
      const optsList   = container.querySelector(`#${p}-opts`)!;
      const listName   = container.querySelector(`#${p}-listname`) as HTMLInputElement;
      const pullBtn    = container.querySelector(`#${p}-pull-btn`) as HTMLButtonElement;
      const tblSection = container.querySelector(`#${p}-tbl-section`)!;
      const tbody      = container.querySelector(`#${p}-tbody`)!;
      const taskCount  = container.querySelector(`#${p}-task-count`)!;
      const addRowBtn  = container.querySelector(`#${p}-add-row`) as HTMLButtonElement;
      const submitBtn  = container.querySelector(`#${p}-submit`) as HTMLButtonElement;
      const progressEl = container.querySelector(`#${p}-progress`)!;
      const progLabel  = container.querySelector(`#${p}-prog-label`)!;
      const progPct    = container.querySelector(`#${p}-prog-pct`)!;
      const progFill   = container.querySelector(`#${p}-prog-fill`) as HTMLElement;
      const progLog    = container.querySelector(`#${p}-prog-log`)!;
      const statusEl   = container.querySelector(`#${p}-status`)!;
      const existingSel = enableUpdating
        ? (container.querySelector(`#${p}-existing`) as HTMLSelectElement)
        : null;

      // ── Helpers ───────────────────────────────────────────────────────
      const authHeaders = () => ({
        Authorization: `Basic ${apiToken}`,
        "Content-Type": "application/json",
      });

      function esc(s: string) {
        return s
          .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
          .replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }

      function showStatus(type: "success" | "error" | "info", msg: string) {
        (statusEl as HTMLElement).className = `${p}-status ${type}`;
        (statusEl as HTMLElement).style.display = "block";
        statusEl.textContent = msg;
      }

      function setProgress(pct: number, label: string) {
        progFill.style.width  = `${pct}%`;
        progPct.textContent   = `${pct}%`;
        progLabel.textContent = label;
      }

      function logLine(text: string, cls: "ok" | "err" | "" = "") {
        const d = document.createElement("div");
        d.className   = `${p}-log-item ${cls}`;
        d.textContent = text;
        progLog.appendChild(d);
        progLog.scrollTop = progLog.scrollHeight;
      }

      function refreshCount() {
        const n = tbody.querySelectorAll("tr").length;
        taskCount.textContent = `${n} task${n !== 1 ? "s" : ""}`;
      }

      function validate() {
        submitBtn.disabled =
          tbody.querySelectorAll("tr").length === 0 ||
          selectedStores.length === 0 ||
          listName.value.trim().length === 0;
      }

      // ── Editable rows ─────────────────────────────────────────────────
      function addRow(title = "", desc = "", dueDate = "") {
        const datePart = dueDate
          ? (() => { try { return new Date(dueDate).toISOString().split("T")[0]; } catch (_) { return ""; } })()
          : "";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><input class="${p}-cell" type="text" value="${esc(title)}"  placeholder="Task title"></td>
          <td><input class="${p}-cell" type="text" value="${esc(desc)}"   placeholder="Description"></td>
          <td><input class="${p}-cell" type="date" value="${datePart}"></td>
          <td><button class="${p}-del-row" title="Remove"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button></td>
        `;
        tr.querySelector(`.${p}-del-row`)!.addEventListener("click", () => {
          tr.remove(); refreshCount(); validate();
        });
        tr.querySelectorAll(`.${p}-cell`).forEach(i =>
          i.addEventListener("input", validate)
        );
        tbody.appendChild(tr);
        refreshCount();
        validate();
      }

      function collectTasks() {
        return Array.from((tbody as HTMLElement).querySelectorAll("tr"))
          .map(row => {
            const tr = row as HTMLTableRowElement;
            const inputs = tr.querySelectorAll<HTMLInputElement>(`.${p}-cell`);
            return {
              title:       inputs[0]?.value.trim() ?? "",
              description: inputs[1]?.value.trim() ?? "",
              dueDate:     inputs[2]?.value
                ? new Date(inputs[2].value).toISOString()
                : null,
            };
          })
          .filter(t => t.title.length > 0);
      }

      // ── Multi-select ──────────────────────────────────────────────────
      function renderOpts(filter = "") {
        const matches = storeProjects.filter(s =>
          s.title.toLowerCase().includes(filter.toLowerCase())
        );
        if (!matches.length) {
          optsList.innerHTML = `<div class="${p}-dd-msg">No ${storeP.toLowerCase()} found</div>`;
          return;
        }
        optsList.innerHTML = matches.map(s => {
          const sel = selectedStores.some(x => x.id === s.id);
          return `
            <div class="${p}-dd-opt ${sel ? "sel" : ""}"
                 data-id="${s.id}" data-title="${esc(s.title)}">
              <span class="${p}-check">${sel ? "&#10003;" : ""}</span>
              <span>${esc(s.title)}</span>
            </div>`;
        }).join("");
        optsList.querySelectorAll(`.${p}-dd-opt`).forEach((opt: Element) =>
          opt.addEventListener("click", () => toggleStore(opt as HTMLElement))
        );
      }

      function toggleStore(opt: HTMLElement) {
        const { id, title } = opt.dataset as { id: string; title: string };
        const idx = selectedStores.findIndex(s => s.id === id);
        if (idx >= 0) selectedStores.splice(idx, 1);
        else selectedStores.push({ id, title });
        renderTrigger();
        renderOpts(searchInp.value);
        if (enableUpdating) loadExistingLists();
        validate();
      }

      function renderTrigger() {
        if (!selectedStores.length) {
          trigger.innerHTML = `<span class="${p}-ms-ph">Select a ${storeS}…</span>`;
          return;
        }
        trigger.innerHTML = selectedStores.map(s =>
          `<span class="${p}-tag">${esc(s.title)}
             <span class="${p}-tag-x" data-id="${s.id}">&times;</span>
           </span>`
        ).join("");
        trigger.querySelectorAll(`.${p}-tag-x`).forEach((btn: Element) =>
          btn.addEventListener("click", (e: Event) => {
            e.stopPropagation();
            selectedStores = selectedStores.filter(
              s => s.id !== (btn as HTMLElement).dataset.id
            );
            renderTrigger();
            renderOpts(searchInp.value);
            if (enableUpdating) loadExistingLists();
            validate();
          })
        );
      }

      trigger.addEventListener("click", () => {
        dropdown.classList.toggle("show");
        trigger.classList.toggle("open");
      });
      document.addEventListener("click", (e: MouseEvent) => {
        if (
          !trigger.contains(e.target as Node) &&
          !dropdown.contains(e.target as Node)
        ) {
          dropdown.classList.remove("show");
          trigger.classList.remove("open");
        }
      });
      searchInp.addEventListener("input", () => renderOpts(searchInp.value));
      listName.addEventListener("input", validate);

      // ── Fetch installations ───────────────────────────────────────────
      async function fetchInstallations() {
        try {
          const res = await fetch(`${baseUrl}/installations?limit=200`, {
            headers: authHeaders(),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          storeProjects = (data.data || data)
            .filter((i: any) => i.pluginID === "tasks" || i.pluginId === "tasks")
            .map((i: any) => ({
              id: i.id,
              title:
                i.config?.localization?.en_US?.title ||
                i.title || i.name || i.id,
            }))
            .sort((a: any, b: any) => a.title.localeCompare(b.title));

          if (!storeProjects.length) {
            optsList.innerHTML = `<div class="${p}-dd-msg">No ${storeP.toLowerCase()} found</div>`;
            trigger.innerHTML  = `<span class="${p}-ms-ph">No ${storeP.toLowerCase()} found</span>`;
          } else {
            trigger.innerHTML = `<span class="${p}-ms-ph">Select a ${storeS}…</span>`;
            renderOpts();
          }
        } catch (_) {
          optsList.innerHTML = `<div class="${p}-dd-msg">Failed to load ${storeP.toLowerCase()}</div>`;
          trigger.innerHTML  = `<span class="${p}-ms-ph">Error loading</span>`;
        }
      }

      // ── Load existing task lists (update mode only) ───────────────────
      async function loadExistingLists() {
        if (!existingSel) return;
        existingSel.innerHTML = `<option value="">— Create a new list —</option>`;
        for (const store of selectedStores) {
          try {
            const res = await fetch(`${baseUrl}/tasks/${store.id}/lists`, {
              headers: authHeaders(),
            });
            if (!res.ok) continue;
            const lists: Array<{ id: string; name: string }> = await res.json();
            lists.forEach(l => {
              const opt = document.createElement("option");
              opt.value       = `${store.id}::${l.id}`;
              opt.textContent = `${store.title} — ${l.name}`;
              existingSel.appendChild(opt);
            });
          } catch (_) { /* skip */ }
        }
      }

      // ── Pull from sheet ───────────────────────────────────────────────
      pullBtn.addEventListener("click", async () => {
        pullBtn.disabled = true;
        pullBtn.innerHTML = `<span class="${p}-spin"></span>`;
        (statusEl as HTMLElement).style.display = "none";

        try {
          const res = await fetch(appsScriptUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          let data: any;
          try {
            data = await res.json();
          } catch (_) {
            throw new Error("Response was not valid JSON — check Apps Script logs for errors");
          }

          if (data.error) {
            throw new Error(`Apps Script error: ${data.error}`);
          }

          const tasks: Array<{
            title: string;
            description: string;
            dueDate: string | null;
          }> = data.tasks || [];

          if (!tasks.length) {
            showStatus("info", "No tasks found in the sheet.");
          } else {
            tbody.innerHTML = "";
            tasks.forEach(t => addRow(t.title, t.description, t.dueDate ?? ""));
            (tblSection as HTMLElement).style.display = "block";
            showStatus(
              "success",
              `Pulled ${tasks.length} task${tasks.length !== 1 ? "s" : ""} — review and edit below, then click update your tasks.`
            );
          }
        } catch (e: any) {
          showStatus("error", `Pull failed: ${e.message}`);
        }

        pullBtn.disabled = false;
        pullBtn.innerHTML = iconDownload;
        validate();
      });

      // ── Add blank row ─────────────────────────────────────────────────
      addRowBtn.addEventListener("click", () => {
        (tblSection as HTMLElement).style.display = "block";
        addRow();
      });

      // ── Update Staffbase ──────────────────────────────────────────────
      submitBtn.addEventListener("click", async () => {
        const tasks = collectTasks();
        if (!tasks.length || !selectedStores.length) return;

        const name         = listName.value.trim();
        const updateTarget = existingSel?.value ?? "";
        const palette      = ["#D62300", "#FF6B00", "#2E7D4A", "#4A90A4", "#8B4513"];
        const color        = palette[Math.floor(Math.random() * palette.length)];

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="${p}-spin"></span> Updating…`;
        (progressEl as HTMLElement).style.display = "block";
        progLog.innerHTML = "";
        (statusEl as HTMLElement).style.display = "none";

        const totalOps = selectedStores.length * (tasks.length + 1);
        let doneOps = 0, okCount = 0, failCount = 0;

        for (const store of selectedStores) {
          try {
            let listId: string;

            if (updateTarget) {
              const [, targetListId] = updateTarget.split("::");
              listId = targetListId;
              setProgress(
                Math.round((doneOps / totalOps) * 100),
                `Clearing ${store.title}…`
              );
              const existing: any[] = await fetch(
                `${baseUrl}/tasks/${store.id}/task?listId=${listId}`,
                { headers: authHeaders() }
              ).then(r => (r.ok ? r.json() : [])).catch(() => []);
              for (const et of existing) {
                await fetch(
                  `${baseUrl}/tasks/${store.id}/task/${et.id}`,
                  { method: "DELETE", headers: authHeaders() }
                ).catch(() => {});
              }
              doneOps++;
            } else {
              setProgress(
                Math.round((doneOps / totalOps) * 100),
                `Creating list in ${store.title}…`
              );
              const listRes = await fetch(`${baseUrl}/tasks/${store.id}/lists`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ name, color }),
              });
              if (!listRes.ok)
                throw new Error(`List creation failed (${listRes.status})`);
              const listData = await listRes.json();
              listId = listData.id ?? listData.data?.id;
              if (!listId) throw new Error("No list ID in response");
              doneOps++;
            }

            let created = 0;
            for (let j = 0; j < tasks.length; j++) {
              const t = tasks[j];
              setProgress(
                Math.round((doneOps / totalOps) * 100),
                `Task ${j + 1}/${tasks.length} → ${store.title}…`
              );
              try {
                const body: Record<string, unknown> = {
                  title:       t.title,
                  description: t.description,
                  status:      "OPEN",
                  priority:    "Priority_3",
                  taskListId:  listId,
                };
                if (t.dueDate) body.dueDate = t.dueDate;
                const r = await fetch(`${baseUrl}/tasks/${store.id}/task`, {
                  method: "POST",
                  headers: authHeaders(),
                  body: JSON.stringify(body),
                });
                if (r.ok) created++;
              } catch (_) { /* non-fatal */ }
              doneOps++;
              await new Promise(r => setTimeout(r, 50));
            }

            logLine(`\u2713 ${store.title}: ${created} task${created !== 1 ? "s" : ""} added`, "ok");
            okCount++;
          } catch (e: any) {
            logLine(`\u2717 ${store.title}: ${e.message}`, "err");
            failCount++;
            doneOps += tasks.length + 1;
          }
        }

        setProgress(100, "Done!");

        if (failCount === 0) {
          showStatus(
            "success",
            `All done! "${name}" with ${tasks.length} tasks pushed to ${okCount} ${okCount === 1 ? storeS : storeP}.`
          );
        } else if (okCount > 0) {
          showStatus("info", `Partial success: ${okCount} succeeded, ${failCount} failed.`);
        } else {
          showStatus("error", "All failed. Check your API token and installation IDs.");
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = `${iconUpload} update your tasks`;
        validate();
      });

      // ── Init ──────────────────────────────────────────────────────────
      fetchInstallations();
    }

    static get observedAttributes() {
      return [
        "appsscripturl",
        "apitoken",
        "baseurl",
        "primarycolor",
        "accentcolor",
        "backgroundcolor",
        "storelabelsingular",
        "storelabelplural",
        "enabletasklistupdating",
      ];
    }
  };
};

// ── Block registration ────────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name: "tasks-integration-widget",
  label: "Tasks Integration Widget",
  attributes: [
    "appsscripturl",
    "apitoken",
    "baseurl",
    "primarycolor",
    "accentcolor",
    "backgroundcolor",
    "storelabelsingular",
    "storelabelplural",
    "enabletasklistupdating",
  ],
  factory,
  configurationSchema,
  uiSchema,
  blockLevel: "block",
  iconUrl: "",
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: "Staffbase",
  version: "1.0.0",
};

window.defineBlock(externalBlockDefinition);
