// ─────────────────────────────────────────────────────────────────────────────
// Engagement Leaderboard — a broadcast-style deck of engagement metrics
// computed live from branch data.
//
// The Staffbase API exposes no per-user engagement endpoint (the analytics
// `groupBy` enum accepts only `channelId`/`spaceId`, and
// `/branch/analytics/users/rankings` is feature-flag gated), so every
// person-level metric here is derived client-side from one pass over posts,
// reactions and comments. See `api.ts` for the auth ladder and `aggregate.ts`
// for the derivation.
//
// Presentation: the widget renders a dark "stage" lit with the tenant's own
// brand color, showing one champion at a time. A leaderboard is an awards
// broadcast, not a spreadsheet — so the deck rotates like title cards, and the
// motion is one rehearsed reveal rather than scattered effects.
// ─────────────────────────────────────────────────────────────────────────────

import {
  BlockFactory, BlockDefinition, ExternalBlockDefinition, BaseBlock,
} from "@staffbase/widget-sdk";
import { JSONSchema7 } from "json-schema";

import { detectLocale, isRtl, makeT } from "../tasks/shared/i18n";
import { fetchThemeColors } from "../tasks/shared/theming";
import { AVAILABLE_LOCALES, BUNDLES } from "./strings";
import { Http, fetchPostRankings, fetchPublicProfile, hiResAvatar, loadRawData, makeApiOpts, sessionOpts } from "./api";
import {
  DEFAULT_WEIGHTS, WindowKey, activityScore, aggregate, buildTiles, resolveWindow,
} from "./aggregate";
import { MetricId, Person, PostRanking, RawData, Tile } from "./types";
import { P, avatar, bubbleMap, champion, esc, field, flourish, fmt, initials } from "./charts";
import { METRIC_ICON, icon } from "./icons";

// ── Defaults ─────────────────────────────────────────────────────────────────

// Ships empty on purpose: the token is a runtime editor value, never a
// committed secret.
const DEFAULT_API_TOKEN = "";
const DEFAULT_BASE_URL = "";
const DEFAULT_PRIMARY_COLOR = "#3DDC97";
const DEFAULT_ACCENT_COLOR = "#7C5CFF";

/** Metric id ⇄ config attribute. Individual booleans rather than a multi-select
 *  array: the editor renders them as plain checkboxes, and an attribute string
 *  cannot silently arrive in a shape the widget has to guess at. */
const METRIC_ATTRS: Array<{ id: MetricId; attr: string; label: string }> = [
  { id: "most_active", attr: "showmostactive", label: "Most Active" },
  { id: "most_engaged", attr: "showmostengaged", label: "Most Engaged" },
  { id: "top_commenter", attr: "showtopcommenter", label: "Top Commenter" },
  { id: "top_reactor", attr: "showtopreactor", label: "Top Reactor" },
  { id: "most_appreciated", attr: "showmostappreciated", label: "Most Appreciated" },
  { id: "top_contributor", attr: "showtopcontributor", label: "Top Contributor" },
  { id: "rising_star", attr: "showrisingstar", label: "Rising Star" },
  { id: "advocacy", attr: "showadvocacy", label: "Social Advocacy" },
];

const CACHE_PREFIX = "sbel:v2:";

// ── Config schema ────────────────────────────────────────────────────────────

const metricProps: { [k: string]: JSONSchema7 } = {};
for (const m of METRIC_ATTRS) {
  metricProps[m.attr] = { type: "boolean", title: `Show “${m.label}”`, default: true };
}

const configurationSchema: JSONSchema7 = {
  properties: {
    apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
    baseurl: { type: "string", title: "Base URL (e.g. https://acme.staffbase.com/api)", default: DEFAULT_BASE_URL },
    authmode: { type: "string", title: "Authentication", enum: ["auto", "token", "session"], default: "auto" },
    displaymode: { type: "string", title: "Layout", enum: ["slideshow", "grid"], default: "slideshow" },
    colorscheme: { type: "string", title: "Color Scheme", enum: ["dark", "light", "auto"], default: "dark" },
    timewindow: {
      type: "string", title: "Time Period",
      enum: ["all", "7d", "30d", "90d", "12m", "custom"], default: "90d",
    },
    autowiden: { type: "boolean", title: "Fall Back to All Time When a Period Is Empty", default: true },
    showwindowpicker: { type: "boolean", title: "Let Viewers Change the Period", default: true },
    ...metricProps,
    topn: { type: "number", title: "People Per Metric", default: 5 },
    channels: { type: "string", title: "Limit to Channel IDs (comma-separated)", default: "" },
    excludeuserids: { type: "string", title: "Exclude User IDs (comma-separated)", default: "" },
    maxposts: { type: "number", title: "Max Posts to Scan", default: 200 },
    cachettl: { type: "number", title: "Cache Lifetime (minutes)", default: 15 },
    showbubblemap: { type: "boolean", title: "Show Engagement Map", default: false },
    animate: { type: "boolean", title: "Animate", default: true },
    usethemecolors: { type: "boolean", title: "Use Theme Colors", default: true },
    showsample: { type: "boolean", title: "Show Sample Data When Unconfigured", default: true },
    debugmode: { type: "boolean", title: "Debug Mode (on-screen logs)", default: false },
  },
  dependencies: {
    usethemecolors: {
      oneOf: [
        {
          properties: {
            usethemecolors: { const: false },
            primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY_COLOR },
            accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT_COLOR },
          },
        },
        { properties: { usethemecolors: { const: true } } },
      ],
    },
    // Auto-advance only exists in the rotating layout.
    displaymode: {
      oneOf: [
        { properties: { displaymode: { const: "grid" } } },
        {
          properties: {
            displaymode: { const: "slideshow" },
            autoplay: { type: "boolean", title: "Advance Automatically", default: true },
            autoplayseconds: { type: "number", title: "Seconds Per Metric", default: 8 },
          },
        },
      ],
    },
    // Custom ranges are the only case that needs explicit dates.
    timewindow: {
      oneOf: [
        { properties: { timewindow: { enum: ["all", "7d", "30d", "90d", "12m"] } } },
        {
          properties: {
            timewindow: { const: "custom" },
            customsince: { type: "string", title: "From (YYYY-MM-DD)", default: "" },
            customuntil: { type: "string", title: "To (YYYY-MM-DD)", default: "" },
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
  authmode: { "ui:help": "Auto uses the API token first and upgrades to the signed-in session where that unlocks richer data." },
  displaymode: { "ui:help": "Slideshow rotates one metric at a time. Grid shows them all at once." },
  colorscheme: { "ui:help": "Auto follows the viewer's device setting." },
  maxposts: { "ui:help": "Each post costs one extra request for its reaction list. Lower this on large branches." },
  usethemecolors: { "ui:help": "Pulls your brand colors from the branding theme." },
};

// ── Color helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}

/** Black or white, whichever reads on the given fill. */
function readableOn(hex: string): string {
  const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const l = 0.2126 * lin(parseInt(h.slice(0, 2), 16) / 255)
    + 0.7152 * lin(parseInt(h.slice(2, 4), 16) / 255)
    + 0.0722 * lin(parseInt(h.slice(4, 6), 16) / 255);
  return l > 0.45 ? "#0B0D12" : "#FFFFFF";
}

// ── Sample data ──────────────────────────────────────────────────────────────

/** So the editor and preview always render something. Clearly badged. */
function sampleRaw(): RawData {
  const names = [
    "Nicole Adams", "Davide Bonchamp", "Fred Duchamp", "Henry Fitz",
    "Frank Fox", "Maria Apathangelou", "Kay Lion", "Edward Hall",
  ];
  const people = names.map((n, i) => ({
    id: `u${i}`, name: n, avatar: "",
    position: ["Field Engineer", "Brand Designer", "Data Analyst", "Regional Manager"][i % 4],
    department: ["Product", "Operations", "Retail"][i % 3],
    location: "", pronouns: "", headline: "",
  }));
  const now = Date.now();
  const events: RawData["events"] = [];
  const posts: RawData["posts"] = [];
  for (let p = 0; p < 12; p++) {
    const author = people[p % people.length];
    const at = new Date(now - p * 3 * 86400000).toISOString();
    posts.push({ id: `p${p}`, authorId: author.id, channelId: `c${p % 3}`, created: at, published: at, title: `Sample post ${p + 1}`, likingEnabled: true });
    events.push({ kind: "post", userId: author.id, postId: `p${p}`, channelId: `c${p % 3}`, at });
    for (let u = 0; u < people.length; u++) {
      if ((u * 7 + p * 3) % 5 === 0) continue;
      const t = new Date(now - (p * 3 + (u % 4)) * 86400000).toISOString();
      events.push({ kind: "reaction", userId: people[u].id, postId: `p${p}`, channelId: `c${p % 3}`, at: t });
      if ((u + p) % 4 === 0) events.push({ kind: "comment", userId: people[u].id, postId: `p${p}`, channelId: `c${p % 3}`, at: t });
    }
  }
  const rankings: PostRanking[] = posts.slice(0, 5).map((p, i) => ({
    postId: p.id, channelId: p.channelId, title: p.title,
    shares: 29 - i * 6, clicks: 18 - i * 4, comments: 4, likes: 12, visitors: 40 - i * 5,
  }));
  return { events, posts, people, rankings, skippedPosts: 0, skipped: [], typedReactions: false, fetchedAt: now };
}

// ── Styles ───────────────────────────────────────────────────────────────────

/**
 * Staffbase ships global element rules that reach inside widgets. The ones that
 * actually bite: `button { width: 90%; margin: auto }`, a blue/red button
 * background on `:hover/:focus/:active`, `button { color:#fff }`, and list and
 * heading margins. Their selectors are low-specificity but not `!important`, so
 * a prefixed descendant selector plus `!important` on exactly those properties
 * wins without turning the whole stylesheet into an override pile.
 */
/* Staffbase ships page-level rules that reach into widget markup. They are not
   !important, but `button:hover` outranks a single-class widget rule, so the
   reset has to be split in two:

   1. Base defaults — everything, stated once on `.<p>-root button`. Kept at low
      specificity (one class + one element) precisely so the widget's own
      component rules can override them normally.
   2. Per-state neutralisation — ONLY the three properties Staffbase actually
      re-declares on :hover/:focus/:active (background, color, box-shadow) plus
      the focus outline.

   Geometry deliberately does NOT appear in (2). Staffbase sets `width:90%` and
   `margin:auto` on the base button rule only, so neutralising them once in (1)
   is enough — whereas repeating them per state raises the specificity above the
   widget's own component rules, which collapsed the round nav buttons into tall
   rounded slivers the moment they were hovered or pressed. */
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
.${P}-root select{font-family:inherit!important;width:auto!important;margin:0!important;
  -webkit-appearance:none;appearance:none}
.${P}-root a,.${P}-root a:hover,.${P}-root a:focus,.${P}-root a:active{
  color:inherit!important;text-decoration:none!important;background:none!important}
.${P}-root ol,.${P}-root ul{list-style:none!important;margin:0!important;padding:0!important}
.${P}-root li{margin:0!important;padding:0!important;list-style:none!important}
.${P}-root h1,.${P}-root h2,.${P}-root h3,.${P}-root h4,.${P}-root h5,.${P}-root h6,
.${P}-root p,.${P}-root figure{
  margin:0!important;padding:0!important;font-family:inherit!important}
/* Staffbase's rich-text styling reaches in with a rule roughly six classes deep:
   .css-<hash>-StyledRichText-getWowRichTextCss p:not(...):not(...)...
   Out-specifying that is not practical, but it carries no !important, so pinning
   the properties it sets wins outright. It is scoped to a bare p element, so
   that is the entire blast radius — without it every paragraph in the widget
   is forced to 16px/26px in #171719, invisible on the dark stage. */
.${P}-root p{
  color:inherit!important;font-size:inherit!important;font-weight:inherit!important;
  font-style:normal!important;line-height:inherit!important}
.${P}-root img{max-width:none!important;margin:0!important;border-radius:0}
.${P}-root svg{display:block;overflow:visible}
.${P}-root *,.${P}-root *::before,.${P}-root *::after{box-sizing:border-box}
`;

const CSS = `
${HOST_RESET}

/* Every surface value is a token, and --tint is the one that makes two schemes
   possible from a single stylesheet: it is the colour laid over the background
   at low alpha to make panels, tracks and hairlines. On the dark stage that is
   white; on the light stage it is near-black. Everything that used a literal
   rgba(255,255,255,x) now reads rgba(var(--tint),x) and simply inverts. */
.${P}-root{
  --tint:255,255,255;
  --bg:#0B0D12;
  --bg-2:#12161F;
  --panel:rgba(var(--tint),.045);
  --line:rgba(var(--tint),.10);
  --ink:#F2F5FA;
  --ink-2:#9AA6BD;
  --opt-bg:#141821;
  --warn:#FFD9A0;
  --wash-1:.30;
  --wash-2:.26;
  --glow-a:.24;
  --grain-a:.5;
  --grain-c:.055;
  --num-glow:.45;
  --drop:0 24px 60px -24px rgba(0,0,0,.7);
  --inset:0 2px 0 0 rgba(255,255,255,.05) inset;
  --hero-shadow:0 22px 45px -18px rgba(0,0,0,.9);
  --p-rgb:var(--sbel-primary-rgb);
  --r:20px;--r-sm:12px;
  font-family:inherit;
  color:var(--ink);
  position:relative;
  border-radius:var(--r);
  background:
    radial-gradient(120% 90% at 88% -10%,rgba(var(--sbel-accent-rgb),var(--wash-1)),transparent 62%),
    radial-gradient(95% 80% at 6% 4%,rgba(var(--p-rgb),var(--wash-2)),transparent 60%),
    linear-gradient(180deg,var(--bg-2) 0%,var(--bg) 58%);
  box-shadow:var(--drop),var(--inset);
  overflow:hidden;
  isolation:isolate;
  -webkit-font-smoothing:antialiased;
}

/* Light scheme. Deliberately not a straight inversion: the brand washes and the
   ambient glow are pulled right back, because the same intensity that reads as
   atmosphere on black reads as a stain on white. */
.${P}-root.${P}-light{
  --tint:16,22,34;
  --bg:#FFFFFF;
  --bg-2:#F6F8FC;
  --panel:rgba(var(--tint),.035);
  --line:rgba(var(--tint),.13);
  --ink:#0E1420;
  --ink-2:#5B6880;
  --opt-bg:#FFFFFF;
  --shade:16,22,34;
  --warn:#8A5300;
  --wash-1:.13;
  --wash-2:.11;
  --glow-a:.13;
  --grain-a:.35;
  --grain-c:.05;
  --num-glow:0;
  --drop:0 18px 44px -22px rgba(16,22,34,.30);
  --inset:0 0 0 1px rgba(var(--tint),.09) inset;
  --hero-shadow:0 18px 38px -18px rgba(16,22,34,.45);
}

/* Ambient stage light. Purely atmospheric, so it stops whenever the widget is
   offscreen or the tab is hidden rather than burning a phone battery. */
.${P}-glow{
  position:absolute;inset:-30% -10% auto -10%;height:78%;z-index:0;pointer-events:none;
  background:radial-gradient(50% 50% at 50% 50%,rgba(var(--p-rgb),var(--glow-a)),transparent 70%);
  filter:blur(28px);opacity:.9}
.${P}-live .${P}-glow{animation:${P}-drift 19s ease-in-out infinite alternate}
@keyframes ${P}-drift{
  from{transform:translate3d(-7%,0,0) scale(1)}
  to{transform:translate3d(9%,4%,0) scale(1.16)}}

.${P}-grain{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:var(--grain-a);
  background-image:radial-gradient(rgba(var(--tint),var(--grain-c)) 1px,transparent 1px);
  background-size:3px 3px;mix-blend-mode:overlay}

.${P}-inner{position:relative;z-index:1;padding:26px 28px 22px}

/* ── Header ─────────────────────────────────────────────────────────────── */
.${P}-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:20px}
.${P}-eyebrow{display:flex;align-items:center;gap:9px;flex:1 1 auto;min-width:0}
.${P}-mark{width:9px;height:26px;border-radius:99px;flex:0 0 auto;
  background:linear-gradient(180deg,var(--sbel-primary),var(--sbel-accent));
  box-shadow:0 0 18px rgba(var(--p-rgb),.65)}
.${P}-h{font-size:16px;font-weight:650;letter-spacing:-.012em;color:var(--ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.${P}-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;
  border-radius:99px;border:1px solid var(--line);background:var(--panel);
  color:var(--ink-2);font-size:11.5px;font-weight:600;letter-spacing:.01em;white-space:nowrap}
.${P}-root .${P}-ctl{width:30px!important;height:30px;border-radius:99px;
  border:1px solid var(--line)!important;background:var(--panel)!important;color:var(--ink-2)!important;
  transition:color .18s,border-color .18s,background .18s,transform .18s}
.${P}-root .${P}-ctl:hover{color:var(--ink)!important;border-color:rgba(var(--p-rgb),.65)!important;
  background:rgba(var(--p-rgb),.14)!important}
.${P}-root .${P}-ctl:active{transform:scale(.93)}
.${P}-root .${P}-ctl:focus-visible{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--sbel-primary)!important}
.${P}-root select.${P}-sel{height:30px;padding:0 26px 0 11px;border-radius:99px;
  border:1px solid var(--line);background:var(--panel);color:var(--ink-2);
  font-size:11.5px;font-weight:600;cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);
  background-position:calc(100% - 13px) 13px,calc(100% - 9px) 13px;
  background-size:4px 4px,4px 4px;background-repeat:no-repeat}
.${P}-root select.${P}-sel:hover{color:var(--ink);border-color:rgba(var(--p-rgb),.6)}
.${P}-root select.${P}-sel option{background:var(--opt-bg);color:var(--ink)}

.${P}-root .${P}-range{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
.${P}-root .${P}-range label{display:inline-flex;align-items:center;gap:6px;
  font-size:11px;font-weight:600;color:var(--ink-2);letter-spacing:.02em}
.${P}-root .${P}-range input[type="date"]{
  font-family:inherit!important;font-size:12px;height:30px;padding:0 9px!important;
  width:auto!important;margin:0!important;border-radius:99px;
  border:1px solid var(--line)!important;background:var(--panel)!important;
  color:var(--ink)!important;-webkit-appearance:none;appearance:none;
  color-scheme:dark;cursor:pointer}
.${P}-root.${P}-light .${P}-range input[type="date"]{color-scheme:light}
.${P}-root .${P}-range input[type="date"]:hover{border-color:rgba(var(--p-rgb),.6)!important}
.${P}-root .${P}-range input[type="date"]:focus-visible{
  outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--sbel-primary)!important}
.${P}-range[hidden]{display:none}

/* ── Chapter rail ───────────────────────────────────────────────────────── */
/* The rail scrolls when the metrics outrun the width. The mask ends are driven
   from JS rather than hard-coded, so a rail that fits is never clipped and one
   that overflows always says so at the edge it can still scroll toward. */
.${P}-rail{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 0 18px;
  padding-bottom:2px;scroll-snap-type:x proximity;--f0:0px;--f1:0px;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 var(--f0),
    #000 calc(100% - var(--f1)),transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 var(--f0),
    #000 calc(100% - var(--f1)),transparent 100%)}
.${P}-rail::-webkit-scrollbar{display:none}
.${P}-root .${P}-tab{flex:0 0 auto;gap:7px;height:32px;padding:0 13px!important;border-radius:99px;
  border:1px solid transparent!important;background:var(--panel)!important;color:var(--ink-2)!important;
  font-size:12px!important;font-weight:600;letter-spacing:-.005em;white-space:nowrap;
  scroll-snap-align:start;transition:color .2s,background .2s,border-color .2s}
.${P}-root .${P}-tab:hover{color:var(--ink)!important;background:rgba(var(--tint),.09)!important}
.${P}-root .${P}-tab[aria-selected="true"]{
  background:rgba(var(--p-rgb),.16)!important;color:var(--ink)!important;
  border-color:rgba(var(--p-rgb),.55)!important;box-shadow:0 0 20px -6px rgba(var(--p-rgb),.8)!important}
.${P}-tab svg{opacity:.8}
.${P}-tab[aria-selected="true"] svg{opacity:1;color:var(--sbel-primary)}
.${P}-root .${P}-tab:focus-visible{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--sbel-primary)!important}

/* ── Deck ───────────────────────────────────────────────────────────────── */
/* Slides stack in one grid cell so a slide can cross-fade over its predecessor.
   Stacking alone would make the deck as tall as its *tallest* slide, which left
   a lot of dead space under the short ones — so the height is driven to the
   active slide in JS and eased, giving neither a jump nor a void. */
/* clip + clip-margin lets the champion's glow and the reveal's blur spill a
   little past the box that is being height-animated; overflow:hidden is the
   fallback where clip-margin is unsupported. */
.${P}-deck{display:grid;position:relative;overflow:hidden;overflow:clip;
  overflow-clip-margin:28px;transition:height .42s cubic-bezier(.22,1,.36,1)}
.${P}-deck>*{grid-area:1/1;align-self:start}
.${P}-slide{opacity:0;visibility:hidden;pointer-events:none}
.${P}-slide.is-on{opacity:1;visibility:visible;pointer-events:auto}

.${P}-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.${P}-grid .${P}-slide{opacity:1;visibility:visible;pointer-events:auto;
  border:1px solid var(--line);border-radius:var(--r-sm);background:var(--panel);padding:18px}
.${P}-grid{position:static;overflow:visible;height:auto!important;transition:none}
.${P}-grid>*{grid-area:auto;align-self:stretch}

/* ── Slide anatomy ──────────────────────────────────────────────────────── */
.${P}-shead{display:flex;align-items:center;gap:9px;margin-bottom:4px}
.${P}-shead-ic{display:inline-flex;width:26px;height:26px;border-radius:8px;align-items:center;
  justify-content:center;color:var(--sbel-primary);background:rgba(var(--p-rgb),.14);
  border:1px solid rgba(var(--p-rgb),.3);flex:0 0 auto}
.${P}-stitle{font-size:19px;font-weight:700;letter-spacing:-.022em;color:var(--ink)}
/* <p> and <ul> both get margin:0!important from the host reset above, so every
   spacing rule on a caption or legend must out-specify it or it is a no-op. */
.${P}-root .${P}-ssub{letter-spacing:-.003em;
  font-size:12.5px!important;color:var(--ink-2)!important;line-height:1.45!important;
  margin:0 0 22px!important;padding-bottom:2px!important}

.${P}-body{display:grid;gap:26px;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);align-items:start}
.${P}-grid .${P}-body{grid-template-columns:1fr;gap:16px}

/* Champion */
.${P}-champ{display:grid;grid-template-columns:auto 1fr;gap:14px 16px;align-items:center}
/* width:max-content keeps the crown pinned to the avatar's own edge — without it
   the wrapper stretches to the grid column and the crown drifts off to the far
   right once the champion stacks on narrow screens. */
.${P}-champ-av{position:relative;grid-row:span 2;width:max-content;justify-self:start}
.${P}-champ-txt{align-self:end}
.${P}-champ-nm{display:block;font-size:20px;font-weight:700;letter-spacing:-.022em;
  color:var(--ink)!important;line-height:1.15}
a.${P}-champ-nm:hover{text-decoration:underline!important;text-underline-offset:3px}
.${P}-champ-meta,.${P}-champ-sub{display:block;font-size:12.5px;color:var(--ink-2);margin-top:3px;
  overflow:hidden;text-overflow:ellipsis}
.${P}-champ-sub{color:var(--sbel-primary);font-weight:600}
.${P}-champ-num{grid-column:2;align-self:start;display:flex;align-items:baseline;gap:8px}
.${P}-num{font-size:clamp(44px,7vw,72px);font-weight:800;line-height:.9;letter-spacing:-.055em;
  color:var(--ink);font-variant-numeric:tabular-nums;
  text-shadow:0 0 40px rgba(var(--p-rgb),var(--num-glow))}
.${P}-unit{font-size:12px;font-weight:600;color:var(--ink-2);letter-spacing:.02em}
.${P}-grid .${P}-num{font-size:38px}
.${P}-grid .${P}-champ-nm{font-size:16px}

.${P}-crown{position:absolute;right:-2px;bottom:-2px;width:30px;height:30px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  /* Solid primary, not the primary->accent gradient: the glyph colour is
     computed for contrast against primary alone, and on the gradient's accent
     end that pairing stopped holding up. */
  background:var(--sbel-primary);
  color:var(--sbel-primary-text);border:2.5px solid var(--bg);
  box-shadow:0 6px 16px -4px rgba(var(--p-rgb),.9)}
.${P}-grid .${P}-crown{width:24px;height:24px}

/* Avatars */
.${P}-av{position:relative;display:inline-flex;align-items:center;justify-content:center;
  width:var(--av);height:var(--av);border-radius:50%;overflow:hidden;flex:0 0 auto;
  background:rgba(var(--tint),.07);color:var(--sbel-primary-text);font-weight:700;
  font-size:calc(var(--av)*.36);letter-spacing:-.02em}
.${P}-av img{width:100%;height:100%;object-fit:cover;display:block}
.${P}-av-fb{background:linear-gradient(140deg,var(--sbel-primary),var(--sbel-accent));
  color:var(--sbel-primary-text)}
.${P}-av-fb::after{content:attr(data-ini)}
.${P}-av-hero{box-shadow:0 0 0 2px rgba(var(--p-rgb),.55),0 0 0 7px rgba(var(--p-rgb),.14),
  var(--hero-shadow)}
/* Profile hovercard. Rendered on <body> so the deck's slide transforms cannot
   re-base its position:fixed — it therefore inherits no scheme tokens and gets
   them copied on at show time. */
.${P}-hover{position:fixed;z-index:2147483000;display:flex;gap:11px;align-items:center;
  max-width:290px;padding:12px 14px;border-radius:14px;pointer-events:auto;
  background:linear-gradient(180deg,var(--bg-2,#12161F),var(--bg,#0B0D12));
  border:1px solid var(--line,rgba(255,255,255,.10));
  box-shadow:var(--drop,0 24px 60px -24px rgba(0,0,0,.7));
  color:var(--ink,#F2F5FA);font-family:inherit;
  opacity:0;transform:translateY(4px) scale(.97);transform-origin:50% 100%;
  transition:opacity .16s ease,transform .16s cubic-bezier(.16,1,.3,1);
  visibility:hidden}
.${P}-hover.is-on{opacity:1;transform:none;visibility:visible}
.${P}-hover-txt{min-width:0}
.${P}-hover strong{display:block;font-size:14px;font-weight:700;line-height:1.25;
  letter-spacing:-.01em;color:var(--ink,#F2F5FA)}
.${P}-hover ul{list-style:none;margin:5px 0 0;padding:0;display:grid;gap:3px}
.${P}-hover li{display:flex;gap:6px;align-items:center;font-size:11.5px;line-height:1.35;
  color:var(--ink-2,#9AA6BD)}
.${P}-hover li svg{flex:0 0 auto;opacity:.75}
.${P}-hover li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (prefers-reduced-motion:reduce){.${P}-hover{transition:none}}
.${P}-avlink{display:inline-flex;border-radius:50%}
.${P}-avlink:focus-visible{outline:2px solid var(--sbel-primary);outline-offset:3px}

/* The field */
.${P}-field{display:flex;flex-direction:column;gap:11px}
.${P}-frow{display:flex;align-items:center;gap:11px;min-width:0}
.${P}-rank{flex:0 0 14px;font-size:11px;font-weight:700;color:var(--ink-2);
  font-variant-numeric:tabular-nums;text-align:right}
.${P}-frow-body{flex:1 1 auto;min-width:0}
.${P}-frow-top{display:flex;align-items:baseline;gap:10px;margin-bottom:5px}
.${P}-frow-nm{flex:1 1 auto;min-width:0;font-size:13px;font-weight:600;color:var(--ink)!important;
  letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
a.${P}-frow-nm:hover{text-decoration:underline!important;text-underline-offset:3px}
.${P}-frow-v{flex:0 0 auto;font-size:12.5px;font-weight:700;color:var(--ink-2);
  font-variant-numeric:tabular-nums}
.${P}-track{display:block;height:6px;border-radius:99px;background:rgba(var(--tint),.08);
  overflow:hidden}
.${P}-fill{display:block;height:100%;width:var(--w);border-radius:99px;
  background:linear-gradient(90deg,rgba(var(--p-rgb),.55),var(--sbel-primary))}

/* Flourish */
.${P}-fl{margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}
.${P}-body>.${P}-fl:first-child{margin-top:0;padding-top:0;border-top:0}
.${P}-fl-h{display:block;font-size:10.5px;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:11px}
.${P}-cbar{display:flex;height:10px;border-radius:99px;overflow:hidden;background:rgba(var(--tint),.08)}
.${P}-cseg{display:block;width:var(--w)}
.${P}-root .${P}-legend{display:flex;flex-wrap:wrap;gap:6px 16px;
  margin:11px 0 0!important;padding-bottom:14px!important;
  font-size:11.5px;color:var(--ink-2)}
.${P}-legend li{display:flex;align-items:center;gap:6px}
.${P}-legend i{width:7px;height:7px;border-radius:2px;flex:0 0 auto}
.${P}-legend b{color:var(--ink);font-variant-numeric:tabular-nums}

.${P}-fl-ring{display:grid;grid-template-columns:auto 1fr;gap:4px 18px;align-items:center}
.${P}-fl-ring .${P}-fl-h{grid-column:1/-1}
.${P}-ringwrap{position:relative;display:inline-flex}
.${P}-ring-mid{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:22px;font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.${P}-fl-ring .${P}-legend{flex-direction:column;gap:7px}

.${P}-slope-plot{position:relative}
.${P}-slope svg{width:100%;height:84px;display:block}
.${P}-sdot{position:absolute;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
.${P}-sdot-a{width:8px;height:8px;background:var(--sbel-accent)}
.${P}-sdot-b{width:11px;height:11px;background:var(--sbel-primary);
  box-shadow:0 0 0 4px rgba(var(--p-rgb),.20)}
.${P}-sarea{fill:rgba(var(--p-rgb),.14)}
.${P}-slope-ends{display:flex;justify-content:space-between;margin-top:8px;font-size:11px;
  color:var(--ink-2)}
.${P}-slope-ends span{display:flex;flex-direction:column;gap:2px}
.${P}-slope-ends b{font-size:17px;font-weight:800;color:var(--ink);letter-spacing:-.03em;
  font-variant-numeric:tabular-nums}
.${P}-slope-now{text-align:right}
.${P}-slope-now b{color:var(--sbel-primary)}

.${P}-split{display:flex;flex-direction:column;gap:11px}
.${P}-split li{display:flex;align-items:center;gap:10px;font-size:11.5px;color:var(--ink-2)}
.${P}-sl-ic{display:inline-flex;color:var(--sbel-primary);flex:0 0 auto}
.${P}-sl-lbl{flex:0 0 52px}
.${P}-split .${P}-track{flex:1 1 auto}
.${P}-split b{flex:0 0 auto;font-size:13px;color:var(--ink);font-variant-numeric:tabular-nums}

/* Engagement map */
.${P}-bubwrap{position:relative;height:260px;margin-top:10px}
.${P}-bubgrid{position:absolute;inset:0;width:100%;height:100%;stroke:rgba(var(--tint),.07);
  stroke-width:.35}
.${P}-bub{position:absolute;transform:translate(-50%,50%)}
.${P}-axis{position:absolute;font-size:10px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-2)}
.${P}-axis-x{right:0;bottom:-6px}
.${P}-axis-y{left:-2px;top:-6px}

/* ── Footer ─────────────────────────────────────────────────────────────── */
.${P}-foot{display:flex;align-items:center;gap:12px;margin-top:22px;padding-top:16px;
  border-top:1px solid var(--line)}
.${P}-dots{display:flex;gap:6px;flex:1 1 auto;flex-wrap:wrap}
.${P}-root .${P}-dot{width:20px!important;height:14px;padding:0!important;border-radius:99px}
.${P}-dot::after{content:"";display:block;width:100%;height:3px;border-radius:99px;
  background:rgba(var(--tint),.18);transition:background .25s}
.${P}-root .${P}-dot:hover::after{background:rgba(var(--tint),.4)}
.${P}-dot[aria-selected="true"]::after{background:var(--sbel-primary);
  box-shadow:0 0 12px rgba(var(--p-rgb),.9)}
.${P}-count{font-size:11px;font-weight:700;color:var(--ink-2);font-variant-numeric:tabular-nums;
  letter-spacing:.04em}
.${P}-nav{display:flex;gap:7px;flex:0 0 auto}

/* Autoplay progress — a hairline across the top of the stage. */
.${P}-prog{position:absolute;top:0;left:0;right:0;height:2px;z-index:2;background:transparent}
.${P}-prog span{display:block;height:100%;width:0;
  background:linear-gradient(90deg,var(--sbel-accent),var(--sbel-primary));
  box-shadow:0 0 12px rgba(var(--p-rgb),.8)}
.${P}-prog.run span{animation:${P}-prog var(--dur) linear forwards}
@keyframes ${P}-prog{from{width:0}to{width:100%}}

/* ── States ─────────────────────────────────────────────────────────────── */
.${P}-note{display:inline-flex;align-items:center;gap:7px;margin-bottom:14px;padding:6px 11px;
  border-radius:99px;font-size:11.5px;font-weight:600;color:var(--warn);
  background:rgba(255,176,60,.11);border:1px solid rgba(255,176,60,.28)}
.${P}-empty{padding:44px 10px;text-align:center;color:var(--ink-2);font-size:13px;
  display:flex;flex-direction:column;align-items:center;gap:12px}
.${P}-empty svg{opacity:.5}
.${P}-root .${P}-empty p{font-size:13px!important;color:var(--ink-2)!important;line-height:1.5!important}
.${P}-sk{border-radius:var(--r-sm);background:rgba(var(--tint),.05);position:relative;overflow:hidden}
.${P}-sk::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
  background:linear-gradient(90deg,transparent,rgba(var(--tint),.07),transparent);
  animation:${P}-sweep 1.5s ease-in-out infinite}
@keyframes ${P}-sweep{to{transform:translateX(100%)}}
.${P}-skwrap{display:grid;gap:26px;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)}

.${P}-log{margin-top:16px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
  background:rgba(var(--shade,0,0,0),.45);border:1px solid var(--line);color:var(--ink-2);border-radius:var(--r-sm);
  padding:12px;max-height:190px;overflow:auto;white-space:pre-wrap;word-break:break-word}

/* ── The reveal ─────────────────────────────────────────────────────────── */
/* One rehearsed entrance, replayed per slide — the deck is a rotation, so the
   champion arriving is the same authored moment each time. Everything starts
   from its resting state, so a failed script never hides content. */
.${P}-anim .${P}-slide.is-on .${P}-champ-av{animation:${P}-hero .62s cubic-bezier(.16,1,.3,1) both}
.${P}-anim .${P}-slide.is-on .${P}-champ-txt{animation:${P}-rise .5s cubic-bezier(.16,1,.3,1) .1s both}
.${P}-anim .${P}-slide.is-on .${P}-champ-num{animation:${P}-rise .5s cubic-bezier(.16,1,.3,1) .17s both}
.${P}-anim .${P}-slide.is-on .${P}-shead,
.${P}-anim .${P}-slide.is-on .${P}-ssub{animation:${P}-rise .45s cubic-bezier(.16,1,.3,1) both}
.${P}-anim .${P}-slide.is-on .${P}-frow{animation:${P}-rise .45s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(220ms + var(--i)*55ms)}
.${P}-anim .${P}-slide.is-on .${P}-fl{animation:${P}-rise .5s cubic-bezier(.16,1,.3,1) .34s both}
.${P}-anim .${P}-slide.is-on .${P}-fill{animation:${P}-grow .75s cubic-bezier(.16,1,.3,1) .3s both}
.${P}-anim .${P}-slide.is-on .${P}-cseg{animation:${P}-grow .7s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(400ms + var(--d))}
.${P}-anim .${P}-slide.is-on .${P}-arc{animation:${P}-arc .8s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(360ms + var(--d))}
.${P}-anim .${P}-slide.is-on .${P}-sline{animation:${P}-draw .9s cubic-bezier(.16,1,.3,1) .35s both}
.${P}-anim .${P}-slide.is-on .${P}-sdot-b{animation:${P}-dotpop .5s cubic-bezier(.16,1,.3,1) 1s both}
.${P}-anim .${P}-slide.is-on .${P}-bub{animation:${P}-pop .55s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(200ms + var(--i)*35ms)}
.${P}-anim .${P}-slide.is-off{animation:${P}-out .2s ease-in both}

@keyframes ${P}-hero{
  from{opacity:0;transform:scale(.86) translateY(10px);filter:blur(9px)}
  to{opacity:1;transform:none;filter:blur(0)}}
@keyframes ${P}-rise{from{opacity:0;transform:translateY(11px)}to{opacity:1;transform:none}}
@keyframes ${P}-grow{from{width:0}}
@keyframes ${P}-arc{from{stroke-dasharray:0 9999}}
@keyframes ${P}-draw{from{stroke-dasharray:0 400}to{stroke-dasharray:400 0}}
@keyframes ${P}-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
@keyframes ${P}-dotpop{
  from{opacity:0;transform:translate(-50%,-50%) scale(.3)}
  to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes ${P}-out{to{opacity:0;transform:translateY(-8px) scale(.985);filter:blur(4px)}}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width:760px){
  .${P}-inner{padding:20px 18px 18px}
  .${P}-body,.${P}-skwrap{grid-template-columns:1fr;gap:20px}
  .${P}-fl-ring{grid-template-columns:1fr;justify-items:start}
  .${P}-num{font-size:clamp(40px,13vw,56px)}
  .${P}-champ{grid-template-columns:auto 1fr}
}
@media (max-width:440px){
  .${P}-champ{grid-template-columns:1fr;gap:12px}
  .${P}-champ-av{grid-row:auto}
  .${P}-champ-num{grid-column:1}
}

@media (prefers-reduced-motion:reduce){
  .${P}-root *,.${P}-root *::after,.${P}-root *::before{
    animation:none!important;transition:none!important}
}
`;

// ── Factory ──────────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class EngagementLeaderboard extends BaseBlockClass implements BaseBlock {
    constructor() { super(); }

    async renderBlock(container: HTMLElement) {
      const self: any = this;
      // A re-render (attribute change) must not leave the previous instance's
      // timers and listeners running against a detached DOM.
      if (self._sbelCleanup) { try { self._sbelCleanup(); } catch (_) { /* ignore */ } }
      const cleanups: Array<() => void> = [];
      const peopleIx = new Map<string, Person>();
      self._sbelCleanup = () => { for (const fn of cleanups.splice(0)) { try { fn(); } catch (_) { /* ignore */ } } };

      const attr = (k: string): string => this.getAttribute(k) || "";
      const bool = (k: string, dflt: boolean): boolean => {
        const v = this.getAttribute(k);
        return v == null || v === "" ? dflt : v !== "false";
      };
      const int = (k: string, dflt: number): number => {
        const n = parseInt(attr(k), 10);
        return isFinite(n) && n > 0 ? n : dflt;
      };

      const apiToken = attr("apitoken") || DEFAULT_API_TOKEN;
      const baseUrl = (attr("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
      const authMode = (attr("authmode") || "auto") as "auto" | "token" | "session";
      const mode = attr("displaymode") === "grid" ? "grid" : "slideshow";
      const schemePref = attr("colorscheme") || "dark";
      const prefersLight = typeof matchMedia === "function"
        && matchMedia("(prefers-color-scheme: light)").matches;
      const scheme: "light" | "dark" =
        schemePref === "light" ? "light"
          : schemePref === "auto" ? (prefersLight ? "light" : "dark")
            : "dark";
      const debug = bool("debugmode", false);
      const autoWiden = bool("autowiden", true);
      const showPicker = bool("showwindowpicker", true);
      const showBubble = bool("showbubblemap", false);
      const showSample = bool("showsample", true);
      const autoplay = mode === "slideshow" && bool("autoplay", true);
      const autoplayMs = Math.max(3, int("autoplayseconds", 8)) * 1000;
      const topN = Math.max(2, Math.min(10, int("topn", 5)));
      const maxPosts = Math.min(1000, int("maxposts", 200));
      const cacheTtl = int("cachettl", 15) * 60000;

      const reduceMotion = typeof matchMedia === "function"
        && matchMedia("(prefers-reduced-motion: reduce)").matches;
      const animate = bool("animate", true) && !reduceMotion;

      const csv = (k: string): string[] => attr(k).split(",").map(s => s.trim()).filter(Boolean);
      const exclude = new Set(csv("excludeuserids"));
      const channels = csv("channels");

      let metrics = METRIC_ATTRS.filter(m => bool(m.attr, true)).map(m => m.id);
      if (!metrics.length) metrics = [METRIC_ATTRS[0].id];

      let primary = attr("primarycolor") || DEFAULT_PRIMARY_COLOR;
      let accent = attr("accentcolor") || DEFAULT_ACCENT_COLOR;
      if (bool("usethemecolors", true) && apiToken && baseUrl) {
        // The surface decides whether a brand hue gets lightened (dark stage) or
        // darkened (light stage) to reach contrast — get this wrong and a deep
        // navy either vanishes into black or glares off white.
        const themed = await fetchThemeColors(baseUrl, apiToken, "primary", scheme);
        if (themed.primary) primary = themed.primary;
        if (themed.accent) accent = themed.accent;
      }
      if (accent.toLowerCase() === primary.toLowerCase()) accent = DEFAULT_ACCENT_COLOR;

      const locale = detectLocale({
        configLocale: (widgetApi as any)?.getContentLanguage?.() || null,
        available: AVAILABLE_LOCALES,
      });
      const t = makeT(BUNDLES, locale);
      const rtl = isRtl(locale);

      const logs: string[] = [];
      const dlog = (...args: any[]) => {
        const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
        logs.push(`${new Date().toISOString().slice(11, 19)}  ${line}`);
        if (debug) {
          const el = container.querySelector(`.${P}-log`);
          if (el) { el.textContent = logs.join("\n"); el.scrollTop = el.scrollHeight; }
        }
      };

      let windowKey = (attr("timewindow") || "90d") as WindowKey;
      let prevKey: WindowKey = windowKey === "custom" ? "90d" : windowKey;
      let customSince = attr("customsince");
      let customUntil = attr("customuntil");
      const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

      // ── Shell ──────────────────────────────────────────────────────────────
      const windowKeys: WindowKey[] = ["all", "7d", "30d", "90d", "12m", "custom"];
      container.innerHTML = `<style>${CSS}</style>
        <div class="${P}-root${scheme === "light" ? ` ${P}-light` : ""}${animate ? ` ${P}-anim` : ""}"
          dir="${rtl ? "rtl" : "ltr"}" style="
          --sbel-primary:${esc(primary)};--sbel-accent:${esc(accent)};
          --sbel-primary-rgb:${hexToRgb(primary)};--sbel-accent-rgb:${hexToRgb(accent)};
          --sbel-primary-text:${readableOn(primary)}">
          <div class="${P}-prog"><span></span></div>
          <div class="${P}-glow"></div>
          <div class="${P}-grain"></div>
          <div class="${P}-inner">
            <div class="${P}-top">
              <div class="${P}-eyebrow">
                <span class="${P}-mark"></span>
                <span class="${P}-h">${esc(t("widget.title"))}</span>
              </div>
              <span class="${P}-chip ${P}-status" hidden></span>
              ${showPicker ? `<select class="${P}-sel ${P}-window" aria-label="${esc(t("window.custom"))}">
                ${windowKeys.map(k => `<option value="${k}"${k === windowKey ? " selected" : ""}>${esc(t(`window.${k}`))}</option>`).join("")}
              </select>
              <span class="${P}-range"${windowKey === "custom" ? "" : " hidden"}>
                <label>${esc(t("window.from"))}
                  <input class="${P}-since" type="date" value="${esc(customSince)}"></label>
                <label>${esc(t("window.to"))}
                  <input class="${P}-until" type="date" value="${esc(customUntil)}"></label>
              </span>` : ""}
              <button class="${P}-ctl ${P}-refresh" type="button" aria-label="${esc(t("state.refresh"))}" title="${esc(t("state.refresh"))}">${icon("refresh", 15)}</button>
            </div>
            ${mode === "slideshow" ? `<div class="${P}-rail" role="tablist"></div>` : ""}
            <div class="${P}-body-host"></div>
            ${debug ? `<pre class="${P}-log"></pre>` : ""}
          </div>
        </div>`;

      const root = container.querySelector(`.${P}-root`) as HTMLElement;
      const host = container.querySelector(`.${P}-body-host`) as HTMLElement;
      const rail = container.querySelector(`.${P}-rail`) as HTMLElement | null;
      const status = container.querySelector(`.${P}-status`) as HTMLElement;
      const progress = container.querySelector(`.${P}-prog`) as HTMLElement;
      const picker = container.querySelector(`.${P}-window`) as HTMLSelectElement | null;

      const setStatus = (text: string, mark: string = "beaker") => {
        status.innerHTML = text ? `${icon(mark, 13)}<span>${esc(text)}</span>` : "";
        status.hidden = !text;
      };

      const skeleton = () => {
        host.innerHTML = `<div class="${P}-sk" style="height:22px;width:190px"></div>
          <div class="${P}-sk" style="height:14px;width:260px;margin-top:9px"></div>
          <div class="${P}-skwrap" style="margin-top:22px">
            <div class="${P}-sk" style="height:150px"></div>
            <div class="${P}-sk" style="height:150px"></div>
          </div>`;
      };

      // ── Data ───────────────────────────────────────────────────────────────
      const cacheKey = `${CACHE_PREFIX}${baseUrl}|${channels.join(",")}|${maxPosts}`;
      // The window is deliberately not part of the key: raw events are cached
      // un-windowed so changing the period re-filters in memory with no
      // requests. Rankings are the exception — they can only be filtered
      // server-side — so they are cached per window.
      const rankingCache = new Map<string, PostRanking[]>();
      let raw: RawData | null = null;
      let isSample = false;
      let tiles: Tile[] = [];
      let index = 0;

      const readCache = (): RawData | null => {
        try {
          const s = sessionStorage.getItem(cacheKey);
          if (!s) return null;
          const d = JSON.parse(s) as RawData;
          if (!d || Date.now() - d.fetchedAt > cacheTtl) return null;
          return d;
        } catch (_) { return null; }
      };
      const writeCache = (d: RawData) => {
        try { sessionStorage.setItem(cacheKey, JSON.stringify(d)); } catch (_) { /* quota — non-fatal */ }
      };

      const http = new Http(4, dlog);
      const tokenOrder = apiToken && authMode !== "session" ? [makeApiOpts(apiToken)] : [];
      const order = authMode === "session" ? [sessionOpts] : tokenOrder.concat([sessionOpts]);

      const rankingsFor = async (since?: Date, until?: Date): Promise<PostRanking[]> => {
        const key = `${since ? since.toISOString() : ""}|${until ? until.toISOString() : ""}`;
        const hit = rankingCache.get(key);
        if (hit) return hit;
        try {
          const rows = await fetchPostRankings(http, baseUrl, order, since, until);
          rankingCache.set(key, rows);
          return rows;
        } catch (e: any) {
          dlog("rankings failed:", e?.message || String(e));
          rankingCache.set(key, []);
          return [];
        }
      };

      // ── Autoplay ───────────────────────────────────────────────────────────
      let timer: any = null;
      let paused = false;
      let visible = true;
      const canPlay = () => autoplay && animate && tiles.length > 1 && visible && !paused;

      const stopTimer = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        progress.classList.remove("run");
        progress.style.removeProperty("--dur");
      };
      const startTimer = () => {
        stopTimer();
        if (!canPlay()) return;
        progress.style.setProperty("--dur", `${autoplayMs}ms`);
        // Restart the CSS animation from zero on every advance.
        void progress.offsetWidth;
        progress.classList.add("run");
        timer = setTimeout(() => go(index + 1, 1), autoplayMs);
      };
      cleanups.push(stopTimer);

      // ── Reveal ─────────────────────────────────────────────────────────────
      /** Count the headline number up. Cheap, and it is the one moment the
       *  metric itself deserves emphasis. */
      const countUp = (el: HTMLElement) => {
        const target = Number(el.getAttribute("data-count"));
        if (!isFinite(target) || !animate || target <= 0) return;
        const dur = 700, t0 = performance.now();
        let raf = 0;
        const tick = (now: number) => {
          const k = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - k, 3);
          el.textContent = fmt(Math.round(target * eased * 10) / 10);
          if (k < 1) raf = requestAnimationFrame(tick);
          else el.textContent = fmt(target);
        };
        raf = requestAnimationFrame(tick);
        cleanups.push(() => cancelAnimationFrame(raf));
      };

      /* The deck stacks its slides, so it needs to be told how tall the active
         one is. Measured from scrollHeight (the slide is never itself scrolled)
         and eased by the CSS transition. */
      const syncHeight = (instant?: boolean) => {
        const deck = root.querySelector<HTMLElement>(`.${P}-deck`);
        if (!deck || deck.classList.contains(`${P}-grid`)) return;
        const on = deck.querySelector<HTMLElement>(`.${P}-slide.is-on`);
        if (!on) return;
        const h = Math.ceil(on.getBoundingClientRect().height || on.scrollHeight);
        if (h <= 0) return;
        if (instant) {
          // First measurement only: the deck is already at its natural (tallest)
          // height, so easing to the active slide would read as an unexplained
          // shrink before the viewer has done anything.
          deck.style.transition = "none";
          deck.style.height = `${h}px`;
          void deck.offsetHeight;
          deck.style.transition = "";
          return;
        }
        deck.style.height = `${h}px`;
      };

      const railFades = () => {
        const rail = root.querySelector<HTMLElement>(`.${P}-rail`);
        if (!rail) return;
        const over = rail.scrollWidth - rail.clientWidth;
        const x = rail.scrollLeft;
        rail.style.setProperty("--f0", over > 2 && x > 2 ? "26px" : "0px");
        rail.style.setProperty("--f1", over > 2 && x < over - 2 ? "26px" : "0px");
      };

      const go = (next: number, dir: 1 | -1) => {
        if (!tiles.length) return;
        const n = ((next % tiles.length) + tiles.length) % tiles.length;
        const slides = Array.from(host.querySelectorAll<HTMLElement>(`.${P}-slide`));
        if (!slides.length) return;
        const prev = slides[index];
        index = n;

        if (prev && prev !== slides[n]) {
          prev.classList.remove("is-on");
          prev.classList.add("is-off");
          setTimeout(() => prev.classList.remove("is-off"), 220);
        }
        slides.forEach((s, i) => s.classList.toggle("is-on", i === n));

        // Re-trigger the entrance by reinserting the node's animation classes.
        const on = slides[n];
        on.getAnimations?.().forEach(a => { a.cancel(); a.play(); });
        on.querySelectorAll<HTMLElement>("*").forEach(el =>
          el.getAnimations?.().forEach(a => { a.cancel(); a.play(); }));

        const num = on.querySelector<HTMLElement>(`.${P}-num[data-count]`);
        if (num) countUp(num);

        root.querySelectorAll<HTMLElement>(`.${P}-tab,.${P}-dot`).forEach(el => {
          const on2 = Number(el.getAttribute("data-i")) === n;
          el.setAttribute("aria-selected", String(on2));
          el.setAttribute("tabindex", on2 ? "0" : "-1");
        });
        const counter = root.querySelector(`.${P}-count`);
        if (counter) counter.textContent = `${n + 1}/${tiles.length}`;
        const activeTab = root.querySelector<HTMLElement>(`.${P}-tab[aria-selected="true"]`);
        activeTab?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: animate ? "smooth" : "auto" });
        syncHeight();
        // The entrance animation changes nothing about layout height, but web
        // fonts and images settle a beat later, so re-measure once.
        setTimeout(syncHeight, 260);
        setTimeout(railFades, 320);

        startTimer();
        void dir;
      };

      // ── Render ─────────────────────────────────────────────────────────────
      const slideHtml = (tile: Tile, i: number): string => {
        const L = {
          breakdown: t("chart.breakdown"), mix: t("chart.mix"),
          previous: t("chart.previous"), current: t("chart.current"),
        };
        const fl = flourish(tile, L);
        const fieldHtml = field(tile);
        const note = tile.widened ? `<div class="${P}-note">${icon("history", 13)}<span>${esc(t("window.widened"))}</span></div>` : "";
        const empty = !tile.entries.length;
        return `<section class="${P}-slide${i === 0 ? " is-on" : ""}" role="tabpanel"
          id="${P}-panel-${i}" aria-label="${esc(tile.title)}"${mode === "slideshow" ? ` data-i="${i}"` : ""}>
          <header class="${P}-shead">
            <span class="${P}-shead-ic">${icon(METRIC_ICON[tile.id] || "spark", 15)}</span>
            <h4 class="${P}-stitle">${esc(tile.title)}</h4>
          </header>
          <p class="${P}-ssub">${esc(tile.subtitle)}</p>
          ${note}
          ${empty
            ? `<div class="${P}-empty">${icon("inbox", 26)}<p>${esc(t("state.emptyTile"))}</p></div>`
            : `<div class="${P}-body">
                 <div>${champion(tile, mode === "grid" ? "card" : "stage")}${fl}</div>
                 ${fieldHtml ? `<div>${fieldHtml}</div>` : ""}
               </div>`}
        </section>`;
      };

      // ── Hi-res avatars ─────────────────────────────────────────────────────
      // `/users` only gives us a 48px icon, which is visibly soft behind the
      // 132px champion portrait. `/profiles/public/{id}` has a 200px original we
      // can ask to be rendered larger. It is USER-authenticated and entirely
      // optional, so it runs *after* the deck is on screen and patches the
      // existing <img> in place — re-rendering would replay every entrance
      // animation for a cosmetic upgrade.
      const cssq = (v: string) => v.replace(/["\\]/g, "\\$&");
      const profileCache = new Map<string, string | null>();
      let upgradeToken = 0;

      const applyAvatar = (uid: string, url: string) => {
        const want = hiResAvatar(url, 400);
        root.querySelectorAll<HTMLImageElement>(`[data-uid="${cssq(uid)}"] img`).forEach(img => {
          if (img.dataset.hires === "1") return;
          img.dataset.hires = "1";
          // The 400px render is a guess about a URL shape we do not own; step
          // back to the URL the API actually handed us before giving up.
          img.onerror = () => { img.onerror = null; img.src = url; };
          img.src = want;
        });
      };

      const upgradeAvatars = async () => {
        const mine = ++upgradeToken;
        const ids: string[] = [];
        root.querySelectorAll<HTMLElement>("[data-uid]").forEach(el => {
          const id = el.dataset.uid || "";
          if (id && ids.indexOf(id) < 0) ids.push(id);
        });
        for (const id of ids) {
          const hit = profileCache.get(id);
          if (hit) applyAvatar(id, hit);
        }
        const missing = ids.filter(id => !profileCache.has(id));
        if (!missing.length) return;
        dlog(`upgrading ${missing.length} avatar(s) via /profiles/public`);
        await Promise.all(missing.map(async id => {
          const prof = await fetchPublicProfile(http, baseUrl, id, order);
          profileCache.set(id, prof?.avatar || null);
          if (mine !== upgradeToken) return;
          const person = peopleIx.get(id);
          if (person && prof) {
            if (prof.avatar) person.avatar = prof.avatar;
            if (!person.position && prof.position) person.position = prof.position;
            if (!person.department && prof.department) person.department = prof.department;
          }
          if (prof?.avatar) applyAvatar(id, prof.avatar);
        }));
      };

      // ── Profile hovercard ──────────────────────────────────────────────────
      // Lives on <body>, not inside the widget: the deck uses transforms for its
      // slide transitions, and a transformed ancestor re-bases position:fixed,
      // which would drag the card around with the slide.
      let hoverEl: HTMLElement | null = null;
      let hoverFor: HTMLElement | null = null;
      let hoverShow = 0;
      let hoverHide = 0;

      const placeHover = (anchorEl: HTMLElement) => {
        if (!hoverEl) return;
        const a = anchorEl.getBoundingClientRect();
        const h = hoverEl.getBoundingClientRect();
        const pad = 10;
        let left = a.left + a.width / 2 - h.width / 2;
        left = Math.max(pad, Math.min(left, window.innerWidth - h.width - pad));
        // Prefer above; flip below only when there is genuinely no room.
        let top = a.top - h.height - 10;
        if (top < pad) top = a.bottom + 10;
        hoverEl.style.left = `${Math.round(left)}px`;
        hoverEl.style.top = `${Math.round(top)}px`;
      };

      const hideHover = () => {
        window.clearTimeout(hoverShow);
        window.clearTimeout(hoverHide);
        hoverHide = window.setTimeout(() => {
          hoverFor = null;
          if (hoverEl) hoverEl.classList.remove("is-on");
        }, 180);
      };

      const showHover = (anchorEl: HTMLElement) => {
        const uid = anchorEl.dataset.uid || "";
        const person = peopleIx.get(uid);
        if (!person) return;
        // The avatar and the name are two separate anchors for the same person,
        // and each has children. Without this guard, crossing between them
        // cancels and restarts the reveal, so the card visibly blinks.
        window.clearTimeout(hoverHide);
        if (hoverFor === anchorEl && hoverEl?.classList.contains("is-on")) return;
        hoverFor = anchorEl;
        window.clearTimeout(hoverShow);
        hoverShow = window.setTimeout(() => {
          if (!hoverEl) {
            hoverEl = document.createElement("div");
            hoverEl.className = `${P}-hover`;
            document.body.appendChild(hoverEl);
            hoverEl.addEventListener("mouseenter", () => window.clearTimeout(hoverHide));
            hoverEl.addEventListener("mouseleave", hideHover);
          }
          // The card is outside .sbel-root, so it inherits none of the scheme
          // tokens — carry the ones it needs across explicitly.
          const cs = getComputedStyle(root);
          for (const v of ["--tint", "--bg", "--bg-2", "--panel", "--line", "--ink", "--ink-2",
            "--p-rgb", "--r-sm", "--drop", "--sbel-primary", "--sbel-accent", "--sbel-primary-text"]) {
            hoverEl.style.setProperty(v, cs.getPropertyValue(v));
          }
          const rows: string[] = [];
          if (person.position) rows.push(`${icon("badge", 13)}<span>${esc(person.position)}</span>`);
          if (person.department) rows.push(`${icon("people", 13)}<span>${esc(person.department)}</span>`);
          if (person.location) rows.push(`${icon("pin", 13)}<span>${esc(person.location)}</span>`);
          const av = person.avatar
            ? `<img src="${esc(person.avatar)}" alt="" onerror="this.parentElement.classList.add('${P}-av-fb');this.remove()">`
            : "";
          hoverEl.innerHTML = `
            <span class="${P}-av${person.avatar ? "" : ` ${P}-av-fb`}" style="--av:46px"
              data-ini="${esc(initials(person.name))}">${av}</span>
            <div class="${P}-hover-txt">
              <strong>${esc(person.name)}</strong>
              ${rows.length ? `<ul>${rows.map(r => `<li>${r}</li>`).join("")}</ul>` : ""}
            </div>`;
          hoverEl.classList.add("is-on");
          placeHover(anchorEl);
        }, 220);
      };

      const onHoverOver = (ev: Event) => {
        const el = (ev.target as HTMLElement)?.closest?.("[data-uid]") as HTMLElement | null;
        if (el) showHover(el);
      };
      const onHoverOut = (ev: Event) => {
        const el = (ev.target as HTMLElement)?.closest?.("[data-uid]") as HTMLElement | null;
        if (!el) return;
        const to = (ev as MouseEvent).relatedTarget as HTMLElement | null;
        if (to && typeof to.closest === "function" && to.closest("[data-uid]") === el) return;
        hideHover();
      };
      root.addEventListener("mouseover", onHoverOver);
      root.addEventListener("mouseout", onHoverOut);
      root.addEventListener("focusin", onHoverOver);
      root.addEventListener("focusout", onHoverOut);
      cleanups.push(() => {
        window.clearTimeout(hoverShow);
        window.clearTimeout(hoverHide);
        root.removeEventListener("mouseover", onHoverOver);
        root.removeEventListener("mouseout", onHoverOut);
        root.removeEventListener("focusin", onHoverOver);
        root.removeEventListener("focusout", onHoverOut);
        if (hoverEl && hoverEl.parentNode) hoverEl.parentNode.removeChild(hoverEl);
        hoverEl = null;
      });

      const render = async () => {
        if (!raw) return;
        for (const p of raw.people) peopleIx.set(p.id, p);
        const now = Date.now();
        const win = resolveWindow(windowKey, now, customSince, customUntil);

        const wantsAdvocacy = metrics.indexOf("advocacy") >= 0;
        let rankings = raw.rankings;
        let rankingsAll = raw.rankings;
        if (wantsAdvocacy && !isSample) {
          rankingsAll = await rankingsFor(undefined, undefined);
          rankings = windowKey === "all" ? rankingsAll
            : await rankingsFor(new Date(win.since), new Date(win.until));
        }

        tiles = buildTiles({
          raw, window: win, weights: DEFAULT_WEIGHTS, topN, metrics, exclude,
          autoWiden, rankings, rankingsAllTime: rankingsAll, t,
          colors: { comment: primary, reaction: accent, post: "#FFB43C", breadth: "#3DDC97" },
        });

        if (!tiles.length) {
          host.innerHTML = `<div class="${P}-empty">${icon("inbox", 26)}<p>${esc(t("state.empty"))}</p></div>`;
          return;
        }

        const bubble = showBubble && !isSample ? bubbleCard(raw, win) : "";
        if (mode === "grid") {
          host.innerHTML = `<div class="${P}-grid">${tiles.map(slideHtml).join("")}</div>${bubble}`;
          host.querySelectorAll<HTMLElement>(`.${P}-num[data-count]`).forEach(countUp);
        } else {
          host.innerHTML = `<div class="${P}-deck">${tiles.map(slideHtml).join("")}</div>
            <div class="${P}-foot">
              <div class="${P}-dots">${tiles.map((tile, i) =>
                `<button class="${P}-dot" type="button" data-i="${i}" role="tab"
                  aria-selected="${i === 0}" aria-controls="${P}-panel-${i}"
                  aria-label="${esc(tile.title)}"></button>`).join("")}</div>
              <span class="${P}-count">1/${tiles.length}</span>
              <div class="${P}-nav">
                <button class="${P}-ctl ${P}-prev" type="button" aria-label="${esc(t("nav.previous"))}">${icon("chevronLeft", 15)}</button>
                <button class="${P}-ctl ${P}-next" type="button" aria-label="${esc(t("nav.next"))}">${icon("chevronRight", 15)}</button>
              </div>
            </div>${bubble}`;
          if (rail) {
            rail.innerHTML = tiles.map((tile, i) =>
              `<button class="${P}-tab" type="button" role="tab" data-i="${i}"
                aria-selected="${i === 0}" aria-controls="${P}-panel-${i}" tabindex="${i === 0 ? 0 : -1}"
                >${icon(METRIC_ICON[tile.id] || "spark", 14)}<span>${esc(tile.title)}</span></button>`).join("");
          }
          index = Math.min(index, tiles.length - 1);
          wireDeck();
          go(index, 1);
        }

        const parts: string[] = [];
        if (isSample) parts.push(t("state.sample"));
        if (raw.skippedPosts) {
          parts.push(t("state.partialN")
            .replace("{n}", String(raw.skippedPosts))
            .replace("{total}", String(raw.posts.length + raw.skippedPosts)));
        }
        // Sample data is a caveat; skipped posts are a warning. Different mark.
        setStatus(parts.join(" · "), isSample ? "beaker" : "alert");
        dlog(`rendered ${tiles.length} tiles for window ${windowKey}`);
        if (!isSample) void upgradeAvatars();
      };

      const bubbleCard = (d: RawData, win: { since: number; until: number }): string => {
        const stats = aggregate(d.events, win, exclude);
        const people = new Map(d.people.map(p => [p.id, p]));
        const points: Array<{ entry: any; x: number; y: number; size: number }> = [];
        for (const [id, s] of stats) {
          const p = people.get(id);
          const vol = activityScore(s);
          if (!p || vol <= 0) continue;
          points.push({ entry: { person: p, value: vol }, x: s.distinctPosts, y: vol, size: vol });
        }
        points.sort((a, b) => b.size - a.size);
        const svg = bubbleMap(points.slice(0, 22), t("map.label"), t("map.axisX"), t("map.axisY"));
        if (!svg) return "";
        return `<section class="${P}-slide is-on" style="margin-top:26px;padding-top:22px;border-top:1px solid var(--line)">
          <header class="${P}-shead"><span class="${P}-shead-ic">${icon("scatter", 15)}</span>
            <h4 class="${P}-stitle">${esc(t("map.title"))}</h4></header>
          <p class="${P}-ssub">${esc(t("map.sub"))}</p>
          ${svg}
        </section>`;
      };

      // ── Deck wiring ────────────────────────────────────────────────────────
      function wireDeck() {
        const on = (el: Element | null, ev: string, fn: any, opts?: any) => {
          if (!el) return;
          el.addEventListener(ev, fn, opts);
          cleanups.push(() => el.removeEventListener(ev, fn, opts));
        };

        on(root.querySelector(`.${P}-prev`), "click", () => { paused = false; go(index - 1, -1); });
        on(root.querySelector(`.${P}-next`), "click", () => { paused = false; go(index + 1, 1); });
        root.querySelectorAll(`.${P}-tab,.${P}-dot`).forEach(el =>
          on(el, "click", () => {
            // A deliberate pick outranks the rotation: stop auto-advancing so the
            // viewer isn't yanked off the metric they just chose.
            paused = true; stopTimer();
            go(Number(el.getAttribute("data-i")) || 0, 1);
          }));

        on(root, "keydown", (e: KeyboardEvent) => {
          const k = e.key;
          if (k !== "ArrowLeft" && k !== "ArrowRight" && k !== "Home" && k !== "End") return;
          const inRail = (e.target as HTMLElement)?.closest?.(`.${P}-rail,.${P}-dots`);
          if (!inRail && document.activeElement !== root) return;
          e.preventDefault();
          paused = true; stopTimer();
          if (k === "Home") go(0, -1);
          else if (k === "End") go(tiles.length - 1, 1);
          else go(index + (k === "ArrowRight" ? 1 : -1), k === "ArrowRight" ? 1 : -1);
          root.querySelector<HTMLElement>(`.${P}-tab[aria-selected="true"],.${P}-dot[aria-selected="true"]`)?.focus();
        });

        // Pointer hold pauses the rotation; swipe moves the deck.
        let x0 = 0, y0 = 0, down = false;
        const deck = root.querySelector(`.${P}-deck`);
        on(deck, "pointerdown", (e: PointerEvent) => {
          down = true; x0 = e.clientX; y0 = e.clientY; paused = true; stopTimer();
        });
        on(deck, "pointerup", (e: PointerEvent) => {
          if (!down) return;
          down = false;
          const dx = e.clientX - x0, dy = e.clientY - y0;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
            const fwd = rtl ? dx > 0 : dx < 0;
            go(index + (fwd ? 1 : -1), fwd ? 1 : -1);
          }
          paused = false; startTimer();
        });
        on(deck, "pointercancel", () => { down = false; paused = false; startTimer(); });

        on(root, "mouseenter", () => { paused = true; stopTimer(); });
        on(root, "mouseleave", () => { paused = false; startTimer(); });
        on(root, "focusin", () => { paused = true; stopTimer(); });

        on(root.querySelector(`.${P}-rail`), "scroll", railFades, { passive: true });
        railFades();

        // Height is measured, so it has to be re-measured whenever the widget is
        // resized — a widget column can change width without the window doing so.
        syncHeight(true);
        requestAnimationFrame(() => syncHeight(true));
        if (typeof ResizeObserver === "function") {
          let rafId = 0;
          const ro = new ResizeObserver(() => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => { syncHeight(); railFades(); });
          });
          ro.observe(root);
          cleanups.push(() => { cancelAnimationFrame(rafId); ro.disconnect(); });
        } else {
          const onResize = () => { syncHeight(); railFades(); };
          window.addEventListener("resize", onResize);
          cleanups.push(() => window.removeEventListener("resize", onResize));
        }
      }

      // Nonessential motion must not run offscreen or in a hidden tab.
      if (typeof IntersectionObserver === "function") {
        const io = new IntersectionObserver(entries => {
          visible = entries.some(en => en.isIntersecting);
          root.classList.toggle(`${P}-live`, visible && animate);
          if (visible) startTimer(); else stopTimer();
        }, { threshold: 0.15 });
        io.observe(root);
        cleanups.push(() => io.disconnect());
      } else {
        root.classList.toggle(`${P}-live`, animate);
      }
      const onVis = () => {
        visible = !document.hidden;
        root.classList.toggle(`${P}-live`, visible && animate);
        if (visible) startTimer(); else stopTimer();
      };
      document.addEventListener("visibilitychange", onVis);
      cleanups.push(() => document.removeEventListener("visibilitychange", onVis));

      // ── Load ───────────────────────────────────────────────────────────────
      const load = async (force: boolean) => {
        stopTimer();
        skeleton();
        setStatus("");

        if (!baseUrl || (!apiToken && authMode === "token")) {
          if (showSample) {
            raw = sampleRaw(); isSample = true;
            await render();
          } else {
            host.innerHTML = `<div class="${P}-empty">${icon("beaker", 26)}<p>${esc(t("state.configure"))}</p></div>`;
          }
          return;
        }

        if (!force) {
          const cached = readCache();
          if (cached) {
            raw = cached; isSample = false;
            dlog("served from cache");
            await render();
            return;
          }
        }

        try {
          raw = await loadRawData({ baseUrl, apiToken, authMode, maxPosts, concurrency: 4, log: dlog });
          isSample = false;
          writeCache(raw);
          await render();
        } catch (e: any) {
          dlog("load failed:", e?.message || String(e));
          if (showSample) {
            raw = sampleRaw(); isSample = true;
            await render();
          } else {
            host.innerHTML = `<div class="${P}-empty">${icon("alert", 26)}<p>${esc(t("state.error"))}</p>
              <button class="${P}-chip ${P}-retry" type="button" style="margin-top:12px;cursor:pointer">${esc(t("state.retry"))}</button></div>`;
            const retry = host.querySelector(`.${P}-retry`);
            retry?.addEventListener("click", () => void load(true));
          }
        }
      };

      const range = container.querySelector(`.${P}-range`) as HTMLElement | null;
      const sinceInput = container.querySelector(`.${P}-since`) as HTMLInputElement | null;
      const untilInput = container.querySelector(`.${P}-until`) as HTMLInputElement | null;

      picker?.addEventListener("change", () => {
        windowKey = picker.value as WindowKey;
        if (range) range.hidden = windowKey !== "custom";
        if (windowKey === "custom") {
          // Seed the pickers from whatever period was on screen, so switching to
          // a custom range starts from where the viewer already was rather than
          // blank (which would silently mean "all time").
          const w = resolveWindow(prevKey, Date.now(), customSince, customUntil);
          if (sinceInput && !sinceInput.value) {
            customSince = isoDay(w.since || Date.now() - 90 * 86400000);
            sinceInput.value = customSince;
          }
          if (untilInput && !untilInput.value) {
            customUntil = isoDay(w.until);
            untilInput.value = customUntil;
          }
        }
        prevKey = windowKey;
        index = 0;
        void render();
      });

      const onRangeChange = () => {
        customSince = sinceInput?.value || "";
        customUntil = untilInput?.value || "";
        // Guard the inverted range rather than rendering a confusing empty state.
        if (customSince && customUntil && customSince > customUntil) {
          if (sinceInput) sinceInput.value = customUntil;
          customSince = customUntil;
        }
        if (sinceInput) sinceInput.max = customUntil || "";
        if (untilInput) untilInput.min = customSince || "";
        index = 0;
        void render();
      };
      sinceInput?.addEventListener("change", onRangeChange);
      untilInput?.addEventListener("change", onRangeChange);
      (container.querySelector(`.${P}-refresh`) as HTMLButtonElement | null)
        ?.addEventListener("click", () => {
          rankingCache.clear();
          try { sessionStorage.removeItem(cacheKey); } catch (_) { /* ignore */ }
          void load(true);
        });

      await load(false);
    }

    disconnectedCallback() {
      const self: any = this;
      if (self._sbelCleanup) { try { self._sbelCleanup(); } catch (_) { /* ignore */ } }
      self._sbelCleanup = undefined;
    }

    static get observedAttributes() {
      return ATTRS;
    }
  };
};

const ATTRS = [
  "apitoken", "baseurl", "authmode", "displaymode", "colorscheme", "timewindow", "customsince", "customuntil",
  "autowiden", "showwindowpicker", "topn", "channels", "excludeuserids", "maxposts", "cachettl",
  "showbubblemap", "animate", "autoplay", "autoplayseconds", "usethemecolors",
  "primarycolor", "accentcolor", "showsample", "debugmode",
].concat(METRIC_ATTRS.map(m => m.attr));

// ── Block registration ───────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name: "engagement-leaderboard",
  label: "Engagement Leaderboard",
  attributes: ATTRS,
  factory,
  configurationSchema,
  uiSchema,
  blockLevel: "block",
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48cmVjdCB3aWR0aD0iMTcxIiBoZWlnaHQ9IjE3MSIgcng9IjM4IiBmaWxsPSIjMEIwRDEyIi8+PGcgZmlsbD0iIzNEREM5NyI+PHJlY3QgeD0iMzQiIHk9Ijk0IiB3aWR0aD0iMjYiIGhlaWdodD0iNDMiIHJ4PSI2Ii8+PHJlY3QgeD0iNzIiIHk9IjcwIiB3aWR0aD0iMjYiIGhlaWdodD0iNjciIHJ4PSI2Ii8+PC9nPjxyZWN0IHg9IjExMCIgeT0iMTA4IiB3aWR0aD0iMjYiIGhlaWdodD0iMjkiIHJ4PSI2IiBmaWxsPSIjN0M1Q0ZGIi8+PGNpcmNsZSBjeD0iODUiIGN5PSI0NCIgcj0iMTgiIGZpbGw9IiMzRERDOTciLz48L3N2Zz4=",
};

window.defineBlock({ blockDefinition, author: "Staffbase", version: "2.0.0" } as ExternalBlockDefinition);
