/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, useEffect, useMemo, useState } from "react";
import {
  contrastColor,
  elevateOn,
  hexToRgb,
  isHex,
  readableOn,
  ThemeSurface,
  DARK_SURFACE,
  LIGHT_SURFACE,
} from "./theming";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR, DEFAULT_TITLE } from "./configuration-schema";

const P = "sbai"; // class prefix — every selector is scoped under it

// ── Types ─────────────────────────────────────────────────────────────────────

/** A task as authored in the configuration JSON. Only `title` is required. */
interface RawTask {
  title?: string;
  tag?: string;
  tagStyle?: string;
  priority?: string;
  dueDate?: string;
}

interface Task extends RawTask {
  id: string;
  title: string;
}

interface Note {
  id: string;
  text: string;
  time: string;
}

/** Props are a type alias, not an interface, so it satisfies the SDK's
 *  `parseAttributes<T extends Record<string, any>>` constraint — interfaces
 *  don't get the implicit index signature that assignability needs. */
export type ActionItemsProps = {
  contentLanguage?: string;
  tasksjson?: string;
  widgettitle?: string;
  primarycolor?: string;
  accentcolor?: string;
  backgroundcolor?: string;
  darkmode?: boolean | string;
  showcompleted?: boolean | string;
};

// ── Attribute helpers ─────────────────────────────────────────────────────────

/** Attributes arrive as strings from the DOM but as real booleans from the dev
 *  harness and tests, so both shapes have to be accepted. */
const toBool = (v: boolean | string | undefined, fallback: boolean): boolean => {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  return String(v).toLowerCase() === "true";
};

const color = (v: string | undefined, fallback: string): string => {
  const s = (v || "").trim();
  return isHex(s) ? s : fallback;
};

// ── Task parsing ──────────────────────────────────────────────────────────────

/**
 * Parse the configured JSON into tasks.
 *
 * Authoring mistakes must never white-screen the page, so anything unparseable
 * or structurally wrong collapses to an empty list and the widget shows its
 * empty state instead. The details go to the console for whoever is editing.
 */
function parseTasks(tasksjson: string | undefined): Task[] {
  if (!tasksjson || !tasksjson.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(tasksjson);
  } catch (error) {
    console.error("[action-items] Could not parse the tasks JSON:", error);
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.error("[action-items] The tasks JSON must be an array of task objects.");
    return [];
  }
  return parsed
    .filter((t): t is RawTask => !!t && typeof t === "object" && !Array.isArray(t))
    .map((t, index) => ({
      ...t,
      title: typeof t.title === "string" ? t.title : "",
      // Index-anchored so two tasks with the same title stay independent.
      id: `task-${index}`,
    }))
    .filter(t => t.title.trim().length > 0);
}

// ── Dates ─────────────────────────────────────────────────────────────────────

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Parse a due date, supporting the relative forms the editor can type so a
 * configured board keeps looking current without anyone editing dates:
 * "today", "today+7", or a plain "YYYY-MM-DD".
 */
function parseDueDate(dueDateStr: string): Date | null {
  const raw = (dueDateStr || "").trim();
  if (!raw) return null;

  const match = raw.match(/^today(?:\s*([+-])\s*(\d+))?$/i);
  if (match) {
    const days = match[2] ? parseInt(match[2], 10) : 0;
    const target = startOfToday();
    target.setDate(target.getDate() + (match[1] === "-" ? -days : days));
    return target;
  }

  // Appending the time prevents the UTC-parsing rule for bare YYYY-MM-DD from
  // shifting the date a day backwards for viewers west of UTC.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const parsed = new Date(iso);
  return isNaN(parsed.getTime()) ? null : parsed;
}

type DueTone = "overdue" | "today" | "tomorrow" | "later";

function dueDisplay(dueDateStr: string | undefined, locale: string): { text: string; tone: DueTone } | null {
  const due = parseDueDate(dueDateStr || "");
  if (!due) return null;

  const today = startOfToday();
  const tomorrow = startOfToday();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(due);
  day.setHours(0, 0, 0, 0);

  if (day.getTime() === today.getTime()) return { text: "Today", tone: "today" };
  if (day.getTime() === tomorrow.getTime()) return { text: "Tomorrow", tone: "tomorrow" };

  const text = day.toLocaleDateString(locale, { month: "short", day: "numeric" });
  return { text, tone: day.getTime() < today.getTime() ? "overdue" : "later" };
}

// ── Priority ──────────────────────────────────────────────────────────────────

type PriorityKey = "high" | "medium" | "low" | "custom";

/**
 * Map the configured priority onto a known level, or pass it through verbatim.
 *
 * Anything that isn't a recognised level is treated as free-form status text
 * ("Pending Approval", "Blocked", "Awaiting Legal"), which keeps the field
 * useful for approval-style items without a second config option.
 */
function priorityInfo(priority: string | undefined): { key: PriorityKey; label: string } | null {
  const raw = (priority || "").trim();
  if (!raw) return null;
  const k = raw.toLowerCase();
  if (["high", "p1", "urgent", "critical", "priority_1"].indexOf(k) >= 0) return { key: "high", label: "High Priority" };
  if (["medium", "med", "p2", "normal", "priority_2"].indexOf(k) >= 0) return { key: "medium", label: "Medium Priority" };
  if (["low", "p3", "minor", "priority_3"].indexOf(k) >= 0) return { key: "low", label: "Low Priority" };
  return { key: "custom", label: raw };
}

// ── Palette ───────────────────────────────────────────────────────────────────

interface Palette {
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textDone: string;
  border: string;
  divider: string;
  primary: string;
  primaryText: string;
  accent: string;
  accentText: string;
  accentRgb: string;
  primaryRgb: string;
  success: string;
  successText: string;
  statusText: string;
  noteBg: string;
  noteText: string;
  shadow: string;
  ticketBg: string;
  ticketText: string;
  ticketBorder: string;
  categoryBg: string;
  categoryText: string;
  categoryBorder: string;
  high: string;
  medium: string;
  low: string;
  overdueBg: string;
  overdueText: string;
  todayBg: string;
  todayText: string;
  tomorrowBg: string;
  tomorrowText: string;
  laterBg: string;
  laterText: string;
}

/**
 * Resolve every color the widget paints from the brand colors and the surface.
 *
 * Light and dark are two value sets over one rule set rather than a pile of
 * overrides, and brand colors are only nudged when they would actually fail
 * against the surface — so a dark navy primary stays navy on a white card and
 * is lightened just enough to survive on a dark one.
 */
function buildPalette(primaryIn: string, accentIn: string, surface: ThemeSurface, background: string): Palette {
  const dark = surface === "dark";
  const base = background || (dark ? DARK_SURFACE : LIGHT_SURFACE);

  // Primary is used two ways and each needs its own treatment: as the header
  // fill (a large block that just has to separate from the card) and as
  // on-surface text/borders (which needs real text contrast). On a dark card a
  // near-black brand color would otherwise sink into the surface and the header
  // bar would simply vanish.
  const primary = elevateOn(primaryIn, surface, 1.4);
  const primaryOnSurface = readableOn(primaryIn, surface, 4.5);
  const accent = dark ? readableOn(accentIn, surface, 3) : accentIn;
  const success = dark ? "#34d399" : "#0f9d8b";

  return {
    surface: base,
    surfaceAlt: dark ? "#1d1f25" : "#f9f9fa",
    text: dark ? "#eceef2" : "#333333",
    textMuted: dark ? "#a3a8b4" : "#555555",
    textDone: dark ? "#6b7280" : "#999999",
    border: dark ? "#2b2e36" : "#e0e0e0",
    divider: dark ? "#272a32" : "#eeeeee",
    primary,
    primaryText: contrastColor(primary),
    accent,
    accentText: contrastColor(accent),
    accentRgb: hexToRgb(accent),
    primaryRgb: hexToRgb(primaryOnSurface),
    success,
    successText: contrastColor(success),
    statusText: primaryOnSurface,
    noteBg: dark ? `rgba(${hexToRgb(accent)},0.10)` : "#fff9db",
    noteText: dark ? "#dfe3ea" : "#444444",
    shadow: dark ? "0 2px 14px rgba(0,0,0,0.45)" : "0 2px 10px rgba(0,0,0,0.1)",
    ticketBg: dark ? "rgba(96,165,250,0.16)" : "#e6f0ff",
    ticketText: dark ? "#93c5fd" : "#0052cc",
    ticketBorder: dark ? "rgba(147,197,253,0.32)" : "#b3d4ff",
    categoryBg: dark ? `rgba(${hexToRgb(primaryOnSurface)},0.18)` : `rgba(${hexToRgb(primaryOnSurface)},0.08)`,
    categoryText: primaryOnSurface,
    categoryBorder: `rgba(${hexToRgb(primaryOnSurface)},${dark ? 0.42 : 0.24})`,
    high: dark ? "#f87171" : "#d32f2f",
    medium: dark ? "#fbbf24" : "#b45309",
    low: dark ? "#9ca3af" : "#6b7280",
    overdueBg: dark ? "rgba(248,113,113,0.16)" : "#fde2e1",
    overdueText: dark ? "#fca5a5" : "#8a1c1c",
    todayBg: dark ? "rgba(254,221,186,0.16)" : "#feddba",
    todayText: dark ? "#f3c790" : "#492f17",
    tomorrowBg: dark ? "rgba(179,229,252,0.16)" : "#b3e5fc",
    tomorrowText: dark ? "#93d3f2" : "#01579b",
    laterBg: dark ? "rgba(162,213,166,0.16)" : "#a2d5a6",
    laterText: dark ? "#9ad3a0" : "#2c512e",
  };
}

/** Palette -> CSS custom properties on the root element. Kept as inline style
 *  (not inside the stylesheet) so two widgets on one page can hold different
 *  brand colors while sharing a single set of rules. */
function paletteVars(p: Palette): React.CSSProperties {
  const vars: Record<string, string> = {};
  (Object.keys(p) as Array<keyof Palette>).forEach(key => {
    vars[`--${P}-${String(key).replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`] = p[key];
  });
  return vars as React.CSSProperties;
}

// ── Styles ────────────────────────────────────────────────────────────────────

/**
 * One stylesheet, every selector scoped under `.${P}`.
 *
 * The first block is defensive, and not optional: Staffbase's own stylesheet
 * targets bare elements and wins on specificity inside widget markup. Two rules
 * in particular will visibly break this layout —
 *   `header{position:fixed;top:0;width:100%;height:50px}` (so the markup below
 *     deliberately uses a div, never a <header>), and
 *   `button{width:90%;margin:auto;min-height:40px;padding:10px}` (so width,
 *     margin, height and min-height all have to be reset).
 * Background and color are re-declared with `!important` for every interaction
 * state. The hover/focus/active rules only ever touch background, color,
 * box-shadow and outline — putting width, margin or border-radius in there
 * makes round controls square themselves on click.
 */
const STYLES = `
.${P}{box-sizing:border-box;font-family:'Open Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--${P}-text);max-width:100%}
.${P} *,.${P} *::before,.${P} *::after{box-sizing:border-box}
.${P} ul,.${P} ol,.${P} li{list-style:none!important;margin:0!important}
.${P} ul,.${P} ol{padding:0!important}
.${P} h1,.${P} h2,.${P} h3,.${P} h4,.${P} p{margin:0!important;padding:0!important}
.${P} img{max-width:none}
.${P} button{width:auto!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:0!important;margin:0!important;padding:0;border:none;border-radius:0;position:static;display:inline-block;font-size:inherit;font-family:inherit;line-height:normal!important;text-transform:none;letter-spacing:normal;box-shadow:none;background:transparent!important;color:inherit!important;cursor:pointer;-webkit-appearance:none;appearance:none}
.${P} button:hover,.${P} button:focus,.${P} button:focus-visible,.${P} button:active{background:transparent!important;color:inherit!important;box-shadow:none;outline:none}
.${P} textarea{width:100%;height:auto;margin:0;font-family:inherit;font-size:12px;box-sizing:border-box;-webkit-appearance:none;appearance:none}

.${P}-card{background:var(--${P}-surface);border:1px solid var(--${P}-border);border-radius:8px;box-shadow:var(--${P}-shadow);overflow:hidden}

.${P}-header{background:var(--${P}-primary);color:var(--${P}-primary-text);padding:15px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.${P}-header-title{margin:0!important;font-size:16px;font-weight:600;color:var(--${P}-primary-text);display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.${P}-header-text{overflow-wrap:anywhere}
.${P}-pill{background:var(--${P}-accent);color:var(--${P}-accent-text);font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700;white-space:nowrap}
.${P}-pill--done{background:var(--${P}-success);color:var(--${P}-success-text)}
.${P}-header-icon{flex-shrink:0;display:block}

.${P}-list{max-height:400px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(var(--${P}-primary-rgb),0.45) transparent}
.${P}-list::-webkit-scrollbar{width:10px}
.${P}-list::-webkit-scrollbar-track{background:transparent;margin:4px 0}
.${P}-list::-webkit-scrollbar-thumb{background:rgba(var(--${P}-primary-rgb),0.32);border-radius:8px;border:3px solid transparent;background-clip:padding-box}

.${P}-item{border-bottom:1px solid var(--${P}-divider);padding:15px 20px!important;transition:background-color .2s ease,opacity .35s ease,max-height .35s ease,padding .35s ease}
.${P}-item:last-child{border-bottom:none}
.${P}-item:hover{background-color:var(--${P}-surface-alt)}
/* visibility flips only after the collapse finishes, so the row fades out
   normally and then leaves the tab order instead of lingering in it. */
.${P}-item--leaving{opacity:0;max-height:0;padding-top:0!important;padding-bottom:0!important;overflow:hidden;border-bottom-width:0;visibility:hidden;pointer-events:none;transition:opacity .35s ease,max-height .35s ease,padding .35s ease,visibility 0s linear .35s}

.${P}-row{display:flex;align-items:flex-start;gap:12px}

.${P} .${P}-check{flex-shrink:0;width:18px!important;height:18px!important;min-height:0!important;padding:0!important;margin-top:2px!important;border:2px solid rgba(var(--${P}-primary-rgb),0.85)!important;border-radius:4px!important;background:transparent!important;display:flex!important;align-items:center;justify-content:center;transition:background-color .15s ease,border-color .15s ease}
.${P} .${P}-check:hover,.${P} .${P}-check:focus,.${P} .${P}-check:active{background:rgba(var(--${P}-primary-rgb),0.12)!important}
.${P} .${P}-check:focus-visible{background:rgba(var(--${P}-primary-rgb),0.12)!important;outline:2px solid rgba(var(--${P}-primary-rgb),0.9);outline-offset:2px}
.${P} .${P}-check[aria-checked="true"]{background:var(--${P}-success)!important;border-color:var(--${P}-success)!important}
.${P} .${P}-check[aria-checked="true"]:hover,.${P} .${P}-check[aria-checked="true"]:focus,.${P} .${P}-check[aria-checked="true"]:active{background:var(--${P}-success)!important}
.${P}-check svg{display:block;stroke:var(--${P}-success-text)}

.${P}-content{flex:1;min-width:0}
.${P}-title{font-size:14px;font-weight:600;color:var(--${P}-text);margin-bottom:4px;display:block;overflow-wrap:anywhere;transition:color .2s ease}
.${P}-item--done .${P}-title{text-decoration:line-through;color:var(--${P}-text-done)}
.${P}-meta{font-size:11px;color:var(--${P}-text-muted);display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-height:18px}

.${P}-tag{padding:2px 6px;border-radius:4px;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.02em;white-space:nowrap}
.${P}-tag--ticket{background:var(--${P}-ticket-bg);color:var(--${P}-ticket-text);border:1px solid var(--${P}-ticket-border)}
.${P}-tag--category{background:var(--${P}-category-bg);color:var(--${P}-category-text);border:1px solid var(--${P}-category-border)}

.${P}-priority{display:flex;align-items:center;gap:4px;font-weight:600}
.${P}-priority::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:currentColor;flex-shrink:0}
.${P}-priority--high{color:var(--${P}-high)}
.${P}-priority--medium{color:var(--${P}-medium)}
.${P}-priority--low{color:var(--${P}-low)}
.${P}-status{color:var(--${P}-status-text);font-weight:600}

.${P}-due{padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;white-space:nowrap}
.${P}-due--overdue{background:var(--${P}-overdue-bg);color:var(--${P}-overdue-text)}
.${P}-due--today{background:var(--${P}-today-bg);color:var(--${P}-today-text)}
.${P}-due--tomorrow{background:var(--${P}-tomorrow-bg);color:var(--${P}-tomorrow-text)}
.${P}-due--later{background:var(--${P}-later-bg);color:var(--${P}-later-text)}

.${P} .${P}-note-btn{font-size:12px;font-weight:600;color:var(--${P}-status-text)!important;background:transparent!important;padding:0!important;opacity:0;transition:opacity .15s ease}
.${P}-item:hover .${P}-note-btn,.${P} .${P}-note-btn:focus-visible,.${P} .${P}-note-btn[aria-expanded="true"]{opacity:1}
.${P} .${P}-note-btn:hover,.${P} .${P}-note-btn:focus,.${P} .${P}-note-btn:active{background:transparent!important;color:var(--${P}-status-text)!important;text-decoration:underline}
.${P} .${P}-note-btn:focus-visible{outline:2px solid rgba(var(--${P}-primary-rgb),0.9);outline-offset:2px}
/* Touch devices never fire hover, so the action would be unreachable there. */
@media (hover:none){.${P} .${P}-note-btn{opacity:1}}

.${P}-note-box{margin-top:10px;margin-left:30px}
.${P}-textarea{padding:8px!important;border:1px solid rgba(var(--${P}-primary-rgb),0.7)!important;border-radius:4px!important;font-size:12px;resize:vertical;min-height:60px;outline:none;background:var(--${P}-surface)!important;color:var(--${P}-text)!important}
.${P}-textarea::placeholder{color:var(--${P}-text-done)}
.${P}-textarea:focus{border-color:rgba(var(--${P}-primary-rgb),1);box-shadow:0 0 0 3px rgba(var(--${P}-primary-rgb),0.15)}
.${P}-note-actions{display:flex;align-items:center;gap:8px;margin-top:5px}
.${P} .${P}-save-btn{background:var(--${P}-status-text)!important;color:var(--${P}-surface)!important;padding:6px 12px!important;border-radius:4px!important;font-size:11px;font-weight:600}
.${P} .${P}-save-btn:hover,.${P} .${P}-save-btn:focus,.${P} .${P}-save-btn:active{background:var(--${P}-status-text)!important;color:var(--${P}-surface)!important;box-shadow:0 2px 8px rgba(var(--${P}-primary-rgb),0.35)}
.${P} .${P}-save-btn:focus-visible{outline:2px solid rgba(var(--${P}-primary-rgb),0.9);outline-offset:2px}
.${P} .${P}-save-btn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
.${P} .${P}-cancel-btn{font-size:11px;font-weight:600;color:var(--${P}-text-muted)!important;background:transparent!important;padding:6px 4px!important}
.${P} .${P}-cancel-btn:hover,.${P} .${P}-cancel-btn:focus,.${P} .${P}-cancel-btn:active{background:transparent!important;color:var(--${P}-text)!important}

.${P}-notes{margin-top:8px;margin-left:30px}
.${P}-note{background:var(--${P}-note-bg);border-left:3px solid var(--${P}-accent);padding:6px 10px;font-size:12px;color:var(--${P}-note-text);margin-bottom:5px;border-radius:0 4px 4px 0;overflow-wrap:anywhere}
.${P}-note:last-child{margin-bottom:0}
.${P}-note-time{font-size:10px;color:var(--${P}-text-muted);display:block;margin-bottom:2px}

.${P}-empty{padding:36px 20px;text-align:center;color:var(--${P}-text-muted);font-size:13px}
.${P}-empty-icon{width:34px;height:34px;margin:0 auto 10px;border-radius:50%;background:rgba(var(--${P}-primary-rgb),0.12);display:flex;align-items:center;justify-content:center}
.${P}-empty-icon svg{stroke:var(--${P}-status-text)}
.${P}-empty-title{font-size:14px;font-weight:600;color:var(--${P}-text);margin-bottom:4px!important}

@media (prefers-reduced-motion:reduce){.${P} *{transition:none!important;animation:none!important}}
`;

// ── Icons ─────────────────────────────────────────────────────────────────────

const PulseIcon = ({ color: stroke }: { color: string }): ReactElement => (
  <svg
    className={`${P}-header-icon`}
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const CheckIcon = (): ReactElement => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

export const ActionItems = ({
  tasksjson,
  widgettitle,
  primarycolor,
  accentcolor,
  backgroundcolor,
  darkmode,
  showcompleted,
  contentLanguage,
}: ActionItemsProps): ReactElement => {
  const tasks = useMemo(() => parseTasks(tasksjson), [tasksjson]);

  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Re-authoring the list invalidates the per-task state that hangs off it,
  // otherwise index-based ids would carry checkmarks and notes onto whatever
  // task now occupies that position.
  useEffect(() => {
    setCompleted({});
    setNotes({});
    setOpenNote(null);
    setDrafts({});
  }, [tasksjson]);

  const dark = toBool(darkmode, false);
  const keepCompleted = toBool(showcompleted, true);
  const surface: ThemeSurface = dark ? "dark" : "light";
  const locale = (contentLanguage || "en-US").replace("_", "-");

  const palette = useMemo(
    () =>
      buildPalette(
        color(primarycolor, DEFAULT_PRIMARY_COLOR),
        color(accentcolor, DEFAULT_ACCENT_COLOR),
        surface,
        color(backgroundcolor, "")
      ),
    [primarycolor, accentcolor, backgroundcolor, surface]
  );

  // Completed rows stay mounted even when they're being hidden, so the
  // collapse can animate before they disappear.
  const pending = tasks.filter(t => !completed[t.id]).length;
  const allDone = tasks.length > 0 && pending === 0;

  const toggleTask = (id: string) => setCompleted(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleNoteBox = (id: string) => setOpenNote(prev => (prev === id ? null : id));

  const saveNote = (id: string) => {
    const text = (drafts[id] || "").trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    setNotes(prev => ({
      ...prev,
      [id]: [...(prev[id] || []), { id: `${id}-note-${(prev[id] || []).length}-${Date.now()}`, text, time }],
    }));
    setDrafts(prev => ({ ...prev, [id]: "" }));
    setOpenNote(null);
  };

  const title = (widgettitle || "").trim() || DEFAULT_TITLE;

  return (
    <>
      <style>{STYLES}</style>
      <div className={P} style={paletteVars(palette)}>
        <div className={`${P}-card`}>
          {/* A <header> element would be caught by the host's
              `header{position:fixed;top:0}` rule and fly out of the card. */}
          <div className={`${P}-header`}>
            <h3 className={`${P}-header-title`}>
              <span className={`${P}-header-text`}>{title}</span>
              {tasks.length > 0 && (
                <span className={`${P}-pill${allDone ? ` ${P}-pill--done` : ""}`} aria-live="polite">
                  {allDone ? "All Done!" : `${pending} Pending`}
                </span>
              )}
            </h3>
            <PulseIcon color={palette.accent} />
          </div>

          {tasks.length === 0 ? (
            <div className={`${P}-empty`}>
              <div className={`${P}-empty-icon`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className={`${P}-empty-title`}>Nothing needs your attention</p>
              <p>New action items will appear here as they come in.</p>
            </div>
          ) : (
            <ul className={`${P}-list`}>
              {tasks.map(task => {
                const isDone = !!completed[task.id];
                const leaving = !keepCompleted && isDone;
                const due = dueDisplay(task.dueDate, locale);
                const priority = priorityInfo(task.priority);
                const tagStyle = (task.tagStyle || "").toLowerCase() === "category" ? "category" : "ticket";
                const taskNotes = notes[task.id] || [];
                const noteOpen = openNote === task.id;

                return (
                  <li
                    key={task.id}
                    className={`${P}-item${isDone ? ` ${P}-item--done` : ""}${leaving ? ` ${P}-item--leaving` : ""}`}
                    aria-hidden={leaving || undefined}
                  >
                    <div className={`${P}-row`}>
                      <button
                        type="button"
                        className={`${P}-check`}
                        role="checkbox"
                        aria-checked={isDone}
                        aria-label={task.title}
                        onClick={() => toggleTask(task.id)}
                      >
                        {isDone && <CheckIcon />}
                      </button>
                      <div className={`${P}-content`}>
                        <span className={`${P}-title`}>{task.title}</span>
                        <div className={`${P}-meta`}>
                          {task.tag && <span className={`${P}-tag ${P}-tag--${tagStyle}`}>{task.tag}</span>}
                          {priority &&
                            (priority.key === "custom" ? (
                              <span className={`${P}-status`}>{priority.label}</span>
                            ) : (
                              <span className={`${P}-priority ${P}-priority--${priority.key}`}>{priority.label}</span>
                            ))}
                          {due && <span className={`${P}-due ${P}-due--${due.tone}`}>{due.text}</span>}
                          <button
                            type="button"
                            className={`${P}-note-btn`}
                            aria-expanded={noteOpen}
                            onClick={() => toggleNoteBox(task.id)}
                          >
                            + Add Note
                          </button>
                        </div>
                      </div>
                    </div>

                    {noteOpen && (
                      <div className={`${P}-note-box`}>
                        <textarea
                          className={`${P}-textarea`}
                          placeholder="Type your update here..."
                          aria-label={`Add a note to ${task.title}`}
                          value={drafts[task.id] || ""}
                          autoFocus
                          onChange={e => {
                            const value = e.target.value;
                            setDrafts(prev => ({ ...prev, [task.id]: value }));
                          }}
                          onKeyDown={e => {
                            if (e.key === "Escape") setOpenNote(null);
                            // Enter alone inserts a newline; the modifier saves.
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote(task.id);
                          }}
                        />
                        <div className={`${P}-note-actions`}>
                          <button
                            type="button"
                            className={`${P}-save-btn`}
                            disabled={!(drafts[task.id] || "").trim()}
                            onClick={() => saveNote(task.id)}
                          >
                            Save Update
                          </button>
                          <button type="button" className={`${P}-cancel-btn`} onClick={() => setOpenNote(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {taskNotes.length > 0 && (
                      <div className={`${P}-notes`}>
                        {taskNotes.map(note => (
                          <div key={note.id} className={`${P}-note`}>
                            <span className={`${P}-note-time`}>Today at {note.time}</span>
                            {note.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default ActionItems;
