// Time Tracking — clock in / clock out against two user-profile fields.
//
// The whole state of the widget lives on the viewer's Staffbase profile:
//   • a status field   ("clocked-in")   holding a configurable true/false string
//   • a timestamp field ("clocked-time") holding an ISO 8601 string of the last
//     clock event, overwritten on both clock in and clock out
//
// That means the running timer is derived from the server, not from local state,
// so it survives a reload, a different device, or the app being backgrounded.
//
// Verified against the Staffbase API (see notes at readClockState/writeClockState):
// the PUT merges into the profile rather than replacing it, the USERID admin
// header is optional, and an unknown field slug fails with a descriptive 400.

import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from "@staffbase/widget-sdk";

import { JSONSchema7 } from "json-schema";

import { fetchThemeColors } from "../tasks/shared/theming";

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL       = "https://app.staffbase.com/api";
const DEFAULT_PRIMARY_COLOR  = "#0EA5E9";
const DEFAULT_ACCENT_COLOR   = "#0EA5E9";
const DEFAULT_STATUS_FIELD   = "clocked-in";
const DEFAULT_TIME_FIELD     = "clocked-time";
const DEFAULT_IN_VALUE       = "true";
const DEFAULT_OUT_VALUE      = "false";

// ── Config schema ─────────────────────────────────────────────────────────────

const configurationSchema: JSONSchema7 = {
  properties: {
    apitoken:            { type:"string",  title:"API Token",                     default:"" },
    baseurl:             { type:"string",  title:"Base URL",                      default: DEFAULT_BASE_URL },
    adminuserid:         { type:"string",  title:"Admin User ID (optional)",      default:"" },
    statusfield:         { type:"string",  title:"Status Profile Field Slug",     default: DEFAULT_STATUS_FIELD },
    clockedinvalue:      { type:"string",  title:"Clocked-In Value",              default: DEFAULT_IN_VALUE },
    clockedoutvalue:     { type:"string",  title:"Clocked-Out Value",             default: DEFAULT_OUT_VALUE },
    timefield:           { type:"string",  title:"Clock Time Profile Field Slug", default: DEFAULT_TIME_FIELD },
    targethours:         { type:"number",  title:"Target Hours Per Day",          default: 8 },
    breakminutes:        { type:"number",  title:"Break (minutes)",               default: 30 },
    workedtodaybaseline: { type:"number",  title:"Worked Today Baseline (minutes)", default: 0 },
    lastsessionminutes:  { type:"number",  title:"Last Session (minutes)",        default: 0 },
    refreshafterclock:   { type:"boolean", title:"Refresh App After Clocking",    default: false },
    usethemecolors:      { type:"boolean", title:"Use Theme Colors",              default: false },
    backgroundcolor:     { type:"string",  title:"Background Color",              default:"" },
    debugmode:           { type:"boolean", title:"Debug Mode (on-screen logs)",   default: false },
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
        { properties: { usethemecolors: { const: true } } },
      ],
    },
  },
};

// Left untyped on purpose: the SDK resolves @rjsf/utils to a different major
// than a direct dependency would, so annotating with an imported UiSchema makes
// the two structurally-identical types unassignable. Inference sidesteps it.
const uiSchema = {
  apitoken:            { "ui:widget":"password", "ui:help":"Staffbase Basic auth token" },
  baseurl:             { "ui:help":"Staffbase API base URL, e.g. https://yourorg.staffbase.com/api" },
  adminuserid:         { "ui:help":"Sent as the USERID header on profile writes. Usually not needed — leave blank unless your token requires an acting admin. Must be a real user id, not the token's own id." },
  statusfield:         { "ui:help":"Profile field slug holding the clocked-in flag. Must already exist in Admin → Profile Fields, or saving fails with “Unknown profile field”." },
  clockedinvalue:      { "ui:help":"Value written to the status field when clocked in. Matching is case-insensitive." },
  clockedoutvalue:     { "ui:help":"Value written to the status field when clocked out." },
  timefield:           { "ui:help":"Profile field slug holding the session. Stores “IN:<time> | OUT:<time> | DAY:<minutes>”, so the previous session's length and the day's running total are kept on the server, not just in the browser." },
  targethours:         { "ui:help":"Shown as the “of Nh target” sub-line under Worked Today" },
  breakminutes:        { "ui:help":"Static break length shown alongside Worked Today. Set to 0 to hide the Break card entirely." },
  workedtodaybaseline: { "ui:help":"Minutes to add on top of what the widget has actually recorded today. Demo seed — leave at 0 for real tracking." },
  lastsessionminutes:  { "ui:help":"Fallback “last session” length, shown only until a real session has been completed and recorded. Demo seed." },
  refreshafterclock:   { "ui:help":"After clocking in or out, also refresh the surrounding app view. Uses the app's own router, so it is not a full page reload. The widget always refreshes itself regardless of this setting." },
  usethemecolors:      { "ui:help":"Pull Primary & Accent from the app's branding theme (uses the API Token). Hides the color pickers below." },
  primarycolor:        { "ui:widget":"color", "ui:help":"Primary brand color" },
  accentcolor:         { "ui:widget":"color", "ui:help":"Accent / secondary color" },
  backgroundcolor:     { "ui:widget":"color", "ui:help":"Widget background color — leave blank for transparent" },
  debugmode:           { "ui:help":"Show an on-screen log panel with a copy button — useful for debugging inside the mobile app" },
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
  // mid-tone/saturated colors read as white rather than harsh black.
  return L>0.45?"#1a1a1a":"#ffffff";
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ICONS = {
  clock: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  play:  `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M8 5.5v13a.75.75 0 0 0 1.15.64l10-6.5a.75.75 0 0 0 0-1.28l-10-6.5A.75.75 0 0 0 8 5.5Z"/></svg>`,
  stop:  `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
};

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Parse a stored profile timestamp. Returns null for unset/blank/garbage. */
function parseStamp(raw: string): Date | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Elapsed ms between a start and now, clamped at 0 so a skewed device clock
 *  shows 00:00:00 rather than a negative timer. */
function elapsedMs(from: Date | null): number {
  if (!from) return 0;
  return Math.max(0, Date.now() - from.getTime());
}

function fmtDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Compact "7h 20min" / "45min" for the summary cards. */
function fmtMinutes(mins: number): string {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function fmtClockTime(d: Date): string {
  try {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

// ── Clock-time field format ───────────────────────────────────────────────────
//
// The time field carries the whole session, not just a single instant:
//
//   clocked in :  IN:2026-09-16T11:43:07.203Z | DAY:199
//   clocked out:  IN:2026-09-16T11:43:07.203Z | OUT:2026-09-16T15:02:11.000Z | DAY:398
//
// Keeping IN alongside OUT is what makes the *previous session's length* real —
// it's computed from the two stored timestamps, so it survives a reload and is
// the same on every device, rather than being remembered in memory for one view.
//
// DAY is the minutes already banked earlier the same day. Without it, Worked
// Today would silently drop every session but the last one on a multi-session
// day. It resets whenever the last event was on an earlier date.
//
// The field is `visible: true` on the profile, so the separator is a spaced pipe
// rather than something denser — someone looking at their own profile can read
// it. Parsing is deliberately looser than writing: tokens may appear in any
// order, with any whitespace, separated by a pipe or just spaces.

interface ClockValue {
  inAt: Date | null;
  outAt: Date | null;
  /** Minutes worked earlier on the same day as the most recent event. */
  dayMinutes: number;
}

const TOKEN_RE = (name: string) => new RegExp(`\\b${name}\\s*:\\s*([^|\\s]+)`, "i");

/** Parse the stored value. Tolerates the older bare-ISO form, so fields written
 *  by a previous version of this widget keep working. */
function parseClockValue(raw: string, clockedIn: boolean): ClockValue {
  const s = (raw || "").trim();
  if (!s) return { inAt: null, outAt: null, dayMinutes: 0 };

  const grab = (name: string): Date | null => {
    const m = TOKEN_RE(name).exec(s);
    return m ? parseStamp(m[1]) : null;
  };

  const inAt = grab("IN");
  const outAt = grab("OUT");

  if (!inAt && !outAt) {
    // Legacy: the whole value is a single timestamp. Which end it represents
    // depends on the status field.
    const only = parseStamp(s);
    return { inAt: clockedIn ? only : null, outAt: clockedIn ? null : only, dayMinutes: 0 };
  }

  const dayM = TOKEN_RE("DAY").exec(s);
  const dayMinutes = dayM ? Math.max(0, parseFloat(dayM[1]) || 0) : 0;

  return { inAt, outAt, dayMinutes };
}

function formatClockValue(v: ClockValue): string {
  const parts: string[] = [];
  if (v.inAt)  parts.push(`IN:${v.inAt.toISOString()}`);
  if (v.outAt) parts.push(`OUT:${v.outAt.toISOString()}`);
  parts.push(`DAY:${Math.max(0, Math.round(v.dayMinutes))}`);
  return parts.join(" | ");
}

/** The most recent event in the value, used to decide whether DAY is stale. */
function latestEvent(v: ClockValue): Date | null {
  if (v.outAt && v.inAt) return v.outAt.getTime() >= v.inAt.getTime() ? v.outAt : v.inAt;
  return v.outAt || v.inAt;
}

/** Minutes banked today. Zero once the stored day has rolled over, so a stale
 *  DAY from yesterday never leaks into today's total. */
function minutesBankedToday(v: ClockValue): number {
  const last = latestEvent(v);
  if (!last || !isSameDay(last, new Date())) return 0;
  return v.dayMinutes;
}

/** Length of the completed session, in minutes, or 0 if there isn't one.
 *  Guards against OUT preceding IN, which a clock change could produce. */
function completedSessionMinutes(v: ClockValue): number {
  if (!v.inAt || !v.outAt) return 0;
  return Math.max(0, (v.outAt.getTime() - v.inAt.getTime()) / 60000);
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" } as Record<string,string>
  )[c]);
}

// ── Profile I/O ───────────────────────────────────────────────────────────────

interface ClockState {
  /** true when the status field matches the configured clocked-in value. */
  clockedIn: boolean;
  /** Parsed contents of the time field. */
  value: ClockValue;
  /** Raw stored values, kept for the debug panel. */
  rawStatus: string;
  rawTime: string;
}

function authHeaders(token: string, adminId: string): Record<string,string> {
  const h: Record<string,string> = {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
  // Verified optional: the write succeeds without it on a service token. Only
  // send it when configured, and never send a blank header.
  if (adminId) h["USERID"] = adminId;
  return h;
}

/** Pull the API's own error message out of a failed response.
 *  A mistyped field slug returns 400 "Unknown profile field" with the offending
 *  slug in `extended.parameterName`, which is far more useful than a generic
 *  failure message — so it gets surfaced to the user verbatim. */
async function apiError(res: Response, fallback: string): Promise<string> {
  try {
    const body: any = await res.json();
    const slug = body?.extended?.parameterName;
    const msg = body?.message || body?.error;
    if (msg) return slug ? `${msg} (${slug})` : String(msg);
  } catch { /* non-JSON body */ }
  return `${fallback} (HTTP ${res.status})`;
}

export interface ProfileConfig {
  baseUrl: string;
  token: string;
  adminId: string;
  statusField: string;
  timeField: string;
  inValue: string;
  outValue: string;
}

async function readClockState(cfg: ProfileConfig, userId: string): Promise<ClockState> {
  const res = await fetch(`${cfg.baseUrl}/users/${encodeURIComponent(userId)}`, {
    // Omit the session cookie so the request is authenticated purely by the
    // Basic API token (the service identity) — same reasoning as shared/theming.
    credentials: "omit",
    headers: { Authorization: `Basic ${cfg.token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(await apiError(res, "Could not read your profile"));
  const data: any = await res.json();
  const profile = data?.profile || {};
  const rawStatus = String(profile[cfg.statusField] ?? "");
  const rawTime   = String(profile[cfg.timeField] ?? "");
  // Unset has two shapes — key missing entirely, or present as "" — and both
  // must read as clocked out, which falls out of the comparison naturally.
  const clockedIn = rawStatus.trim().toLowerCase() === cfg.inValue.trim().toLowerCase();
  return { clockedIn, value: parseClockValue(rawTime, clockedIn), rawStatus, rawTime };
}

/** Write both fields. The PUT merges into the existing profile — other fields
 *  (points, avatar, names…) are left untouched — so a two-key object is safe. */
async function writeClockState(cfg: ProfileConfig, userId: string, clockIn: boolean, value: ClockValue): Promise<void> {
  const res = await fetch(`${cfg.baseUrl}/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    credentials: "omit",
    headers: authHeaders(cfg.token, cfg.adminId),
    body: JSON.stringify({
      profile: {
        [cfg.statusField]: clockIn ? cfg.inValue : cfg.outValue,
        [cfg.timeField]: formatClockValue(value),
      },
    }),
  });
  if (!res.ok) throw new Error(await apiError(res, clockIn ? "Could not clock in" : "Could not clock out"));
}

// ── In-app refresh ────────────────────────────────────────────────────────────

/**
 * Refresh the surrounding app *without* a full document load.
 *
 * `window.NavigationMgr` is the platform router exposed for custom code; routing
 * to the current path re-boots the view in place on both web and mobile. Only if
 * it isn't there do we fall back to a real reload — which in the mobile app
 * costs the user their place.
 */
function refreshApp(log?: (...a: any[]) => void): void {
  const w = window as any;
  const nav = w.NavigationMgr;
  const here = location.pathname + location.search;
  if (nav && typeof nav.goTo === "function") {
    try {
      if (w.we && w.we.native && typeof nav.hideAllTabs === "function") nav.hideAllTabs();
      if (log) log("refresh · NavigationMgr.goTo", here);
      nav.goTo(here);
      return;
    } catch (e: any) {
      if (log) log("refresh · goTo THREW", (e && e.message) || String(e), "· falling back");
    }
  } else if (log) {
    log("refresh · NavigationMgr unavailable · falling back to reload");
  }
  window.location.reload();
}

// ── Styles ────────────────────────────────────────────────────────────────────
//
// Staffbase's host CSS reaches into widgets, so every button rule re-declares
// background/color with !important for *all* states. Note the hover/focus/active
// resets carry only background/color/shadow/outline — adding width, margin or
// border-radius there makes buttons visibly collapse or square off on press.

function buildCss(p: string, primary: string, accent: string, bg: string): string {
  const primaryRgb = hexToRgb(primary);
  const accentRgb  = hexToRgb(accent);
  const onPrimary  = contrastColor(primary);
  return `
.${p}{--primary:${primary};--primary-rgb:${primaryRgb};--accent:${accent};--accent-rgb:${accentRgb};--primary-text:${onPrimary};--dark:#1A1A1A;--gray:#6b7280;--gray-lt:#9ca3af;--border:#e5e7eb;--bg-soft:#f7f7f9;--success:#2E7D4A;--error:#C41E3A;--r-sm:6px;--r-md:10px;--r-lg:14px;--shadow-sm:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);--shadow-md:0 4px 16px rgba(0,0,0,.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--dark);background:${bg||"transparent"};padding:20px}
.${p} *,.${p} *::before,.${p} *::after{box-sizing:border-box;margin:0;padding:0}
.${p} ul,.${p} ol{list-style:none}
.${p} h1,.${p} h2,.${p} h3,.${p} h4{font-size:inherit;font-weight:inherit;margin:0;line-height:inherit}
.${p} img{max-width:none}
.${p} button{width:auto!important;margin:0!important;line-height:normal!important;font-family:inherit}

/* ── Header ── */
.${p}-header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.${p}-title-dot{width:34px;height:34px;border-radius:var(--r-md);background:linear-gradient(135deg,var(--primary),var(--accent));color:var(--primary-text);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.${p}-title{font-size:18px;font-weight:800;letter-spacing:-.01em;color:var(--dark)}
.${p}-subtitle{font-size:12px;color:var(--gray);margin-top:1px}

/* ── Clock card ── */
.${p}-card{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);padding:22px 20px;text-align:center}
.${p}-status{display:inline-flex;align-items:center;gap:7px;padding:4px 12px;border-radius:20px;background:var(--bg-soft);font-size:12px;font-weight:700;color:var(--gray)}
.${p}-status.on{background:rgba(46,125,74,.1);color:var(--success)}
.${p}-dot{width:8px;height:8px;border-radius:50%;background:var(--gray-lt);flex-shrink:0}
.${p}-status.on .${p}-dot{background:var(--success);animation:${p}-pulse 2s ease-in-out infinite}
@keyframes ${p}-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.${p}-timer{font-size:40px;font-weight:800;letter-spacing:-.02em;color:var(--dark);margin:14px 0 4px;font-variant-numeric:tabular-nums;line-height:1.1}
.${p}-timer.idle{color:var(--gray-lt)}
.${p}-detail{font-size:13px;color:var(--gray);min-height:18px}

/* ── Clock button ── */
.${p} .${p}-btn{display:inline-flex!important;width:100%!important;align-items:center;justify-content:center;gap:8px;margin-top:18px!important;padding:13px 20px!important;border:none!important;border-radius:var(--r-md)!important;font-size:15px;font-weight:700;cursor:pointer;background:var(--primary)!important;color:var(--primary-text)!important;box-shadow:0 3px 12px rgba(var(--primary-rgb),.3);transition:filter .15s,transform .15s}
.${p} .${p}-btn:hover,.${p} .${p}-btn:focus,.${p} .${p}-btn:focus-visible{background:var(--primary)!important;color:var(--primary-text)!important;outline:none!important}
.${p} .${p}-btn:hover{filter:brightness(.92);transform:translateY(-1px)}
.${p} .${p}-btn:active{background:var(--primary)!important;color:var(--primary-text)!important;transform:translateY(0)}
.${p} .${p}-btn.out{background:var(--error)!important;color:#fff!important;box-shadow:0 3px 12px rgba(196,30,58,.28)}
.${p} .${p}-btn.out:hover,.${p} .${p}-btn.out:focus,.${p} .${p}-btn.out:focus-visible,.${p} .${p}-btn.out:active{background:var(--error)!important;color:#fff!important}
.${p} .${p}-btn:disabled{opacity:.55;cursor:not-allowed;filter:none;transform:none}
.${p} .${p}-btn svg{fill:currentColor!important;stroke:none!important;flex-shrink:0}
.${p}-spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:${p}-spin .7s linear infinite;flex-shrink:0}
@keyframes ${p}-spin{to{transform:rotate(360deg)}}

/* ── Overview cards ── */
.${p}-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.${p}-cards.single{grid-template-columns:1fr}
.${p}-ov{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);padding:14px}
.${p}-ov.hl{background:linear-gradient(135deg,rgba(var(--primary-rgb),.07),rgba(var(--accent-rgb),.04));border-color:rgba(var(--primary-rgb),.25)}
.${p}-ov-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--gray)}
.${p}-ov-val{font-size:22px;font-weight:800;color:var(--dark);margin-top:5px;font-variant-numeric:tabular-nums;line-height:1.15}
.${p}-ov.hl .${p}-ov-val{color:var(--primary)}
.${p}-ov-sub{font-size:11px;color:var(--gray-lt);margin-top:2px}

/* ── Toast ── */
.${p}-toast{margin-top:12px;padding:10px 13px;border-radius:var(--r-md);font-size:13px;font-weight:600;display:none;line-height:1.4}
.${p}-toast.show{display:block}
.${p}-toast.ok{background:rgba(46,125,74,.1);color:var(--success)}
.${p}-toast.err{background:rgba(196,30,58,.08);color:var(--error)}

/* ── Error / debug ── */
.${p}-fatal{background:rgba(196,30,58,.08);color:var(--error);border-radius:var(--r-md);padding:14px;font-size:13px;line-height:1.5}
.${p}-debug{margin-top:12px;background:var(--bg-soft);border:1px solid var(--border);border-radius:var(--r-md);padding:10px}
.${p}-debug pre{font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:var(--gray);max-height:180px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.${p} .${p}-debug-copy{display:inline-flex!important;width:auto!important;align-items:center;margin:0 0 8px 0!important;padding:4px 10px!important;border:1px solid var(--border)!important;border-radius:var(--r-sm)!important;background:#fff!important;color:var(--gray)!important;font-size:11px;font-weight:700;cursor:pointer}
.${p} .${p}-debug-copy:hover,.${p} .${p}-debug-copy:focus,.${p} .${p}-debug-copy:focus-visible,.${p} .${p}-debug-copy:active{background:#fff!important;color:var(--primary)!important;outline:none!important}
`;
}

// ── Widget ────────────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class TimeTrackingWidget extends BaseBlockClass implements BaseBlock {
    constructor() {
      super();
    }

    async renderBlock(container: HTMLElement): Promise<void> {
      const p = "ttw";
      const self: any = this;

      // A previous render of this same host may have left a ticking interval
      // behind (Staffbase re-renders on attribute changes). Always clear first.
      if (self._ttwTimer) { clearInterval(self._ttwTimer); self._ttwTimer = undefined; }
      if (self._ttwObserver) { self._ttwObserver.disconnect(); self._ttwObserver = undefined; }

      const attr = (n: string) => this.getAttribute(n) || "";
      const num = (n: string, d: number) => {
        const v = parseFloat(attr(n));
        return isNaN(v) ? d : v;
      };
      const bool = (n: string) => attr(n) === "true";

      const token       = attr("apitoken");
      const baseUrl     = (attr("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
      const debug       = bool("debugmode");

      const cfg: ProfileConfig = {
        baseUrl,
        token,
        adminId:     attr("adminuserid").trim(),
        statusField: attr("statusfield").trim() || DEFAULT_STATUS_FIELD,
        timeField:   attr("timefield").trim()   || DEFAULT_TIME_FIELD,
        inValue:     attr("clockedinvalue")     || DEFAULT_IN_VALUE,
        outValue:    attr("clockedoutvalue")    || DEFAULT_OUT_VALUE,
      };

      const targetHours   = num("targethours", 8);
      const breakMinutes  = num("breakminutes", 30);
      const baselineMins  = num("workedtodaybaseline", 0);
      const seedLastMins  = num("lastsessionminutes", 0);
      const doAppRefresh  = bool("refreshafterclock");
      const bgColor       = attr("backgroundcolor");

      // ── Debug log ──
      const logLines: string[] = [];
      const dlog = (...args: any[]) => {
        if (!debug) return;
        logLines.push(`${new Date().toISOString().slice(11,19)} ${args.join(" ")}`);
        const pre = container.querySelector(`.${p}-debug pre`);
        if (pre) pre.textContent = logLines.join("\n");
      };

      // ── Colors ──
      let primary = attr("primarycolor") || DEFAULT_PRIMARY_COLOR;
      let accent  = attr("accentcolor")  || DEFAULT_ACCENT_COLOR;
      if (bool("usethemecolors") && token) {
        try {
          const theme = await fetchThemeColors(baseUrl, token, "primary", "light");
          if (theme.primary) primary = theme.primary;
          if (theme.accent)  accent  = theme.accent;
          dlog("theme colors", primary, accent);
        } catch (e: any) {
          dlog("theme colors failed", (e && e.message) || String(e));
        }
      }

      const css = buildCss(p, primary, accent, bgColor);

      const fatal = (msg: string) => {
        container.innerHTML = `<style>${css}</style><div class="${p}"><div class="${p}-fatal">${escapeHtml(msg)}</div></div>`;
      };

      if (!token) {
        fatal("Time Tracking isn’t configured yet — add an API Token in the widget settings.");
        return;
      }

      // ── Identify the viewer ──
      let userId = "";
      try {
        const prof: any = await widgetApi.getUserInformation();
        userId = prof?.id || "";
        dlog("viewer", userId);
      } catch (e: any) {
        dlog("getUserInformation failed", (e && e.message) || String(e));
      }
      if (!userId) {
        fatal("Couldn’t identify you — the widget needs a signed-in Staffbase user.");
        return;
      }

      // ── Initial read ──
      let state: ClockState;
      try {
        state = await readClockState(cfg, userId);
        dlog("state", `${cfg.statusField}=${JSON.stringify(state.rawStatus)}`, `${cfg.timeField}=${JSON.stringify(state.rawTime)}`);
      } catch (e: any) {
        fatal((e && e.message) || "Couldn’t read your profile.");
        return;
      }

      // The session's start and end both live in the time field now, so the
      // previous session's length is read back from the server rather than
      // remembered locally. The configured seed is only a fallback for a profile
      // that has never recorded a complete session.
      let lastSessionMins = seedLastMins;

      // ── Skeleton ──
      const showBreak = breakMinutes > 0;
      container.innerHTML = `
        <style>${css}</style>
        <div class="${p}">
          <div class="${p}-header">
            <div class="${p}-title-dot">${ICONS.clock}</div>
            <div>
              <div class="${p}-title">Time Tracking</div>
              <div class="${p}-subtitle" data-el="today"></div>
            </div>
          </div>

          <div class="${p}-card">
            <div class="${p}-status" data-el="status">
              <span class="${p}-dot"></span>
              <span data-el="status-text">Not clocked in</span>
            </div>
            <div class="${p}-timer idle" data-el="timer">00:00:00</div>
            <div class="${p}-detail" data-el="detail"></div>
            <button type="button" class="${p}-btn" data-el="btn"></button>
          </div>

          <div class="${p}-cards${showBreak ? "" : " single"}">
            <div class="${p}-ov hl">
              <div class="${p}-ov-label">Worked Today</div>
              <div class="${p}-ov-val" data-el="worked">–</div>
              <div class="${p}-ov-sub" data-el="worked-sub"></div>
            </div>
            ${showBreak ? `
            <div class="${p}-ov">
              <div class="${p}-ov-label">Break</div>
              <div class="${p}-ov-val">${escapeHtml(fmtMinutes(breakMinutes))}</div>
              <div class="${p}-ov-sub">excl. from hours</div>
            </div>` : ""}
          </div>

          <div class="${p}-toast" data-el="toast"></div>
          ${debug ? `<div class="${p}-debug"><button type="button" class="${p}-debug-copy" data-el="copy">Copy log</button><pre></pre></div>` : ""}
        </div>
      `;

      const el = (name: string) => container.querySelector(`[data-el="${name}"]`) as HTMLElement;
      const statusEl  = el("status");
      const statusTxt = el("status-text");
      const timerEl   = el("timer");
      const detailEl  = el("detail");
      const btnEl     = el("btn") as HTMLButtonElement;
      const workedEl  = el("worked");
      const workedSub = el("worked-sub");
      const todayEl   = el("today");
      const toastEl   = el("toast");

      try {
        todayEl.textContent = new Date().toLocaleDateString(undefined, { weekday:"long", day:"numeric", month:"long" });
      } catch { todayEl.textContent = ""; }

      if (debug) {
        const copy = el("copy");
        if (copy) copy.addEventListener("click", () => {
          try { navigator.clipboard.writeText(logLines.join("\n")); } catch { /* clipboard blocked */ }
        });
        const pre = container.querySelector(`.${p}-debug pre`);
        if (pre) pre.textContent = logLines.join("\n");
      }

      let toastTimer: any = null;
      const showToast = (msg: string, ok: boolean) => {
        toastEl.textContent = msg;
        toastEl.className = `${p}-toast show ${ok ? "ok" : "err"}`;
        if (toastTimer) clearTimeout(toastTimer);
        // Errors stay put — they usually mean a misconfigured field slug and the
        // admin needs time to read the API's message.
        if (ok) toastTimer = setTimeout(() => { toastEl.className = `${p}-toast`; }, 4000);
      };

      // ── Rendering ──

      /** Minutes worked today: the configured baseline plus the live session (or
       *  the one that just finished in this view). */
      const workedMinutes = (): number => {
        let mins = baselineMins;
        // DAY already accounts for every session completed earlier today, so
        // only the live session is added on top. When the field carries no
        // recorded session at all, fall back to the configured demo seed —
        // never to a session from a previous day, which would inflate today.
        if (state.value.inAt || state.value.outAt) mins += minutesBankedToday(state.value);
        else mins += seedLastMins;
        if (state.clockedIn && state.value.inAt) mins += elapsedMs(state.value.inAt) / 60000;
        return mins;
      };

      const paintCards = () => {
        workedEl.textContent = fmtMinutes(workedMinutes());
        workedSub.textContent = targetHours > 0 ? `of ${targetHours}h target` : "";
      };

      const paintTimer = () => {
        timerEl.textContent = state.clockedIn ? fmtDuration(elapsedMs(state.value.inAt)) : "00:00:00";
      };

      const render = () => {
        const on = state.clockedIn;
        const { inAt, outAt } = state.value;
        // Real length of the last completed session, from the stored IN/OUT pair.
        const realLast = completedSessionMinutes(state.value);
        if (realLast > 0) lastSessionMins = realLast;

        statusEl.className = `${p}-status${on ? " on" : ""}`;
        statusTxt.textContent = on ? "Clocked in" : "Not clocked in";

        timerEl.className = `${p}-timer${on ? "" : " idle"}`;
        paintTimer();

        if (on && inAt) {
          detailEl.textContent = isSameDay(inAt, new Date())
            ? `Started at ${fmtClockTime(inAt)}`
            : `Started ${inAt.toLocaleDateString()} at ${fmtClockTime(inAt)}`;
        } else if (!on && outAt && realLast >= 1) {
          detailEl.textContent = `Last session: ${fmtMinutes(realLast)}, ended ${fmtClockTime(outAt)}`;
        } else if (!on && outAt) {
          // Sub-minute session — reporting "Last session: 0min" is just noise.
          detailEl.textContent = `Last clocked out at ${fmtClockTime(outAt)}`;
        } else if (!on && lastSessionMins > 0) {
          detailEl.textContent = `Last session: ${fmtMinutes(lastSessionMins)}`;
        } else {
          detailEl.textContent = "Not started today";
        }

        btnEl.className = `${p}-btn${on ? " out" : ""}`;
        btnEl.innerHTML = on
          ? `${ICONS.stop}<span>Clock Out</span>`
          : `${ICONS.play}<span>Clock In</span>`;

        paintCards();
        startTicking();
      };

      // ── Live timer ──
      //
      // disconnectedCallback is unreliable across Staffbase SPA navigation, so
      // the interval is also torn down by an observer watching for the host
      // leaving the document. Without this a 1s timer keeps running (and keeps
      // the widget alive) long after the user has navigated away.
      const stopTicking = () => {
        if (self._ttwTimer) { clearInterval(self._ttwTimer); self._ttwTimer = undefined; }
      };

      const startTicking = () => {
        stopTicking();
        if (!state.clockedIn || !state.value.inAt) return;
        self._ttwTimer = setInterval(() => {
          if (!container.isConnected) { stopTicking(); return; }
          paintTimer();
          paintCards();
        }, 1000);
      };

      if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
        const obs = new MutationObserver(() => {
          if (!container.isConnected) { stopTicking(); obs.disconnect(); self._ttwObserver = undefined; }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        self._ttwObserver = obs;
      }

      // ── Clock in / out ──
      let busy = false;

      const clock = async () => {
        if (busy) return;
        busy = true;

        const goingIn = !state.clockedIn;
        const at = new Date();

        // Compose the value to store. Clocking in starts a fresh session and
        // carries forward what's already banked today; clocking out closes the
        // session and folds its length into the day's total.
        const banked = minutesBankedToday(state.value);
        const next: ClockValue = goingIn
          ? { inAt: at, outAt: null, dayMinutes: banked }
          : {
              inAt: state.value.inAt,
              outAt: at,
              dayMinutes: banked + (state.value.inAt
                ? Math.max(0, (at.getTime() - state.value.inAt.getTime()) / 60000)
                : 0),
            };

        const prevLabel = btnEl.innerHTML;
        btnEl.disabled = true;
        btnEl.innerHTML = `<span class="${p}-spin"></span><span>${goingIn ? "Clocking in…" : "Clocking out…"}</span>`;
        stopTicking();

        try {
          await writeClockState(cfg, userId, goingIn, next);
          dlog(goingIn ? "clocked in" : "clocked out", formatClockValue(next));

          // Re-read rather than trusting the optimistic value: the PUT response
          // doesn't echo custom profile fields back, so this is the only real
          // confirmation the write landed — and it keeps the timer honest.
          state = await readClockState(cfg, userId);
          dlog("re-read", `${cfg.statusField}=${JSON.stringify(state.rawStatus)}`, `${cfg.timeField}=${JSON.stringify(state.rawTime)}`);

          btnEl.disabled = false;
          render();
          showToast(goingIn ? "Clocked in." : "Clocked out.", true);

          if (doAppRefresh) refreshApp(dlog);
        } catch (e: any) {
          const msg = (e && e.message) || "Something went wrong.";
          dlog("clock failed", msg);
          btnEl.disabled = false;
          btnEl.innerHTML = prevLabel;
          // Nothing local changed on failure, so just restore the last known
          // good state and surface the API's own message.
          render();
          showToast(msg, false);
        } finally {
          busy = false;
        }
      };

      btnEl.addEventListener("click", clock);

      render();
    }

    disconnectedCallback(): void {
      const self: any = this;
      if (self._ttwTimer) { clearInterval(self._ttwTimer); self._ttwTimer = undefined; }
      if (self._ttwObserver) { self._ttwObserver.disconnect(); self._ttwObserver = undefined; }
    }

    static get observedAttributes(): string[] {
      return [
        "apitoken","baseurl","adminuserid","statusfield","clockedinvalue","clockedoutvalue",
        "timefield","targethours","breakminutes","workedtodaybaseline","lastsessionminutes",
        "refreshafterclock","usethemecolors","primarycolor","accentcolor","backgroundcolor","debugmode",
      ];
    }
  };
};

const blockDefinition: BlockDefinition = {
  name: "time-tracking-widget",
  label: "Time Tracking",
  attributes: [
    "apitoken","baseurl","adminuserid","statusfield","clockedinvalue","clockedoutvalue",
    "timefield","targethours","breakminutes","workedtodaybaseline","lastsessionminutes",
    "refreshafterclock","usethemecolors","primarycolor","accentcolor","backgroundcolor","debugmode",
  ],
  factory,
  configurationSchema,
  uiSchema,
  blockLevel: "block",
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzBFQTVFOSIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzLjUgNDMuNSkgc2NhbGUoMy41KSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOSIvPjxwYXRoIGQ9Ik0xMiA3djVsMyAyIi8+PC9nPjwvc3ZnPg==",
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: "Staffbase",
  version: "1.0.0",
};

window.defineBlock(externalBlockDefinition);
