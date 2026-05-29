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
  "https://script.google.com/macros/s/AKfycbzlqYwqZ6gaq-nwDbIQ0M1spl77Qu5_fZtOwytNYYAsBKC_baY7WGUOEmM60Y6edInr/exec";
const DEFAULT_API_TOKEN =
  "NjljMjU3N2JjZmFjZWYxMzc4MzIzYTNkOkp6VEpkaGlfclRyRDk4bjlBZ2pIdXFkcmI3UjQhdl1LTm1RV1hwOHBIdUd+Unl3clk7MjYhSS1JdiprLGdOaVI=";
const DEFAULT_BASE_URL    = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY     = "#da2e32";
const DEFAULT_ACCENT      = "#da2e32";
const DEFAULT_THRESHOLD   = "90";

type Question = {
  id: string; cat: string; text: string; type: string;
  pts: number; critical: boolean; task: boolean;
  passCriteria: string;
  taskTitle: string; taskRole: string; taskPriority: string; taskDue: number;
};

const DUMMY_QUESTIONS: Question[] = [
  { id:"EXT-001", cat:"Exterior",       text:"Parking lot is free of trash and debris",          type:"pf",   pts:3, critical:false, task:true,  passCriteria:"No visible litter or debris",              taskTitle:"Clean parking lot",                     taskRole:"Crew Member", taskPriority:"High",     taskDue:1 },
  { id:"DR-001",  cat:"Dining Room",    text:"All tables are clean and sanitized",               type:"pf",   pts:3, critical:false, task:true,  passCriteria:"Sanitized per protocol",                   taskTitle:"Sanitize all dining room tables",       taskRole:"Crew Member", taskPriority:"High",     taskDue:1 },
  { id:"ST-001",  cat:"Serving Table",  text:"Hot food holding temps are within range (≥140°F)", type:"temp", pts:5, critical:true,  task:true,  passCriteria:"≥140°F hot holding, ≥165°F cooking",       taskTitle:"Adjust holding temp — FOOD SAFETY RISK",taskRole:"Manager",     taskPriority:"Critical", taskDue:0 },
  { id:"BOH-001", cat:"Back of House",  text:"Walk-in cooler temps within range (35–41°F)",      type:"temp", pts:5, critical:true,  task:true,  passCriteria:"35–41°F walk-in range",                    taskTitle:"Adjust cooler temp — FOOD SAFETY RISK", taskRole:"Manager",     taskPriority:"Critical", taskDue:0 },
];

// ── Config schema ─────────────────────────────────────────────────────────────

const configurationSchema: JSONSchema7 = {
  properties: {
    appsscripturl:      { type:"string", title:"Apps Script URL",          default: DEFAULT_APPS_SCRIPT_URL },
    apitoken:           { type:"string", title:"API Token",                default: DEFAULT_API_TOKEN },
    baseurl:            { type:"string", title:"Base URL",                 default: DEFAULT_BASE_URL },
    primarycolor:       { type:"string", title:"Primary Color",            default: DEFAULT_PRIMARY },
    accentcolor:        { type:"string", title:"Accent Color",             default: DEFAULT_ACCENT },
    backgroundcolor:    { type:"string", title:"Background Color",         default: "" },
    storelabelsingular: { type:"string", title:"Store Label (singular)",   default: "Store" },
    storelabelplural:   { type:"string", title:"Store Label (plural)",     default: "Stores" },
    passthreshold:      { type:"string", title:"Pass Threshold (%)",       default: DEFAULT_THRESHOLD },
  },
};

const uiSchema: UiSchema = {
  apitoken:           { "ui:widget":"password",  "ui:help":"Staffbase Basic auth token" },
  appsscripturl:      { "ui:help":"Deployed Google Apps Script URL returning audit questions" },
  baseurl:            { "ui:help":"Staffbase API base URL" },
  primarycolor:       { "ui:widget":"color" },
  accentcolor:        { "ui:widget":"color" },
  backgroundcolor:    { "ui:widget":"color", "ui:help":"Leave blank for transparent" },
  storelabelsingular: { "ui:help":"e.g. Store, Location, Branch" },
  storelabelplural:   { "ui:help":"e.g. Stores, Locations, Branches" },
  passthreshold:      { "ui:help":"Score % required to pass (default 90)" },
};

// ── Color utilities ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = (hex.replace("#","")+"000000").slice(0,6);
  return `${parseInt(h.slice(0,2),16)||0},${parseInt(h.slice(2,4),16)||0},${parseInt(h.slice(4,6),16)||0}`;
}

function contrastColor(hex: string): string {
  const h = (hex.replace("#","")+"000000").slice(0,6);
  const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
  const lin=(c:number)=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  const L=0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
  return L>0.179?"#1a1a1a":"#ffffff";
}

function fuzzyMatchGroup(role: string, groups: Array<{id:string;name:string}>): string|null {
  const rl = role.toLowerCase();
  const exact = groups.find(g => g.name.toLowerCase().includes(rl) || rl.includes(g.name.toLowerCase()));
  if (exact) return exact.id;
  const words = rl.split(/\s+/);
  let best=0, bestId:string|null=null;
  for (const g of groups) {
    const gl = g.name.toLowerCase();
    const hits = words.filter(w => w.length>2 && gl.includes(w)).length;
    if (hits>best) { best=hits; bestId=g.id; }
  }
  return bestId;
}

// ── Widget factory ────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class AuditWidget extends BaseBlockClass implements BaseBlock {
    constructor() { super(); }

    async renderBlock(container: any) {
      const appsScriptUrl  = this.getAttribute("appsscripturl")      || DEFAULT_APPS_SCRIPT_URL;
      const apiToken       = this.getAttribute("apitoken")            || DEFAULT_API_TOKEN;
      const baseUrl        = (this.getAttribute("baseurl")||DEFAULT_BASE_URL).replace(/\/$/,"");
      const primaryColor   = this.getAttribute("primarycolor")        || DEFAULT_PRIMARY;
      const accentColor    = this.getAttribute("accentcolor")         || DEFAULT_ACCENT;
      const bgColor        = this.getAttribute("backgroundcolor")     || "";
      const storeS         = this.getAttribute("storelabelsingular")  || "Store";
      const storeP         = this.getAttribute("storelabelplural")    || "Stores";
      const passThreshold  = parseFloat(this.getAttribute("passthreshold") || DEFAULT_THRESHOLD);
      const primaryRgb     = hexToRgb(primaryColor);
      const primaryText    = contrastColor(primaryColor);

      const p = "aw";

      // ── State ──────────────────────────────────────────────────────────
      let questions:     Question[]                       = [];
      let categories:    string[]                         = [];
      let installations: Array<{id:string;title:string}> = [];
      let allGroups:     Array<{id:string;name:string}>   = [];
      let selectedInstId = "";
      let activeCat      = "";
      let auditorName    = "";
      let nameLoaded          = false;
      let installationsLoaded = false;
      let questionsLoaded     = false;
      let auditDate      = new Date().toISOString().split("T")[0];
      let auditNotes     = "";
      const responses:          Record<string,string>          = {};
      const taskGroupOverrides: Record<string,string>          = {};
      const taskUserOverrides:  Record<string,string>          = {};
      const taskAssignType:     Record<string,"group"|"user">  = {};
      const taskFiles:          Record<string,File[]>          = {}; // per-question photo attachments
      let allUsers: Array<{id:string;name:string;avatar:string}> = [];
      let defaultUserId = ""; // Nicole Adams fallback
      type Step = "setup"|"audit"|"generate";
      let step: Step = "setup";
      let cleanupStoreDropdown: (() => void) | null = null;
      // per-task group picker open state
      const openGroupPicker: Record<string,boolean> = {};
      // callback so fetchAll can refresh store opts without re-rendering setup
      let refreshStoreOptsCallback: ((filter?:string)=>void)|null = null;

      // ── HTML skeleton ──────────────────────────────────────────────────
      container.innerHTML = `
        <style>
          .${p}{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;--shadow-sm:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);--shadow-md:0 4px 16px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bgColor||"transparent"};padding:20px;overscroll-behavior:contain}
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
          .${p}-input[type="date"]{-webkit-appearance:none;appearance:none;text-align:left;min-height:44px;padding-right:40px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center}
          .${p}-input[type="date"]::-webkit-date-and-time-value{text-align:left}
          .${p}-input[type="date"]::-webkit-calendar-picker-indicator{opacity:0;position:absolute;right:0;width:40px;height:100%;cursor:pointer}
          .${p}-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
          @media(max-width:480px){.${p}-row{grid-template-columns:1fr}}
          .${p}-field{display:flex;flex-direction:column;gap:5px}

          /* ── Auditor name display (click-to-edit) ── */
          .${p}-name-display{min-height:42px;padding:10px 13px;border:1.5px solid transparent;border-radius:var(--r-md);font-size:14px;color:var(--dark);display:flex;align-items:center;gap:8px;cursor:pointer;transition:border-color .15s,background .15s}
          .${p}-name-display:hover{border-color:var(--border);background:#fafafa}
          .${p}-name-display:hover .${p}-name-edit-hint{opacity:1}
          .${p}-name-text{flex:1;font-size:14px;font-weight:500}
          .${p}-name-edit-hint{font-size:11px;color:var(--gray-lt);opacity:0;transition:opacity .15s;white-space:nowrap}
          .${p}-name-loading{min-height:42px;padding:10px 13px;display:flex;align-items:center;gap:8px;color:var(--gray-lt);font-size:13px}

          .${p}-prog-label{font-size:11px;color:var(--gray-lt);margin-bottom:5px;display:flex;justify-content:space-between}
          .${p}-prog-wrap{background:#f3f4f6;border-radius:3px;height:5px;overflow:hidden;margin-bottom:14px}
          .${p}-prog-fill{height:100%;border-radius:3px;transition:width .3s ease;background:var(--primary)}

          /* ── Category tabs ── */
          .${p}-cat-tabs-wrap{position:relative;flex:1;overflow:hidden}
          .${p}-cat-tabs{display:flex;gap:0;overflow-x:auto;scrollbar-width:none;border-bottom:2px solid var(--border);will-change:transform;-webkit-overflow-scrolling:touch}
          .${p}-cat-tabs::-webkit-scrollbar{display:none}
          .${p}-cat-tab{flex-shrink:0!important;min-width:200px!important;padding:10px 14px!important;font-size:11px!important;font-weight:600!important;color:var(--gray)!important;cursor:pointer!important;border-bottom:2.5px solid transparent!important;border-left:none!important;border-right:none!important;border-top:none!important;margin-bottom:-2px!important;white-space:nowrap!important;background:none!important;font-family:inherit!important;transition:color .15s,border-color .15s,background .15s!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;width:auto!important;line-height:normal!important;border-radius:var(--r-sm) var(--r-sm) 0 0!important}
          .${p}-cat-tab:hover{background:rgba(var(--primary-rgb),.04)!important;color:var(--dark)!important}
          .${p}-cat-tab.active{background:rgba(var(--primary-rgb),.07)!important;color:var(--primary)!important;border-bottom-color:var(--primary)!important}
          .${p}-cat-tab-name{font-size:11px!important;font-weight:600!important;line-height:1!important}
          .${p}-cat-tab-score{font-size:10px!important;font-weight:500!important;opacity:.7!important;line-height:1!important}
          .${p}-cat-badge{display:inline-flex;align-items:center;justify-content:center;background:var(--error);color:#fff;border-radius:9px;font-size:9px;font-weight:700;padding:1px 5px;margin-left:4px}

          /* scroll arrows */
          .${p}-tabs-arrow{position:absolute;top:0;bottom:2px;width:36px;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;z-index:10;transition:opacity .2s;pointer-events:none;opacity:0}
          .${p}-tabs-arrow.visible{pointer-events:auto;opacity:1}
          .${p}-tabs-arrow-left{left:0;background:linear-gradient(to right,#fff 60%,transparent);color:var(--gray);padding-left:4px;justify-content:flex-start}
          .${p}-tabs-arrow-right{right:0;background:linear-gradient(to left,#fff 60%,transparent);color:var(--gray);padding-right:4px;justify-content:flex-end}
          .${p}-tabs-arrow:hover{color:var(--primary)}

          .${p}-question{border-bottom:1px solid var(--border);padding:14px 0}
          .${p}-question:last-child{border-bottom:none}
          .${p}-q-header{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px}
          .${p}-q-id{background:#f3f4f6;color:var(--gray);font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid var(--border);flex-shrink:0;margin-top:2px;white-space:nowrap}
          .${p}-q-text{font-size:14px;line-height:1.4;flex:1}
          .${p}-q-criteria{font-size:11px;color:var(--gray-lt);margin-bottom:8px;padding-left:2px;display:flex;align-items:flex-start;gap:4px;line-height:1.4}
          .${p}-q-chips{display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap}
          .${p}-chip{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;display:inline-flex;align-items:center;gap:3px}
          .${p}-chip-pts{background:#eef2ff;color:#3730a3}
          .${p}-chip-crit{background:rgba(196,30,58,.08);color:var(--error);border:1px solid rgba(196,30,58,.2)}
          .${p}-chip-task{background:#fffbeb;color:#92400e;border:1px solid #fde68a}
          .${p}-pf-row{display:flex;gap:8px}
          .${p}-pf-btn{flex:1!important;padding:9px 6px!important;border-radius:var(--r-md)!important;font-size:13px!important;font-weight:600!important;cursor:pointer!important;border:1.5px solid var(--border)!important;background:#fafafa!important;color:var(--gray)!important;font-family:inherit!important;transition:all .15s!important;text-align:center!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;width:auto!important;line-height:normal!important}
          .${p}-pf-btn:hover{background:rgba(var(--primary-rgb),.07)!important;border-color:var(--primary)!important;color:var(--primary)!important}
          .${p}-pf-btn[data-val="pass"]:hover{background:rgba(46,125,74,.08)!important;border-color:var(--success)!important;color:var(--success)!important}
          .${p}-pf-btn[data-val="fail"]:hover{background:rgba(196,30,58,.08)!important;border-color:var(--error)!important;color:var(--error)!important}
          .${p}-pf-btn.pass{background:rgba(46,125,74,.08)!important;border-color:var(--success)!important;color:var(--success)!important}
          .${p}-pf-btn.pass:hover{background:var(--success)!important;border-color:var(--success)!important;color:#fff!important}
          .${p}-pf-btn.fail{background:rgba(196,30,58,.08)!important;border-color:var(--error)!important;color:var(--error)!important}
          .${p}-pf-btn.fail:hover{background:var(--error)!important;border-color:var(--error)!important;color:#fff!important}
          .${p}-pf-btn.na{background:#f3f4f6!important;border-color:#9ca3af!important;color:var(--gray)!important}
          .${p}-pf-btn.na:hover{background:#9ca3af!important;border-color:#9ca3af!important;color:#fff!important}
          .${p}-rating-row{display:flex;gap:6px}
          .${p}-rating-btn{flex:1!important;padding:9px 4px!important;border-radius:var(--r-md)!important;font-size:13px!important;font-weight:700!important;cursor:pointer!important;border:1.5px solid var(--border)!important;background:#fafafa!important;color:var(--gray)!important;font-family:inherit!important;transition:all .15s!important;text-align:center!important;display:block!important;width:auto!important;line-height:normal!important}
          .${p}-rating-btn.low{background:rgba(196,30,58,.08)!important;border-color:var(--error)!important;color:var(--error)!important}
          .${p}-rating-btn.mid{background:#fffbeb!important;border-color:#d97706!important;color:#d97706!important}
          .${p}-rating-btn.hi{background:rgba(46,125,74,.08)!important;border-color:var(--success)!important;color:var(--success)!important}
          .${p}-rating-hint{display:flex;justify-content:space-between;font-size:10px;color:var(--gray-lt);margin-top:4px}
          .${p}-temp-input{width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:var(--r-md);font-size:18px;font-weight:700;font-family:inherit;color:var(--dark);background:#fafafa;text-align:center;transition:border-color .15s,background .15s}
          .${p}-temp-input:focus{outline:none;border-color:var(--primary);background:#fff}
          .${p}-temp-input.ok{border-color:var(--success);background:rgba(46,125,74,.05)}
          .${p}-temp-input.bad{border-color:var(--error);background:rgba(196,30,58,.05)}
          .${p}-temp-hint{font-size:11px;color:var(--gray-lt);margin-top:5px;line-height:1.4;text-align:center}
          .${p}-task-flag{background:#fffbeb;border:1px solid #fde68a;border-radius:var(--r-md);padding:10px 12px;margin-top:10px;display:none}
          .${p}-task-flag.show{display:block}
          .${p}-task-flag-title{font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px;display:flex;align-items:center;gap:5px}
          .${p}-task-flag p{font-size:12px;color:#78350f;line-height:1.4}
          .${p}-score-big{font-size:42px;font-weight:800;line-height:1;margin-bottom:4px}
          .${p}-score-bar-wrap{background:#f3f4f6;border-radius:4px;height:8px;overflow:hidden;margin:12px 0 4px}
          .${p}-score-bar{height:100%;border-radius:4px;transition:width .6s ease}
          .${p}-meta-grid{background:#f9fafb;border-radius:var(--r-md);padding:12px;display:grid;gap:6px;font-size:12px;color:var(--gray);margin-bottom:16px}
          .${p}-meta-row{display:flex;justify-content:space-between;align-items:center}

          /* category breakdown — 3-col grid so count is always truly centered */
          .${p}-cat-row{display:grid;grid-template-columns:1fr 80px 60px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px}
          .${p}-cat-row:last-child{border-bottom:none}
          .${p}-cat-row-name{text-align:left}
          .${p}-cat-row-count{text-align:center;font-size:12px;color:var(--gray-lt)}
          .${p}-cat-row-pct{text-align:right;font-weight:700}

          .${p}-fail-item{padding:12px 0;border-bottom:1px solid var(--border)}
          .${p}-fail-item:last-child{border-bottom:none}
          .${p}-fail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px}
          .${p}-fail-title{font-size:14px;font-weight:700}
          .${p}-fail-meta{font-size:11px;color:var(--gray-lt);margin-bottom:8px}
          .${p}-photo{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;font-size:12px;font-weight:600;color:#92400e;background:rgba(255,255,255,.55);border:1.5px dashed #fbbf24;border-radius:8px;cursor:pointer;font-family:inherit;padding:11px 12px;margin-top:10px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:all .15s}
          .${p}-photo-input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0);pointer-events:none}
          .${p}-photo:hover,.${p}-photo:active{background:#fff;border-color:#f59e0b;color:#78350f}
          .${p}-photo-line{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
          .${p}-photo-chip{display:inline-flex;align-items:center;gap:4px;max-width:160px;font-size:11px;font-weight:600;background:rgba(var(--primary-rgb),.07);color:var(--primary);border-radius:10px;padding:1px 7px}
          .${p}-photo-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .${p}-photo-chip button{border:none;background:none;cursor:pointer;color:inherit;padding:0;display:flex;opacity:.7}
          .${p}-photo-chip button:hover{opacity:1}
          .${p}-thumbs{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
          .${p}-thumb{width:48px;height:48px;border-radius:8px;overflow:hidden;border:1px solid var(--border);background:#f3f4f6;flex:0 0 auto}
          .${p}-thumb img{width:100%;height:100%;object-fit:cover;display:block}
          .${p}-prio{font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;flex-shrink:0}
          .${p}-prio-critical{background:rgba(196,30,58,.1);color:var(--error)}
          .${p}-prio-high{background:rgba(163,45,45,.08);color:#a32d2d}
          .${p}-prio-medium{background:#fffbeb;color:#92400e}
          .${p}-prio-low{background:rgba(46,125,74,.08);color:var(--success)}
          .${p}-btn{padding:10px 16px!important;border:none!important;border-radius:var(--r-md)!important;font-size:13px!important;font-weight:700!important;font-family:inherit!important;cursor:pointer!important;display:inline-flex!important;align-items:center!important;gap:7px!important;transition:all .2s!important;white-space:nowrap!important;width:auto!important;line-height:normal!important}
          .${p}-btn:disabled{opacity:.4!important;cursor:not-allowed!important}
          .${p}-btn-primary{background:var(--primary)!important;color:var(--primary-text)!important;box-shadow:0 3px 10px rgba(var(--primary-rgb),.3)!important}
          .${p}-btn-primary:hover:not(:disabled){background:var(--primary)!important;color:var(--primary-text)!important;filter:brightness(.88)!important;transform:translateY(-1px)!important}
          .${p}-btn-ghost{background:#f3f4f6!important;color:var(--gray)!important;border:1.5px solid var(--border)!important}
          .${p}-btn-ghost:hover:not(:disabled){background:rgba(var(--primary-rgb),.05)!important;border-color:var(--primary)!important;color:var(--primary)!important}
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

          /* ── Per-task group picker (tasks-integration-widget style) ── */
          .${p}-gp-wrap{position:relative}
          .${p}-gp-trigger{width:100%;min-height:40px;padding:8px 32px 8px 11px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fafafa;cursor:pointer;display:flex;align-items:center;position:relative;transition:border-color .15s,background .15s;font-size:13px;font-family:inherit;color:var(--dark);text-align:left}
          .${p}-gp-trigger:hover,.${p}-gp-trigger.open{border-color:var(--primary);background:#fff}
          .${p}-gp-trigger::after{content:'▾';position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--gray-lt);pointer-events:none;font-size:12px}
          .${p}-gp-ph{color:var(--gray-lt)}
          .${p}-gp-dropdown{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid var(--primary);border-radius:var(--r-md);box-shadow:var(--shadow-md);overflow:hidden;z-index:300}
          .${p}-gp-dropdown.show{display:block;animation:${p}-gpdd .15s ease}
          @keyframes ${p}-gpdd{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
          .${p}-gp-search{padding:8px 10px;border-bottom:1px solid var(--border)}
          .${p}-gp-search input{width:100%;padding:6px 9px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-family:inherit;background:#fafafa;color:var(--dark);outline:none}
          .${p}-gp-search input:focus{border-color:var(--primary);background:#fff}
          .${p}-gp-list{max-height:180px;overflow-y:auto}
          .${p}-gp-opt{padding:9px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:13px;border-bottom:1px solid #f3f4f6;transition:background .1s;color:var(--dark)}
          .${p}-gp-opt:last-child{border-bottom:none}
          .${p}-gp-opt:hover{background:rgba(var(--primary-rgb),.05)}
          .${p}-gp-opt.sel{background:rgba(var(--primary-rgb),.06);font-weight:600;color:var(--primary)}
          .${p}-gp-none{padding:16px;text-align:center;color:var(--gray-lt);font-size:12px}

          .${p}-ms-wrap{position:relative}
          .${p}-ms-trigger{width:100%;min-height:42px;padding:8px 36px 8px 11px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fafafa;cursor:pointer;display:flex;align-items:center;position:relative;transition:border-color .15s,background .15s;font-size:14px;font-family:inherit;color:var(--dark)}
          .${p}-ms-trigger:hover,.${p}-ms-trigger.open{border-color:var(--primary);background:#fff}
          .${p}-ms-trigger::after{content:'▾';position:absolute;right:11px;top:50%;transform:translateY(-50%);color:var(--gray-lt);pointer-events:none;font-size:13px}
          .${p}-ms-ph{color:var(--gray-lt)}
          .${p}-ms-dropdown{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid var(--primary);border-radius:var(--r-md);box-shadow:var(--shadow-md);overflow:hidden;z-index:200}
          .${p}-ms-dropdown.show{display:block;animation:${p}-dd .15s ease}
          @keyframes ${p}-dd{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
          .${p}-dd-search{padding:9px 10px;border-bottom:1px solid var(--border)}
          .${p}-dd-search input{width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit;background:#fafafa;color:var(--dark);outline:none}
          .${p}-dd-search input:focus{border-color:var(--primary);background:#fff}
          .${p}-dd-list{max-height:210px;overflow-y:auto}
          .${p}-dd-opt{padding:10px 12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:13px;border-bottom:1px solid #f3f4f6;transition:background .1s;color:var(--dark)}
          .${p}-dd-opt:last-child{border-bottom:none}
          .${p}-dd-opt:hover{background:rgba(var(--primary-rgb),.05)}
          .${p}-dd-opt.sel{background:rgba(var(--primary-rgb),.06);font-weight:600;color:var(--primary)}
          .${p}-dd-msg{padding:20px;text-align:center;color:var(--gray-lt);font-size:13px}

          /* ── touch-action to eliminate 300ms tap delay ── */
          .${p}-pf-btn,.${p}-rating-btn,.${p}-cat-tab,.${p}-btn,.${p}-gp-trigger,.${p}-ms-trigger,.${p}-tabs-arrow,.${p}-gp-opt,.${p}-dd-opt{touch-action:manipulation}

          /* ── Assign tabs (user + group) in generate step ── */
          .${p}-ap-tabs{display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:8px}
          .${p}-ap-tab{flex:1!important;padding:7px 10px!important;border:none!important;border-bottom:2.5px solid transparent!important;margin-bottom:-2px!important;font-size:12px!important;font-weight:600!important;background:none!important;color:var(--gray)!important;cursor:pointer!important;text-align:center!important;transition:color .15s,border-color .15s!important;font-family:inherit!important;touch-action:manipulation!important;display:block!important;line-height:normal!important;width:auto!important;border-radius:0!important}
          .${p}-ap-tab:hover{color:var(--dark)!important}
          .${p}-ap-tab.active{color:var(--primary)!important;border-bottom-color:var(--primary)!important;background:none!important}
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

      const contentEl  = container.querySelector(`#${p}-content`) as HTMLElement;
      const bannerEl   = container.querySelector(`#${p}-banner`)  as HTMLElement;
      const hspinEl    = container.querySelector(`#${p}-hspin`)   as HTMLElement;

      // ── Helpers ───────────────────────────────────────────────────────
      const apiOpts = (extra?: RequestInit): RequestInit => ({
        ...extra, credentials:"omit",
        headers:{ Authorization:`Basic ${apiToken}`, "Content-Type":"application/json" },
      });

      function esc(s:string){return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
      function showBanner(t:"error"|"info"|"success", msg:string){bannerEl.className=`${p}-banner ${t}`;bannerEl.style.display="block";bannerEl.textContent=msg;}
      function hideBanner(){bannerEl.style.display="none";}

      // ── Attachments (Staffbase media TUS upload) ──────────────────────
      const MEDIA_MAX=25*1024*1024; // 25 MB
      function b64utf8(s:string):string{ let o=""; for(const b of new TextEncoder().encode(s)) o+=String.fromCharCode(b); return btoa(o); }
      async function uploadMedia(file:File):Promise<string>{
        const create=await fetch(`${baseUrl}/media/tus`,{
          method:"POST",credentials:"omit",
          headers:{Authorization:`Basic ${apiToken}`,"Tus-Resumable":"1.0.0","Upload-Length":String(file.size),"Upload-Metadata":`filename ${b64utf8(file.name)},filetype ${b64utf8(file.type||"application/octet-stream")}`},
        });
        if(create.status!==201) throw new Error(`upload init failed (${create.status})`);
        const loc=create.headers.get("Location"); if(!loc) throw new Error("no upload URL");
        const buf=await file.arrayBuffer(); const CHUNK=5*1024*1024;
        let offset=0; let media:any=null;
        while(offset<buf.byteLength){
          const end=Math.min(offset+CHUNK,buf.byteLength);
          const res=await fetch(loc,{method:"PATCH",credentials:"omit",headers:{Authorization:`Basic ${apiToken}`,"Tus-Resumable":"1.0.0","Upload-Offset":String(offset),"Content-Type":"application/offset+octet-stream"},body:buf.slice(offset,end)});
          if(!res.ok) throw new Error(`upload failed (${res.status})`);
          offset=end; try{ media=await res.clone().json(); }catch(_){}
        }
        if(!media?.id) throw new Error("no media id"); return media.id;
      }

      function prioClass(pr:string){
        if(pr==="Critical") return `${p}-prio-critical`;
        if(pr==="High")     return `${p}-prio-high`;
        if(pr==="Medium")   return `${p}-prio-medium`;
        return `${p}-prio-low`;
      }

      // ── SVG icons ─────────────────────────────────────────────────────
      const iCheck = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      const iX     = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      const iFlag  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
      const iWarn  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      const iSend  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
      const iStore = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
      const iUser  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      const iPrev  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
      const iNext  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
      const iPencil= `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      const iCamera= `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
      const iXsmall= `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      function photoChips(qid:string):string{
        const files=taskFiles[qid]||[];
        return files.map((f,i)=>`<span class="${p}-photo-chip"><span>${esc(f.name)}</span><button type="button" data-qid="${esc(qid)}" data-idx="${i}">${iXsmall}</button></span>`).join("");
      }
      function photoThumbs(qid:string):string{
        const files=taskFiles[qid]||[];
        if(!files.length) return "";
        const tiles=files.map(f=>{
          const url=URL.createObjectURL(f);
          return `<span class="${p}-thumb" title="${esc(f.name)}"><img src="${url}" alt="${esc(f.name)}"></span>`;
        }).join("");
        return `<div class="${p}-thumbs">${tiles}</div>`;
      }

      // ── Category icon bank ────────────────────────────────────────────
      function catIcon(cat: string): string {
        const c = cat.toLowerCase();
        const s = `width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
        if(/exterior|parking|outside|facade|building/.test(c))
          return `<svg ${s}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`;
        if(/dining|seating|lounge|lobby/.test(c))
          return `<svg ${s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
        if(/serving|station|counter/.test(c))
          return `<svg ${s}><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`;
        if(/back of house|boh|kitchen|prep|cook/.test(c))
          return `<svg ${s}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>`;
        if(/restroom|bathroom|toilet|hygiene/.test(c))
          return `<svg ${s}><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`;
        if(/drive.?thru|drive.?through|window|dtx/.test(c))
          return `<svg ${s}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
        if(/staff|employee|team|crew|personnel|associate/.test(c))
          return `<svg ${s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
        if(/safety|health|food safe/.test(c))
          return `<svg ${s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
        if(/storage|cooler|freezer|refriger|walk.?in/.test(c))
          return `<svg ${s}><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
        if(/register|pos|checkout|cashier|payment|cash/.test(c))
          return `<svg ${s}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
        if(/equipment|machine|hvac|electric/.test(c))
          return `<svg ${s}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M2 12h2m16 0h2M12 2v2m0 16v2"/></svg>`;
        if(/thermometer|temp/.test(c))
          return `<svg ${s}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`;
        if(/order|accuracy/.test(c))
          return `<svg ${s}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
        if(/protein|marinated|meat/.test(c))
          return `<svg ${s}><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`;
        // default: clipboard
        return `<svg ${s}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`;
      }

      // ── Question logic ────────────────────────────────────────────────
      function isPass(q:Question, val:string): boolean|null {
        if(!val) return null;
        if(q.type==="pf")     return val==="pass";
        if(q.type==="rating") return parseInt(val)>=3;
        if(q.type==="temp") {
          const n=parseFloat(val);
          const isCooler = q.id.startsWith("BOH")||q.text.toLowerCase().includes("cooler");
          return isCooler ? (n>=35&&n<=41) : n>=140;
        }
        return null;
      }

      function getScore(){
        let earned=0,total=0,answered=0;
        for(const q of questions){
          total+=q.pts;
          const r=isPass(q,responses[q.id]||"");
          if(r!==null){answered++;if(r)earned+=q.pts;}
        }
        return {earned,total,answered,count:questions.length};
      }

      function failedTasks():Question[]{
        return questions.filter(q=>{
          if(!q.task) return false;
          return isPass(q,responses[q.id]||"")===false;
        });
      }

      // ── Sheet parsing ─────────────────────────────────────────────────
      function normalizeType(t: string): string {
        const l=t.toLowerCase();
        if(l.includes("pass")&&l.includes("fail")) return "pf";
        if(l.includes("rating")||l.includes("1–5")||l.includes("1-5")) return "rating";
        if(l.includes("temp")) return "temp";
        return "pf";
      }

      function parseRows(rows: any[][]): Question[] {
        if(!rows||rows.length<3) return [];
        let hIdx=-1;
        for(let i=0;i<Math.min(5,rows.length);i++){
          const hasId  = rows[i].some((c:any)=>/question\s*id/i.test(String(c||"")));
          const hasCat = rows[i].some((c:any)=>/category/i.test(String(c||"")));
          if(hasId && hasCat){ hIdx=i; break; }
        }
        if(hIdx<0) return [];
        const hdrs:string[]=rows[hIdx].map((c:any)=>String(c||"").toLowerCase().trim());
        const col=(...names:string[])=>{for(const n of names){const i=hdrs.findIndex(h=>h.includes(n));if(i>=0)return i;}return -1;};
        const iId    = col("question id");
        const iCat   = col("category");
        const iText  = col("checklist item","checklist","question /");
        const iType  = col("response type","type");
        const iPts   = col("weight","pts","point");
        const iCrit  = col("pass criteria","criteria","pass crit");
        const iTask  = col("generate task","auto-task");
        const iTitle = col("task title");
        const iRole  = col("assignee role","task role","role");
        const iDue   = col("task due","due");
        const iPrio  = col("task priority","priority");
        const iActive= col("active");
        const out:Question[]=[];
        for(let i=hIdx+1;i<rows.length;i++){
          const r=rows[i]; if(!r||!r.length) continue;
          const av=iActive>=0?String(r[iActive]||"").toLowerCase():"yes";
          if(av==="false"||av==="no"||av==="0") continue;
          const text=iText>=0?String(r[iText]||"").trim():""; if(!text) continue;
          out.push({
            id:           iId>=0   ?String(r[iId]  ||`Q${i}`):`Q${i}`,
            cat:          iCat>=0  ?String(r[iCat] ||"General").trim():"General",
            text,
            type:         iType>=0 ?normalizeType(String(r[iType]||"")):"pf",
            pts:          iPts>=0  ?parseInt(String(r[iPts]||"1"))||1:1,
            critical:     false,
            passCriteria: iCrit>=0 ?String(r[iCrit]||"").trim():"",
            task:         iTask>=0 ?/true|yes/i.test(String(r[iTask]||"")):false,
            taskTitle:    iTitle>=0?String(r[iTitle]||"").trim():text,
            taskRole:     iRole>=0 ?String(r[iRole] ||"").trim():"",
            taskPriority: iPrio>=0 ?String(r[iPrio] ||"Medium").trim():"Medium",
            taskDue:      iDue>=0  ?parseInt(String(r[iDue]||"1"))||1:1,
          });
        }
        return out;
      }

      // ── Data fetch ────────────────────────────────────────────────────
      async function fetchAll(){
        hspinEl.style.display="";

        // ① Profile — fires immediately, updates name in-place
        const profileP = (async()=>{
          try {
            const prof = await widgetApi.getUserInformation();
            auditorName = (`${(prof as any).firstName||""} ${(prof as any).lastName||""}`).trim()||(prof as any).id||"";
          } catch(_){}
          nameLoaded = true;
          if(step==="setup"){
            const loadingEl = contentEl.querySelector(`#${p}-name-loading`) as HTMLElement|null;
            if(loadingEl){
              const disp = document.createElement("div");
              disp.className=`${p}-name-display`; disp.id=`${p}-name-display`; disp.title="Click to edit";
              disp.innerHTML=`<span class="${p}-name-text" id="${p}-name-text">${esc(auditorName||"—")}</span><span class="${p}-name-edit-hint">${iPencil} edit</span>`;
              loadingEl.replaceWith(disp);
              bindNameEdit(disp);
            }
          }
        })();

        // ② Installations + groups + users — parallel
        const instGroupP = (async()=>{
          try {
            const [instRes, grpRes, userRes] = await Promise.all([
              fetch(`${baseUrl}/installations?limit=200`, apiOpts()),
              fetch(`${baseUrl}/groups/search?limit=100&sort=name_ASC`, apiOpts()),
              fetch(`${baseUrl}/users?limit=200`, apiOpts()),
            ]);
            if(instRes.ok){
              const d=await instRes.json();
              installations=(d.data||d)
                .filter((i:any)=>i.pluginID==="tasks"||i.pluginId==="tasks")
                .map((i:any)=>({id:i.id,title:i.config?.localization?.en_US?.title||i.title||i.name||i.id}))
                .sort((a:any,b:any)=>a.title.localeCompare(b.title));
            }
            if(grpRes.ok){
              const d=await grpRes.json();
              // /groups/search returns { entries: [ { data: { id, config.localization.en_US.name, type } } ] }
              const parseEntry=(e:any)=>{
                const inner=e.data||e;
                const name=inner.config?.localization?.en_US?.name||inner.config?.localization?.en_US?.title||inner.name||inner.title||inner.id;
                return {id:inner.id, name};
              };
              const raw:any[]=d.entries||d.data||d.results||d.items||(Array.isArray(d)?d:[]);
              allGroups=raw.map(parseEntry).filter((g:any)=>g.id&&g.name).sort((a:any,b:any)=>a.name.localeCompare(b.name));
            }
            // Always also fetch /groups as a supplement (catches any groups missed by search)
            try {
              const fb=await fetch(`${baseUrl}/groups?limit=200`,apiOpts());
              if(fb.ok){
                const d=await fb.json();
                const fbGroups:(typeof allGroups)=(d.data||[]).map((g:any)=>({id:g.id,name:g.config?.localization?.en_US?.title||g.config?.localization?.en_US?.name||g.name||g.id})).filter((g:any)=>g.id&&g.name);
                // Merge — deduplicate by id
                const seen=new Set(allGroups.map((g:any)=>g.id));
                for(const g of fbGroups){ if(!seen.has(g.id)){ allGroups.push(g); seen.add(g.id); } }
                allGroups.sort((a:any,b:any)=>a.name.localeCompare(b.name));
              }
            } catch(_){}
            if(userRes.ok){
              const d=await userRes.json();
              allUsers=(d.data||[]).map((u:any)=>({id:u.id,name:(`${u.firstName||""} ${u.lastName||""}`).trim()||u.id,avatar:u.avatar?.icon?.url||""})).filter((u:any)=>u.name).sort((a:any,b:any)=>a.name.localeCompare(b.name));
              // Store Nicole Adams as default assignee fallback
              const nicole=allUsers.find(u=>u.name.toLowerCase().includes("nicole")&&u.name.toLowerCase().includes("adams"));
              if(nicole) defaultUserId=nicole.id;
            }
          } catch(_){}
          installationsLoaded=true;
          // Update store trigger in-place if setup is showing
          if(step==="setup"){
            const trigEl=contentEl.querySelector(`#${p}-trigger`) as HTMLElement|null;
            if(trigEl&&!selectedInstId) trigEl.innerHTML=`<span class="${p}-ms-ph">Select a ${esc(storeS)}…</span>`;
            if(refreshStoreOptsCallback) refreshStoreOptsCallback("");
          }
        })();

        // ③ Questions — 10s timeout, then dummy fallback
        const questionsP = (async()=>{
          try {
            const timeout = new Promise<never>((_,rej)=>setTimeout(()=>rej(new Error("timeout")),14000));
            const sr = await Promise.race([fetch(appsScriptUrl), timeout]) as Response;
            if(sr.ok){
              const data=await sr.json();
              const raw=data.data||data;
              if(raw&&typeof raw==="object"&&!Array.isArray(raw)){
                const key=Object.keys(raw).find(k=>k.includes("Audit Questions"));
                if(key){const parsed=parseRows(raw[key]);if(parsed.length>0)questions=parsed;}
              } else if(Array.isArray(data.questions)){
                questions=data.questions;
              }
            }
          } catch(_){}
          if(!questions.length) questions=[...DUMMY_QUESTIONS];
          const seen=new Set<string>();
          categories=[];
          for(const q of questions){if(!seen.has(q.cat)){seen.add(q.cat);categories.push(q.cat);}}
          activeCat=categories[0]||"";
          questionsLoaded=true;
          // Enable Begin button in-place
          if(step==="setup"){
            const beginBtn=contentEl.querySelector(`#${p}-begin`) as HTMLButtonElement|null;
            if(beginBtn){beginBtn.disabled=false;beginBtn.innerHTML=`${iCheck} Begin Audit`;}
          }
        })();

        await Promise.all([profileP, instGroupP, questionsP]);
        hspinEl.style.display="none";
      }

      // ── Render dispatch ───────────────────────────────────────────────
      function render(){
        if(step==="setup")         renderSetup();
        else if(step==="audit")    renderAudit();
        else if(step==="generate") renderGenerate();
      }

      // ── Name click-to-edit binder (shared by renderSetup + in-place update) ──
      function bindNameEdit(nameDisplay: HTMLElement){
        nameDisplay.addEventListener("click",function onClick(){
          const input = document.createElement("input");
          input.type="text"; input.className=`${p}-input`; input.id=`${p}-aname`;
          input.value=auditorName; input.placeholder="Your name";
          nameDisplay.replaceWith(input);
          input.focus(); input.select();
          const save=()=>{
            auditorName=input.value.trim();
            const nd=document.createElement("div");
            nd.className=`${p}-name-display`; nd.id=`${p}-name-display`; nd.title="Click to edit";
            nd.innerHTML=`<span class="${p}-name-text">${esc(auditorName||"—")}</span><span class="${p}-name-edit-hint">${iPencil} edit</span>`;
            input.replaceWith(nd);
            bindNameEdit(nd);
          };
          input.addEventListener("blur",save);
          input.addEventListener("keydown",(e:KeyboardEvent)=>{ if(e.key==="Enter"){e.preventDefault();input.blur();} });
        });
      }

      // ── Step 1: Setup ─────────────────────────────────────────────────
      function renderSetup(){
        if(cleanupStoreDropdown){ cleanupStoreDropdown(); cleanupStoreDropdown=null; }
        refreshStoreOptsCallback = null;
        const selInst=installations.find(i=>i.id===selectedInstId);
        const triggerInner=selInst
          ?`<span style="color:var(--dark);font-size:14px">${esc(selInst.title)}</span>`
          :`<span class="${p}-ms-ph">${!installationsLoaded?`Loading ${esc(storeP.toLowerCase())}…`:`Select a ${esc(storeS)}…`}</span>`;

        // Auditor name field: spinner while loading, click-to-edit display after
        const nameFieldHtml = nameLoaded
          ? `<div class="${p}-name-display" id="${p}-name-display" title="Click to edit">
               <span class="${p}-name-text" id="${p}-name-text">${esc(auditorName||"—")}</span>
               <span class="${p}-name-edit-hint">${iPencil} edit</span>
             </div>`
          : `<div class="${p}-name-loading" id="${p}-name-loading">
               <span class="${p}-spin"></span>
               <span>Loading your name…</span>
             </div>`;

        contentEl.innerHTML=`
          <div class="${p}-card">
            <div class="${p}-card-head"><span class="${p}-step">1</span><span class="${p}-card-title">Store &amp; Auditor Details</span></div>
            <div class="${p}-card-body">
              <div class="${p}-row">
                <div class="${p}-field">
                  <label class="${p}-label">${esc(storeS)}</label>
                  <div class="${p}-ms-wrap">
                    <div class="${p}-ms-trigger" id="${p}-trigger">${triggerInner}</div>
                    <div class="${p}-ms-dropdown" id="${p}-dropdown">
                      <div class="${p}-dd-search"><input type="text" id="${p}-search" placeholder="Search ${esc(storeP.toLowerCase())}…"></div>
                      <div class="${p}-dd-list" id="${p}-opts"><div class="${p}-dd-msg">Loading…</div></div>
                    </div>
                  </div>
                </div>
                <div class="${p}-field">
                  <label class="${p}-label">Audit Date</label>
                  <input type="date" class="${p}-input" id="${p}-adate" value="${auditDate}">
                </div>
              </div>
              <div class="${p}-row full" style="grid-template-columns:1fr">
                <div class="${p}-field">
                  <label class="${p}-label">Auditor Name</label>
                  ${nameFieldHtml}
                </div>
              </div>
              <div class="${p}-row full" style="grid-template-columns:1fr;margin-bottom:12px">
                <div class="${p}-field">
                  <label class="${p}-label">Auditor Notes <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:var(--gray-lt)">(optional)</span></label>
                  <textarea class="${p}-input" id="${p}-anotes" rows="2" placeholder="Context for this audit session…" style="resize:none;line-height:1.5">${esc(auditNotes)}</textarea>
                </div>
              </div>
              <button type="button" class="${p}-btn ${p}-btn-primary ${p}-btn-full" id="${p}-begin" ${!questionsLoaded?"disabled":""}>${!questionsLoaded?`<span class="${p}-spin" style="border-top-color:#fff;border-color:rgba(255,255,255,.3)"></span> Loading questions…`:`${iCheck} Begin Audit`}</button>
            </div>
          </div>`;

        // ── Bind click-to-edit name (if already loaded) ───────────────
        if(nameLoaded){
          const nameDisplay = contentEl.querySelector(`#${p}-name-display`) as HTMLElement|null;
          if(nameDisplay) bindNameEdit(nameDisplay);
        }

        const trigger  = contentEl.querySelector(`#${p}-trigger`)  as HTMLElement;
        const dropdown = contentEl.querySelector(`#${p}-dropdown`) as HTMLElement;
        const searchInp= contentEl.querySelector(`#${p}-search`)   as HTMLInputElement;
        const optsList = contentEl.querySelector(`#${p}-opts`)     as HTMLElement;

        function renderOpts(filter=""){
          if(!installationsLoaded){
            optsList.innerHTML=`<div class="${p}-dd-msg">Loading ${esc(storeP.toLowerCase())}…</div>`;
            return;
          }
          if(!installations.length){
            optsList.innerHTML=`<div class="${p}-dd-msg">No ${esc(storeP.toLowerCase())} found</div>`;
            return;
          }
          const matches=installations.filter(s=>s.title.toLowerCase().includes(filter.toLowerCase()));
          if(!matches.length){
            optsList.innerHTML=`<div class="${p}-dd-msg">No ${esc(storeP.toLowerCase())} found</div>`;
            return;
          }
          optsList.innerHTML=matches.map(s=>`
            <div class="${p}-dd-opt${s.id===selectedInstId?" sel":""}" data-id="${esc(s.id)}" data-title="${esc(s.title)}">
              <span>${esc(s.title)}</span>
              ${s.id===selectedInstId?iCheck:""}
            </div>`).join("");
          optsList.querySelectorAll(`.${p}-dd-opt`).forEach((opt:Element)=>{
            opt.addEventListener("click",()=>{
              const el=opt as HTMLElement;
              selectedInstId=el.dataset.id||"";
              trigger.innerHTML=`<span style="color:var(--dark);font-size:14px">${esc(el.dataset.title||"")}</span>`;
              dropdown.classList.remove("show");
              trigger.classList.remove("open");
              renderOpts(searchInp.value);
            });
          });
        }

        refreshStoreOptsCallback = renderOpts;

        trigger.addEventListener("click",()=>{
          dropdown.classList.toggle("show");
          trigger.classList.toggle("open");
          if(dropdown.classList.contains("show")){ searchInp.focus(); renderOpts(searchInp.value); }
        });
        searchInp.addEventListener("input",()=>renderOpts(searchInp.value));
        const outsideClick=(e:MouseEvent)=>{
          if(!trigger.contains(e.target as Node)&&!dropdown.contains(e.target as Node)){
            dropdown.classList.remove("show");
            trigger.classList.remove("open");
          }
        };
        document.addEventListener("click",outsideClick);
        cleanupStoreDropdown=()=>document.removeEventListener("click",outsideClick);

        renderOpts();

        contentEl.querySelector(`#${p}-begin`)!.addEventListener("click",()=>{
          // Read auditor name from whichever element is currently rendered
          const nameInput = contentEl.querySelector(`#${p}-aname`) as HTMLInputElement|null;
          const nameText  = contentEl.querySelector(`#${p}-name-text`) as HTMLElement|null;
          if(nameInput)      auditorName = nameInput.value.trim();
          else if(nameText)  auditorName = nameText.textContent?.trim() === "—" ? "" : (nameText.textContent?.trim()||"");
          auditDate  =(contentEl.querySelector(`#${p}-adate`)  as HTMLInputElement).value;
          auditNotes =(contentEl.querySelector(`#${p}-anotes`) as HTMLTextAreaElement).value.trim();
          if(!selectedInstId){showBanner("error",`Please select a ${storeS}.`);return;}
          if(!auditorName)   {showBanner("error","Please enter your name.");return;}
          hideBanner(); step="audit"; renderAudit();
        });
      }

      // ── Step 2: Questions ─────────────────────────────────────────────
      function renderAudit(){
        const sc=getScore();
        const pct=sc.count>0?Math.round((sc.answered/sc.count)*100):0;
        const catQs=questions.filter(q=>q.cat===activeCat);
        const idx=categories.indexOf(activeCat);
        const isFirst=idx===0, isLast=idx===categories.length-1;

        const tabsHtml=categories.map(cat=>{
          const catQsList=questions.filter(q=>q.cat===cat);
          const answered=catQsList.filter(q=>responses[q.id]).length;
          const fails=catQsList.filter(q=>isPass(q,responses[q.id]||"")===false).length;
          const badge=fails>0?`<span class="${p}-cat-badge">${fails}</span>`:"";
          const score=`<span class="${p}-cat-tab-score">${answered}/${catQsList.length}</span>`;
          return `<div role="button" tabindex="0" class="${p}-cat-tab${cat===activeCat?" active":""}" data-cat="${esc(cat)}">${catIcon(cat)}<span class="${p}-cat-tab-name">${esc(cat)}${badge}</span>${score}</div>`;
        }).join("");

        const qHtml=catQs.map(renderQuestion).join("");

        contentEl.innerHTML=`
          <div style="margin-bottom:14px">
            <div class="${p}-prog-label"><span>${sc.answered} of ${sc.count} answered</span><span style="font-weight:700;color:var(--dark)">${pct}%</span></div>
            <div class="${p}-prog-wrap"><div class="${p}-prog-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="${p}-card">
            <div class="${p}-card-head" style="padding:0;border-bottom:none;overflow:hidden">
              <div class="${p}-cat-tabs-wrap" id="${p}-tabs-wrap">
                <div class="${p}-cat-tabs" id="${p}-cat-tabs" style="padding:0 4px">${tabsHtml}</div>
                <div class="${p}-tabs-arrow ${p}-tabs-arrow-left" id="${p}-tabs-left">‹</div>
                <div class="${p}-tabs-arrow ${p}-tabs-arrow-right" id="${p}-tabs-right">›</div>
              </div>
            </div>
            <div class="${p}-card-body" id="${p}-qwrap">
              ${qHtml||`<div class="${p}-state"><strong>No questions</strong></div>`}
            </div>
          </div>
          <div class="${p}-nav">
            <button type="button" class="${p}-btn ${p}-btn-ghost" id="${p}-prev">${iPrev} ${isFirst?"Setup":"Prev"}</button>
            ${isLast
              ?`<button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-gen">${iFlag} View Overview</button>`
              :`<button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-next">Next ${iNext}</button>`}
          </div>`;

        // ── Scroll arrows ──────────────────────────────────────────────
        const tabsEl    = contentEl.querySelector(`#${p}-cat-tabs`)  as HTMLElement;
        const arrowLeft = contentEl.querySelector(`#${p}-tabs-left`) as HTMLElement;
        const arrowRight= contentEl.querySelector(`#${p}-tabs-right`) as HTMLElement;

        function updateArrows(){
          const sl = tabsEl.scrollLeft;
          const maxSl = tabsEl.scrollWidth - tabsEl.clientWidth;
          arrowLeft.classList.toggle("visible",  sl > 4);
          arrowRight.classList.toggle("visible", maxSl > 4 && sl < maxSl - 4);
        }
        tabsEl.addEventListener("scroll", updateArrows, {passive:true});
        // initial arrow state + scroll active tab into view
        requestAnimationFrame(()=>{
          updateArrows();
          const activeTab = tabsEl.querySelector(`.${p}-cat-tab.active`) as HTMLElement|null;
          if(activeTab) activeTab.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
        });
        arrowLeft.addEventListener("click",()=>{ tabsEl.scrollBy({left:-220,behavior:"smooth"}); });
        arrowRight.addEventListener("click",()=>{ tabsEl.scrollBy({left:220,behavior:"smooth"}); });

        // ── Tab + nav events ───────────────────────────────────────────
        contentEl.querySelectorAll(`.${p}-cat-tab`).forEach(btn=>{
          btn.addEventListener("click",()=>{
            activeCat=(btn as HTMLElement).dataset.cat||activeCat;
            renderAudit();
          });
        });
        const prevBtn=contentEl.querySelector(`#${p}-prev`) as HTMLButtonElement;
        prevBtn.addEventListener("click",()=>{
          if(isFirst){step="setup";renderSetup();}
          else{activeCat=categories[idx-1];renderAudit();}
        });
        const nextBtn=contentEl.querySelector(`#${p}-next`) as HTMLButtonElement|null;
        if(nextBtn) nextBtn.addEventListener("click",()=>{activeCat=categories[idx+1];renderAudit();});
        const genBtn=contentEl.querySelector(`#${p}-gen`) as HTMLButtonElement|null;
        if(genBtn) genBtn.addEventListener("click",()=>{
          hideBanner();
          for(const q of failedTasks()){
            if(taskGroupOverrides[q.id]||taskUserOverrides[q.id]) continue; // already assigned
            if(q.taskRole){
              const m=fuzzyMatchGroup(q.taskRole,allGroups);
              if(m){ taskGroupOverrides[q.id]=m; taskAssignType[q.id]="group"; continue; }
            }
            // No group match — fall back to Nicole Adams (or any default user)
            if(defaultUserId){ taskUserOverrides[q.id]=defaultUserId; taskAssignType[q.id]="user"; }
          }
          step="generate"; renderGenerate();
        });
        bindControls();
      }

      function renderQuestion(q:Question):string {
        const val=responses[q.id]||"";
        const passed=isPass(q,val);
        const showFlag=q.task&&passed===false;

        let ctrl="";
        if(q.type==="pf"){
          ctrl=`<div class="${p}-pf-row">
            <button type="button" class="${p}-pf-btn${val==="pass"?" pass":""}" data-qid="${esc(q.id)}" data-val="pass">Pass</button>
            <button type="button" class="${p}-pf-btn${val==="fail"?" fail":""}" data-qid="${esc(q.id)}" data-val="fail">Fail</button>
            <button type="button" class="${p}-pf-btn${val==="na"?" na":""}" data-qid="${esc(q.id)}" data-val="na">N/A</button>
          </div>`;
        } else if(q.type==="rating"){
          const rv=val?parseInt(val):0;
          ctrl=`<div class="${p}-rating-row">${[1,2,3,4,5].map(n=>{
            let cls=""; if(rv===n) cls=n<=2?"low":n===3?"mid":"hi";
            return `<button type="button" class="${p}-rating-btn${cls?" "+cls:""}" data-qid="${esc(q.id)}" data-val="${n}">${n}</button>`;
          }).join("")}</div><div class="${p}-rating-hint"><span>Poor</span><span>Excellent</span></div>`;
        } else if(q.type==="temp"){
          const isCooler=q.id.startsWith("BOH")||q.text.toLowerCase().includes("cooler");
          const hint=isCooler?"35–41°F (walk-in cooler)":"≥140°F (hot holding) · ≥165°F (cooking)";
          let tcls="";
          if(val){const n=parseFloat(val);tcls=(isCooler?(n>=35&&n<=41):n>=140)?" ok":" bad";}
          ctrl=`<input type="number" class="${p}-temp-input${tcls}" inputmode="decimal" placeholder="°F" value="${esc(val)}" data-qid="${esc(q.id)}" data-dtype="temp">
                <div class="${p}-temp-hint">${hint}</div>`;
        }

        const flagHtml=showFlag&&q.taskTitle?`
          <div class="${p}-task-flag show">
            <div class="${p}-task-flag-title">${iFlag} Task will be generated</div>
            <p style="font-size:12px;color:#78350f;line-height:1.4;margin:0"><strong>${esc(q.taskTitle)}</strong> · ${esc(q.taskRole)} · ${esc(q.taskPriority)} · Due: ${q.taskDue===0?"Immediately":`${q.taskDue}d`}</p>
            <label class="${p}-photo" data-qid="${esc(q.id)}" for="${p}-pfin-${esc(q.id)}">${iCamera} Add photo</label>
            <input type="file" accept="image/*" multiple id="${p}-pfin-${esc(q.id)}" class="${p}-photo-input" data-qid="${esc(q.id)}">
            <div class="${p}-photo-line" data-qid="${esc(q.id)}">${photoChips(q.id)}</div>
          </div>`:""

        const iCheck2=`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        return `<div class="${p}-question" data-qid="${esc(q.id)}">
          <div class="${p}-q-header"><span class="${p}-q-id">${esc(q.id)}</span><span class="${p}-q-text">${esc(q.text)}</span></div>
          ${q.passCriteria?`<div class="${p}-q-criteria">${iCheck2} ${esc(q.passCriteria)}</div>`:""}
          <div class="${p}-q-chips">
            <span class="${p}-chip ${p}-chip-pts">${q.pts} pts</span>
            ${q.critical?`<span class="${p}-chip ${p}-chip-crit">${iWarn} Critical</span>`:""}
            ${q.task?`<span class="${p}-chip ${p}-chip-task">${iFlag} Auto-task</span>`:""}
          </div>
          ${ctrl}${flagHtml}
        </div>`;
      }

      function bindControls(){
        contentEl.querySelectorAll(`.${p}-pf-btn`).forEach(btn=>{
          btn.addEventListener("click",()=>{
            const{qid,val}=(btn as HTMLElement).dataset as{qid:string;val:string};
            responses[qid]=val; refreshQuestion(qid);
          });
        });
        contentEl.querySelectorAll(`.${p}-rating-btn`).forEach(btn=>{
          btn.addEventListener("click",()=>{
            const{qid,val}=(btn as HTMLElement).dataset as{qid:string;val:string};
            responses[qid]=val; refreshQuestion(qid);
          });
        });
        contentEl.querySelectorAll(`[data-dtype="temp"]`).forEach(inp=>{
          inp.addEventListener("change",()=>{
            const qid=(inp as HTMLElement).dataset.qid!;
            responses[qid]=(inp as HTMLInputElement).value;
            refreshQuestion(qid);
          });
        });
        // Photo attach inside the "Task will be generated" flag
        contentEl.querySelectorAll(`.${p}-photo`).forEach(btn=>{
          const qid=(btn as HTMLElement).dataset.qid!;
          const input=contentEl.querySelector(`.${p}-photo-input[data-qid="${qid}"]`) as HTMLInputElement|null;
          const line =contentEl.querySelector(`.${p}-photo-line[data-qid="${qid}"]`) as HTMLElement|null;
          const refreshChips=()=>{
            if(!line) return;
            line.innerHTML=photoChips(qid);
            line.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
              const idx=parseInt((b as HTMLElement).dataset.idx||"-1",10);
              if(idx>=0&&taskFiles[qid]){ taskFiles[qid].splice(idx,1); refreshChips(); }
            }));
          };
          // No click handler needed — the <label for> opens the picker natively
          // (far more reliable on mobile than input.click() on a hidden input).
          input?.addEventListener("change",()=>{
            const ok:File[]=[];
            for(const f of Array.from(input.files||[])){
              if(f.size>MEDIA_MAX){ showBanner("error",`"${f.name}" is over 25 MB.`); continue; }
              ok.push(f);
            }
            if(ok.length){ (taskFiles[qid]=taskFiles[qid]||[]).push(...ok); refreshChips(); }
            input.value="";
          });
          refreshChips();
        });
      }

      function refreshQuestion(qid:string){
        const q=questions.find(x=>x.id===qid); if(!q) return;
        const el=contentEl.querySelector(`.${p}-question[data-qid="${qid}"]`); if(!el) return;
        el.outerHTML=renderQuestion(q);
        bindControls();
        const sc=getScore(); const pct=sc.count>0?Math.round((sc.answered/sc.count)*100):0;
        const fill=contentEl.querySelector(`.${p}-prog-fill`) as HTMLElement|null;
        const lbl=contentEl.querySelector(`.${p}-prog-label`) as HTMLElement|null;
        if(fill) fill.style.width=`${pct}%`;
        if(lbl) lbl.innerHTML=`<span>${sc.answered} of ${sc.count} answered</span><span style="font-weight:700;color:var(--dark)">${pct}%</span>`;
        categories.forEach(cat=>{
          const fails=questions.filter(q=>q.cat===cat&&isPass(q,responses[q.id]||"")===false).length;
          const tab=contentEl.querySelector(`.${p}-cat-tab[data-cat="${cat}"]`); if(!tab) return;
          let badge=tab.querySelector(`.${p}-cat-badge`);
          if(fails>0){if(badge)badge.textContent=String(fails);else tab.insertAdjacentHTML("beforeend",`<span class="${p}-cat-badge">${fails}</span>`);}
          else badge?.remove();
        });
      }

      // ── Step 3: Generate / Review ─────────────────────────────────────
      function renderGenerate(){
        const sc=getScore();
        const pct=sc.total>0&&sc.answered>0?Math.round((sc.earned/sc.total)*100):0;
        const passing=pct>=passThreshold;
        const ft=failedTasks();
        const inst=installations.find(i=>i.id===selectedInstId);
        const scoreColor=passing?"var(--success)":"var(--error)";

        // Category breakdown — 3-col grid for true centering
        const catRows=categories.map(cat=>{
          const qs=questions.filter(q=>q.cat===cat);
          const earned=qs.reduce((a,q)=>a+(isPass(q,responses[q.id]||"")?q.pts:0),0);
          const tot=qs.reduce((a,q)=>a+q.pts,0);
          const ans=qs.filter(q=>isPass(q,responses[q.id]||"")!==null).length;
          const cp=tot>0&&ans>0?Math.round((earned/tot)*100):null;
          const col=cp===null?"var(--gray-lt)":cp>=passThreshold?"var(--success)":"var(--error)";
          return `<div class="${p}-cat-row">
            <span class="${p}-cat-row-name">${esc(cat)}</span>
            <span class="${p}-cat-row-count">${ans}/${qs.length}</span>
            <span class="${p}-cat-row-pct" style="color:${col}">${cp!==null?cp+"%":"—"}</span>
          </div>`;
        }).join("");

        // Failed tasks with per-task group picker
        const failHtml=ft.length===0
          ?`<div class="${p}-state"><strong>No failures</strong>All answered questions passed or were marked N/A.</div>`
          :ft.map(q=>{
            const gid=taskGroupOverrides[q.id]||"";
            const uid=taskUserOverrides[q.id]||"";
            const atype=taskAssignType[q.id]||"group";
            const selGroup=allGroups.find(g=>g.id===gid);
            const selUser=allUsers.find(u=>u.id===uid);
            const selLabel=atype==="user"&&selUser
              ?`<span style="color:var(--dark)">${esc(selUser.name)}</span>`
              :atype==="group"&&selGroup
              ?`<span style="color:var(--dark)">${esc(selGroup.name)}</span>`
              :`<span class="${p}-gp-ph">— Unassigned —</span>`;
            const due=q.taskDue===0?"Immediately":`Within ${q.taskDue}d`;
            return `<div class="${p}-fail-item">
              <div class="${p}-fail-head">
                <div class="${p}-fail-title">${esc(q.taskTitle||q.text)}</div>
                <span class="${p}-prio ${prioClass(q.taskPriority)}">${esc(q.taskPriority)}</span>
              </div>
              <div class="${p}-fail-meta">${esc(q.id)} · Due: ${due}</div>
              <div class="${p}-group-lbl">Assign to</div>
              <div class="${p}-gp-wrap" data-qid="${esc(q.id)}">
                <button type="button" class="${p}-gp-trigger" data-qid="${esc(q.id)}">${selLabel}</button>
                <div class="${p}-gp-dropdown" data-qid="${esc(q.id)}">
                  <div style="padding:8px 10px 0">
                    <div class="${p}-ap-tabs">
                      <div role="button" tabindex="0" class="${p}-ap-tab${atype==="group"?" active":""}" data-qid="${esc(q.id)}" data-tab="group">Groups</div>
                      <div role="button" tabindex="0" class="${p}-ap-tab${atype==="user"?" active":""}" data-qid="${esc(q.id)}" data-tab="user">People</div>
                    </div>
                  </div>
                  <div class="${p}-gp-search"><input type="text" placeholder="Search…" data-qid="${esc(q.id)}"></div>
                  <div class="${p}-gp-list" data-qid="${esc(q.id)}" data-tab="${atype}"></div>
                </div>
              </div>
              ${photoThumbs(q.id)}
            </div>`;
          }).join("");

        contentEl.innerHTML=`
          <div class="${p}-card">
            <div class="${p}-card-head"><span class="${p}-step">${iCheck}</span><span class="${p}-card-title">Audit Summary</span></div>
            <div class="${p}-card-body">
              <div style="text-align:center;padding:6px 0 14px">
                <div class="${p}-score-big" style="color:${scoreColor}">${pct}%</div>
                <div style="font-size:14px;font-weight:700;color:${scoreColor};margin-top:2px">${passing?"Passing":"Failing"}</div>
                <div style="font-size:12px;color:var(--gray-lt);margin-top:4px">${sc.earned} / ${sc.total} pts · ${sc.answered} of ${sc.count} answered</div>
                <div class="${p}-score-bar-wrap"><div class="${p}-score-bar" style="width:${pct}%;background:${scoreColor}"></div></div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--gray-lt);margin-top:2px"><span>0%</span><span style="color:${scoreColor}">${passThreshold}% threshold</span><span>100%</span></div>
              </div>
              <div class="${p}-meta-grid">
                <div class="${p}-meta-row"><span>${iStore} ${esc(storeS)}</span><span style="font-weight:600">${esc(inst?.title||"—")}</span></div>
                <div class="${p}-meta-row"><span>${iUser} Auditor</span><span>${esc(auditorName)}</span></div>
                <div class="${p}-meta-row"><span>Date</span><span>${esc(auditDate)}</span></div>
                <div class="${p}-meta-row"><span>Tasks flagged</span><span style="font-weight:700;color:${ft.length>0?"var(--error)":"var(--success)"}">${ft.length}</span></div>
                ${auditNotes?`<div class="${p}-meta-row" style="flex-direction:column;align-items:flex-start;gap:3px"><span style="color:var(--gray-lt);font-size:11px;text-transform:uppercase;letter-spacing:.3px">Notes</span><span style="line-height:1.5">${esc(auditNotes)}</span></div>`:""}
              </div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray-lt);margin-bottom:8px">Category Breakdown</div>
              ${catRows}
            </div>
          </div>

          ${ft.length>0?`
          <div class="${p}-card">
            <div class="${p}-card-head"><span class="${p}-step">${iFlag}</span><span class="${p}-card-title">Tasks to Create <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:11px;color:var(--gray-lt)">(${ft.length})</span></span></div>
            <div class="${p}-card-body">${failHtml}</div>
          </div>`:""}

          <div class="${p}-nav">
            <button type="button" class="${p}-btn ${p}-btn-ghost" id="${p}-back">${iPrev} Back</button>
            <button type="button" class="${p}-btn ${p}-btn-primary" id="${p}-submit">${iSend} Submit &amp; Create Tasks</button>
          </div>
          <div class="${p}-submit-prog" id="${p}-sprog">
            <div class="${p}-submit-prog-meta"><span id="${p}-slabel">Working…</span><span id="${p}-spct">0%</span></div>
            <div class="${p}-submit-bar-wrap"><div class="${p}-submit-bar-fill" id="${p}-sfill"></div></div>
            <div class="${p}-submit-log" id="${p}-slog"></div>
          </div>`;

        // ── Assign picker logic (groups + people) ─────────────────────
        function renderGpList(qid: string, filter = ""){
          const list = contentEl.querySelector(`.${p}-gp-list[data-qid="${qid}"]`) as HTMLElement|null;
          if(!list) return;
          const tab  = (taskAssignType[qid]||"group") as "group"|"user";
          list.dataset.tab = tab;
          const fl   = filter.toLowerCase();

          if(tab === "user"){
            const selId = taskUserOverrides[qid]||"";
            const opts  = [{id:"",name:"— No assignee —",avatar:""}, ...allUsers].filter(u =>
              !fl || u.name.toLowerCase().includes(fl)
            );
            if(!opts.length){ list.innerHTML=`<div class="${p}-gp-none">No people found</div>`; return; }
            list.innerHTML = opts.map(u=>`
              <div class="${p}-gp-opt${u.id===selId?" sel":""}" data-uid="${esc(u.id)}" data-uname="${esc(u.name)}" data-dtype="user" data-qid="${esc(qid)}">
                <span>${esc(u.name)}</span>
                ${u.id===selId?iCheck:""}
              </div>`).join("");
          } else {
            const selId = taskGroupOverrides[qid]||"";
            const opts  = [{id:"",name:"— No group —"}, ...allGroups].filter(g =>
              !fl || g.name.toLowerCase().includes(fl)
            );
            if(!opts.length){ list.innerHTML=`<div class="${p}-gp-none">No groups found</div>`; return; }
            list.innerHTML = opts.map(g=>`
              <div class="${p}-gp-opt${g.id===selId?" sel":""}" data-gid="${esc(g.id)}" data-gname="${esc(g.name)}" data-dtype="group" data-qid="${esc(qid)}">
                <span>${esc(g.name)}</span>
                ${g.id===selId?iCheck:""}
              </div>`).join("");
          }

          list.querySelectorAll(`.${p}-gp-opt`).forEach((opt:Element)=>{
            opt.addEventListener("click",()=>{
              const el   = opt as HTMLElement;
              const qid2 = el.dataset.qid!;
              const dtype = el.dataset.dtype as "group"|"user";
              taskAssignType[qid2] = dtype;
              let label = `<span class="${p}-gp-ph">— Unassigned —</span>`;
              if(dtype==="user"){
                const uid = el.dataset.uid||""; const uname = el.dataset.uname||"";
                taskUserOverrides[qid2]=uid;
                if(uid) label=`<span style="color:var(--dark)">${esc(uname)}</span>`;
              } else {
                const gid = el.dataset.gid||""; const gname = el.dataset.gname||"";
                taskGroupOverrides[qid2]=gid;
                if(gid) label=`<span style="color:var(--dark)">${esc(gname)}</span>`;
              }
              const trigger2 = contentEl.querySelector(`.${p}-gp-trigger[data-qid="${qid2}"]`) as HTMLElement|null;
              if(trigger2) trigger2.innerHTML = label;
              const dd = contentEl.querySelector(`.${p}-gp-dropdown[data-qid="${qid2}"]`) as HTMLElement|null;
              if(dd) dd.classList.remove("show");
              trigger2?.classList.remove("open");
              renderGpList(qid2, "");
            });
          });
        }

        // Wire up each per-task picker
        const closeAllPickers = (exceptQid?:string) => {
          contentEl.querySelectorAll(`.${p}-gp-dropdown.show`).forEach((dd:Element)=>{
            const ddEl = dd as HTMLElement;
            if(ddEl.dataset.qid !== exceptQid){
              ddEl.classList.remove("show");
              contentEl.querySelector(`.${p}-gp-trigger[data-qid="${ddEl.dataset.qid}"]`)?.classList.remove("open");
            }
          });
        };

        ft.forEach(q=>{
          const trigger3 = contentEl.querySelector(`.${p}-gp-trigger[data-qid="${q.id}"]`) as HTMLElement|null;
          const dd3      = contentEl.querySelector(`.${p}-gp-dropdown[data-qid="${q.id}"]`) as HTMLElement|null;
          const search3  = contentEl.querySelector(`.${p}-gp-search input[data-qid="${q.id}"]`) as HTMLInputElement|null;
          if(!trigger3||!dd3) return;
          renderGpList(q.id, "");
          trigger3.addEventListener("click",(e)=>{
            e.stopPropagation();
            const isOpen = dd3.classList.contains("show");
            closeAllPickers(isOpen ? undefined : q.id);
            dd3.classList.toggle("show");
            trigger3.classList.toggle("open");
            if(dd3.classList.contains("show")) search3?.focus();
          });
          search3?.addEventListener("input",()=>renderGpList(q.id, search3?.value||""));
          search3?.addEventListener("click",(e)=>e.stopPropagation());
          dd3.addEventListener("click",(e)=>e.stopPropagation());
          // Tab switching (Groups / People)
          dd3.querySelectorAll(`.${p}-ap-tab[data-qid="${q.id}"]`).forEach((tab:Element)=>{
            tab.addEventListener("click",(e)=>{
              e.stopPropagation();
              const t = (tab as HTMLElement).dataset.tab as "group"|"user";
              taskAssignType[q.id]=t;
              if(search3) search3.value="";
              // update active tab appearance
              dd3.querySelectorAll(`.${p}-ap-tab`).forEach((tb:Element)=>tb.classList.toggle("active",(tb as HTMLElement).dataset.tab===t));
              renderGpList(q.id,"");
            });
          });
        });

        document.addEventListener("click",()=>closeAllPickers());

        contentEl.querySelector(`#${p}-back`)!.addEventListener("click",()=>{
          step="audit"; activeCat=categories[categories.length-1]||categories[0]; renderAudit();
        });
        contentEl.querySelector(`#${p}-submit`)!.addEventListener("click",submitAudit);
      }

      // ── Submit ────────────────────────────────────────────────────────
      async function submitAudit(){
        const submitBtn = contentEl.querySelector(`#${p}-submit`) as HTMLButtonElement;
        const progEl    = contentEl.querySelector(`#${p}-sprog`)  as HTMLElement;
        const sFill     = contentEl.querySelector(`#${p}-sfill`)  as HTMLElement;
        const sLabel    = contentEl.querySelector(`#${p}-slabel`) as HTMLElement;
        const sPct      = contentEl.querySelector(`#${p}-spct`)   as HTMLElement;
        const sLog      = contentEl.querySelector(`#${p}-slog`)   as HTMLElement;

        submitBtn.disabled=true;
        submitBtn.innerHTML=`<span class="${p}-spin" style="border-top-color:#fff;border-color:rgba(255,255,255,.3)"></span> Submitting…`;
        progEl.style.display="block";
        sLog.innerHTML="";
        hideBanner();

        const ft=failedTasks();
        const sc=getScore();
        const pct=sc.total>0&&sc.answered>0?Math.round((sc.earned/sc.total)*100):0;
        const passing=pct>=passThreshold;
        const inst=installations.find(i=>i.id===selectedInstId);
        const now=new Date();
        const listName=`Audit — ${now.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} ${now.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`;

        const totalOps=1+1+ft.length;
        let done=0;

        function setProgress(n:number,label:string){
          const pc=Math.round((n/totalOps)*100);
          sFill.style.width=`${pc}%`; sPct.textContent=`${pc}%`; sLabel.textContent=label;
        }
        function logLine(text:string,cls:"ok"|"err"|""=""){
          const d=document.createElement("div");
          d.className=`${p}-log-item ${cls}`; d.textContent=text;
          sLog.appendChild(d); sLog.scrollTop=sLog.scrollHeight;
        }

        try {
          setProgress(0,"Creating task list…");
          const listRes=await fetch(`${baseUrl}/tasks/${selectedInstId}/lists`,{
            method:"POST",...apiOpts(),
            body:JSON.stringify({name:listName,color:passing?"#2E7D4A":"#C41E3A"}),
          });
          if(!listRes.ok) throw new Error(`List creation failed (${listRes.status})`);
          const listData=await listRes.json();
          const listId:string=listData.id??listData.data?.id;
          if(!listId) throw new Error("No list ID in response");
          done++; logLine(`Created list: ${listName}`,"ok");

          const catBreakdown:Record<string,{earned:number;total:number;pct:number}>={};
          for(const cat of categories){
            const qs=questions.filter(q=>q.cat===cat);
            const earned=qs.reduce((a,q)=>a+(isPass(q,responses[q.id]||"")?q.pts:0),0);
            const tot=qs.reduce((a,q)=>a+q.pts,0);
            catBreakdown[cat]={earned,total:tot,pct:tot>0?Math.round((earned/tot)*100):0};
          }

          const blob=JSON.stringify({
            score:pct,passing,auditor:auditorName,date:auditDate,
            notes:auditNotes||undefined,
            store:inst?.title||selectedInstId,storeId:selectedInstId,
            taskCount:ft.length,categories:catBreakdown,
          });

          setProgress(done,"Creating audit summary task…");
          const sysRes=await fetch(`${baseUrl}/tasks/${selectedInstId}/task`,{
            method:"POST",...apiOpts(),
            body:JSON.stringify({
              title:`Audit — ${inst?.title||selectedInstId} — ${pct}% — ${passing?"Passing":"Failing"}`,
              description:`[type: audit-result]\n${blob}`,
              status:"OPEN",priority:"Priority_3",taskListId:listId,
            }),
          });
          done++;
          if(sysRes.ok) logLine("Created audit summary task","ok");
          else logLine(`Warning: summary task failed (${sysRes.status})`,"err");

          for(let i=0;i<ft.length;i++){
            const q=ft[i];
            setProgress(done,`Task ${i+1}/${ft.length}…`);
            const due=q.taskDue===0
              ?new Date().toISOString()
              :new Date(Date.now()+q.taskDue*86400000).toISOString().split("T")[0]+"T00:00:00.000Z";
            const prio=q.taskPriority==="Critical"||q.taskPriority==="High"?"Priority_1":q.taskPriority==="Medium"?"Priority_2":"Priority_3";
            try {
              const body:Record<string,unknown>={
                title:q.taskTitle||q.text,
                description:`Audit finding: ${q.id} — ${q.text}\nAudit: ${listName}\nAuditor: ${auditorName}`,
                status:"OPEN",priority:prio,taskListId:listId,dueDate:due,
              };
              const atype = taskAssignType[q.id]||"group";
              const gid2  = taskGroupOverrides[q.id]||"";
              const uid2  = taskUserOverrides[q.id]||"";
              if(atype==="user"&&uid2) body.userIds=[uid2];
              else if(gid2) body.groupIds=[gid2];
              const r=await fetch(`${baseUrl}/tasks/${selectedInstId}/task`,{method:"POST",...apiOpts(),body:JSON.stringify(body)});
              if(r.ok){
                logLine(`✓ ${q.taskTitle||q.text}`,"ok");
                const files=taskFiles[q.id]||[];
                if(files.length){
                  try{
                    const created=await r.json();
                    const newId=created?.id||created?.taskId;
                    if(newId){
                      const ids:string[]=[];
                      for(const f of files){ try{ ids.push(await uploadMedia(f)); }catch(_){} }
                      if(ids.length){
                        await fetch(`${baseUrl}/tasks/${selectedInstId}/task/${newId}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({attachmentIds:ids})});
                        logLine(`  ↳ attached ${ids.length} photo${ids.length>1?"s":""}`,"ok");
                      }
                    }
                  }catch(_){ logLine(`  ↳ photo attach failed`,"err"); }
                }
              }
              else logLine(`✗ ${q.taskTitle||q.text} (${r.status})`,"err");
            } catch(_){ logLine(`✗ ${q.taskTitle||q.text} (network error)`,"err"); }
            done++;
            await new Promise(res=>setTimeout(res,50));
          }

          setProgress(totalOps,"Done!");
          showBanner("success",`Audit submitted! "${listName}" created with ${ft.length+1} tasks.`);
        } catch(e:any){
          showBanner("error",`Submission failed: ${e.message}`);
          logLine(`Error: ${e.message}`,"err");
        }

        submitBtn.disabled=false;
        submitBtn.innerHTML=`${iSend} Submit &amp; Create Tasks`;
      }

      // ── Init ──────────────────────────────────────────────────────────
      renderSetup();
      fetchAll();
    }

    static get observedAttributes(){
      return ["appsscripturl","apitoken","baseurl","primarycolor","accentcolor","backgroundcolor","storelabelsingular","storelabelplural","passthreshold"];
    }
  };
};

// ── Block registration ────────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name:"audit-widget", label:"Audit Widget",
  attributes:["appsscripturl","apitoken","baseurl","primarycolor","accentcolor","backgroundcolor","storelabelsingular","storelabelplural","passthreshold"],
  factory, configurationSchema, uiSchema, blockLevel:"block", iconUrl:"",
};

window.defineBlock({ blockDefinition, author:"Staffbase", version:"1.0.0" } as ExternalBlockDefinition);
