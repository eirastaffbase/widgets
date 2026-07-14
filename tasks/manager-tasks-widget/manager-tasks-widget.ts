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
    teamsource:         { type:"string",  title:"Team Members", default:"reports",
                          oneOf:[
                            { const:"reports",  title:"My direct reports (from the org hierarchy)" },
                            { const:"userids",  title:"Specific user IDs" },
                            { const:"everyone", title:"Everyone with tasks" },
                          ] },
    teamuserids:        { type:"string",  title:"Team User IDs",            default: "" },
    showcharts:         { type:"boolean", title:"Show Dashboard Charts",    default: true },
    notifyonassign:     { type:"boolean", title:"Notify on Assignment",     default: true },
    showdonetasks:      { type:"boolean", title:"Include Completed Tasks",  default: true },
    enablecomments:     { type:"boolean", title:"Enable Comments (experimental)", default: false },
    enableproofreview:  { type:"boolean", title:"Enable Photo Proof Review", default: false },
    allowtaskcreation:  { type:"boolean", title:"Allow Task Creation", default: true },
    allowtaskassignment:{ type:"boolean", title:"Allow Task Reassignment", default: false },
    debugmode:          { type:"boolean", title:"Debug Mode (on-screen logs)", default: false },
    limitheight:        { type:"boolean", title:"Limit Height",                default: false },
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
  teamsource:         { "ui:help":"Who appears in the team-member dropdown. “My direct reports” = users whose manager field points to the viewer; “Specific user IDs” uses the list below; “Everyone with tasks” lists every assignee found across the stores." },
  teamuserids:        { "ui:help":"Comma- or space-separated Staffbase user IDs. Only used when Team Members = “Specific user IDs”." },
  showcharts:         { "ui:help":"Show the completion / overdue / per-member dashboard above the task list" },
  notifyonassign:     { "ui:help":"Send a Staffbase notification (“You were assigned a new task”) to people newly assigned a task via this widget" },
  showdonetasks:      { "ui:help":"When enabled, completed tasks are included in the view" },
  enablecomments:     { "ui:help":"Experimental: show a comments section in the task detail panel (uses the logged-in user's session)" },
  enableproofreview:  { "ui:help":"Adds a Proof Review tab for browsing photo proof submitted on tasks. Even when off, any task that has photo proof shows a Proof section in its detail panel." },
  allowtaskcreation:  { "ui:help":"Show a “New Task” button so managers can create and assign tasks from this widget" },
  allowtaskassignment:{ "ui:help":"Allow reassigning a task (to people and/or groups) from its detail panel" },
  debugmode:          { "ui:help":"Show an on-screen log panel with a copy button — useful for debugging inside the mobile app" },
  limitheight:        { "ui:help":"Cap the widget's height — anything taller scrolls inside a styled scrollbar" },
  maxheight:          { "ui:help":"Maximum height in pixels (e.g. 600). You can also include a CSS unit like 600px or 70vh." },
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
    .replace(/\s{2,}/g," ")
    .trim();
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
  return class ManagerTasksWidget extends BaseBlockClass implements BaseBlock {
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
      const showDone     = this.getAttribute("showdonetasks")      !== "false";
      // ── Manager-view config ───────────────────────────────────────────
      const teamSource   = (this.getAttribute("teamsource") || "reports") as "reports"|"userids"|"everyone";
      const teamUserIds  = (this.getAttribute("teamuserids") || "").split(/[\s,]+/).map(s=>s.trim()).filter(Boolean);
      const showCharts   = this.getAttribute("showcharts")         !== "false";
      const notifyOnAssign = this.getAttribute("notifyonassign")   !== "false";
      const enableComments = this.getAttribute("enablecomments")   === "true";
      const enableProofReview = this.getAttribute("enableproofreview") === "true";
      const allowCreate    = this.getAttribute("allowtaskcreation") === "true";
      const allowAssign    = this.getAttribute("allowtaskassignment") === "true";
      const storeSingular  = this.getAttribute("storelabelsingular") || "Store";
      const debugMode      = this.getAttribute("debugmode")        === "true";

      const primaryRgb  = hexToRgb(primaryColor);
      const accentRgb = hexToRgb(accentColor);
      const primaryText = contrastColor(primaryColor);
      const p = "mgr";

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
        createDate?: string; updateDate?: string;        // for the activity feed
        creatorId?: string; creatorType?: string;
      };

      let allTasks: Task[]           = [];
      // True once an initial/refresh load has finished populating allTasks. The
      // proof gallery waits on this so opening the tab mid-load shows a loader and
      // then builds correctly, instead of caching an empty proof set forever.
      let tasksLoaded                = false;
      let loadWaiters: Array<()=>void> = [];
      function whenTasksLoaded():Promise<void>{
        if(tasksLoaded) return Promise.resolve();
        return new Promise<void>(res=>loadWaiters.push(res));
      }
      let recurTemplates: Task[]     = []; // hidden [recur-template] tasks → activity feed only
      const activityComments         = new Map<string, any[]>(); // taskId → comments (activity feed)
      let activityCommentsLoaded     = false;
      const EDIT_MARK                = "[tasks:edit]"; // hidden audit-comment marker
      let activeTypeFilters          = new Set<string>();
      let activeStatusFilter         = "open";
      let activeInstallFilter        = "all";
      // ── Manager filters / sort ─────────────────────────────────────────
      const prioritySet              = new Set<string>(); // empty = all priorities
      let overdueOnly                = false;
      let sortBy                     = "due";    // due | priority | assignee | created
      let searchQuery                = "";       // free-text filter (task title/description)
      let assignedFrom               = (()=>{ const d=new Date(Date.now()-30*864e5); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${d.getFullYear()}-${m}-${day}`; })(); // default: last 30 days
      let assignedTo                 = "";       // YYYY-MM-DD
      let membersExpanded            = false;    // "By team member" show-all toggle
      // ── Activity feed paging ───────────────────────────────────────────
      // Dashboard shows ACT_RECENT; "View more" opens a full-page log that loads
      // ACT_FULL, then grows by ACT_STEP on infinite scroll.
      const ACT_RECENT               = 10;
      const ACT_FULL                 = 200;
      const ACT_STEP                 = 100;
      let activityFull               = false;    // full-page activity log open?
      let activityLimit              = ACT_RECENT;// events currently shown
      let activityLoadingMore        = false;    // infinite-scroll fetch in flight
      // Full-log-only filters (independent of the dashboard store tabs / team
      // filter, so filtering the log doesn't disturb the dashboard). Seeded from
      // the globals each time the log opens.
      let activityInstallFilter      = "all";
      const activityMembers          = new Set<string>();
      const activityTypeFilters      = new Set<string>(); // event type filter (full log)
      const activityPriorities       = new Set<string>(); // priority filter (full log)
      let activityFrom               = "";                // event-date range (full log)
      let activityTo                 = "";
      const actHiddenSiblings: Array<[HTMLElement,string]> = []; // restore on exit
      let introUsed                  = false; // staggered entrance only on first list render
      let currentUserId              = "";
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
      // ── Manager-view state ─────────────────────────────────────────────
      // teamMembers drives the filter dropdown; selectedMembers empty = "all".
      let teamMembers: Array<{id:string;name:string;avatar:string}> = [];
      const teamMemberSet            = new Set<string>();
      const selectedMembers          = new Set<string>(); // empty = all team members
      let teamNote                   = "";   // e.g. "no direct reports found"
      let allUsersRaw: any[] | null  = null; // full /users objects (profile, avatar)

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
          /* ── Photo proof review ── */
          .${p}-vtabs{display:flex;gap:4px;margin-bottom:14px;background:#f3f4f6;border-radius:var(--r-md);padding:3px}
          .${p}-vtab{flex:1;padding:8px 12px;border:none;border-radius:calc(var(--r-md) - 3px);background:transparent;font-family:inherit;font-size:13px;font-weight:700;color:var(--gray);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s}
          .${p}-vtab:hover{color:var(--dark)}
          .${p}-vtab.active{background:#fff;color:var(--primary);box-shadow:0 1px 3px rgba(0,0,0,.08)}
          .${p}-vtab.active:hover{color:var(--primary)}
          .${p}-proof-view{padding-top:2px}
          /* ── Proof Review photo gallery ── */
          .${p}-pg-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
          .${p}-pg-search{flex:1 1 200px;min-width:160px}
          .${p}-pg-count{font-size:12px;font-weight:600;color:var(--gray-lt);margin-bottom:10px}
          .${p}-pg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
          .${p}-pg-cell{margin:0;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:var(--r-md);background:#fff;overflow:hidden;transition:box-shadow .15s,transform .15s}
          .${p}-pg-cell:hover{box-shadow:0 6px 18px rgba(0,0,0,.12);transform:translateY(-1px)}
          .${p}-pg-media{position:relative;aspect-ratio:1;background:#f1f3f5;cursor:pointer;display:block}
          .${p}-pg-img{width:100%;height:100%;object-fit:cover;display:block}
          .${p}-pg-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--gray-lt)}
          .${p}-pg-cap{padding:8px 10px;display:flex;flex-direction:column;gap:2px;min-width:0}
          .${p}-pg-title{font-size:12px;font-weight:700;color:var(--dark);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .${p}-pg-title:hover{color:var(--primary)}
          .${p}-pg-sub{font-size:11px;color:var(--gray-lt);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          @media (max-width:480px){ .${p}-pg-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))} }
          .${p}-proof-list{display:flex;flex-direction:column;gap:12px}
          .${p}-proof-card{border:1px solid var(--border);border-radius:var(--r-md);background:#fff;overflow:hidden}
          .${p}-proof-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border)}
          .${p}-proof-card-head:hover{background:rgba(var(--primary-rgb),.05)}
          .${p}-proof-card-title{font-size:13px;font-weight:700;color:var(--dark);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .${p}-proof-card-meta{font-size:11px;font-weight:600;color:var(--gray-lt);flex-shrink:0;white-space:nowrap}
          .${p}-proof-grid,.${p}-proof-detail-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;padding:12px}
          .${p}-proof-detail-grid{padding:0}
          .${p}-proof-thumb{display:block;aspect-ratio:1;border-radius:var(--r-sm);overflow:hidden;background:#f1f3f5;border:1px solid var(--border);cursor:pointer}
          .${p}-proof-thumb img{width:100%;height:100%;object-fit:cover;display:block}
          .${p}-proof-sec{margin-top:18px;border-top:1px solid var(--border);padding-top:14px}
          .${p}-proof-item{margin:0;display:flex;flex-direction:column;gap:4px}
          .${p}-proof-cap{font-size:11px;color:var(--gray);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
          /* ── Store tabs ── */
          .${p}-store-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px}
          .${p}-store-tab{display:inline-flex;align-items:center;width:auto;padding:5px 12px;border-radius:20px;border:1.5px solid var(--border);background:#fff;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;flex-shrink:0;user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none}
          .${p}-store-tab:hover{border-color:var(--accent);color:var(--accent);background:rgba(var(--accent-rgb),.06)}
          .${p}-store-tab.active{background:var(--primary);border-color:var(--primary);color:var(--primary-text)}
          /* ── Filter bar ── */
          .${p}-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;align-items:center}
          /* ── Team-member dropdown (own full-width row) ── */
          .${p}-team-wrap{position:relative;display:flex;align-items:center;margin-bottom:8px}
          .${p}-team-ico{position:absolute;left:10px;color:var(--gray);pointer-events:none;display:flex;z-index:1}
          .${p}-team-caret{position:absolute;right:9px;color:var(--gray);pointer-events:none}
          .${p}-team-select{appearance:none;-webkit-appearance:none;flex:1;width:100%;padding:8px 28px 8px 30px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;font-size:13px;font-weight:600;color:var(--dark);cursor:pointer;font-family:inherit;transition:all .15s}
          /* ── Mini selects (priority / sort) + overdue chip ── */
          .${p}-mini-select{appearance:none;-webkit-appearance:none;flex:0 0 auto;padding:7px 26px 7px 11px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 8px center;font-size:12px;font-weight:600;color:var(--dark);cursor:pointer;font-family:inherit;transition:border-color .15s}
          .${p}-mini-select:hover{border-color:var(--primary)}
          .${p}-mini-select:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
          .${p}-chip{display:inline-flex;width:auto!important;align-items:center;gap:5px;flex:0 0 auto;padding:7px 12px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap}
          .${p}-chip:hover{border-color:var(--error);color:var(--error)}
          .${p}-chip.active{background:var(--error);border-color:var(--error);color:#fff}
          /* Search + assigned-date-range toolbar */
          .${p}-toolbar2{display:flex;flex-wrap:wrap;gap:8px;margin:-6px 0 16px;align-items:center}
          .${p}-search{position:relative;flex:1 1 220px;min-width:180px;display:flex;align-items:center}
          .${p}-search-ico{position:absolute;inset-inline-start:11px;color:var(--gray-lt);pointer-events:none}
          .${p}-search-input{width:100%;box-sizing:border-box;padding:8px 12px 8px 34px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;font-size:13px;color:var(--dark);font-family:inherit;transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;appearance:none}
          .${p}-search-input::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none}
          .${p}-search-input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
          .${p}-daterange{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding:5px 8px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;color:var(--gray)}
          .${p}-daterange:focus-within{border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
          .${p}-date-lbl{font-size:12px;font-weight:600;color:var(--gray);white-space:nowrap}
          .${p}-date-sep{font-size:12px;color:var(--gray-lt)}
          .${p}-date-in{border:none;background:none;font-family:inherit;font-size:12px;font-weight:600;color:var(--dark);padding:2px;min-width:112px;cursor:pointer}
          .${p}-date-in:focus{outline:none}
          .${p}-date-clear{display:inline-flex!important;width:auto!important;margin:0!important;align-items:center;justify-content:center;padding:3px!important;border:none!important;background:none!important;color:var(--gray-lt);cursor:pointer;border-radius:50%;line-height:normal!important}
          .${p}-date-clear:hover,.${p}-date-clear:focus,.${p}-date-clear:active{color:var(--error)!important;background:rgba(196,30,58,.08)!important}
          @media (max-width:480px){
            .${p}-daterange{flex:1 1 100%}
            .${p}-date-in{flex:1}
          }
          @media (max-width:480px){
            .${p}-type-wrap{flex:1 1 100%}
            .${p}-mini-select,.${p}-chip{flex:1 1 auto}
          }
          .${p}-team-select:hover{border-color:var(--primary)}
          .${p}-team-select:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.12)}
          /* ── Manager dashboard ── */
          .${p}-charts{margin-bottom:16px}
          .${p}-dash-empty{padding:18px;text-align:center;color:var(--gray-lt);font-size:13px;background:#fafafa;border:1px solid var(--border);border-radius:var(--r-lg)}
          .${p}-stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
          .${p}-stat{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:12px 14px;box-shadow:var(--shadow-sm)}
          .${p}-stat-pri{flex-direction:column;align-items:stretch;gap:6px}
          .${p}-donut{flex-shrink:0}
          .${p}-donut-txt{font-size:16px;font-weight:800;fill:var(--dark)}
          .${p}-stat-num{font-size:30px;font-weight:800;line-height:1;color:var(--dark);min-width:34px;text-align:center}
          .${p}-stat-num.bad{color:var(--error)}
          .${p}-stat-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--gray)}
          .${p}-stat-sub{font-size:11px;color:var(--gray-lt);margin-top:2px}
          .${p}-pri-row{display:flex;align-items:center;gap:7px}
          .${p}-pri-lbl{font-size:11px;color:var(--gray);width:48px;flex-shrink:0}
          .${p}-pri-track{flex:1;height:7px;background:var(--border);border-radius:6px;overflow:hidden}
          .${p}-pri-fill{height:100%;border-radius:6px;transition:width .4s ease}
          .${p}-pri-n{font-size:11px;font-weight:700;color:var(--dark);width:18px;text-align:end}
          .${p}-dash-members{margin-top:12px;background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:12px 14px;box-shadow:var(--shadow-sm)}
          .${p}-dash-h,.${p}-act-h{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--gray);margin-bottom:10px}
          .${p}-dash-row{display:grid;grid-template-columns:104px 1fr 74px;gap:10px;align-items:center;margin-bottom:5px;padding:4px 6px;margin-inline:-6px;border-radius:8px;cursor:pointer;transition:background .12s}
          .${p}-dash-row:hover{background:rgba(var(--primary-rgb),.05)}
          .${p}-dash-row.active{background:rgba(var(--primary-rgb),.1)}
          .${p}-dash-row.active .${p}-dash-name span{color:var(--primary)}
          .${p}-dash-toggle{margin-top:6px;width:100%;border:none;background:none;font-family:inherit;font-size:12px;font-weight:700;color:var(--primary);cursor:pointer;padding:5px}
          .${p}-dash-toggle:hover{text-decoration:underline}
          .${p}-dash-row:last-child{margin-bottom:0}
          .${p}-dash-name{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--dark);min-width:0}
          .${p}-dash-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .${p}-dash-av{width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--border)}
          .${p}-dash-av-fb{display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--primary),var(--accent))}
          .${p}-dash-bar{display:flex;height:10px;border-radius:6px;overflow:hidden;background:var(--border)}
          .${p}-dash-seg{height:100%}
          .${p}-dash-seg.done{background:var(--success)}
          .${p}-dash-seg.open{background:#D97706}
          .${p}-dash-seg.over{background:var(--error)}
          .${p}-dash-counts{font-size:11px;color:var(--gray);white-space:nowrap;text-align:end}
          .${p}-dash-over{color:var(--error);font-weight:600}
          .${p}-dash-more{font-size:11px;color:var(--gray-lt);text-align:center;margin-top:6px}
          /* ── Activity log ── */
          .${p}-activity{margin-bottom:16px;background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:12px 14px;box-shadow:var(--shadow-sm)}
          .${p}-act-item{display:flex;align-items:flex-start;gap:9px;padding:7px 0;border-top:1px solid var(--border)}
          .${p}-act-item.clickable{cursor:pointer;border-radius:8px;padding-inline:6px;margin-inline:-6px;transition:background .12s}
          .${p}-act-item.clickable:hover{background:rgba(var(--primary-rgb),.05)}
          .${p}-act-list.expanded{max-height:340px;overflow-y:auto;margin-inline:-4px;padding-inline:4px}
          .${p}-act-item:first-of-type{border-top:none}
          .${p}-act-av{width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff}
          .${p}-act-av.fb{background:linear-gradient(135deg,var(--primary),var(--accent))}
          .${p}-act-sys{background:#eef0f3;color:var(--gray)}
          .${p}-act-dot{flex-shrink:0;width:8px;height:8px;border-radius:50%;margin-top:6px}
          .${p}-act-body{flex:1;min-width:0;font-size:12px;line-height:1.45;color:var(--gray)}
          .${p}-act-body b{color:var(--dark);font-weight:700}
          .${p}-act-task{color:var(--dark)}
          .${p}-act-proof{display:inline-flex;align-items:center;gap:4px;margin-inline-start:6px;padding:1px 7px 1px 5px;border-radius:10px;font-size:10px;font-weight:700;color:var(--primary);background:rgba(var(--primary-rgb),.1);vertical-align:middle;white-space:nowrap}
          .${p}-act-proof svg{flex-shrink:0}
          .${p}-act-time{font-size:11px;color:var(--gray-lt);white-space:nowrap;flex-shrink:0}
          .${p}-act-fh{display:flex;align-items:center;gap:12px;margin-bottom:12px}
          .${p}-act-back{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--border);background:#fff;border-radius:var(--r-md);padding:6px 12px;font-family:inherit;font-size:12px;font-weight:700;color:var(--dark);cursor:pointer;transition:all .15s}
          .${p}-act-back:hover{border-color:var(--primary);color:var(--primary);background:rgba(var(--primary-rgb),.04)}
          .${p}-act-back svg{flex-shrink:0}
          .${p}-act-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;font-size:12px;font-weight:600;color:var(--gray)}
          .${p}-act-more-hint{text-align:center;padding:12px;font-size:11px;color:var(--gray-lt)}
          .${p}-act-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
          .${p}-type-wrap{position:relative;flex:1 1 130px;min-width:120px}
          .${p}-type-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 11px;border:1.5px solid var(--border);border-radius:var(--r-md);background:#fff;font-size:12px;font-weight:600;color:var(--gray);cursor:pointer;font-family:inherit;transition:all .15s;text-align:start}
          .${p}-type-btn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
          .${p}-status-opt{width:auto!important;padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer;color:var(--gray);font-family:inherit;border:none;background:none;transition:all .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;outline:none;user-select:none}
          .${p}-status-opt.active{background:var(--primary);color:var(--primary-text)}
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
          ${[1,2,3,4,5,6,7,8,9,10].map(n=>`.${p}-list.intro>*:nth-child(${n}){animation-delay:${(n-1)*0.05}s}`).join("")}
          .${p}-list.intro>*:nth-child(n+11){animation-delay:.5s}
          /* Comment entrance */
          @keyframes ${p}-cmt-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
          .${p}-cmt-item{animation:${p}-cmt-in .32s ease both}
          ${[1,2,3,4,5,6,7,8].map(n=>`.${p}-cmt-list .${p}-cmt-item:nth-child(${n}){animation-delay:${(n-1)*0.04}s}`).join("")}
          @media (prefers-reduced-motion:reduce){.${p}-list.intro>*,.${p}-cmt-item{animation:none!important}}
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
          /* Defend round-2/3 buttons from Staffbase's global ".mouse button:hover" green bg */
          .${p}-chip,.${p}-chip:hover,.${p}-chip:focus{background:#fff!important}
          .${p}-chip.active,.${p}-chip.active:hover,.${p}-chip.active:focus{background:var(--error)!important;color:#fff!important}
          .${p}-dash-toggle,.${p}-dash-toggle:hover,.${p}-dash-toggle:focus,.${p}-dash-toggle:active{background:none!important}
          /* Proof Review view tabs — defend against the host green button hover/active bg */
          .${p}-vtab,.${p}-vtab:hover,.${p}-vtab:focus,.${p}-vtab:active{background:transparent!important}
          .${p}-vtab.active,.${p}-vtab.active:hover,.${p}-vtab.active:focus,.${p}-vtab.active:active{background:#fff!important}
          .${p}-vtab:not(.active),.${p}-vtab:not(.active):focus,.${p}-vtab:not(.active):active{color:var(--gray)!important}
          .${p}-vtab:not(.active):hover{color:var(--dark)!important}
          .${p}-vtab.active,.${p}-vtab.active:hover,.${p}-vtab.active:focus,.${p}-vtab.active:active{color:var(--primary)!important}
          /* Activity-log back button — same defense against the host green button bg */
          .${p}-act-back,.${p}-act-back:focus,.${p}-act-back:active{background:#fff!important}
          .${p}-act-back:hover{background:rgba(var(--primary-rgb),.04)!important}
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
          [dir="rtl"] .mgr-audit-arrow svg{transform:scaleX(-1)}
          ${limitCss}
        </style>

        <div class="${p}${limitHeight ? ` ${p}-limited` : ""}">
          <div class="${p}-header">
            <div class="${p}-title">
              <span class="${p}-title-dot"></span>
              <span id="${p}-title-text">${tr("managerTitle")}</span>
              <span class="${p}-badge-count" id="${p}-count">0</span>
            </div>
            <div class="${p}-header-actions">
              ${allowCreate?`<button type="button" class="${p}-new-btn" id="${p}-new" title="${tr("newTask")}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span id="${p}-new-label">${tr("newTask")}</span></button>`:""}
              <button type="button" class="${p}-refresh-btn" id="${p}-translate" title="${tr("translateBtn")}" style="display:none;width:auto;padding:0 10px;gap:5px">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>
                <span id="${p}-translate-lbl"></span>
              </button>
              <button type="button" class="${p}-refresh-btn" id="${p}-refresh" title="${tr("refresh")}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
          </div>

          ${enableProofReview?`<div class="${p}-vtabs" id="${p}-vtabs" role="tablist">
            <button type="button" class="${p}-vtab active" id="${p}-vtab-tasks" data-view="tasks">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              ${tr("tasksTab")}
            </button>
            <button type="button" class="${p}-vtab" id="${p}-vtab-proof" data-view="proof">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              ${tr("proofTab")}
            </button>
          </div>`:""}

          <div id="${p}-tasks-view">
          <div class="${p}-banner" id="${p}-banner"></div>

          <div class="${p}-team-wrap" id="${p}-team-wrap" style="display:none">
            <span class="${p}-team-ico" style="position:static;margin-inline-end:8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
            <div id="${p}-team-dd" style="flex:1"></div>
          </div>
          <div class="${p}-filters">
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
            <div id="${p}-prio-dd"></div>
            <div id="${p}-sort-dd"></div>
            <button type="button" class="${p}-chip" id="${p}-overdue-chip" aria-pressed="false">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              ${tr("overdueOnly")}
            </button>
          </div>

          <div class="${p}-toolbar2">
            <div class="${p}-search">
              <svg class="${p}-search-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" class="${p}-search-input" id="${p}-search" placeholder="${tr("searchTasks")}" aria-label="${tr("searchTasks")}">
            </div>
            <div class="${p}-daterange" id="${p}-daterange">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span class="${p}-date-lbl">${tr("assignedLabel")}</span>
              <input type="date" class="${p}-date-in" id="${p}-date-from" aria-label="${tr("assignedFrom")}">
              <span class="${p}-date-sep">${tr("dateToLabel")}</span>
              <input type="date" class="${p}-date-in" id="${p}-date-to" aria-label="${tr("assignedTo")}">
              <button type="button" class="${p}-date-clear" id="${p}-date-clear" aria-label="${tr("clearDates")}" hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>

          <div class="${p}-store-tabs" id="${p}-store-tabs" style="display:none"></div>

          <div class="${p}-charts" id="${p}-charts"></div>
          <div class="${p}-activity" id="${p}-activity" style="display:none"></div>

          <div id="${p}-list-wrap">
            <div class="${p}-state">
              <span class="${p}-spin" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px;display:block"></span>
              Loading…
            </div>
          </div>
          </div><!-- /tasks-view -->

          ${enableProofReview?`<div class="${p}-proof-view" id="${p}-proof-view" style="display:none"></div>`:""}
        </div>
      `;

      // ── DOM refs ──────────────────────────────────────────────────────
      const countEl       = container.querySelector(`#${p}-count`)!;
      const bannerEl      = container.querySelector(`#${p}-banner`) as HTMLElement;
      const storeTabs     = container.querySelector(`#${p}-store-tabs`) as HTMLElement;
      const listWrap      = container.querySelector(`#${p}-list-wrap`)!;
      const refreshBtn    = container.querySelector(`#${p}-refresh`) as HTMLButtonElement;

      const chartsEl      = container.querySelector(`#${p}-charts`) as HTMLElement;
      const activityEl    = container.querySelector(`#${p}-activity`) as HTMLElement;
      const teamWrap      = container.querySelector(`#${p}-team-wrap`) as HTMLElement;
      const teamDdEl      = container.querySelector(`#${p}-team-dd`) as HTMLElement | null;
      const prioDdEl      = container.querySelector(`#${p}-prio-dd`) as HTMLElement | null;
      const sortDdEl      = container.querySelector(`#${p}-sort-dd`) as HTMLElement | null;
      const overdueChip   = container.querySelector(`#${p}-overdue-chip`) as HTMLButtonElement;
      const searchInput   = container.querySelector(`#${p}-search`) as HTMLInputElement | null;
      const dateFromEl    = container.querySelector(`#${p}-date-from`) as HTMLInputElement | null;
      const dateToEl      = container.querySelector(`#${p}-date-to`) as HTMLInputElement | null;
      const dateClearBtn  = container.querySelector(`#${p}-date-clear`) as HTMLButtonElement | null;
      const typeBtn       = container.querySelector(`#${p}-type-btn`) as HTMLButtonElement;
      const typeLabelEl   = container.querySelector(`#${p}-type-label`) as HTMLElement;
      const typeMenu      = container.querySelector(`#${p}-type-menu`) as HTMLElement;
      const vtabsEl       = container.querySelector(`#${p}-vtabs`) as HTMLElement | null;
      const tasksViewEl   = container.querySelector(`#${p}-tasks-view`) as HTMLElement | null;
      const proofViewEl   = container.querySelector(`#${p}-proof-view`) as HTMLElement | null;

      // Detail panel — appended to body so position:fixed works in Staffbase.
      // Body-appended elements + document listeners don't get cleaned up on
      // SPA navigation when the host element is removed, so we manage their
      // lifecycle explicitly via refs stashed on `this`.
      const self: any = this;

      // Tear down artifacts from a previous render of this same host (re-renders)
      if (self._mgrOverlay)  { self._mgrOverlay.remove();  self._mgrOverlay  = undefined; }
      if (self._mgrDetail)   { self._mgrDetail.remove();   self._mgrDetail   = undefined; }
      if (self._mgrAModal)   { self._mgrAModal.remove();   self._mgrAModal   = undefined; }
      if (self._mgrCreate)   { self._mgrCreate.remove();   self._mgrCreate   = undefined; }
      if (self._mgrDocClick) { document.removeEventListener("click",   self._mgrDocClick); self._mgrDocClick = undefined; }
      if (self._mgrDocClickDD) { document.removeEventListener("click", self._mgrDocClickDD); self._mgrDocClickDD = undefined; }
      if (self._mgrDocKey)   { document.removeEventListener("keydown", self._mgrDocKey);   self._mgrDocKey   = undefined; }
      if (self._mgrActScroll){ window.removeEventListener("scroll", self._mgrActScroll); self._mgrActScroll = undefined; }

      const instId = Math.random().toString(36).slice(2);
      container.dataset.mgrInst = instId;
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
      overlayEl.dataset.mgrInst = instId;
      overlayEl.dataset.sbPortal = instId;
      document.body.appendChild(overlayEl);
      self._mgrOverlay = overlayEl;

      const detailEl = document.createElement("div");
      detailEl.className = `${p}-detail`;
      detailEl.dataset.mgrInst = instId;
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
      self._mgrDetail = detailEl;

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
      self._mgrAModal = attModal;
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
        try{ console.log("[mgr]",...args); }catch(_){}
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
      // Photo-proof comments carry this marker. It flags a comment (with an image
      // attachment) as proof; the token is stripped from the visible comment body.
      const PROOF_MARK="[proof]";
      const stripProof=(html:string):string=>html.replace(/\[proof\]/gi,"").trim();
      const isProofComment=(c:any):boolean=>commentPlain(c).toLowerCase().indexOf(PROOF_MARK)>=0;
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
        // Hide the widget's own hidden [tasks:edit] audit comments from the UI
        // (count + list). They power the activity feed only.
        return arr.filter(c=>!isEditComment(commentPlain(c)));
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

      // ── Manager view: team resolution ──────────────────────────────────
      const userDisplayName=(u:any):string=>[u?.firstName,u?.lastName].filter(Boolean).join(" ")||u?.displayName||u?.userName||u?.id||"";
      const userAvatarUrl=(u:any):string=>u?.avatar?.icon?.url||u?.avatar?.thumb?.url||u?.avatar?.original?.url||"";
      // Full /users objects (carry profile.system_manager + avatar). Cached; also
      // seeds the lightweight `usersList` used by the reassign picker.
      async function fetchAllUsersRaw():Promise<any[]>{
        if(allUsersRaw) return allUsersRaw;
        try{
          const r=await fetch(`${baseUrl}/users?limit=200`,apiOpts());
          const d:any=r.ok?await r.json():null;
          allUsersRaw=(d?.data||(Array.isArray(d)?d:[])) as any[];
        }catch(_){ allUsersRaw=[]; }
        if(!usersList) usersList=allUsersRaw.map(u=>({id:u.id,name:userDisplayName(u)}));
        return allUsersRaw!;
      }
      // Build teamMembers per the `teamsource` config. Runs in load() after tasks
      // are fetched (the "everyone" mode reads assignees off allTasks).
      async function resolveTeam(){
        teamMembers=[]; teamMemberSet.clear(); teamNote="";
        const users=await fetchAllUsersRaw();
        const byId=new Map<string,any>(users.map(u=>[u.id,u]));
        if(teamSource==="everyone"){
          const ids=new Set<string>();
          for(const t of allTasks){ if(t.taskType==="audit-result") continue; for(const a of t.assigneeIds) ids.add(a); }
          teamMembers=[...ids].map(id=>{const u=byId.get(id);return{id,name:u?userDisplayName(u):id,avatar:u?userAvatarUrl(u):""};});
        } else if(teamSource==="userids"){
          teamMembers=teamUserIds.map(id=>{const u=byId.get(id);return{id,name:u?userDisplayName(u):id,avatar:u?userAvatarUrl(u):""};});
          if(!teamMembers.length) teamNote=tr("noTeamConfigured");
        } else { // reports — match others' profile.system_manager against my externalID
          let ext=String(byId.get(currentUserId)?.externalID ?? "");
          if(!ext && currentUserId){
            try{ const r=await fetch(`${baseUrl}/users/${currentUserId}`,apiOpts()); if(r.ok){ const d:any=await r.json(); ext=String(d.externalID ?? ""); } }catch(_){}
          }
          const reports = ext ? users.filter(u=>String(u.profile?.system_manager ?? "")===ext) : [];
          teamMembers=reports.map(u=>({id:u.id,name:userDisplayName(u),avatar:userAvatarUrl(u)}));
          teamNote = teamMembers.length ? "" : tr("noReports");
        }
        teamMembers.sort((a,b)=>a.name.localeCompare(b.name));
        // Drop any selected members that no longer exist across reloads.
        for(const id of [...selectedMembers]) if(!teamMembers.some(m=>m.id===id)) selectedMembers.delete(id);
        for(const m of teamMembers) teamMemberSet.add(m.id);
        dlog("team",teamSource,"members:",teamMembers.length,teamNote||"");
      }
      // Whether a task falls within the current team scope / selected member(s).
      function inTeamWith(t:Task, members:Set<string>):boolean{
        if(members.size) return t.assigneeIds.some(a=>members.has(a));
        if(teamSource==="everyone") return true; // whole accessible system (mode, not a fallback)
        // Scoped modes (reports / userids): only the team's tasks. No team → nothing.
        return teamMemberSet.size ? t.assigneeIds.some(a=>teamMemberSet.has(a)) : false;
      }
      function inTeam(t:Task):boolean{ return inTeamWith(t, selectedMembers); }
      // Base team scope, ignoring any per-member selection (used by the proof
      // gallery, which filters people at the photo level by uploader OR assignee).
      const NO_MEMBERS=new Set<string>();
      function inTeamScope(t:Task):boolean{ return inTeamWith(t, NO_MEMBERS); }
      // Resolve a user id → display name (teamMembers → /users → id). Sync.
      function displayNameSync(id:string):string{
        const m=teamMembers.find(x=>x.id===id); if(m) return m.name;
        const u=(allUsersRaw||[]).find(x=>x.id===id); return u?userDisplayName(u):id;
      }
      // "Chriscelle" / "Chriscelle and Andrea" / "Chriscelle and Andrea, +1 more"
      function ownerLabel(task:Task):string{
        const names=task.assigneeIds.map(id=>displayNameSync(id)).filter(Boolean);
        if(names.length===0) return "";
        if(names.length===1) return names[0];
        if(names.length===2) return `${names[0]} and ${names[1]}`;
        return `${names[0]} and ${names[1]}, +${names.length-2} more`;
      }
      // Action text for the hidden status-change comment → activity feed. If the
      // actor isn't one of the assignees, credit it as completing their task,
      // e.g. "completed Chriscelle's task “…”".
      function statusAction(task:Task, newStatus:string):string{
        const verb = newStatus==="CLOSED" ? "completed" : "reopened";
        const mine = !!currentUserId && task.assigneeIds.indexOf(currentUserId)!==-1;
        const owner = ownerLabel(task);
        return (!mine && owner) ? `${verb} ${owner}'s task “${task.title}”` : `${verb} “${task.title}”`;
      }
      // Sort a task list per the active sort control (applied in filteredTasks).
      function sortTasks(list:Task[]):Task[]{
        const due=(t:Task)=>t.dueDate?new Date(t.dueDate).getTime():Infinity;
        const rank=(t:Task)=>t.priority==="Priority_1"?0:t.priority==="Priority_2"?1:2;
        const created=(t:Task)=>t.createDate?Date.parse(t.createDate):0;
        const aName=(t:Task)=>t.assigneeIds.length?displayNameSync(t.assigneeIds[0]).toLowerCase():"~";
        const arr=list.slice();
        if(sortBy==="priority")      arr.sort((a,b)=>rank(a)-rank(b)||due(a)-due(b));
        else if(sortBy==="assignee") arr.sort((a,b)=>aName(a).localeCompare(aName(b))||due(a)-due(b));
        else if(sortBy==="created")  arr.sort((a,b)=>created(b)-created(a));
        else                         arr.sort((a,b)=>due(a)-due(b)); // "due" default
        return arr;
      }

      // Reassign picker (audit mode). Searchable groups + people; PATCHes the task.
      function wireReassign(task:Task){
        const root=detailBody.querySelector(`#${p}-reassign-${instId}`) as HTMLElement|null;
        if(!root) return;
        const btn=root.querySelector(`.${p}-reassign-btn`) as HTMLButtonElement;
        const pop=root.querySelector(`.${p}-reassign-pop`) as HTMLElement;
        const search=root.querySelector(`.${p}-reassign-search`) as HTMLInputElement;
        const results=root.querySelector(`.${p}-reassign-results`) as HTMLElement;
        const foot=root.querySelector(`.${p}-reassign-foot`) as HTMLElement;
        const selLbl=root.querySelector(`.${p}-reassign-sel`) as HTMLElement;
        const saveBtn=root.querySelector(`.${p}-reassign-save`) as HTMLButtonElement;
        const clearBtn=root.querySelector(`.${p}-reassign-clear`) as HTMLButtonElement;
        const gIco=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
        const uIco=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const ckIco=`<svg class="${p}-ck" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        // Multi-select: seed from the task's current assignment, toggle on click,
        // and PATCH both arrays together on Save (the API accepts multiples).
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
            // Activity: hidden audit comment "{author} reassigned …" + notify the newly added.
            const allNames=[...body.assigneeIds.map(displayNameSync), ...body.groupIds.map(g=>groupMap.get(g)||g)];
            postEditComment(task, `reassigned “${task.title}” to ${allNames.length?allNames.join(", "):"no one"}`);
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
      // Hidden audit comment (powers the activity feed's "edit" events; suppressed
      // from the visible comment list). Posts via the user session (best-effort).
      async function postEditComment(task:Task, action:string){
        try{ await postComment(task, `${EDIT_MARK} ${action}`); }catch(_){}
      }
      // Staffbase notifications to newly-assigned people/groups (Basic token, no
      // session needed). Users get "You were assigned…"; each group gets a named
      // "Your group X was assigned…". Best-effort.
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

      // ── Photo proof ───────────────────────────────────────────────────
      // Extract every [attachment:<id>] token carried by a proof comment.
      function proofAttIds(c:any):string[]{
        const txt=commentText(c); const ids:string[]=[]; let m; ATT_TOKEN.lastIndex=0;
        while((m=ATT_TOKEN.exec(txt))) ids.push(m[1]);
        return ids;
      }
      type ProofItem={ id:string; authorId:string; createdAt:string };
      function collectProofItems(comments:any[]):ProofItem[]{
        const items:ProofItem[]=[];
        comments.filter(isProofComment).forEach(c=>{
          const at=c.createdAt||c.created||"";
          proofAttIds(c).forEach(id=>items.push({ id, authorId:commentAuthorId(c), createdAt:at }));
        });
        return items;
      }
      function proofThumb(it:ProofItem):string{
        const m=mediaCache.get(it.id);
        const turl=m?.thumbnail?.url||"";
        const full=originalUrl(m)||turl;
        const fn=m?.fileName||"proof";
        const kind=attKind(m);
        return `<a class="${p}-proof-thumb" href="${esc(full)||"#"}" target="_blank" rel="noopener" data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}">${turl?`<img src="${esc(turl)}" alt="${esc(fn)}">`:iFileGeneric}</a>`;
      }
      // Detail-panel "Proof" section — always shown when a task has photo proof,
      // independent of the Proof Review tab toggle.
      async function renderProofSection(task:Task){
        const box=detailBody.querySelector(`#${p}-proof-sec-${instId}`) as HTMLElement|null;
        if(!box) return;
        let comments:any[]=[];
        try{ comments=await loadComments(task); }catch(_){ box.style.display="none"; box.innerHTML=""; return; }
        if(detailTask!==task) return;
        const items=collectProofItems(comments);
        if(!items.length){ box.style.display="none"; box.innerHTML=""; return; }
        await Promise.all(items.map(it=>metaCached(it.id)));
        if(detailTask!==task) return;
        const authors=await Promise.all(items.map(it=>fetchUser(it.authorId)));
        if(detailTask!==task) return;
        box.innerHTML=`
          <div class="${p}-att-head"><span class="${p}-att-label">${tr("proofLabel")}</span></div>
          <div class="${p}-proof-detail-grid">
            ${items.map((it,i)=>{
              const cap=[authors[i]?.name,commentTime(it.createdAt)].filter(Boolean).join(" · ");
              return `<figure class="${p}-proof-item">
                ${proofThumb(it)}
                ${cap?`<figcaption class="${p}-proof-cap">${esc(cap)}</figcaption>`:""}
              </figure>`;
            }).join("")}
          </div>`;
        box.style.display="";
      }
      // Load proof across the manager's whole team for the review gallery.
      // Broad load (team-source scope, ignoring the selectedMembers / store /
      // search filters) so the cached set can be filtered instantly on every
      // keystroke. Invalidated on reload via proofCache=null.
      type ProofGroup={ task:Task; items:ProofItem[] };
      type ProofPhoto={ task:Task; item:ProofItem };
      let proofCache:ProofGroup[]|null=null;
      async function loadProofItems():Promise<ProofGroup[]>{
        if(proofCache) return proofCache;
        const inScopeBroad=(t:Task)=> t.taskType!=="audit-result" &&
          (teamSource==="everyone" ? true : (teamMemberSet.size ? t.assigneeIds.some(a=>teamMemberSet.has(a)) : false));
        const tasks=allTasks.filter(inScopeBroad);
        const results=await Promise.all(tasks.map(async t=>{
          let comments:any[]=[];
          try{ comments=await loadComments(t); }catch(_){ return null; }
          const items=collectProofItems(comments);
          return items.length?{ task:t, items }:null;
        }));
        const groups=results.filter((x): x is ProofGroup => !!x);
        // Only cache once the task load has finished. Otherwise an early call
        // (tab opened mid-load) would cache an empty set that sticks until refresh.
        if(tasksLoaded) proofCache=groups;
        return groups;
      }
      // Apply the live filters (person, store, search, completed-date) then flatten
      // to a newest-first list of individual photos for the grid. The date range
      // filters by the proof's own timestamp (when it was submitted on completion),
      // not the task's assigned/created date.
      function proofTaskMatches(t:Task):boolean{
        if(searchQuery){
          const q=searchQuery.toLowerCase();
          if(`${t.title||""} ${t.description||""}`.toLowerCase().indexOf(q)<0) return false;
        }
        return inTeamScope(t)
          && (activeInstallFilter==="all"||t.installationId===activeInstallFilter);
      }
      function proofWithinCompleted(iso:string):boolean{
        if(!assignedFrom && !assignedTo) return true;
        const c=iso?Date.parse(iso):NaN;
        if(isNaN(c)) return false;
        if(assignedFrom && c<Date.parse(`${assignedFrom}T00:00:00`)) return false;
        if(assignedTo   && c>Date.parse(`${assignedTo}T23:59:59.999`)) return false;
        return true;
      }
      function flattenProof(groups:ProofGroup[]):ProofPhoto[]{
        const out:ProofPhoto[]=[];
        const sel=selectedMembers;
        for(const g of groups){
          if(!proofTaskMatches(g.task)) continue;
          // Person filter (photo level): show a photo when nobody is selected, when
          // the task is assigned to a selected person, or when a selected person is
          // the one who uploaded that photo.
          const taskAssigned=!sel.size || g.task.assigneeIds.some(a=>sel.has(a));
          for(const it of g.items){
            if(!proofWithinCompleted(it.createdAt)) continue;
            if(sel.size && !taskAssigned && !sel.has(it.authorId)) continue;
            out.push({ task:g.task, item:it });
          }
        }
        out.sort((a,b)=>(Date.parse(b.item.createdAt)||0)-(Date.parse(a.item.createdAt)||0));
        return out;
      }
      function proofCell(ph:ProofPhoto):string{
        const it=ph.item, m=mediaCache.get(it.id);
        const turl=m?.thumbnail?.url||"";
        const full=originalUrl(m)||turl;
        const fn=m?.fileName||"proof";
        const kind=attKind(m);
        const who=displayNameSync(it.authorId)||(ph.task.assigneeIds[0]?displayNameSync(ph.task.assigneeIds[0]):"");
        const sub=[who,commentTime(it.createdAt),ph.task.installationTitle||""].filter(Boolean).join(" · ");
        return `<figure class="${p}-pg-cell">
          <div class="${p}-pg-media" data-att-url="${esc(full)}" data-att-preview="${esc(turl)}" data-att-name="${esc(fn)}" data-att-kind="${kind}" role="button" tabindex="0">
            ${turl?`<img class="${p}-pg-img" src="${esc(turl)}" alt="${esc(fn)}" loading="lazy">`:`<div class="${p}-pg-fallback">${iFileGeneric}</div>`}
          </div>
          <figcaption class="${p}-pg-cap">
            <span class="${p}-pg-title" data-proof-task="${esc(ph.task.id)}" role="button" tabindex="0" dir="auto">${esc(ct(ph.task.title))}</span>
            ${sub?`<span class="${p}-pg-sub">${esc(sub)}</span>`:""}
          </figcaption>
        </figure>`;
      }
      let proofViewSeq=0;
      // Proof gallery pagination: show PROOF_PAGE photos initially, grow by
      // PROOF_STEP on "View more". Reset to the first page on any filter change.
      const PROOF_PAGE=24;
      const PROOF_STEP=24;
      let proofLimit=PROOF_PAGE;
      const pgSearchIco=`<svg class="${p}-search-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
      const pgCalIco=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      // Build the gallery's own filter bar once (store + person + search + date),
      // bound to the shared filter state so the Tasks view stays consistent.
      function buildProofBar(){
        if(!proofViewEl) return;
        pruneDropdowns(); // drop stale entries from a previous proof-bar build
        // Only offer stores/people that actually have proof (derived from the
        // loaded proof set). A currently-active selection is kept in the list even
        // if it has no proof, so the filter stays visible and removable.
        const instMap=new Map<string,string>();
        const proofPeople=new Set<string>();
        (proofCache||[]).forEach(g=>{
          if(!instMap.has(g.task.installationId)) instMap.set(g.task.installationId,g.task.installationTitle||g.task.installationId);
          // Offer the people who actually submitted proof (comment authors) as well
          // as the assignees of proofed tasks, so a reviewer can filter by whoever
          // uploaded a photo, even if that person isn't on the manager's roster.
          g.items.forEach(it=>{ if(it.authorId) proofPeople.add(it.authorId); });
          g.task.assigneeIds.forEach(a=>{ if(teamMemberSet.has(a)) proofPeople.add(a); });
        });
        if(activeInstallFilter!=="all" && !instMap.has(activeInstallFilter)){
          const at=allTasks.find(x=>x.installationId===activeInstallFilter);
          instMap.set(activeInstallFilter, at?.installationTitle||activeInstallFilter);
        }
        selectedMembers.forEach(id=>proofPeople.add(id)); // keep active selections visible
        const personOpts=[...proofPeople].map(id=>({id,name:displayNameSync(id)})).sort((a,b)=>a.name.localeCompare(b.name));
        const showStore=instMap.size>1;
        const showPerson=personOpts.length>1;
        proofViewEl.innerHTML=`
          <div class="${p}-pg-bar">
            <div class="${p}-search ${p}-pg-search">${pgSearchIco}
              <input type="search" class="${p}-search-input" id="${p}-pg-search" placeholder="${tr("searchProof")}" aria-label="${tr("searchProof")}">
            </div>
            ${showStore?`<div id="${p}-pg-store-dd" style="flex:0 1 160px"></div>`:""}
            ${showPerson?`<div id="${p}-pg-person-dd" style="flex:0 1 160px"></div>`:""}
            <div class="${p}-daterange" id="${p}-pg-daterange">${pgCalIco}
              <span class="${p}-date-lbl">${tr("completedLabel")}</span>
              <input type="date" class="${p}-date-in" id="${p}-pg-date-from" aria-label="${tr("completedFrom")}">
              <span class="${p}-date-sep">${tr("dateToLabel")}</span>
              <input type="date" class="${p}-date-in" id="${p}-pg-date-to" aria-label="${tr("completedTo")}">
            </div>
          </div>
          <div class="${p}-pg-wrap" id="${p}-pg-wrap"></div>`;
        const s=proofViewEl.querySelector(`#${p}-pg-search`) as HTMLInputElement|null;
        const df=proofViewEl.querySelector(`#${p}-pg-date-from`) as HTMLInputElement|null;
        const dt=proofViewEl.querySelector(`#${p}-pg-date-to`) as HTMLInputElement|null;
        if(s) s.value=searchQuery;
        if(df) df.value=assignedFrom;
        if(dt) dt.value=assignedTo;
        const syncMainClear=()=>{ if(dateClearBtn) dateClearBtn.hidden=!(assignedFrom||assignedTo); };
        let pst:any;
        s?.addEventListener("input",()=>{ clearTimeout(pst); pst=setTimeout(()=>{ searchQuery=s.value.trim(); if(searchInput)searchInput.value=searchQuery; repaintProofGrid(); },180); });
        // Store filter → single custom dropdown (shared activeInstallFilter, so it
        // mirrors the store tabs). Person → multiselect (shared selectedMembers).
        const storeDd=proofViewEl.querySelector(`#${p}-pg-store-dd`) as HTMLElement|null;
        if(storeDd) makeDropdown({
          wrap:storeDd, multi:false, allLabel:tr("allStores"),
          options:()=>[{value:"all",label:tr("allStores")}].concat([...instMap.entries()].map(([id,title])=>({value:id,label:title}))),
          selected:()=>new Set([activeInstallFilter]),
          onChange:(next)=>{ activeInstallFilter=[...next][0]||"all"; renderStoreTabs(); repaintProofGrid(); },
        });
        const personDd=proofViewEl.querySelector(`#${p}-pg-person-dd`) as HTMLElement|null;
        if(personDd) makeDropdown({
          wrap:personDd, multi:true, allLabel:tr("allPeople"),
          options:()=>personOpts.map(mm=>({value:mm.id,label:mm.name})),
          selected:()=>selectedMembers,
          onChange:(next)=>{ selectedMembers.clear(); next.forEach(v=>selectedMembers.add(v)); renderTeamSelect(); repaintProofGrid(); },
        });
        df?.addEventListener("change",()=>{ assignedFrom=df.value||""; if(dateFromEl)dateFromEl.value=assignedFrom; syncMainClear(); repaintProofGrid(); });
        dt?.addEventListener("change",()=>{ assignedTo=dt.value||""; if(dateToEl)dateToEl.value=assignedTo; syncMainClear(); repaintProofGrid(); });
      }
      async function repaintProofGrid(reset:boolean=true){
        if(!proofViewEl) return;
        if(reset) proofLimit=PROOF_PAGE;
        const wrap=proofViewEl.querySelector(`#${p}-pg-wrap`) as HTMLElement|null; if(!wrap) return;
        const seq=++proofViewSeq;
        wrap.innerHTML=`<div class="${p}-state"><span class="${p}-spin" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px;display:block"></span>${tr("loading")}</div>`;
        let groups:ProofGroup[]=[];
        try{ groups=await loadProofItems(); }
        catch(e:any){ if(seq===proofViewSeq) wrap.innerHTML=`<div class="${p}-state"><strong>${tr("failedToLoad")}</strong>${esc(e.message)}</div>`; return; }
        if(seq!==proofViewSeq) return;
        const photos=flattenProof(groups);
        const noneSvg=`<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
        if(!photos.length){
          const msg=groups.length?tr("noProofMatches"):tr("noProofYet");
          wrap.innerHTML=`<div class="${p}-amodal-none">${noneSvg}<span>${esc(msg)}</span></div>`;
          return;
        }
        const shown=photos.slice(0,proofLimit);
        const ids=new Set<string>(); shown.forEach(ph=>ids.add(ph.item.id));
        await Promise.all([...ids].map(metaCached));
        if(seq!==proofViewSeq) return;
        const n=photos.length;
        const count=n===1?tr("onePhoto"):tr("nPhotos").replace("{n}",String(n));
        const more=photos.length>proofLimit
          ? `<button type="button" class="${p}-dash-toggle" id="${p}-pg-more">${tr("viewMoreProof")}</button>`
          : "";
        wrap.innerHTML=`<div class="${p}-pg-count">${esc(count)}</div><div class="${p}-pg-grid">${shown.map(proofCell).join("")}</div>${more}`;
        wrap.querySelector(`#${p}-pg-more`)?.addEventListener("click",()=>{ proofLimit+=PROOF_STEP; repaintProofGrid(false); });
      }
      async function renderProofView(){
        if(!proofViewEl) return;
        const loader=`<div class="${p}-state"><span class="${p}-spin" style="width:24px;height:24px;border-width:3px;margin:0 auto 12px;display:block"></span>${tr("loading")}</div>`;
        const seq=++proofViewSeq;
        // Tasks may still be loading (e.g. the manager clicked Proof Review right
        // away). Show a loader and wait, rather than building against an empty
        // task set. A newer render or leaving the tab aborts this one.
        if(!tasksLoaded){
          proofViewEl.innerHTML=loader;
          await whenTasksLoaded();
          if(seq!==proofViewSeq || proofViewEl.style.display==="none") return;
        }
        // Load the proof set first (with a loader) so the filter bar can list only
        // the stores/people that actually have proof. Cached after the first open,
        // so filter changes rebuild the bar instantly without re-fetching.
        if(!proofCache){
          proofViewEl.innerHTML=loader;
          try{ await loadProofItems(); }catch(_){}
          if(seq!==proofViewSeq) return;
        }
        buildProofBar();
        await repaintProofGrid();
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
      // Shared free-text + assigned-date-range predicate. "Assigned" date comes
      // from the task's createDate metadata (when it was created/assigned).
      function matchesSearchDate(t:Task):boolean{
        if(searchQuery){
          const q=searchQuery.toLowerCase();
          const hay=`${t.title||""} ${t.description||""}`.toLowerCase();
          if(hay.indexOf(q)<0) return false;
        }
        if(assignedFrom||assignedTo){
          const c=t.createDate?Date.parse(t.createDate):NaN;
          if(isNaN(c)) return false;
          if(assignedFrom && c<Date.parse(`${assignedFrom}T00:00:00`)) return false;
          if(assignedTo   && c>Date.parse(`${assignedTo}T23:59:59.999`)) return false;
        }
        return true;
      }
      // Shared task-filter predicate. `ignoreStore` skips the store-tab filter so
      // the store pills can count matches per store under all the OTHER filters,
      // keeping each pill's number in sync with what the task list shows.
      function taskMatches(t:Task, ignoreStore=false):boolean{
        if(t.taskType==="audit-result") return false; // always hide system tasks
        if(!inTeam(t)) return false; // manager view: team-member dropdown filter
        if(!ignoreStore && activeInstallFilter!=="all" && t.installationId!==activeInstallFilter) return false;
        if(activeTypeFilters.size>0){const key=t.taskType||"__none__";if(!activeTypeFilters.has(key)) return false;}
        if(prioritySet.size>0&&!prioritySet.has(t.priority)) return false;
        if(overdueOnly&&!isOverdue(t)) return false;
        if(!matchesSearchDate(t)) return false;
        const isDone=t.status==="DONE"||t.status==="done"||t.status==="CLOSED";
        if(activeStatusFilter==="open"&&isDone) return false;
        if(activeStatusFilter==="done"&&!isDone) return false;
        return true;
      }
      function filteredTasks():Task[]{
        return sortTasks(allTasks.filter(t=>taskMatches(t)));
      }

      // ── Manager dashboard ──────────────────────────────────────────────
      const isDoneStatus=(t:Task)=>t.status==="DONE"||t.status==="done"||t.status==="CLOSED";
      const isOverdue=(t:Task)=>!isDoneStatus(t)&&!!t.dueDate&&new Date(t.dueDate).getTime()<Date.now();
      // Charts span all statuses (they describe the split), but honour the scoping
      // filters (team, store, type, priority, search, assigned-date) so the summary
      // reflects the same filters as the list. Status toggle + overdue chip are
      // intentionally excluded — the stats visualise that split.
      function chartBase():Task[]{
        return allTasks.filter(t=>{
          if(t.taskType==="audit-result") return false;
          if(!inTeam(t)) return false;
          if(activeInstallFilter!=="all"&&t.installationId!==activeInstallFilter) return false;
          if(activeTypeFilters.size>0){const key=t.taskType||"__none__";if(!activeTypeFilters.has(key)) return false;}
          if(prioritySet.size>0&&!prioritySet.has(t.priority)) return false;
          if(!matchesSearchDate(t)) return false;
          return true;
        });
      }
      // Build/refresh the team-member custom multiselect dropdown + visibility.
      let teamDropdown:{refresh:()=>void}|null=null;
      function renderTeamSelect(){
        if(!teamDdEl||!teamWrap) return;
        if(!teamMembers.length){ teamWrap.style.display="none"; return; }
        teamWrap.style.display="";
        if(!teamDropdown){
          teamDropdown=makeDropdown({
            wrap:teamDdEl, multi:true, allLabel:tr("allTeamMembers"),
            options:()=>teamMembers.map(m=>({value:m.id,label:m.name})),
            selected:()=>selectedMembers,
            onChange:(next)=>{ selectedMembers.clear(); next.forEach(v=>selectedMembers.add(v)); renderList(); },
          });
        } else teamDropdown.refresh();
      }
      // Donut ring (completion %). Pure inline SVG, no deps.
      function donut(pct:number,color:string):string{
        const r=26, c=2*Math.PI*r;
        const v=Math.max(0,Math.min(100,pct));
        const off=c*(1-v/100);
        // Round caps look nice mid-arc but leave an overlapping "lump" on a full
        // (100%) or empty (0%) ring — use butt caps at the extremes.
        const cap=(v>=100||v<=0)?"butt":"round";
        const fs=Math.round(v)>=100?13:16; // "100%" is wider — shrink so it fits the ring
        return `<svg width="72" height="72" viewBox="0 0 72 72" class="${p}-donut">
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="var(--border)" stroke-width="8"/>
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="${cap}"
            stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 36 36)"/>
          <text x="36" y="36" text-anchor="middle" dominant-baseline="central" class="${p}-donut-txt" style="font-size:${fs}px">${Math.round(v)}%</text>
        </svg>`;
      }
      function renderCharts(){
        if(!chartsEl) return;
        if(!showCharts){ chartsEl.style.display="none"; return; }
        const base=chartBase();
        const total=base.length;
        const done=base.filter(isDoneStatus).length;
        const open=total-done;
        const overdue=base.filter(isOverdue).length;
        const pct=total?done/total*100:0;
        // Priority split (open tasks only — that's what a manager acts on).
        const openTasks=base.filter(t=>!isDoneStatus(t));
        const pCount=(lv:string)=>openTasks.filter(t=>t.priority===lv).length;
        const p1=pCount("Priority_1"), p2=pCount("Priority_2"), p3=openTasks.length-p1-p2;

        if(!total){
          chartsEl.style.display="";
          chartsEl.innerHTML=`<div class="${p}-dash-empty">${esc(teamNote||tr("noTeamData"))}</div>`;
          return;
        }
        chartsEl.style.display="";

        // Per-member breakdown (open / done / overdue), busiest first, capped.
        const scope = selectedMembers.size ? teamMembers.filter(m=>selectedMembers.has(m.id)) : teamMembers;
        const memberRows = scope.map(m=>{
          const mine=base.filter(t=>t.assigneeIds.indexOf(m.id)!==-1);
          const mDone=mine.filter(isDoneStatus).length;
          const mOver=mine.filter(isOverdue).length;
          return {id:m.id, name:m.name, avatar:m.avatar, total:mine.length, open:mine.length-mDone, done:mDone, overdue:mOver};
        // Reports/userids: show the whole team (even members with no tasks).
        // "Everyone" is derived from assignees, so drop members with nothing here.
        }).filter(r=>teamSource!=="everyone"||r.total>0).sort((a,b)=>b.total-a.total);
        const CAP=4;
        // Cap to 4 unless expanded (a single selected member always shows).
        const canExpand = !selectedMembers.size && memberRows.length>CAP;
        const shown = (membersExpanded||selectedMembers.size) ? memberRows : memberRows.slice(0,CAP);
        const maxTotal=Math.max(1,...shown.map(r=>r.total));

        const memberHtml = shown.length ? shown.map(r=>{
          // Bar: done (green) · on-track open (amber) · overdue (red).
          const onTrack=Math.max(0,r.open-r.overdue);
          const dw=r.total?Math.round(r.done/maxTotal*100):0;
          const ow=r.total?Math.round(onTrack/maxTotal*100):0;
          const vw=r.total?Math.round(r.overdue/maxTotal*100):0;
          const av=r.avatar
            ?`<img class="${p}-dash-av" src="${esc(r.avatar)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="${p}-dash-av ${p}-dash-av-fb" style="display:none">${esc(initials(r.name))}</span>`
            :`<span class="${p}-dash-av ${p}-dash-av-fb">${esc(initials(r.name))}</span>`;
          return `<div class="${p}-dash-row${selectedMembers.has(r.id)?" active":""}" data-mid="${esc(r.id)}" role="button" tabindex="0" title="${tr("teamMember")}: ${esc(r.name)}">
            <div class="${p}-dash-name">${av}<span>${esc(r.name)}</span></div>
            <div class="${p}-dash-bar">
              <div class="${p}-dash-seg done" style="width:${dw}%" title="${tr("done")}: ${r.done}"></div>
              <div class="${p}-dash-seg open" style="width:${ow}%" title="${tr("open")}: ${onTrack}"></div>
              <div class="${p}-dash-seg over" style="width:${vw}%" title="${tr("overdueLabel")}: ${r.overdue}"></div>
            </div>
            <div class="${p}-dash-counts"><b>${r.open}</b> ${tr("open").toLowerCase()}${r.overdue?` · <span class="${p}-dash-over" title="${r.overdue} ${tr("overdueLabel").toLowerCase()}">${r.overdue}</span>`:""}</div>
          </div>`;
        }).join("")+(canExpand?`<button type="button" class="${p}-dash-toggle" id="${p}-members-toggle">${membersExpanded?tr("showFewer"):tr("showAllN").replace("{n}",String(memberRows.length))}</button>`:"") : "";

        const priBar=(label:string,n:number,color:string)=>{
          const w=openTasks.length?Math.round(n/openTasks.length*100):0;
          return `<div class="${p}-pri-row"><span class="${p}-pri-lbl">${esc(label)}</span><div class="${p}-pri-track"><div class="${p}-pri-fill" style="width:${w}%;background:${color}"></div></div><span class="${p}-pri-n">${n}</span></div>`;
        };

        chartsEl.innerHTML=`
          <div class="${p}-dash">
            <div class="${p}-stat-grid">
              <div class="${p}-stat">
                ${donut(pct, pct>=66?"var(--success)":pct>=33?"#D97706":"var(--error)")}
                <div class="${p}-stat-meta"><div class="${p}-stat-lbl">${tr("completionRate")}</div><div class="${p}-stat-sub">${done}/${total} ${tr("done").toLowerCase()}</div></div>
              </div>
              <div class="${p}-stat">
                <div class="${p}-stat-num ${overdue?"bad":""}">${overdue}</div>
                <div class="${p}-stat-meta"><div class="${p}-stat-lbl">${tr("overdueStat")}</div><div class="${p}-stat-sub">${tr("ofNOpen").replace("{n}",String(open))}</div></div>
              </div>
              <div class="${p}-stat">
                <div class="${p}-stat-num">${open}</div>
                <div class="${p}-stat-meta"><div class="${p}-stat-lbl">${tr("openTasks")}</div><div class="${p}-stat-sub">${total} ${tr("totalLabel")}</div></div>
              </div>
              <div class="${p}-stat ${p}-stat-pri">
                <div class="${p}-stat-lbl">${tr("byPriority")}</div>
                ${priBar(tr("priHigh"),p1,priorityColor("Priority_1"))}
                ${priBar(tr("priMed"),p2,priorityColor("Priority_2"))}
                ${priBar(tr("priLow"),p3,priorityColor("Priority_3"))}
              </div>
            </div>
            ${memberHtml?`<div class="${p}-dash-members"><div class="${p}-dash-h">${tr("byMember")}</div>${memberHtml}</div>`:""}
          </div>`;

        // Clicking a member row toggles them in the multiselect team filter.
        chartsEl.querySelectorAll(`.${p}-dash-row[data-mid]`).forEach(row=>{
          row.addEventListener("click",()=>{
            const mid=(row as HTMLElement).dataset.mid||"";
            if(selectedMembers.has(mid)) selectedMembers.delete(mid); else selectedMembers.add(mid);
            renderTeamSelect();
            renderList();
          });
        });
        const toggle=chartsEl.querySelector(`#${p}-members-toggle`);
        toggle?.addEventListener("click",()=>{ membersExpanded=!membersExpanded; renderCharts(); });
      }

      // ── Activity feed ──────────────────────────────────────────────────
      const ordinal=(n:number):string=>{ const v=n%100, s=["th","st","nd","rd"]; return n+(s[(v-20)%10]||s[v]||s[0]); };
      // Human cadence from a recurring template's [rrule:] tag → "every Friday" etc.
      function describeRrule(desc:string):string{
        const m=RRULE_REGEX.exec(desc); if(!m) return tr("cadDaily");
        const kv:Record<string,string>={};
        m[0].replace(/^\[rrule:\s*/i,"").replace(/\]$/,"").split(";").forEach(part=>{ const i=part.indexOf("="); if(i>0) kv[part.slice(0,i).trim()]=part.slice(i+1).trim(); });
        const DN:Record<string,string>={SU:"Sunday",MO:"Monday",TU:"Tuesday",WE:"Wednesday",TH:"Thursday",FR:"Friday",SA:"Saturday"};
        const f=(kv.f||"DAILY").toUpperCase();
        if(f==="WEEKLY"){
          const days=(kv.d||"").split(",").map(s=>s.trim().toUpperCase()).filter(d=>DN[d]);
          if(!days.length) return tr("cadDaily");
          if(days.length===5 && ["MO","TU","WE","TH","FR"].every(d=>days.indexOf(d)!==-1)) return tr("cadWeekdays");
          if(days.length===1) return tr("cadWeeklyEvery").replace("{d}",DN[days[0]]);
          return tr("cadWeeklyDays").replace("{d}",days.map(d=>DN[d]+"s").join(", "));
        }
        if(f==="MONTHLY"){ const n=parseInt(kv.dom||"",10); if(!isNaN(n)) return tr("cadMonthlyDom").replace("{n}",ordinal(n)); return tr("cadMonthly"); }
        return tr("cadDaily");
      }
      // Assignee + group names for a task (joined). Empty string when unassigned.
      function assigneeNames(t:Task):string{
        const names=t.assigneeIds.map(a=>displayNameSync(a));
        const groups=t.groupIds.map(g=>groupMap.get(g)||"").filter(Boolean);
        return [...names,...groups].join(", ");
      }
      // Decode HTML entities so extracted plain text is real text (e.g. "&amp;"
      // → "&"). Comments are stored as HTML, so a title's "&" arrives escaped;
      // without this it would be re-escaped by esc() and render as "&amp;".
      const decodeEntities=(s:string)=>{ if(s.indexOf("&")<0) return s; const el=document.createElement("textarea"); el.innerHTML=s; return el.value; };
      const stripTags=(h:string)=>decodeEntities(h.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
      const commentPlain=(c:any)=>stripTags(commentText(c));
      const isEditComment=(txt:string)=>txt.trim().indexOf(EDIT_MARK)===0;
      const editAction=(txt:string)=>txt.trim().slice(EDIT_MARK.length).trim();

      type ActEv={ whoName?:string; avatar?:string; body:string; when:number; iso:string; taskId?:string };
      // Honours the active store + team scope (same as chartBase) so the feed
      // matches the view. Completion is inferred from task status (every closed
      // task yields a "completed" event) so it shows regardless of the comment
      // window; a fetched [tasks:edit] comment then enriches it with the real
      // actor, timestamp, and a "with proof" badge.
      // Effective activity-feed scope: the full-page log uses its own store/person/
      // type/priority/date filters; the dashboard follows the store tabs + team +
      // type filter (globals) and applies no priority/date narrowing.
      function activityScope(){
        const instF = activityFull ? activityInstallFilter : activeInstallFilter;
        const memF  = activityFull ? activityMembers : selectedMembers;
        const typeF = activityFull ? activityTypeFilters : activeTypeFilters;
        const priF  = activityFull ? activityPriorities : new Set<string>();
        const fromMs= activityFull && activityFrom ? Date.parse(`${activityFrom}T00:00:00`) : 0;
        const toMs  = activityFull && activityTo   ? Date.parse(`${activityTo}T23:59:59.999`) : 0;
        const inScope=(t:Task)=> t.taskType!=="audit-result" && inTeamWith(t,memF)
          && (instF==="all" || t.installationId===instF)
          && (typeF.size===0 || typeF.has(t.taskType||"__none__"))
          && (priF.size===0 || priF.has(t.priority));
        const withinDate=(when:number)=> (!fromMs||when>=fromMs) && (!toMs||when<=toMs);
        return {instF, memF, typeF, priF, fromMs, toMs, inScope, withinDate};
      }
      function buildActivityEvents():ActEv[]{
        const byId=new Map<string,any>((allUsersRaw||[]).map(u=>[u.id,u]));
        const nameOf=(id:string):string=>{ const u=byId.get(id); if(u) return userDisplayName(u); const m=teamMembers.find(x=>x.id===id); return m?m.name:tr("someone"); };
        const avOf=(id:string):string=>{ const u=byId.get(id); return u?userAvatarUrl(u):""; };
        const q=(s:string)=>`<span class="${p}-act-task">“${esc(ct(s))}”</span>`;
        const {inScope, withinDate}=activityScope();
        const evs:ActEv[]=[];
        // ── Photo-proof map (built first so status-based completions can carry a
        // "with proof" badge even before their completion comment is fetched). ──
        const proofByTask=new Map<string,Array<{author:string;when:number}>>();
        activityComments.forEach((comments,taskId)=>{
          for(const c of comments){
            if(!isProofComment(c)) continue;
            const iso=c.createdAt||c.created||c.createDate||c.updateDate||"";
            const arr=proofByTask.get(taskId)||[];
            arr.push({ author:commentAuthorId(c), when:iso?Date.parse(iso):0 });
            proofByTask.set(taskId,arr);
          }
        });
        const PROOF_WINDOW=15*60*1000;
        const hasProofFor=(taskId:string,author:string,when:number):boolean=>{
          const arr=proofByTask.get(taskId); if(!arr||!arr.length) return false;
          return arr.some(pr=>(!author||!pr.author||pr.author===author)&&(!when||!pr.when||Math.abs(pr.when-when)<=PROOF_WINDOW));
        };
        const camIco=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
        const proofBadge=`<span class="${p}-act-proof">${camIco}${esc(tr("withProof"))}</span>`;
        // Status-based completion events, keyed by task so a fetched completion
        // comment can enrich them in place (real author + accurate timestamp).
        const completionEv=new Map<string,ActEv>();
        // Now honours the effective (activity-scoped in full mode) store/team/type/
        // priority filters — inScope encapsulates them all.
        const activityBase=allTasks.filter(inScope);
        for(const t of activityBase){
          const created=t.createDate?Date.parse(t.createDate):0;
          // Tasks created via the widget carry [by:<id>] (the token is the real
          // creatorId); prefer it, fall back to creatorId, else stays "someone".
          const byM=(t.description||"").match(/\[by:\s*([^\]]+)\]/i);
          const creator=(byM&&byM[1].trim())||t.creatorId||"";
          if(t.isRecurring){
            evs.push({ taskId:t.id, body:`${tr("actRecurringInstanceFor").replace("{who}",esc(assigneeNames(t)||tr("unassignedLabel")))} ${q(t.title)}`, when:created, iso:t.createDate||"" });
          } else if(creator){
            const self = t.assigneeIds.length===1 && t.groupIds.length===0 && t.assigneeIds[0]===creator;
            const phrase = self ? tr("actCreatedSelf")
              : assigneeNames(t) ? tr("actCreatedFor").replace("{who}",esc(assigneeNames(t)))
              : tr("actCreatedPlain");
            evs.push({ taskId:t.id, whoName:nameOf(creator), avatar:avOf(creator), body:`${phrase} ${q(t.title)}`, when:created, iso:t.createDate||"" });
          }
          // Every closed task yields a completion event, inferred purely from
          // status so it shows regardless of whether a completion comment was
          // fetched (fixes completions vanishing behind the comment window). It
          // reads "Someone completed …" until a comment supplies the real actor.
          if(isDoneStatus(t)){
            const updT=t.updateDate?Date.parse(t.updateDate):created;
            let body=`${esc(tr("someone"))} ${esc(tr("actCompleted"))} ${q(t.title)}`;
            if(hasProofFor(t.id,"",0)) body+=proofBadge;
            const ev:ActEv={ taskId:t.id, body, when:updT, iso:t.updateDate||t.createDate||"" };
            evs.push(ev); completionEv.set(t.id,ev);
          }
        }
        for(const t of recurTemplates){
          if(!inScope(t)) continue; // recurring schedules respect the store/team filter too
          const iso=t.createDate||"";
          // Templates are created via the API token, so the real author is stamped
          // as [by:<userId>] by the recurring widget — prefer it over creatorId.
          const by=(t.description||"").match(/\[by:\s*([^\]]+)\]/i);
          const author=(by&&by[1].trim())||t.creatorId||"";
          const phrase=tr("actAddedRecurringFor").replace("{who}",esc(assigneeNames(t)||tr("unassignedLabel")));
          evs.push({ whoName:author?nameOf(author):undefined, avatar:author?avOf(author):"",
            body:`${phrase} · ${esc(describeRrule(t.description||""))} ${q(t.title)}`, when:iso?Date.parse(iso):0, iso });
        }
        // Comments + hidden [tasks:edit] markers (fetched by loadActivityComments).
        // A "[tasks:edit] completed" comment enriches the status-based completion
        // event in place (real author + timestamp + proof badge) rather than
        // adding a second row; other comments/edits surface as their own events.
        activityComments.forEach((comments,taskId)=>{
          const t=allTasks.find(x=>x.id===taskId); if(!t||!inScope(t)) return;
          for(const c of comments){
            if(isProofComment(c)) continue; // folded into the completion event
            const txt=commentPlain(c); if(!txt) continue;
            const author=commentAuthorId(c);
            const iso=c.createdAt||c.created||c.createDate||c.updateDate||"";
            const when=iso?Date.parse(iso):0;
            const isEdit=isEditComment(txt);
            const action=isEdit?editAction(txt):"";
            const isCompletion=isEdit && /^completed\b/i.test(action);
            if(isCompletion){
              // Completions that carried photo proof (stamped inline as "… with
              // proof" or with a nearby [proof] comment) show a "with proof" badge.
              const withProof=/\bwith proof\b/i.test(action) || hasProofFor(t.id,author,when);
              const body=(withProof?esc(action.replace(/\s*with proof\s*$/i,""))+proofBadge:esc(action));
              const ev=completionEv.get(t.id);
              if(ev){ // enrich the status-inferred event with the real actor
                ev.whoName=author?nameOf(author):ev.whoName;
                ev.avatar=author?avOf(author):ev.avatar;
                ev.body=body;
                if(when){ ev.when=when; ev.iso=iso; }
              } else {
                evs.push({ taskId:t.id, whoName:author?nameOf(author):undefined, avatar:author?avOf(author):"", body, when, iso });
              }
              continue;
            }
            // Edit markers carry a self-contained action (incl. the task name);
            // real comments read "commented on '<task>'".
            const body=isEdit?esc(action):`${tr("actCommented")} ${q(t.title)}`;
            evs.push({ taskId:t.id, whoName:author?nameOf(author):undefined, avatar:author?avOf(author):"", body, when, iso });
          }
        });
        // Event-date range (full log only): filter by when the event happened.
        // Deliberately separate from the assigned-date filter, and only applies
        // when the manager sets it, so completions on older tasks stay visible by
        // default.
        const dated=evs.filter(e=>withinDate(e.when));
        return dated.sort((a,b)=>b.when-a.when);
      }
      // Fetch comments for the most-recently-touched tasks in scope (ordered by
      // max(createDate, updateDate)), in batches, so completions get their real
      // author + proof badge AND reassignments/reopens/comments surface even on
      // older tasks (any change bumps updateDate). `maxTasks` scales with the
      // view: ACT_RECENT on the dashboard, ACT_FULL+ in the full log.
      async function loadActivityComments(maxTasks:number){
        const {inScope}=activityScope();
        const touched=(t:Task)=>Math.max(
          t.createDate?Date.parse(t.createDate):0,
          t.updateDate?Date.parse(t.updateDate):0);
        const need=allTasks
          .filter(t=>inScope(t)&&!activityComments.has(t.id))
          .sort((a,b)=>touched(b)-touched(a))
          .slice(0,maxTasks)
          .map(t=>({id:t.id,inst:t.installationId}));
        if(!need.length) return false;
        for(let i=0;i<need.length;i+=8){
          const batch=need.slice(i,i+8);
          await Promise.all(batch.map(async n=>{
            if(activityComments.has(n.id)) return;
            try{
              const r=await fetch(`${baseUrl}/tasks/${n.inst}/task/${n.id}/comments`,apiOpts());
              const d:any=r.ok?await r.json():null;
              activityComments.set(n.id, Array.isArray(d)?d:(d?.data||[]));
            }catch(_){ activityComments.set(n.id,[]); }
          }));
        }
        return true; // caller re-renders
      }
      // Hide/show the rest of the tasks view so the activity log can go full-page.
      function setActivityFull(on:boolean){
        if(!tasksViewEl) return;
        if(on){
          if(activityFull) return;
          activityFull=true; activityLimit=ACT_FULL;
          // Seed the log's own filters from the dashboard's current scope.
          activityInstallFilter=activeInstallFilter;
          activityMembers.clear(); selectedMembers.forEach(v=>activityMembers.add(v));
          activityTypeFilters.clear(); activeTypeFilters.forEach(v=>activityTypeFilters.add(v));
          activityPriorities.clear(); prioritySet.forEach(v=>activityPriorities.add(v));
          activityFrom=""; activityTo=""; // event-date range starts unset
          actHiddenSiblings.length=0;
          Array.from(tasksViewEl.children).forEach(ch=>{
            const el=ch as HTMLElement; if(el===activityEl) return;
            actHiddenSiblings.push([el, el.style.display]); el.style.display="none";
          });
          if(vtabsEl){ actHiddenSiblings.push([vtabsEl, vtabsEl.style.display]); vtabsEl.style.display="none"; }
        } else {
          if(!activityFull) return;
          activityFull=false; activityLimit=ACT_RECENT; activityLoadingMore=false;
          if(self._mgrActScroll){ window.removeEventListener("scroll",self._mgrActScroll); self._mgrActScroll=null; }
          actHiddenSiblings.forEach(([el,d])=>{ el.style.display=d; });
          actHiddenSiblings.length=0;
        }
      }
      function renderActivity(){
        if(!activityEl) return;
        if(!showCharts){ activityEl.style.display="none"; return; }
        const all=buildActivityEvents();
        if(!all.length){
          activityEl.style.display="none";
          if(!activityCommentsLoaded){ activityCommentsLoaded=true; loadActivityComments(ACT_RECENT).then(ok=>{ if(ok) renderActivity(); }); }
          return;
        }
        activityEl.style.display="";
        // One-time: enrich the initial window with comments (author + proof badge
        // + comment rows). Task-based events already render without this.
        if(!activityCommentsLoaded){
          activityCommentsLoaded=true;
          loadActivityComments(activityFull?ACT_FULL:ACT_RECENT).then(ok=>{ if(ok) renderActivity(); });
        }
        const shown=all.slice(0,activityLimit);
        const sysIco=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="12 7 12 12 15 14"/></svg>`;
        const rows=shown.map(e=>{
          const av = e.whoName
            ? (e.avatar
                ?`<img class="${p}-act-av" src="${esc(e.avatar)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="${p}-act-av fb" style="display:none">${esc(initials(e.whoName))}</span>`
                :`<span class="${p}-act-av fb">${esc(initials(e.whoName))}</span>`)
            : `<span class="${p}-act-av ${p}-act-sys">${sysIco}</span>`;
          const time=e.iso?commentTime(e.iso):"";
          const lead=e.whoName?`<b>${esc(e.whoName)}</b> `:"";
          const open=e.taskId?` data-task-id="${esc(e.taskId)}" role="button" tabindex="0"`:"";
          return `<div class="${p}-act-item${e.taskId?" clickable":""}"${open}>${av}<div class="${p}-act-body">${lead}${e.body}</div>${time?`<span class="${p}-act-time">${esc(time)}</span>`:""}</div>`;
        }).join("");
        const backIco=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
        const actCalIco=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
        // Store + type option lists for the full-log filter bar, scoped to the
        // log's current store selection.
        const actInstMap=new Map<string,string>();
        const actTypeSet=new Set<string>();
        for(const t of allTasks){
          if(t.taskType==="audit-result") continue;
          if(!actInstMap.has(t.installationId)) actInstMap.set(t.installationId,t.installationTitle||t.installationId);
          if((activityInstallFilter==="all"||t.installationId===activityInstallFilter) && t.taskType) actTypeSet.add(t.taskType);
        }
        const actTypeOpts=[...actTypeSet].sort();
        const showActStore=actInstMap.size>1;
        const showActPerson=teamMembers.length>0;
        const showActType=actTypeOpts.length>1;
        const dateBar=`<div class="${p}-daterange" id="${p}-act-daterange">${actCalIco}<span class="${p}-date-lbl">${tr("activityDateLabel")}</span><input type="date" class="${p}-date-in" id="${p}-act-date-from" aria-label="${tr("activityDateFrom")}" value="${esc(activityFrom)}"><span class="${p}-date-sep">${tr("dateToLabel")}</span><input type="date" class="${p}-date-in" id="${p}-act-date-to" aria-label="${tr("activityDateTo")}" value="${esc(activityTo)}"></div>`;
        const filterBar = activityFull
          ? `<div class="${p}-act-filters">${showActStore?`<div class="${p}-act-dd" id="${p}-act-store-dd"></div>`:""}${showActPerson?`<div class="${p}-act-dd" id="${p}-act-person-dd"></div>`:""}${showActType?`<div class="${p}-act-dd" id="${p}-act-type-dd"></div>`:""}<div class="${p}-act-dd" id="${p}-act-prio-dd"></div>${dateBar}</div>`
          : "";
        const header = activityFull
          ? `<div class="${p}-act-fh"><button type="button" class="${p}-act-back" id="${p}-act-back">${backIco}${esc(tr("backLabel"))}</button><span class="${p}-act-h" style="margin:0">${tr("activityLog")}</span></div>${filterBar}`
          : `<div class="${p}-act-h">${tr("recentActivity")}</div>`;
        const hasMore=all.length>activityLimit;
        const footer = activityFull
          ? (activityLoadingMore
              ? `<div class="${p}-act-loading"><span class="${p}-spin"></span>${esc(tr("loadingMore"))}</div>`
              : (hasMore?`<div class="${p}-act-more-hint">${esc(tr("scrollForMore"))}</div>`:""))
          : (all.length>activityLimit?`<button type="button" class="${p}-dash-toggle" id="${p}-act-toggle">${tr("viewMoreActivity")}</button>`:"");
        activityEl.innerHTML=`${header}
          <div class="${p}-act-list${activityFull?" full":""}" id="${p}-act-list">${rows}</div>
          ${footer}`;
        // Clicking an activity row opens the related task.
        activityEl.querySelectorAll(`.${p}-act-item[data-task-id]`).forEach(it=>{
          it.addEventListener("click",()=>{
            const id=(it as HTMLElement).dataset.taskId; const t=allTasks.find(x=>x.id===id);
            if(t) openDetail(t);
          });
        });
        if(activityFull){
          pruneDropdowns(); // drop detached dropdown entries from prior renders
          activityEl.querySelector(`#${p}-act-back`)?.addEventListener("click",()=>{ setActivityFull(false); renderActivity(); window.scrollTo({top:0}); });
          // Re-fetch comments for the newly-visible tasks after a filter change,
          // then repaint (activityCommentsLoaded is already true by now).
          const refetch=()=>{ renderActivity(); loadActivityComments(activityLimit).then(ok=>{ if(ok) renderActivity(); }); };
          const storeDd=activityEl.querySelector(`#${p}-act-store-dd`) as HTMLElement|null;
          if(storeDd) makeDropdown({
            wrap:storeDd, multi:false, allLabel:tr("allStores"),
            options:()=>[{value:"all",label:tr("allStores")}].concat([...actInstMap.entries()].map(([id,title])=>({value:id,label:title}))),
            selected:()=>new Set([activityInstallFilter]),
            onChange:(next)=>{ activityInstallFilter=[...next][0]||"all"; refetch(); },
          });
          const personDd=activityEl.querySelector(`#${p}-act-person-dd`) as HTMLElement|null;
          if(personDd) makeDropdown({
            wrap:personDd, multi:true, allLabel:tr("allPeople"),
            options:()=>teamMembers.map(mm=>({value:mm.id,label:mm.name})),
            selected:()=>activityMembers,
            onChange:(next)=>{ activityMembers.clear(); next.forEach(v=>activityMembers.add(v)); refetch(); },
          });
          const typeDd=activityEl.querySelector(`#${p}-act-type-dd`) as HTMLElement|null;
          if(typeDd) makeDropdown({
            wrap:typeDd, multi:true, allLabel:tr("allTypes"),
            options:()=>actTypeOpts.map(k=>({value:k,label:k})),
            selected:()=>activityTypeFilters,
            onChange:(next)=>{ activityTypeFilters.clear(); next.forEach(v=>activityTypeFilters.add(v)); refetch(); },
          });
          const prioDd=activityEl.querySelector(`#${p}-act-prio-dd`) as HTMLElement|null;
          if(prioDd) makeDropdown({
            wrap:prioDd, multi:true, allLabel:tr("allPriorities"),
            options:()=>[
              {value:"Priority_1",label:tr("priHigh"),color:"#C41E3A"},
              {value:"Priority_2",label:tr("priMed"),color:"#D97706"},
              {value:"Priority_3",label:tr("priLow"),color:"#6b7280"},
            ],
            selected:()=>activityPriorities,
            onChange:(next)=>{ activityPriorities.clear(); next.forEach(v=>activityPriorities.add(v)); refetch(); },
          });
          // Event-date range: filters visible events by their timestamp only, so it
          // doesn't change which tasks' comments we fetch — a plain re-render is enough.
          const actFrom=activityEl.querySelector(`#${p}-act-date-from`) as HTMLInputElement|null;
          const actTo=activityEl.querySelector(`#${p}-act-date-to`) as HTMLInputElement|null;
          actFrom?.addEventListener("change",()=>{ activityFrom=actFrom.value||""; renderActivity(); });
          actTo?.addEventListener("change",()=>{ activityTo=actTo.value||""; renderActivity(); });
          // Infinite scroll: when near the bottom, grow the window and fetch more.
          if(self._mgrActScroll){ window.removeEventListener("scroll",self._mgrActScroll); self._mgrActScroll=null; }
          if(hasMore && !activityLoadingMore){
            const onScroll=()=>{
              if(activityLoadingMore||!activityFull) return;
              if(window.innerHeight+window.scrollY >= document.body.offsetHeight-400){
                window.removeEventListener("scroll",onScroll); self._mgrActScroll=null;
                activityLoadingMore=true; renderActivity();
                loadActivityComments(activityLimit+ACT_STEP).then(()=>{ activityLimit+=ACT_STEP; activityLoadingMore=false; renderActivity(); });
              }
            };
            self._mgrActScroll=onScroll;
            window.addEventListener("scroll",onScroll,{passive:true});
          }
        } else {
          activityEl.querySelector(`#${p}-act-toggle`)?.addEventListener("click",()=>{
            setActivityFull(true); activityLoadingMore=true; renderActivity();
            loadActivityComments(ACT_FULL).then(()=>{ activityLoadingMore=false; renderActivity(); });
            window.scrollTo({top:0});
          });
        }
      }

      // ── Store tabs ────────────────────────────────────────────────────
      function renderStoreTabs(){
        // The tab bar only exists for multi-store widgets; base that on the full
        // task set so it doesn't appear/disappear as filters narrow the results.
        const titleOf=new Map<string,string>();
        for(const t of allTasks){ if(t.taskType==="audit-result") continue; if(!titleOf.has(t.installationId)) titleOf.set(t.installationId,t.installationTitle||t.installationId); }
        if(titleOf.size<=1){storeTabs.style.display="none";return;}

        // Per-store counts under the current filters (everything except the store
        // filter itself, so each pill reflects what selecting it would show). A
        // store with no matches is hidden — unless it's the active one, so you can
        // always navigate back out of an empty filtered store.
        const count=new Map<string,number>();
        let total=0;
        for(const t of allTasks){ if(taskMatches(t,true)){ count.set(t.installationId,(count.get(t.installationId)||0)+1); total++; } }

        storeTabs.style.display="flex";
        const entries=[...titleOf.entries()].filter(([id])=>(count.get(id)||0)>0||id===activeInstallFilter);
        storeTabs.innerHTML=`
          <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter==="all"?"active":""}" data-inst="all">
            All <span style="opacity:.6;font-weight:400">(${total})</span>
          </div>
          ${entries.map(([id,title])=>`
            <div role="button" tabindex="0" class="${p}-store-tab ${activeInstallFilter===id?"active":""}" data-inst="${esc(id)}">
              ${esc(title||id)} <span style="opacity:.6;font-weight:400">(${count.get(id)||0})</span>
            </div>`).join("")}`;
        storeTabs.querySelectorAll(`.${p}-store-tab`).forEach(btn=>{
          btn.addEventListener("click",()=>{
            activeInstallFilter=(btn as HTMLElement).dataset.inst||"all";
            activeTypeFilters.clear(); dropdownOpen=false;
            renderTypeFilters(); renderList();
          });
        });
      }

      // ── Audit tabs ────────────────────────────────────────────────────
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

      if(typeBtn) typeBtn.addEventListener("click",e=>{e.stopPropagation();closeAllDD();dropdownOpen=!dropdownOpen;renderTypeFilters();});
      const onDocClick = () => { if (dropdownOpen) { dropdownOpen = false; renderTypeFilters(); } };
      document.addEventListener("click", onDocClick);
      self._mgrDocClick = onDocClick;

      // ── Generic custom dropdown (single / multi select) ────────────────
      // Replaces native <select>s with a styled dropdown matching the type
      // filter. Multi uses a Set (empty = "all"); single stores one value and
      // closes on pick. All instances share one document-click closer.
      type DDOpt={ value:string; label:string; color?:string };
      interface DDCfg{
        wrap:HTMLElement; multi:boolean; allLabel:string;
        options:()=>DDOpt[]; selected:()=>Set<string>;
        onChange:(next:Set<string>)=>void;
        label?:(sel:Set<string>,opts:DDOpt[])=>string;
      }
      const dropdowns:Array<{refresh:()=>void;wrap:HTMLElement}>=[];
      let openDD:HTMLElement|null=null;
      const ddCaret=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      const ddCheck=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      const refreshDropdowns=()=>dropdowns.forEach(d=>d.refresh());
      const closeAllDD=()=>{ if(openDD){ openDD=null; refreshDropdowns(); } };
      function makeDropdown(cfg:DDCfg){
        const wrap=cfg.wrap; wrap.classList.add(`${p}-type-wrap`);
        wrap.innerHTML=`<button type="button" class="${p}-type-btn"><span></span>${ddCaret}</button><div class="${p}-type-menu"></div>`;
        const btn=wrap.querySelector(`.${p}-type-btn`) as HTMLButtonElement;
        const labelSpan=btn.querySelector("span") as HTMLElement;
        const menu=wrap.querySelector(`.${p}-type-menu`) as HTMLElement;
        const defaultLabel=(sel:Set<string>,opts:DDOpt[]):string=>{
          if(sel.size===0) return cfg.allLabel;
          const chosen=opts.filter(o=>sel.has(o.value));
          if(chosen.length===1) return chosen[0].label;
          if(chosen.length===0) return cfg.allLabel;
          return tr("nSelected").replace("{n}",String(chosen.length));
        };
        function refresh(){
          const open=openDD===wrap;
          const sel=cfg.selected(); const opts=cfg.options();
          labelSpan.textContent=(cfg.label||defaultLabel)(sel,opts);
          btn.classList.toggle("open",open); menu.classList.toggle("open",open);
          const rows:string[]=[];
          if(cfg.multi){
            const allOn=sel.size===0;
            rows.push(`<button type="button" class="${p}-type-opt ${allOn?"active":""}" data-v="__all__"><span style="width:12px;display:flex;align-items:center;justify-content:center">${allOn?ddCheck:""}</span>${esc(cfg.allLabel)}</button><div style="height:1px;background:var(--border);margin:2px 0"></div>`);
          }
          for(const o of opts){
            const on=sel.has(o.value);
            const dot=o.color?`<span class="${p}-type-dot" style="background:${o.color}"></span>`:"";
            rows.push(`<button type="button" class="${p}-type-opt ${on?"active":""}" data-v="${esc(o.value)}"><span style="width:12px;display:flex;align-items:center;justify-content:center">${on?ddCheck:""}</span>${dot}${esc(o.label)}</button>`);
          }
          menu.innerHTML=rows.join("");
          menu.querySelectorAll(`.${p}-type-opt`).forEach(b=>{
            b.addEventListener("click",e=>{
              e.stopPropagation();
              const v=(b as HTMLElement).dataset.v!;
              const next=new Set(cfg.selected());
              if(cfg.multi){
                if(v==="__all__") next.clear();
                else if(next.has(v)) next.delete(v); else next.add(v);
              }else{
                next.clear(); next.add(v); openDD=null; // single: pick + close
              }
              cfg.onChange(next);
              refreshDropdowns();
            });
          });
        }
        btn.addEventListener("click",e=>{ e.stopPropagation(); if(dropdownOpen){dropdownOpen=false;renderTypeFilters();} openDD=openDD===wrap?null:wrap; refreshDropdowns(); });
        const entry={refresh,wrap}; dropdowns.push(entry); refresh(); return entry;
      }
      // Drop dropdown entries whose DOM was replaced (e.g. proof-bar rebuilds),
      // so refreshDropdowns() doesn't operate on detached nodes indefinitely.
      function pruneDropdowns(){ for(let i=dropdowns.length-1;i>=0;i--){ if(!dropdowns[i].wrap.isConnected) dropdowns.splice(i,1); } }
      const onDocClickDD=()=>closeAllDD();
      document.addEventListener("click",onDocClickDD);
      self._mgrDocClickDD=onDocClickDD;

      // Priority filter (multiselect) + Sort (single) custom dropdowns.
      if(prioDdEl) makeDropdown({
        wrap:prioDdEl, multi:true, allLabel:tr("allPriorities"),
        options:()=>[
          {value:"Priority_1",label:tr("priHigh"),color:"#C41E3A"},
          {value:"Priority_2",label:tr("priMed"),color:"#D97706"},
          {value:"Priority_3",label:tr("priLow"),color:"#6b7280"},
        ],
        selected:()=>prioritySet,
        onChange:(next)=>{ prioritySet.clear(); next.forEach(v=>prioritySet.add(v)); renderList(); },
      });
      if(sortDdEl) makeDropdown({
        wrap:sortDdEl, multi:false, allLabel:tr("sortDue"),
        options:()=>[
          {value:"due",label:tr("sortDue")},
          {value:"priority",label:tr("sortPriority")},
          {value:"assignee",label:tr("sortAssignee")},
          {value:"created",label:tr("sortNewest")},
        ],
        selected:()=>new Set([sortBy]),
        onChange:(next)=>{ sortBy=[...next][0]||"due"; renderList(); },
      });

      // ── Render task list ──────────────────────────────────────────────
      function renderList(){
        renderStoreTabs(); // keep the store pills' counts + visibility in sync with the filters
        renderCharts();
        renderActivity();
        const tasks=filteredTasks();
        countEl.textContent=String(tasks.length);
        if(!tasks.length){
          // No resolved team (e.g. reports mode with no direct reports) → say so.
          const emptyMsg=teamNote
            ?teamNote
            :allTasks.filter(t=>t.taskType!=="audit-result").length===0
            ?tr("noTasksFound")
            :activeStatusFilter==="open"?tr("allCaughtUpPersonal"):tr("noCompletedTasks");
          const allDoneIcon=`<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
          const emptyIcon=`<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
          listWrap.innerHTML=`<div class="${p}-state">
            <span class="${p}-state-icon">${activeStatusFilter==="open"&&allTasks.length>0?allDoneIcon:emptyIcon}</span>
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
      let detailAssignTab: "group"|"person" = "group";

      function openDetail(task:Task){
        detailTask=task;
        detailAssignTab="group";
        const isWide=window.innerWidth>=720; // side panel on desktop, bottom sheet on mobile (viewport-based, not column width)
        detailEl.classList.toggle("side",isWide);
        renderDetailContent(task);
        overlayEl.classList.add("open");
        void detailEl.offsetWidth; // commit the closed (centered) state so the first open animates from it, not from the bottom
        requestAnimationFrame(()=>detailEl.classList.add("open"));
      }

      function closeDetail(){
        overlayEl.classList.remove("open");
        detailEl.classList.remove("open");
        detailEl.style.bottom="";
        detailTask=null;
      }

      detailEl.addEventListener("click",e=>e.stopPropagation());

      // Lift the bottom-sheet above the on-screen keyboard (mobile). Pinning to
      // bottom:0 puts the composer behind the keyboard and it can't scroll past
      // its own end, so we raise the whole sheet by the keyboard height instead.
      const vv:any=(window as any).visualViewport;
      const onViewport=()=>{
        if(!detailTask||detailEl.classList.contains("side")){ detailEl.style.bottom=""; return; }
        if(!vv) return;
        const kb=Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        detailEl.style.bottom = kb>80 ? kb+"px" : "";
      };
      if(vv){ vv.addEventListener("resize",onViewport); vv.addEventListener("scroll",onViewport); self._mgrVV=onViewport; }

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
        const showAssignTabs=(hasGroup||hasAssignee)&&allowAssign;
        // Resolve an assignee id to a display name (teamMembers → /users → id).
        const nameForUid=(id:string):string=>{ const m=teamMembers.find(x=>x.id===id); if(m) return m.name; const u=(allUsersRaw||[]).find(x=>x.id===id); return u?userDisplayName(u):id; };

        let assigneeHtml="";
        if(hasGroup||hasAssignee){
          if(showAssignTabs){
            const groupNames=task.groupIds.map(gid=>groupName(gid)).filter(Boolean);
            const groupHtml=groupNames.map(gn=>`<div class="${p}-detail-meta-row">${iGroup} ${esc(gn)}</div>`).join("")||`<div style='font-size:12px;color:var(--gray-lt)'>${tr("noGroupAssigned")}</div>`;
            const personHtml=task.assigneeIds.length>0?task.assigneeIds.map(aid=>`<div class="${p}-detail-meta-row" data-uid="${esc(aid)}">${iUser} <span>${esc(nameForUid(aid))}</span></div>`).join(""):`<div style='font-size:12px;color:var(--gray-lt)'>${tr("noIndividualAssignee")}</div>`;
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
            const af = cleanDesc ? parseAuditFinding(cleanDesc) : null;
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
          <div class="${p}-proof-sec" id="${p}-proof-sec-${instId}" style="display:none"></div>
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
        renderProofSection(task);

        // Resolve assignee IDs → names (shown in the Person tab).
        detailBody.querySelectorAll(`.${p}-detail-meta-row[data-uid]`).forEach(row=>{
          const uid=(row as HTMLElement).dataset.uid||"";
          fetchUser(uid).then(u=>{ const s=row.querySelector("span"); if(s&&u.name) s.textContent=u.name; });
        });

        // Reassign control (manager view: gated only by allowtaskassignment)
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
      const onDocKey = (e: KeyboardEvent) => { if (e.key === "Escape" && detailTask) closeDetail(); };
      document.addEventListener("keydown", onDocKey);
      self._mgrDocKey = onDocKey;
      detailToggle.addEventListener("click",async()=>{
        if(!detailTask) return;
        const task=detailTask;
        const isDone=task.status==="DONE"||task.status==="done"||task.status==="CLOSED";
        const newStatus=isDone?"OPEN":"CLOSED";
        detailToggle.disabled=true;
        try {
          const res=await fetch(`${baseUrl}/tasks/${task.installationId}/task/${task.id}`,{method:"PATCH",...apiOpts(),body:JSON.stringify({status:newStatus})});
          if(!res.ok) throw new Error(`HTTP ${res.status}`);
          task.status=newStatus;
          // Records who actually did it (the logged-in user) for the activity feed.
          postEditComment(task, statusAction(task,newStatus));
          renderDetailContent(task);
          const cardEl=listWrap.querySelector(`[data-task-id="${task.id}"]`) as HTMLElement|null;
          if(cardEl){if(!isDone)cardEl.classList.add("done");else cardEl.classList.remove("done");}
          setTimeout(()=>{renderTypeFilters();renderList();},380);
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
          if(task){ task.status=newStatus; postEditComment(task, statusAction(task,newStatus)); }
          setTimeout(()=>{renderTypeFilters();renderList();},420);
        } catch(e:any){
          if(!isDone){checkEl.classList.remove("checked");if(cardEl)cardEl.classList.remove("done");}
          else{checkEl.classList.add("checked");if(cardEl)cardEl.classList.add("done");}
          showBanner("error",`Could not update task: ${e.message}`);
          checkEl.style.pointerEvents="";
        }
      }

      // ── Status filter ─────────────────────────────────────────────────
      container.querySelectorAll(`.${p}-status-opt`).forEach((btn: Element)=>{
        btn.addEventListener("click",()=>{
          container.querySelectorAll(`.${p}-status-opt`).forEach((b: Element)=>b.classList.remove("active"));
          btn.classList.add("active");
          activeStatusFilter=(btn as HTMLElement).dataset.status||"open";
          renderList();
        });
      });
      // Priority + Sort are custom dropdowns (wired in makeDropdown above).
      overdueChip?.addEventListener("click",()=>{ overdueOnly=!overdueOnly; overdueChip.classList.toggle("active",overdueOnly); overdueChip.setAttribute("aria-pressed",String(overdueOnly)); renderList(); });
      // Free-text search + assigned-date-range — apply to the list and, when it's
      // showing, the Proof Review gallery (both honour the shared filter state).
      const refreshViews=()=>{ renderList(); if(proofViewEl && proofViewEl.style.display!=="none") renderProofView(); };
      if(searchInput){
        let st:any;
        searchInput.addEventListener("input",()=>{ clearTimeout(st); st=setTimeout(()=>{ searchQuery=searchInput.value.trim(); refreshViews(); },180); });
      }
      const syncDateClear=()=>{ if(dateClearBtn) dateClearBtn.hidden=!(assignedFrom||assignedTo); };
      dateFromEl?.addEventListener("change",()=>{ assignedFrom=dateFromEl.value||""; syncDateClear(); refreshViews(); });
      dateToEl?.addEventListener("change",()=>{ assignedTo=dateToEl.value||""; syncDateClear(); refreshViews(); });
      dateClearBtn?.addEventListener("click",()=>{ assignedFrom=""; assignedTo=""; if(dateFromEl)dateFromEl.value=""; if(dateToEl)dateToEl.value=""; syncDateClear(); refreshViews(); });
      // Reflect the default assigned-date range (last 30 days) in the inputs.
      if(dateFromEl) dateFromEl.value=assignedFrom;
      if(dateToEl)   dateToEl.value=assignedTo;
      syncDateClear();

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
        setText(`${p}-title-text`, tr("managerTitle"));
        setText(`${p}-new-label`, tr("newTask"));
        setAttr(`${p}-new`,"title",tr("newTask"));
        setAttr(`${p}-refresh`,"title",tr("refresh"));
        setText(`${p}-audit-tab-label`, tr("auditHistory"));
        setAttr(`${p}-audit-prev`,"aria-label",tr("scrollLeft"));
        setAttr(`${p}-audit-next`,"aria-label",tr("scrollRight"));
        setText(`${p}-type-label`, tr("allTypes"));
        const st=(s:string,v:string)=>{const el=container.querySelector(`.${p}-status-opt[data-status="${s}"]`); if(el) el.textContent=v;};
        st("open",tr("open")); st("done",tr("done")); st("all",tr("both"));
        refreshDropdowns(); // re-localize custom dropdown labels/options

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
        allTasks=[]; recurTemplates=[];
        tasksLoaded=false;
        activityComments.clear(); activityCommentsLoaded=false;
        setActivityFull(false); activityLimit=ACT_RECENT;
        activityInstallFilter="all"; activityMembers.clear();
        activityTypeFilters.clear(); activityPriorities.clear(); activityFrom=""; activityTo="";
        proofCache=null; // gallery reloads its proof set on next open/refresh
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
                  // Manager view loads every task across accessible stores; team
                  // scoping happens at render time via the team-member filter.
                  seen.add(t.id);
                  const desc=t.description||"";
                  const lname=t.taskListId?(listMap.get(t.taskListId)||""):"";
                  let taskType=parseTaskType(t.title||"")||parseTaskType(desc);
                  // Recurring-task templates are hidden system tasks — kept out of
                  // the list/charts, but captured for the activity feed ("added a
                  // recurring task …").
                  if(taskType==="recur-template"){
                    recurTemplates.push({
                      id:t.id, title:t.title||"(no title)", description:desc,
                      status:t.status||"OPEN", priority:t.priority||"Priority_3",
                      dueDate:t.dueDate||null, taskType,
                      installationId:inst.id, installationTitle:inst.title,
                      listId:t.taskListId||"", listName:lname,
                      groupIds:t.groupIds||[], assigneeIds:t.assigneeIds||[], attachmentIds:[],
                      createDate:t.createDate||undefined, updateDate:t.updateDate||undefined,
                      creatorId:t.creatorId||undefined, creatorType:t.creatorType||undefined,
                    });
                    seen.delete(t.id); continue;
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
                    creatorId:t.creatorId||undefined, creatorType:t.creatorType||undefined,
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
          tasksLoaded=true; // proof gallery can now build safely

          // Resolve the manager's team, then paint the dropdown + dashboard.
          await resolveTeam();
          renderTeamSelect();
          renderStoreTabs(); renderTypeFilters(); renderList();
          if(teamNote) showBanner("info",teamNote);
          else if(allTasks.filter(t=>t.taskType!=="audit-result").length===0){
            showBanner("info",tr("noTasksFound"));
          }
        } catch(e:any){
          listWrap.innerHTML=`<div class="${p}-state"><strong>${tr("failedToLoad")}</strong>${esc(e.message)}</div>`;
        }
        // Release anything waiting on the load (e.g. the proof gallery). On failure
        // tasksLoaded stays false, so loadProofItems won't cache an empty set.
        loadWaiters.splice(0).forEach(r=>r());

        refreshBtn.disabled=false;
        refreshBtn.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
        // Keep the proof gallery fresh if the manager is viewing it on refresh.
        if(proofViewEl && proofViewEl.style.display!=="none") renderProofView();
      }

      refreshBtn.addEventListener("click",load);

      // ── Proof Review view switching ────────────────────────────────────
      const switchView = (view:string)=>{
        const proof = view==="proof";
        if(tasksViewEl) tasksViewEl.style.display = proof?"none":"";
        if(proofViewEl) proofViewEl.style.display = proof?"":"none";
        vtabsEl?.querySelectorAll(`.${p}-vtab`).forEach(b=>{
          b.classList.toggle("active",(b as HTMLElement).dataset.view===view);
        });
        // Rebuild the gallery each time it's shown so its filter bar reflects the
        // current shared filter state (store / person / search / assigned date).
        if(proof) renderProofView();
      };
      vtabsEl?.querySelectorAll(`.${p}-vtab`).forEach(btn=>{
        btn.addEventListener("click",()=>switchView((btn as HTMLElement).dataset.view||"tasks"));
      });
      // Delegated lightbox open for proof thumbnails in the review gallery.
      proofViewEl?.addEventListener("click",(ev)=>{
        const a=(ev.target as HTMLElement)?.closest?.("[data-att-url]") as HTMLElement|null;
        if(a){ ev.preventDefault(); openAttModal(a.dataset.attPreview||a.dataset.attUrl||"", a.dataset.attUrl||"", a.dataset.attName||"file", a.dataset.attKind||"img"); return; }
        const head=(ev.target as HTMLElement)?.closest?.("[data-proof-task]") as HTMLElement|null;
        if(head){ const id=head.getAttribute("data-proof-task")||""; const task=allTasks.find(x=>x.id===id); if(task) openDetail(task); }
      });

      // Team-member filter is a custom multiselect dropdown (built in
      // renderTeamSelect); no native <select> listener needed.

      // ── Create task sheet ─────────────────────────────────────────────────
      if(allowCreate){
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
            self._mgrCreate=createEl;
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
              <div class="${p}-fld"><label>${tr("assignTo")}</label>
                <div class="${p}-reassign" id="${p}-c-assign">
                  <button type="button" class="${p}-reassign-btn" id="${p}-c-assign-btn"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span id="${p}-c-assign-lbl">${tr("assign")}</span></button>
                  <div class="${p}-reassign-pop" id="${p}-c-assign-pop" style="display:none">
                    <input type="text" class="${p}-reassign-search" id="${p}-c-assign-search" placeholder="${tr("searchPeopleGroups")}">
                    <div class="${p}-reassign-results" id="${p}-c-assign-results"></div>
                  </div>
                </div>
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
          // Assign-to multi-select (people + groups), reusing the reassign picker styles.
          const cSelUsers=new Set<string>(), cSelGroups=new Set<string>();
          const cBtn=$("c-assign-btn"), cPop=$("c-assign-pop"), cSearch=$("c-assign-search"), cResults=$("c-assign-results"), cLbl=$("c-assign-lbl");
          const cgIco=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
          const cuIco=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
          const cckIco=`<svg class="${p}-ck" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
          const cGroups=()=>{const o:Array<{id:string;name:string}>=[];groupMap.forEach((name,id)=>o.push({id,name}));return o.sort((a,b)=>a.name.localeCompare(b.name));};
          const cLabel=()=>{ const names=[...[...cSelGroups].map(id=>groupMap.get(id)||id), ...[...cSelUsers].map(id=>(usersList||[]).find(u=>u.id===id)?.name||id)];
            cLbl.textContent = names.length ? (names.length<=2?names.join(", "):tr("nSelected").replace("{n}",String(names.length))) : tr("assign"); };
          const cRender=(q:string)=>{
            const ql=q.trim().toLowerCase();
            const groups=cGroups().filter(g=>!ql||g.name.toLowerCase().includes(ql)).slice(0,30);
            const users=(usersList||[]).filter(u=>!ql||u.name.toLowerCase().includes(ql)).slice(0,30);
            let html="";
            if(groups.length) html+=`<div class="${p}-reassign-h">${tr("groups")}</div>`+groups.map(g=>`<div class="${p}-reassign-opt${cSelGroups.has(g.id)?" sel":""}" data-type="group" data-id="${esc(g.id)}">${cgIco}<span>${esc(g.name)}</span>${cckIco}</div>`).join("");
            html+=`<div class="${p}-reassign-h">${tr("people")}</div>`+(users.length?users.map(u=>`<div class="${p}-reassign-opt${cSelUsers.has(u.id)?" sel":""}" data-type="user" data-id="${esc(u.id)}">${cuIco}<span>${esc(u.name)}</span>${cckIco}</div>`).join(""):`<div class="${p}-reassign-empty">${usersList?tr("noMatches"):tr("loading")}</div>`);
            cResults.innerHTML=html;
            cResults.querySelectorAll(`.${p}-reassign-opt`).forEach((o:Element)=>o.addEventListener("click",()=>{
              const el=o as HTMLElement; const id=el.dataset.id!; const set=el.dataset.type==="group"?cSelGroups:cSelUsers;
              if(set.has(id)) set.delete(id); else set.add(id);
              el.classList.toggle("sel"); cLabel();
            }));
          };
          cBtn.addEventListener("click",async()=>{
            if(cPop.style.display!=="none"){ cPop.style.display="none"; return; }
            cPop.style.display="block"; cRender(""); cSearch.value=""; cSearch.focus();
            if(!usersList){ await fetchUsers(); cRender(cSearch.value); }
          });
          cSearch.addEventListener("input",()=>cRender(cSearch.value));

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
            // Tasks are created with the Basic token, so the server records the
            // token (not the viewer) as creator. Stamp the real author as [by:<id>]
            // so the activity feed shows who created it (falls back to "someone").
            if(currentUserId) finalDesc=finalDesc?`${finalDesc} [by: ${currentUserId}]`:`[by: ${currentUserId}]`;
            const saveBtn=$("c-save") as HTMLButtonElement;
            saveBtn.disabled=true; saveBtn.textContent=tr("creating");
            try{
              const body:Record<string,unknown>={ title, status:"OPEN", priority:prio, taskListId:listId };
              if(finalDesc) body.description=finalDesc;
              if(due) body.dueDate=`${due}T00:00:00.000Z`;
              if(cSelUsers.size) body.assigneeIds=[...cSelUsers];
              if(cSelGroups.size) body.groupIds=[...cSelGroups];
              const r=await fetch(`${baseUrl}/tasks/${instId2}/task`,{method:"POST",...apiOpts(),body:JSON.stringify(body)});
              if(!r.ok) throw new Error(`HTTP ${r.status}`);
              // Notify the people/groups this task was just assigned to.
              notifyAssigned([...cSelUsers], [...cSelGroups].map(id=>({id,name:groupMap.get(id)||id})), title);
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
      if (self._mgrOverlay)  { self._mgrOverlay.remove();  self._mgrOverlay  = undefined; }
      if (self._mgrDetail)   { self._mgrDetail.remove();   self._mgrDetail   = undefined; }
      if (self._mgrAModal)   { self._mgrAModal.remove();   self._mgrAModal   = undefined; }
      if (self._mgrCreate)   { self._mgrCreate.remove();   self._mgrCreate   = undefined; }
      if (self._mgrDocClick) { document.removeEventListener("click",   self._mgrDocClick); self._mgrDocClick = undefined; }
      if (self._mgrDocClickDD) { document.removeEventListener("click", self._mgrDocClickDD); self._mgrDocClickDD = undefined; }
      if (self._mgrDocKey)   { document.removeEventListener("keydown", self._mgrDocKey);   self._mgrDocKey   = undefined; }
      if (self._mgrActScroll){ window.removeEventListener("scroll", self._mgrActScroll); self._mgrActScroll = undefined; }
      if (self._mgrVV && (window as any).visualViewport) {
        (window as any).visualViewport.removeEventListener("resize", self._mgrVV);
        (window as any).visualViewport.removeEventListener("scroll", self._mgrVV);
        self._mgrVV = undefined;
      }
    }

    static get observedAttributes(){
      return ["apitoken","baseurl","usethemecolors","primarycolor","accentcolor","backgroundcolor","storelabelsingular","storelabelplural","typecolors","teamsource","teamuserids","showcharts","notifyonassign","showdonetasks","enablecomments","allowtaskcreation","allowtaskassignment","debugmode"];
    }
  };
};

// ── Block registration ────────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name:"manager-tasks-widget", label:"Manager Tasks Widget",
  attributes:["apitoken","baseurl","usethemecolors","primarycolor","accentcolor","backgroundcolor","storelabelsingular","storelabelplural","typecolors","teamsource","teamuserids","showcharts","notifyonassign","showdonetasks","enablecomments","enableproofreview","allowtaskcreation","allowtaskassignment","debugmode","limitheight","maxheight"],
  factory, configurationSchema, uiSchema, blockLevel:"block", iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzRGNDZFNSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzLjUgNDMuNSkgc2NhbGUoMy41KSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iNCIgeD0iOCIgeT0iMiIgcng9IjEiIHJ5PSIxIi8+PHBhdGggZD0iTTE2IDRoMmEyIDIgMCAwIDEgMiAydjE0YTIgMiAwIDAgMS0yIDJINmEyIDIgMCAwIDEtMi0yVjZhMiAyIDAgMCAxIDItMmgyIi8+PHBhdGggZD0ibTkgMTQgMiAyIDQtNCIvPjwvZz48L3N2Zz4=",
};

window.defineBlock({ blockDefinition, author:"Staffbase", version:"1.0.0" } as ExternalBlockDefinition);
