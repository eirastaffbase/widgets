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
import { FILLER_POOL, buildField, metricValue, rank, syntheticPeople } from "./demo";
import {
  P, drilldown, esc, footnote, header, keyOf, race, raceRow, podium, formatMetric, metricUnit,
} from "./charts";
import { S } from "./strings";
import { BrandMatch, Learner, MetricId, OptsFactory, Person } from "./types";

// ── Defaults ─────────────────────────────────────────────────────────────────

// Ships empty on purpose: the token is a runtime editor value, never a
// committed secret.
const DEFAULT_API_TOKEN = "";
const DEFAULT_BASE_URL = "";
const DEFAULT_PRIMARY = "#7C5CFF";
const DEFAULT_ACCENT = "#3DDC97";

const MAX_FEATURED = 3;

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
    topuserids: { type: "string", title: "Top 3 User IDs (comma-separated, ranked)", default: "" },
    fillercount: { type: "number", title: "Demo Peers Below the Top 3", default: 5 },
    defaultmetric: { type: "string", title: "Starting Metric", enum: ["courses", "hours", "xp", "streak"], default: "courses" },
    showmetricswitcher: { type: "boolean", title: "Let Viewers Switch Metric", default: true },
    showpodium: { type: "boolean", title: "Show Podium", default: true },
    showtierbar: { type: "boolean", title: "Show Level Progress", default: true },
    showbadges: { type: "boolean", title: "Show Badges", default: true },
    showstreak: { type: "boolean", title: "Show Streaks", default: true },
    showdrilldown: { type: "boolean", title: "Let Viewers Open Completed Courses", default: true },
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
  topuserids: { "ui:help": "Up to three Staffbase user IDs. The order you type them is the order they are ranked." },
  fillercount: { "ui:help": "Generated demo colleagues that fill the ranking below the three real users." },
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
.${P}-root[data-anim="1"] .${P}-cc{
  opacity:0;animation:${P}-in .34s var(--ease) forwards;
  animation-delay:calc(var(--i,0) * 40ms)}
@keyframes ${P}-in{to{opacity:1;transform:none}}
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

      if (bool("multibranding", false)) {
        const brands = readBrands(attr);
        const fallbackKind = attr("brandfallback") || "theme";
        const fallback: BrandMatch = fallbackKind === "manual" ? manual : match;
        const viewer = await readViewer(widgetApi, log);
        const groupNames = await loadGroupNames(http, baseUrl, tokenFirst, brands, log);
        match = resolveBrand({
          brands, viewer, groupNames,
          preview: Math.max(0, Math.floor(num("brandpreview", 0))),
          fallback, surface: scheme, log,
        });
      }
      applyBrand(root, match);

      // ── People ──
      const ids = attr("topuserids").split(",").map(s => s.trim()).filter(Boolean).slice(0, MAX_FEATURED);
      const featured: Person[] = [];

      if (baseUrl && ids.length && (apiToken || authMode !== "token")) {
        const found = await Promise.all(ids.map(id => fetchUserById(http, baseUrl, id, tokenFirst)));
        for (let i = 0; i < found.length; i++) {
          const p = found[i];
          if (!p) { log(`user ${ids[i]} could not be resolved — using a demo peer`); continue; }
          // Podium portraits are 92px; /users gives a 48px icon, so the public
          // profile is worth one extra request for these three only.
          const prof = await fetchPublicProfile(http, baseUrl, p.id, sessionFirst);
          if (prof?.avatar) p.avatar = prof.avatar;
          if (!p.position && prof?.position) p.position = prof.position;
          if (!p.department && prof?.department) p.department = prof.department;
          p.avatar = hiResAvatar(p.avatar, 200);
          featured.push(p);
        }
      } else if (ids.length) {
        log("no base URL or token — falling back to demo people");
      }

      // Any unresolved slot becomes a demo peer, so the podium is never short.
      // These take names from the front of the pool and `buildField` fills from
      // `featured.length` onward, so no two rows can show the same name.
      if (featured.length < Math.max(1, ids.length || MAX_FEATURED)) {
        const want = Math.max(1, ids.length || MAX_FEATURED) - featured.length;
        for (const p of syntheticPeople(want, 0)) featured.push(p);
      }

      // Capped so the peer names never wrap the pool and start repeating.
      const fillerCount = Math.max(0, Math.min(
        FILLER_POOL - featured.length, Math.round(num("fillercount", 5))));
      const learners = buildField(featured, fillerCount);
      log("field", learners.length, "learners;", featured.filter(p => !p.synthetic).length, "real");

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

      let ranked = rank(learners, metric);

      const paint = () => {
        body.innerHTML = `
          ${header(match.label, metric, showSwitcher)}
          <div class="${P}-charts">
            ${showPodium ? podium(ranked.slice(0, 3), metric, showTier, opts.badges) : ""}
            ${race(showPodium ? ranked.slice(3) : ranked, metric, opts)}
          </div>
          ${bool("showdemonote", true) ? footnote() : ""}
          ${debug ? `<pre class="${P}-dbg">${esc(logs.join("\n"))}</pre>` : ""}`;
      };
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

      // ── Metric switch, with FLIP ──
      //
      // Rows are *moved*, not re-rendered: the DOM node for a person keeps its
      // identity so it can be measured before and after, then transformed back
      // to where it was and released. Re-rendering the list would make the
      // ranking change instantly and invisibly — the reorder is the whole point
      // of an interactive bar race.
      function switchMetric(next: MetricId) {
        if (next === metric) return;
        metric = next;
        const list = body.querySelector(`.${P}-race`) as HTMLElement | null;
        const before = new Map<string, number>();
        const rows = list
          ? (Array.prototype.slice.call(list.children) as HTMLElement[])
          : [];
        for (const r of rows) before.set(r.getAttribute("data-key") || "", r.getBoundingClientRect().top);

        ranked = rank(learners, metric);

        // The podium is a different shape per rank, so it is rebuilt; the race
        // list is the part that animates.
        const podWrap = body.querySelector(`.${P}-podium`) as HTMLElement | null;
        if (podWrap && showPodium) {
          podWrap.outerHTML = podium(ranked.slice(0, 3), metric, showTier, opts.badges);
        }

        const tail = showPodium ? ranked.slice(3) : ranked;
        if (list) {
          const byKey = new Map<string, HTMLElement>();
          for (const r of rows) byKey.set(r.getAttribute("data-key") || "", r);
          const max = Math.max(...tail.map(l => metricValue(l, metric)), 0);
          const wanted = new Set(tail.map(l => keyOf(l)));

          // Membership changes, not just order: switching metric can promote a
          // race row onto the podium and drop a podium person into the list. A
          // row whose person is now on the podium has to go, and a newcomer has
          // to be built — reusing whatever happened to be there would leave a
          // row showing another person's numbers.
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
            const fill = row.querySelector(`.${P}-bar-fill`) as HTMLElement | null;
            const v = metricValue(l, metric);
            if (fill) fill.style.setProperty("--w", `${Math.max(6, max > 0 ? (v / max) * 100 : 0).toFixed(2)}%`);
            const numEl = row.querySelector(`.${P}-num`) as HTMLElement | null;
            if (numEl) {
              numEl.setAttribute("data-count", String(v));
              numEl.setAttribute("data-dec", metric === "hours" ? "1" : "0");
              numEl.textContent = formatMetric(l, metric);
            }
            const unitEl = row.querySelector(`.${P}-unit`);
            if (unitEl) unitEl.textContent = metricUnit(l, metric);
            // An open drilldown belongs to a person, not a rank, so it stays
            // open and simply travels with them.
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

      const onClick = (ev: Event) => {
        const target = ev.target as HTMLElement;
        const tab = target.closest(`.${P}-tab`) as HTMLElement | null;
        if (tab) {
          const m = tab.getAttribute("data-metric") || "";
          if (validMetric(m)) switchMetric(m);
          return;
        }
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
        const main = target.closest(`.${P}-row-main[role="button"]`) as HTMLElement | null;
        if (!main) return;
        ev.preventDefault();
        const row = main.closest(`.${P}-row`) as HTMLElement | null;
        if (row) toggleRow(row);
      };

      body.addEventListener("click", onClick);
      body.addEventListener("keydown", onKey);
      window.addEventListener("resize", moveInk);

      (this as any)._cslCleanup = () => {
        body.removeEventListener("click", onClick);
        body.removeEventListener("keydown", onKey);
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
  "apitoken", "baseurl", "authmode", "topuserids", "fillercount", "defaultmetric",
  "showmetricswitcher", "showpodium", "showtierbar", "showbadges", "showstreak",
  "showdrilldown", "colorscheme", "multibranding", "brandfallback", "brandpreview",
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
