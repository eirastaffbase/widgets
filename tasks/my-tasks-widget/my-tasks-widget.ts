import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from "@staffbase/widget-sdk";

import { JSONSchema7 } from "json-schema";
import { UiSchema } from "@rjsf/utils";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_API_TOKEN =
  "NjljMjU3N2JjZmFjZWYxMzc4MzIzYTNkOkp6VEpkaGlfclRyRDk4bjlBZ2pIdXFkcmI3UjQhdl1LTm1RV1hwOHBIdUd+Unl3clk7MjYhSS1JdiprLGdOaVI=";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#da2e32";
const DEFAULT_ACCENT_COLOR  = "#da2e32";

// ── Config schema ─────────────────────────────────────────────────────────────

const configurationSchema: JSONSchema7 = {
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

const uiSchema: UiSchema = {
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

// ── Task type parsing ─────────────────────────────────────────────────────────

const TYPE_REGEX = /\[type:\s*([^\]]+)\]/i;

function parseTaskType(text: string): string | null {
  const m = TYPE_REGEX.exec(text);
  return m ? m[1].trim().toLowerCase() : null;
}

function stripTypeTag(text: string): string {
  return text.replace(TYPE_REGEX, "").replace(/\s{2,}/g, " ").trim();
}

// ── Color palette for type badges ─────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  storetask:    "#da2e32",
  compliance:   "#8B4513",
  maintenance:  "#2E7D4A",
  training:     "#4A90A4",
  audit:        "#7C3AED",
  safety:       "#D97706",
  inventory:    "#0369A1",
};

function typeColor(type: string): string {
  if (TYPE_COLORS[type]) return TYPE_COLORS[type];
  // Simple hash for unknown types
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) & 0xffffff;
  const hue = ((h >> 16) & 0xff) % 360;
  return `hsl(${hue}, 55%, 40%)`;
}

// ── Priority helpers ──────────────────────────────────────────────────────────

function priorityLabel(p: string): string {
  if (p === "Priority_1") return "High";
  if (p === "Priority_2") return "Med";
  return "Low";
}

function priorityColor(p: string): string {
  if (p === "Priority_1") return "#C41E3A";
  if (p === "Priority_2") return "#D97706";
  return "#6b7280";
}

// ── Widget factory ────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class MyTasksWidget extends BaseBlockClass implements BaseBlock {
    constructor() {
      super();
    }

    async renderBlock(container: any) {
      const apiToken   = this.getAttribute("apitoken")   || DEFAULT_API_TOKEN;
      const baseUrl    = (this.getAttribute("baseurl")   || DEFAULT_BASE_URL).replace(/\/$/, "");
      const primaryColor = this.getAttribute("primarycolor") || DEFAULT_PRIMARY_COLOR;
      const accentColor  = this.getAttribute("accentcolor")  || DEFAULT_ACCENT_COLOR;
      const bgColor      = this.getAttribute("backgroundcolor") || "";
      const showAll      = this.getAttribute("showalltasks") === "true";
      const showDone     = this.getAttribute("showdonetasks") !== "false";

      const p = "mtw";

      // ── State ──────────────────────────────────────────────────────────
      type Task = {
        id: string;
        title: string;
        description: string;
        status: string;
        priority: string;
        dueDate: string | null;
        taskType: string | null;
        installationId: string;
        installationTitle: string;
        listName: string;
      };

      let allTasks: Task[]          = [];
      let activeTypeFilters         = new Set<string>(); // empty = "All"
      let activeStatusFilter        = "open";
      let activeInstallFilter       = "all";

      // ── Render skeleton ────────────────────────────────────────────────
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
            background: var(--primary); color: #fff;
            padding: 2px 9px; border-radius: 20px;
            font-size: 11px; font-weight: 700;
          }
          .${p}-refresh-btn {
            width: 34px; height: 34px; border: 1.5px solid var(--border);
            border-radius: var(--r-md); background: #fff; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: var(--gray); transition: all .15s;
          }
          .${p}-refresh-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(218,46,50,.05); }
          .${p}-refresh-btn:disabled { opacity: .4; cursor: not-allowed; }
          .${p}-spin {
            width: 14px; height: 14px; border-radius: 50%;
            border: 2px solid rgba(218,46,50,.25); border-top-color: var(--primary);
            animation: ${p}-spin .7s linear infinite; flex-shrink: 0; display: inline-block;
          }
          @keyframes ${p}-spin { to { transform: rotate(360deg); } }

          /* ── Store tabs (real tab bar) ──────────────────────── */
          .${p}-store-tabs {
            display: flex; overflow-x: auto; scrollbar-width: none;
            border-bottom: 2px solid var(--border); margin-bottom: 14px; gap: 0;
          }
          .${p}-store-tabs::-webkit-scrollbar { display: none; }
          .${p}-store-tab {
            padding: 7px 16px; border: none; background: none;
            border-bottom: 2px solid transparent; margin-bottom: -2px;
            font-size: 13px; font-weight: 600; color: var(--gray);
            cursor: pointer; font-family: inherit; transition: all .15s;
            white-space: nowrap; flex-shrink: 0;
          }
          .${p}-store-tab:hover { color: var(--dark); }
          .${p}-store-tab.active { color: var(--primary); border-bottom-color: var(--primary); }

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
          .${p}-type-opt.active { font-weight: 700; color: var(--dark); background: rgba(218,46,50,.06); }
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
          .${p}-status-opt.active { background: var(--primary); color: #fff; }

          /* ── Task cards ────────────────────────────────────── */
          .${p}-list { display: flex; flex-direction: column; gap: 8px; }

          .${p}-card {
            background: #fff;
            border-radius: var(--r-lg);
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border);
            border-left: 3px solid var(--primary);
            overflow: hidden;
            transition: box-shadow .18s ease, background .18s ease;
          }
          .${p}-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.07); }
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
            flex-shrink: 0; padding-top: 2px;
          }
          .${p}-check {
            width: 18px; height: 18px; border-radius: 50%;
            border: 2px solid #d1d5db; background: #fff;
            cursor: pointer; display: flex; align-items: center;
            justify-content: center; transition: all .15s; flex-shrink: 0;
          }
          .${p}-check:hover { border-color: var(--primary); background: rgba(218,46,50,.05); }
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
          .${p}-card.done .${p}-card-title {
            text-decoration: line-through; color: var(--gray);
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
          .${p}-banner.info  { background: rgba(218,46,50,.06); border: 1px solid rgba(218,46,50,.2); color: var(--primary); }

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
      const countEl      = container.querySelector(`#${p}-count`)!;
      const bannerEl     = container.querySelector(`#${p}-banner`) as HTMLElement;
      const storeTabs    = container.querySelector(`#${p}-store-tabs`) as HTMLElement;
      const listWrap     = container.querySelector(`#${p}-list-wrap`)!;
      const typeBtn      = container.querySelector(`#${p}-type-btn`) as HTMLButtonElement;
      const typeLabelEl  = container.querySelector(`#${p}-type-label`) as HTMLElement;
      const typeMenu     = container.querySelector(`#${p}-type-menu`) as HTMLElement;
      const refreshBtn   = container.querySelector(`#${p}-refresh`) as HTMLButtonElement;

      // ── Helpers ───────────────────────────────────────────────────────
      const apiOpts = (extra?: RequestInit): RequestInit => ({
        ...extra,
        credentials: "omit",
        headers: {
          Authorization: `Basic ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      function esc(s: string) {
        return s
          .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
          .replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }

      function showBanner(type: "error" | "info", msg: string) {
        bannerEl.className = `${p}-banner ${type}`;
        bannerEl.style.display = "block";
        bannerEl.textContent = msg;
      }

      function hideBanner() {
        bannerEl.style.display = "none";
      }

      function formatDate(iso: string | null): { text: string; overdue: boolean } {
        if (!iso) return { text: "", overdue: false };
        // Extract YYYY-MM-DD directly from the ISO string to avoid timezone shifts
        // (new Date("2026-05-01T00:00:00Z") renders as Apr 30 in negative-offset zones)
        const datePart = iso.split("T")[0];
        if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return { text: "", overdue: false };
        const [year, month, day] = datePart.split("-").map(Number);
        const d = new Date(year, month - 1, day); // local midnight — correct for overdue comparison
        if (isNaN(d.getTime())) return { text: "", overdue: false };
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const overdue = d < now;
        const text = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        return { text, overdue };
      }

      // ── Distinct task types for visible install ───────────────────────
      function getTypes(): { key: string; label: string }[] {
        const types = new Set<string>();
        let hasUntyped = false;
        for (const t of allTasks) {
          if (activeInstallFilter !== "all" && t.installationId !== activeInstallFilter) continue;
          if (t.taskType) types.add(t.taskType);
          else hasUntyped = true;
        }
        const sorted = Array.from(types).sort().map(k => ({ key: k, label: k }));
        if (hasUntyped) sorted.push({ key: "__none__", label: "No Type" });
        return sorted;
      }

      // ── Filtered view ─────────────────────────────────────────────────
      function filteredTasks(): Task[] {
        return allTasks.filter(t => {
          if (activeInstallFilter !== "all" && t.installationId !== activeInstallFilter) return false;
          if (activeTypeFilters.size > 0) {
            const key = t.taskType || "__none__";
            if (!activeTypeFilters.has(key)) return false;
          }
          const isDone = t.status === "DONE" || t.status === "done";
          if (activeStatusFilter === "open" && isDone) return false;
          if (activeStatusFilter === "done" && !isDone) return false;
          return true;
        });
      }

      // ── Store tab rendering ───────────────────────────────────────────
      function renderStoreTabs() {
        // Collect installs that actually have tasks
        const instMap = new Map<string, { title: string; count: number }>();
        for (const t of allTasks) {
          if (!instMap.has(t.installationId)) {
            instMap.set(t.installationId, { title: t.installationTitle, count: 0 });
          }
          instMap.get(t.installationId)!.count++;
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
        storeTabs.querySelectorAll(`.${p}-store-tab`).forEach((btn: Element) => {
          btn.addEventListener("click", () => {
            activeInstallFilter = (btn as HTMLElement).dataset.inst || "all";
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

      function typeDropdownLabel(): string {
        if (activeTypeFilters.size === 0) return "All Types";
        const types = getTypes();
        const selected = types.filter(t => activeTypeFilters.has(t.key));
        if (selected.length === 1) return selected[0].label;
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

        typeMenu.querySelectorAll(`.${p}-type-opt`).forEach((btn: Element) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const key = (btn as HTMLElement).dataset.key!;
            if (key === "__all__") {
              activeTypeFilters.clear();
            } else if (activeTypeFilters.has(key)) {
              activeTypeFilters.delete(key);
            } else {
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
        if (dropdownOpen) { dropdownOpen = false; renderTypeFilters(); }
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
        const grouped = new Map<string, Task[]>();
        for (const t of tasks) {
          const key = t.taskType || "__none__";
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(t);
        }

        // Sort: typed groups first (alphabetically), then "no type"
        const orderedKeys = [...grouped.keys()].sort((a, b) => {
          if (a === "__none__") return 1;
          if (b === "__none__") return -1;
          return a.localeCompare(b);
        });

        let html = `<div class="${p}-list">`;
        for (const key of orderedKeys) {
          const group = grouped.get(key)!;
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
        listWrap.querySelectorAll(`.${p}-check`).forEach((btn: Element) => {
          btn.addEventListener("click", () => toggleTask(btn as HTMLElement));
        });
      }

      function renderTaskCard(task: Task): string {
        const isDone  = task.status === "DONE" || task.status === "done";
        const dueInfo = formatDate(task.dueDate);
        const desc    = task.description ? esc(stripTypeTag(task.description)) : "";
        const typeCol = task.taskType ? typeColor(task.taskType) : "";
        const prioCol = priorityColor(task.priority);

        const typeBadge = task.taskType
          ? `<span class="${p}-type-badge" style="background:${typeCol}">${esc(task.taskType)}</span>`
          : "";
        const prioBadge = task.priority && task.priority !== "Priority_3"
          ? `<span class="${p}-prio-badge" style="color:${prioCol};border-color:${prioCol}">${priorityLabel(task.priority)}</span>`
          : "";

        const iconCal = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
        const iconStore = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
        const iconList  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
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
                <div class="${p}-card-title">${esc(task.title)}</div>
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

      // ── Toggle task status ────────────────────────────────────────────
      async function toggleTask(checkEl: HTMLElement) {
        const taskId      = checkEl.dataset.taskId!;
        const installId   = checkEl.dataset.installId!;
        const currentStatus = checkEl.dataset.status!;
        const isDone      = currentStatus === "DONE" || currentStatus === "done";
        const newStatus   = isDone ? "OPEN" : "DONE";

        checkEl.style.pointerEvents = "none";
        checkEl.style.opacity = "0.5";

        try {
          const res = await fetch(`${baseUrl}/tasks/${installId}/task/${taskId}`, {
            method: "PATCH",
            ...apiOpts(),
            body: JSON.stringify({ status: newStatus }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          // Update local state
          const task = allTasks.find(t => t.id === taskId);
          if (task) task.status = newStatus;
          renderTypeFilters();
          renderList();
        } catch (e: any) {
          showBanner("error", `Could not update task: ${e.message}`);
          checkEl.style.pointerEvents = "";
          checkEl.style.opacity = "";
        }
      }

      // ── Status filter binding ─────────────────────────────────────────
      container.querySelectorAll(`.${p}-status-opt`).forEach((btn: Element) => {
        btn.addEventListener("click", () => {
          container.querySelectorAll(`.${p}-status-opt`).forEach((b: Element) => b.classList.remove("active"));
          btn.classList.add("active");
          activeStatusFilter = (btn as HTMLElement).dataset.status || "open";
          renderList();
        });
      });

      // ── Load data ─────────────────────────────────────────────────────
      async function load() {
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
          const instRes = await fetch(`${baseUrl}/installations?limit=200`, apiOpts());
          if (!instRes.ok) throw new Error(`Could not load installations (HTTP ${instRes.status})`);
          const instData = await instRes.json();

          const installations: Array<{ id: string; title: string }> = (instData.data || instData)
            .filter((i: any) => i.pluginID === "tasks" || i.pluginId === "tasks")
            .map((i: any) => ({
              id: i.id,
              title:
                i.config?.localization?.en_US?.title ||
                i.title || i.name || i.id,
            }));

          if (!installations.length) {
            listWrap.innerHTML = `<div class="${p}-state"><span class="${p}-state-icon">📋</span><strong>No task spaces found</strong>Make sure at least one Tasks installation exists.</div>`;
            return;
          }

          // 2. Get current user ID + group IDs from widget SDK.
          //    Used to filter tasks by direct assignment or group membership when showAll=false.
          let currentUserId  = "";
          let userGroupIds: string[] = [];
          if (!showAll) {
            try {
              const profile = await widgetApi.getUserInformation();
              currentUserId = profile.id;
              userGroupIds  = profile.groupIDs || [];
            } catch (_) { /* proceed without filtering */ }
          }

          // 3. Per-installation: fetch lists, then tasks per list via /task?listId=
          //    (bare /task?limit=200 → HTTP 500; /task/my-tasks requires session auth)
          for (const inst of installations) {
            try {
              const listRes = await fetch(`${baseUrl}/tasks/${inst.id}/lists`, apiOpts());
              const listMap = new Map<string, string>();
              const listIds: string[] = [];

              if (listRes.ok) {
                const listsRaw: any = await listRes.json();
                const lists: any[] = Array.isArray(listsRaw) ? listsRaw : (listsRaw.data || []);
                for (const l of lists) {
                  listMap.set(l.id, l.name || "");
                  if (l.id) listIds.push(l.id);
                }
              }

              const perList = await Promise.all(
                listIds.map(lid =>
                  fetch(`${baseUrl}/tasks/${inst.id}/task?listId=${lid}`, apiOpts())
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null)
                )
              );

              const seen = new Set<string>();
              for (const result of perList) {
                if (!result) continue;
                const arr: any[] = Array.isArray(result) ? result : (result.data || []);
                for (const t of arr) {
                  if (!t.id || seen.has(t.id)) continue;
                  // When not showing all, only include tasks assigned to the current user
                  // (directly via assigneeIds, or via a group the user belongs to)
                  if (!showAll && currentUserId) {
                    const assigneeIds: string[]  = t.assigneeIds || [];
                    const taskGroupIds: string[] = t.groupIds    || [];
                    const directMatch = assigneeIds.indexOf(currentUserId) !== -1;
                    const groupMatch  = taskGroupIds.some((gid: string) => userGroupIds.indexOf(gid) !== -1);
                    if (!directMatch && !groupMatch) continue;
                  }
                  seen.add(t.id);
                  const desc     = t.description || "";
                  const taskType = parseTaskType(t.title || "") || parseTaskType(desc);
                  allTasks.push({
                    id:                t.id,
                    title:             t.title || "(no title)",
                    description:       desc,
                    status:            t.status || "OPEN",
                    priority:          t.priority || "Priority_3",
                    dueDate:           t.dueDate || null,
                    taskType,
                    installationId:    inst.id,
                    installationTitle: inst.title,
                    listName:          t.taskListId ? (listMap.get(t.taskListId) || "") : "",
                  });
                }
              }
            } catch (_) { /* skip failed installation */ }
          }

          // Sort: open first, then by due date ascending
          allTasks.sort((a, b) => {
            const aDone = a.status === "DONE" || a.status === "done";
            const bDone = b.status === "DONE" || b.status === "done";
            if (aDone !== bDone) return aDone ? 1 : -1;
            if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return 0;
          });

          renderStoreTabs();
          renderTypeFilters();
          renderList();

          if (allTasks.length === 0) {
            showBanner("info", "No tasks found. Your manager can enable \"Show All Tasks\" to see all store tasks.");
          }
        } catch (e: any) {
          listWrap.innerHTML = `<div class="${p}-state"><span class="${p}-state-icon">⚠</span><strong>Failed to load tasks</strong>${esc(e.message)}</div>`;
        }

        refreshBtn.disabled = false;
        refreshBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
      }

      refreshBtn.addEventListener("click", load);
      load();
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

const blockDefinition: BlockDefinition = {
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

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: "Staffbase",
  version: "1.0.0",
};

window.defineBlock(externalBlockDefinition);
