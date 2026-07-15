import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from "@staffbase/widget-sdk";

import { JSONSchema7 } from "json-schema";
import { UiSchema } from "@rjsf/utils";

import { detectLocale, isRtl, makeT, translateMap, DEFAULT_LOCALE } from "../shared/i18n";
import { fetchThemeColors } from "../shared/theming";
import { STRINGS } from "./strings";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_API_TOKEN =
  "";
const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR = "#da2e32";
const DEFAULT_ACCENT_COLOR  = "#da2e32";

// ── Config schema ─────────────────────────────────────────────────────────────

const configurationSchema: JSONSchema7 = {
  properties: {
    apitoken:           { type:"string",  title:"API Token",                default: DEFAULT_API_TOKEN },
    baseurl:            { type:"string",  title:"Base URL",                 default: DEFAULT_BASE_URL },
    usethemecolors:     { type:"boolean", title:"Use Theme Colors",         default: false },
    backgroundcolor:    { type:"string",  title:"Background Color",         default: "" },
    storelabelsingular: { type:"string",  title:"Store Label (singular)",   default: "Store" },
    storelabelplural:   { type:"string",  title:"Store Label (plural)",     default: "Stores" },
    typecolors:         { type:"string",  title:"Type Colors (comma-separated hex)", default: "#DA2E32,#0369A1,#2E7D4A,#D97706,#7C3AED,#4A90A4,#8B4513,#0EA5E9" },
    showalltasks:       { type:"boolean", title:"Show All Tasks (not just mine)", default: false },
    showdonetasks:      { type:"boolean", title:"Include Completed Tasks",  default: true },
    auditmode:          { type:"boolean", title:"Audit Mode",               default: false },
    enablecomments:     { type:"boolean", title:"Enable Comments (experimental)", default: false },
    requirephotoproof:  { type:"boolean", title:"Require Photo Proof", default: false },
    allowtaskcreation:  { type:"boolean", title:"Allow Task Creation", default: false },
    allowtaskassignment:{ type:"boolean", title:"Allow Task Assignment", default: false },
    notifyonassign:     { type:"boolean", title:"Notify on Assignment", default: true },
    detailedlogging:    { type:"boolean", title:"Detailed Activity Logging", default: false },
    debugmode:          { type:"boolean", title:"Debug Mode (on-screen logs)", default: false },
    limitheight:        { type:"boolean", title:"Limit Height",                default: false },
    showcalendar:       { type:"boolean", title:"Show Calendar",               default: false },
  },
  // When "Use Theme Colors" is off, expose the manual Primary/Accent pickers.
  // When on, they're hidden (colors are pulled from the branding theme instead).
  dependencies: {
    usethemecolors: {
      oneOf: [
        {
          properties: {
            usethemecolors: { const: false },
            primarycolor:   { type:"string", title:"Primary Color", default: DEFAULT_PRIMARY_COLOR },
            accentcolor:    { type:"string", title:"Accent Color",  default: DEFAULT_ACCENT_COLOR },
          },
        },
        {
          properties: {
            usethemecolors: { const: true },
          },
        },
      ],
    },
    // When "Limit Height" is on, reveal the Max Height field.
    limitheight: {
      oneOf: [
        { properties: { limitheight: { const: false } } },
        { properties: { limitheight: { const: true }, maxheight: { type:"string", title:"Max Height (px)", default:"600" } } },
      ],
    },
    // When "Show Calendar" is on, reveal the dependent "Show Upcoming Recurring" option.
    showcalendar: {
      oneOf: [
        { properties: { showcalendar: { const: false } } },
        { properties: { showcalendar: { const: true }, showupcomingrecurring: { type:"boolean", title:"Show Upcoming Recurring", default:false } } },
      ],
    },
  },
};

const uiSchema: UiSchema = {
  apitoken:           { "ui:widget":"password", "ui:help":"Staffbase Basic auth token" },
  baseurl:            { "ui:help":"Staffbase API base URL" },
  usethemecolors:     { "ui:help":"Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
  primarycolor:       { "ui:widget":"color", "ui:help":"Primary brand color" },
  accentcolor:        { "ui:widget":"color", "ui:help":"Accent / secondary color" },
  backgroundcolor:    { "ui:widget":"color", "ui:help":"Widget background color — leave blank for transparent" },
  storelabelsingular: { "ui:help":"e.g. Store, Location, Branch" },
  storelabelplural:   { "ui:help":"e.g. Stores, Locations, Branches" },
  typecolors:         { "ui:help":"Type-badge palette. Colors are assigned to each type in order; all are used before any repeat." },
  showalltasks:       { "ui:help":"When enabled, tasks from all users are shown — not just yours" },
  showdonetasks:      { "ui:help":"When enabled, completed tasks are included in the view" },
  auditmode:          { "ui:help":"When enabled, shows audit results and history instead of regular tasks" },
  enablecomments:     { "ui:help":"Experimental: show a comments section in the task detail panel (uses the logged-in user's session)" },
  requirephotoproof:  { "ui:help":"When on, marking a task done requires the viewer to submit a photo. The photo is posted as a proof comment on the task, and the task is only marked done once the photo is uploaded." },
  allowtaskcreation:  { "ui:help":"Show a “New Task” button so users can create tasks from this widget" },
  allowtaskassignment:{ "ui:help":"Allow reassigning a task (to a group or person) from its detail panel — works in both normal and audit mode" },
  notifyonassign:     { "ui:help":"Send a Staffbase notification (“You were assigned a new task”) to people newly assigned a task via this widget" },
  detailedlogging:    { "ui:help":"Record reassignments and completions as hidden activity entries the Manager Tasks widget surfaces in its activity feed. Off by default." },
  debugmode:          { "ui:help":"Show an on-screen log panel with a copy button — useful for debugging inside the mobile app" },
  limitheight:        { "ui:help":"Cap the widget's height — anything taller scrolls inside a styled scrollbar" },
  maxheight:          { "ui:help":"Maximum height in pixels (e.g. 600). You can also include a CSS unit like 600px or 70vh." },
  showcalendar:       { "ui:help":"Add a Calendar view (toggle in the header) that plots tasks by assigned, due, overdue and completed dates" },
  showupcomingrecurring: { "ui:help":"On the calendar, also show upcoming recurring tasks that will be assigned to the viewer (next 60 days), drawn with a dashed outline" },
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
  // Lean toward white text: only genuinely light backgrounds get dark text, so
  // mid-tone/saturated colors (e.g. #4A90A4) read as white, not harsh black.
  return L>0.45?"#1a1a1a":"#ffffff";
}

// ── Task type parsing ─────────────────────────────────────────────────────────

const TYPE_REGEX = /\[type:\s*([^\]]+)\]/i;

function parseTaskType(text: string): string|null {
  const m=TYPE_REGEX.exec(text);
  return m?m[1].trim().toLowerCase():null;
}

// Recurrence markers written by the recurring-tasks-widget / scheduler:
//   [rrule: ...]  — schedule definition on a hidden template task
//   [recur: id@YYYY-MM-DD] — dedup stamp on a generated recurring task
const RRULE_REGEX = /\[rrule:\s*[^\]]+\]/i;
const RECUR_REGEX = /\[recur:\s*[^\]]+\]/i;
// Priority level stamp on generated recurring tasks (Critical & High both map to
// Priority_1, so this distinguishes them). e.g. [lvl: critical]
const LVL_REGEX = /\[lvl:\s*([^\]]+)\]/i;

function stripTypeTag(text: string): string {
  return text
    .replace(TYPE_REGEX,"")
    .replace(RRULE_REGEX,"")
    .replace(RECUR_REGEX,"")
    .replace(LVL_REGEX,"")
    .replace(/\[by:\s*[^\]]+\]/i,"")   // hidden creator stamp
    .replace(/\[notify:\s*[^\]]+\]/i,"")
    .replace(/\s{2,}/g," ")
    .trim();
}

// ── Recurrence rules (calendar's upcoming-recurring markers) ────────────────────
// Minimal port of the schedule grammar + firing logic from recurring-tasks-widget.
// The schedule lives in a hidden [recur-template] task description as
// [rrule: f=…;i=…;d=…;time=…;due=…;s=…;…]. For the calendar we only need to know
// which future days a rule fires on, plus its time-of-day and due offset.
const RRULE_CAPTURE = /\[rrule:\s*([^\]]+)\]/i;
const REC_WEEKDAYS = ["SU","MO","TU","WE","TH","FR","SA"];

type CalRule = {
  freq: "DAILY"|"WEEKLY"|"MONTHLY";
  interval: number;          // every N days / weeks / months
  byday: string[];           // weekly: e.g. ["MO","WE"]
  monthMode: "dom"|"nth";    // monthly: by day-of-month or by nth weekday
  dom: number;               // 1-31
  nth: number;               // 1..4, or -1 = last
  nthWeekday: string;        // "MO".."SU"
  time: string;              // "HH:MM" (24h)
  dueOffset: number;         // days after the fire/assign date that it's due
  start: string;             // "YYYY-MM-DD" anchor for interval math
  end: string;               // "YYYY-MM-DD" or "" for no end
};

function parseCalRule(desc: string): CalRule|null {
  const m = RRULE_CAPTURE.exec(desc);
  if (!m) return null;
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const r: CalRule = {
    freq:"DAILY", interval:1, byday:["MO","TU","WE","TH","FR"],
    monthMode:"dom", dom:today.getDate(), nth:1, nthWeekday:REC_WEEKDAYS[today.getDay()],
    time:"09:00", dueOffset:0, start:iso, end:"",
  };
  for (const part of m[1].split(";")) {
    const eq = part.indexOf("="); if (eq<0) continue;
    const k = part.slice(0,eq).trim(); const v = part.slice(eq+1).trim();
    switch(k){
      case "f":    if(v==="DAILY"||v==="WEEKLY"||v==="MONTHLY") r.freq=v; break;
      case "i":    r.interval=Math.max(1,parseInt(v,10)||1); break;
      case "d":    r.byday=v.split(",").map(s=>s.trim().toUpperCase()).filter(x=>REC_WEEKDAYS.includes(x)); break;
      case "mm":   r.monthMode=v==="nth"?"nth":"dom"; break;
      case "dom":  r.dom=Math.min(31,Math.max(1,parseInt(v,10)||1)); break;
      case "nth":  r.nth=parseInt(v,10)||1; break;
      case "nthd": if(REC_WEEKDAYS.includes(v.toUpperCase())) r.nthWeekday=v.toUpperCase(); break;
      case "time": if(/^\d{1,2}:\d{2}$/.test(v)) r.time=v; break;
      case "due":  r.dueOffset=parseInt(v,10)||0; break;
      case "s":    if(/^\d{4}-\d{2}-\d{2}$/.test(v)) r.start=v; break;
      case "e":    if(/^\d{4}-\d{2}-\d{2}$/.test(v)) r.end=v; break;
    }
  }
  return r;
}

// Does this rule fire on the given (local) calendar date? Day-level only.
function recurFiresOn(r: CalRule, date: Date): boolean {
  const start = new Date(`${r.start}T00:00:00`);
  const d  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s0 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (d < s0) return false;
  if (r.end){ const [ey,em,ed]=r.end.split("-").map(Number); if(d>new Date(ey,em-1,ed)) return false; }
  if (r.freq==="DAILY"){
    const days=Math.round((d.getTime()-s0.getTime())/86400000);
    return days % r.interval === 0;
  }
  if (r.freq==="WEEKLY"){
    if(!r.byday.includes(REC_WEEKDAYS[d.getDay()])) return false;
    const startWeek=new Date(start); startWeek.setDate(start.getDate()-start.getDay());
    const thisWeek =new Date(d);     thisWeek.setDate(d.getDate()-d.getDay());
    const weeks=Math.round((thisWeek.getTime()-startWeek.getTime())/(7*86400000));
    return weeks % r.interval === 0;
  }
  // MONTHLY
  const months=(d.getFullYear()-start.getFullYear())*12+(d.getMonth()-start.getMonth());
  if(months<0 || months % r.interval!==0) return false;
  if(r.monthMode==="dom"){
    const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    return d.getDate()===Math.min(r.dom,lastDay); // clamp so "31" fires on short months' last day
  }
  if(REC_WEEKDAYS[d.getDay()]!==r.nthWeekday) return false;
  if(r.nth===-1){ const next=new Date(d); next.setDate(d.getDate()+7); return next.getMonth()!==d.getMonth(); }
  return Math.ceil(d.getDate()/7)===r.nth;
}

// ── Color palette for type badges ─────────────────────────────────────────────
// Colors come from the configurable `typecolors` palette, assigned round-robin to
// the distinct types (sorted, so a type keeps its color) — every color is used
// before any repeats. TYPE_PALETTE/TYPE_ORDER are set per-instance in renderBlock.

let TYPE_PALETTE: string[] = []; // set per-instance from the `typecolors` config
let TYPE_ORDER: string[] = [];

// Original system — used when no palette is configured (field blank / all cleared).
const TYPE_COLORS: Record<string,string> = {
  storetask:"#da2e32", compliance:"#8B4513", maintenance:"#2E7D4A",
  training:"#4A90A4", audit:"#7C3AED", safety:"#D97706", inventory:"#0369A1",
};
function typeColorOriginal(key: string): string {
  if (TYPE_COLORS[key]) return TYPE_COLORS[key];
  let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffffff;
  return `hsl(${((h >> 16) & 0xff) % 360},55%,40%)`;
}

function typeColor(type: string): string {
  const key = type.toLowerCase();
  if (!TYPE_PALETTE.length) return typeColorOriginal(key); // no palette → fall back to original system
  let i = TYPE_ORDER.indexOf(key);
  if (i < 0) { // not registered yet — deterministic fallback so it's still stable
    let h = 0; for (let c = 0; c < key.length; c++) h = (h * 31 + key.charCodeAt(c)) & 0xffffff;
    i = h;
  }
  return TYPE_PALETTE[i % TYPE_PALETTE.length];
}

function priorityLabel(p: string): string {
  if(p==="Priority_1") return "High";
  if(p==="Priority_2") return "Med";
  return "Low";
}

function priorityColor(p: string): string {
  if(p==="Priority_1") return "#C41E3A";
  if(p==="Priority_2") return "#D97706";
  return "#6b7280";
}

// ── Widget factory ────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class MyTasksWidget extends BaseBlockClass implements BaseBlock {
    constructor() { super(); }

    async renderBlock(container: any) {
      const apiToken     = this.getAttribute("apitoken")           || DEFAULT_API_TOKEN;
      const baseUrl      = (this.getAttribute("baseurl")||DEFAULT_BASE_URL).replace(/\/$/,"");
      let   primaryColor = this.getAttribute("primarycolor")       || DEFAULT_PRIMARY_COLOR;
      let   accentColor  = this.getAttribute("accentcolor")        || DEFAULT_ACCENT_COLOR;
      const bgColor      = this.getAttribute("backgroundcolor")    || "";
      // When "Use Theme Colors" is on, pull Primary/Accent from the branding theme
      // (token-auth GET). Failures fall back silently to the values above.
      if (this.getAttribute("usethemecolors") === "true") {
        const themed = await fetchThemeColors(baseUrl, apiToken);
        if (themed.primary) primaryColor = themed.primary;
        if (themed.accent)  accentColor  = themed.accent;
      }
      // Valid hex colors only; if blank/all-cleared, TYPE_PALETTE stays empty → original color system.
      TYPE_PALETTE = (this.getAttribute("typecolors") || "").split(",").map(s=>s.trim()).filter(c=>/^#?[0-9a-fA-F]{3,8}$/.test(c)).map(c=>c[0]==="#"?c:`#${c}`);
      const showAll      = this.getAttribute("showalltasks")       === "true";
      const showDone     = this.getAttribute("showdonetasks")      !== "false";
      const auditMode    = this.getAttribute("auditmode")          === "true";
      const enableComments = this.getAttribute("enablecomments")   === "true";
      const requireProof   = this.getAttribute("requirephotoproof") === "true";
      const allowCreate    = this.getAttribute("allowtaskcreation") === "true";
      const allowAssign    = this.getAttribute("allowtaskassignment") === "true";
      const notifyOnAssign = this.getAttribute("notifyonassign")       !== "false";
      const detailedLogging = this.getAttribute("detailedlogging")     === "true";
      const storeSingular  = this.getAttribute("storelabelsingular") || "Store";
      const debugMode      = this.getAttribute("debugmode")        === "true";
      const showCalendar   = this.getAttribute("showcalendar")     === "true";
      const showUpcomingRecurring = this.getAttribute("showupcomingrecurring") === "true";

      const primaryRgb  = hexToRgb(primaryColor);
      const accentRgb = hexToRgb(accentColor);
      const primaryText = contrastColor(primaryColor);
      const p = "mtw";

      // ── Limit height / scroll ───────────────────────────────────────────
      // When on, the root becomes a fixed-max-height scroll container with a
      // subtly themed scrollbar. Body-appended panels (detail/create) are
      // position:fixed outside the root, so they're never clipped by this.
      const limitHeight = this.getAttribute("limitheight") === "true";
      let   maxHeight   = (this.getAttribute("maxheight") || "").trim();
      if (!maxHeight) maxHeight = "600px";
      else if (/^\d+(\.\d+)?$/.test(maxHeight)) maxHeight += "px";
      const limitCss = limitHeight ? `
          .${p}.${p}-limited{max-height:${maxHeight};overflow-y:auto;box-sizing:border-box;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(${primaryRgb},.45) transparent}
          .${p}.${p}-limited::-webkit-scrollbar{width:10px;height:10px}
          .${p}.${p}-limited::-webkit-scrollbar-track{background:transparent;margin:6px 0}
          .${p}.${p}-limited::-webkit-scrollbar-thumb{background:rgba(${primaryRgb},.32);border-radius:8px;border:3px solid transparent;background-clip:padding-box}
          .${p}.${p}-limited::-webkit-scrollbar-thumb:hover{background:rgba(${primaryRgb},.55);background-clip:padding-box}` : "";

      // ── State ──────────────────────────────────────────────────────────
      type Task = {
        id: string; title: string; description: string; status: string;
        priority: string; dueDate: string|null; taskType: string|null;
        installationId: string; installationTitle: string;
        listId: string; listName: string;
        groupIds: string[]; assigneeIds: string[];
        attachmentIds: string[];
        auditSeverity?: string; // "Critical" etc., parsed from audit description
        isRecurring?: boolean;  // generated by the recurring-tasks-widget scheduler
        createDate?: string;    // when the task was created / assigned (calendar)
        updateDate?: string;    // last change of any kind (completion-date fallback)
      };

      type AuditList = {
        listId: string; listName: string; installId: string; instTitle: string;
        systemTask: Task|null; parsedAudit: any|null;
      };

      let allTasks: Task[]           = [];
      let recurTemplates: Task[]     = []; // hidden [recur-template] tasks → calendar's upcoming-recurring markers only
      const completionDates          = new Map<string,string>(); // taskId → completion ISO (from [tasks:edit] comment, else updateDate)
      let completionDatesLoaded      = false; // lazy: loaded once when the calendar first needs them
      let activeTypeFilters          = new Set<string>();
      let activeStatusFilter         = "open";
      let activeInstallFilter        = "all";
      let activeAuditListId          = "";
      let auditLists: AuditList[]    = [];
      let showCompletedAudit         = false;
      let showOtherAuditTasks        = false;
      let introUsed                  = false; // staggered entrance only on first list render
      let currentUserId              = "";
      // ── Calendar view state ────────────────────────────────────────────
      let view: "list"|"calendar"    = "list";
      let calMode: "month"|"agenda"  = "month";
      let calCursor                  = new Date(); // month: any day in the month · agenda: first visible day
      let calDays                    = 3;          // visible day columns in agenda (2 when narrow); set per-render
      // ── Locale / i18n ──────────────────────────────────────────────────
      // Resolved once on load from the user's Staffbase locale (see load()).
      // Until then we render in the default locale, so first paint is identical
      // to the pre-i18n behavior for en_US users.
      let locale                     = DEFAULT_LOCALE;
      // `tr` (not `t`) — the codebase uses `t` as the task loop variable in many
      // .map/.filter callbacks, which would shadow a translator named `t`.
      let tr                         = makeT(STRINGS, locale);
      // ── On-demand content translation (free-text task data) ────────────
      // Ephemeral: nothing is persisted. `ct(text)` returns the cached
      // translation when translate-mode is on, else the original.
      let contentTranslated          = false;
      let translateBusy              = false;
      const ctCache: {[k:string]:string} = {};
      const ct = (s:string):string => { if(!contentTranslated||!s) return s; return ctCache[s.trim()]||s; };
      // Comments translate independently (their own toggle in the comment list).
      let cmtTranslated              = false;
      let cmtTrBusy                  = false;
      const cmtCache: {[k:string]:string} = {};
      let lastCmt: { comments:any[]; authors:any[]; bodies:string[]; task:Task } | null = null;
      let allInstalls: Array<{id:string;title:string}> = [];           // for task creation
      const listsByInst = new Map<string, Array<{id:string;name:string}>>();
      let usersList: Array<{id:string;name:string}> | null = null; // lazy, for reassign picker
      let userGroupIds: string[]     = [];
      const groupMap                 = new Map<string,string>(); // groupId → name
      const EDIT_MARK                = "[tasks:edit]"; // hidden audit-comment marker (shared w/ manager widget)
      const isEditCommentText        = (txt:string)=>txt.trim().indexOf(EDIT_MARK)===0;

      // ── Render skeleton ────────────────────────────────────────────────
      container.innerHTML = `
        <style>
          .${p}{--primary:${primaryColor};--primary-rgb:${primaryRgb};--accent-rgb:${accentRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;--shadow-sm:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);--shadow-md:0 4px 16px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bgColor||"transparent"};padding:20px}
          .${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
          /* Neutralize Staffbase's global button rule (margin:auto/width:90%) inside the
             body-appended panels, which sit outside the .${p} reset above. */
          .${p}-detail button,.${p}-create button{margin:0!important;box-sizing:border-box}
          .${p}-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
          .${p}-title{font-size:18px;font-weight:800;color:var(--dark);display:flex;align-items:center;gap:10px}
          .${p}-title-dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));flex-shrink:0}
          .${p}-badge-count{background:var(--primary);color:var(--primary-text);padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700}
          .${p} .${p}-refresh-btn{width:34px;height:34px;border:1.5px solid var(--border)!important;border-radius:var(--r-md)!important;background:#fff!important;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gray)!important;transition:background .15s,color .15s,border-color .15s}
          .${p} .${p}-refresh-btn:hover,.${p} .${p}-refresh-btn:focus,.${p} .${p}-refresh-btn:focus-visible,.${p} .${p}-refresh-btn:active{background:#fff!important;color:var(--primary)!important;border-color:var(--primary)!important;box-shadow:none!important;outline:none!important}
          .${p} .${p}-refresh-btn svg{stroke:currentColor!important;fill:none!important}
          .${p} .${p}-refresh-btn span{color:currentColor!important}
          .${p}-refresh-btn:hover{border-color:var(--primary);color:var(--primary);background:rgba(var(--primary-rgb),.05)}
          .${p}-refresh-btn:disabled{opacity:.4;cursor:not-allowed}
          .${p}-header-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
          .${p}-new-btn{display:inline-flex!important;width:auto!important;align-items:center;gap:6px;height:34px;padding:0 14px!important;border:none!important;border-radius:var(--r-md);background:var(--primary)!important;color:var(--primary-text,#fff)!important;font-family:inherit;font-size:13px;font-weight:700;line-height:normal!important;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(var(--primary-rgb),.3);transition:all .15s}
          .${p}-new-btn:hover{filter:brightness(.9);transform:translateY(-1px)}
          /* ── Create task sheet ── */
          .${p}-create{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--error:#C41E3A;--r-sm:6px;--r-md:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;left:0;right:0;bottom:0;z-index:100001;background:#fff;border-radius:20px 20px 0 0;max-height:90vh;display:flex;flex-direction:column;transform:translateY(102%);transition:transform .32s cubic-bezier(.32,.72,0,1);overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,.18)}
          .${p}-create.open{transform:translateY(0)}
          .${p}-create.side{left:50%;top:50%;right:auto;bottom:auto;width:min(480px,94vw);max-height:min(88vh,820px);border-radius:20px;transform:translate(-50%,-48%) scale(.97);opacity:0;pointer-events:none;box-shadow:0 24px 64px rgba(0,0,0,.28);transition:opacity .2s ease,transform .26s cubic-bezier(.32,.72,0,1)}
          .${p}-create.side.open{transform:translate(-50%,-50%) scale(1);opacity:1;pointer-events:auto}
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
          .${p}-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(var(--primary-rgb),.22);border-top-color:var(--accent);animation:${p}-spin .7s linear infinite;flex-shrink:0;display:inline-block}
          @keyframes ${p}-spin{to{transform:rotate(360deg)}}
          /* ── Detail panel ── */
          .${p}-overlay{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .25s ease}
          .${p}-overlay.open{opacity:1;pointer-events:auto}
          .${p}-detail{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--accent:${accentColor};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#fff;border-radius:20px 20px 0 0;max-height:88vh;display:flex;flex-direction:column;transform:translateY(102%);transition:transform .32s cubic-bezier(.32,.72,0,1);overflow:hidden}
          .${p}-detail.open{transform:translateY(0)}
          .${p}-detail.side{left:50%;top:50%;right:auto;bottom:auto;width:min(460px,92vw);max-height:min(86vh,760px);border-radius:20px;transform:translate(-50%,-48%) scale(.97);opacity:0;pointer-events:none;box-shadow:0 24px 64px rgba(0,0,0,.28);transition:opacity .2s ease,transform .26s cubic-bezier(.32,.72,0,1)}
          .${p}-detail.side.open{transform:translate(-50%,-50%) scale(1);opacity:1;pointer-events:auto}
          .${p}-detail-handle{width:40px;height:5px;border-radius:3px;background:var(--border);margin:9px auto 2px;flex-shrink:0;cursor:grab;touch-action:none}
          .${p}-detail-head{touch-action:none}
          .${p}-detail.side .${p}-detail-handle{display:none}
          .${p}-detail-head{display:flex;align-items:center;gap:10px;padding:16px 20px 12px;flex-shrink:0;border-bottom:1px solid var(--border)}
          .${p}-detail-head-badges{display:flex;gap:6px;flex-wrap:wrap;flex:1;align-items:center}
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
          .${p}-af-finding{font-size:13px;font-weight:400;line-height:1.5;color:var(--gray);margin-bottom:11px}
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
          /* Attachment preview modal */
          .${p}-amodal{position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;padding:16px}
          .${p}-amodal.open{display:flex}
          .${p}-amodal-card{background:#fff;border-radius:var(--r-lg);width:100%;max-width:min(900px,96vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.4)}
          .${p}-amodal-head{display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid var(--border);flex-shrink:0}
          .${p}-amodal-name{flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .${p}-amodal-dl{display:inline-flex!important;align-items:center;gap:6px;width:auto!important;margin:0!important;font-family:inherit;font-size:13px;font-weight:700;line-height:normal!important;border:none!important;border-radius:var(--r-md)!important;background:var(--primary)!important;color:var(--primary-text,#fff)!important;cursor:pointer;padding:8px 14px!important;flex-shrink:0}
          .${p}-amodal-x{width:32px;height:32px;flex-shrink:0;border:none!important;border-radius:50%;background:#f3f4f6!important;color:var(--gray)!important;cursor:pointer;display:flex!important;align-items:center;justify-content:center;padding:0!important;margin:0!important}
          .${p}-amodal-body{flex:1;min-height:0;overflow:auto;background:#f1f3f5;display:flex;align-items:center;justify-content:center}
          .${p}-amodal-body img{max-width:100%;max-height:88vh;object-fit:contain;display:block}
          .${p}-amodal-body iframe,.${p}-amodal-body object,.${p}-amodal-pdf{width:100%;height:84vh;border:none;background:#fff}
          .${p}-amodal-none{display:flex;flex-direction:column;align-items:center;gap:12px;padding:48px 24px;color:var(--gray-lt);font-size:13px}
          /* ── Photo proof modal ── */
          .${p}-proof{--primary:${primaryColor};--primary-rgb:${primaryRgb};--primary-text:${primaryText};--accent:${accentColor};--accent-rgb:${accentRgb};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;position:fixed;inset:0;z-index:100003;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:16px}
          .${p}-proof.open{display:flex}
          .${p}-proof-card{background:#fff;border-radius:var(--r-lg);width:100%;max-width:min(420px,96vw);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.4)}
          .${p}-proof-head{display:flex;align-items:center;gap:8px;padding:13px 14px;border-bottom:1px solid var(--border);flex-shrink:0}
          .${p}-proof-title{flex:1;min-width:0;font-size:14px;font-weight:800;color:var(--dark)}
          .${p}-proof-x{width:30px;height:30px;flex-shrink:0;border:none;border-radius:50%;background:#f3f4f6!important;color:var(--gray)!important;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
          .${p}-proof-x:hover,.${p}-proof-x:focus,.${p}-proof-x:active{background:#e5e7eb!important;color:var(--dark)!important}
          .${p}-proof-x:disabled{opacity:.4;cursor:default}
          .${p}-proof-body{padding:14px}
          .${p}-proof-desc{margin:0 0 12px;font-size:13px;color:var(--gray);line-height:1.5}
          .${p}-proof-drop{display:block;position:relative;border:1.5px dashed rgba(var(--primary-rgb),.4);border-radius:var(--r-md);background:rgba(var(--primary-rgb),.04);cursor:pointer;overflow:hidden;transition:border-color .15s,background .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
          @media (hover:hover){.${p}-proof-drop:hover{border-color:var(--primary);background:rgba(var(--primary-rgb),.08)}}
          .${p}-proof-drop.has{border-style:solid;border-color:var(--primary)}
          .${p}-proof-drop-inner{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:150px;padding:20px;color:var(--primary);font-size:13px;font-weight:700;text-align:center}
          .${p}-proof-drop.has .${p}-proof-drop-inner{padding:0;gap:0}
          .${p}-proof-preview{width:100%;max-height:260px;object-fit:contain;display:block;background:#f1f3f5}
          .${p}-proof-fname{padding:8px 10px;font-size:12px;color:var(--gray);font-weight:600;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
          .${p}-proof-file{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
          .${p}-proof-err{margin-top:10px;font-size:12px;color:var(--error);font-weight:600}
          .${p}-proof-err:empty{display:none}
          .${p}-proof-foot{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--border);flex-shrink:0}
          .${p}-proof-btn{flex:1;padding:10px;border-radius:var(--r-md);border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:7px;transition:all .15s}
          .${p}-proof-cancel,.${p}-proof-cancel:hover,.${p}-proof-cancel:focus,.${p}-proof-cancel:active{background:#f3f4f6!important;color:var(--gray)!important}
          .${p}-proof-cancel:hover{background:#e5e7eb!important}
          .${p}-proof-cancel:disabled{opacity:.5;cursor:default}
          .${p}-proof-confirm,.${p}-proof-confirm:hover,.${p}-proof-confirm:focus,.${p}-proof-confirm:active{background:var(--primary)!important;color:var(--primary-text,#fff)!important}
          .${p}-proof-confirm:active{background:rgba(var(--accent-rgb),.85)!important}
          .${p}-proof-confirm:disabled{opacity:.5;cursor:default}
          .${p}-proof-spin{width:13px;height:13px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:${p}-spin .7s linear infinite}
          .${p}-att-x{width:auto!important;margin:0 0 0 2px!important;border:none!important;background:none!important;color:var(--gray-lt);cursor:pointer;padding:3px!important;display:flex!important;border-radius:50%;flex-shrink:0;transition:color .15s,background .15s}
          .${p}-att-x:hover{color:var(--error);background:rgba(196,30,58,.08)}
          .${p}-att-empty{font-size:12px;color:var(--gray-lt)}
          /* ── Comments ── */
          .${p}-cmt{margin-top:18px;border-top:1px solid var(--border);padding-top:14px}
          .${p}-cmt-list{display:flex;flex-direction:column;gap:14px;margin-bottom:14px}
          .${p}-cmt-item{display:flex;gap:10px;align-items:flex-start;position:relative}
          .${p}-cmt-tr{position:absolute;top:-2px;inset-inline-end:0;display:none;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--primary)!important;background:#fff!important;border:1px solid var(--border)!important;border-radius:12px;padding:2px 8px;cursor:pointer;font-family:inherit;z-index:3;line-height:1.4}
          .${p}-cmt-tr svg{stroke:currentColor!important}
          .${p}-cmt-item:hover .${p}-cmt-tr,.${p}-cmt-item.show-tr .${p}-cmt-tr{display:inline-flex}
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
          .${p}-cmt-bar{display:none;align-items:center;gap:6px;margin-top:8px}
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
          .${p}-cmt-chips{display:flex;flex-wrap:nowrap;gap:5px;flex:1;min-width:0;overflow-x:auto;margin:0;scrollbar-width:none}
          .${p}-cmt-chips::-webkit-scrollbar{display:none}
          .${p}-cmt-chip{display:inline-flex;align-items:center;gap:5px;max-width:130px;flex-shrink:0;font-size:11px;font-weight:600;background:rgba(var(--primary-rgb),.08);color:var(--primary);border-radius:12px;padding:3px 4px 3px 9px}
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
          .${p}-store-tab:hover{border-color:var(--accent);color:var(--accent);background:rgba(var(--accent-rgb),.06)}
          .${p}-store-tab.active{background:var(--primary);border-color:var(--primary);color:var(--primary-text)}
          /* ── Filter bar ── */
          .${p}-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;align-items:center}
          .${p}-type-wrap{position:relative;flex:1;min-width:0}
          .${p}-type-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 11px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;font-family:inherit;transition:all .15s;text-align:start}
          .${p}-type-btn:hover,.${p}-type-btn.open{border-color:var(--accent);color:var(--accent)}
          .${p}-type-btn svg{flex-shrink:0;transition:transform .15s}
          .${p}-type-btn.open svg{transform:rotate(180deg)}
          .${p}-type-menu{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid var(--border);border-radius:var(--r-md);box-shadow:var(--shadow-md);z-index:100;overflow:hidden}
          .${p}-type-menu.open{display:block}
          .${p}-type-opt{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:none;font-size:12px;font-weight:500;color:var(--gray);cursor:pointer;font-family:inherit;text-align:start;transition:background .1s}
          .${p}-type-opt:hover{background:rgba(0,0,0,.04);color:var(--dark)}
          .${p}-type-opt.active{font-weight:700;color:var(--dark);background:rgba(var(--primary-rgb),.06)}
          .${p}-type-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
          .${p}-status-toggle{display:flex;border:1.5px solid var(--border);border-radius:var(--r-md);overflow:hidden;background:#fff;flex-shrink:0}
          .${p}-status-opt{padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer;color:var(--gray);font-family:inherit;border:none;background:none;transition:all .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none;user-select:none}
          .${p}-status-opt.active{background:var(--primary);color:var(--primary-text)}
          .${p}-list-filters{display:flex;gap:8px;align-items:center;flex:1 1 220px;min-width:0}
          .${p}-view-toggle{display:flex;border:1.5px solid var(--border);border-radius:var(--r-md);overflow:hidden;background:#fff;flex-shrink:0}
          .${p}-view-opt{padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer;color:var(--gray);font-family:inherit;border:none;background:none;transition:all .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none;user-select:none}
          .${p}-view-opt.active{background:var(--primary);color:var(--primary-text)}
          /* ── Calendar ── */
          .${p}-cal{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);overflow:hidden}
          .${p}-cal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap}
          .${p}-cal-range{font-size:15px;font-weight:800;color:var(--dark)}
          .${p}-cal-ctrls{display:flex;align-items:center;gap:8px}
          .${p}-cal-modeseg{display:flex;border:1.5px solid var(--border);border-radius:var(--r-md);overflow:hidden;background:#fff}
          .${p}-cal-modeseg button{padding:6px 11px;font-size:11px;font-weight:700;cursor:pointer;color:var(--gray);font-family:inherit;border:none;background:none;transition:all .15s}
          .${p}-cal-modeseg button.active{background:var(--primary);color:var(--primary-text)}
          .${p}-cal-nav{display:flex;gap:2px}
          .${p}-ico-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:1.5px solid var(--border);border-radius:var(--r-sm);background:#fff;color:var(--gray);cursor:pointer;transition:all .15s}
          .${p}-ico-btn:hover{border-color:var(--accent);color:var(--accent)}
          [dir="rtl"] .${p}-cal-nav .${p}-ico-btn svg{transform:scaleX(-1)}
          /* agenda (2/3 day) */
          .${p}-cal-cols{display:grid;width:100%}
          .${p}-cal-col{border-inline-end:1px solid #f3f4f6;min-height:280px;min-width:0;overflow:hidden}
          .${p}-cal-col:last-child{border-inline-end:none}
          .${p}-cal-colhead{text-align:center;padding:9px 4px 7px;border-bottom:1px solid var(--border)}
          .${p}-cal-dow2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gray-lt)}
          .${p}-cal-dnum{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;font-size:16px;font-weight:800;color:var(--dark);margin-top:3px}
          .${p}-cal-colhead.today .${p}-cal-dnum{background:var(--accent);color:#fff}
          .${p}-cal-evs{padding:6px;display:flex;flex-direction:column;gap:5px}
          .${p}-col-empty{color:var(--gray-lt);text-align:center;font-size:13px;padding:14px 0}
          /* events use a per-state --ev-rgb so one rule colours bg, accent + hover */
          .${p}-ev{--ev-rgb:var(--primary-rgb);border-radius:6px;padding:5px 8px;cursor:pointer;transition:background .12s;background:rgba(var(--ev-rgb),.10);border-inline-start:3px solid rgba(var(--ev-rgb),1)}
          .${p}-ev:hover{background-color:rgba(var(--ev-rgb),.06);background-image:repeating-linear-gradient(45deg,rgba(var(--ev-rgb),.16) 0,rgba(var(--ev-rgb),.16) 5px,transparent 5px,transparent 10px)}
          .${p}-ev-time{font-size:10px;font-weight:700;color:rgba(var(--ev-rgb),1)}
          .${p}-ev-title{font-size:12px;font-weight:600;color:var(--dark);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .${p}-ev.assigned{--ev-rgb:var(--primary-rgb)}
          .${p}-ev.due{--ev-rgb:var(--accent-rgb)}
          .${p}-ev.overdue{--ev-rgb:196,30,58}
          .${p}-ev.completed{--ev-rgb:46,125,74}
          .${p}-ev.upcoming{--ev-rgb:156,163,175;background:transparent;border:1px dashed rgba(var(--ev-rgb),1);border-inline-start:3px dashed rgba(var(--ev-rgb),1)}
          /* overdue banner (red, above the grid) */
          .${p}-cal-overdue{display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;border:none;border-bottom:1px solid var(--border);background:rgba(196,30,58,.08);color:var(--error);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;text-align:start;transition:background .15s}
          .${p}-cal-overdue:hover{background:rgba(196,30,58,.14)}
          .${p}-cal-overdue svg{flex-shrink:0}
          .${p}-cal-overdue .${p}-cal-overdue-arrow{margin-inline-start:auto}
          [dir="rtl"] .${p}-cal-overdue .${p}-cal-overdue-arrow{transform:scaleX(-1)}
          /* month grid */
          .${p}-cal-dow{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));background:#f9fafb;border-bottom:1px solid var(--border)}
          .${p}-cal-dow span{padding:7px 0;text-align:center;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt)}
          .${p}-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
          .${p}-cal-cell{min-height:84px;min-width:0;overflow:hidden;border-inline-end:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;padding:5px 6px}
          .${p}-cal-cell:nth-child(7n){border-inline-end:none}
          .${p}-cal-cell.muted{background:#fafafa}
          .${p}-cal-cell.today .${p}-cal-num{background:var(--accent);color:#fff}
          .${p}-cal-num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:12px;font-weight:600;color:var(--dark)}
          .${p}-cal-cell.muted .${p}-cal-num{color:var(--gray-lt)}
          .${p}-cal-chip{display:block;font-size:10px;font-weight:600;border-radius:4px;padding:1px 5px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
          .${p}-cal-chip:hover{filter:brightness(.96)}
          .${p}-cal-chip.assigned{color:var(--primary);background:rgba(var(--primary-rgb),.12)}
          .${p}-cal-chip.due{color:var(--accent);background:rgba(var(--accent-rgb),.12)}
          .${p}-cal-chip.overdue{color:var(--error);background:rgba(196,30,58,.12)}
          .${p}-cal-chip.completed{color:var(--success);background:rgba(46,125,74,.12)}
          .${p}-cal-chip.upcoming{color:var(--gray);background:transparent;border:1px dashed var(--gray-lt)}
          .${p}-cal-cdot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
          .${p}-cal-cdot.assigned{background:var(--primary)}
          .${p}-cal-cdot.due{background:var(--accent)}
          .${p}-cal-cdot.overdue{background:var(--error)}
          .${p}-cal-cdot.completed{background:var(--success)}
          .${p}-cal-cdot.upcoming{background:transparent;border:1px dashed var(--gray-lt)}
          .${p}-cal-more{font-size:10px;color:var(--gray-lt);margin-top:2px;font-weight:600}
          .${p}-cal-dots{display:none;gap:3px;margin-top:4px;justify-content:center}
          .${p}-cal-dots i{width:5px;height:5px;border-radius:50%;background:var(--primary)}
          /* legend */
          .${p}-cal-legend{display:flex;flex-wrap:wrap;gap:10px 16px;padding:10px 14px;border-top:1px solid var(--border);font-size:11px;color:var(--gray)}
          .${p}-cal-leg{display:inline-flex;align-items:center;gap:6px}
          .${p}-cal-leg i{width:9px;height:9px;border-radius:50%;flex-shrink:0}
          .${p}-cal-leg.assigned i{background:var(--primary)}
          .${p}-cal-leg.due i{background:var(--accent)}
          .${p}-cal-leg.overdue i{background:var(--error)}
          .${p}-cal-leg.completed i{background:var(--success)}
          .${p}-cal-leg.upcoming i{background:transparent;border:1px dashed var(--gray-lt)}
          /* responsive (mobile): hide chips, show dots */
          .${p}-cal-compact .${p}-cal-cell{min-height:46px;padding:5px 2px 6px;text-align:center}
          .${p}-cal-compact .${p}-cal-chip,.${p}-cal-compact .${p}-cal-more{display:none}
          .${p}-cal-compact .${p}-cal-dots{display:flex}
          .${p}-cal-compact .${p}-cal-num{width:24px;height:24px}
          .${p}-cal-compact .${p}-cal-dow span{font-size:9px;padding:6px 0}
          /* ── Task cards ── */
          .${p}-list{display:flex;flex-direction:column;gap:8px}
          .${p}-card{background:#fff;border-radius:var(--r-lg);box-shadow:var(--shadow-sm);border:1px solid var(--border);border-inline-start:3px solid var(--primary);overflow:hidden;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-left-color .35s ease,opacity .35s ease}
          .${p}-card:hover:not(.done){transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.09);border-inline-start-color:var(--accent)}
          .${p}-card:active:not(.done){transform:translateY(0);box-shadow:var(--shadow-sm)}
          .${p}-card.done{border-inline-start-color:var(--border);opacity:.72}
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
          .${p}-type-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;line-height:1.4;letter-spacing:.5px;text-transform:uppercase;color:#fff;flex-shrink:0}
          .${p}-prio-badge{display:inline-flex;align-items:center;padding:1.5px 7px;border-radius:4px;font-size:10px;font-weight:700;line-height:1.4;letter-spacing:.3px;flex-shrink:0;border:1.5px solid currentColor}
          .${p}-recur-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.3px;flex-shrink:0;text-transform:uppercase;background:rgba(var(--primary-rgb),.1);color:var(--primary)}
          .${p}-recur-badge svg{width:9px;height:9px}
          .${p}-card-title{font-size:14px;font-weight:700;color:var(--dark);line-height:1.3;word-break:break-word;transition:color .3s ease}
          .${p}-card.done .${p}-card-title{color:var(--gray)}
          .${p}-card-title>span{position:relative;display:inline}
          .${p}-card-title>span::after{content:"";position:absolute;left:0;top:50%;height:1.5px;background:var(--gray);width:0;transform:translateY(-50%);transition:width .35s ease;display:block}
          .${p}-card.done .${p}-card-title>span::after{width:100%}
          .${p}-card-desc{font-size:12px;color:var(--gray);margin-top:3px;line-height:1.45;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
          .${p}-card-meta{display:flex;flex-wrap:wrap;gap:3px 10px;margin-top:7px;align-items:center;line-height:12px}
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
          ${[1,2,3,4,5,6,7,8,9,10].map(n=>`.${p}-list.intro>*:nth-child(${n}){animation-delay:${(n-1)*0.05}s}`).join("")}
          .${p}-list.intro>*:nth-child(n+11){animation-delay:.5s}
          /* Comment entrance */
          @keyframes ${p}-cmt-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
          .${p}-cmt-item{animation:${p}-cmt-in .32s ease both}
          ${[1,2,3,4,5,6,7,8].map(n=>`.${p}-cmt-list .${p}-cmt-item:nth-child(${n}){animation-delay:${(n-1)*0.04}s}`).join("")}
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
          .${p}-reassign-opt .${p}-ck{margin-inline-start:auto;color:var(--success);display:none;flex-shrink:0}
          .${p}-reassign-opt.sel{background:rgba(var(--primary-rgb),.06)}
          .${p}-reassign-opt.sel .${p}-ck{display:flex}
          .${p}-reassign-opt.sel span:first-of-type{font-weight:600}
          .${p}-reassign-empty{padding:9px 12px;font-size:12px;color:var(--gray-lt)}
          .${p}-reassign-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-top:1px solid var(--border);background:#fafafa}
          .${p}-reassign-sel{font-size:11px;color:var(--gray);font-weight:600}
          .${p}-reassign-save,.${p}-reassign-clear{width:auto!important;margin:0!important;font-family:inherit;font-size:12px;font-weight:700;border-radius:var(--r-sm);cursor:pointer;padding:6px 12px!important;border:none!important;line-height:normal!important}
          .${p}-reassign-save{background:var(--primary)!important;color:var(--primary-text)!important}
          .${p}-reassign-save:disabled{opacity:.5;cursor:default}
          .${p}-reassign-clear{background:transparent!important;color:var(--gray)!important}
          .${p}-reassign-clear:hover{color:var(--error)!important}
          .${p}-audit-detail-score{font-size:52px;font-weight:800;line-height:1;letter-spacing:-1px}
          .${p}-audit-detail-sub{font-size:14px;font-weight:700;margin:4px 0 16px}
          .${p}-detail.audit-view .${p}-detail-foot{display:none}
          .${p}-detail.audit-view .${p}-detail-body{padding-bottom:44px}
          .${p}-cat-chart{display:flex;flex-direction:column;gap:10px;margin-top:13px}
          .${p}-cat-top{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-bottom:4px}
          .${p}-cat-name{color:var(--dark);font-weight:400}
          .${p}-cat-pct{color:var(--gray);font-weight:700;flex-shrink:0;margin-inline-start:8px}
          .${p}-cat-bar{height:7px;background:rgba(0,0,0,.08);border-radius:4px;overflow:hidden}
          .${p}-cat-fill{display:block;height:100%;border-radius:4px;transition:width .45s ease}
          .${p}-cat-fill.hi{background:var(--success)}
          .${p}-cat-fill.mid{background:#d97706}
          .${p}-cat-fill.lo{background:var(--error)}
          /* ── Assignee tab toggle in detail ── */
          .${p}-assign-tabs{display:flex;gap:4px;margin:8px 0}
          .${p}-assign-tab{flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px;font-weight:600;background:#f9fafb;color:var(--gray);cursor:pointer;text-align:center;transition:all .15s;font-family:inherit}
          .${p}-assign-tab.active{background:var(--primary);color:var(--primary-text);border-color:var(--primary)}
          /* Neutralize Staffbase's global blue/red button hover/focus/active background
             on our chrome buttons (their rules aren't !important, so this wins). */
          .${p}-assign-tab,.${p}-assign-tab:hover,.${p}-assign-tab:focus{background:#f9fafb!important;color:var(--gray)!important}
          .${p}-assign-tab.active,.${p}-assign-tab.active:hover,.${p}-assign-tab.active:focus{background:var(--primary)!important;color:var(--primary-text)!important}
          .${p}-refresh-btn,.${p}-refresh-btn:focus{background:#fff!important}
          .${p}-refresh-btn:hover{background:rgba(var(--primary-rgb),.05)!important}
          .${p}-detail-close,.${p}-detail-close:hover,.${p}-detail-close:focus,.${p}-create-close,.${p}-create-close:hover,.${p}-create-close:focus{background:#f3f4f6!important;color:var(--gray)!important}
          .${p}-other-toggle,.${p}-other-toggle:hover,.${p}-other-toggle:focus{background:none!important}
          .${p}-reassign-btn,.${p}-reassign-btn:focus{background:rgba(var(--primary-rgb),.07)!important}
          .${p}-reassign-btn:hover{background:rgba(var(--primary-rgb),.13)!important}
          .${p}-status-opt,.${p}-status-opt:hover,.${p}-status-opt:focus{background:none!important}
          .${p}-status-opt.active,.${p}-status-opt.active:hover,.${p}-status-opt.active:focus{background:var(--primary)!important;color:var(--primary-text)!important}
          .${p}-type-btn,.${p}-type-btn:hover,.${p}-type-btn:focus,.${p}-type-btn.open{background:#fff!important}
          .${p}-type-opt,.${p}-type-opt:focus{background:none!important}
          .${p}-type-opt:hover{background:rgba(0,0,0,.04)!important}
          .${p}-type-opt.active,.${p}-type-opt.active:hover,.${p}-type-opt.active:focus{background:rgba(var(--primary-rgb),.06)!important}
          .${p}-detail-toggle-btn.done-btn,.${p}-detail-toggle-btn.done-btn:focus{background:rgba(var(--primary-rgb),.08)!important}
          .${p}-detail-toggle-btn.done-btn:hover{background:var(--primary)!important;color:var(--primary-text)!important}
          /* Faded-accent click feedback on the primary CTAs (replaces host blue :active) */
          .${p}-new-btn:active,.${p}-btn-save:active,.${p}-cmt-send:active{background:rgba(var(--accent-rgb),.85)!important;color:#fff!important;filter:none!important}
          /* Pin text/icon color so the host button color:#fff rules can't whiten light buttons */
          .${p}-status-opt:not(.active),.${p}-status-opt:not(.active):hover,.${p}-status-opt:not(.active):focus,.${p}-status-opt:not(.active):active,
          .${p}-type-opt:not(.active),.${p}-type-opt:not(.active):focus,.${p}-type-opt:not(.active):active,
          .${p}-audit-arrow,.${p}-audit-arrow:hover,.${p}-audit-arrow:focus,.${p}-audit-arrow:active,
          .${p}-amodal-x,.${p}-amodal-x:hover,.${p}-amodal-x:focus,.${p}-amodal-x:active{color:var(--gray)!important}
          .${p}-type-btn,.${p}-type-btn:focus,.${p}-type-btn:active{color:var(--gray)!important}
          .${p}-type-btn:hover,.${p}-type-btn.open{color:var(--accent)!important}
          .${p}-type-opt:hover,.${p}-type-opt.active{color:var(--dark)!important}
          .${p}-other-toggle,.${p}-other-toggle:hover,.${p}-other-toggle:focus,.${p}-other-toggle:active{color:var(--gray-lt)!important}
          .${p}-reassign-btn,.${p}-reassign-btn:hover,.${p}-reassign-btn:focus,.${p}-reassign-btn:active{color:var(--primary)!important}
          .${p}-detail-toggle-btn.open-btn,.${p}-detail-toggle-btn.open-btn:focus{background:#f3f4f6!important}
          .${p}-detail-toggle-btn.open-btn:hover{background:var(--border)!important;color:var(--dark)!important}
          .${p}-reassign-opt,.${p}-reassign-opt:focus{background:none!important}
          .${p}-reassign-opt:hover{background:rgba(var(--primary-rgb),.06)!important}
          .${p}-dbg-btn,.${p}-dbg-btn:hover,.${p}-dbg-btn:focus{background:#21262d!important}
          .${p}-dbg-btn:active{background:var(--primary)!important}
          /* Calendar chrome buttons — same Staffbase-blue neutralization */
          .${p}-view-opt,.${p}-view-opt:hover,.${p}-view-opt:focus{background:none!important}
          .${p}-view-opt.active,.${p}-view-opt.active:hover,.${p}-view-opt.active:focus{background:var(--primary)!important;color:var(--primary-text)!important}
          .${p}-view-opt:not(.active),.${p}-view-opt:not(.active):hover,.${p}-view-opt:not(.active):focus,.${p}-view-opt:not(.active):active{color:var(--gray)!important}
          .${p}-cal-modeseg button,.${p}-cal-modeseg button:hover,.${p}-cal-modeseg button:focus{background:none!important}
          .${p}-cal-modeseg button.active,.${p}-cal-modeseg button.active:hover,.${p}-cal-modeseg button.active:focus{background:var(--primary)!important;color:var(--primary-text)!important}
          .${p}-cal-modeseg button:not(.active),.${p}-cal-modeseg button:not(.active):hover,.${p}-cal-modeseg button:not(.active):focus,.${p}-cal-modeseg button:not(.active):active{color:var(--gray)!important}
          .${p}-ico-btn,.${p}-ico-btn:focus,.${p}-ico-btn:active{background:#fff!important;color:var(--gray)!important}
          .${p}-ico-btn:hover{background:#fff!important;color:var(--accent)!important}
          .${p}-cal-overdue,.${p}-cal-overdue:focus,.${p}-cal-overdue:active{background:rgba(196,30,58,.08)!important;color:var(--error)!important}
          .${p}-cal-overdue:hover{background:rgba(196,30,58,.14)!important;color:var(--error)!important}
          /* ── States ── */
          .${p}-state{padding:40px 20px;text-align:center;color:var(--gray-lt);font-size:13px;line-height:1.6}
          .${p}-state-icon{font-size:32px;margin-bottom:8px;display:block}
          .${p}-state strong{color:var(--gray);display:block;font-size:14px;margin-bottom:4px}
          .${p}-banner{display:none;padding:10px 14px;border-radius:var(--r-md);margin-bottom:12px;font-size:13px;line-height:1.5}
          .${p}-banner.error{background:rgba(196,30,58,.08);border:1px solid rgba(196,30,58,.25);color:var(--error)}
          .${p}-banner.info{background:rgba(var(--primary-rgb),.06);border:1px solid rgba(var(--primary-rgb),.2);color:var(--primary)}
          .${p}-section-label{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gray-lt);padding:4px 0 8px;margin-top:4px}
          /* ── Ghost cards (other audit tasks) ── */
          .${p}-card.ghost{opacity:.55;border-inline-start-color:var(--border)}
          .${p}-card.ghost:hover{opacity:.8}
          .${p}-other-toggle{width:100%;padding:9px 14px;background:none;border:1.5px dashed var(--border);border-radius:var(--r-md);font-size:12px;font-weight:600;color:var(--gray-lt);cursor:pointer;text-align:center;font-family:inherit;transition:all .15s;touch-action:manipulation;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px}
          .${p}-other-toggle:hover{border-color:var(--gray);color:var(--gray)}
        
          /* RTL: flip horizontal directional arrows */
          [dir="rtl"] .mtw-audit-arrow svg{transform:scaleX(-1)}
          ${limitCss}
        </style>

        <div class="${p}${limitHeight ? ` ${p}-limited` : ""}">
          <div class="${p}-header">
            <div class="${p}-title">
              <span class="${p}-title-dot"></span>
              <span id="${p}-title-text">${auditMode?tr("auditResults"):tr("myTasks")}</span>
              <span class="${p}-badge-count" id="${p}-count">0</span>
            </div>
            <div class="${p}-header-actions">
              ${allowCreate&&!auditMode?`<button type="button" class="${p}-new-btn" id="${p}-new" title="${tr("newTask")}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span id="${p}-new-label">${tr("newTask")}</span></button>`:""}
              <button type="button" class="${p}-refresh-btn" id="${p}-translate" title="${tr("translateBtn")}" style="display:none;width:auto;padding:0 10px;gap:5px">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>
                <span id="${p}-translate-lbl"></span>
              </button>
              <button type="button" class="${p}-refresh-btn" id="${p}-refresh" title="${tr("refresh")}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
          </div>

          ${auditMode ? `<div class="${p}-audit-tab-wrap" id="${p}-audit-tab-wrap" style="display:none">
            <div class="${p}-audit-tab-label" id="${p}-audit-tab-label">${tr("auditHistory")}</div>
            <div class="${p}-audit-scroll">
              <button type="button" class="${p}-audit-arrow" id="${p}-audit-prev" aria-label="${tr("scrollLeft")}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
              <div class="${p}-audit-tabs" id="${p}-audit-tabs"></div>
              <button type="button" class="${p}-audit-arrow" id="${p}-audit-next" aria-label="${tr("scrollRight")}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
            </div>
          </div>` : ""}

          <div class="${p}-store-tabs" id="${p}-store-tabs" style="display:none"></div>
          <div class="${p}-banner" id="${p}-banner"></div>

          ${!auditMode ? `
          <div class="${p}-filters">
            ${showCalendar?`<div class="${p}-view-toggle" id="${p}-view-toggle">
              <button type="button" class="${p}-view-opt active" data-view="list">${tr("listView")}</button>
              <button type="button" class="${p}-view-opt" data-view="calendar">${tr("calendar")}</button>
            </div>`:""}
            <div class="${p}-list-filters" id="${p}-list-filters">
              <div class="${p}-type-wrap" id="${p}-type-wrap">
                <button type="button" class="${p}-type-btn" id="${p}-type-btn">
                  <span id="${p}-type-label">${tr("allTypes")}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="${p}-type-menu" id="${p}-type-menu"></div>
              </div>
              <div class="${p}-status-toggle">
                <button type="button" class="${p}-status-opt active" data-status="open">${tr("open")}</button>
                <button type="button" class="${p}-status-opt" data-status="done">${tr("done")}</button>
                ${showDone?`<button type="button" class="${p}-status-opt" data-status="all">${tr("both")}</button>`:""}
              </div>
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
      const countEl       = container.querySelector(`#${p}-count`)!;
      const bannerEl      = container.querySelector(`#${p}-banner`) as HTMLElement;
      const storeTabs     = container.querySelector(`#${p}-store-tabs`) as HTMLElement;
      const listWrap      = container.querySelector(`#${p}-list-wrap`)!;
      const refreshBtn    = container.querySelector(`#${p}-refresh`) as HTMLButtonElement;

      const typeBtn       = !auditMode ? container.querySelector(`#${p}-type-btn`) as HTMLButtonElement : null;
      const typeLabelEl   = !auditMode ? container.querySelector(`#${p}-type-label`) as HTMLElement : null;
      const typeMenu      = !auditMode ? container.querySelector(`#${p}-type-menu`) as HTMLElement : null;
      const auditTabWrap  = auditMode ? container.querySelector(`#${p}-audit-tab-wrap`) as HTMLElement : null;
      const auditTabsEl   = auditMode ? container.querySelector(`#${p}-audit-tabs`) as HTMLElement : null;
      const auditPrev     = auditMode ? container.querySelector(`#${p}-audit-prev`) as HTMLButtonElement : null;
      const auditNext     = auditMode ? container.querySelector(`#${p}-audit-next`) as HTMLButtonElement : null;
      function updateAuditArrows(){
        if(!auditTabsEl||!auditPrev||!auditNext) return;
        const max=auditTabsEl.scrollWidth-auditTabsEl.clientWidth;
        const overflow=max>4;
        auditPrev.classList.toggle("show", overflow && auditTabsEl.scrollLeft>2);
        auditNext.classList.toggle("show", overflow && auditTabsEl.scrollLeft<max-2);
      }
      if(auditTabsEl&&auditPrev&&auditNext){
        const step=()=>Math.max(160,auditTabsEl.clientWidth*0.7);
        auditPrev.addEventListener("click",()=>auditTabsEl.scrollBy({left:-step(),behavior:"smooth"}));
        auditNext.addEventListener("click",()=>auditTabsEl.scrollBy({left:step(),behavior:"smooth"}));
        auditTabsEl.addEventListener("scroll",updateAuditArrows,{passive:true});
        window.addEventListener("resize",updateAuditArrows);
      }

      // Detail panel — appended to body so position:fixed works in Staffbase.
      // Body-appended elements + document listeners don't get cleaned up on
      // SPA navigation when the host element is removed, so we manage their
      // lifecycle explicitly via refs stashed on `this`.
      const self: any = this;

      // Tear down artifacts from a previous render of this same host (re-renders)
      if (self._mtwOverlay)  { self._mtwOverlay.remove();  self._mtwOverlay  = undefined; }
      if (self._mtwDetail)   { self._mtwDetail.remove();   self._mtwDetail   = undefined; }
      if (self._mtwAModal)   { self._mtwAModal.remove();   self._mtwAModal   = undefined; }
      if (self._mtwProof)    { self._mtwProof.remove();    self._mtwProof    = undefined; }
      if (self._mtwCreate)   { self._mtwCreate.remove();   self._mtwCreate   = undefined; }
      if (self._mtwDocClick) { document.removeEventListener("click",   self._mtwDocClick); self._mtwDocClick = undefined; }
      if (self._mtwDocKey)   { document.removeEventListener("keydown", self._mtwDocKey);   self._mtwDocKey   = undefined; }

      const instId = Math.random().toString(36).slice(2);
      container.dataset.mtwInst = instId;
      container.dataset.sbPortalHost = instId;

      // Defensive sweep: remove any body-appended portal node — from this or any
      // sibling task widget — whose owning host is no longer in the DOM.
      // disconnectedCallback is unreliable across Staffbase SPA navigation, so a
      // widget that *is* on the page clears stale portals left by pages that aren't.
      document.querySelectorAll<HTMLElement>("[data-sb-portal]").forEach(node => {
        const owner = node.getAttribute("data-sb-portal");
        if (!owner || !document.querySelector(`[data-sb-portal-host="${owner}"]`)) node.remove();
      });

      const overlayEl = document.createElement("div");
      overlayEl.className = `${p}-overlay`;
      overlayEl.dataset.mtwInst = instId;
      overlayEl.dataset.sbPortal = instId;
      document.body.appendChild(overlayEl);
      self._mtwOverlay = overlayEl;

      const detailEl = document.createElement("div");
      detailEl.className = `${p}-detail`;
      detailEl.dataset.mtwInst = instId;
      detailEl.dataset.sbPortal = instId;
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

      const detailBadges = detailEl.querySelector(`#${p}-detail-badges-${instId}`) as HTMLElement;
      const detailBody   = detailEl.querySelector(`#${p}-detail-body-${instId}`) as HTMLElement;
      const detailToggle = detailEl.querySelector(`#${p}-detail-toggle-${instId}`) as HTMLButtonElement;
      const detailClose  = detailEl.querySelector(`#${p}-detail-close-${instId}`) as HTMLButtonElement;

      // ── Attachment preview modal (images + PDFs) ───────────────────────
      const attModal = document.createElement("div");
      attModal.className = `${p}-amodal`;
      attModal.innerHTML = `
        <div class="${p}-amodal-card">
          <div class="${p}-amodal-head">
            <span class="${p}-amodal-name" id="${p}-amodal-name-${instId}"></span>
            <button type="button" class="${p}-amodal-dl" id="${p}-amodal-dl-${instId}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>
            <button type="button" class="${p}-amodal-x" id="${p}-amodal-x-${instId}" aria-label="Close"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="${p}-amodal-body" id="${p}-amodal-body-${instId}"></div>
        </div>`;
      attModal.dataset.sbPortal = instId;
      document.body.appendChild(attModal);
      self._mtwAModal = attModal;
      const aName = attModal.querySelector(`#${p}-amodal-name-${instId}`) as HTMLElement;
      const aBody = attModal.querySelector(`#${p}-amodal-body-${instId}`) as HTMLElement;
      const aDl   = attModal.querySelector(`#${p}-amodal-dl-${instId}`) as HTMLButtonElement;
      const aX    = attModal.querySelector(`#${p}-amodal-x-${instId}`) as HTMLButtonElement;
      let dlUrl = "", dlName = "";
      // previewUrl = the reliable thumbnail (full image for pics, page-1 image for PDFs);
      // downloadUrl = best-effort original. kind: img | pdf | other.
      function openAttModal(previewUrl:string,downloadUrl:string,name:string,kind:string){
        dlUrl=downloadUrl||previewUrl; dlName=name||"file";
        aName.textContent=dlName;
        const none=`<div class="${p}-amodal-none"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${tr("noPreview")}</span></div>`;
        if(kind==="pdf"&&downloadUrl){
          // Native PDF viewer via <object> on the derived .pdf (same URL the app uses); iframe fallback.
          aBody.innerHTML=`<object class="${p}-amodal-pdf" data="${esc(downloadUrl)}" type="application/pdf"><iframe src="${esc(downloadUrl)}" title="${esc(dlName)}"></iframe></object>`;
        } else if(kind==="img"){
          aBody.innerHTML=`<img alt="${esc(dlName)}">`;
          const img=aBody.querySelector("img") as HTMLImageElement;
          img.src=downloadUrl||previewUrl;
          // Fall back to the thumbnail if the full-res derived URL fails to load.
          img.onerror=()=>{ if(previewUrl&&img.getAttribute("src")!==previewUrl){ img.src=previewUrl; } };
        } else {
          aBody.innerHTML=none;
        }
        attModal.classList.add("open");
      }
      function closeAttModal(){ attModal.classList.remove("open"); aBody.innerHTML=""; }
      aX.addEventListener("click",closeAttModal);
      attModal.addEventListener("click",e=>{ if(e.target===attModal) closeAttModal(); });
      aDl.addEventListener("click",async()=>{
        if(!dlUrl) return;
        const name=dlName;
        try{
          const res=await fetch(dlUrl); const blob=await res.blob();
          const navAny=navigator as any;
          const file=new File([blob],name,{type:blob.type||"application/octet-stream"});
          // On mobile, the native share sheet offers "Save Image" / "Save to Files".
          if(navAny.canShare && navAny.canShare({files:[file]})){ await navAny.share({files:[file],title:name}); return; }
          const obj=URL.createObjectURL(blob); const a=document.createElement("a");
          a.href=obj; a.download=name; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(()=>URL.revokeObjectURL(obj),5000);
        }catch(_){ window.open(dlUrl,"_blank"); }
      });
      // Delegated: clicking any attachment in the detail body opens the preview modal.
      detailBody.addEventListener("click",e=>{
        const a=(e.target as HTMLElement).closest("[data-att-url]") as HTMLElement|null;
        if(!a) return;
        e.preventDefault();
        openAttModal(a.dataset.attPreview||a.dataset.attUrl||"", a.dataset.attUrl||"", a.dataset.attName||"file", a.dataset.attKind||"other");
      });

      // ── Photo-proof modal (gates "mark done" when Require Photo Proof is on) ──
      const iCamera=`<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
      const proofModal = document.createElement("div");
      proofModal.className = `${p}-proof`; proofModal.dataset.sbPortal = instId;
      proofModal.innerHTML = `
        <div class="${p}-proof-card">
          <div class="${p}-proof-head">
            <span class="${p}-proof-title">${tr("proofTitle")}</span>
            <button type="button" class="${p}-proof-x" id="${p}-proof-x-${instId}" aria-label="${tr("cancel")}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="${p}-proof-body">
            <p class="${p}-proof-desc">${tr("proofDesc")}</p>
            <label class="${p}-proof-drop" id="${p}-proof-drop-${instId}" for="${p}-proof-file-${instId}">
              <div class="${p}-proof-drop-inner" id="${p}-proof-inner-${instId}">${iCamera}<span>${tr("proofPick")}</span></div>
            </label>
            <input type="file" accept="image/*" class="${p}-proof-file" id="${p}-proof-file-${instId}">
            <div class="${p}-proof-err" id="${p}-proof-err-${instId}"></div>
          </div>
          <div class="${p}-proof-foot">
            <button type="button" class="${p}-proof-btn ${p}-proof-cancel" id="${p}-proof-cancel-${instId}">${tr("cancel")}</button>
            <button type="button" class="${p}-proof-btn ${p}-proof-confirm" id="${p}-proof-confirm-${instId}" disabled>${tr("proofConfirm")}</button>
          </div>
        </div>`;
      document.body.appendChild(proofModal); self._mtwProof = proofModal;
      const pFile    = proofModal.querySelector(`#${p}-proof-file-${instId}`)    as HTMLInputElement;
      const pDrop    = proofModal.querySelector(`#${p}-proof-drop-${instId}`)    as HTMLElement;
      const pInner   = proofModal.querySelector(`#${p}-proof-inner-${instId}`)   as HTMLElement;
      const pErr     = proofModal.querySelector(`#${p}-proof-err-${instId}`)     as HTMLElement;
      const pCancel  = proofModal.querySelector(`#${p}-proof-cancel-${instId}`)  as HTMLButtonElement;
      const pConfirm = proofModal.querySelector(`#${p}-proof-confirm-${instId}`) as HTMLButtonElement;
      const pX       = proofModal.querySelector(`#${p}-proof-x-${instId}`)       as HTMLButtonElement;
      let proofResolve:((v:boolean)=>void)|null = null;
      let proofFile:File|null = null;
      let proofTask:Task|null = null;
      let proofBusy = false;
      let proofPreviewUrl = "";
      function resetProof(){
        proofFile=null; pErr.textContent=""; pConfirm.disabled=true; pConfirm.innerHTML=tr("proofConfirm");
        pDrop.classList.remove("has"); pInner.innerHTML=`${iCamera}<span>${tr("proofPick")}</span>`;
        pFile.value=""; if(proofPreviewUrl){ URL.revokeObjectURL(proofPreviewUrl); proofPreviewUrl=""; }
      }
      function closeProof(result:boolean){
        if(proofBusy) return;
        proofModal.classList.remove("open");
        const r=proofResolve; proofResolve=null; proofTask=null; resetProof();
        if(r) r(result);
      }
      // Opens the proof modal and resolves true only after the photo is uploaded
      // and posted as a [proof] comment; false if the viewer cancels.
      function openProof(task:Task):Promise<boolean>{
        proofTask=task; resetProof(); proofModal.classList.add("open");
        return new Promise<boolean>(res=>{ proofResolve=res; });
      }
      pFile.addEventListener("change",()=>{
        const f=(pFile.files||[])[0]; if(!f) return;
        if(!/^image\//.test(f.type)){ pErr.textContent=tr("proofOnlyImages"); return; }
        if(f.size>MEDIA_MAX){ pErr.textContent=`"${f.name}" exceeds ${humanSize(MEDIA_MAX)}.`; return; }
        proofFile=f; pErr.textContent="";
        if(proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
        proofPreviewUrl=URL.createObjectURL(f);
        pInner.innerHTML=`<img class="${p}-proof-preview" src="${proofPreviewUrl}" alt=""><span class="${p}-proof-fname">${esc(f.name)}</span>`;
        pDrop.classList.add("has"); pConfirm.disabled=false;
      });
      pCancel.addEventListener("click",()=>closeProof(false));
      pX.addEventListener("click",()=>closeProof(false));
      proofModal.addEventListener("click",e=>{ if(e.target===proofModal) closeProof(false); });
      pConfirm.addEventListener("click",async()=>{
        if(!proofFile||!proofTask||proofBusy) return;
        const task=proofTask, file=proofFile;
        proofBusy=true; pConfirm.disabled=true; pCancel.disabled=true; pX.disabled=true; pErr.textContent="";
        pConfirm.innerHTML=`<span class="${p}-proof-spin"></span> ${tr("proofUploading")}`;
        try{
          const m=await uploadMedia(file);
          await postComment(task, `${PROOF_MARK} [attachment:${m.id}]`);
          // Keep the media referenced on the task so it persists and can surface later.
          const nextIds=[...(task.attachmentIds||[]), m.id];
          try{ await fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({attachmentIds:nextIds})}); task.attachmentIds=nextIds; }catch(_){}
          proofBusy=false; pCancel.disabled=false; pX.disabled=false;
          closeProof(true);
        }catch(e:any){
          proofBusy=false; pCancel.disabled=false; pX.disabled=false; pConfirm.disabled=false;
          pConfirm.innerHTML=tr("proofConfirm"); pErr.textContent=`${tr("proofFailed")}: ${e.message}`;
        }
      });

      // ── Drag-to-dismiss the bottom sheet (mobile) ──────────────────────
      (function setupSheetDrag(){
        let startY=0, dy=0, dragging=false;
        const begin=(y:number)=>{ if(detailEl.classList.contains("side")) return; dragging=true; startY=y; dy=0; detailEl.style.transition="none"; };
        const move=(y:number)=>{ if(!dragging) return; dy=Math.max(0,y-startY); detailEl.style.transform=`translateY(${dy}px)`; overlayEl.style.opacity=String(Math.max(0,1-dy/420)); };
        const end=()=>{ if(!dragging) return; dragging=false; detailEl.style.transition=""; detailEl.style.transform=""; overlayEl.style.opacity=""; if(dy>110) closeDetail(); };
        [`.${p}-detail-handle`,`.${p}-detail-head`].forEach(sel=>{
          const el=detailEl.querySelector(sel) as HTMLElement|null; if(!el) return;
          el.addEventListener("touchstart",(e:any)=>begin(e.touches[0].clientY),{passive:true});
          el.addEventListener("touchmove",(e:any)=>{ move(e.touches[0].clientY); if(dragging&&dy>0) e.preventDefault(); },{passive:false});
          el.addEventListener("touchend",end);
          el.addEventListener("touchcancel",end);
        });
      })();

      // ── Helpers ───────────────────────────────────────────────────────
      const apiOpts = (extra?: RequestInit): RequestInit => ({
        ...extra, credentials:"omit",
        headers:{ Authorization:`Basic ${apiToken}`, "Content-Type":"application/json" },
      });

      function esc(s:string){return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
      function showBanner(type:"error"|"info", msg:string){bannerEl.className=`${p}-banner ${type}`;bannerEl.style.display="block";bannerEl.textContent=msg;}
      function hideBanner(){bannerEl.style.display="none";}

      // ── On-screen debug log (for mobile webview where console is hidden) ──
      const debugLog:string[]=[];
      let debugBodyEl:HTMLElement|null=null;
      function dlog(...args:any[]){
        const ts=new Date().toISOString().slice(11,23);
        const line=ts+" "+args.map(a=>{
          if(typeof a==="string") return a;
          try{ return JSON.stringify(a); }catch(_){ return String(a); }
        }).join(" ");
        debugLog.push(line);
        if(debugLog.length>500) debugLog.shift();
        try{ console.log("[mtw]",...args); }catch(_){}
        if(debugBodyEl){
          debugBodyEl.textContent=debugLog.join("\n");
          debugBodyEl.scrollTop=debugBodyEl.scrollHeight;
        }
      }
      function buildDebugPanel(){
        if(!debugMode) return;
        const panel=document.createElement("div");
        panel.className=`${p}-dbg`;
        panel.innerHTML=`
          <div class="${p}-dbg-bar">
            <span class="${p}-dbg-title">${tr("debug")}</span>
            <div class="${p}-dbg-actions">
              <button type="button" class="${p}-dbg-btn" data-act="copy">${tr("copy")}</button>
              <button type="button" class="${p}-dbg-btn" data-act="clear">${tr("clear")}</button>
              <button type="button" class="${p}-dbg-btn" data-act="toggle">${tr("hide")}</button>
            </div>
          </div>
          <pre class="${p}-dbg-body"></pre>`;
        document.body.appendChild(panel);
        debugBodyEl=panel.querySelector(`.${p}-dbg-body`) as HTMLElement;
        const body=debugBodyEl;
        const copyBtn=panel.querySelector(`[data-act="copy"]`) as HTMLButtonElement;
        panel.querySelector(`[data-act="clear"]`)!.addEventListener("click",()=>{ debugLog.length=0; if(body) body.textContent=""; });
        panel.querySelector(`[data-act="toggle"]`)!.addEventListener("click",(e)=>{
          const collapsed=panel.classList.toggle("collapsed");
          (e.target as HTMLElement).textContent=collapsed?"Show":"Hide";
        });
        copyBtn.addEventListener("click",async()=>{
          const text=debugLog.join("\n");
          let ok=false;
          try{ await navigator.clipboard.writeText(text); ok=true; }
          catch(_){
            // Fallback for webviews without async clipboard.
            try{
              const ta=document.createElement("textarea");
              ta.value=text; ta.style.position="fixed"; ta.style.opacity="0";
              document.body.appendChild(ta); ta.focus(); ta.select();
              ok=document.execCommand("copy"); document.body.removeChild(ta);
            }catch(_){ ok=false; }
          }
          copyBtn.textContent=ok?tr("copied"):tr("copyFailed");
          setTimeout(()=>{ copyBtn.textContent=tr("copy"); },1500);
        });
        dlog("debug panel ready · origin",location.origin,"· comments",enableComments);
      }
      buildDebugPanel();

      function formatDate(iso:string|null):{text:string;overdue:boolean}{
        if(!iso) return{text:"",overdue:false};
        const datePart=iso.split("T")[0];
        if(!datePart||!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return{text:"",overdue:false};
        const[year,month,day]=datePart.split("-").map(Number);
        const d=new Date(year,month-1,day);
        if(isNaN(d.getTime())) return{text:"",overdue:false};
        const now=new Date(); now.setHours(0,0,0,0);
        const overdue=d<now;
        let text:string;
        try{ text=d.toLocaleDateString(locale.replace("_","-"),{month:"short",day:"numeric",year:"numeric"}); }
        catch(_){ text=d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
        return{text,overdue};
      }

      function groupName(id:string):string { return groupMap.get(id)||id; }

      // ── Attachments (Staffbase media TUS upload) ──────────────────────
      const MEDIA_MAX = 25 * 1024 * 1024; // 25 MB
      function humanSize(b:number):string{
        if(b<1024) return `${b} B`;
        if(b<1048576) return `${(b/1024).toFixed(0)} KB`;
        return `${(b/1048576).toFixed(1)} MB`;
      }
      function b64utf8(s:string):string{
        let out=""; const bytes=new TextEncoder().encode(s);
        for(const byte of bytes) out+=String.fromCharCode(byte);
        return btoa(out);
      }
      // Upload a File to Staffbase media via the resumable TUS protocol.
      async function uploadMedia(file:File):Promise<{id:string;url:string}>{
        const create=await fetch(`${baseUrl}/media/tus`,{
          method:"POST",credentials:"omit",
          headers:{
            Authorization:`Basic ${apiToken}`,
            "Tus-Resumable":"1.0.0",
            "Upload-Length":String(file.size),
            "Upload-Metadata":`filename ${b64utf8(file.name)},filetype ${b64utf8(file.type||"application/octet-stream")}`,
          },
        });
        if(create.status!==201) throw new Error(`upload init failed (${create.status})`);
        const loc=create.headers.get("Location");
        if(!loc) throw new Error("no upload URL");
        const buf=await file.arrayBuffer();
        const CHUNK=5*1024*1024;
        let offset=0; let media:any=null;
        while(offset<buf.byteLength){
          const end=Math.min(offset+CHUNK,buf.byteLength);
          const res=await fetch(loc,{
            method:"PATCH",credentials:"omit",
            headers:{
              Authorization:`Basic ${apiToken}`,
              "Tus-Resumable":"1.0.0",
              "Upload-Offset":String(offset),
              "Content-Type":"application/offset+octet-stream",
            },
            body:buf.slice(offset,end),
          });
          if(!res.ok) throw new Error(`upload failed (${res.status})`);
          offset=end;
          try{ media=await res.clone().json(); }catch(_){}
        }
        if(!media?.id) throw new Error("no media id returned");
        const url=media.resourceInfo?.url||media.transformations?.t_preview?.resourceInfo?.url||"";
        return {id:media.id,url};
      }
      async function mediaMeta(id:string):Promise<any|null>{
        try{ const r=await fetch(`${baseUrl}/media/medium/${id}/metadata`,apiOpts()); return r.ok?await r.json():null; }
        catch(_){ return null; }
      }
      // Best-effort original-file URL: metadata only exposes a `thumbnail` (t_preview), so we
      // derive the original by dropping the transform segment and restoring the file extension.
      function originalUrl(m:any):string{
        const t=m?.thumbnail?.url||""; if(!t) return "";
        const ext=((String(m?.fileName||"").match(/\.[a-z0-9]+$/i))||[])[0] || (m?.type==="pdf"?".pdf":"");
        let u=t.replace(/\/upload\/[^/]+\//,"/upload/"); // ".../upload/t_preview/<hash>.png" → ".../upload/<hash>.png"
        if(ext) u=u.replace(/\.[a-z0-9]+($|\?)/i, ext+"$1");
        return u;
      }
      function attKind(m:any):string{
        const fn=String(m?.fileName||""); const mime=String(m?.mimeType||m?.contentType||"").toLowerCase();
        if(/^image\//.test(mime)||/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(fn)) return "img";
        if(mime.indexOf("pdf")>=0||m?.type==="pdf"||/\.pdf$/i.test(fn)) return "pdf";
        return "other";
      }
      const iClip=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
      const iFileGeneric=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      const iXsmall=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      const iSend=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

      // ── Comments (user-session auth; NOT the Basic token) ──────────────
      // Comments must be attributed to a person, so the POST uses the logged-in
      // user's session (cookie + CSRF) — see comments.md. We target the real
      // API host (baseUrl), NOT location.origin: on mobile the app runs under a
      // capacitor:// origin, where location.origin/api hits the local app shell
      // and returns index.html instead of reaching Staffbase.
      function readCsrf():string{
        // Confirmed source (web + mobile widget context): window.we.authMgr.csrfToken.
        const w:any=window;
        try{ const t=w.we?.authMgr?.csrfToken; if(t) return String(t); }catch(_){}
        if(w.csrfToken) return String(w.csrfToken);
        const m=document.cookie.match(/(?:^|;\s*)(?:csrf|XSRF-TOKEN|csrftoken)=([^;]+)/i);
        if(m) return decodeURIComponent(m[1]);
        const meta=document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement|null;
        return meta?.content||"";
      }
      function sessionOpts(extra?:RequestInit):RequestInit{
        const csrf=readCsrf();
        return {
          ...extra,
          credentials:"include",
          headers:{ ...(csrf?{"x-csrf-token":csrf}:{}), ...(extra?.headers||{}) },
        };
      }
      const CMT_CREATE_CT="application/vnd.staffbase.tasks.comment-create.v1+json";
      const CMT_HTML_ACCEPT="application/vnd.staffbase.tasks.comment.html-content.v1+json";
      // Photo-proof comments are stamped with this marker; the token is stripped
      // from the visible comment body but the attached image still renders.
      const PROOF_MARK="[proof]";
      const stripProof=(html:string):string=>html.replace(/\[proof\]/gi,"").trim();
      // Build the Designer content document the create endpoint expects.
      function commentDoc(text:string):any{
        const html=`<p>${esc(text)}</p>`;
        // `config` carries the visible text. Exact key is still being
        // confirmed in-app (see comments.md); send the likely variants.
        return { blocks:{ b1:{ type:"text", children:[], config:{ html, text } } }, content:["b1"] };
      }
      // Reading comments works with the Basic token (confirmed). Only the
      // POST needs the user session, so the read uses the token path here.
      async function loadComments(task:Task):Promise<any[]>{
        const url=`${baseUrl}/tasks/${task.installationId}/task/${task.id}/comments${currentUserId?`?viewedBy=${currentUserId}`:""}`;
        dlog("GET comments",url);
        const r=await fetch(url,apiOpts({headers:{Accept:CMT_HTML_ACCEPT}}));
        const raw=await r.text();
        dlog("GET comments ←",r.status,raw.slice(0,400));
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        let d:any; try{ d=JSON.parse(raw); }catch(_){ d=[]; }
        const arr:any[]=Array.isArray(d)?d:(d.data||[]);
        // Hide the widget's own hidden [tasks:edit] audit comments (they only feed
        // the Manager Tasks activity feed).
        return arr.filter(c=>!isEditCommentText(commentText(c).replace(/<[^>]+>/g," ")));
      }
      // User lookup (for avatars + names on comments), cached.
      const userCache=new Map<string,{name:string;avatar:string}>();
      async function fetchUser(id:string):Promise<{name:string;avatar:string}>{
        if(!id) return {name:"User",avatar:""};
        const hit=userCache.get(id); if(hit) return hit;
        let info={name:"User",avatar:""};
        try{
          const r=await fetch(`${baseUrl}/users/${id}`,apiOpts());
          if(r.ok){
            const u=await r.json();
            const name=[u.firstName,u.lastName].filter(Boolean).join(" ")||u.displayName||u.userName||"User";
            const avatar=u.avatar?.icon?.url||u.avatar?.thumb?.url||u.avatar?.original?.url||"";
            info={name,avatar};
          }
        }catch(_){}
        userCache.set(id,info); return info;
      }
      async function fetchUsers():Promise<Array<{id:string;name:string}>>{
        if(usersList) return usersList;
        try{
          const r=await fetch(`${baseUrl}/users?limit=200`,apiOpts());
          if(r.ok){ const d=await r.json(); usersList=(d.data||d||[]).map((u:any)=>({id:u.id,name:[u.firstName,u.lastName].filter(Boolean).join(" ")||u.displayName||u.userName||u.id})); }
          else usersList=[];
        }catch(_){ usersList=[]; }
        return usersList!;
      }
      // Reassign picker (audit mode). Searchable groups + people; PATCHes the task.
      function wireReassign(task:Task){
        const root=detailBody.querySelector(`#${p}-reassign-${instId}`) as HTMLElement|null;
        if(!root) return;
        const btn=root.querySelector(`.${p}-reassign-btn`) as HTMLButtonElement;
        const pop=root.querySelector(`.${p}-reassign-pop`) as HTMLElement;
        const search=root.querySelector(`.${p}-reassign-search`) as HTMLInputElement;
        const results=root.querySelector(`.${p}-reassign-results`) as HTMLElement;
        const selLbl=root.querySelector(`.${p}-reassign-sel`) as HTMLElement;
        const saveBtn=root.querySelector(`.${p}-reassign-save`) as HTMLButtonElement;
        const clearBtn=root.querySelector(`.${p}-reassign-clear`) as HTMLButtonElement;
        const gIco=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
        const uIco=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const ckIco=`<svg class="${p}-ck" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        // Multi-select: seed from the task's current assignment, toggle on click,
        // PATCH both arrays together on Save (the API accepts multiples).
        const selUsers=new Set<string>(task.assigneeIds);
        const selGroups=new Set<string>(task.groupIds);
        const groupsArr=()=>{const o:Array<{id:string;name:string}>=[];groupMap.forEach((name,id)=>o.push({id,name}));return o.sort((a,b)=>a.name.localeCompare(b.name));};
        const updateFoot=()=>{ const n=selUsers.size+selGroups.size; selLbl.textContent=n?tr("nSelected").replace("{n}",String(n)):tr("noneSelected"); };
        const renderResults=(q:string)=>{
          const ql=q.trim().toLowerCase();
          const groups=groupsArr().filter(g=>!ql||g.name.toLowerCase().includes(ql)).slice(0,30);
          const users=(usersList||[]).filter(u=>!ql||u.name.toLowerCase().includes(ql)).slice(0,30);
          let html="";
          if(groups.length){ html+=`<div class="${p}-reassign-h">${tr("groups")}</div>`+groups.map(g=>`<div class="${p}-reassign-opt${selGroups.has(g.id)?" sel":""}" data-type="group" data-id="${esc(g.id)}">${gIco}<span>${esc(g.name)}</span>${ckIco}</div>`).join(""); }
          html+=`<div class="${p}-reassign-h">${tr("people")}</div>`+(users.length?users.map(u=>`<div class="${p}-reassign-opt${selUsers.has(u.id)?" sel":""}" data-type="user" data-id="${esc(u.id)}">${uIco}<span>${esc(u.name)}</span>${ckIco}</div>`).join(""):`<div class="${p}-reassign-empty">${usersList?tr("noMatches"):tr("loading")}</div>`);
          results.innerHTML=html;
          results.querySelectorAll(`.${p}-reassign-opt`).forEach(o=>o.addEventListener("click",()=>{
            const el=o as HTMLElement; const type=el.dataset.type!; const id=el.dataset.id!;
            const set=type==="group"?selGroups:selUsers;
            if(set.has(id)) set.delete(id); else set.add(id);
            el.classList.toggle("sel"); updateFoot();
          }));
        };
        const apply=async()=>{
          const prevUsers=new Set(task.assigneeIds), prevGroups=new Set(task.groupIds);
          const body={assigneeIds:[...selUsers],groupIds:[...selGroups]};
          saveBtn.disabled=true;
          try{
            const r=await fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify(body)});
            if(!r.ok) throw new Error(`HTTP ${r.status}`);
            task.groupIds=body.groupIds; task.assigneeIds=body.assigneeIds;
            // Hidden audit comment (→ Manager activity feed) + notify the newly assigned.
            const nm=(id:string)=>(usersList||[]).find(u=>u.id===id)?.name||groupMap.get(id)||id;
            const allNames=[...body.assigneeIds,...body.groupIds].map(nm);
            if(detailedLogging) postEditComment(task, `reassigned “${task.title}” to ${allNames.length?allNames.join(", "):"no one"}`);
            const newUsers=body.assigneeIds.filter(id=>!prevUsers.has(id));
            const newGroups=body.groupIds.filter(id=>!prevGroups.has(id)).map(id=>({id,name:groupMap.get(id)||id}));
            notifyAssigned(newUsers, newGroups, task.title);
            pop.style.display="none"; hideBanner(); renderDetailContent(task); load();
          }catch(e:any){ showBanner("error",`Couldn't reassign: ${e.message}`); saveBtn.disabled=false; }
        };
        btn.addEventListener("click",async()=>{
          if(pop.style.display!=="none"){ pop.style.display="none"; return; }
          pop.style.display="block"; renderResults(""); search.value=""; updateFoot(); search.focus();
          if(!usersList){ await fetchUsers(); if(detailTask===task) renderResults(search.value); }
        });
        search.addEventListener("input",()=>renderResults(search.value));
        saveBtn.addEventListener("click",apply);
        clearBtn.addEventListener("click",()=>{ selUsers.clear(); selGroups.clear(); renderResults(search.value); updateFoot(); });
      }
      function initials(name:string):string{
        const parts=name.trim().split(/\s+/);
        return ((parts[0]?.[0]||"")+(parts[1]?.[0]||"")).toUpperCase()||"?";
      }
      function avatarHtml(info:{name:string;avatar:string}):string{
        if(info.avatar) return `<img class="${p}-cmt-av" src="${esc(info.avatar)}" alt="${esc(info.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="${p}-cmt-av ${p}-cmt-av-fb" style="display:none">${esc(initials(info.name))}</span>`;
        return `<span class="${p}-cmt-av ${p}-cmt-av-fb">${esc(initials(info.name))}</span>`;
      }
      async function postComment(task:Task,text:string):Promise<any>{
        const url=`${baseUrl}/tasks/${task.installationId}/task/${task.id}/comments`;
        const body=JSON.stringify({ content: commentDoc(text) });
        dlog("POST comment",url,"csrf?",readCsrf()?"yes":"no","body",body);
        const r=await fetch(url,sessionOpts({
          method:"POST",
          headers:{ "Content-Type":CMT_CREATE_CT, Accept:CMT_HTML_ACCEPT },
          body,
        }));
        const raw=await r.text();
        // Capture the real shape of the first successful create for tuning.
        dlog("POST comment ←",r.status,raw.slice(0,600));
        if(!r.ok) throw new Error(`HTTP ${r.status}`);
        try{ return JSON.parse(raw); }catch(_){ return null; }
      }
      // "Chriscelle" / "Chriscelle and Andrea" / "Chriscelle and Andrea, +1 more"
      function ownerLabel(task:Task):string{
        const names=task.assigneeIds.map(id=>(usersList||[]).find(u=>u.id===id)?.name||id).filter(Boolean);
        if(names.length===0) return "";
        if(names.length===1) return names[0];
        if(names.length===2) return `${names[0]} and ${names[1]}`;
        return `${names[0]} and ${names[1]}, +${names.length-2} more`;
      }
      // Status-change action text → activity feed. Credits the actor with completing
      // someone else's task when they aren't an assignee, e.g. "completed Chriscelle's task".
      function statusAction(task:Task, newStatus:string, withProof:boolean=false):string{
        const verb=newStatus==="CLOSED"?"completed":"reopened";
        const mine=!!currentUserId && task.assigneeIds.indexOf(currentUserId)!==-1;
        const owner=ownerLabel(task);
        const suffix=(withProof && newStatus==="CLOSED")?" with proof":"";
        return ((!mine&&owner)?`${verb} ${owner}'s task “${task.title}”`:`${verb} “${task.title}”`)+suffix;
      }
      // Hidden audit comment → feeds the Manager Tasks activity feed; suppressed
      // from the visible comment list here. Best-effort (needs the user session).
      async function postEditComment(task:Task, action:string){
        try{ await postComment(task, `${EDIT_MARK} ${action}`); }catch(_){}
      }
      // Notifications to newly-assigned people/groups (Basic token). Users get
      // "You were assigned…"; each group gets a named "Your group X was assigned…".
      async function notifyAssigned(userIds:string[], groups:Array<{id:string;name:string}>, title:string){
        if(!notifyOnAssign) return;
        const send=async(ids:string[], text:string)=>{
          if(!ids.length) return;
          const content:any={ en_US:{ text } };
          if(locale && locale!=="en_US") content[locale]={ text };
          try{
            await fetch(`${baseUrl}/branch/notifications`,apiOpts({
              method:"POST",
              body:JSON.stringify({ accessorIds:ids, channels:["notificationCenter","push"], content, icon:{ en_US:{ type:"font", char:"n" } } }),
            }));
          }catch(_){}
        };
        if(userIds.length) await send(userIds, tr("notifyAssignedText").replace("{title}",title));
        for(const g of groups) await send([g.id], tr("notifyGroupAssignedText").replace("{group}",g.name).replace("{title}",title));
      }
      function commentText(c:any):string{
        const ct=c.content;
        if(typeof ct==="string") return ct;                        // rendered HTML
        if(ct?.html) return ct.html;
        // Structured Designer document: pull html/text from its blocks in order.
        if(ct?.blocks){
          const order:string[]=Array.isArray(ct.content)?ct.content:Object.keys(ct.blocks);
          const parts=order.map((id:string)=>{
            const b=ct.blocks[id]; const cfg=b&&b.config||{};
            return cfg.html||(cfg.text?`<p>${esc(cfg.text)}</p>`:"");
          }).filter(Boolean);
          if(parts.length) return parts.join("");
        }
        if(c.text) return c.text;
        return "";
      }
      function commentTime(iso:string):string{
        const t=Date.parse(iso); if(isNaN(t)) return "";
        const s=Math.floor((Date.now()-t)/1000);
        if(s<60) return "just now";
        if(s<3600) return `${Math.floor(s/60)}m ago`;
        if(s<86400) return `${Math.floor(s/3600)}h ago`;
        if(s<604800) return `${Math.floor(s/86400)}d ago`;
        return new Date(t).toLocaleDateString();
      }
      function commentAuthorId(c:any):string{
        return c.authorId||c.authorID||c.author?.id||"";
      }
      // Inline comment attachments: comment text carries [attachment:<id>] tokens.
      const mediaCache=new Map<string,any>();
      async function metaCached(id:string){ if(mediaCache.has(id)) return mediaCache.get(id); const m=await mediaMeta(id); mediaCache.set(id,m); return m; }
      const ATT_TOKEN=/\[attachment:([A-Za-z0-9]+)\]/g;
      function resolveAttachments(html:string):string{
        return html.replace(ATT_TOKEN,(_m,id)=>{
          const meta=mediaCache.get(id);
          const name=esc(meta?.fileName||"attachment");
          const fn=meta?.fileName||"attachment";
          const turl=meta?.thumbnail?.url||"";
          const full=originalUrl(meta)||turl;
          const kind=attKind(meta);
          const data=`data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}"`;
          if(kind==="img"&&turl){
            return `<a href="${esc(full)}" target="_blank" rel="noopener" ${data}><img class="${p}-cmt-att-img" src="${esc(turl)}" alt="${name}"></a>`;
          }
          return `<a class="${p}-cmt-att" href="${esc(full)||"#"}" target="_blank" rel="noopener" ${data}>${iClip}<span>${name}</span></a>`;
        });
      }
      // Render the comments list inside the open detail panel.
      async function renderComments(task:Task){
        const list=detailBody.querySelector(`#${p}-cmt-list-${instId}`) as HTMLElement|null;
        if(!list) return;
        list.innerHTML=`<div class="${p}-cmt-empty">${tr("loading")}</div>`;
        let comments:any[]=[];
        try{ comments=await loadComments(task); }
        catch(e:any){
          if(detailTask!==task) return;
          list.innerHTML=`<div class="${p}-cmt-empty">Couldn't load comments (${esc(e.message)}).</div>`;
          return;
        }
        if(detailTask!==task) return; // panel changed while loading
        if(!comments.length){ list.innerHTML=`<div class="${p}-cmt-empty">${tr("noCommentsYet")}</div>`; return; }
        // Resolve author profiles (avatars + names) in parallel.
        const authors=await Promise.all(comments.map(c=>fetchUser(commentAuthorId(c))));
        // Prefetch metadata for any inline [attachment:id] tokens.
        const bodies=comments.map(c=>commentText(c));
        const attIds=new Set<string>();
        bodies.forEach(b=>{ let m; ATT_TOKEN.lastIndex=0; while((m=ATT_TOKEN.exec(b))) attIds.add(m[1]); });
        if(attIds.size) await Promise.all([...attIds].map(metaCached));
        if(detailTask!==task) return;
        // Fresh load → reset translate state, cache data, paint.
        cmtTranslated=false; cmtTrBusy=false;
        lastCmt={comments,authors,bodies,task};
        paintComments();
      }

      // Translate icon (shared by header button + per-comment button).
      const iGlobe=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>`;
      // Paint the cached comments (no re-fetch). Used on first render and on
      // translate toggle. Each comment carries a translate affordance: hover
      // (desktop) or tap (mobile) reveals it; clicking translates all comments.
      function paintComments(){
        if(!lastCmt) return;
        const list=detailBody.querySelector(`#${p}-cmt-list-${instId}`) as HTMLElement|null;
        if(!list||detailTask!==lastCmt.task) return;
        const {comments,authors,bodies}=lastCmt;
        const showBtn=locale!==DEFAULT_LOCALE;
        const btnLbl=cmtTrBusy?tr("translating"):cmtTranslated?tr("showOriginal"):tr("translateBtn");
        list.innerHTML=comments.map((c:any,i:number)=>{
          const a=authors[i];
          const body=cmtTranslated?(cmtCache[bodies[i].trim()]||bodies[i]):bodies[i];
          return `
          <div class="${p}-cmt-item">
            ${showBtn?`<button type="button" class="${p}-cmt-tr" title="${btnLbl}">${iGlobe}<span>${btnLbl}</span></button>`:""}
            ${avatarHtml(a)}
            <div class="${p}-cmt-main">
              <div class="${p}-cmt-head"><span class="${p}-cmt-author">${esc(a.name)}</span><span class="${p}-cmt-time">${esc(commentTime(c.createdAt||c.created||""))}</span></div>
              <div class="${p}-cmt-body" dir="auto">${resolveAttachments(stripProof(body))||"<em>(empty)</em>"}</div>
            </div>
          </div>`;
        }).join("");
        // Tap a comment (mobile) → reveal its button; hover handles desktop via CSS.
        list.querySelectorAll(`.${p}-cmt-item`).forEach(it=>it.addEventListener("click",()=>it.classList.toggle("show-tr")));
        list.querySelectorAll(`.${p}-cmt-tr`).forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();toggleComments();}));
      }
      async function toggleComments(){
        if(cmtTrBusy||!lastCmt) return;
        if(!cmtTranslated){
          cmtTrBusy=true; paintComments();
          const map=await translateMap(lastCmt.bodies, translateSend);
          Object.assign(cmtCache,map); cmtTrBusy=false; cmtTranslated=true;
        } else { cmtTranslated=false; }
        paintComments();
      }

      // Render the attachment tiles inside the open detail panel for a task.
      async function renderAttachments(task:Task){
        const grid=detailBody.querySelector(`#${p}-att-grid-${instId}`) as HTMLElement|null;
        if(!grid) return;
        const ids=task.attachmentIds||[];
        if(!ids.length){ grid.innerHTML=`<span class="${p}-att-empty">${tr("noAttachments")}</span>`; return; }
        grid.innerHTML=`<span class="${p}-att-empty">${tr("loading")}</span>`;
        const metas=await Promise.all(ids.map(mediaMeta));
        if(detailTask!==task) return; // panel changed while loading
        grid.innerHTML=ids.map((id,i)=>{
          const m=metas[i];
          const name=esc(m?.fileName||"file");
          const size=m?.size?`<span class="${p}-att-size">${humanSize(m.size)}</span>`:"";
          const thumb=m?.thumbnail?.url
            ?`<img class="${p}-att-thumb" src="${esc(m.thumbnail.url)}" alt="">`
            :`<span class="${p}-att-ico">${iFileGeneric}</span>`;
          const fn=m?.fileName||"file";
          const turl=m?.thumbnail?.url||"";
          const full=originalUrl(m)||turl;
          const kind=attKind(m);
          return `<div class="${p}-att-tile">
            <a class="${p}-att-link" href="${esc(full)}" target="_blank" rel="noopener" data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}">
              ${thumb}<span class="${p}-att-meta"><span class="${p}-att-name">${name}</span>${size}</span>
            </a>
            <button type="button" class="${p}-att-x" data-id="${esc(id)}" title="Remove">${iXsmall}</button>
          </div>`;
        }).join("");
        grid.querySelectorAll(`.${p}-att-x`).forEach(btn=>{
          btn.addEventListener("click",async()=>{
            const rid=(btn as HTMLElement).dataset.id||"";
            const next=(task.attachmentIds||[]).filter(x=>x!==rid);
            (btn as HTMLButtonElement).disabled=true;
            try{
              const res=await fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({attachmentIds:next})});
              if(!res.ok) throw new Error(`HTTP ${res.status}`);
              task.attachmentIds=next; renderAttachments(task);
            }catch(e:any){ showBanner("error",`Could not remove: ${e.message}`); (btn as HTMLButtonElement).disabled=false; }
          });
        });
      }

      // ── Distinct types for visible install ────────────────────────────
      function getTypes():{key:string;label:string}[]{
        const types=new Set<string>();
        for(const t of allTasks){
          if(t.taskType==="audit-result") continue;
          if(activeInstallFilter!=="all"&&t.installationId!==activeInstallFilter) continue;
          if(t.taskType) types.add(t.taskType);
        }
        return [...types].sort().map(k=>({key:k,label:k}));
      }

      // ── Filtered tasks (normal mode) ──────────────────────────────────
      function filteredTasks():Task[]{
        return allTasks.filter(t=>{
          if(t.taskType==="audit-result") return false; // always hide system tasks
          if(activeInstallFilter!=="all"&&t.installationId!==activeInstallFilter) return false;
          if(activeTypeFilters.size>0){const key=t.taskType||"__none__";if(!activeTypeFilters.has(key)) return false;}
          const isDone=t.status==="DONE"||t.status==="done"||t.status==="CLOSED";
          if(activeStatusFilter==="open"&&isDone) return false;
          if(activeStatusFilter==="done"&&!isDone) return false;
          return true;
        });
      }

      // ── Store tabs ────────────────────────────────────────────────────
      function renderStoreTabs(){
        if(auditMode){
          // In audit mode: pills built from auditLists unique installs
          const instMap=new Map<string,{title:string;count:number}>();
          for(const al of auditLists){
            if(!instMap.has(al.installId)) instMap.set(al.installId,{title:al.instTitle||al.installId,count:0});
            instMap.get(al.installId)!.count++;
          }
          if(instMap.size<=1){storeTabs.style.display="none";return;}
          storeTabs.style.display="flex";
          storeTabs.innerHTML=`
            <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter==="all"?"active":""}" data-inst="all">
              All <span style="opacity:.6;font-weight:400">(${auditLists.length})</span>
            </div>
            ${[...instMap.entries()].map(([id,info])=>`
              <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter===id?"active":""}" data-inst="${esc(id)}">
                ${esc(info.title||id)} <span style="opacity:.6;font-weight:400">(${info.count})</span>
              </div>`).join("")}`;
          storeTabs.querySelectorAll(`.${p}-store-tab`).forEach(btn=>{
            btn.addEventListener("click",()=>{
              activeInstallFilter=(btn as HTMLElement).dataset.inst||"all";
              // If current audit belongs to a different store, reset to first match
              const filtered=activeInstallFilter==="all"?auditLists:auditLists.filter(al=>al.installId===activeInstallFilter);
              if(!filtered.find(al=>al.listId===activeAuditListId)) activeAuditListId=filtered[0]?.listId||"";
              renderStoreTabs(); renderAuditTabs(); renderList();
            });
          });
          return;
        }
        // Normal mode
        const instMap=new Map<string,{title:string;count:number}>();
        for(const t of allTasks){
          if(t.taskType==="audit-result") continue;
          if(!instMap.has(t.installationId)) instMap.set(t.installationId,{title:t.installationTitle,count:0});
          instMap.get(t.installationId)!.count++;
        }
        if(instMap.size<=1){storeTabs.style.display="none";return;}
        storeTabs.style.display="flex";
        const total=allTasks.filter(t=>t.taskType!=="audit-result").length;
        storeTabs.innerHTML=`
          <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter==="all"?"active":""}" data-inst="all">
            All <span style="opacity:.6;font-weight:400">(${total})</span>
          </div>
          ${[...instMap.entries()].map(([id,info])=>`
            <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter===id?"active":""}" data-inst="${esc(id)}">
              ${esc(info.title||id)} <span style="opacity:.6;font-weight:400">(${info.count})</span>
            </div>`).join("")}`;
        storeTabs.querySelectorAll(`.${p}-store-tab`).forEach(btn=>{
          btn.addEventListener("click",()=>{
            activeInstallFilter=(btn as HTMLElement).dataset.inst||"all";
            activeTypeFilters.clear(); dropdownOpen=false;
            renderStoreTabs(); renderTypeFilters(); renderList();
          });
        });
      }

      // ── Audit tabs ────────────────────────────────────────────────────
      function renderAuditTabs(){
        if(!auditMode||!auditTabWrap||!auditTabsEl) return;
        if(auditLists.length===0){auditTabWrap.style.display="none";return;}
        // Filter by active store pill
        const visible=activeInstallFilter==="all"?auditLists:auditLists.filter(al=>al.installId===activeInstallFilter);
        if(visible.length===0){auditTabWrap.style.display="none";return;}
        auditTabWrap.style.display="";
        auditTabsEl.innerHTML=visible.map(al=>{
          const pa=al.parsedAudit;
          const passing=pa?.passing??null;
          const pct=pa?.score!=null?pa.score+"%":"—";
          const dotColor=passing===true?"var(--success)":passing===false?"var(--error)":"var(--gray-lt)";
          const label=al.listName.replace(/^Audit\s*—\s*/i,"").trim()||al.listName;
          return `<div role="button" tabindex="0" class="${p}-audit-tab${al.listId===activeAuditListId?" active":""}" data-list-id="${esc(al.listId)}" data-inst-id="${esc(al.installId)}">
            <span class="${p}-audit-dot" style="background:${dotColor}"></span>
            ${esc(label)} <span style="opacity:.55;font-size:10px">${pct}</span>
          </div>`;
        }).join("");
        auditTabsEl.querySelectorAll(`.${p}-audit-tab`).forEach(btn=>{
          btn.addEventListener("click",()=>{
            activeAuditListId=(btn as HTMLElement).dataset.listId||"";
            showOtherAuditTasks=false;
            renderAuditTabs(); renderList();
          });
        });
        // Keep the active tab in view + refresh scroll arrows.
        const active=auditTabsEl.querySelector(`.${p}-audit-tab.active`) as HTMLElement|null;
        if(active) active.scrollIntoView({inline:"center",block:"nearest"});
        requestAnimationFrame(updateAuditArrows);
      }

      // ── Type dropdown ─────────────────────────────────────────────────
      let dropdownOpen=false;

      function typeDropdownLabel():string{
        if(activeTypeFilters.size===0) return tr("allTypes");
        const types=getTypes();
        const sel=types.filter(t=>activeTypeFilters.has(t.key));
        if(sel.length===1) return ct(sel[0].label);
        return tr("nTypes").replace("{n}",String(sel.length));
      }

      function renderTypeFilters(){
        if(!typeBtn||!typeLabelEl||!typeMenu) return;
        const types=getTypes();
        // No tasks carry a [type:] tag → hide the whole type filter.
        const typeWrap=container.querySelector(`#${p}-type-wrap`) as HTMLElement|null;
        if(typeWrap) typeWrap.style.display=types.length?"":"none";
        typeLabelEl.textContent=typeDropdownLabel();
        typeBtn.classList.toggle("open",dropdownOpen);
        typeMenu.classList.toggle("open",dropdownOpen);
        const iconCheck=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        const allActive=activeTypeFilters.size===0;
        typeMenu.innerHTML=`
          <button type="button" class="${p}-type-opt ${allActive?"active":""}" data-key="__all__">
            <span style="width:12px;display:flex;align-items:center;justify-content:center">${allActive?iconCheck:""}</span>${tr("allTypes")}
          </button>
          <div style="height:1px;background:var(--border);margin:2px 0"></div>
          ${types.map(({key,label})=>{
            const checked=activeTypeFilters.has(key);
            const dot=key!=="__none__"
              ?`<span class="${p}-type-dot" style="background:${typeColor(key)}"></span>`
              :`<span class="${p}-type-dot" style="background:var(--border)"></span>`;
            return `<button type="button" class="${p}-type-opt ${checked?"active":""}" data-key="${esc(key)}">
              <span style="width:12px;display:flex;align-items:center;justify-content:center">${checked?iconCheck:""}</span>
              ${dot}${esc(ct(label))}</button>`;
          }).join("")}`;
        typeMenu.querySelectorAll(`.${p}-type-opt`).forEach(btn=>{
          btn.addEventListener("click",e=>{
            e.stopPropagation();
            const key=(btn as HTMLElement).dataset.key!;
            if(key==="__all__") activeTypeFilters.clear();
            else if(activeTypeFilters.has(key)) activeTypeFilters.delete(key);
            else activeTypeFilters.add(key);
            renderTypeFilters(); renderList();
          });
        });
      }

      if(typeBtn) typeBtn.addEventListener("click",e=>{e.stopPropagation();dropdownOpen=!dropdownOpen;renderTypeFilters();});
      const onDocClick = () => { if (dropdownOpen) { dropdownOpen = false; renderTypeFilters(); } };
      document.addEventListener("click", onDocClick);
      self._mtwDocClick = onDocClick;

      // ── Render task list ──────────────────────────────────────────────
      function renderList(){
        if(auditMode){
          renderAuditContent();
          return;
        }
        if(showCalendar && view==="calendar"){
          renderCalendar();
          return;
        }
        const tasks=filteredTasks();
        countEl.textContent=String(tasks.length);
        if(!tasks.length){
          const emptyMsg=allTasks.filter(t=>t.taskType!=="audit-result").length===0
            ?tr("noTasksFound")
            :activeStatusFilter==="open"?tr("allCaughtUpPersonal"):tr("noCompletedTasks");
          listWrap.innerHTML=`<div class="${p}-state">
            <span class="${p}-state-icon">${activeStatusFilter==="open"&&allTasks.length>0?"✓":"📋"}</span>
            <strong>${emptyMsg}</strong>
          </div>`;
          return;
        }
        const grouped=new Map<string,Task[]>();
        for(const t of tasks){const key=t.taskType||"__none__";if(!grouped.has(key))grouped.set(key,[]);grouped.get(key)!.push(t);}
        const orderedKeys=[...grouped.keys()].sort((a,b)=>{if(a==="__none__")return -1;if(b==="__none__")return 1;return a.localeCompare(b);});
        let html=`<div class="${p}-list${introUsed?"":" intro"}">`;
        introUsed=true;
        for(const key of orderedKeys){
          const group=grouped.get(key)!;
          // Untyped tasks just appear in the list — no "No Type" section header.
          if(key!=="__none__")
            html+=`<div class="${p}-section-label">${esc(ct(key))} <span style="font-weight:400">(${group.length})</span></div>`;
          for(const task of group) html+=renderTaskCard(task);
        }
        html+=`</div>`;
        listWrap.innerHTML=html;
        bindListEvents();
      }

      // ── Audit mode content ────────────────────────────────────────────
      function renderAuditContent(){
        if(auditLists.length===0){
          countEl.textContent="0";
          listWrap.innerHTML=`<div class="${p}-state"><strong>${tr("noAuditsFound")}</strong>${tr("auditEmptyHint")}</div>`;
          return;
        }
        const al=auditLists.find(a=>a.listId===activeAuditListId)||auditLists[0];
        if(!al){listWrap.innerHTML=`<div class="${p}-state">${tr("selectAudit")}</div>`;return;}
        // Ensure active is set
        if(!activeAuditListId) activeAuditListId=al.listId;

        const pa=al.parsedAudit;
        const passing=pa?.passing??null;
        const pct=pa?.score??null;
        const passClass=passing===true?"pass":passing===false?"fail":"";

        // Audit summary card
        const iconStore_=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
        const iconUser_=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const iconCal_=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
        const iconNote_=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

        const scoreColor=passing===true?"var(--success)":passing===false?"var(--error)":"var(--gray)";
        const summaryHtml=pa?`
          <div class="${p}-audit-card ${passClass}" id="${p}-audit-card" role="button" tabindex="0">
            <div style="display:flex;align-items:flex-start;justify-content:space-between">
              <div>
                <div class="${p}-audit-card-score" style="color:${scoreColor}">${pct!=null?pct+"%":"—"}</div>
                <div style="font-size:13px;font-weight:700;color:${scoreColor};margin-top:3px">${passing===true?tr("passing"):passing===false?tr("failing"):"—"}</div>
              </div>
              <div style="font-size:11px;color:var(--gray-lt);text-align:end;line-height:1.6">
                ${pa.taskCount!=null?`<div style="font-weight:600;color:${scoreColor}">${tr("nTasksFlagged").replace("{n}",String(pa.taskCount))}</div>`:""}
              </div>
            </div>
            <div class="${p}-audit-card-meta">
              ${pa.store?`<span>${iconStore_} ${esc(pa.store)}</span>`:""}
              ${pa.auditor?`<span>${iconUser_} ${esc(pa.auditor)}</span>`:""}
              ${pa.date?`<span>${iconCal_} ${esc(pa.date)}</span>`:""}
              ${pa.notes?`<span style="align-items:flex-start">${iconNote_} <span style="line-height:1.5;font-style:italic">${esc(pa.notes)}</span></span>`:""}
            </div>
          </div>`:"";

        // All failure tasks in this audit (excluding system task)
        const allAuditTasks=allTasks.filter(t=>t.listId===al.listId&&t.installationId===al.installId&&t.taskType!=="audit-result");
        const isDoneTask=(t:Task)=>t.status==="DONE"||t.status==="done"||t.status==="CLOSED";

        // Split into "mine" vs "other" — uses widget-level currentUserId + userGroupIds
        const isMyTask=(t:Task)=>{
          if(!currentUserId) return true; // if we have no user info, treat everything as mine
          const direct=t.assigneeIds.indexOf(currentUserId)!==-1;
          const grp=t.groupIds.some(gid=>userGroupIds.indexOf(gid)!==-1);
          return direct||grp;
        };
        const myTasks    = allAuditTasks.filter(t=>isMyTask(t));
        // Other people's tasks are only available when "Show All Tasks" is on.
        const otherTasks = showAll ? allAuditTasks.filter(t=>!isMyTask(t)) : [];

        const doneMine=myTasks.filter(isDoneTask);
        const visibleMine=showCompletedAudit?myTasks:myTasks.filter(t=>!isDoneTask(t));
        const allMyDone=myTasks.length>0&&doneMine.length===myTasks.length;

        countEl.textContent=String(visibleMine.length);

        // "Show completed" toggle header
        const completedToggleHtml=doneMine.length>0?`
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--gray-lt)">
              ${tr("myTasksN").replace("{n}",String(myTasks.length))}
            </span>
            <button id="${p}-audit-toggle" type="button" style="font-size:11px;font-weight:600;color:var(--primary);background:none;border:none;cursor:pointer;padding:3px 7px;border-radius:4px;font-family:inherit;touch-action:manipulation">
              ${showCompletedAudit?tr("hideCompleted"):tr("showCompletedN").replace("{n}",String(doneMine.length))}
            </button>
          </div>`:
          myTasks.length>0?`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--gray-lt);margin-bottom:10px">${tr("myTasksN").replace("{n}",String(myTasks.length))}</div>`:"";

        // Main task list HTML
        let taskHtml:string;
        if(allAuditTasks.length===0){
          taskHtml=`<div style="text-align:center;padding:20px;color:var(--gray-lt);font-size:13px">${tr("noFailureTasks")}</div>`;
        } else if(myTasks.length===0){
          taskHtml=`<div style="text-align:center;padding:20px;color:var(--gray-lt);font-size:13px">${tr("noTasksAssigned")}</div>`;
        } else if(allMyDone&&!showCompletedAudit){
          taskHtml=`<div style="text-align:center;padding:20px 16px;background:rgba(46,125,74,.06);border:1px solid rgba(46,125,74,.2);border-radius:10px">
            <div style="font-size:22px;margin-bottom:6px">✓</div>
            <div style="font-size:14px;font-weight:700;color:var(--success)">${tr("allTasksComplete")}</div>
            <div style="font-size:12px;color:var(--gray-lt);margin-top:4px">${tr("nTasksMarkedDone").replace("{n}",String(doneMine.length))}</div>
          </div>`;
        } else if(visibleMine.length===0){
          taskHtml=`<div style="text-align:center;padding:20px;color:var(--gray-lt);font-size:13px">${tr("allCaughtUp")}</div>`;
        } else {
          taskHtml=`<div class="${p}-list${introUsed?"":" intro"}">${visibleMine.map(t=>renderTaskCard(t)).join("")}</div>`;
          introUsed=true;
        }

        // "Other tasks" section (greyed but clickable) — only when Show All is on
        let otherHtml="";
        if(showAll&&otherTasks.length>0){
          const iChev=showOtherAuditTasks
            ?`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
            :`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
          const ghostCards=otherTasks.map(t=>{
            const card=renderTaskCard(t);
            // inject ghost class and remove checkbox
            return card.replace(`class="${p}-card `,`class="${p}-card ghost `).replace(`class="${p}-card"`,`class="${p}-card ghost"`);
          }).join("");
          otherHtml=`
            <button id="${p}-other-toggle" type="button" class="${p}-other-toggle">
              ${iChev} ${(showOtherAuditTasks?tr("hideOtherTasks"):tr("showOtherTasks")).replace("{n}",String(otherTasks.length))}
            </button>
            ${showOtherAuditTasks?`<div class="${p}-list" style="margin-top:8px">${ghostCards}</div>`:""}`;
        }

        listWrap.innerHTML=summaryHtml+completedToggleHtml+taskHtml+otherHtml;

        // Wire "show completed" toggle
        const toggleBtn=listWrap.querySelector(`#${p}-audit-toggle`) as HTMLButtonElement|null;
        if(toggleBtn) toggleBtn.addEventListener("click",()=>{ showCompletedAudit=!showCompletedAudit; renderAuditContent(); });

        // Wire "other tasks" toggle
        const otherBtn=listWrap.querySelector(`#${p}-other-toggle`) as HTMLButtonElement|null;
        if(otherBtn) otherBtn.addEventListener("click",()=>{ showOtherAuditTasks=!showOtherAuditTasks; renderAuditContent(); });

        // Click the audit summary card → open it in the sidebar with the chart
        const auditCard=listWrap.querySelector(`#${p}-audit-card`) as HTMLElement|null;
        if(auditCard&&pa) auditCard.addEventListener("click",()=>openAuditSummary(pa, al.listName||"Audit", al.systemTask));

        bindListEvents();
      }

      function bindListEvents(){
        listWrap.querySelectorAll(`.${p}-check`).forEach((btn: Element)=>{
          btn.addEventListener("click",()=>toggleTask(btn as HTMLElement));
        });
        listWrap.querySelectorAll(`.${p}-card`).forEach((card: Element)=>{
          card.addEventListener("click",(e: Event)=>{
            if((e.target as Element).closest(`.${p}-check-wrap`)) return;
            const taskId=(card as HTMLElement).dataset.taskId;
            const task=allTasks.find(t=>t.id===taskId);
            if(task) openDetail(task);
          });
        });
      }

      // ── Calendar view ──────────────────────────────────────────────────
      const isDoneStatus=(s:string)=>s==="DONE"||s==="done"||s==="CLOSED";
      const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      // Parse a task date string to a local Date. Date-only / date-part values are
      // treated as calendar dates (no TZ shift, like formatDate); full timestamps
      // (createDate/updateDate, with a time + Z) are converted to local time.
      function calDate(iso?:string|null):Date|null{
        if(!iso) return null;
        const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
        if(!m){ const d=new Date(iso); return isNaN(d.getTime())?null:d; }
        if(/T\d/.test(iso)){ const d=new Date(iso); return isNaN(d.getTime())?null:d; }
        return new Date(+m[1],+m[2]-1,+m[3]);
      }
      // Due dates are calendar dates (often stored as T00:00:00Z). Bucket them by the
      // date-part only — never the timezone-shifted instant — same as formatDate().
      function calDateOnly(iso?:string|null):Date|null{
        if(!iso) return null;
        const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
        if(!m){ const d=new Date(iso); return isNaN(d.getTime())?null:d; }
        return new Date(+m[1],+m[2]-1,+m[3]);
      }
      const dayKey=(d:Date)=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const fmtHour=(t:string)=>{ const[h,mm]=t.split(":").map(Number); const ap=h<12?"a":"p"; const h12=h%12||12; return mm?`${h12}:${String(mm).padStart(2,"0")}${ap}`:`${h12}${ap}`; };

      type CalMarker={kind:"assigned"|"due"|"overdue"|"completed"|"upcoming";title:string;time?:string;taskId?:string};
      const MARKER_ORDER:Record<string,number>={overdue:0,due:1,upcoming:2,assigned:3,completed:4};

      // Recur-templates whose upcoming occurrences belong to this viewer.
      function myRecurTemplates():Task[]{
        return recurTemplates.filter(t=>{
          const direct=!!currentUserId && t.assigneeIds.indexOf(currentUserId)!==-1;
          const grp=t.groupIds.some(gid=>userGroupIds.indexOf(gid)!==-1);
          return direct||grp;
        });
      }

      // Build dayKey → markers for everything the calendar can plot.
      function buildMarkers():Map<string,CalMarker[]>{
        const map=new Map<string,CalMarker[]>();
        const today=new Date(); today.setHours(0,0,0,0);
        const add=(d:Date|null,mk:CalMarker)=>{ if(!d||isNaN(d.getTime())) return; const k=dayKey(d); const a=map.get(k); if(a)a.push(mk); else map.set(k,[mk]); };
        for(const t of allTasks){
          if(t.taskType==="audit-result") continue;
          const done=isDoneStatus(t.status);
          add(calDate(t.createDate),{kind:"assigned",title:t.title,taskId:t.id});
          if(done){
            add(calDate(completionDates.get(t.id)||t.updateDate),{kind:"completed",title:t.title,taskId:t.id});
          } else if(t.dueDate){
            const dd=calDateOnly(t.dueDate);
            if(dd) add(dd,{kind:dd<today?"overdue":"due",title:t.title,taskId:t.id});
          }
        }
        if(showUpcomingRecurring){
          const tmpls=myRecurTemplates().map(t=>({t,rule:parseCalRule(t.description||"")})).filter(x=>!!x.rule) as Array<{t:Task;rule:CalRule}>;
          if(tmpls.length){
            const end=new Date(today); end.setDate(end.getDate()+60); // 60-day cap
            for(const d=new Date(today); d<=end; d.setDate(d.getDate()+1)){
              for(const {t,rule} of tmpls) if(recurFiresOn(rule,d)) add(new Date(d),{kind:"upcoming",title:t.title,time:rule.time});
            }
          }
        }
        for(const arr of map.values()) arr.sort((a,b)=>MARKER_ORDER[a.kind]-MARKER_ORDER[b.kind]);
        return map;
      }

      // Lazy: fetch completion timestamps from the hidden [tasks:edit] … completed …
      // comments (the same records the activity feed reads). Falls back to updateDate.
      async function loadRawComments(task:Task):Promise<any[]>{
        const url=`${baseUrl}/tasks/${task.installationId}/task/${task.id}/comments${currentUserId?`?viewedBy=${currentUserId}`:""}`;
        const r=await fetch(url,apiOpts({headers:{Accept:CMT_HTML_ACCEPT}}));
        if(!r.ok) return [];
        let d:any; try{ d=await r.json(); }catch(_){ return []; }
        return Array.isArray(d)?d:(d.data||[]);
      }
      async function ensureCompletionDates(){
        if(completionDatesLoaded) return;
        completionDatesLoaded=true;
        const done=allTasks.filter(t=>t.taskType!=="audit-result" && isDoneStatus(t.status))
          .sort((a,b)=>(b.updateDate?Date.parse(b.updateDate):0)-(a.updateDate?Date.parse(a.updateDate):0))
          .slice(0,40);
        if(!done.length) return;
        await Promise.all(done.map(async t=>{
          try{
            const cs=await loadRawComments(t);
            let best="";
            for(const c of cs){
              const txt=commentText(c).replace(/<[^>]+>/g," ").trim();
              if(txt.indexOf(EDIT_MARK)!==0 || !/completed/i.test(txt)) continue;
              const iso=c.createdAt||c.created||"";
              if(iso && (!best || Date.parse(iso)>Date.parse(best))) best=iso;
            }
            if(best) completionDates.set(t.id,best);
          }catch(_){}
        }));
        if(view==="calendar") renderCalendar();
      }

      const chevL=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
      const chevR=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
      const dotToday=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="12" x2="12" y2="8"/></svg>`;
      const alertIco=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

      let lastCalCompact=false;
      function renderCalendar(){
        ensureCompletionDates(); // fire-and-forget; refines completed markers when ready
        countEl.textContent=String(allTasks.filter(t=>t.taskType!=="audit-result" && !isDoneStatus(t.status)).length);
        const markers=buildMarkers();
        const todayK=dayKey(new Date());
        const vw=window.innerWidth||document.documentElement.clientWidth||0;
        const calW=listWrap.clientWidth||0;
        const compact=(vw>0&&vw<600)||(calW>0&&calW<460);
        lastCalCompact=compact;

        const chipFor=(mk:CalMarker)=>`<div class="${p}-cal-chip ${mk.kind}"${mk.taskId?` data-id="${esc(mk.taskId)}"`:""}>${mk.time?esc(fmtHour(mk.time))+" ":""}${esc(ct(mk.title))}</div>`;
        const dotsFor=(arr:CalMarker[])=>{ const kinds:string[]=[]; for(const m of arr) if(kinds.indexOf(m.kind)<0) kinds.push(m.kind); return kinds.slice(0,4).map(k=>`<i class="${p}-cal-cdot ${k}"></i>`).join(""); };

        // Overdue roll-up: open tasks past their due date. The banner is sized by the
        // OLDEST overdue task; clicking it jumps the agenda to that day.
        const todayMid=new Date(); todayMid.setHours(0,0,0,0);
        let oldestOverdue:Date|null=null, overdueCount=0;
        for(const t of allTasks){
          if(t.taskType==="audit-result"||isDoneStatus(t.status)||!t.dueDate) continue;
          const dd=calDateOnly(t.dueDate); if(!dd||dd>=todayMid) continue;
          overdueCount++; if(!oldestOverdue||dd<oldestOverdue) oldestOverdue=dd;
        }
        let overdueBanner="";
        if(overdueCount>0 && oldestOverdue){
          const daysAgo=Math.round((todayMid.getTime()-oldestOverdue.getTime())/86400000);
          const dLabel=daysAgo===1?tr("cal_oneDayAgo"):tr("cal_nDaysAgo").replace("{n}",String(daysAgo));
          const summary=tr("cal_overdueSummary").replace("{n}",String(overdueCount)).replace("{d}",dLabel);
          overdueBanner=`<button type="button" class="${p}-cal-overdue" data-overdue-jump="1">${alertIco}<span>${esc(summary)}</span><span class="${p}-cal-overdue-arrow">${chevR}</span></button>`;
        }

        let rangeLabel="", bodyHtml="";
        if(calMode==="agenda"){
          calDays=compact?2:3;
          const days=Array.from({length:calDays},(_,i)=>new Date(calCursor.getFullYear(),calCursor.getMonth(),calCursor.getDate()+i));
          const a=days[0], b=days[days.length-1];
          rangeLabel=a.getMonth()===b.getMonth()
            ?`${a.toLocaleDateString("en-US",{month:"long",day:"numeric"})} – ${b.getDate()}, ${b.getFullYear()}`
            :`${a.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${b.toLocaleDateString("en-US",{month:"short",day:"numeric"})}, ${b.getFullYear()}`;
          bodyHtml=`<div class="${p}-cal-cols" style="grid-template-columns:repeat(${calDays},minmax(0,1fr))">`+days.map(d=>{
            const k=dayKey(d); const arr=markers.get(k)||[];
            const evs=arr.length?arr.map(mk=>`<div class="${p}-ev ${mk.kind}"${mk.taskId?` data-id="${esc(mk.taskId)}"`:""}><div class="${p}-ev-time">${mk.time?esc(fmtHour(mk.time)):tr("cal_"+mk.kind)}</div><div class="${p}-ev-title">${esc(ct(mk.title))}</div></div>`).join(""):`<div class="${p}-col-empty">—</div>`;
            return `<div class="${p}-cal-col"><div class="${p}-cal-colhead ${k===todayK?"today":""}"><div class="${p}-cal-dow2">${DOW[d.getDay()]}</div><div class="${p}-cal-dnum">${d.getDate()}</div></div><div class="${p}-cal-evs">${evs}</div></div>`;
          }).join("")+`</div>`;
        } else {
          const y=calCursor.getFullYear(), m=calCursor.getMonth();
          rangeLabel=calCursor.toLocaleDateString("en-US",{month:"long",year:"numeric"});
          const startDow=new Date(y,m,1).getDay();
          const cells:string[]=[];
          for(let i=0;i<42;i++){
            const d=new Date(y,m,1-startDow+i);
            const muted=d.getMonth()!==m;
            const k=dayKey(d); const arr=markers.get(k)||[];
            const chips=arr.slice(0,3).map(chipFor).join("");
            const more=arr.length>3?`<div class="${p}-cal-more">+${arr.length-3} ${tr("cal_more")}</div>`:"";
            const dots=arr.length?`<div class="${p}-cal-dots">${dotsFor(arr)}</div>`:"";
            cells.push(`<div class="${p}-cal-cell ${muted?"muted":""} ${k===todayK?"today":""}"><span class="${p}-cal-num">${d.getDate()}</span>${chips}${more}${dots}</div>`);
          }
          bodyHtml=`<div class="${p}-cal-dow">${DOW.map(x=>`<span>${x}</span>`).join("")}</div><div class="${p}-cal-grid">${cells.join("")}</div>`;
        }

        const legendKinds:Array<CalMarker["kind"]>=["assigned","due","overdue","completed"];
        if(showUpcomingRecurring) legendKinds.push("upcoming");
        const legend=`<div class="${p}-cal-legend">${legendKinds.map(k=>`<span class="${p}-cal-leg ${k}"><i></i>${tr("cal_"+k)}</span>`).join("")}</div>`;

        listWrap.innerHTML=`<div class="${p}-cal${compact?` ${p}-cal-compact`:""}">
          <div class="${p}-cal-head">
            <span class="${p}-cal-range">${esc(rangeLabel)}</span>
            <div class="${p}-cal-ctrls">
              <div class="${p}-cal-modeseg" id="${p}-cal-mode">
                <button data-mode="month" class="${calMode==="month"?"active":""}">${tr("month")}</button>
                <button data-mode="agenda" class="${calMode==="agenda"?"active":""}">${tr("threeDay").replace("3",compact?"2":"3")}</button>
              </div>
              <div class="${p}-cal-nav">
                <button class="${p}-ico-btn" data-nav="-1" aria-label="${tr("scrollLeft")}">${chevL}</button>
                <button class="${p}-ico-btn" data-nav="0" title="${tr("today")}">${dotToday}</button>
                <button class="${p}-ico-btn" data-nav="1" aria-label="${tr("scrollRight")}">${chevR}</button>
              </div>
            </div>
          </div>
          ${overdueBanner}
          ${bodyHtml}
          ${legend}
        </div>`;

        const calEl=listWrap.querySelector(`.${p}-cal`)!;
        if(oldestOverdue){
          const jump=new Date(oldestOverdue);
          calEl.querySelector(`[data-overdue-jump]`)?.addEventListener("click",()=>{ calMode="agenda"; calCursor=jump; renderCalendar(); });
        }
        calEl.querySelectorAll(`#${p}-cal-mode button`).forEach((b:Element)=>b.addEventListener("click",()=>{ calMode=(b as HTMLElement).dataset.mode==="agenda"?"agenda":"month"; renderCalendar(); }));
        calEl.querySelectorAll("[data-nav]").forEach((b:Element)=>b.addEventListener("click",()=>{
          const nav=parseInt((b as HTMLElement).dataset.nav!,10);
          if(nav===0) calCursor=new Date();
          else if(calMode==="agenda") calCursor=new Date(calCursor.getFullYear(),calCursor.getMonth(),calCursor.getDate()+nav*calDays);
          else calCursor=new Date(calCursor.getFullYear(),calCursor.getMonth()+nav,1);
          renderCalendar();
        }));
        calEl.querySelectorAll("[data-id]").forEach((el:Element)=>el.addEventListener("click",()=>{
          const task=allTasks.find(t=>t.id===(el as HTMLElement).dataset.id);
          if(task) openDetail(task);
        }));
      }

      // Re-render the calendar when the narrow/wide threshold flips (chips ↔ dots,
      // 2 ↔ 3 agenda columns). Cleaned up in disconnectedCallback.
      const self0:any=this;
      // Rebind on every render so the handler closes over the current view/listWrap.
      if(self0._mtwCalResize){ window.removeEventListener("resize",self0._mtwCalResize); self0._mtwCalResize=undefined; }
      if(showCalendar){
        self0._mtwCalResize=()=>{
          if(view!=="calendar") return;
          const vw=window.innerWidth||document.documentElement.clientWidth||0;
          const calW=listWrap.clientWidth||0;
          const compact=(vw>0&&vw<600)||(calW>0&&calW<460);
          if(compact!==lastCalCompact) renderCalendar();
        };
        window.addEventListener("resize",self0._mtwCalResize);
      }

      // ── Task card ─────────────────────────────────────────────────────
      function renderTaskCard(task:Task):string{
        const isDone=task.status==="DONE"||task.status==="done"||task.status==="CLOSED";
        const dueInfo=formatDate(task.dueDate);
        const desc=task.description?esc(ct(stripTypeTag(task.description).trim())):"";
        const typeCol=task.taskType?typeColor(task.taskType):"";
        const typeText=task.taskType?contrastColor(typeCol):"";
        const isCrit=(task.auditSeverity||"").toLowerCase()==="critical";
        const prioCol=isCrit?"#9B1C2E":priorityColor(task.priority);
        const prioLbl=isCrit?tr("critical"):task.priority==="Priority_1"?tr("high"):task.priority==="Priority_2"?tr("medium"):tr("normal");
        const typeBadge=task.taskType?`<span class="${p}-type-badge" style="background:${typeCol};color:${typeText}" dir="auto">${esc(ct(task.taskType))}</span>`:"";
        const prioBadge=(isCrit||(task.priority&&task.priority!=="Priority_3"))?`<span class="${p}-prio-badge${isCrit?" crit":""}" style="color:${prioCol};border-color:${prioCol}">${prioLbl}</span>`:"";
        const iconRecur=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
        const recurBadge=task.isRecurring?`<span class="${p}-recur-badge">${iconRecur}${tr("recurring")}</span>`:"";

        const iconCal=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
        const iconStore=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
        const iconList=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
        const iconGroup=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
        const iconCheck=`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

        // Group names
        const groupNames=task.groupIds.map(gid=>groupName(gid)).filter(Boolean);

        return `
          <div class="${p}-card ${isDone?"done":""}" data-task-id="${esc(task.id)}" data-install-id="${esc(task.installationId)}">
            <div class="${p}-card-inner">
              <div class="${p}-check-wrap">
                <div class="${p}-check ${isDone?"checked":""}"
                     data-task-id="${esc(task.id)}" data-install-id="${esc(task.installationId)}" data-status="${esc(task.status)}"
                     title="${isDone?tr("markAsOpen"):tr("markAsDone")}">
                  <span class="${p}-check-icon">${iconCheck}</span>
                </div>
              </div>
              <div class="${p}-card-body">
                <div class="${p}-card-top">${typeBadge}${recurBadge}${prioBadge}</div>
                <div class="${p}-card-title"><span dir="auto">${esc(ct(task.title))}</span></div>
                ${desc?`<div class="${p}-card-desc" dir="auto">${desc}</div>`:""}
                <div class="${p}-card-meta">
                  ${dueInfo.text?`<span class="${p}-meta-item ${dueInfo.overdue&&!isDone?"overdue":""}">${iconCal} ${dueInfo.overdue&&!isDone?tr("overdueLabel")+": ":""}<span dir="auto">${dueInfo.text}</span></span>`:""}
                  ${task.installationTitle?`<span class="${p}-meta-item">${iconStore} ${esc(task.installationTitle)}</span>`:""}
                  ${task.listName?`<span class="${p}-meta-item">${iconList} ${esc(task.listName)}</span>`:""}
                  ${groupNames.map(gn=>`<span class="${p}-meta-item">${iconGroup} ${esc(gn)}</span>`).join("")}
                </div>
              </div>
            </div>
          </div>`;
      }

      // ── Detail panel ──────────────────────────────────────────────────
      let detailTask: Task|null = null;
      let detailAudit: any = null;   // when the panel shows an audit summary instead of a task
      let detailAssignTab: "group"|"person" = "group";

      function openDetail(task:Task){
        detailTask=task; detailAudit=null;
        detailAssignTab="group";
        const isWide=window.innerWidth>=720; // side panel on desktop, bottom sheet on mobile (viewport-based, not column width)
        detailEl.classList.toggle("side",isWide);
        detailEl.classList.remove("audit-view");
        renderDetailContent(task);
        overlayEl.classList.add("open");
        void detailEl.offsetWidth; // commit the closed (centered) state so the first open animates from it, not from the bottom
        requestAnimationFrame(()=>detailEl.classList.add("open"));
      }

      // Open the audit summary in the same sidebar/sheet, with an animated
      // category breakdown chart.
      function openAuditSummary(pa:any,label:string,sysTask?:Task|null){
        detailAudit=pa; detailTask=null;
        const isWide=window.innerWidth>=720; // side panel on desktop, bottom sheet on mobile (viewport-based, not column width)
        detailEl.classList.toggle("side",isWide);
        detailEl.classList.add("audit-view"); // hides the task footer
        renderAuditSummaryDetail(pa,label,sysTask);
        overlayEl.classList.add("open");
        void detailEl.offsetWidth; // commit the closed (centered) state so the first open animates from it, not from the bottom
        requestAnimationFrame(()=>detailEl.classList.add("open"));
      }

      function renderAuditSummaryDetail(pa:any,label:string,sysTask?:Task|null){
        const passing=pa?.passing??null;
        const pct=pa?.score??null;
        const scoreColor=passing===true?"var(--success)":passing===false?"var(--error)":"var(--gray)";
        detailBadges.innerHTML=`<span class="${p}-prio-badge" style="color:${scoreColor};border-color:${scoreColor}">${passing===true?tr("passing"):passing===false?tr("failing"):"—"}</span>`;
        const cats=pa?.categories&&typeof pa.categories==="object"?Object.keys(pa.categories):[];
        const iCal2=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
        const iStore2=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
        const iUser2=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const bars=cats.map((name:string,i:number)=>{
          const c:any=pa.categories[name];
          const v=Math.max(0,Math.min(100, c?.pct!=null?c.pct:(c?.total?Math.round((c.earned/c.total)*100):0)));
          const tier=v>=80?"hi":v>=50?"mid":"lo";
          const detail=c&&c.total!=null?`${c.earned}/${c.total}`:"";
          return `<div class="${p}-cat-row">
            <div class="${p}-cat-top"><span class="${p}-cat-name">${esc(name)}</span><span class="${p}-cat-pct">${detail?`<span style="color:var(--gray-lt);font-weight:500;margin-inline-end:6px">${detail}</span>`:""}${v}%</span></div>
            <div class="${p}-cat-bar"><span class="${p}-cat-fill ${tier}" data-pct="${v}" style="width:0;transition-delay:${i*60}ms"></span></div>
          </div>`;
        }).join("");
        detailBody.innerHTML=`
          <div class="${p}-detail-title">${esc(label.replace(/^Audit\s*[—–-]\s*/i,"").trim()||label)}</div>
          <div class="${p}-audit-detail-score" style="color:${scoreColor}">${pct!=null?pct+"%":"—"}</div>
          <div class="${p}-audit-detail-sub" style="color:${scoreColor}">${passing===true?tr("passing"):passing===false?tr("failing"):tr("notScored")}</div>
          <div class="${p}-detail-meta" style="margin-bottom:18px">
            ${pa?.store?`<div class="${p}-detail-meta-row">${iStore2} ${esc(pa.store)}</div>`:""}
            ${pa?.auditor?`<div class="${p}-detail-meta-row">${iUser2} ${esc(pa.auditor)}</div>`:""}
            ${pa?.date?`<div class="${p}-detail-meta-row">${iCal2} ${esc(pa.date)}</div>`:""}
            ${pa?.taskCount!=null?`<div class="${p}-detail-meta-row">${iClip} ${tr("nTasksFlagged").replace("{n}",String(pa.taskCount))}</div>`:""}
          </div>
          ${pa?.notes?`<div class="${p}-detail-desc-label">${tr("notes")}</div><div class="${p}-detail-desc" style="margin-bottom:18px" dir="auto">${esc(ct(pa.notes))}</div>`:""}
          ${(sysTask&&sysTask.attachmentIds&&sysTask.attachmentIds.length)?`<div class="${p}-detail-desc-label">${tr("attachments")}</div><div class="${p}-att-grid" id="${p}-audit-att-${instId}" style="margin-bottom:18px"><span class="${p}-att-empty">${tr("loading")}</span></div>`:""}
          ${cats.length?`<div class="${p}-detail-desc-label">${tr("categoryBreakdown")}</div><div class="${p}-cat-chart">${bars}</div>`:""}
        `;
        // Render the summary task's attachments (above the bars).
        if(sysTask&&sysTask.attachmentIds&&sysTask.attachmentIds.length){
          const grid=detailBody.querySelector(`#${p}-audit-att-${instId}`) as HTMLElement|null;
          const ids=sysTask.attachmentIds;
          Promise.all(ids.map(mediaMeta)).then(metas=>{
            if(detailAudit!==pa||!grid) return;
            grid.innerHTML=ids.map((_id,i)=>{
              const m=metas[i]; const name=esc(m?.fileName||"file");
              const thumb=m?.thumbnail?.url?`<img class="${p}-att-thumb" src="${esc(m.thumbnail.url)}" alt="">`:`<span class="${p}-att-ico">${iFileGeneric}</span>`;
              const size=m?.size?`<span class="${p}-att-size">${humanSize(m.size)}</span>`:"";
              const fn=m?.fileName||"file";
              const turl=m?.thumbnail?.url||"";
              const full=originalUrl(m)||turl;
              const kind=attKind(m);
              return `<div class="${p}-att-tile"><a class="${p}-att-link" href="${esc(full||"#")}" target="_blank" rel="noopener" data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}">${thumb}<span class="${p}-att-meta"><span class="${p}-att-name">${name}</span>${size}</span></a></div>`;
            }).join("");
          });
        }
        const reduceMotion=(()=>{try{return window.matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(_){return false;}})();
        // Animate the bars from 0 → their value once laid out.
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          detailBody.querySelectorAll(`.${p}-cat-fill`).forEach(el=>{
            (el as HTMLElement).style.width=((el as HTMLElement).dataset.pct||"0")+"%";
          });
        }));
        // Count the score up from 0 → pct.
        const scoreEl=detailBody.querySelector(`.${p}-audit-detail-score`) as HTMLElement|null;
        if(scoreEl && pct!=null && !reduceMotion){
          const target=pct, dur=750, t0=performance.now();
          scoreEl.textContent="0%";
          const tick=(now:number)=>{
            if(detailAudit!==pa) return; // panel changed
            const k=Math.min(1,(now-t0)/dur);
            const eased=1-Math.pow(1-k,3);
            scoreEl.textContent=Math.round(eased*target)+"%";
            if(k<1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      }

      function closeDetail(){
        overlayEl.classList.remove("open");
        detailEl.classList.remove("open");
        detailEl.style.bottom="";
        detailTask=null; detailAudit=null;
      }

      detailEl.addEventListener("click",e=>e.stopPropagation());

      // Lift the bottom-sheet above the on-screen keyboard (mobile). Pinning to
      // bottom:0 puts the composer behind the keyboard and it can't scroll past
      // its own end, so we raise the whole sheet by the keyboard height instead.
      const vv:any=(window as any).visualViewport;
      const onViewport=()=>{
        if((!detailTask&&!detailAudit)||detailEl.classList.contains("side")){ detailEl.style.bottom=""; return; }
        if(!vv) return;
        const kb=Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        detailEl.style.bottom = kb>80 ? kb+"px" : "";
      };
      if(vv){ vv.addEventListener("resize",onViewport); vv.addEventListener("scroll",onViewport); self._mtwVV=onViewport; }

      // Parse an audit-generated description into structured fields.
      // Matches the format produced by the audit widget:
      //   Audit finding: EXT-007 — Building exterior walls are clean
      //   Audit: Audit — May 28, 2026 9:12 AM
      //   Auditor: Nicole Adams
      function parseAuditFinding(desc:string):{code:string;finding:string;audit:string;auditor:string}|null{
        const lines=desc.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
        let code="",finding="",audit="",auditor="";
        for(const ln of lines){
          let m:RegExpMatchArray|null;
          if((m=ln.match(/^Audit finding:\s*(.+)$/i))){
            const rest=m[1].trim();
            const d=rest.match(/^([A-Za-z0-9][\w.-]*)\s*[—–-]\s*(.+)$/);
            if(d){ code=d[1]; finding=d[2].trim(); } else { finding=rest; }
          } else if((m=ln.match(/^Audit:\s*(.+)$/i))){ audit=m[1].trim(); }
          else if((m=ln.match(/^Auditor:\s*(.+)$/i))){ auditor=m[1].trim(); }
        }
        if(!finding&&!audit&&!auditor) return null;
        return {code,finding,audit,auditor};
      }
      function renderDetailContent(task:Task){
        const isDone=task.status==="DONE"||task.status==="done"||task.status==="CLOSED";
        const dueInfo=formatDate(task.dueDate);
        const typeCol=task.taskType?typeColor(task.taskType):"";
        const typeText=task.taskType?contrastColor(typeCol):"";
        const isCrit=(task.auditSeverity||"").toLowerCase()==="critical";
        const prioCol=isCrit?"#9B1C2E":priorityColor(task.priority);
        const prioLbl=isCrit?tr("critical"):task.priority==="Priority_1"?tr("high"):task.priority==="Priority_2"?tr("medium"):tr("normal");
        const cleanDesc=task.description?stripTypeTag(task.description).trim():"";

        const iconRecurD=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
        detailBadges.innerHTML=`
          ${task.taskType?`<span class="${p}-type-badge" style="background:${typeCol};color:${typeText}" dir="auto">${esc(ct(task.taskType))}</span>`:""}
          ${task.isRecurring?`<span class="${p}-recur-badge">${iconRecurD}Recurring</span>`:""}
          ${(isCrit||(task.priority&&task.priority!=="Priority_3"))?`<span class="${p}-prio-badge${isCrit?" crit":""}" style="color:${prioCol};border-color:${prioCol}">${prioLbl}</span>`:""}`;

        const iCal=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
        const iClock=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
        const iStore=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
        const iList=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
        const iGroup=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
        const iUser=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        // Assignee section: group vs person tabs (only shown when there are groups or assignees)
        const hasGroup=task.groupIds.length>0;
        const hasAssignee=task.assigneeIds.length>0;
        const showAssignTabs=(hasGroup||hasAssignee)&&(auditMode||allowAssign);

        let assigneeHtml="";
        if(hasGroup||hasAssignee){
          if(showAssignTabs){
            const groupNames=task.groupIds.map(gid=>groupName(gid)).filter(Boolean);
            const groupHtml=groupNames.map(gn=>`<div class="${p}-detail-meta-row">${iGroup} ${esc(gn)}</div>`).join("")||`<div style='font-size:12px;color:var(--gray-lt)'>${tr("noGroupAssigned")}</div>`;
            const personHtml=task.assigneeIds.length>0?task.assigneeIds.map(aid=>`<div class="${p}-detail-meta-row" data-uid="${esc(aid)}">${iUser} <span>${esc(aid)}</span></div>`).join(""):`<div style='font-size:12px;color:var(--gray-lt)'>${tr("noIndividualAssignee")}</div>`;
            assigneeHtml=`
              <div class="${p}-assign-tabs" id="${p}-assign-tabs-${instId}">
                <button type="button" class="${p}-assign-tab${detailAssignTab==="group"?" active":""}" data-tab="group">${tr("group")}</button>
                <button type="button" class="${p}-assign-tab${detailAssignTab==="person"?" active":""}" data-tab="person">${tr("person")}</button>
              </div>
              <div id="${p}-assign-content-${instId}">
                ${detailAssignTab==="group"?groupHtml:personHtml}
              </div>`;
          } else {
            const groupNames=task.groupIds.map(gid=>groupName(gid)).filter(Boolean);
            assigneeHtml=groupNames.map(gn=>`<div class="${p}-detail-meta-row">${iGroup} ${esc(gn)}</div>`).join("");
          }
        }

        detailBody.innerHTML=`
          <div class="${p}-detail-title ${isDone?"done":""}" dir="auto">${esc(ct(task.title))}</div>
          <div class="${p}-detail-meta">
            ${dueInfo.text?`<div class="${p}-detail-meta-row ${dueInfo.overdue&&!isDone?"overdue":""}">${iCal}${dueInfo.overdue&&!isDone?tr("overdueLabel")+" · ":tr("dueLabel")+" "}<span dir="auto">${dueInfo.text}</span></div>`:""}
            ${(()=>{const c=formatDate(task.createDate||null).text;return c?`<div class="${p}-detail-meta-row">${iClock} ${tr("createdLabel")+" "}<span dir="auto">${c}</span></div>`:"";})()}
            ${task.installationTitle?`<div class="${p}-detail-meta-row">${iStore} ${esc(task.installationTitle)}</div>`:""}
            ${task.listName?`<div class="${p}-detail-meta-row">${iList} ${esc(task.listName)}</div>`:""}
            ${assigneeHtml}
            ${allowAssign?`<div class="${p}-reassign" id="${p}-reassign-${instId}">
              <button type="button" class="${p}-reassign-btn" data-act="open"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> ${(task.groupIds.length||task.assigneeIds.length)?tr("reassign"):tr("assign")}</button>
              <div class="${p}-reassign-pop" style="display:none">
                <input type="text" class="${p}-reassign-search" placeholder="${tr("searchPeopleGroups")}">
                <div class="${p}-reassign-results"></div>
                <div class="${p}-reassign-foot">
                  <span class="${p}-reassign-sel"></span>
                  <span style="display:flex;gap:6px">
                    <button type="button" class="${p}-reassign-clear">${tr("clearAll")}</button>
                    <button type="button" class="${p}-reassign-save">${tr("save")}</button>
                  </span>
                </div>
              </div>
            </div>`:""}
          </div>
          ${(()=>{
            const af = auditMode && cleanDesc ? parseAuditFinding(cleanDesc) : null;
            if(af){
              return `<div class="${p}-detail-desc-label">${tr("auditFinding")}</div>
                <div class="${p}-af">
                  ${af.code?`<span class="${p}-af-code">${esc(af.code)}</span>`:""}
                  ${af.finding?`<div class="${p}-af-finding" dir="auto">${esc(ct(af.finding))}</div>`:""}
                  <div class="${p}-af-pills">
                    ${af.audit?`<span class="${p}-af-pill">${iCal}<span>${esc(af.audit)}</span></span>`:""}
                    ${af.auditor?`<span class="${p}-af-pill">${iUser}<span>${esc(af.auditor)}</span></span>`:""}
                  </div>
                </div>`;
            }
            return cleanDesc
              ? `<div class="${p}-detail-desc-label">${tr("description")}</div><div class="${p}-detail-desc" dir="auto">${esc(ct(cleanDesc))}</div>`
              : `<div class="${p}-detail-desc empty">${tr("noDescription")}</div>`;
          })()}
          <div class="${p}-att">
            <div class="${p}-att-head">
              <span class="${p}-att-label">${tr("attachments")}</span>
              <label class="${p}-att-add" id="${p}-att-add-${instId}" for="${p}-att-input-${instId}">${iClip} ${tr("add")}</label>
            </div>
            <div class="${p}-att-grid" id="${p}-att-grid-${instId}"></div>
            <input type="file" multiple class="${p}-cmt-file" id="${p}-att-input-${instId}">
          </div>
          ${enableComments?`
          <div class="${p}-cmt">
            <div class="${p}-att-head"><span class="${p}-att-label">${tr("comments")}</span></div>
            <div class="${p}-cmt-list" id="${p}-cmt-list-${instId}"></div>
            <div class="${p}-cmt-compose">
              <span class="${p}-cmt-av-slot" id="${p}-cmt-me-${instId}"><span class="${p}-cmt-av ${p}-cmt-av-fb">·</span></span>
              <div class="${p}-cmt-field">
                <textarea class="${p}-cmt-input" id="${p}-cmt-input-${instId}" rows="2" placeholder="${tr("addComment")}"></textarea>
                <div class="${p}-cmt-bar" id="${p}-cmt-bar-${instId}">
                  <div class="${p}-cmt-chips" id="${p}-cmt-chips-${instId}"></div>
                  <label class="${p}-cmt-attach" id="${p}-cmt-attach-${instId}" for="${p}-cmt-file-${instId}" title="${tr("attachFile")}">${iClip}</label>
                  <button type="button" class="${p}-cmt-send" id="${p}-cmt-send-${instId}">${iSend} ${tr("send")}</button>
                </div>
                <input type="file" multiple class="${p}-cmt-file" id="${p}-cmt-file-${instId}">
              </div>
            </div>
          </div>`:""}
        `;

        renderAttachments(task);

        // Resolve assignee IDs → names (shown in the Person tab).
        detailBody.querySelectorAll(`.${p}-detail-meta-row[data-uid]`).forEach(row=>{
          const uid=(row as HTMLElement).dataset.uid||"";
          fetchUser(uid).then(u=>{ const s=row.querySelector("span"); if(s&&u.name) s.textContent=u.name; });
        });

        // Reassign control (allowtaskassignment) — available in both normal and audit mode
        if(allowAssign) wireReassign(task);

        if(enableComments){
          renderComments(task);
          // Current user's avatar next to the composer.
          if(currentUserId) fetchUser(currentUserId).then(me=>{
            if(detailTask!==task) return;
            const slot=detailBody.querySelector(`#${p}-cmt-me-${instId}`) as HTMLElement|null;
            if(slot) slot.innerHTML=avatarHtml(me);
          });
          const cInput=detailBody.querySelector(`#${p}-cmt-input-${instId}`) as HTMLTextAreaElement|null;
          const cSend =detailBody.querySelector(`#${p}-cmt-send-${instId}`) as HTMLButtonElement|null;
          const cBar   =detailBody.querySelector(`#${p}-cmt-bar-${instId}`)    as HTMLElement|null;
          const cAttach=detailBody.querySelector(`#${p}-cmt-attach-${instId}`) as HTMLButtonElement|null;
          const cFile  =detailBody.querySelector(`#${p}-cmt-file-${instId}`)   as HTMLInputElement|null;
          const cChips =detailBody.querySelector(`#${p}-cmt-chips-${instId}`)  as HTMLElement|null;
          // Files attached to the comment-in-progress (also become task attachments).
          const pending:Array<{id:string;url:string;name:string}> = [];
          const hasContent=()=>!!(cInput?.value.trim()||pending.length);
          // Bar (attach + send) shows on focus or when there's content; Send shows only with content.
          const updateSendVisibility=()=>{
            if(cBar) cBar.classList.toggle("show", document.activeElement===cInput || hasContent());
            if(cSend) cSend.classList.toggle("show", hasContent());
          };
          // Only do the keyboard avoidance on touch devices — on desktop there's
          // no on-screen keyboard, so the extra padding/scroll is unwanted.
          const isTouch=(()=>{try{return window.matchMedia("(pointer:coarse)").matches;}catch(_){return "ontouchstart" in window;}})();
          cInput?.addEventListener("focus",()=>{
            cBar?.classList.add("show");
            if(!isTouch) return;
            // The composer is the last element, so there's nothing below it to
            // scroll into — add temporary room so it can clear the keyboard, then
            // scroll it into the visible (keyboard-reduced) viewport.
            detailBody.style.paddingBottom="55vh";
            setTimeout(()=>cInput.scrollIntoView({block:"center",behavior:"smooth"}),350);
          });
          cInput?.addEventListener("blur",()=>{ setTimeout(()=>{ if(isTouch) detailBody.style.paddingBottom=""; if(!hasContent()) cBar?.classList.remove("show"); },200); });
          // Send keeps textarea focus until its click fires; attach is a <label for>
          // that opens the picker natively (reliable on mobile, no input.click()).
          cSend?.addEventListener("mousedown",e=>e.preventDefault());
          const renderChips=()=>{
            if(!cChips) return;
            cChips.innerHTML=pending.map((f,i)=>`<span class="${p}-cmt-chip"><span>${esc(f.name)}</span><button type="button" data-idx="${i}">${iXsmall}</button></span>`).join("");
            cChips.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
              const idx=parseInt((b as HTMLElement).dataset.idx||"-1",10);
              if(idx>=0){ pending.splice(idx,1); renderChips(); updateSendVisibility(); }
            }));
          };
          // Auto-grow textarea + reveal Send when there's text or attachments.
          cInput?.addEventListener("input",()=>{
            cInput.style.height="auto"; cInput.style.height=Math.min(cInput.scrollHeight,140)+"px";
            updateSendVisibility();
          });
          cFile?.addEventListener("change",async()=>{
            const files=Array.from(cFile.files||[]); cFile.value="";
            if(!files.length) return;
            const tooBig=files.find(f=>f.size>MEDIA_MAX);
            if(tooBig){ showBanner("error",`"${tooBig.name}" exceeds ${humanSize(MEDIA_MAX)}.`); return; }
            if(cAttach) cAttach.disabled=true;
            try{
              for(const f of files){ const m=await uploadMedia(f); pending.push({id:m.id,url:m.url,name:f.name}); }
              hideBanner();
            }catch(e:any){ showBanner("error",`Upload failed: ${e.message}`); }
            if(cAttach) cAttach.disabled=false; renderChips(); updateSendVisibility();
          });
          const submit=async()=>{
            const text=(cInput?.value||"").trim();
            if((!text&&!pending.length)||!cSend||!cInput) return;
            cSend.disabled=true; cInput.disabled=true;
            let ok=false;
            try{
              const tokens=pending.map(f=>`[attachment:${f.id}]`).join(" ");
              const full=[text,tokens].filter(Boolean).join(text&&tokens?"\n":"");
              await postComment(task,full);
              // Also attach the files to the task itself (so they appear in Attachments).
              if(pending.length){
                const next=[...(task.attachmentIds||[]),...pending.map(f=>f.id)];
                try{
                  await fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({attachmentIds:next})});
                  task.attachmentIds=next; renderAttachments(task);
                }catch(_){}
              }
              cInput.value=""; cInput.style.height="auto"; pending.length=0; renderChips();
              cSend?.classList.remove("show"); cBar?.classList.remove("show"); hideBanner();
              await renderComments(task);
              ok=true;
            }catch(e:any){ showBanner("error",`Couldn't post comment: ${e.message}`); }
            cSend.disabled=false; cInput.disabled=false;
            // On success, blur so the mobile keyboard dismisses; on failure keep
            // focus so they can retry without re-tapping the field.
            if(ok) cInput.blur(); else cInput.focus();
          };
          cSend?.addEventListener("click",submit);
          cInput?.addEventListener("keydown",(e)=>{ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") submit(); });
        }

        // ── Attachment add / upload ────────────────────────────────────
        const attAdd  = detailBody.querySelector(`#${p}-att-add-${instId}`)   as HTMLButtonElement|null;
        const attInput= detailBody.querySelector(`#${p}-att-input-${instId}`) as HTMLInputElement|null;
        if(attAdd&&attInput){
          // attAdd is a <label for> → opens the picker natively (mobile-reliable).
          attInput.addEventListener("change",async()=>{
            const files=Array.from(attInput.files||[]);
            attInput.value="";
            if(!files.length) return;
            const oversize=files.find(f=>f.size>MEDIA_MAX);
            if(oversize){ showBanner("error",`"${oversize.name}" exceeds ${humanSize(MEDIA_MAX)}.`); return; }
            attAdd.disabled=true;
            attAdd.innerHTML=`<span class="${p}-spin" style="width:12px;height:12px;border-width:2px"></span> Uploading…`;
            try{
              const ids:string[]=[];
              for(const f of files){ const m=await uploadMedia(f); ids.push(m.id); }
              const next=[...(task.attachmentIds||[]),...ids];
              const res=await fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({attachmentIds:next})});
              if(!res.ok) throw new Error(`HTTP ${res.status}`);
              task.attachmentIds=next;
              hideBanner();
            }catch(e:any){ showBanner("error",`Upload failed: ${e.message}`); }
            attAdd.disabled=false;
            attAdd.innerHTML=`${iClip} Add`;
            renderAttachments(task);
          });
        }

        // Wire assignee tab switch
        detailBody.querySelectorAll(`.${p}-assign-tab`).forEach(btn=>{
          btn.addEventListener("click",()=>{
            detailAssignTab=(btn as HTMLElement).dataset.tab as "group"|"person";
            if(detailTask) renderDetailContent(detailTask);
          });
        });

        const iconCheck=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        const iconUndo=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`;
        if(isDone){
          detailToggle.className=`${p}-detail-toggle-btn open-btn`;
          detailToggle.innerHTML=`${iconUndo} Reopen task`;
        } else {
          detailToggle.className=`${p}-detail-toggle-btn done-btn`;
          detailToggle.innerHTML=`${iconCheck} Mark as done`;
        }
      }

      overlayEl.addEventListener("click",closeDetail);
      detailClose.addEventListener("click",e=>{e.stopPropagation();closeDetail();});
      const onDocKey = (e: KeyboardEvent) => { if (e.key === "Escape" && (detailTask||detailAudit)) closeDetail(); };
      document.addEventListener("keydown", onDocKey);
      self._mtwDocKey = onDocKey;
      detailToggle.addEventListener("click",async()=>{
        if(!detailTask) return;
        const task=detailTask;
        const isDone=task.status==="DONE"||task.status==="done"||task.status==="CLOSED";
        const newStatus=isDone?"OPEN":"CLOSED";
        detailToggle.disabled=true;
        if(!isDone && requireProof){
          const ok=await openProof(task);
          if(!ok){ detailToggle.disabled=false; return; }
        }
        try {
          const res=await fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({status:newStatus})});
          if(!res.ok) throw new Error(`HTTP ${res.status}`);
          task.status=newStatus;
          task.updateDate=new Date().toISOString(); // keep calendar's completed-date fallback fresh
          // Always record the completed/reopened status comment — the calendar and the
          // Manager activity feed read it for the completion timestamp. (Reassignment
          // logging stays gated behind Detailed Activity Logging.)
          await fetchUsers(); postEditComment(task, statusAction(task,newStatus,!isDone&&requireProof));
          renderDetailContent(task);
          const cardEl=listWrap.querySelector(`[data-task-id="${task.id}"]`) as HTMLElement|null;
          if(cardEl){if(!isDone)cardEl.classList.add("done");else cardEl.classList.remove("done");}
          setTimeout(()=>{if(!auditMode){renderTypeFilters();renderList();}else renderList();},380);
        } catch(e:any){showBanner("error",`Could not update: ${e.message}`);}
        detailToggle.disabled=false;
      });

      // ── Sparkle burst ─────────────────────────────────────────────────
      function spawnSparks(wrap:HTMLElement,color:string){
        [0,45,90,135,180,225,270,315].forEach(deg=>{
          const spark=document.createElement("div");
          spark.className=`${p}-spark`;
          const rad=(deg*Math.PI)/180;
          const dist=14+Math.random()*8;
          spark.style.cssText=`background:${color};left:50%;top:50%;margin:-2.5px;--tx:${Math.cos(rad)*dist}px;--ty:${Math.sin(rad)*dist}px;`;
          wrap.appendChild(spark);
          spark.addEventListener("animationend",()=>spark.remove());
        });
      }

      // ── Toggle task status ────────────────────────────────────────────
      async function toggleTask(checkEl:HTMLElement){
        const taskId=checkEl.dataset.taskId!;
        const installId=checkEl.dataset.installId!;
        const currentStatus=checkEl.dataset.status!;
        const isDone=currentStatus==="DONE"||currentStatus==="done"||currentStatus==="CLOSED";
        const newStatus=isDone?"OPEN":"CLOSED";
        const cardEl=checkEl.closest(`.${p}-card`) as HTMLElement|null;
        const wrap=checkEl.closest(`.${p}-check-wrap`) as HTMLElement|null;

        if(!isDone && requireProof){
          const t=allTasks.find(x=>x.id===taskId);
          if(t){
            checkEl.style.pointerEvents="none";
            const ok=await openProof(t);
            checkEl.style.pointerEvents="";
            if(!ok) return;
          }
        }

        checkEl.style.pointerEvents="none";
        checkEl.classList.remove("pop-done","pop-undone");
        void checkEl.offsetWidth;
        checkEl.classList.add(isDone?"pop-undone":"pop-done");
        if(!isDone){checkEl.classList.add("checked");if(cardEl)cardEl.classList.add("done");if(wrap)spawnSparks(wrap,primaryColor);}
        else{checkEl.classList.remove("checked");if(cardEl)cardEl.classList.remove("done");}

        try {
          const res=await fetch(`${baseUrl}/tasks/${installId}/task/${taskId}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({status:newStatus})});
          if(!res.ok) throw new Error(`HTTP ${res.status}`);
          const task=allTasks.find(t=>t.id===taskId);
          if(task){ task.status=newStatus; task.updateDate=new Date().toISOString(); await fetchUsers(); postEditComment(task, statusAction(task,newStatus,!isDone&&requireProof)); }
          setTimeout(()=>{if(!auditMode){renderTypeFilters();renderList();}else renderList();},420);
        } catch(e:any){
          if(!isDone){checkEl.classList.remove("checked");if(cardEl)cardEl.classList.remove("done");}
          else{checkEl.classList.add("checked");if(cardEl)cardEl.classList.add("done");}
          showBanner("error",`Could not update task: ${e.message}`);
          checkEl.style.pointerEvents="";
        }
      }

      // ── Status filter ─────────────────────────────────────────────────
      if(!auditMode){
        container.querySelectorAll(`.${p}-status-opt`).forEach((btn: Element)=>{
          btn.addEventListener("click",()=>{
            container.querySelectorAll(`.${p}-status-opt`).forEach((b: Element)=>b.classList.remove("active"));
            btn.classList.add("active");
            activeStatusFilter=(btn as HTMLElement).dataset.status||"open";
            renderList();
          });
        });
      }

      // ── View toggle (List | Calendar) ─────────────────────────────────
      const listFiltersEl = container.querySelector(`#${p}-list-filters`) as HTMLElement|null;
      if(showCalendar && !auditMode){
        // The list-only filters (type + status) don't apply to the calendar.
        const syncFilters=()=>{ if(listFiltersEl) listFiltersEl.style.display = view==="calendar"?"none":"flex"; };
        syncFilters();
        container.querySelectorAll(`.${p}-view-opt`).forEach((btn: Element)=>{
          btn.addEventListener("click",()=>{
            const v=(btn as HTMLElement).dataset.view==="calendar"?"calendar":"list";
            if(v===view) return;
            view=v;
            container.querySelectorAll(`.${p}-view-opt`).forEach((b: Element)=>b.classList.toggle("active",(b as HTMLElement).dataset.view===view));
            syncFilters();
            renderList();
          });
        });
      }

      // ── Locale resolution ─────────────────────────────────────────────
      // Resolve the viewer's locale (once), rebind `t`, set text direction,
      // and refresh the static header/filter labels that were painted in the
      // default locale. List/detail/create content re-reads `t` at render
      // time, so it picks up the new locale automatically.
      let localeApplied = false;
      async function applyLocale(){
        if(localeApplied) return;
        localeApplied = true;
        const available = Object.keys(STRINGS);
        let configLocale = "";
        try{
          if(currentUserId){
            const r = await fetch(`${baseUrl}/users/${currentUserId}`, apiOpts());
            if(r.ok){ const u = await r.json(); configLocale = (u?.config?.locale)||""; }
          }
        } catch(e:any){ dlog("locale fetch failed", e?.message||String(e)); }
        locale = detectLocale({ configLocale, available });
        tr = makeT(STRINGS, locale);
        const rtl = isRtl(locale);
        dlog("locale", locale, "configLocale", configLocale||"(none)", "rtl", rtl);

        // Text direction on the widget root and on the body-attached panels
        // (overlay/detail/attachment modal live outside `container`, so they
        // don't inherit its dir).
        const dir = rtl?"rtl":"ltr";
        try{ container.setAttribute("dir", dir); }catch(_){}
        try{ overlayEl?.setAttribute("dir", dir); }catch(_){}
        try{ detailEl?.setAttribute("dir", dir); }catch(_){}
        try{ attModal?.setAttribute("dir", dir); }catch(_){}

        // Refresh static labels painted before the locale was known.
        const setText=(id:string,val:string)=>{const el=container.querySelector(`#${id}`); if(el) el.textContent=val;};
        const setAttr=(id:string,attr:string,val:string)=>{const el=container.querySelector(`#${id}`); if(el) el.setAttribute(attr,val);};
        setText(`${p}-title-text`, auditMode?tr("auditResults"):tr("myTasks"));
        setText(`${p}-new-label`, tr("newTask"));
        setAttr(`${p}-new`,"title",tr("newTask"));
        setAttr(`${p}-refresh`,"title",tr("refresh"));
        setText(`${p}-audit-tab-label`, tr("auditHistory"));
        setAttr(`${p}-audit-prev`,"aria-label",tr("scrollLeft"));
        setAttr(`${p}-audit-next`,"aria-label",tr("scrollRight"));
        setText(`${p}-type-label`, tr("allTypes"));
        const st=(s:string,v:string)=>{const el=container.querySelector(`.${p}-status-opt[data-status="${s}"]`); if(el) el.textContent=v;};
        st("open",tr("open")); st("done",tr("done")); st("all",tr("both"));

        // Translate button: only meaningful when the viewer isn't on en_US.
        const trBtn=container.querySelector(`#${p}-translate`) as HTMLElement|null;
        if(trBtn){
          if(locale!==DEFAULT_LOCALE){ trBtn.style.display=""; updateTranslateBtn(); trBtn.addEventListener("click",toggleTranslate); }
          else trBtn.style.display="none";
        }
      }

      // ── On-demand content translation ─────────────────────────────────
      // One batched POST to /api/translations via the logged-in user's session
      // (same auth path as comments). Source = branch default (en_US).
      async function translateSend(payload:string):Promise<string>{
        const r=await fetch(`${baseUrl}/translations`, sessionOpts({
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sourceLanguage:DEFAULT_LOCALE, targetLanguage:locale, contents:{value:payload}}),
        }));
        if(!r.ok) throw new Error("translate "+r.status);
        const d=await r.json();
        return d?.contents?.value||"";
      }
      function updateTranslateBtn(){
        const lbl=container.querySelector(`#${p}-translate-lbl`); if(lbl) lbl.textContent=translateBusy?tr("translating"):contentTranslated?tr("showOriginal"):tr("translateBtn");
      }
      async function toggleTranslate(){
        if(translateBusy) return;
        if(!contentTranslated){
          const texts:string[]=[];
          for(const t of allTasks){
            if(t.title) texts.push(t.title);
            if(t.taskType) texts.push(t.taskType);
            const cd=t.description?stripTypeTag(t.description).trim():"";
            if(cd){
              texts.push(cd);
              // Audit findings render a parsed subset (af.finding) rather than the
              // raw cleaned description, so collect that string too.
              try{ const af=parseAuditFinding(cd); if(af&&af.finding) texts.push(af.finding); }catch(_){}
            }
          }
          if(texts.length){
            translateBusy=true; updateTranslateBtn();
            const map=await translateMap(texts, translateSend);
            Object.assign(ctCache, map); translateBusy=false;
          }
          contentTranslated=true;
        } else { contentTranslated=false; }
        updateTranslateBtn();
        renderList();
        if(detailTask) renderDetailContent(detailTask);
      }

      // Load the tasks-plugin installations ("stores") this viewer may see.
      // Two sources, merged + deduped: the classic /installations list (which
      // Panda relies on) plus the tasks-plugin search — the only place that
      // surfaces access-restricted stores — then filtered to the viewer's own
      // access. NOTE: this access check is client-side only; see HANDOVER.md.
      async function fetchTaskStores():Promise<Array<{id:string;title:string}>>{
        let viewerId=""; let viewerGroups:string[]=[];
        try{
          const prof:any=await widgetApi.getUserInformation();
          viewerId=prof.id||""; viewerGroups=prof.groupIDs||[];
        }catch(_){}

        const titleOf=(i:any)=>i.config?.localization?.en_US?.title||i.title||i.name||i.id;
        const byId=new Map<string,{id:string;title:string;accessors:any}>();

        // ① /installations — unchanged source; keeps existing behaviour intact.
        try{
          const res=await fetch(`${baseUrl}/installations?limit=200`,apiOpts());
          if(res.ok){
            const d:any=await res.json();
            for(const i of (d.data||d))
              if(i.pluginID==="tasks"||i.pluginId==="tasks")
                byId.set(i.id,{id:i.id,title:titleOf(i),accessors:i.accessors??null});
          }
        }catch(_){}

        // ② tasks-plugin search — surfaces access-restricted stores that never
        // appear in ①. Best-effort: on failure we keep ① (no regression).
        try{
          const res=await fetch(`${baseUrl}/plugins/tasks/installations/search?permission=manage&limit=200&sort=updated_DESC`,apiOpts());
          if(res.ok){
            const d:any=await res.json();
            for(const e of (d.entries||[])){
              const i=e.data||e;
              if(!byId.has(i.id)) byId.set(i.id,{id:i.id,title:titleOf(i),accessors:i.accessors??null});
            }
          }
        }catch(_){}

        // Access filter: show a store only if it's branch-open, unrestricted,
        // or names this viewer's id / one of their groups.
        const canSee=(a:any)=>{
          if(!a) return true;
          if(a.branchAccess===true) return true;
          const hasU=Array.isArray(a.userIds)&&a.userIds.length;
          const hasG=Array.isArray(a.groupIds)&&a.groupIds.length;
          if(!hasU&&!hasG) return true;
          return (hasU&&!!viewerId&&a.userIds.includes(viewerId))||
                 (hasG&&a.groupIds.some((g:string)=>viewerGroups.includes(g)));
        };

        return [...byId.values()].filter(s=>canSee(s.accessors))
          .map(s=>({id:s.id,title:s.title}))
          .sort((a,b)=>a.title.localeCompare(b.title));
      }

      // ── Load data ─────────────────────────────────────────────────────
      async function load(){
        refreshBtn.disabled=true;
        refreshBtn.innerHTML=`<span class="${p}-spin" style="width:14px;height:14px;border-width:2px"></span>`;
        hideBanner();
        allTasks=[]; recurTemplates=[]; auditLists=[]; activeAuditListId="";
        completionDates.clear(); completionDatesLoaded=false;
        activeInstallFilter="all"; activeTypeFilters.clear(); dropdownOpen=false;
        listWrap.innerHTML=`<div class="${p}-state"><span class="${p}-spin" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px;display:block"></span>${tr("loading")}</div>`;

        try {
          // Fetch installations ("stores") — merged + access-filtered (see fetchTaskStores)
          const installations=await fetchTaskStores();
          allInstalls=installations;  // expose for task creation

          if(!installations.length){
            listWrap.innerHTML=`<div class="${p}-state"><strong>${tr("noTaskSpaces")}</strong>${tr("noTaskSpacesHint")}</div>`;
            return;
          }

          // Fetch current user (always — needed for "other tasks" split in audit mode)
          try{
            const profile=await widgetApi.getUserInformation();
            currentUserId=(profile as any).id||"";
            userGroupIds=(profile as any).groupIDs||[];
            dlog("user",currentUserId,"groups",userGroupIds.length);
          } catch(e:any){ dlog("getUserInformation failed",e?.message||String(e)); }

          // Detect the viewer's locale and bind the translation fn.
          // getUserInformation() does NOT carry locale (verified), so we read
          // config.locale from GET /api/users/{id} — the only field that
          // reflects the user's Staffbase language. navigator.language is the
          // fallback. Available locales come from the branch.
          await applyLocale();

          // Fetch groups → build groupMap (search endpoint + /groups supplement)
          try{
            const [searchRes, legacyRes] = await Promise.all([
              fetch(`${baseUrl}/groups/search?limit=100&sort=name_ASC`,apiOpts()),
              fetch(`${baseUrl}/groups?limit=200`,apiOpts()),
            ]);
            const seen=new Set<string>();
            if(searchRes.ok){
              const d=await searchRes.json();
              const parseEntry=(e:any)=>{const inner=e.data||e;return{id:inner.id,name:inner.config?.localization?.en_US?.name||inner.config?.localization?.en_US?.title||inner.name||inner.id};};
              for(const e of (d.entries||d.data||d.results||d.items||(Array.isArray(d)?d:[]))){
                const{id,name}=parseEntry(e);
                if(id&&name&&!seen.has(id)){groupMap.set(id,name);seen.add(id);}
              }
            }
            if(legacyRes.ok){
              const gd=await legacyRes.json();
              for(const g of (gd.data||[])){
                const name=g.config?.localization?.en_US?.title||g.config?.localization?.en_US?.name||g.name||g.id;
                if(g.id&&name&&!seen.has(g.id)){groupMap.set(g.id,name);seen.add(g.id);}
              }
            }
          } catch(_){}

          // Fetch tasks per installation
          for(const inst of installations){
            try{
              const listRes=await fetch(`${baseUrl}/tasks/${inst.id}/lists`,apiOpts());
              const listMap=new Map<string,string>(); const listIds:string[]=[];
              if(listRes.ok){
                const listsRaw:any=await listRes.json();
                const lists:any[]=Array.isArray(listsRaw)?listsRaw:(listsRaw.data||[]);
                for(const l of lists){listMap.set(l.id,l.name||"");if(l.id)listIds.push(l.id);}
                listsByInst.set(inst.id, lists.map((l:any)=>({id:l.id,name:l.name||l.id})));
              }

              const perList=await Promise.all(listIds.map(lid=>
                fetch(`${baseUrl}/tasks/${inst.id}/task?listId=${lid}`,apiOpts())
                  .then(r=>r.ok?r.json():null).catch(()=>null)
              ));

              const seen=new Set<string>();
              for(const result of perList){
                if(!result) continue;
                const arr:any[]=Array.isArray(result)?result:(result.data||[]);
                for(const t of arr){
                  if(!t.id||seen.has(t.id)) continue;
                  if(!showAll&&currentUserId&&!auditMode){
                    // In normal mode: only include tasks assigned to current user/groups
                    const assigneeIds:string[]=t.assigneeIds||[];
                    const taskGroupIds:string[]=t.groupIds||[];
                    const taskType_=parseTaskType(t.title||"")||parseTaskType(t.description||"");
                    if(taskType_!=="audit-result"){
                      const directMatch=assigneeIds.indexOf(currentUserId)!==-1;
                      const groupMatch=taskGroupIds.some((gid:string)=>userGroupIds.indexOf(gid)!==-1);
                      if(!directMatch&&!groupMatch) continue;
                    }
                  }
                  // In auditMode: always load all tasks — "mine" vs "other" split happens at render time
                  seen.add(t.id);
                  const desc=t.description||"";
                  const lname=t.taskListId?(listMap.get(t.taskListId)||""):"";
                  let taskType=parseTaskType(t.title||"")||parseTaskType(desc);
                  // Recurring-task templates are hidden system tasks — never show them
                  // in the list. When the calendar's upcoming-recurring option is on,
                  // keep them aside so we can plot their future occurrences (dashed).
                  if(taskType==="recur-template"){
                    seen.delete(t.id);
                    if(showCalendar && showUpcomingRecurring){
                      recurTemplates.push({
                        id:t.id, title:t.title||"(no title)", description:desc,
                        status:t.status||"OPEN", priority:t.priority||"Priority_3",
                        dueDate:t.dueDate||null, taskType,
                        installationId:inst.id, installationTitle:inst.title,
                        listId:t.taskListId||"", listName:lname,
                        groupIds:t.groupIds||[], assigneeIds:t.assigneeIds||[],
                        attachmentIds:t.attachmentIds||[],
                        createDate:t.createDate||undefined, updateDate:t.updateDate||undefined,
                      });
                    }
                    continue;
                  }
                  // Audit-generated tasks have no [type] tag — surface them as an
                  // "Audit" type so they're filterable in the normal (non-audit) view.
                  if(!taskType && (/^\s*Audit finding:/i.test(desc) || /^\s*Audit\s*[—–-]/i.test(lname))) taskType="Audit";
                  const sevM=desc.match(/(?:^|\n)\s*Severity:\s*([A-Za-z]+)/i);
                  // Recurring tasks stamped [lvl: critical] surface as Critical (same badge as audit criticals).
                  const lvlM=desc.match(LVL_REGEX);
                  const lvlCritical=!!lvlM && lvlM[1].trim().toLowerCase()==="critical";
                  allTasks.push({
                    id:t.id, title:t.title||"(no title)", description:desc,
                    status:t.status||"OPEN", priority:t.priority||"Priority_3",
                    dueDate:t.dueDate||null, taskType,
                    installationId:inst.id, installationTitle:inst.title,
                    listId:t.taskListId||"",
                    listName:lname,
                    groupIds:t.groupIds||[], assigneeIds:t.assigneeIds||[],
                    attachmentIds:t.attachmentIds||[],
                    auditSeverity:lvlCritical?"Critical":(sevM?sevM[1]:undefined),
                    isRecurring:RECUR_REGEX.test(desc),
                    createDate:t.createDate||undefined, updateDate:t.updateDate||undefined,
                  });
                }
              }
            } catch(_){}
          }

          // Sort: open first, then by due date
          allTasks.sort((a,b)=>{
            const aDone=a.status==="DONE"||a.status==="done"||a.status==="CLOSED";
            const bDone=b.status==="DONE"||b.status==="done"||b.status==="CLOSED";
            if(aDone!==bDone) return aDone?1:-1;
            if(a.dueDate&&b.dueDate) return new Date(a.dueDate).getTime()-new Date(b.dueDate).getTime();
            if(a.dueDate) return -1; if(b.dueDate) return 1;
            return 0;
          });

          // Register distinct types (sorted) so each gets a stable palette color, no repeats until exhausted.
          TYPE_ORDER = Array.from(new Set(allTasks.map(t=>t.taskType).filter((x): x is string => !!x))).sort();

          // Identify audit lists (lists containing an audit-result system task)
          const auditListIds=new Map<string,Task>(); // listId → system task
          for(const t of allTasks){
            if(t.taskType==="audit-result"&&t.listId&&!auditListIds.has(t.listId)){
              auditListIds.set(t.listId,t);
            }
          }
          // Build AuditList entries
          for(const[listId,sysTask] of auditListIds){
            let parsedAudit:any=null;
            try{
              const desc=sysTask.description||"";
              const jsonStart=desc.indexOf("{");
              if(jsonStart>=0) parsedAudit=JSON.parse(desc.slice(jsonStart));
            } catch(_){}
            auditLists.push({
              listId, listName:sysTask.listName,
              installId:sysTask.installationId, instTitle:sysTask.installationTitle,
              systemTask:sysTask, parsedAudit,
            });
          }
          // Sort audits newest first — parse the datetime out of the list name
          // ("Audit — May 8, 2026 3:19 PM"); the name carries the time, so it
          // disambiguates same-day audits that parsedAudit.date (day-only) cannot.
          const auditTime=(al:AuditList):number=>{
            const fromName=Date.parse(al.listName.replace(/^Audit\s*—\s*/i,"").trim());
            if(!isNaN(fromName)) return fromName;
            const fromJson=al.parsedAudit?.date?Date.parse(al.parsedAudit.date):NaN;
            return isNaN(fromJson)?0:fromJson;
          };
          auditLists.sort((a,b)=>auditTime(b)-auditTime(a));
          if(auditLists.length>0) activeAuditListId=auditLists[0].listId;

          if(auditMode){
            renderStoreTabs(); // store pills based on audit installs
            renderAuditTabs();
            renderList();
          } else {
            renderStoreTabs(); renderTypeFilters(); renderList();
            if(allTasks.filter(t=>t.taskType!=="audit-result").length===0){
              showBanner("info","No tasks found. Your manager can enable \"Show All Tasks\" to see all store tasks.");
            }
          }
        } catch(e:any){
          listWrap.innerHTML=`<div class="${p}-state"><strong>${tr("failedToLoad")}</strong>${esc(e.message)}</div>`;
        }

        refreshBtn.disabled=false;
        refreshBtn.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
      }

      refreshBtn.addEventListener("click",load);

      // ── Create task sheet ─────────────────────────────────────────────────
      if(allowCreate && !auditMode){
        const newBtn=container.querySelector(`#${p}-new`) as HTMLButtonElement|null;
        let createEl:HTMLElement|null=null;
        const closeCreate=()=>{ if(!createEl) return; createEl.classList.remove("open"); overlayEl.classList.remove("open"); };
        const openCreate=()=>{
          if(!allInstalls.length){ showBanner("error","No task spaces available yet — try Refresh."); return; }
          if(!createEl){
            createEl=document.createElement("div");
            createEl.className=`${p}-create`;
            createEl.dataset.sbPortal=instId;
            document.body.appendChild(createEl);
            self._mtwCreate=createEl;
          }
          const instOpts=allInstalls.map(i=>`<option value="${esc(i.id)}">${esc(i.title)}</option>`).join("");
          const firstInst=allInstalls[0].id;
          const listOpts=(id:string)=>(listsByInst.get(id)||[]).map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join("");
          const existingTypes=[...new Set(allTasks.filter(t=>t.taskType&&t.taskType!=="audit-result").map(t=>t.taskType as string))].sort();
          const typeOpts=existingTypes.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
          createEl.innerHTML=`
            <div class="${p}-create-head"><h3>${tr("newTaskHeading")}</h3>
              <button type="button" class="${p}-create-close" id="${p}-c-x"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div class="${p}-create-body">
              <div class="${p}-fld"><label>${tr("title")}</label><input class="${p}-in" id="${p}-c-title" placeholder="${tr("titlePlaceholder")}"></div>
              <div class="${p}-fld"><label>${tr("description")}</label><textarea class="${p}-in" id="${p}-c-desc" placeholder="${tr("descriptionPlaceholder")}"></textarea></div>
              ${allInstalls.length>1?`<div class="${p}-fld"><label>${esc(storeSingular)}</label><select class="${p}-sel" id="${p}-c-inst">${instOpts}</select></div>`:`<input type="hidden" id="${p}-c-inst" value="${esc(firstInst)}">`}
              <div class="${p}-fld"><label>${tr("list")}</label><select class="${p}-sel" id="${p}-c-list">${listOpts(firstInst)}</select></div>
              <div class="${p}-fld"><label>${tr("type")}</label>
                <select class="${p}-sel" id="${p}-c-type">
                  <option value="">${tr("noType")}</option>
                  ${typeOpts}
                  <option value="__new__">${tr("createNewType")}</option>
                </select>
                <input class="${p}-in" id="${p}-c-type-new" placeholder="${tr("newTypePlaceholder")}" style="display:none;margin-top:8px">
              </div>
              <div class="${p}-fld-row">
                <div class="${p}-fld"><label>${tr("dueDate")}</label><input type="date" class="${p}-in" id="${p}-c-due"></div>
                <div class="${p}-fld"><label>${tr("priority")}</label><select class="${p}-sel" id="${p}-c-prio"><option value="Priority_3">${tr("normal")}</option><option value="Priority_2">${tr("medium")}</option><option value="Priority_1">${tr("high")}</option><option value="critical">${tr("critical")}</option></select></div>
              </div>
            </div>
            <div class="${p}-create-foot">
              <button type="button" class="${p}-btn-cancel" id="${p}-c-cancel">${tr("cancel")}</button>
              <button type="button" class="${p}-btn-save" id="${p}-c-save">${tr("createTask")}</button>
            </div>`;
          const $=(id:string)=>createEl!.querySelector(`#${p}-${id}`) as any;
          const instSel=$("c-inst"); const listSel=$("c-list");
          if(instSel&&instSel.tagName==="SELECT"){
            instSel.addEventListener("change",()=>{ listSel.innerHTML=listOpts(instSel.value); });
          }
          const typeSel=$("c-type"); const typeNew=$("c-type-new");
          typeSel.addEventListener("change",()=>{
            const isNew=typeSel.value==="__new__";
            typeNew.style.display=isNew?"block":"none";
            if(isNew) typeNew.focus();
          });
          $("c-x").addEventListener("click",closeCreate);
          $("c-cancel").addEventListener("click",closeCreate);
          $("c-save").addEventListener("click",async()=>{
            const title=($("c-title").value||"").trim();
            if(!title){ $("c-title").focus(); return; }
            const instId2=$("c-inst").value;
            const listId=listSel.value;
            if(!listId){ showBanner("error","That space has no list to add the task to."); return; }
            const desc=($("c-desc").value||"").trim();
            const taskType=(typeSel.value==="__new__"?(typeNew.value||""):typeSel.value).trim();
            // Embed the type as a [type: X] tag in the description — same convention
            // the tasks-integration-widget uses and parseTaskType() reads on load.
            let finalDesc=desc;
            if(taskType) finalDesc=finalDesc?`${finalDesc} [type: ${taskType}]`:`[type: ${taskType}]`;
            const due=$("c-due").value; // yyyy-mm-dd
            // "Critical" isn't a Staffbase priority — map it to Priority_1 and stamp [lvl: critical]
            // (same convention the recurring runner uses) so it round-trips as Critical, not High.
            const prioVal=$("c-prio").value||"Priority_3";
            const isCritical=prioVal==="critical";
            const prio=isCritical?"Priority_1":prioVal;
            if(isCritical) finalDesc=finalDesc?`${finalDesc} [lvl: critical]`:`[lvl: critical]`;
            const saveBtn=$("c-save") as HTMLButtonElement;
            saveBtn.disabled=true; saveBtn.textContent=tr("creating");
            try{
              const body:Record<string,unknown>={ title, status:"OPEN", priority:prio, taskListId:listId };
              if(finalDesc) body.description=finalDesc;
              if(due) body.dueDate=`${due}T00:00:00.000Z`;
              const r=await fetch(`${baseUrl}/tasks/${instId2}/task`,{method:"POST",...apiOpts(),body:JSON.stringify(body)});
              if(!r.ok) throw new Error(`HTTP ${r.status}`);
              closeCreate(); hideBanner(); await load();
            }catch(e:any){ showBanner("error",`${tr("createFailedPrefix")} ${e.message}`); saveBtn.disabled=false; saveBtn.textContent=tr("createTask"); }
          });
          // Side panel on desktop, bottom sheet on mobile (matches detail panel).
          createEl.classList.toggle("side", window.innerWidth>=720);
          overlayEl.classList.add("open");
          void createEl.offsetWidth; // commit the closed (centered) state so the first open animates from it, not from the bottom
          requestAnimationFrame(()=>createEl!.classList.add("open"));
          ($("c-title") as HTMLInputElement)?.focus();
        };
        newBtn?.addEventListener("click",openCreate);
        overlayEl.addEventListener("click",closeCreate);
      }

      load();
    }

    disconnectedCallback() {
      const self: any = this;
      if (self._mtwOverlay)  { self._mtwOverlay.remove();  self._mtwOverlay  = undefined; }
      if (self._mtwDetail)   { self._mtwDetail.remove();   self._mtwDetail   = undefined; }
      if (self._mtwAModal)   { self._mtwAModal.remove();   self._mtwAModal   = undefined; }
      if (self._mtwProof)    { self._mtwProof.remove();    self._mtwProof    = undefined; }
      if (self._mtwCreate)   { self._mtwCreate.remove();   self._mtwCreate   = undefined; }
      if (self._mtwDocClick) { document.removeEventListener("click",   self._mtwDocClick); self._mtwDocClick = undefined; }
      if (self._mtwDocKey)   { document.removeEventListener("keydown", self._mtwDocKey);   self._mtwDocKey   = undefined; }
      if (self._mtwVV && (window as any).visualViewport) {
        (window as any).visualViewport.removeEventListener("resize", self._mtwVV);
        (window as any).visualViewport.removeEventListener("scroll", self._mtwVV);
        self._mtwVV = undefined;
      }
      if (self._mtwCalResize) { window.removeEventListener("resize", self._mtwCalResize); self._mtwCalResize = undefined; }
    }

    static get observedAttributes(){
      return ["apitoken","baseurl","usethemecolors","primarycolor","accentcolor","backgroundcolor","storelabelsingular","storelabelplural","typecolors","showalltasks","showdonetasks","auditmode","enablecomments","allowtaskcreation","allowtaskassignment","notifyonassign","detailedlogging","debugmode","limitheight","maxheight","showcalendar","showupcomingrecurring"];
    }
  };
};

// ── Block registration ────────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name:"my-tasks-widget", label:"My Tasks Widget",
  attributes:["apitoken","baseurl","usethemecolors","primarycolor","accentcolor","backgroundcolor","storelabelsingular","storelabelplural","typecolors","showalltasks","showdonetasks","auditmode","enablecomments","requirephotoproof","allowtaskcreation","allowtaskassignment","notifyonassign","detailedlogging","debugmode","limitheight","maxheight","showcalendar","showupcomingrecurring"],
  factory, configurationSchema, uiSchema, blockLevel:"block", iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzBFQTVFOSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzLjUgNDMuNSkgc2NhbGUoMy41KSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0ibTMgMTcgMiAyIDQtNCIvPjxwYXRoIGQ9Im0zIDcgMiAyIDQtNCIvPjxwYXRoIGQ9Ik0xMyA2aDgiLz48cGF0aCBkPSJNMTMgMTJoOCIvPjxwYXRoIGQ9Ik0xMyAxOGg4Ii8+PC9nPjwvc3ZnPg==",
};

window.defineBlock({ blockDefinition, author:"Staffbase", version:"1.0.0" } as ExternalBlockDefinition);
