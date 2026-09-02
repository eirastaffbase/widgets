// ─────────────────────────────────────────────────────────────────────────────
// Engagement Leaderboard — a grid of engagement metric tiles computed live from
// branch data.
//
// The Staffbase API exposes no per-user engagement endpoint (the analytics
// `groupBy` enum accepts only `channelId`/`spaceId`, and
// `/branch/analytics/users/rankings` is feature-flag gated), so every
// person-level metric here is derived client-side from one pass over posts,
// reactions and comments. See `api.ts` for the auth ladder and `aggregate.ts`
// for the derivation.
// ─────────────────────────────────────────────────────────────────────────────

import {
  BlockFactory, BlockDefinition, ExternalBlockDefinition, BaseBlock,
} from "@staffbase/widget-sdk";
import { JSONSchema7 } from "json-schema";

import { detectLocale, isRtl, makeT } from "../tasks/shared/i18n";
import { fetchThemeColors } from "../tasks/shared/theming";
import { AVAILABLE_LOCALES, BUNDLES } from "./strings";
import {
  Http, fetchPostRankings, loadRawData, makeApiOpts, sessionOpts,
} from "./api";
import {
  DEFAULT_WEIGHTS, WindowKey, activityScore, aggregate, buildTiles, resolveWindow,
} from "./aggregate";
import { MetricId, PostRanking, RawData, Tile } from "./types";
import { P, avatar, bubbleMap, esc, renderChart } from "./charts";

// ── Defaults ─────────────────────────────────────────────────────────────────

// Ships empty on purpose: the token is a runtime editor value, never a
// committed secret.
const DEFAULT_API_TOKEN = "";
const DEFAULT_BASE_URL = "";
const DEFAULT_PRIMARY_COLOR = "#0EA5E9";
const DEFAULT_ACCENT_COLOR = "#7C3AED";

const ALL_METRICS: MetricId[] = [
  "most_active", "most_engaged", "top_commenter", "top_reactor",
  "advocacy", "most_appreciated", "top_contributor", "rising_star",
];

const CACHE_PREFIX = "sbel:v1:";

// ── Config schema ────────────────────────────────────────────────────────────

const configurationSchema: JSONSchema7 = {
  properties: {
    apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
    baseurl: { type: "string", title: "Base URL (e.g. https://app.staffbase.com/api)", default: DEFAULT_BASE_URL },
    authmode: { type: "string", title: "Authentication", enum: ["auto", "token", "session"], default: "auto" },
    timewindow: {
      type: "string", title: "Time Period",
      enum: ["all", "7d", "30d", "90d", "12m", "custom"], default: "90d",
    },
    autowiden: { type: "boolean", title: "Fall Back to All Time When a Period Is Empty", default: true },
    showwindowpicker: { type: "boolean", title: "Let Viewers Change the Period", default: true },
    metrics: {
      type: "array", title: "Metrics",
      items: { type: "string", enum: ALL_METRICS as string[] },
      uniqueItems: true,
      default: ALL_METRICS as string[],
    },
    topn: { type: "number", title: "People Per Tile", default: 3 },
    channels: { type: "string", title: "Limit to Channel IDs (comma-separated)", default: "" },
    excludeuserids: { type: "string", title: "Exclude User IDs (comma-separated)", default: "" },
    maxposts: { type: "number", title: "Max Posts to Scan", default: 200 },
    cachettl: { type: "number", title: "Cache Lifetime (minutes)", default: 15 },
    showbubblemap: { type: "boolean", title: "Show Engagement Map", default: false },
    animate: { type: "boolean", title: "Animate Charts", default: true },
    usethemecolors: { type: "boolean", title: "Use Theme Colors", default: false },
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
    // Custom ranges are the only case that needs explicit dates, so the fields
    // stay hidden otherwise.
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
    // Weight overrides only make sense when "Most engaged" is on the grid.
    metrics: {},
  },
};

// Left unannotated: the widget SDK bundles its own copy of the rjsf UiSchema
// type, so an explicit annotation from @rjsf/utils is a nominal mismatch.
const uiSchema = {
  apitoken: { "ui:help": "Basic API token. Stored in the widget configuration, not in source." },
  baseurl: { "ui:help": "Must include /api, e.g. https://acme.staffbase.com/api" },
  authmode: {
    "ui:help": "Auto tries the API token first and upgrades to the signed-in session where that unlocks richer data (typed reactions).",
  },
  metrics: { "ui:widget": "checkboxes" },
  maxposts: { "ui:help": "Each post costs one extra request for its reaction list. Lower this on large branches." },
  showbubblemap: { "ui:help": "Full-width scatter of participation breadth against volume." },
};

// ── Sample data ──────────────────────────────────────────────────────────────

/** So the editor and preview always render something. Clearly badged. */
function sampleRaw(): RawData {
  const names = [
    "Nicole Adams", "Davide Bonchamp", "Fred Duchamp", "Henry Fitz",
    "Frank Fox", "Maria Apathangelou", "Kay Lion", "Edward Hall",
  ];
  const people = names.map((n, i) => ({
    id: `u${i}`, name: n, avatar: "",
    position: ["Engineer", "Designer", "Analyst", "Manager"][i % 4],
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
  return { events, posts, people, rankings, skippedPosts: 0, typedReactions: false, fetchedAt: now };
}

// ── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
.${P}-root{--${P}-r:14px;--sbel-track:rgba(0,0,0,.08);--sbel-muted-line:rgba(0,0,0,.18);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:#111827;box-sizing:border-box}
.${P}-root *,.${P}-root *::before,.${P}-root *::after{box-sizing:inherit}
.${P}-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.${P}-h{font-size:18px;font-weight:700;margin:0;flex:1 1 auto}
.${P}-sel,.${P}-btn{font:inherit;font-size:13px;padding:6px 10px;border:1px solid rgba(0,0,0,.14);
  border-radius:8px;background:#fff;color:inherit;cursor:pointer}
.${P}-btn:hover,.${P}-sel:hover{border-color:var(--sbel-primary)}
.${P}-badge{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;
  padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.06);color:#4b5563}
.${P}-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.${P}-card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:var(--${P}-r);
  padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.05);display:flex;flex-direction:column;min-width:0}
.${P}-card-wide{grid-column:1/-1}
.${P}-ct{font-size:14px;font-weight:700;margin:0}
.${P}-cs{font-size:12px;color:#6b7280;margin:2px 0 12px}
.${P}-note{font-size:11px;color:#92400e;background:#fef3c7;border-radius:6px;padding:4px 8px;margin-bottom:10px}
.${P}-empty{font-size:13px;color:#9ca3af;padding:18px 0;text-align:center}

/* Avatars — the gradient-initials fallback is driven by data-ini so a 404 image
   degrades to a labelled circle instead of a broken-image glyph. */
.${P}-av{position:relative;display:inline-flex;align-items:center;justify-content:center;
  border-radius:50%;overflow:hidden;flex:0 0 auto;background:rgba(0,0,0,.06);color:#fff;font-weight:700}
.${P}-av img{width:100%;height:100%;object-fit:cover;display:block}
.${P}-av-fb{background:linear-gradient(135deg,var(--sbel-primary),var(--sbel-accent))}
.${P}-av-fb::after{content:attr(data-ini)}
.${P}-av-ring{box-shadow:0 0 0 3px var(--sbel-primary),0 0 0 5px #fff}
.${P}-avlink{text-decoration:none;display:inline-flex}
.${P}-nm{font-size:13px;font-weight:600;color:inherit;text-decoration:none;display:block;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
a.${P}-nm:hover{text-decoration:underline}
.${P}-meta{font-size:11px;color:#6b7280;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Bars */
.${P}-row{display:flex;align-items:center;gap:10px;padding:6px 0;min-width:0}
.${P}-row-body{flex:1 1 auto;min-width:0}
.${P}-row-v{font-size:14px;font-weight:700;flex:0 0 auto;font-variant-numeric:tabular-nums}
.${P}-row-win .${P}-row-v{color:var(--sbel-primary)}
.${P}-track{height:8px;border-radius:999px;background:var(--sbel-track);overflow:hidden;margin-top:5px}
.${P}-fill{height:100%;border-radius:999px;background:rgba(0,0,0,.25);width:var(--w);
  transform-origin:left center}
.${P}-row .${P}-fill{background:rgba(0,0,0,.18)}
.${P}-row-win .${P}-fill{background:var(--sbel-primary)}

/* Podium */
.${P}-podium{display:flex;align-items:flex-end;justify-content:center;gap:10px;min-height:170px}
.${P}-pil{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1 1 0;min-width:0}
.${P}-pil-nm{font-size:11px;font-weight:600;text-align:center;max-width:100%;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.${P}-pil-v{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
.${P}-pil-bar{width:100%;height:var(--h);min-height:22px;max-height:104px;border-radius:8px 8px 0 0;
  background:rgba(0,0,0,.10);display:flex;align-items:flex-start;justify-content:center;
  padding-top:4px;font-size:11px;font-weight:700;color:rgba(0,0,0,.45)}
.${P}-pil-1 .${P}-pil-bar{background:var(--sbel-primary);color:#fff}

/* Solo (fewer than two data points — a one-bar chart implies a comparison
   that isn't there) */
.${P}-solo{display:flex;align-items:center;gap:12px;padding:10px 0}
.${P}-solo-txt{flex:1 1 auto;min-width:0}
.${P}-solo-v{font-size:26px;font-weight:800;color:var(--sbel-primary);line-height:1;text-align:right}
.${P}-solo-v span{display:block;font-size:11px;font-weight:600;color:#6b7280}

/* Composition + legends */
.${P}-comp{margin-top:12px}
.${P}-cbar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--sbel-track)}
.${P}-cseg{width:var(--w);display:block}
.${P}-legend{list-style:none;margin:8px 0 0;padding:0;font-size:11px;color:#4b5563}
.${P}-legend li{display:flex;align-items:center;gap:6px;padding:2px 0}
.${P}-legend b{margin-left:auto;font-variant-numeric:tabular-nums}
.${P}-legend-h{display:flex;flex-wrap:wrap;gap:10px}
.${P}-legend i{width:8px;height:8px;border-radius:2px;display:inline-block;flex:0 0 auto}

/* Donut */
.${P}-donut{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.${P}-donut-wrap{position:relative;flex:0 0 auto;line-height:0}
.${P}-donut-mid{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.${P}-donut-side{flex:1 1 130px;min-width:0}

/* Slope */
.${P}-slope{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.${P}-slope-wrap{position:relative;flex:1 1 180px;height:var(--sh);min-width:150px}
.${P}-slope-wrap svg{width:100%;height:100%;overflow:visible}
.${P}-slope-av{position:absolute;right:-6px;transform:translateY(-50%)}
.${P}-slope-info{flex:1 1 120px;min-width:0}
.${P}-delta{font-size:16px;font-weight:800;color:#059669;margin-top:4px}
.${P}-delta span{font-size:11px;font-weight:600;color:#6b7280}

/* Share bars */
.${P}-sb{padding:8px 0;border-top:1px solid rgba(0,0,0,.06)}
.${P}-sb:first-child{border-top:0;padding-top:0}
.${P}-sb-head{display:flex;align-items:center;gap:10px;margin-bottom:6px;min-width:0}
.${P}-sb-row{display:flex;align-items:center;gap:8px;font-size:11px;color:#4b5563}
.${P}-sb-lbl{flex:0 0 46px}
.${P}-sb-row .${P}-track{flex:1 1 auto;margin-top:0}
.${P}-sb-v{flex:0 0 auto;font-weight:700;font-variant-numeric:tabular-nums}

/* Bubble map */
.${P}-bubwrap{position:relative;height:230px;margin-top:6px}
.${P}-bubwrap svg{position:absolute;inset:0;width:100%;height:100%}
.${P}-bub{position:absolute;transform:translate(-50%,50%)}

/* Skeleton */
.${P}-sk{border-radius:8px;background:linear-gradient(90deg,rgba(0,0,0,.06),rgba(0,0,0,.11),rgba(0,0,0,.06));
  background-size:200% 100%;animation:${P}-sh 1.3s linear infinite;height:110px;margin-top:8px}
@keyframes ${P}-sh{0%{background-position:200% 0}100%{background-position:-200% 0}}

.${P}-log{margin-top:12px;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
  background:#111827;color:#d1d5db;border-radius:8px;padding:10px;max-height:200px;overflow:auto;
  white-space:pre-wrap;word-break:break-word}

/* Animation is opt-in per render and always yields to the OS preference. */
.${P}-anim .${P}-fill{animation:${P}-w .7s cubic-bezier(.2,.8,.2,1) both}
.${P}-anim .${P}-pil-bar{animation:${P}-h .7s cubic-bezier(.2,.8,.2,1) both}
.${P}-anim .${P}-arc{animation:${P}-d .9s ease-out both}
@keyframes ${P}-w{from{width:0}}
@keyframes ${P}-h{from{height:0}}
@keyframes ${P}-d{from{stroke-dasharray:0 9999}}
@media (prefers-reduced-motion:reduce){
  .${P}-anim .${P}-fill,.${P}-anim .${P}-pil-bar,.${P}-anim .${P}-arc,.${P}-sk{animation:none}
}
@media (max-width:420px){
  .${P}-grid{grid-template-columns:1fr}
}
`;

// ── Factory ──────────────────────────────────────────────────────────────────

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class EngagementLeaderboard extends BaseBlockClass implements BaseBlock {
    constructor() { super(); }

    async renderBlock(container: HTMLElement) {
      const attr = (k: string): string => this.getAttribute(k) || "";
      const bool = (k: string, dflt: boolean): boolean => {
        const v = this.getAttribute(k);
        return v == null || v === "" ? dflt : v === "true";
      };
      const int = (k: string, dflt: number): number => {
        const n = parseInt(attr(k), 10);
        return isFinite(n) && n > 0 ? n : dflt;
      };

      const apiToken = attr("apitoken") || DEFAULT_API_TOKEN;
      const baseUrl = (attr("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
      const authMode = (attr("authmode") || "auto") as "auto" | "token" | "session";
      const debug = bool("debugmode", false);
      const animate = bool("animate", true);
      const autoWiden = bool("autowiden", true);
      const showPicker = bool("showwindowpicker", true);
      const showBubble = bool("showbubblemap", false);
      const showSample = bool("showsample", true);
      const topN = Math.max(1, Math.min(10, int("topn", 3)));
      const maxPosts = Math.min(1000, int("maxposts", 200));
      const cacheTtl = int("cachettl", 15) * 60000;

      const csv = (k: string): string[] =>
        attr(k).split(",").map(s => s.trim()).filter(Boolean);
      const exclude = new Set(csv("excludeuserids"));
      const channels = csv("channels");

      let metrics = ALL_METRICS.slice();
      const rawMetrics = attr("metrics");
      if (rawMetrics) {
        let picked: string[] = [];
        try { const j = JSON.parse(rawMetrics); if (Array.isArray(j)) picked = j.map(String); } catch (_) {
          picked = rawMetrics.split(",").map(s => s.trim());
        }
        const valid = picked.filter(m => (ALL_METRICS as string[]).indexOf(m) >= 0) as MetricId[];
        if (valid.length) metrics = valid;
      }

      let primary = attr("primarycolor") || DEFAULT_PRIMARY_COLOR;
      let accent = attr("accentcolor") || DEFAULT_ACCENT_COLOR;
      if (bool("usethemecolors", false) && apiToken && baseUrl) {
        const themed = await fetchThemeColors(baseUrl, apiToken);
        if (themed.primary) primary = themed.primary;
        if (themed.accent) accent = themed.accent;
      }

      const locale = detectLocale({
        configLocale: (widgetApi as any)?.getContentLanguage?.() || null,
        available: AVAILABLE_LOCALES,
      });
      const t = makeT(BUNDLES, locale);
      const rtl = isRtl(locale);

      // ── Debug log ──────────────────────────────────────────────────────────
      const logs: string[] = [];
      const dlog = (...args: any[]) => {
        const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
        logs.push(`${new Date().toISOString().slice(11, 19)}  ${line}`);
        if (debug) {
          const el = container.querySelector(`.${P}-log`);
          if (el) { el.textContent = logs.join("\n"); el.scrollTop = el.scrollHeight; }
        }
      };

      // ── Shell ──────────────────────────────────────────────────────────────
      let windowKey = (attr("timewindow") || "90d") as WindowKey;
      const customSince = attr("customsince");
      const customUntil = attr("customuntil");

      container.innerHTML = `<style>${CSS}</style>
        <div class="${P}-root" dir="${rtl ? "rtl" : "ltr"}"
             style="--sbel-primary:${esc(primary)};--sbel-accent:${esc(accent)}">
          <div class="${P}-bar">
            <h3 class="${P}-h">${esc(t("widget.title"))}</h3>
            <span class="${P}-badge ${P}-status" hidden></span>
            ${showPicker ? `<select class="${P}-sel ${P}-window" aria-label="${esc(t("window.custom"))}">
              ${(["all", "7d", "30d", "90d", "12m"] as WindowKey[]).map(k =>
                `<option value="${k}"${k === windowKey ? " selected" : ""}>${esc(t(`window.${k}`))}</option>`).join("")}
            </select>` : ""}
            <button class="${P}-btn ${P}-refresh" type="button">${esc(t("state.refresh"))}</button>
          </div>
          <div class="${P}-grid ${P}-body"></div>
          ${debug ? `<pre class="${P}-log"></pre>` : ""}
        </div>`;

      const root = container.querySelector(`.${P}-root`) as HTMLElement;
      const body = container.querySelector(`.${P}-body`) as HTMLElement;
      const status = container.querySelector(`.${P}-status`) as HTMLElement;
      const picker = container.querySelector(`.${P}-window`) as HTMLSelectElement | null;

      const setStatus = (text: string) => {
        status.textContent = text;
        status.hidden = !text;
      };

      const skeleton = () => {
        body.innerHTML = metrics.map(() =>
          `<div class="${P}-card"><div class="${P}-sk"></div></div>`).join("");
      };

      // ── Data ───────────────────────────────────────────────────────────────
      const cacheKey = `${CACHE_PREFIX}${baseUrl}|${channels.join(",")}|${maxPosts}`;
      // The window is deliberately *not* part of the key: raw events are cached
      // un-windowed so changing the period re-filters in memory with no
      // requests. Rankings are the exception — they can only be filtered
      // server-side — so they are cached per window.
      const rankingCache = new Map<string, PostRanking[]>();
      let raw: RawData | null = null;
      let isSample = false;

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

      const rankingsFor = async (since: Date | undefined, until: Date | undefined): Promise<PostRanking[]> => {
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

      // ── Render ─────────────────────────────────────────────────────────────
      const render = async () => {
        if (!raw) return;
        const now = Date.now();
        const win = resolveWindow(windowKey, now, customSince, customUntil);

        const wantsAdvocacy = metrics.indexOf("advocacy") >= 0;
        let rankings = raw.rankings;
        let rankingsAll = raw.rankings;
        if (wantsAdvocacy && !isSample) {
          rankingsAll = await rankingsFor(undefined, undefined);
          rankings = windowKey === "all"
            ? rankingsAll
            : await rankingsFor(new Date(win.since), new Date(win.until));
        }

        const tiles = buildTiles({
          raw, window: win, weights: DEFAULT_WEIGHTS, topN, metrics, exclude,
          autoWiden, rankings, rankingsAllTime: rankingsAll, t,
          colors: {
            comment: primary,
            reaction: accent,
            post: "#F59E0B",
            breadth: "#10B981",
          },
        });

        const cards = tiles.map(tile => card(tile, t)).join("");
        const bubble = showBubble && !isSample ? bubbleCard(raw, win, exclude, t) : "";
        body.innerHTML = cards + bubble || `<div class="${P}-empty">${esc(t("state.empty"))}</div>`;
        body.classList.toggle(`${P}-anim`, animate);

        const parts: string[] = [];
        if (isSample) parts.push(t("state.sample"));
        if (raw.skippedPosts) parts.push(t("state.partial"));
        setStatus(parts.join(" · "));
        dlog(`rendered ${tiles.length} tiles for window ${windowKey}`);
      };

      const bubbleCard = (
        d: RawData, win: { since: number; until: number }, ex: Set<string>, tr: (k: string) => string,
      ): string => {
        const stats = aggregate(d.events, win, ex);
        const people = new Map(d.people.map(p => [p.id, p]));
        const points = [];
        for (const [id, s] of stats) {
          const p = people.get(id);
          const vol = activityScore(s);
          if (!p || vol <= 0) continue;
          points.push({ entry: { person: p, value: vol }, x: s.distinctPosts, y: vol, size: vol });
        }
        points.sort((a, b) => b.size - a.size);
        const svg = bubbleMap(points.slice(0, 24), `${tr("metric.mostActive")} — ${tr("part.breadth")}`);
        if (!svg) return "";
        return `<div class="${P}-card ${P}-card-wide">
          <h4 class="${P}-ct">${esc(tr("metric.mostEngaged"))}</h4>
          <p class="${P}-cs">${esc(tr("part.breadth"))} × ${esc(tr("unit.actions"))}</p>
          ${svg}
        </div>`;
      };

      // ── Load ───────────────────────────────────────────────────────────────
      const load = async (force: boolean) => {
        skeleton();
        setStatus("");

        if (!baseUrl || (!apiToken && authMode === "token")) {
          if (showSample) {
            raw = sampleRaw(); isSample = true;
            await render();
            setStatus(t("state.sample"));
          } else {
            body.innerHTML = `<div class="${P}-empty">${esc(t("state.configure"))}</div>`;
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
          raw = await loadRawData({
            baseUrl, apiToken, authMode, maxPosts, concurrency: 4, log: dlog,
          });
          isSample = false;
          writeCache(raw);
          await render();
        } catch (e: any) {
          dlog("load failed:", e?.message || String(e));
          if (showSample) {
            raw = sampleRaw(); isSample = true;
            await render();
          } else {
            body.innerHTML = `<div class="${P}-empty">${esc(t("state.error"))}
              <br><button class="${P}-btn ${P}-retry" type="button">${esc(t("state.retry"))}</button></div>`;
            const retry = body.querySelector(`.${P}-retry`) as HTMLButtonElement | null;
            retry?.addEventListener("click", () => void load(true));
          }
        }
      };

      picker?.addEventListener("change", () => {
        windowKey = picker.value as WindowKey;
        void render();
      });
      (container.querySelector(`.${P}-refresh`) as HTMLButtonElement | null)
        ?.addEventListener("click", () => {
          rankingCache.clear();
          try { sessionStorage.removeItem(cacheKey); } catch (_) { /* ignore */ }
          void load(true);
        });

      // Non-null assertion avoided: root is guaranteed by the innerHTML above.
      if (root && rtl) root.setAttribute("dir", "rtl");

      await load(false);
    }

    static get observedAttributes() {
      return [
        "apitoken", "baseurl", "authmode", "timewindow", "customsince", "customuntil",
        "autowiden", "showwindowpicker", "metrics", "topn", "channels", "excludeuserids",
        "maxposts", "cachettl", "showbubblemap", "animate", "usethemecolors",
        "primarycolor", "accentcolor", "showsample", "debugmode",
      ];
    }
  };
};

function card(tile: Tile, t: (k: string) => string): string {
  const inner = tile.entries.length
    ? renderChart(tile)
    : `<div class="${P}-empty">${esc(t("state.emptyTile"))}</div>`;
  // Each tile labels its own period: share data and person data have very
  // different recency, so a single global header would misreport one of them.
  const note = tile.widened ? `<div class="${P}-note">${esc(t("window.widened"))}</div>` : "";
  return `<div class="${P}-card" data-metric="${esc(tile.id)}">
    <h4 class="${P}-ct">${esc(tile.title)}</h4>
    <p class="${P}-cs">${esc(tile.subtitle)}</p>
    ${note}${inner}
  </div>`;
}

// ── Block registration ───────────────────────────────────────────────────────

const blockDefinition: BlockDefinition = {
  name: "engagement-leaderboard",
  label: "Engagement Leaderboard",
  attributes: [
    "apitoken", "baseurl", "authmode", "timewindow", "customsince", "customuntil",
    "autowiden", "showwindowpicker", "metrics", "topn", "channels", "excludeuserids",
    "maxposts", "cachettl", "showbubblemap", "animate", "usethemecolors",
    "primarycolor", "accentcolor", "showsample", "debugmode",
  ],
  factory,
  configurationSchema,
  uiSchema,
  blockLevel: "block",
  iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzBFQTVFOSIvPjxnIGZpbGw9IiNmZmYiPjxyZWN0IHg9IjM4IiB5PSI5MCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjQ0IiByeD0iNCIvPjxyZWN0IHg9IjcxIiB5PSI2NCIgd2lkdGg9IjI4IiBoZWlnaHQ9IjcwIiByeD0iNCIvPjxyZWN0IHg9IjEwNCIgeT0iMTA0IiB3aWR0aD0iMjgiIGhlaWdodD0iMzAiIHJ4PSI0Ii8+PGNpcmNsZSBjeD0iODUiIGN5PSI0MiIgcj0iMTQiLz48L2c+PC9zdmc+",
};

window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" } as ExternalBlockDefinition);
