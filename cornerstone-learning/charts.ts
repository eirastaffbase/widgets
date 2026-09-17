// ─────────────────────────────────────────────────────────────────────────────
// Charts — hand-rolled HTML/CSS/SVG, no chart library.
//
// The deciding constraint is the avatar: every row is a person's photo, and
// photos 404 often enough that a gradient-initials fallback is mandatory. That
// fallback is an `<img onerror>`, which only works for real DOM images — so
// canvas is out.
//
// The second constraint is the reorder. A bar race has to visibly *race*: rows
// must travel to their new rank when the metric changes. That needs stable DOM
// nodes with measurable boxes (FLIP), which rules out re-rendering the list
// from scratch. So every row carries a `data-key`, and the shell moves nodes
// rather than replacing them.
// ─────────────────────────────────────────────────────────────────────────────

import { BADGE_ICON, METRIC_ICON, icon } from "./icons";
import { S, plural } from "./strings";
import { metricValue } from "./demo";
import { SPARK_WEEKS } from "./catalogue";
import { ChartKind, Completion, Learner, MetricId, Person } from "./types";

export const P = "csl"; // class prefix

export function esc(s: string): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function initials(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return (first + last).toUpperCase();
}

/** Whole numbers stay whole; hours keep one decimal. Locale-formatted so
 *  Spanish gets its comma decimal separator. */
export const fmt = (n: number, decimals = 0): string =>
  Number(n).toLocaleString("es", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const METRICS: MetricId[] = ["courses", "hours", "xp", "streak"];

export const METRIC_LABEL: { [K in MetricId]: string } = {
  courses: S.metricCourses,
  hours: S.metricHours,
  xp: S.metricXp,
  streak: S.metricStreak,
};

/**
 * Each metric is drawn as the thing it actually is.
 *
 * Four bar charts with different numbers in them would make the switcher a
 * relabelling exercise. A count is a ranking (bars); hours are a composition
 * (one segment per course, so you can see *what* the time went into); XP is an
 * accumulation over time, and the only metric where the interesting question is
 * "how do I compare" rather than "who won" (lines, with the viewer's own line
 * picked out); a streak is a calendar (a grid of weeks).
 */
export const CHART_KIND: { [K in MetricId]: ChartKind } = {
  courses: "race",
  hours: "stack",
  xp: "lines",
  streak: "heat",
};

export const CAPTION: { [K in MetricId]: string } = {
  courses: S.capCourses,
  hours: S.capHours,
  xp: S.capXp,
  streak: S.capStreak,
};

/** `race`, `stack` and `heat` are the same `<li data-key>` rows with different
 *  middles, so switching between them can move nodes instead of replacing them.
 *  `lines` has no rows, so it is the one transition that rebuilds. */
export const isRowChart = (m: MetricId): boolean => CHART_KIND[m] !== "lines";

/** Hours are the only fractional metric, so formatting is metric-dependent. */
export const formatMetric = (l: Learner, m: MetricId): string =>
  m === "hours" ? fmt(l.minutes / 60, 1) : fmt(metricValue(l, m));

export const metricUnit = (l: Learner, m: MetricId): string =>
  m === "courses" ? plural(l.courses, S.unitCoursesOne, S.unitCourses)
    : m === "hours" ? S.unitHours
      : m === "xp" ? S.unitXp
        : plural(l.streak, S.unitStreakOne, S.unitStreak);

/** A stable identity per row, so FLIP can pair old and new positions. Comes
 *  from the learner, not the person: demo peers share a fixed name pool, and
 *  two rows with the same key would swap each other's drilldowns. */
export const keyOf = (l: Learner): string => l.key;

// ── Avatar ───────────────────────────────────────────────────────────────────

/**
 * Wrapped in `internal-link clickable` + `/profile/<id>` + `data-uid`, which is
 * the markup Staffbase's own author links use — that is what attaches the
 * native profile hovercard to a chart node instead of leaving it an inert
 * image. Demo peers get no link, because there is no profile to open.
 */
export function avatar(p: Person, size: number, cls = ""): string {
  const ini = esc(initials(p.name));
  const style = `--av:${size}px`;
  const inner = p.avatar
    ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('${P}-av-fb');this.remove()">`
    : "";
  const body = `<span class="${P}-av ${cls}${p.avatar ? "" : ` ${P}-av-fb`}" style="${style}" data-ini="${ini}">${inner}</span>`;
  if (!p.id) return body;
  return `<a class="${P}-avlink internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}" tabindex="-1" aria-label="${esc(p.name)}">${body}</a>`;
}

function personName(p: Person, cls: string): string {
  return p.id
    ? `<a class="${cls} internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}">${esc(p.name)}</a>`
    : `<span class="${cls}">${esc(p.name)}</span>`;
}

// ── Switcher ─────────────────────────────────────────────────────────────────

export function switcher(active: MetricId): string {
  const tabs = METRICS.map(m => `
    <button type="button" class="${P}-tab${m === active ? ` ${P}-tab-on` : ""}"
            data-metric="${m}" role="tab" aria-selected="${m === active}">
      <span class="${P}-tab-ico">${icon(METRIC_ICON[m], 15)}</span>
      <span class="${P}-tab-lbl">${esc(METRIC_LABEL[m])}</span>
    </button>`).join("");
  return `<div class="${P}-tabs" role="tablist" aria-label="${esc(S.field)}">
    ${tabs}<span class="${P}-tab-ink" aria-hidden="true"></span>
  </div>`;
}

// ── Tier bar ─────────────────────────────────────────────────────────────────

export function tierBar(l: Learner): string {
  const t = l.tier;
  const pct = Math.round(t.fraction * 100);
  const caption = t.next ? S.tierNext(t.remaining, t.next.label) : S.tierMax;
  return `<div class="${P}-tier" data-tier="${t.tier.id}">
    <div class="${P}-tier-head">
      <span class="${P}-tier-name">${icon("medal", 13)} ${esc(t.tier.label)}</span>
      <span class="${P}-tier-cap">${esc(caption)}</span>
    </div>
    <div class="${P}-tier-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="${pct}" aria-label="${esc(S.tierLabel)} ${esc(t.tier.label)}">
      <span class="${P}-tier-fill" style="--pct:${pct}%"></span>
    </div>
  </div>`;
}

// ── Badges ───────────────────────────────────────────────────────────────────

export function badgeChips(l: Learner, compact = false): string {
  if (!l.badges.length) {
    return compact ? "" : `<span class="${P}-nobadge">${esc(S.noBadges)}</span>`;
  }
  const chips = l.badges.map(b => `
    <span class="${P}-badge" title="${esc(b.description)}">
      ${icon(BADGE_ICON[b.id], compact ? 12 : 13)}${compact ? "" : `<span>${esc(b.label)}</span>`}
    </span>`).join("");
  return `<div class="${P}-badges${compact ? ` ${P}-badges-c` : ""}">${chips}</div>`;
}

// ── Streak spark ─────────────────────────────────────────────────────────────

/** Six weekly buckets as squares rather than a line: the numbers are 0–3, and a
 *  line chart over integers that small reads as noise. */
export function streakSpark(l: Learner): string {
  const max = Math.max(1, ...l.spark);
  const cells = l.spark.map((v, i) => {
    const lvl = v === 0 ? 0 : Math.ceil((v / max) * 3);
    return `<span class="${P}-spark-c" data-lvl="${lvl}" style="--i:${i}" title="${v} ${esc(plural(v, S.unitCoursesOne, S.unitCourses))}"></span>`;
  }).join("");
  return `<div class="${P}-spark" aria-hidden="true">${cells}</div>`;
}

// ── Podium ───────────────────────────────────────────────────────────────────

/**
 * The top three at full scale.
 *
 * Ordered 2–1–3 visually (a real podium) but 1–2–3 in the DOM, so keyboard and
 * screen-reader order still runs by rank; CSS `order` does the rearranging.
 */
export function podium(top: Learner[], metric: MetricId, showTier: boolean, showBadges: boolean): string {
  if (!top.length) return "";
  const cards = top.slice(0, 3).map((l, i) => {
    const rank = i + 1;
    const av = rank === 1 ? 92 : 68;
    const meta = [l.person.position, l.person.department].filter(Boolean).join(" · ");
    return `<div class="${P}-pod ${P}-pod-${rank}" data-key="${esc(keyOf(l))}" style="--i:${i}"${l.person.isViewer ? ` data-you="1"` : ""}>
      <div class="${P}-pod-avwrap">
        ${avatar(l.person, av, `${P}-av-hero`)}
        <span class="${P}-pod-rank">${rank === 1 ? icon("crown", 14) : rank}</span>
      </div>
      <div class="${P}-pod-nm">${personName(l.person, `${P}-pod-nmlink`)}${l.person.isViewer ? ` <span class="${P}-you">${esc(S.you)}</span>` : ""}</div>
      ${meta ? `<div class="${P}-pod-meta">${esc(meta)}</div>` : ""}
      <div class="${P}-pod-num">
        <span class="${P}-num" data-count="${metricValue(l, metric)}" data-dec="${metric === "hours" ? 1 : 0}">${formatMetric(l, metric)}</span>
        <span class="${P}-unit">${esc(metricUnit(l, metric))}</span>
      </div>
      ${showTier ? tierBar(l) : ""}
      ${showBadges ? badgeChips(l, true) : ""}
    </div>`;
  }).join("");
  return `<div class="${P}-podium">${cards}</div>`;
}

// ── Row charts: race, stack, heat ────────────────────────────────────────────

/** A week's label, counting back from this one. Used by both the stacked bar
 *  tooltips and the heatmap cells. */
const weekTitle = (i: number): string => S.weekLabel(SPARK_WEEKS - 1 - i);

/** Bars are scaled against the leader with a floor, so a runaway winner does not
 *  flatten everyone else into invisible slivers. */
const barWidth = (v: number, max: number): number =>
  Math.max(6, max > 0 ? (v / max) * 100 : 0);

/** Courses view: one solid bar per person, length = rank position. */
function plainBar(l: Learner, metric: MetricId, max: number): string {
  const w = barWidth(metricValue(l, metric), max);
  return `<div class="${P}-bar"><span class="${P}-bar-fill" style="--w:${w.toFixed(2)}%"></span></div>`;
}

/**
 * Hours view: the same bar, cut into one segment per course.
 *
 * The total length still ranks people, so nothing is lost — but the segments
 * answer the question a raw hour count cannot, which is where the time went.
 * Segments are ordered longest-first so the bar reads as a composition rather
 * than as a jagged history, and required courses get the accent so compliance
 * is visible at a glance.
 */
function stackedBar(l: Learner, max: number): string {
  const totalHours = l.minutes / 60;
  const w = barWidth(totalHours, max);
  const segs = l.completions
    .slice()
    .sort((a, b) => b.course.minutes - a.course.minutes)
    .map((c, i) => {
      const share = l.minutes > 0 ? (c.course.minutes / l.minutes) * 100 : 0;
      const dur = c.course.minutes >= 60
        ? `${fmt(c.course.minutes / 60, c.course.minutes % 60 ? 1 : 0)} ${S.unitHours}`
        : `${c.course.minutes} min`;
      return `<span class="${P}-seg" style="--s:${share.toFixed(2)}%;--i:${i}"`
        + ` data-req="${c.course.required}" data-type="${esc(c.course.type)}"`
        + ` title="${esc(c.course.title)} · ${esc(dur)}"></span>`;
    }).join("");
  return `<div class="${P}-bar"><div class="${P}-bar-stack" style="--w:${w.toFixed(2)}%">${segs}</div></div>`;
}

/**
 * Streak view: six weekly cells per person.
 *
 * A streak is a statement about a calendar, and the number alone ("4 semanas")
 * hides whether those weeks were recent. The grid shows the run itself — and
 * shows the gaps, which is what makes a broken streak legible.
 *
 * Levels are absolute (1 / 2 / 3+ courses), not scaled to each person's own
 * busiest week. Per-row normalisation would make the darkest cell mean "two
 * courses" on one line and "five" on the next, which is exactly the comparison
 * a grid of identical squares invites you to make.
 */
function heatCells(l: Learner): string {
  const cells = l.spark.map((v, i) => {
    const lvl = v === 0 ? 0 : v === 1 ? 1 : v === 2 ? 2 : 3;
    return `<span class="${P}-heat-c" data-lvl="${lvl}" style="--i:${i}"`
      + ` title="${esc(weekTitle(i))} · ${v} ${esc(plural(v, S.unitCoursesOne, S.unitCourses))}"></span>`;
  }).join("");
  return `<div class="${P}-heat">${cells}</div>`;
}

/** The middle of a row — the only part that differs between the three row
 *  charts. Kept separate so a metric switch can swap it in place and leave the
 *  row node (and any open drilldown) exactly where it is. */
export function rowBody(
  l: Learner, metric: MetricId, max: number,
  opts: { badges: boolean; streak: boolean },
): string {
  const kind = CHART_KIND[metric];
  const v = metricValue(l, metric);
  const middle = kind === "stack" ? stackedBar(l, max)
    : kind === "heat" ? heatCells(l)
      : plainBar(l, metric, max);
  return `<div class="${P}-row-top">
      ${personName(l.person, `${P}-row-nm`)}
      ${l.person.isViewer ? `<span class="${P}-you">${esc(S.you)}</span>` : ""}
      <span class="${P}-row-val">
        <span class="${P}-num" data-count="${v}" data-dec="${metric === "hours" ? 1 : 0}">${formatMetric(l, metric)}</span>
        <span class="${P}-unit">${esc(metricUnit(l, metric))}</span>
      </span>
    </div>
    ${middle}
    <div class="${P}-row-sub">
      ${opts.streak && l.streak > 0 ? `<span class="${P}-streak">${icon("flame", 12)}${l.streak}</span>` : ""}
      ${opts.badges ? badgeChips(l, true) : ""}
    </div>`;
}

/**
 * One row.
 *
 * `data-key` is what the shell's FLIP and drilldown read; the row renders its
 * final width and value inline so a dead script still shows a correct, static
 * chart.
 */
export function raceRow(
  l: Learner, rank: number, max: number, metric: MetricId,
  opts: { drilldown: boolean; badges: boolean; streak: boolean },
): string {
  const key = esc(keyOf(l));
  const ddId = `${P}-dd-${key.replace(/[^\w-]/g, "_")}`;
  return `<li class="${P}-row" data-key="${key}" style="--i:${rank - 1}"${l.person.isViewer ? ` data-you="1"` : ""}>
    <div class="${P}-row-main"${opts.drilldown ? ` role="button" tabindex="0" aria-expanded="false" aria-controls="${ddId}"` : ""}>
      <span class="${P}-rank">${rank}</span>
      ${avatar(l.person, 34)}
      <div class="${P}-row-body">${rowBody(l, metric, max, opts)}</div>
      ${opts.drilldown ? `<span class="${P}-row-chev" aria-hidden="true">${icon("chevron", 16)}</span>` : ""}
    </div>
    ${opts.drilldown ? `<div class="${P}-dd" id="${ddId}" hidden></div>` : ""}
  </li>`;
}

export function race(
  learners: Learner[], metric: MetricId,
  opts: { drilldown: boolean; badges: boolean; streak: boolean },
): string {
  if (!learners.length) return "";
  const max = Math.max(...learners.map(l => metricValue(l, metric)), 0);
  const rows = learners.map((l, i) => raceRow(l, i + 1, max, metric, opts)).join("");
  return `<ol class="${P}-race" data-kind="${CHART_KIND[metric]}" aria-label="${esc(S.field)}">${rows}</ol>`;
}

// ── XP: cumulative lines, you against the field ──────────────────────────────

const LW = 640, LH = 210;           // viewBox; scaled to the container by CSS
const PAD = { l: 38, r: 74, t: 16, b: 26 };

/** Round a maximum up to something a person would choose for an axis, so the
 *  top gridline reads 400 rather than 387. */
function niceMax(v: number): number {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * The XP view: every learner's cumulative XP over the last six weeks, drawn as
 * lines on shared axes.
 *
 * This is the one view that is not about the podium. Bars answer "who is
 * winning"; the question people actually have about their own XP is "where am
 * I against everyone else, and am I gaining or falling behind" — which is a
 * slope, and needs a shared time axis to be visible at all.
 *
 * So the viewer's line is the subject: drawn last (on top), thicker, in the
 * accent colour, with points and an end label. The leaders are drawn in the
 * primary colour so there is something to measure against, and everyone else is
 * deliberately faint — context, not clutter. Hovering any line brings it
 * forward; clicking opens that person's courses underneath.
 */
export function lines(learners: Learner[], viewerKey: string): string {
  if (!learners.length) return "";
  const weeks = Math.max(2, learners[0].series.length);
  const top = niceMax(Math.max(...learners.map(l => l.series[l.series.length - 1] || 0), 1));

  const x = (i: number) => PAD.l + (i / (weeks - 1)) * (LW - PAD.l - PAD.r);
  const y = (v: number) => LH - PAD.b - (Math.min(v, top) / top) * (LH - PAD.t - PAD.b);

  const grid = [0, 0.5, 1].map(f => {
    const gy = y(top * f).toFixed(1);
    return `<line class="${P}-grid" x1="${PAD.l}" y1="${gy}" x2="${LW - PAD.r}" y2="${gy}"/>`
      + `<text class="${P}-ytick" x="${PAD.l - 8}" y="${gy}" text-anchor="end" dominant-baseline="middle">${fmt(Math.round(top * f))}</text>`;
  }).join("");

  const xticks = learners[0].series.map((_, i) =>
    `<text class="${P}-xtick" x="${x(i).toFixed(1)}" y="${LH - PAD.b + 15}" text-anchor="middle">${esc(weekTitle(i))}</text>`
  ).join("");

  // Leaders by final XP, so "the lines you are chasing" are the ones drawn
  // solidly rather than an arbitrary three.
  const byXp = learners.slice().sort((a, b) =>
    (b.series[b.series.length - 1] || 0) - (a.series[a.series.length - 1] || 0));
  const leaders = new Set(byXp.slice(0, 3).map(l => keyOf(l)));

  const draw = (l: Learner): string => {
    const key = keyOf(l);
    const you = key === viewerKey;
    const role = you ? "you" : leaders.has(key) ? "top" : "peer";
    const pts = l.series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const d = `M${pts.join("L")}`;
    const last = l.series[l.series.length - 1] || 0;
    const dots = you || role === "top"
      ? l.series.map((v, i) =>
        `<circle class="${P}-ln-dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${you ? 3.4 : 2.6}"/>`).join("")
      : "";
    const label = you || role === "top"
      ? `<text class="${P}-ln-lbl" x="${(LW - PAD.r + 8).toFixed(1)}" y="${y(last).toFixed(1)}" dominant-baseline="middle">`
        + `${esc(you ? S.you : l.person.name.split(" ")[0])} · ${fmt(last)}</text>`
      : "";
    return `<g class="${P}-lngrp" data-key="${esc(key)}" data-role="${role}" tabindex="0"
      role="button" aria-label="${esc(l.person.name)} · ${fmt(last)} ${esc(S.unitXp)}">
      <title>${esc(l.person.name)} · ${fmt(last)} ${esc(S.unitXp)}</title>
      <path class="${P}-ln-hit" d="${d}"/>
      <path class="${P}-ln" d="${d}"/>
      ${dots}${label}
    </g>`;
  };

  // Painter's order: faint peers first, leaders over them, the viewer on top —
  // SVG has no z-index, so the order *is* the stacking.
  const ordered = learners.slice().sort((a, b) => {
    const score = (l: Learner) => keyOf(l) === viewerKey ? 2 : leaders.has(keyOf(l)) ? 1 : 0;
    return score(a) - score(b);
  });

  const legend = `<div class="${P}-lgd">
    ${viewerKey ? `<span class="${P}-lgd-i" data-role="you">${esc(S.lineYou)}</span>` : ""}
    <span class="${P}-lgd-i" data-role="top">${esc(S.lineLeader)}</span>
    <span class="${P}-lgd-i" data-role="peer">${esc(S.lineOthers)}</span>
    <span class="${P}-lgd-hint">${esc(S.lineHint)}</span>
  </div>`;

  return `<div class="${P}-lines">
    <svg viewBox="0 0 ${LW} ${LH}" class="${P}-lines-svg" role="img"
         aria-label="${esc(S.capXp)}" preserveAspectRatio="xMidYMid meet">
      ${grid}${xticks}
      ${ordered.map(draw).join("")}
    </svg>
    ${legend}
    <div class="${P}-lines-dd" hidden></div>
  </div>`;
}

// ── Catch-up ─────────────────────────────────────────────────────────────────

export type Gap = { target: Learner; gap: number; rank: number; total: number } | null;

/** The gap sentence, in the units of the metric being shown. Recomputed on
 *  every metric switch, because "te faltan 2" means nothing without knowing two
 *  of what. */
export function gapText(info: Gap, metric: MetricId): string {
  if (!info) return S.ctaGeneric;
  if (info.gap <= 0 || info.rank === 1) return S.ctaLeading;
  const name = info.target.person.name.split(" ")[0];
  return metric === "hours" ? S.ctaGapHours(fmt(info.gap, 1), name)
    : metric === "xp" ? S.ctaGapXp(Math.ceil(info.gap), name)
      : metric === "streak" ? S.ctaGapStreak(Math.ceil(info.gap), name)
        : S.ctaGapCourses(Math.ceil(info.gap), name);
}

/**
 * The call to action.
 *
 * A leaderboard that only ranks people is a scoreboard; the point of gamifying
 * learning is the next action, so the widget ends on one. The sentence above
 * the button is specific — it names the person directly ahead of the viewer and
 * the exact gap in the current metric — because "haz más cursos" is advice,
 * while "te faltan 2 cursos para alcanzar a Lucía" is a target.
 */
export function catchUp(info: Gap, metric: MetricId, label: string, href: string): string {
  const rankChip = info ? `<span class="${P}-cta-rank">${esc(S.ctaRankOf(info.rank, info.total))}</span>` : "";
  const btn = href
    ? `<a class="${P}-cta-btn" href="${esc(href)}" data-cta="1">`
    : `<button type="button" class="${P}-cta-btn" data-cta="1">`;
  const btnEnd = href ? `</a>` : `</button>`;
  return `<div class="${P}-cta" data-done="${info && info.rank === 1 ? "1" : "0"}">
    <span class="${P}-cta-ico">${icon("rocket", 20)}</span>
    <div class="${P}-cta-txt">
      <div class="${P}-cta-title">${esc(S.ctaTitle)} ${rankChip}</div>
      <div class="${P}-cta-gap">${esc(gapText(info, metric))}</div>
    </div>
    ${btn}<span>${esc(label || S.ctaAction)}</span>${icon("arrow", 15)}${btnEnd}
  </div>`;
}

// ── Drilldown ────────────────────────────────────────────────────────────────

/** Built on demand rather than up front: seven course cards per person across a
 *  dozen rows is a lot of hidden DOM (and a lot of Unsplash requests) for a
 *  panel most viewers never open. */
export function drilldown(l: Learner): string {
  if (!l.completions.length) {
    return `<div class="${P}-dd-empty">${esc(S.noCompletions)}</div>`;
  }
  const cards = l.completions.map((c: Completion, i) => {
    const t = c.course;
    const typeLabel = t.type === "event" ? S.typeEvent : S.typeOnline;
    const dur = t.minutes >= 60
      ? `${fmt(t.minutes / 60, t.minutes % 60 ? 1 : 0)} ${S.unitHours}`
      : `${t.minutes} min`;
    return `<div class="${P}-cc" style="--i:${i}">
      <div class="${P}-cc-img">
        <img src="${esc(t.image)}" alt="" loading="lazy"
             onerror="this.parentElement.classList.add('${P}-cc-noimg');this.remove()">
        ${t.required ? `<span class="${P}-cc-req">${esc(S.required)}</span>` : ""}
      </div>
      <div class="${P}-cc-body">
        <div class="${P}-cc-title">${esc(t.title)}</div>
        <div class="${P}-cc-meta">
          <span>${icon(t.type === "event" ? "calendar" : "headphones", 12)} ${esc(typeLabel)}</span>
          <span>${icon("clock", 12)} ${esc(dur)}</span>
          <span>${esc(S.modules(t.modules.length))}</span>
        </div>
        <span class="${P}-cc-flag" data-ok="${c.onTime}">
          ${icon(c.onTime ? "check" : "clock", 12)} ${esc(c.onTime ? S.onTime : S.late)}
        </span>
      </div>
    </div>`;
  }).join("");

  return `<div class="${P}-dd-in">
    <div class="${P}-dd-head">${esc(S.completedCourses)} · ${esc(String(l.completions.length))}</div>
    <div class="${P}-cc-grid">${cards}</div>
    ${badgeChips(l)}
  </div>`;
}

// ── Header ───────────────────────────────────────────────────────────────────

export function header(brandLabel: string, metric: MetricId, showSwitcher: boolean): string {
  return `<div class="${P}-head">
    <div class="${P}-head-txt">
      <h3 class="${P}-title">${icon("trophy", 18)} ${esc(S.title)}</h3>
      <p class="${P}-sub">${esc(S.subtitle)}</p>
    </div>
    <div class="${P}-head-side">
      ${brandLabel ? `<span class="${P}-brandchip">${icon("users", 12)} ${esc(brandLabel)}</span>` : ""}
      ${showSwitcher ? switcher(metric) : ""}
    </div>
  </div>`;
}

export function footnote(): string {
  return `<div class="${P}-note">${icon("star", 11)} ${esc(S.demoNote)}</div>`;
}

/** A one-line label above each chart. The shapes change between metrics, so the
 *  view says what it is showing rather than leaving the viewer to infer it from
 *  a switch they may not have noticed pressing. */
export function caption(metric: MetricId): string {
  const glyph = CHART_KIND[metric] === "lines" ? "trend"
    : CHART_KIND[metric] === "heat" ? "grid"
      : CHART_KIND[metric] === "stack" ? "layers" : "book";
  return `<div class="${P}-cap">${icon(glyph, 12)} ${esc(CAPTION[metric])}</div>`;
}
