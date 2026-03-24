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
const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbytx8eg-33bq7lCfK7FM0DzbnL2jSBW7j2i6LDbhs5Rjd2Iqy8BHxstqJf1IRFaXaIa/exec";
const DEFAULT_API_TOKEN = "NjljMjU3N2JjZmFjZWYxMzc4MzIzYTNkOkp6VEpkaGlfclRyRDk4bjlBZ2pIdXFkcmI3UjQhdl1LTm1RV1hwOHBIdUd+Unl3clk7MjYhSS1JdiprLGdOaVI=";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#da2e32";
const DEFAULT_ACCENT_COLOR = "#da2e32";
// ── Config schema ─────────────────────────────────────────────────────────────
const configurationSchema = {
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
const uiSchema = {
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
        "ui:help": "When enabled, select an existing task list to update instead of always creating a new one",
    },
};
// ── Widget factory ────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, _widgetApi) => {
    return class TasksIntegrationWidget extends BaseBlockClass {
        constructor() {
            super();
        }
        renderBlock(container) {
            return __awaiter(this, void 0, void 0, function* () {
                const appsScriptUrl = this.getAttribute("appsscripturl") || DEFAULT_APPS_SCRIPT_URL;
                const apiToken = this.getAttribute("apitoken") || DEFAULT_API_TOKEN;
                const baseUrl = (this.getAttribute("baseurl") || DEFAULT_BASE_URL).replace(/\/$/, "");
                const primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
                const accentColor = this.getAttribute("accentcolor") || DEFAULT_ACCENT_COLOR;
                const bgColor = this.getAttribute("backgroundcolor") || "";
                const storeS = this.getAttribute("storelabelsingular") || "Store";
                const storeP = this.getAttribute("storelabelplural") || "Stores";
                const enableUpdating = this.getAttribute("enabletasklistupdating") === "true";
                let storeProjects = [];
                let selectedStores = [];
                const p = "tiw";
                container.innerHTML = `
        <style>
          .${p} {
            --primary: ${primaryColor};
            --accent:  ${accentColor};
            --bg-dark: #f0e0d6;
            --dark:    #1A1A1A;
            --gray:    #666;
            --success: #2E7D4A;
            --error:   #C41E3A;
            --r-sm: 6px; --r-md: 10px; --r-lg: 16px;
            --shadow: 0 4px 14px rgba(0,0,0,0.09);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: var(--dark);
            background: ${bgColor || "transparent"};
            padding: 20px;
          }
          .${p} *, .${p} *::before, .${p} *::after {
            box-sizing: border-box; margin: 0; padding: 0;
          }

          /* Cards */
          .${p}-card {
            background: #fff; border-radius: var(--r-lg);
            box-shadow: var(--shadow); padding: 20px;
            margin-bottom: 16px;
            border: 1px solid rgba(0,0,0,0.06);
          }
          .${p}-card-title {
            font-size: 11px; font-weight: 800; letter-spacing: 1px;
            text-transform: uppercase; color: var(--primary);
            margin-bottom: 12px;
          }
          .${p}-label {
            display: block; font-size: 13px; font-weight: 600;
            color: var(--dark); margin-bottom: 6px;
          }
          .${p}-help { font-size: 12px; color: var(--gray); margin-top: 5px; }

          /* Text input */
          .${p}-input {
            width: 100%; padding: 10px 13px;
            border: 2px solid #e0e0e0; border-radius: var(--r-md);
            font-size: 14px; font-family: inherit; transition: border-color .2s;
          }
          .${p}-input:focus {
            outline: none; border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(214,35,0,.12);
          }

          /* Multi-select trigger */
          .${p}-ms-wrap { position: relative; }
          .${p}-ms-trigger {
            width: 100%; min-height: 46px; padding: 8px 38px 8px 11px;
            border: 2px solid #e0e0e0; border-radius: var(--r-md);
            background: #fff; cursor: pointer;
            display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
            position: relative; transition: border-color .2s;
          }
          .${p}-ms-trigger:hover, .${p}-ms-trigger.open { border-color: var(--primary); }
          .${p}-ms-trigger::after {
            content: '▾'; position: absolute; right: 12px; top: 50%;
            transform: translateY(-50%); color: var(--gray); pointer-events: none;
          }
          .${p}-ms-ph { color: #aaa; font-size: 14px; }
          .${p}-tag {
            display: inline-flex; align-items: center; gap: 4px;
            background: var(--primary); color: #fff;
            padding: 4px 9px; border-radius: 20px;
            font-size: 12px; font-weight: 600;
          }
          .${p}-tag-x { cursor: pointer; font-size: 14px; opacity: .8; }
          .${p}-tag-x:hover { opacity: 1; }

          /* Dropdown */
          .${p}-dropdown {
            display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
            background: #fff; border: 2px solid var(--primary);
            border-radius: var(--r-md); box-shadow: 0 8px 24px rgba(0,0,0,.13);
            max-height: 280px; overflow: hidden; z-index: 200;
          }
          .${p}-dropdown.show { display: block; }
          .${p}-dd-search { padding: 10px; border-bottom: 1px solid #eee; }
          .${p}-dd-search input {
            width: 100%; padding: 7px 11px; border: 1px solid #e0e0e0;
            border-radius: var(--r-sm); font-size: 13px;
          }
          .${p}-dd-list { max-height: 220px; overflow-y: auto; }
          .${p}-dd-opt {
            padding: 11px 13px; cursor: pointer;
            display: flex; align-items: center; gap: 9px;
            font-size: 13px; border-bottom: 1px solid #f5f5f5;
          }
          .${p}-dd-opt:hover { background: #fff5f0; }
          .${p}-dd-opt.sel { background: rgba(214,35,0,.07); }
          .${p}-check {
            width: 17px; height: 17px; border: 2px solid #ccc;
            border-radius: 3px; flex-shrink: 0; font-size: 11px;
            display: flex; align-items: center; justify-content: center; color: transparent;
          }
          .${p}-dd-opt.sel .${p}-check {
            background: var(--primary); border-color: var(--primary); color: #fff;
          }
          .${p}-dd-msg { padding: 20px; text-align: center; color: var(--gray); font-size: 13px; }

          /* Editable table */
          .${p}-tbl-wrap {
            overflow-x: auto; margin-top: 12px;
            border: 1px solid #e5e5e5; border-radius: var(--r-md);
          }
          .${p}-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
          .${p}-tbl th {
            background: var(--dark); color: #fff;
            padding: 9px 11px; text-align: left; font-weight: 600;
          }
          .${p}-tbl td { padding: 5px 7px; border-bottom: 1px solid #f0f0f0; }
          .${p}-tbl tr:last-child td { border-bottom: none; }
          .${p}-tbl tr:hover td { background: #fff5f0; }
          .${p}-cell {
            width: 100%; padding: 6px 8px; border: 1px solid transparent;
            border-radius: 4px; font-size: 13px; font-family: inherit; background: transparent;
          }
          .${p}-cell:focus { outline: none; border-color: var(--accent); background: #fff; }
          .${p}-del-row {
            width: 26px; height: 26px; border: none; background: none;
            cursor: pointer; color: #ccc; font-size: 16px; border-radius: 4px;
            display: flex; align-items: center; justify-content: center;
          }
          .${p}-del-row:hover { background: #fee2e2; color: var(--error); }
          .${p}-add-row {
            margin-top: 10px; background: none;
            border: 2px dashed #d0d0d0; border-radius: var(--r-sm);
            padding: 8px 14px; font-size: 13px; color: var(--gray);
            cursor: pointer; width: 100%; transition: all .2s;
          }
          .${p}-add-row:hover { border-color: var(--accent); color: var(--accent); }

          /* Count badge */
          .${p}-badge-count {
            display: inline-block; background: var(--primary); color: #fff;
            padding: 2px 9px; border-radius: 20px;
            font-size: 11px; font-weight: 700; margin-left: 8px;
          }

          /* Select */
          .${p}-select {
            width: 100%; padding: 10px 13px;
            border: 2px solid #e0e0e0; border-radius: var(--r-md);
            font-size: 14px; font-family: inherit; background: #fff;
          }
          .${p}-select:focus { outline: none; border-color: var(--primary); }

          /* Buttons — fit content, never stretch */
          .${p}-btn-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-start; }
          .${p}-btn {
            padding: 11px 20px; border: none; border-radius: var(--r-md);
            font-size: 14px; font-weight: 700; font-family: inherit;
            cursor: pointer; display: inline-flex; align-items: center;
            gap: 8px; white-space: nowrap; width: auto; flex: 0 0 auto; transition: all .2s;
          }
          .${p}-btn:disabled { opacity: .4; cursor: not-allowed !important; transform: none !important; }
          .${p}-btn-primary {
            background: var(--primary); color: #fff;
            box-shadow: 0 3px 10px rgba(214,35,0,.3);
          }
          .${p}-btn-primary:hover:not(:disabled) { filter: brightness(.88); transform: translateY(-1px); }
          .${p}-btn-secondary {
            background: var(--accent); color: #fff;
            box-shadow: 0 3px 10px rgba(255,107,0,.3);
          }
          .${p}-btn-secondary:hover:not(:disabled) { filter: brightness(.9); transform: translateY(-1px); }
          .${p}-spin {
            width: 14px; height: 14px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
            animation: ${p}-spin .7s linear infinite; flex-shrink: 0;
          }
          @keyframes ${p}-spin { to { transform: rotate(360deg); } }

          /* Progress */
          .${p}-progress {
            display: none; background: #fff; border-radius: var(--r-md);
            padding: 15px; border: 1px solid #e5e5e5; margin-top: 14px;
          }
          .${p}-prog-meta {
            display: flex; justify-content: space-between;
            font-size: 12px; color: var(--gray); margin-bottom: 6px;
          }
          .${p}-prog-bar { height: 7px; background: #f0e0d6; border-radius: 4px; overflow: hidden; }
          .${p}-prog-fill {
            height: 100%; width: 0%;
            background: linear-gradient(90deg, var(--primary), var(--accent));
            border-radius: 4px; transition: width .3s ease;
          }
          .${p}-prog-log { margin-top: 10px; max-height: 90px; overflow-y: auto; font-size: 12px; }
          .${p}-log-item { padding: 3px 0; border-bottom: 1px solid #f5f5f5; }
          .${p}-log-item.ok  { color: var(--success); }
          .${p}-log-item.err { color: var(--error); }

          /* Status banner */
          .${p}-status {
            display: none; padding: 11px 15px; border-radius: var(--r-md);
            margin-top: 12px; font-size: 13px; line-height: 1.5;
          }
          .${p}-status.success { background: rgba(46,125,74,.1); border: 1px solid rgba(46,125,74,.3); color: var(--success); }
          .${p}-status.error   { background: rgba(196,30,58,.1); border: 1px solid rgba(196,30,58,.3); color: var(--error); }
          .${p}-status.info    { background: rgba(214,35,0,.07); border: 1px solid rgba(214,35,0,.2); color: var(--primary); }
        </style>

        <div class="${p}">

          <!-- 1. Target stores -->
          <div class="${p}-card">
            <div class="${p}-card-title">1 — Target ${storeP}</div>
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

          <!-- 2. Pull & review -->
          <div class="${p}-card">
            <div class="${p}-card-title">2 — Pull &amp; Review Tasks</div>
            <div style="margin-bottom:14px">
              <label class="${p}-label">Task List Name</label>
              <input type="text" class="${p}-input" id="${p}-listname"
                     placeholder="e.g., Q2 Store Checklist">
            </div>
            <div class="${p}-btn-row">
              <button class="${p}-btn ${p}-btn-secondary" id="${p}-pull-btn">
                &#8595; Pull from External Services
              </button>
            </div>

            <!-- Editable preview table — shown after pull -->
            <div id="${p}-tbl-section" style="display:none;margin-top:20px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span class="${p}-label" style="margin:0">Review &amp; Edit Tasks</span>
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
              <button class="${p}-add-row" id="${p}-add-row">+ Add row</button>
            </div>
          </div>

          <!-- 3. Optional: update existing list -->
          ${enableUpdating ? `
          <div class="${p}-card">
            <div class="${p}-card-title">
              3 — Update Existing List
              <span style="font-weight:400;text-transform:none;font-size:11px;color:var(--gray)">&nbsp;(optional)</span>
            </div>
            <label class="${p}-label">Select an existing task list to update</label>
            <select class="${p}-select" id="${p}-existing">
              <option value="">— Create a new list —</option>
            </select>
            <p class="${p}-help">
              If selected, all tasks in that list are replaced with the tasks above.
              Leave blank to always create a new list.
            </p>
          </div>
          ` : ""}

          <!-- Submit -->
          <div class="${p}-btn-row" style="margin-top:4px">
            <button class="${p}-btn ${p}-btn-primary" id="${p}-submit" disabled>
              &#10003; Update Staffbase
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
                const trigger = container.querySelector(`#${p}-trigger`);
                const dropdown = container.querySelector(`#${p}-dropdown`);
                const searchInp = container.querySelector(`#${p}-search`);
                const optsList = container.querySelector(`#${p}-opts`);
                const listName = container.querySelector(`#${p}-listname`);
                const pullBtn = container.querySelector(`#${p}-pull-btn`);
                const tblSection = container.querySelector(`#${p}-tbl-section`);
                const tbody = container.querySelector(`#${p}-tbody`);
                const taskCount = container.querySelector(`#${p}-task-count`);
                const addRowBtn = container.querySelector(`#${p}-add-row`);
                const submitBtn = container.querySelector(`#${p}-submit`);
                const progressEl = container.querySelector(`#${p}-progress`);
                const progLabel = container.querySelector(`#${p}-prog-label`);
                const progPct = container.querySelector(`#${p}-prog-pct`);
                const progFill = container.querySelector(`#${p}-prog-fill`);
                const progLog = container.querySelector(`#${p}-prog-log`);
                const statusEl = container.querySelector(`#${p}-status`);
                const existingSel = enableUpdating
                    ? container.querySelector(`#${p}-existing`)
                    : null;
                // ── Helpers ───────────────────────────────────────────────────────
                const authHeaders = () => ({
                    Authorization: `Basic ${apiToken}`,
                    "Content-Type": "application/json",
                });
                function esc(s) {
                    return s
                        .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
                        .replace(/</g, "&lt;").replace(/>/g, "&gt;");
                }
                function showStatus(type, msg) {
                    statusEl.className = `${p}-status ${type}`;
                    statusEl.style.display = "block";
                    statusEl.textContent = msg;
                }
                function setProgress(pct, label) {
                    progFill.style.width = `${pct}%`;
                    progPct.textContent = `${pct}%`;
                    progLabel.textContent = label;
                }
                function logLine(text, cls = "") {
                    const d = document.createElement("div");
                    d.className = `${p}-log-item ${cls}`;
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
                        ? (() => { try {
                            return new Date(dueDate).toISOString().split("T")[0];
                        }
                        catch (_) {
                            return "";
                        } })()
                        : "";
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
          <td><input class="${p}-cell" type="text" value="${esc(title)}"  placeholder="Task title"></td>
          <td><input class="${p}-cell" type="text" value="${esc(desc)}"   placeholder="Description"></td>
          <td><input class="${p}-cell" type="date" value="${datePart}"></td>
          <td><button class="${p}-del-row" title="Remove">&times;</button></td>
        `;
                    tr.querySelector(`.${p}-del-row`).addEventListener("click", () => {
                        tr.remove();
                        refreshCount();
                        validate();
                    });
                    tr.querySelectorAll(`.${p}-cell`).forEach(i => i.addEventListener("input", validate));
                    tbody.appendChild(tr);
                    refreshCount();
                    validate();
                }
                function collectTasks() {
                    return Array.from(tbody.querySelectorAll("tr"))
                        .map(row => {
                        var _a, _b, _c, _d, _e;
                        const tr = row;
                        const inputs = tr.querySelectorAll(`.${p}-cell`);
                        return {
                            title: (_b = (_a = inputs[0]) === null || _a === void 0 ? void 0 : _a.value.trim()) !== null && _b !== void 0 ? _b : "",
                            description: (_d = (_c = inputs[1]) === null || _c === void 0 ? void 0 : _c.value.trim()) !== null && _d !== void 0 ? _d : "",
                            dueDate: ((_e = inputs[2]) === null || _e === void 0 ? void 0 : _e.value)
                                ? new Date(inputs[2].value).toISOString()
                                : null,
                        };
                    })
                        .filter(t => t.title.length > 0);
                }
                // ── Multi-select ──────────────────────────────────────────────────
                function renderOpts(filter = "") {
                    const matches = storeProjects.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()));
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
                    optsList.querySelectorAll(`.${p}-dd-opt`).forEach((opt) => opt.addEventListener("click", () => toggleStore(opt)));
                }
                function toggleStore(opt) {
                    const { id, title } = opt.dataset;
                    const idx = selectedStores.findIndex(s => s.id === id);
                    if (idx >= 0)
                        selectedStores.splice(idx, 1);
                    else
                        selectedStores.push({ id, title });
                    renderTrigger();
                    renderOpts(searchInp.value);
                    if (enableUpdating)
                        loadExistingLists();
                    validate();
                }
                function renderTrigger() {
                    if (!selectedStores.length) {
                        trigger.innerHTML = `<span class="${p}-ms-ph">Select a ${storeS}…</span>`;
                        return;
                    }
                    trigger.innerHTML = selectedStores.map(s => `<span class="${p}-tag">${esc(s.title)}
             <span class="${p}-tag-x" data-id="${s.id}">&times;</span>
           </span>`).join("");
                    trigger.querySelectorAll(`.${p}-tag-x`).forEach((btn) => btn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        selectedStores = selectedStores.filter(s => s.id !== btn.dataset.id);
                        renderTrigger();
                        renderOpts(searchInp.value);
                        if (enableUpdating)
                            loadExistingLists();
                        validate();
                    }));
                }
                trigger.addEventListener("click", () => {
                    dropdown.classList.toggle("show");
                    trigger.classList.toggle("open");
                });
                document.addEventListener("click", (e) => {
                    if (!trigger.contains(e.target) &&
                        !dropdown.contains(e.target)) {
                        dropdown.classList.remove("show");
                        trigger.classList.remove("open");
                    }
                });
                searchInp.addEventListener("input", () => renderOpts(searchInp.value));
                listName.addEventListener("input", validate);
                // ── Fetch installations ───────────────────────────────────────────
                function fetchInstallations() {
                    return __awaiter(this, void 0, void 0, function* () {
                        try {
                            const res = yield fetch(`${baseUrl}/installations?limit=200`, {
                                headers: authHeaders(),
                            });
                            if (!res.ok)
                                throw new Error(`HTTP ${res.status}`);
                            const data = yield res.json();
                            storeProjects = (data.data || data)
                                .filter((i) => i.pluginID === "tasks" || i.pluginId === "tasks")
                                .map((i) => {
                                var _a, _b, _c;
                                return ({
                                    id: i.id,
                                    title: ((_c = (_b = (_a = i.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title) ||
                                        i.title || i.name || i.id,
                                });
                            })
                                .sort((a, b) => a.title.localeCompare(b.title));
                            if (!storeProjects.length) {
                                optsList.innerHTML = `<div class="${p}-dd-msg">No ${storeP.toLowerCase()} found</div>`;
                                trigger.innerHTML = `<span class="${p}-ms-ph">No ${storeP.toLowerCase()} found</span>`;
                            }
                            else {
                                trigger.innerHTML = `<span class="${p}-ms-ph">Select a ${storeS}…</span>`;
                                renderOpts();
                            }
                        }
                        catch (_) {
                            optsList.innerHTML = `<div class="${p}-dd-msg">Failed to load ${storeP.toLowerCase()}</div>`;
                            trigger.innerHTML = `<span class="${p}-ms-ph">Error loading</span>`;
                        }
                    });
                }
                // ── Load existing task lists (update mode only) ───────────────────
                function loadExistingLists() {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (!existingSel)
                            return;
                        existingSel.innerHTML = `<option value="">— Create a new list —</option>`;
                        for (const store of selectedStores) {
                            try {
                                const res = yield fetch(`${baseUrl}/tasks/${store.id}/lists`, {
                                    headers: authHeaders(),
                                });
                                if (!res.ok)
                                    continue;
                                const lists = yield res.json();
                                lists.forEach(l => {
                                    const opt = document.createElement("option");
                                    opt.value = `${store.id}::${l.id}`;
                                    opt.textContent = `${store.title} — ${l.name}`;
                                    existingSel.appendChild(opt);
                                });
                            }
                            catch (_) { /* skip */ }
                        }
                    });
                }
                // ── Pull from sheet ───────────────────────────────────────────────
                pullBtn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                    pullBtn.disabled = true;
                    pullBtn.innerHTML = `<span class="${p}-spin"></span> Pulling…`;
                    statusEl.style.display = "none";
                    try {
                        // Apps Script 302-redirects to googleusercontent.com.
                        // Fetching the redirect URL directly avoids the cross-origin
                        // redirect CORS failure that can occur inside sandboxed iframes.
                        const redirect = yield fetch(appsScriptUrl, { redirect: "manual" });
                        const finalUrl = redirect.headers.get("location") || appsScriptUrl;
                        const res = yield fetch(finalUrl);
                        if (!res.ok)
                            throw new Error(`HTTP ${res.status}`);
                        let data;
                        try {
                            data = yield res.json();
                        }
                        catch (_) {
                            throw new Error("Response was not valid JSON — check Apps Script logs for errors");
                        }
                        if (data.error) {
                            throw new Error(`Apps Script error: ${data.error}`);
                        }
                        const tasks = data.tasks || [];
                        if (!tasks.length) {
                            showStatus("info", "No tasks found in the sheet.");
                        }
                        else {
                            tbody.innerHTML = "";
                            tasks.forEach(t => { var _a; return addRow(t.title, t.description, (_a = t.dueDate) !== null && _a !== void 0 ? _a : ""); });
                            tblSection.style.display = "block";
                            showStatus("success", `Pulled ${tasks.length} task${tasks.length !== 1 ? "s" : ""} — review and edit below, then click Update Staffbase.`);
                        }
                    }
                    catch (e) {
                        showStatus("error", `Pull failed: ${e.message}`);
                    }
                    pullBtn.disabled = false;
                    pullBtn.innerHTML = "&#8595; Pull from External Services";
                    validate();
                }));
                // ── Add blank row ─────────────────────────────────────────────────
                addRowBtn.addEventListener("click", () => {
                    tblSection.style.display = "block";
                    addRow();
                });
                // ── Update Staffbase ──────────────────────────────────────────────
                submitBtn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c;
                    const tasks = collectTasks();
                    if (!tasks.length || !selectedStores.length)
                        return;
                    const name = listName.value.trim();
                    const updateTarget = (_a = existingSel === null || existingSel === void 0 ? void 0 : existingSel.value) !== null && _a !== void 0 ? _a : "";
                    const palette = ["#D62300", "#FF6B00", "#2E7D4A", "#4A90A4", "#8B4513"];
                    const color = palette[Math.floor(Math.random() * palette.length)];
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<span class="${p}-spin"></span> Updating…`;
                    progressEl.style.display = "block";
                    progLog.innerHTML = "";
                    statusEl.style.display = "none";
                    const totalOps = selectedStores.length * (tasks.length + 1);
                    let doneOps = 0, okCount = 0, failCount = 0;
                    for (const store of selectedStores) {
                        try {
                            let listId;
                            if (updateTarget) {
                                const [, targetListId] = updateTarget.split("::");
                                listId = targetListId;
                                setProgress(Math.round((doneOps / totalOps) * 100), `Clearing ${store.title}…`);
                                const existing = yield fetch(`${baseUrl}/tasks/${store.id}/task?listId=${listId}`, { headers: authHeaders() }).then(r => (r.ok ? r.json() : [])).catch(() => []);
                                for (const et of existing) {
                                    yield fetch(`${baseUrl}/tasks/${store.id}/task/${et.id}`, { method: "DELETE", headers: authHeaders() }).catch(() => { });
                                }
                                doneOps++;
                            }
                            else {
                                setProgress(Math.round((doneOps / totalOps) * 100), `Creating list in ${store.title}…`);
                                const listRes = yield fetch(`${baseUrl}/tasks/${store.id}/lists`, {
                                    method: "POST",
                                    headers: authHeaders(),
                                    body: JSON.stringify({ name, color }),
                                });
                                if (!listRes.ok)
                                    throw new Error(`List creation failed (${listRes.status})`);
                                const listData = yield listRes.json();
                                listId = (_b = listData.id) !== null && _b !== void 0 ? _b : (_c = listData.data) === null || _c === void 0 ? void 0 : _c.id;
                                if (!listId)
                                    throw new Error("No list ID in response");
                                doneOps++;
                            }
                            let created = 0;
                            for (let j = 0; j < tasks.length; j++) {
                                const t = tasks[j];
                                setProgress(Math.round((doneOps / totalOps) * 100), `Task ${j + 1}/${tasks.length} → ${store.title}…`);
                                try {
                                    const body = {
                                        title: t.title,
                                        description: t.description,
                                        status: "OPEN",
                                        priority: "Priority_3",
                                        taskListId: listId,
                                    };
                                    if (t.dueDate)
                                        body.dueDate = t.dueDate;
                                    const r = yield fetch(`${baseUrl}/tasks/${store.id}/task`, {
                                        method: "POST",
                                        headers: authHeaders(),
                                        body: JSON.stringify(body),
                                    });
                                    if (r.ok)
                                        created++;
                                }
                                catch (_) { /* non-fatal */ }
                                doneOps++;
                                yield new Promise(r => setTimeout(r, 50));
                            }
                            logLine(`\u2713 ${store.title}: ${created} task${created !== 1 ? "s" : ""} added`, "ok");
                            okCount++;
                        }
                        catch (e) {
                            logLine(`\u2717 ${store.title}: ${e.message}`, "err");
                            failCount++;
                            doneOps += tasks.length + 1;
                        }
                    }
                    setProgress(100, "Done!");
                    if (failCount === 0) {
                        showStatus("success", `All done! "${name}" with ${tasks.length} tasks pushed to ${okCount} ${okCount === 1 ? storeS : storeP}.`);
                    }
                    else if (okCount > 0) {
                        showStatus("info", `Partial success: ${okCount} succeeded, ${failCount} failed.`);
                    }
                    else {
                        showStatus("error", "All failed. Check your API token and installation IDs.");
                    }
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = "&#10003; Update Staffbase";
                    validate();
                }));
                // ── Init ──────────────────────────────────────────────────────────
                fetchInstallations();
            });
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
const blockDefinition = {
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
const externalBlockDefinition = {
    blockDefinition,
    author: "Staffbase",
    version: "1.0.0",
};
window.defineBlock(externalBlockDefinition);


/******/ })()
;