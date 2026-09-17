// ─────────────────────────────────────────────────────────────────────────────
// Cornerstone Learning Leaderboard — a gamified ranking of learning activity,
// themed by the viewer's own group membership.
//
// Two things make this widget more than a bar chart:
//
//   1. The bars *race*. Switching metric re-ranks the field and the rows travel
//      to their new positions (FLIP), so the switch reveals a different story
//      instead of redrawing the same one.
//   2. The colours follow the viewer. Multibranding is group-driven, so the
//      same widget on the same page is Retail red for one person and HQ blue
//      for the next. See `branding.ts`.
//
// The people are real (`/users`); the scores are demo data, derived from one
// seeded completion history per person so the metrics agree with each other.
// See `demo.ts`, and the "Datos de demostración" footnote that says so on
// screen.
// ─────────────────────────────────────────────────────────────────────────────

import {
  BlockFactory, BlockDefinition, ExternalBlockDefinition, BaseBlock,
} from "@staffbase/widget-sdk";
import { JSONSchema7 } from "json-schema";

import { fetchThemeColors } from "../tasks/shared/theming";
import {
  Http, fetchPublicProfile, fetchUserById, hiResAvatar, makeApiOpts, sessionOpts,
} from "./api";
import {
  MAX_BRANDS, applyBrand, loadGroupNames, normalizeHex, readBrands, readViewer,
  resolveBrand, rgbTriplet, fitToSurface,
} from "./branding";
import { FILLER_POOL, buildField, drawPodium, gapAhead, metricValue, rank, restOfPool, syntheticPeople } from "./demo";
import {
  P, CHART_KIND, caption, catchUp, drilldown, esc, footnote, gapText, header, isRowChart, keyOf,
  lines, race, raceRow, rowBody, podium,
} from "./charts";
import { S } from "./strings";
import { BrandMatch, DrawMode, Learner, MetricId, OptsFactory, Person } from "./types";

// ── Defaults ─────────────────────────────────────────────────────────────────

// Ships empty on purpose: the token is a runtime editor value, never a
// committed secret.
const DEFAULT_API_TOKEN = "";
const DEFAULT_BASE_URL = "";
const DEFAULT_PRIMARY = "#7C5CFF";
const DEFAULT_ACCENT = "#3DDC97";

const MAX_FEATURED = 3;
/** A ceiling on the pasted pool — not a design limit, just a guard against a
 *  runaway paste turning into a hundred user lookups. */
const MAX_POOL = 24;

// ── Config schema ────────────────────────────────────────────────────────────

const brandProps: { [k: string]: JSONSchema7 } = {};
for (let i = 1; i <= MAX_BRANDS; i++) {
  brandProps[`brand${i}group`] = { type: "string", title: `Brand ${i} — Group (ID or name)`, default: "" };
  brandProps[`brand${i}primary`] = { type: "string", title: `Brand ${i} — Primary Color`, default: "" };
  brandProps[`brand${i}accent`] = { type: "string", title: `Brand ${i} — Accent Color`, default: "" };
  brandProps[`brand${i}label`] = { type: "string", title: `Brand ${i} — Label`, default: "" };
}

const configurationSchema: JSONSchema7 = {
  properties: {
    apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
    baseurl: { type: "string", title: "Base URL (e.g. https://acme.staffbase.com/api)", default: DEFAULT_BASE_URL },
    authmode: { type: "string", title: "Authentication", enum: ["auto", "token", "session"], default: "auto" },
    topuserids: { type: "string", title: "User IDs (comma-separated — as many as you like)", default: "" },
    podiumdraw: {
      type: "string", title: "How the Top 3 Are Chosen",
      enum: ["shuffle", "typed", "daily", "weekly"], default: "shuffle",
    },
    drawseed: { type: "string", title: "Draw Seed (change to re-roll)", default: "" },
    showviewer: { type: "boolean", title: "Add the Logged-In Viewer to the Ranking", default: true },
    fillercount: { type: "number", title: "Demo Peers Below the Top 3", default: 5 },
    defaultmetric: { type: "string", title: "Starting Metric", enum: ["courses", "hours", "xp", "streak"], default: "courses" },
    showmetricswitcher: { type: "boolean", title: "Let Viewers Switch Metric", default: true },
    showpodium: { type: "boolean", title: "Show Podium", default: true },
    showtierbar: { type: "boolean", title: "Show Level Progress", default: true },
    showbadges: { type: "boolean", title: "Show Badges", default: true },
    showstreak: { type: "boolean", title: "Show Streaks", default: true },
    showdrilldown: { type: "boolean", title: "Let Viewers Open Completed Courses", default: true },
    showcta: { type: "boolean", title: "Show the “Catch Up” Button", default: true },
    ctalabel: { type: "string", title: "Catch-Up Button Label", default: S.ctaAction },
    ctaurl: { type: "string", title: "Catch-Up Button Link (optional)", default: "" },
    colorscheme: { type: "string", title: "Color Scheme", enum: ["dark", "light", "auto"], default: "dark" },
    multibranding: { type: "boolean", title: "Multibranding (Color by the Viewer’s Group)", default: false },
    usethemecolors: { type: "boolean", title: "Use Theme Colors", default: true },
    animate: { type: "boolean", title: "Animate", default: true },
    showdemonote: { type: "boolean", title: "Show “Demo Data” Note", default: true },
    debugmode: { type: "boolean", title: "Debug Mode (on-screen logs)", default: false },
  },
  dependencies: {
    // Manual colours only exist when the branch theme is not driving.
    usethemecolors: {
      oneOf: [
        {
          properties: {
            usethemecolors: { const: false },
            primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY },
            accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT },
          },
        },
        { properties: { usethemecolors: { const: true } } },
      ],
    },
    // Brand slots only exist when multibranding is on — otherwise the editor is
    // sixteen fields of noise for the majority of setups that never use them.
    multibranding: {
      oneOf: [
        { properties: { multibranding: { const: false } } },
        {
          properties: {
            multibranding: { const: true },
            ...brandProps,
            brandfallback: {
              type: "string", title: "When the Viewer Matches No Brand",
              enum: ["theme", "manual"], default: "theme",
            },
            brandpreview: {
              type: "number", title: "Preview Brand Slot (0 = off)", default: 0,
            },
          },
        },
      ],
    },
  },
};

// Left unannotated: the widget SDK bundles its own copy of the rjsf UiSchema
// type, so an explicit annotation from @rjsf/utils is a nominal mismatch.
const uiSchema = {
  apitoken: { "ui:help": "Basic API token. Stored in the widget configuration, not in source." },
  baseurl: { "ui:help": "Must include /api, e.g. https://acme.staffbase.com/api" },
  topuserids: {
    "ui:help": "Any number of Staffbase user IDs. Three of them are drawn for the podium; "
      + "the rest still appear in the ranking.",
  },
  podiumdraw: {
    "ui:help": "Shuffle picks three from anywhere in the list and keeps them fixed. "
      + "Typed ranks them in the order you pasted. Daily/Weekly draw a new three each day or week.",
  },
  drawseed: { "ui:help": "Any text. Changing it re-rolls which three are drawn, without touching the IDs." },
  showviewer: { "ui:help": "The person viewing the page joins the ranking as “Tú”, mid-field, so the XP chart and the catch-up button have a subject." },
  fillercount: { "ui:help": "Generated demo colleagues that fill the ranking below the three real users." },
  ctaurl: { "ui:help": "Where the button goes — your course catalogue. Leave empty to only emit the “cornerstone-learning:catchup” event for the page to handle." },
  multibranding: { "ui:help": "Reads the viewer's groups and themes the widget with the first matching brand." },
  brandpreview: { "ui:help": "Force a brand slot while configuring, since you cannot join every group." },
  brandfallback: { "ui:help": "Theme uses your branch branding; Manual uses the Primary/Accent colors above." },
  showdemonote: { "ui:help": "The scores are generated for demo purposes. Leave this on so viewers know." },
};

// ── CSS ──────────────────────────────────────────────────────────────────────

/* Staffbase's own stylesheet reaches into widget markup. Everything here is a
   neutralisation of a host rule, not a design choice.

   The button reset is split deliberately: (1) the base rule kills geometry
   (width/margin) once, and (2) the state rules re-declare ONLY paint
   (background/color/shadow/outline). Geometry must not appear in (2) — Staffbase
   sets `width:90%; margin:auto` on the base button rule only, so repeating
   geometry per state raises specificity above the widget's own component rules
   and collapses round buttons the moment they are hovered or pressed. */
const HOST_RESET = `
.${P}-root button{
  width:auto!important;min-width:0!important;margin:0!important;
  background:none!important;border:0!important;box-shadow:none!important;
  color:inherit!important;font-family:inherit!important;line-height:normal!important;
  text-transform:none!important;letter-spacing:inherit!important;outline:none!important;
  padding:0;border-radius:0;cursor:pointer;-webkit-appearance:none;appearance:none;
  -webkit-tap-highlight-color:transparent;display:inline-flex;align-items:center;justify-content:center}
.${P}-root button:hover,
.${P}-root button:focus,
.${P}-root button:focus-visible,
.${P}-root button:active{
  background:none!important;box-shadow:none!important;color:inherit!important;
  outline:none!important}
.${P}-root a,.${P}-root a:hover,.${P}-root a:focus,.${P}-root a:active{
  color:inherit!important;text-decoration:none!important;background:none!important}
.${P}-root ol,.${P}-root ul{list-style:none!important;margin:0!important;padding:0!important}
.${P}-root li{margin:0!important;padding:0!important;list-style:none!important}
.${P}-root h1,.${P}-root h2,.${P}-root h3,.${P}-root h4,.${P}-root h5,.${P}-root h6,
.${P}-root p,.${P}-root figure{
  margin:0!important;padding:0!important;font-family:inherit!important}
/* Staffbase's rich-text rule is ~6 classes deep but carries no !important, so
   pinning the properties it sets wins outright. Scoped to bare p, which is the
   entire blast radius — without it every paragraph is forced to 16px/#171719,
   invisible on the dark stage. */
.${P}-root p{
  color:inherit!important;font-size:inherit!important;font-weight:inherit!important;
  font-style:normal!important;line-height:inherit!important}
.${P}-root img{max-width:none!important;margin:0!important;border-radius:0}
.${P}-root svg{display:block;overflow:visible}
.${P}-root *,.${P}-root *::before,.${P}-root *::after{box-sizing:border-box}
`;

const CSS = `
${HOST_RESET}

/* --tint is what makes two schemes possible from one stylesheet: the colour
   laid over the background at low alpha for panels, tracks and hairlines.
   White on the dark stage, near-black on the light one. */
.${P}-root{
  --tint:255,255,255;
  --bg:#0B0D12;
  --bg-2:#141926;
  --panel:rgba(var(--tint),.045);
  --panel-2:rgba(var(--tint),.075);
  --line:rgba(var(--tint),.10);
  --ink:#F2F5FA;
  --ink-2:#98A4BC;
  --csl-primary:${DEFAULT_PRIMARY};
  --csl-accent:${DEFAULT_ACCENT};
  --csl-primary-rgb:${rgbTriplet(DEFAULT_PRIMARY)};
  --csl-accent-rgb:${rgbTriplet(DEFAULT_ACCENT)};
  --r:20px;--r-sm:12px;--r-xs:8px;
  --dur:.42s;
  --ease:cubic-bezier(.22,.86,.28,1);
  position:relative;
  font-family:inherit;
  color:var(--ink);
  border-radius:var(--r);
  padding:22px 22px 16px;
  background:
    radial-gradient(120% 90% at 8% -10%, rgba(var(--csl-primary-rgb),.30), transparent 60%),
    radial-gradient(90% 80% at 100% 0%, rgba(var(--csl-accent-rgb),.20), transparent 62%),
    linear-gradient(160deg, var(--bg-2), var(--bg));
  box-shadow:0 24px 60px -30px rgba(0,0,0,.75);
  overflow:hidden;
  /* Brand colour changes are animated: on a multibrand demo the recolour is the
     point, and a hard swap reads as a reload. */
  transition:background .5s var(--ease);
}
.${P}-root[data-scheme="light"]{
  --tint:16,20,30;
  --bg:#FFFFFF;
  --bg-2:#F4F6FB;
  --panel:rgba(var(--tint),.045);
  --panel-2:rgba(var(--tint),.07);
  --line:rgba(var(--tint),.12);
  --ink:#121724;
  --ink-2:#5C6780;
  box-shadow:0 18px 40px -28px rgba(16,20,30,.4);
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.${P}-head{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;
  justify-content:space-between;margin-bottom:18px}
.${P}-title{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:700;
  letter-spacing:-.01em}
.${P}-title svg{color:var(--csl-accent)}
.${P}-sub{margin-top:3px!important;font-size:12.5px;color:var(--ink-2)}
.${P}-head-side{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.${P}-brandchip{display:inline-flex;align-items:center;gap:5px;font-size:11px;
  font-weight:650;letter-spacing:.02em;padding:5px 9px;border-radius:999px;
  color:var(--csl-primary);background:rgba(var(--csl-primary-rgb),.14);
  border:1px solid rgba(var(--csl-primary-rgb),.3)}

/* ── Metric switcher ────────────────────────────────────────────────────── */
.${P}-tabs{position:relative;display:inline-flex;gap:2px;padding:3px;
  background:var(--panel);border:1px solid var(--line);border-radius:999px}
.${P}-tab{position:relative;z-index:1;gap:6px;padding:7px 13px!important;
  border-radius:999px!important;font-size:12.5px;font-weight:600;color:var(--ink-2);
  transition:color .22s var(--ease)}
.${P}-tab-ico{display:inline-flex;opacity:.85}
.${P}-tab-on{color:#fff}
.${P}-root[data-scheme="light"] .${P}-tab-on{color:#fff}
.${P}-tab-ink{position:absolute;z-index:0;top:3px;left:0;height:calc(100% - 6px);
  border-radius:999px;background:linear-gradient(120deg,var(--csl-primary),var(--csl-accent));
  box-shadow:0 6px 18px -8px rgba(var(--csl-primary-rgb),.9);
  transition:transform var(--dur) var(--ease),width var(--dur) var(--ease);
  transform:translateX(0);width:0}

/* ── Podium ─────────────────────────────────────────────────────────────── */
.${P}-podium{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;
  align-items:end;margin-bottom:18px}
.${P}-pod{display:flex;flex-direction:column;align-items:center;text-align:center;
  gap:7px;padding:16px 12px 14px;border-radius:var(--r-sm);
  background:var(--panel);border:1px solid var(--line)}
.${P}-pod-1{order:2;padding-top:22px;
  background:linear-gradient(170deg,rgba(var(--csl-primary-rgb),.22),var(--panel));
  border-color:rgba(var(--csl-primary-rgb),.36)}
.${P}-pod-2{order:1}
.${P}-pod-3{order:3}
.${P}-pod-avwrap{position:relative}
.${P}-pod-rank{position:absolute;bottom:-4px;right:-4px;display:inline-flex;
  align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;
  font-size:12px;font-weight:800;color:#0B0D12;
  background:linear-gradient(140deg,var(--csl-accent),var(--csl-primary));
  box-shadow:0 4px 12px -4px rgba(0,0,0,.6)}
.${P}-pod-nm{font-size:13.5px;font-weight:680;line-height:1.25}
.${P}-pod-meta{font-size:11px;color:var(--ink-2);line-height:1.3}
.${P}-pod-num{display:flex;align-items:baseline;gap:4px;margin-top:2px}
.${P}-pod-num .${P}-num{font-size:24px;font-weight:800;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums}
.${P}-pod-1 .${P}-num{font-size:30px;color:var(--csl-accent)}
.${P}-unit{font-size:11px;color:var(--ink-2);font-weight:600}

/* ── Tier ───────────────────────────────────────────────────────────────── */
.${P}-tier{width:100%;margin-top:4px}
.${P}-tier-head{display:flex;justify-content:space-between;align-items:center;gap:6px;
  font-size:10.5px;margin-bottom:4px}
.${P}-tier-name{display:inline-flex;align-items:center;gap:4px;font-weight:700;
  color:var(--csl-accent)}
.${P}-tier-cap{color:var(--ink-2);text-align:right}
.${P}-tier-track{height:5px;border-radius:999px;background:var(--panel-2);overflow:hidden}
.${P}-tier-fill{display:block;height:100%;width:var(--pct);border-radius:999px;
  background:linear-gradient(90deg,var(--csl-primary),var(--csl-accent));
  transform-origin:left center}

/* ── Badges ─────────────────────────────────────────────────────────────── */
.${P}-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}
.${P}-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;
  border-radius:999px;font-size:10.5px;font-weight:650;color:var(--csl-accent);
  background:rgba(var(--csl-accent-rgb),.12);
  border:1px solid rgba(var(--csl-accent-rgb),.26);cursor:default}
.${P}-badges-c .${P}-badge{padding:3px;border-radius:50%}
.${P}-nobadge{font-size:11px;color:var(--ink-2)}

/* ── Race ───────────────────────────────────────────────────────────────── */
.${P}-race{display:flex;flex-direction:column;gap:2px}
.${P}-row{border-radius:var(--r-sm)}
.${P}-row-main{display:flex;align-items:center;gap:11px;padding:9px 10px;
  border-radius:var(--r-sm);cursor:default;transition:background .2s var(--ease)}
.${P}-row-main[role="button"]{cursor:pointer}
.${P}-row-main[role="button"]:hover{background:var(--panel)}
.${P}-row-main:focus-visible{outline:2px solid var(--csl-accent);outline-offset:-2px}
.${P}-rank{flex:0 0 18px;text-align:center;font-size:12px;font-weight:700;
  color:var(--ink-2);font-variant-numeric:tabular-nums}
.${P}-row-body{flex:1;min-width:0}
.${P}-row-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.${P}-row-nm{font-size:13px;font-weight:620;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.${P}-row-val{display:inline-flex;align-items:baseline;gap:4px;flex:0 0 auto}
.${P}-row-val .${P}-num{font-size:13.5px;font-weight:750;font-variant-numeric:tabular-nums}
.${P}-bar{height:7px;margin-top:5px;border-radius:999px;background:var(--panel-2);
  overflow:hidden}
.${P}-bar-fill{display:block;height:100%;width:var(--w);border-radius:999px;
  background:linear-gradient(90deg,rgba(var(--csl-primary-rgb),.95),var(--csl-accent));
  transition:width var(--dur) var(--ease)}
.${P}-row:nth-child(1) .${P}-bar-fill{box-shadow:0 0 16px -2px rgba(var(--csl-accent-rgb),.6)}

/* ── Stacked hours ──────────────────────────────────────────────────────── */
/* The stack keeps the track of a normal bar (so lengths stay comparable across
   people) and divides its own width into one segment per course. */
.${P}-bar-stack{display:flex;gap:1.5px;width:var(--w);height:100%;
  transition:width var(--dur) var(--ease);transform-origin:left center}
.${P}-seg{flex:0 0 var(--s);height:100%;border-radius:2px;min-width:2px;
  background:rgba(var(--csl-primary-rgb),.55);cursor:default;
  transition:transform .18s var(--ease),filter .18s var(--ease)}
.${P}-seg:first-child{border-top-left-radius:999px;border-bottom-left-radius:999px}
.${P}-seg:last-child{border-top-right-radius:999px;border-bottom-right-radius:999px}
.${P}-seg[data-type="event"]{background:rgba(var(--csl-primary-rgb),.85)}
.${P}-seg[data-req="true"]{background:var(--csl-accent)}
.${P}-seg:hover{transform:scaleY(1.7);filter:brightness(1.15)}

/* ── Streak heatmap ─────────────────────────────────────────────────────── */
.${P}-heat{display:flex;gap:4px;margin-top:6px}
.${P}-heat-c{flex:1 1 0;height:14px;border-radius:3px;background:var(--panel-2);
  cursor:default;transition:transform .18s var(--ease),background .25s var(--ease)}
.${P}-heat-c[data-lvl="1"]{background:rgba(var(--csl-primary-rgb),.38)}
.${P}-heat-c[data-lvl="2"]{background:rgba(var(--csl-primary-rgb),.7)}
.${P}-heat-c[data-lvl="3"]{background:var(--csl-accent)}
.${P}-heat-c:hover{transform:scaleY(1.25)}

/* ── XP lines ───────────────────────────────────────────────────────────── */
.${P}-lines{margin-top:2px}
.${P}-lines-svg{width:100%;height:auto;overflow:visible}
.${P}-grid{stroke:rgba(var(--tint),.13);stroke-width:1;stroke-dasharray:3 4}
.${P}-ytick,.${P}-xtick{fill:var(--ink-2);font-size:10px;font-family:inherit;
  font-variant-numeric:tabular-nums}
.${P}-lngrp{cursor:pointer;transition:opacity .22s var(--ease)}
.${P}-lngrp:focus{outline:none}
.${P}-lngrp:focus-visible .${P}-ln{stroke-width:3.4}
/* A 14px transparent stroke under each line: a 2px path is not a hit target,
   and "hover the line" is the entire interaction. */
.${P}-ln-hit{fill:none;stroke:transparent;stroke-width:14;pointer-events:stroke}
.${P}-ln{fill:none;stroke-linejoin:round;stroke-linecap:round;
  stroke:rgba(var(--tint),.28);stroke-width:1.6;pointer-events:none;
  transition:stroke-width .2s var(--ease)}
.${P}-ln-dot{fill:var(--bg-2);stroke:currentColor;stroke-width:2;pointer-events:none}
.${P}-ln-lbl{fill:var(--ink-2);font-size:10.5px;font-weight:650;font-family:inherit;
  pointer-events:none}
.${P}-lngrp[data-role="top"]{color:var(--csl-primary)}
.${P}-lngrp[data-role="top"] .${P}-ln{stroke:var(--csl-primary);stroke-width:2.2;opacity:.85}
.${P}-lngrp[data-role="you"]{color:var(--csl-accent)}
.${P}-lngrp[data-role="you"] .${P}-ln{stroke:var(--csl-accent);stroke-width:3.2;
  filter:drop-shadow(0 2px 10px rgba(var(--csl-accent-rgb),.55))}
.${P}-lngrp[data-role="you"] .${P}-ln-lbl{fill:var(--csl-accent);font-weight:800}
/* One line raised, the rest pushed back — the comparison only reads if the
   others recede. */
.${P}-lines[data-on="1"] .${P}-lngrp{opacity:.14}
.${P}-lines[data-on="1"] .${P}-lngrp.${P}-ln-on{opacity:1}
.${P}-lines[data-on="1"] .${P}-lngrp.${P}-ln-on .${P}-ln{stroke-width:3.4}
.${P}-lgd{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:8px;
  padding-left:2px;font-size:11px;color:var(--ink-2)}
.${P}-lgd-i{display:inline-flex;align-items:center;gap:6px;font-weight:620}
.${P}-lgd-i::before{content:"";width:16px;height:3px;border-radius:2px;
  background:rgba(var(--tint),.3)}
.${P}-lgd-i[data-role="top"]::before{background:var(--csl-primary)}
.${P}-lgd-i[data-role="you"]::before{background:var(--csl-accent);height:4px}
.${P}-lgd-i[data-role="you"]{color:var(--csl-accent)}
.${P}-lgd-hint{margin-left:auto;opacity:.7}
.${P}-lines-dd{margin-top:6px;border-top:1px solid var(--line)}
.${P}-lines-dd .${P}-dd-in{padding:12px 2px 4px}

/* ── You ────────────────────────────────────────────────────────────────── */
.${P}-you{flex:0 0 auto;padding:1px 6px;border-radius:999px;font-size:9.5px;
  font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#0B0D12;
  background:var(--csl-accent)}
.${P}-row[data-you="1"]{background:rgba(var(--csl-accent-rgb),.07);
  box-shadow:inset 0 0 0 1px rgba(var(--csl-accent-rgb),.22)}
.${P}-pod[data-you="1"]{box-shadow:0 0 0 1px rgba(var(--csl-accent-rgb),.45)}

/* ── Catch up ───────────────────────────────────────────────────────────── */
.${P}-cta{display:flex;align-items:center;gap:13px;margin-top:14px;padding:13px 15px;
  border-radius:var(--r-sm);
  background:linear-gradient(120deg,rgba(var(--csl-primary-rgb),.20),rgba(var(--csl-accent-rgb),.10));
  border:1px solid rgba(var(--csl-primary-rgb),.3)}
.${P}-cta-ico{display:inline-flex;flex:0 0 auto;width:38px;height:38px;border-radius:50%;
  align-items:center;justify-content:center;color:var(--csl-accent);
  background:rgba(var(--csl-accent-rgb),.14)}
.${P}-cta-txt{flex:1;min-width:0}
.${P}-cta-title{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:750}
.${P}-cta-rank{padding:1px 7px;border-radius:999px;font-size:10px;font-weight:700;
  color:var(--ink-2);background:var(--panel-2)}
.${P}-cta-gap{margin-top:2px;font-size:12px;color:var(--ink-2);line-height:1.35}
.${P}-cta-btn{flex:0 0 auto;gap:7px;padding:9px 15px!important;border-radius:999px!important;
  font-size:12.5px;font-weight:700;color:#0B0D12!important;
  background:linear-gradient(120deg,var(--csl-accent),var(--csl-primary))!important;
  box-shadow:0 10px 24px -12px rgba(var(--csl-accent-rgb),.9);
  transition:transform .18s var(--ease),box-shadow .18s var(--ease)}
.${P}-cta-btn:hover{transform:translateY(-1px);
  box-shadow:0 14px 28px -12px rgba(var(--csl-accent-rgb),1)}
.${P}-cta-btn:active{transform:translateY(0)}
.${P}-cta-btn:focus-visible{outline:2px solid var(--csl-accent);outline-offset:3px}
/* Pressing the button with no URL configured has nothing visible to do — the
   page is listening for the event instead — so the press acknowledges itself. */
.${P}-cta-btn[data-pulse="1"]{animation:${P}-pulse .6s var(--ease)}
@keyframes ${P}-pulse{
  0%{transform:scale(1)}
  35%{transform:scale(1.06)}
  100%{transform:scale(1)}}
.${P}-cta[data-done="1"] .${P}-cta-gap{color:var(--csl-accent)}

/* ── Caption ────────────────────────────────────────────────────────────── */
.${P}-cap{display:flex;align-items:center;gap:6px;margin:0 0 9px 2px;font-size:11px;
  font-weight:600;letter-spacing:.01em;color:var(--ink-2)}
.${P}-cap svg{opacity:.8}
.${P}-row-sub{display:flex;align-items:center;gap:6px;margin-top:5px;min-height:0}
.${P}-row-sub:empty{display:none}
.${P}-streak{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;
  font-weight:700;color:#FF9E5E}
.${P}-row-chev{color:var(--ink-2);transition:transform .25s var(--ease)}
.${P}-row[data-open="1"] .${P}-row-chev{transform:rotate(180deg)}
.${P}-row[data-open="1"]{background:var(--panel)}

/* ── Spark ──────────────────────────────────────────────────────────────── */
.${P}-spark{display:inline-flex;gap:3px;align-items:flex-end}
.${P}-spark-c{width:7px;height:7px;border-radius:2px;background:var(--panel-2)}
.${P}-spark-c[data-lvl="1"]{background:rgba(var(--csl-primary-rgb),.45)}
.${P}-spark-c[data-lvl="2"]{background:rgba(var(--csl-primary-rgb),.75)}
.${P}-spark-c[data-lvl="3"]{background:var(--csl-accent)}

/* ── Drilldown ──────────────────────────────────────────────────────────── */
.${P}-dd{overflow:hidden}
.${P}-dd-in{padding:4px 10px 14px 39px}
.${P}-dd-head{font-size:11px;font-weight:700;letter-spacing:.04em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:8px}
.${P}-dd-empty{padding:6px 10px 14px 39px;font-size:12px;color:var(--ink-2)}
.${P}-cc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:9px}
.${P}-cc{display:flex;flex-direction:column;border-radius:var(--r-xs);overflow:hidden;
  background:var(--panel);border:1px solid var(--line)}
.${P}-cc-img{position:relative;height:74px;background:var(--panel-2)}
.${P}-cc-img img{width:100%;height:100%;object-fit:cover;display:block}
.${P}-cc-req{position:absolute;top:6px;left:6px;padding:2px 6px;border-radius:999px;
  font-size:9.5px;font-weight:750;color:#0B0D12;background:var(--csl-accent)}
.${P}-cc-body{padding:8px 9px 9px;display:flex;flex-direction:column;gap:4px}
.${P}-cc-title{font-size:12px;font-weight:660;line-height:1.3}
.${P}-cc-meta{display:flex;flex-wrap:wrap;gap:7px;font-size:10px;color:var(--ink-2)}
.${P}-cc-meta span{display:inline-flex;align-items:center;gap:3px}
.${P}-cc-flag{display:inline-flex;align-items:center;gap:3px;font-size:10px;
  font-weight:700;color:#FF9E5E;margin-top:1px}
.${P}-cc-flag[data-ok="true"]{color:var(--csl-accent)}

/* ── Avatars ────────────────────────────────────────────────────────────── */
.${P}-av{position:relative;display:inline-block;width:var(--av);height:var(--av);
  border-radius:50%;overflow:hidden;flex:0 0 auto;background:var(--panel-2)}
.${P}-av img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}
.${P}-av-fb::after{content:attr(data-ini);position:absolute;inset:0;display:flex;
  align-items:center;justify-content:center;
  font-size:calc(var(--av) * .38);font-weight:700;color:#fff;letter-spacing:.02em;
  background:linear-gradient(140deg,var(--csl-primary),var(--csl-accent))}
.${P}-av-hero{box-shadow:0 10px 26px -12px rgba(0,0,0,.85);
  outline:2px solid rgba(var(--csl-accent-rgb),.5);outline-offset:2px}
.${P}-avlink{display:inline-flex;border-radius:50%}

/* ── States ─────────────────────────────────────────────────────────────── */
.${P}-state{padding:26px 10px;text-align:center;font-size:13px;color:var(--ink-2)}
.${P}-state strong{display:block;color:var(--ink);font-size:14px;margin-bottom:5px}
.${P}-note{display:flex;align-items:center;gap:5px;margin-top:12px;font-size:10.5px;
  color:var(--ink-2);opacity:.8}
.${P}-dbg{margin-top:12px;padding:9px 10px;border-radius:var(--r-xs);
  background:var(--panel);border:1px solid var(--line);font-family:ui-monospace,monospace;
  font-size:10.5px;color:var(--ink-2);white-space:pre-wrap;max-height:180px;overflow:auto}

/* ── Motion ─────────────────────────────────────────────────────────────── */
/* Gated behind [data-anim="1"] so the config flag and prefers-reduced-motion
   both switch it off by removing one attribute, rather than by trying to
   unwind transitions that have already been declared. */
.${P}-root[data-anim="1"] .${P}-reveal .${P}-pod,
.${P}-root[data-anim="1"] .${P}-reveal .${P}-row{
  opacity:0;transform:translateY(10px);
  animation:${P}-in .5s var(--ease) forwards;
  animation-delay:calc(var(--i,0) * 55ms)}
.${P}-root[data-anim="1"] .${P}-reveal .${P}-bar-fill{
  animation:${P}-grow .7s var(--ease) both;
  animation-delay:calc(var(--i,0) * 55ms + 90ms)}
.${P}-root[data-anim="1"] .${P}-reveal .${P}-bar-stack{
  animation:${P}-grow .7s var(--ease) both;
  animation-delay:calc(var(--i,0) * 55ms + 90ms)}
.${P}-root[data-anim="1"] .${P}-reveal .${P}-heat-c{
  opacity:0;animation:${P}-pop .4s var(--ease) forwards;
  animation-delay:calc(var(--i,0) * 45ms + 120ms)}
/* The line draws itself: dasharray is set to the path length in JS (SVG cannot
   express "my own length" in CSS), then the offset is animated to zero. A path
   that simply appeared would lose the sense of accumulation the chart is for. */
.${P}-root[data-anim="1"] .${P}-reveal .${P}-ln[data-len]{
  stroke-dasharray:var(--len);stroke-dashoffset:var(--len);
  animation:${P}-draw 1.05s var(--ease) forwards;
  animation-delay:calc(var(--i,0) * 70ms)}
.${P}-root[data-anim="1"] .${P}-reveal .${P}-ln-dot,
.${P}-root[data-anim="1"] .${P}-reveal .${P}-ln-lbl{
  opacity:0;animation:${P}-in .4s var(--ease) forwards;animation-delay:.75s}
.${P}-root[data-anim="1"] .${P}-reveal .${P}-cta{
  opacity:0;animation:${P}-in .5s var(--ease) forwards;animation-delay:.42s}
.${P}-root[data-anim="1"] .${P}-cc{
  opacity:0;animation:${P}-in .34s var(--ease) forwards;
  animation-delay:calc(var(--i,0) * 40ms)}
@keyframes ${P}-in{to{opacity:1;transform:none}}
@keyframes ${P}-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
@keyframes ${P}-draw{to{stroke-dashoffset:0}}
@keyframes ${P}-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
/* FLIP: the row is put back at its old offset with no transition, then released
   on the next frame with one. */
.${P}-row[data-flip="1"]{transition:none}
.${P}-row[data-flip="2"]{transition:transform var(--dur) var(--ease)}
@media (prefers-reduced-motion:reduce){
  .${P}-root *{animation:none!important;transition:none!important}
}

/* ── Narrow ─────────────────────────────────────────────────────────────── */
@media (max-width:560px){
  .${P}-root{padding:16px 14px 12px}
  .${P}-head{flex-direction:column;align-items:stretch}
  .${P}-podium{grid-template-columns:1fr;align-items:stretch}
  .${P}-pod,.${P}-pod-1,.${P}-pod-2,.${P}-pod-3{order:0;flex-direction:row;
    text-align:left;align-items:center;padding:11px 12px;flex-wrap:wrap}
  .${P}-pod-nm{flex:1}
  .${P}-pod-num{margin-left:auto}
  .${P}-pod-1 .${P}-num{font-size:24px}
  .${P}-tier{flex:0 0 100%}
  .${P}-dd-in,.${P}-dd-empty{padding-left:12px}
  .${P}-tabs{width:100%;justify-content:space-between}
  .${P}-tab{flex:1;padding:7px 8px!important}
  .${P}-cta{flex-wrap:wrap;gap:10px;padding:12px}
  .${P}-cta-btn{width:100%!important;justify-content:center}
  .${P}-lgd-hint{display:none}
  /* The SVG scales down with the container, so text inside it has to scale up
     to stay legible — these are viewBox units, not CSS pixels. */
  .${P}-ln-lbl{font-size:13px}
  .${P}-ytick,.${P}-xtick{font-size:12px}
}
`;

// ── Factory ──────────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class CornerstoneLearning extends BaseBlockClass implements BaseBlock {
    constructor() { super(); }

    async connectedCallback() {
      const host = this as unknown as HTMLElement;
      const attr = (n: string): string => host.getAttribute(n) || "";
      const bool = (n: string, dflt: boolean): boolean => {
        const v = attr(n);
        return v === "" ? dflt : v !== "false" && v !== "0";
      };
      const num = (n: string, dflt: number): number => {
        const v = Number(attr(n));
        return isFinite(v) && attr(n) !== "" ? v : dflt;
      };

      const debug = bool("debugmode", false);
      const logs: string[] = [];
      const log = (...a: any[]) => {
        const line = a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
        logs.push(line);
        if (debug) console.log(`[${P}]`, ...a);
      };

      // ── Scheme ──
      const schemeCfg = attr("colorscheme") || "dark";
      const prefersDark = typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const scheme: "light" | "dark" = schemeCfg === "auto"
        ? (prefersDark ? "dark" : "light")
        : (schemeCfg === "light" ? "light" : "dark");

      const reduceMotion = typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const animate = bool("animate", true) && !reduceMotion;

      // ── Shell ──
      host.innerHTML = `<style>${CSS}</style>
        <div class="${P}-root" data-scheme="${scheme}" data-anim="${animate ? 1 : 0}">
          <div class="${P}-body"><div class="${P}-state">${esc(S.loading)}</div></div>
        </div>`;
      const root = host.querySelector(`.${P}-root`) as HTMLElement;
      const body = host.querySelector(`.${P}-body`) as HTMLElement;

      const baseUrl = attr("baseurl").replace(/\/+$/, "");
      const apiToken = attr("apitoken") || DEFAULT_API_TOKEN;
      const authMode = attr("authmode") || "auto";
      const http = new Http(4, log);

      const tokenOrder: OptsFactory[] = apiToken && authMode !== "session" ? [makeApiOpts(apiToken)] : [];
      const sessionFirst: OptsFactory[] = authMode === "token" ? tokenOrder : [sessionOpts, ...tokenOrder];
      const tokenFirst: OptsFactory[] = authMode === "session" ? [sessionOpts] : [...tokenOrder, sessionOpts];

      // ── Branding ──
      const manual: BrandMatch = {
        primary: fitToSurface(normalizeHex(attr("primarycolor")) || DEFAULT_PRIMARY, scheme),
        accent: fitToSurface(normalizeHex(attr("accentcolor")) || DEFAULT_ACCENT, scheme),
        label: "",
        source: "manual",
        via: "",
      };

      /** The non-brand palette: branch theme when asked for and reachable,
       *  otherwise whatever the editor set by hand. */
      const baseTheme = async (): Promise<BrandMatch> => {
        if (bool("usethemecolors", true) && apiToken && baseUrl) {
          try {
            const t = await fetchThemeColors(baseUrl, apiToken, "primary", scheme);
            if (t.primary) {
              log("theme colors", t.primary, t.accent || "(no accent)");
              return {
                primary: fitToSurface(t.primary, scheme),
                accent: fitToSurface(t.accent || t.primary, scheme),
                label: "", source: "theme", via: "",
              };
            }
          } catch (e: any) {
            log("theme colors failed —", e?.message || String(e));
          }
        }
        return manual;
      };

      let match: BrandMatch = await baseTheme();

      // Read once, up front: the same identity answers two questions — which
      // brand to paint, and who "Tú" is in the ranking.
      const viewer = await readViewer(widgetApi, log);

      if (bool("multibranding", false)) {
        const brands = readBrands(attr);
        const fallbackKind = attr("brandfallback") || "theme";
        const fallback: BrandMatch = fallbackKind === "manual" ? manual : match;
        const groupNames = await loadGroupNames(http, baseUrl, tokenFirst, brands, log);
        match = resolveBrand({
          brands, viewer, groupNames,
          preview: Math.max(0, Math.floor(num("brandpreview", 0))),
          fallback, surface: scheme, log,
        });
      }
      applyBrand(root, match);

      // ── People ──
      //
      // The admin pastes a pool, not a podium. Everyone in it is resolved and
      // everyone in it appears; the draw decides which three are on top (see
      // `drawPodium`), so the same configuration can show a different three
      // without anyone editing it.
      const ids = attr("topuserids").split(",").map(s => s.trim()).filter(Boolean).slice(0, MAX_POOL);
      const canFetch = !!baseUrl && (!!apiToken || authMode !== "token");
      const pool: Person[] = [];

      if (canFetch && ids.length) {
        const found = await Promise.all(ids.map(id => fetchUserById(http, baseUrl, id, tokenFirst)));
        for (let i = 0; i < found.length; i++) {
          if (!found[i]) { log(`user ${ids[i]} could not be resolved — skipped`); continue; }
          pool.push(found[i] as Person);
        }
      } else if (ids.length) {
        log("no base URL or token — falling back to demo people");
      }

      const drawMode = (attr("podiumdraw") || "shuffle") as DrawMode;
      const drawSeed = `${attr("drawseed")}|${ids.join(",")}`;
      const drawn = drawPodium(pool.length, drawMode, drawSeed, MAX_FEATURED);
      const featured: Person[] = drawn.map(i => pool[i]).filter(Boolean);
      const others: Person[] = restOfPool(pool, drawn);
      log("draw", drawMode, `— pool ${pool.length}, podium`,
        featured.map(p => p.name).join(" / ") || "(none)");

      // Podium portraits are 92px and /users only returns a 48px icon, so the
      // public profile is worth one extra request — but only for the three who
      // are actually shown at that size.
      for (const p of featured) {
        if (!canFetch) break;
        const prof = await fetchPublicProfile(http, baseUrl, p.id, sessionFirst);
        if (prof?.avatar) p.avatar = prof.avatar;
        if (!p.position && prof?.position) p.position = prof.position;
        if (!p.department && prof?.department) p.department = prof.department;
        p.avatar = hiResAvatar(p.avatar, 200);
      }

      // Any unfilled slot becomes a demo peer, so the podium is never short.
      // These take names from the front of the pool and `buildField` fills from
      // `featured.length` onward, so no two rows can show the same name.
      if (featured.length < MAX_FEATURED) {
        for (const p of syntheticPeople(MAX_FEATURED - featured.length, featured.length)) {
          featured.push(p);
        }
      }

      // ── The viewer ──
      //
      // Adding the logged-in person to the field is what makes the XP chart a
      // comparison and the catch-up button a request. If they are already in
      // the configured pool they are simply flagged; otherwise they join as an
      // extra participant, mid-field by construction (see `buildField`).
      if (bool("showviewer", true)) {
        const already = featured.concat(others).filter(p => p.id && p.id === viewer.id)[0];
        if (already) {
          already.isViewer = true;
          log("viewer is in the configured pool —", already.name);
        } else {
          let me: Person | null = null;
          if (canFetch && viewer.id) me = await fetchUserById(http, baseUrl, viewer.id, sessionFirst);
          if (me) {
            me.avatar = hiResAvatar(me.avatar, 120);
            me.isViewer = true;
            others.push(me);
            log("viewer joined the field —", me.name);
          } else {
            // No session (editor preview, logged-out render, failed lookup) —
            // a generic "Tú" row still demonstrates the comparison, and is
            // clearly not claiming to be a real person.
            others.push({
              id: "", name: S.you, avatar: "", position: "", department: "",
              synthetic: true, isViewer: true,
            });
            log("viewer could not be resolved — showing a generic “Tú” row");
          }
        }
      }

      // Capped so the peer names never wrap the pool and start repeating.
      const fillerCount = Math.max(0, Math.min(
        FILLER_POOL - featured.length, Math.round(num("fillercount", 5))));
      const learners = buildField(featured, others, fillerCount);
      const realCount = featured.concat(others).filter(p => !p.synthetic).length;
      log("field", learners.length, "learners;", realCount, "real");

      // ── Render ──
      const opts = {
        drilldown: bool("showdrilldown", true),
        badges: bool("showbadges", true),
        streak: bool("showstreak", true),
      };
      const showPodium = bool("showpodium", true);
      const showTier = bool("showtierbar", true);
      const showSwitcher = bool("showmetricswitcher", true);

      const validMetric = (v: string): v is MetricId =>
        v === "courses" || v === "hours" || v === "xp" || v === "streak";
      const startMetric = attr("defaultmetric");
      let metric: MetricId = validMetric(startMetric) ? startMetric : "courses";

      const showCta = bool("showcta", true);
      const ctaLabel = attr("ctalabel") || S.ctaAction;
      const ctaUrl = attr("ctaurl");
      const viewerKey = (learners.filter(l => l.person.isViewer)[0] || { key: "" }).key;

      let ranked = rank(learners, metric);

      /** The chart itself. Which shape appears is a property of the metric, not
       *  of the render call — see `CHART_KIND`. */
      const area = (m: MetricId): string => {
        if (CHART_KIND[m] === "lines") {
          // Lines are a comparison, so they plot the whole field including the
          // podium — leaving the leaders out would remove the thing the viewer
          // is measuring themselves against.
          return lines(ranked, viewerKey);
        }
        return race(showPodium ? ranked.slice(3) : ranked, m, opts);
      };

      const gapNow = () => gapAhead(learners, metric);

      const paint = () => {
        body.innerHTML = `
          ${header(match.label, metric, showSwitcher)}
          <div class="${P}-charts">
            ${showPodium ? podium(ranked.slice(0, 3), metric, showTier, opts.badges) : ""}
            ${caption(metric)}
            <div class="${P}-area" data-kind="${CHART_KIND[metric]}">${area(metric)}</div>
            ${showCta ? catchUp(gapNow(), metric, ctaLabel, ctaUrl) : ""}
          </div>
          ${bool("showdemonote", true) ? footnote() : ""}
          ${debug ? `<pre class="${P}-dbg">${esc(logs.join("\n"))}</pre>` : ""}`;
        measureLines();
      };

      /**
       * SVG cannot express "dash me by my own length" in CSS, so the draw-on
       * animation needs the measured path length written back as a custom
       * property. Guarded because `getTotalLength` does not exist in every
       * rendering context (jsdom, for one), and a missing measurement must
       * leave a fully drawn line rather than an invisible one.
       */
      function measureLines() {
        const paths = Array.prototype.slice.call(
          body.querySelectorAll(`.${P}-ln`)) as any[];
        paths.forEach((p, i) => {
          if (typeof p.getTotalLength !== "function") return;
          let len = 0;
          try { len = p.getTotalLength(); } catch (_) { return; }
          if (!len) return;
          p.style.setProperty("--len", `${Math.ceil(len)}`);
          p.setAttribute("data-len", "1");
          const grp = p.parentElement as HTMLElement | null;
          if (grp) grp.style.setProperty("--i", String(i));
        });
      }

      paint();

      // ── Reveal ──
      // Staggered entry fires when the widget is actually on screen; a
      // leaderboard that animated in while scrolled past has animated for
      // nobody.
      //
      // `rafId` is declared before the reveal path rather than next to
      // `countUp`: without IntersectionObserver the reveal runs immediately,
      // and a `let` declared further down is still in its temporal dead zone at
      // that point.
      let rafId = 0;
      const charts = () => body.querySelector(`.${P}-charts`) as HTMLElement | null;
      let observer: IntersectionObserver | null = null;
      const reveal = () => {
        const c = charts();
        if (c) c.classList.add(`${P}-reveal`);
        countUp();
      };
      if (animate && typeof IntersectionObserver === "function") {
        observer = new IntersectionObserver(entries => {
          for (const e of entries) {
            if (e.isIntersecting) { reveal(); observer?.disconnect(); observer = null; }
          }
        }, { threshold: 0.2 });
        observer.observe(root);
      } else {
        reveal();
      }

      // ── Count-up ──
      // Values render final in the HTML and are only then rewound to 0, so a
      // script that dies mid-flight still leaves a correct chart on screen.
      function countUp() {
        if (!animate) return;
        const nodes = Array.prototype.slice.call(
          body.querySelectorAll(`.${P}-num`)) as HTMLElement[];
        const targets = nodes.map(n => ({
          n,
          to: Number(n.getAttribute("data-count")) || 0,
          dec: Number(n.getAttribute("data-dec")) || 0,
        }));
        const t0 = performance.now();
        const dur = 780;
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - k, 3);
          for (const x of targets) {
            x.n.textContent = (x.to * eased).toLocaleString("es", {
              minimumFractionDigits: x.dec, maximumFractionDigits: x.dec,
            });
          }
          if (k < 1) rafId = requestAnimationFrame(step);
        };
        rafId = requestAnimationFrame(step);
      }

      // ── Metric switch ──
      //
      // Two different transitions, because there are two different kinds of
      // change.
      //
      // Between the three row charts (cursos / horas / racha) the *people* stay
      // and only their order and their middles change, so rows are moved rather
      // than re-rendered: each node keeps its identity, gets measured before and
      // after, is put back where it was and released (FLIP). That is what makes
      // the ranking visibly race instead of silently snapping — and it is why an
      // open drilldown travels with its person instead of closing.
      //
      // To or from the XP lines there are no rows to move, so that one
      // transition rebuilds the chart area behind a fade. Pretending otherwise
      // would mean animating nodes into nodes they have nothing to do with.
      function switchMetric(next: MetricId) {
        if (next === metric) return;
        const prev = metric;
        metric = next;

        const wrap = body.querySelector(`.${P}-area`) as HTMLElement | null;
        const list = body.querySelector(`.${P}-race`) as HTMLElement | null;
        const before = new Map<string, number>();
        const rows = list
          ? (Array.prototype.slice.call(list.children) as HTMLElement[])
          : [];
        for (const r of rows) before.set(r.getAttribute("data-key") || "", r.getBoundingClientRect().top);

        ranked = rank(learners, metric);

        // The podium is a different shape per rank, so it is rebuilt; the row
        // list is the part that animates.
        const podWrap = body.querySelector(`.${P}-podium`) as HTMLElement | null;
        if (podWrap && showPodium) {
          podWrap.outerHTML = podium(ranked.slice(0, 3), metric, showTier, opts.badges);
        }

        const capEl = body.querySelector(`.${P}-cap`) as HTMLElement | null;
        if (capEl) capEl.outerHTML = caption(metric);

        const sameShape = isRowChart(prev) && isRowChart(metric) && !!list;
        if (wrap) wrap.setAttribute("data-kind", CHART_KIND[metric]);

        if (!sameShape) {
          if (wrap) {
            wrap.innerHTML = area(metric);
            measureLines();
            // Re-arm the entry animation for the chart that just appeared: the
            // reveal class lives on the container, so it has to be taken off
            // and put back for the new children to run it.
            const c = charts();
            if (animate && c) {
              c.classList.remove(`${P}-reveal`);
              void c.offsetWidth; // force reflow, or the class never left
              c.classList.add(`${P}-reveal`);
            }
          }
        } else if (list) {
          const byKey = new Map<string, HTMLElement>();
          for (const r of rows) byKey.set(r.getAttribute("data-key") || "", r);
          const tail = showPodium ? ranked.slice(3) : ranked;
          const max = Math.max(...tail.map(l => metricValue(l, metric)), 0);
          const wanted = new Set(tail.map(l => keyOf(l)));
          list.setAttribute("data-kind", CHART_KIND[metric]);

          // Membership changes, not just order: switching metric can promote a
          // row onto the podium and drop a podium person into the list. A row
          // whose person is now on the podium has to go, and a newcomer has to
          // be built — reusing whatever happened to be there would leave a row
          // showing another person's numbers.
          for (const r of rows) {
            if (!wanted.has(r.getAttribute("data-key") || "")) r.remove();
          }

          tail.forEach((l, i) => {
            const key = keyOf(l);
            let row = byKey.get(key) || null;
            if (!row) {
              const holder = document.createElement("ol");
              holder.innerHTML = raceRow(l, i + 1, max, metric, opts);
              row = holder.firstElementChild as HTMLElement | null;
              if (!row) return;
            }
            list.appendChild(row); // reorder in place
            row.style.setProperty("--i", String(i));
            const rankEl = row.querySelector(`.${P}-rank`);
            if (rankEl) rankEl.textContent = String(i + 1);
            // The whole middle is swapped, because the *shape* may have changed
            // (a bar becomes a stack becomes a grid) and not merely its size.
            // The drilldown panel and the open state live outside this node, so
            // they survive untouched.
            const bodyEl = row.querySelector(`.${P}-row-body`) as HTMLElement | null;
            if (bodyEl) bodyEl.innerHTML = rowBody(l, metric, max, opts);
          });

          if (animate) {
            const moved = Array.prototype.slice.call(list.children) as HTMLElement[];
            for (const r of moved) {
              const key = r.getAttribute("data-key") || "";
              const from = before.get(key);
              if (from == null) continue;
              const delta = from - r.getBoundingClientRect().top;
              if (!delta) continue;
              r.setAttribute("data-flip", "1");
              r.style.transform = `translateY(${delta}px)`;
            }
            requestAnimationFrame(() => {
              for (const r of moved) {
                if (r.getAttribute("data-flip") !== "1") continue;
                r.setAttribute("data-flip", "2");
                r.style.transform = "";
              }
              window.setTimeout(() => {
                for (const r of moved) r.removeAttribute("data-flip");
              }, 480);
            });
          }
        }

        // The gap is in the units of whatever is on screen, so it is rewritten
        // with the chart rather than left saying "2 cursos" under an XP view.
        updateCta();

        // Tabs
        const tabs = Array.prototype.slice.call(
          body.querySelectorAll(`.${P}-tab`)) as HTMLElement[];
        for (const t of tabs) {
          const on = t.getAttribute("data-metric") === metric;
          t.classList.toggle(`${P}-tab-on`, on);
          t.setAttribute("aria-selected", String(on));
        }
        moveInk();
        if (rafId) cancelAnimationFrame(rafId);
        countUp();
      }

      /** Keeps the catch-up sentence true for the metric on screen. */
      function updateCta() {
        const cta = body.querySelector(`.${P}-cta`) as HTMLElement | null;
        if (!cta) return;
        const info = gapNow();
        const gapEl = cta.querySelector(`.${P}-cta-gap`) as HTMLElement | null;
        if (gapEl) gapEl.textContent = gapText(info, metric);
        const rankEl = cta.querySelector(`.${P}-cta-rank`) as HTMLElement | null;
        if (rankEl && info) rankEl.textContent = S.ctaRankOf(info.rank, info.total);
        cta.setAttribute("data-done", info && info.rank === 1 ? "1" : "0");
      }

      /** The sliding pill behind the active tab. Measured rather than computed
       *  from an index, because the tab labels are different widths. */
      function moveInk() {
        const ink = body.querySelector(`.${P}-tab-ink`) as HTMLElement | null;
        const on = body.querySelector(`.${P}-tab-on`) as HTMLElement | null;
        if (!ink || !on) return;
        ink.style.width = `${on.offsetWidth}px`;
        ink.style.transform = `translateX(${on.offsetLeft}px)`;
      }
      // Fonts can land after first paint and shift the tabs, so re-measure.
      requestAnimationFrame(moveInk);
      window.setTimeout(moveInk, 350);

      // ── Drilldown ──
      function toggleRow(row: HTMLElement) {
        const key = row.getAttribute("data-key") || "";
        const panel = row.querySelector(`.${P}-dd`) as HTMLElement | null;
        const main = row.querySelector(`.${P}-row-main`) as HTMLElement | null;
        if (!panel) return;
        const open = row.getAttribute("data-open") === "1";

        if (open) {
          panel.hidden = true;
          panel.innerHTML = "";
          row.removeAttribute("data-open");
          main?.setAttribute("aria-expanded", "false");
          return;
        }

        const learner = learners.filter(l => keyOf(l) === key)[0];
        if (!learner) return;
        panel.innerHTML = drilldown(learner);
        panel.hidden = false;
        row.setAttribute("data-open", "1");
        main?.setAttribute("aria-expanded", "true");
      }

      /** The XP chart's equivalent of a drilldown: one shared panel under the
       *  lines, because the lines cross and a per-person panel would have
       *  nowhere sensible to open. Clicking the same line again closes it. */
      function toggleLine(key: string) {
        const panel = body.querySelector(`.${P}-lines-dd`) as HTMLElement | null;
        if (!panel || !opts.drilldown) return;
        if (panel.getAttribute("data-key") === key) {
          panel.hidden = true;
          panel.innerHTML = "";
          panel.removeAttribute("data-key");
          return;
        }
        const learner = learners.filter(l => keyOf(l) === key)[0];
        if (!learner) return;
        panel.innerHTML = drilldown(learner);
        panel.hidden = false;
        panel.setAttribute("data-key", key);
      }

      /** Raise one line and push the rest back. Attribute-driven rather than
       *  CSS `:has`, which is still too new to rely on inside a host page we do
       *  not control. */
      function emphasize(grp: Element | null) {
        const wrap = body.querySelector(`.${P}-lines`) as HTMLElement | null;
        if (!wrap) return;
        const all = Array.prototype.slice.call(
          wrap.querySelectorAll(`.${P}-lngrp`)) as Element[];
        for (const g of all) g.classList.remove(`${P}-ln-on`);
        if (grp) {
          grp.classList.add(`${P}-ln-on`);
          wrap.setAttribute("data-on", "1");
        } else {
          wrap.removeAttribute("data-on");
        }
      }

      const onOver = (ev: Event) => {
        const t = ev.target as Element;
        if (!t || typeof t.closest !== "function") return;
        const grp = t.closest(`.${P}-lngrp`);
        if (grp) { emphasize(grp); return; }
        // Leaving the chart entirely is the only thing that clears it — moving
        // between two lines should hand off, not flicker through neutral.
        if (!t.closest(`.${P}-lines-svg`)) emphasize(null);
      };

      const onCatchUp = (ev: Event) => {
        const info = gapNow();
        const detail = {
          metric,
          gap: info ? info.gap : 0,
          rank: info ? info.rank : 0,
          total: info ? info.total : learners.length,
          target: info ? info.target.person.name : "",
        };
        // Dispatched whether or not a URL is configured, so a page that hosts
        // the course grid can scroll to it (or open its own filter) instead of
        // navigating away. When a URL *is* set the link's default is left
        // alone, so the event and the navigation both happen.
        host.dispatchEvent(new CustomEvent("cornerstone-learning:catchup", {
          detail, bubbles: true, composed: true,
        }));
        log("catch-up pressed —", JSON.stringify(detail));
        if (!ctaUrl) {
          const btn = (ev.target as HTMLElement).closest(`.${P}-cta-btn`) as HTMLElement | null;
          btn?.setAttribute("data-pulse", "1");
          window.setTimeout(() => btn?.removeAttribute("data-pulse"), 600);
        }
      };

      const onClick = (ev: Event) => {
        const target = ev.target as HTMLElement;
        if (!target || typeof target.closest !== "function") return;
        const tab = target.closest(`.${P}-tab`) as HTMLElement | null;
        if (tab) {
          const m = tab.getAttribute("data-metric") || "";
          if (validMetric(m)) switchMetric(m);
          return;
        }
        if (target.closest(`[data-cta="1"]`)) { onCatchUp(ev); return; }
        const grp = target.closest(`.${P}-lngrp`);
        if (grp) { toggleLine(grp.getAttribute("data-key") || ""); return; }
        // Avatar and name are real profile links; opening the drilldown instead
        // would break the hovercard affordance Staffbase users expect.
        if (target.closest(`.${P}-avlink`) || target.closest("a[data-uid]")) return;
        if (!opts.drilldown) return;
        const main = target.closest(`.${P}-row-main`) as HTMLElement | null;
        if (!main) return;
        const row = main.closest(`.${P}-row`) as HTMLElement | null;
        if (row) toggleRow(row);
      };

      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const target = ev.target as HTMLElement;
        if (!target || typeof target.closest !== "function") return;
        const grp = target.closest(`.${P}-lngrp`);
        if (grp) {
          ev.preventDefault();
          toggleLine(grp.getAttribute("data-key") || "");
          return;
        }
        const main = target.closest(`.${P}-row-main[role="button"]`) as HTMLElement | null;
        if (!main) return;
        ev.preventDefault();
        const row = main.closest(`.${P}-row`) as HTMLElement | null;
        if (row) toggleRow(row);
      };

      // Keyboard focus moves the emphasis too, so tabbing through the lines
      // tells the same story as hovering them.
      const onFocusIn = (ev: Event) => {
        const t = ev.target as Element;
        if (!t || typeof t.closest !== "function") return;
        emphasize(t.closest(`.${P}-lngrp`));
      };

      body.addEventListener("click", onClick);
      body.addEventListener("keydown", onKey);
      body.addEventListener("mouseover", onOver);
      body.addEventListener("focusin", onFocusIn);
      window.addEventListener("resize", moveInk);

      (this as any)._cslCleanup = () => {
        body.removeEventListener("click", onClick);
        body.removeEventListener("keydown", onKey);
        body.removeEventListener("mouseover", onOver);
        body.removeEventListener("focusin", onFocusIn);
        window.removeEventListener("resize", moveInk);
        if (rafId) cancelAnimationFrame(rafId);
        observer?.disconnect();
      };
    }

    disconnectedCallback() {
      const self: any = this;
      if (self._cslCleanup) { try { self._cslCleanup(); } catch (_) { /* ignore */ } }
      self._cslCleanup = undefined;
    }

    static get observedAttributes() {
      return ATTRS;
    }
  };
};

const ATTRS = [
  "apitoken", "baseurl", "authmode", "topuserids", "podiumdraw", "drawseed",
  "showviewer", "fillercount", "defaultmetric",
  "showmetricswitcher", "showpodium", "showtierbar", "showbadges", "showstreak",
  "showdrilldown", "showcta", "ctalabel", "ctaurl",
  "colorscheme", "multibranding", "brandfallback", "brandpreview",
  "usethemecolors", "primarycolor", "accentcolor", "animate", "showdemonote", "debugmode",
].concat((() => {
  const out: string[] = [];
  for (let i = 1; i <= MAX_BRANDS; i++) {
    out.push(`brand${i}group`, `brand${i}primary`, `brand${i}accent`, `brand${i}label`);
  }
  return out;
})());

// ── Block registration ───────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name: "cornerstone-learning",
  label: "Cornerstone Learning Leaderboard",
  attributes: ATTRS,
  factory,
  configurationSchema,
  uiSchema,
  blockLevel: "block",
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48cmVjdCB3aWR0aD0iMTcxIiBoZWlnaHQ9IjE3MSIgcng9IjM4IiBmaWxsPSIjMEIwRDEyIi8+PHJlY3QgeD0iMjgiIHk9IjEwMCIgd2lkdGg9IjExNSIgaGVpZ2h0PSIxNCIgcng9IjciIGZpbGw9IiM3QzVDRkYiLz48cmVjdCB4PSIyOCIgeT0iMTIyIiB3aWR0aD0iNzgiIGhlaWdodD0iMTQiIHJ4PSI3IiBmaWxsPSIjN0M1Q0ZGIiBvcGFjaXR5PSIuNiIvPjxyZWN0IHg9IjI4IiB5PSI3OCIgd2lkdGg9IjUyIiBoZWlnaHQ9IjE0IiByeD0iNyIgZmlsbD0iIzNEREM5NyIgb3BhY2l0eT0iLjgiLz48Y2lyY2xlIGN4PSI4NSIgY3k9IjQ4IiByPSIyMCIgZmlsbD0iIzNEREM5NyIvPjwvc3ZnPg==",
};

window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" } as ExternalBlockDefinition);
