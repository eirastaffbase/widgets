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

// ── XP: cumulative curves, you against the field ─────────────────────────────

const LW = 640, LH = 210;           // viewBox; scaled to the container by CSS
const PAD = { l: 14, r: 92, t: 22, b: 30 };

/**
 * A playful palette for the field.
 *
 * Every line being one of two brand colours made the chart read as a report.
 * Giving each person their own hue turns it into a race you can follow with
 * your eyes. Hues are dealt out by position rather than hashed per person, so
 * no two people in a field of ten share a colour — a hash collision would put
 * two identical curves on the chart, which is exactly the confusion the colour
 * was added to prevent.
 */
const LINE_HUES = [268, 200, 330, 42, 160, 15, 288, 96, 220, 350];

/** Where in the palette the field starts. Hashing the leader's key means two
 *  different fields don't both open on purple, while the same field opens the
 *  same way every time. */
function hueStart(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % LINE_HUES.length;
}

/**
 * Catmull-Rom through the points, converted to cubic béziers.
 *
 * Straight segments made six weeks of XP look like a stock ticker. A curve
 * reads as a journey, which is the feeling the metric is supposed to have.
 *
 * The control points are clamped to each segment's own vertical range *and*
 * ordered within it: the series is cumulative and therefore never decreases, so
 * the drawn curve must never decrease either. An unclamped spline will happily
 * dip below a flat stretch and draw someone losing XP, and clamping the two
 * control points independently can still leave them out of order, which puts a
 * small wobble in an otherwise flat week.
 */
function curve(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i];
    const p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
    // y decreases as XP rises, so p2[1] is the floor and p1[1] the ceiling.
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6, lo, hi);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clamp(clamp(p2[1] - (p3[1] - p1[1]) / 6, lo, hi), lo, c1y);
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)}`
      + ` ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Keep end medallions from stacking on top of each other when two people
 *  finish the six weeks a few XP apart. */
function spread(ys: number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  let prev = -Infinity;
  for (const o of order) {
    o.y = Math.max(o.y, prev + gap);
    prev = o.y;
  }
  const over = order.length ? order[order.length - 1].y - hi : 0;
  if (over > 0) for (const o of order) o.y -= over;
  const out = ys.slice();
  for (const o of order) out[o.i] = Math.max(lo, o.y);
  return out;
}

let uidSeq = 0;

/**
 * The XP view: every learner's cumulative XP over the last six weeks.
 *
 * This is the one view that is not about the podium. Bars answer "who is
 * winning"; the question people actually have about their own XP is "where am
 * I against everyone else, and am I gaining or falling behind" — which is a
 * slope, and needs a shared time axis to be visible at all.
 *
 * Everything that made it look like an analytics dashboard is gone: no
 * gridlines, no value axis, no tick marks. A gridline exists so you can read an
 * exact number off a line, and nobody needs their XP to three significant
 * figures — the number they want is their own, so it rides at the end of their
 * own curve on a coloured medallion instead.
 *
 * The viewer's curve is the subject: drawn last (on top), thickest, with a
 * glowing gradient stroke, a soft area fill underneath and a pulsing ring on
 * its leading dot. Everyone else is a friendly colour at lower weight.
 * Hovering any curve brings it forward; clicking opens that person's courses.
 */
export function lines(learners: Learner[], viewerKey: string): string {
  if (!learners.length) return "";
  const weeks = Math.max(2, learners[0].series.length);
  const top = Math.max(...learners.map(l => l.series[l.series.length - 1] || 0), 1);
  const uid = `${P}-x${++uidSeq}`;
  const h0 = hueStart(keyOf(learners[0]));
  const hue = new Map(learners.map((l, i) => [keyOf(l), LINE_HUES[(h0 + i) % LINE_HUES.length]]));
  const hueOf = (k: string) => hue.get(k) || LINE_HUES[0];

  const x = (i: number) => PAD.l + (i / (weeks - 1)) * (LW - PAD.l - PAD.r);
  // A little headroom above the leader so the top curve never grazes the edge.
  const y = (v: number) => LH - PAD.b - (Math.min(v, top) / top) * (LH - PAD.t - PAD.b) * 0.92;

  const xticks = learners[0].series.map((_, i) =>
    `<text class="${P}-xtick" x="${x(i).toFixed(1)}" y="${LH - PAD.b + 17}" text-anchor="middle"`
    + ` data-i="${i}" style="--i:${i}">${esc(weekTitle(i))}</text>`
  ).join("");

  // Leaders by final XP, so "the curves you are chasing" are the ones that
  // carry a name rather than an arbitrary three.
  const byXp = learners.slice().sort((a, b) =>
    (b.series[b.series.length - 1] || 0) - (a.series[a.series.length - 1] || 0));
  const leaders = new Set(byXp.slice(0, 3).map(l => keyOf(l)));

  const roleOf = (l: Learner) =>
    keyOf(l) === viewerKey ? "you" : leaders.has(keyOf(l)) ? "top" : "peer";

  // Painter's order: faint peers first, leaders over them, the viewer on top —
  // SVG has no z-index, so the order *is* the stacking.
  const rank = { peer: 0, top: 1, you: 2 };
  const ordered = learners.slice()
    .sort((a, b) => rank[roleOf(a) as keyof typeof rank] - rank[roleOf(b) as keyof typeof rank]);

  // Medallion positions are de-collided across the whole field at once, so they
  // have to be solved before any single line is drawn.
  const labelled = ordered.filter(l => roleOf(l) !== "peer");
  const lastY = labelled.map(l => y(l.series[l.series.length - 1] || 0));
  const slots = spread(lastY, 30, PAD.t + 2, LH - PAD.b - 2);
  const slotOf = new Map(labelled.map((l, i) => [keyOf(l), slots[i]]));

  const draw = (l: Learner): string => {
    const key = keyOf(l);
    const role = roleOf(l);
    const you = role === "you";
    const pts: Array<[number, number]> = l.series.map((v, i) => [x(i), y(v)]);
    const d = curve(pts);
    const last = l.series[l.series.length - 1] || 0;
    const endX = pts[pts.length - 1][0], endY = pts[pts.length - 1][1];
    const stroke = you ? `url(#${uid}-you)` : `hsl(${hueOf(key)} 78% 62%)`;

    // Only the subject gets an area — two filled curves would muddy each other.
    const area = you
      ? `<path class="${P}-ln-area" d="${d}L${endX.toFixed(1)},${(LH - PAD.b).toFixed(1)}`
        + `L${pts[0][0].toFixed(1)},${(LH - PAD.b).toFixed(1)}Z" fill="url(#${uid}-fill)"/>`
      : "";

    let cap = "";
    if (role !== "peer") {
      const ly = (slotOf.get(key) || endY);
      const mx = LW - PAD.r + 26;
      cap = `<g class="${P}-ln-cap" style="--ly:${ly.toFixed(1)}px">
        <path class="${P}-ln-leader" d="M${endX.toFixed(1)},${endY.toFixed(1)}`
        + `Q${(endX + 14).toFixed(1)},${endY.toFixed(1)} ${(mx - 15).toFixed(1)},${ly.toFixed(1)}"/>
        <circle class="${P}-ln-med" cx="${mx.toFixed(1)}" cy="${ly.toFixed(1)}" r="13"/>
        <text class="${P}-ln-ini" x="${mx.toFixed(1)}" y="${ly.toFixed(1)}"
              text-anchor="middle" dominant-baseline="central">${esc(you ? S.you : initials(l.person.name))}</text>
        <text class="${P}-ln-val" x="${(mx + 19).toFixed(1)}" y="${ly.toFixed(1)}"
              dominant-baseline="central">${fmt(last)}</text>
      </g>`;
    }

    const head = `<circle class="${P}-ln-head" cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}"
      r="${you ? 5 : 3.6}"/>`
      + (you ? `<circle class="${P}-ln-ping" cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="5"/>` : "");

    return `<g class="${P}-lngrp" data-key="${esc(key)}" data-role="${role}" tabindex="0"
      role="button" style="--c:hsl(${hueOf(key)} 78% 62%);--i:${rank[role as keyof typeof rank]}"
      aria-label="${esc(l.person.name)} · ${fmt(last)} ${esc(S.unitXp)}">
      <title>${esc(l.person.name)} · ${fmt(last)} ${esc(S.unitXp)}</title>
      ${area}
      <path class="${P}-ln-hit" d="${d}"/>
      <path class="${P}-ln" d="${d}" stroke="${stroke}"/>
      ${head}${cap}
    </g>`;
  };

  const legend = `<div class="${P}-lgd">
    ${viewerKey ? `<span class="${P}-lgd-i" data-role="you">${esc(S.lineYou)}</span>` : ""}
    <span class="${P}-lgd-i" data-role="top">${esc(S.lineLeader)}</span>
    <span class="${P}-lgd-i" data-role="peer">${esc(S.lineOthers)}</span>
    <span class="${P}-lgd-hint">${esc(S.lineHint)}</span>
  </div>`;

  return `<div class="${P}-lines">
    <svg viewBox="0 0 ${LW} ${LH}" class="${P}-lines-svg" role="img"
         aria-label="${esc(S.capXp)}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="${uid}-you" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--csl-primary)"/>
          <stop offset="100%" stop-color="var(--csl-accent)"/>
        </linearGradient>
        <linearGradient id="${uid}-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--csl-accent)" stop-opacity=".34"/>
          <stop offset="100%" stop-color="var(--csl-accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${xticks}
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
