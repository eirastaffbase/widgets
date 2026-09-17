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
import { Completion, Learner, MetricId, Person } from "./types";

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
    return `<div class="${P}-pod ${P}-pod-${rank}" data-key="${esc(keyOf(l))}" style="--i:${i}">
      <div class="${P}-pod-avwrap">
        ${avatar(l.person, av, `${P}-av-hero`)}
        <span class="${P}-pod-rank">${rank === 1 ? icon("crown", 14) : rank}</span>
      </div>
      <div class="${P}-pod-nm">${personName(l.person, `${P}-pod-nmlink`)}</div>
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

// ── Bar race ─────────────────────────────────────────────────────────────────

/**
 * One row. Bars are scaled against the leader with a floor, so a runaway winner
 * does not flatten everyone else into invisible slivers.
 *
 * `data-key` and `data-w` are what the shell's FLIP + bar update read; the row
 * renders its final width and value inline so a dead script still shows a
 * correct, static chart.
 */
export function raceRow(
  l: Learner, rank: number, max: number, metric: MetricId,
  opts: { drilldown: boolean; badges: boolean; streak: boolean },
): string {
  const v = metricValue(l, metric);
  const w = Math.max(6, max > 0 ? (v / max) * 100 : 0);
  const key = esc(keyOf(l));
  return `<li class="${P}-row" data-key="${key}" style="--i:${rank - 1}">
    <div class="${P}-row-main"${opts.drilldown ? ` role="button" tabindex="0" aria-expanded="false" aria-controls="${P}-dd-${key.replace(/[^\w-]/g, "_")}"` : ""}>
      <span class="${P}-rank">${rank}</span>
      ${avatar(l.person, 34)}
      <div class="${P}-row-body">
        <div class="${P}-row-top">
          ${personName(l.person, `${P}-row-nm`)}
          <span class="${P}-row-val">
            <span class="${P}-num" data-count="${v}" data-dec="${metric === "hours" ? 1 : 0}">${formatMetric(l, metric)}</span>
            <span class="${P}-unit">${esc(metricUnit(l, metric))}</span>
          </span>
        </div>
        <div class="${P}-bar"><span class="${P}-bar-fill" style="--w:${w.toFixed(2)}%"></span></div>
        <div class="${P}-row-sub">
          ${opts.streak && l.streak > 0 ? `<span class="${P}-streak">${icon("flame", 12)}${l.streak}</span>` : ""}
          ${opts.badges ? badgeChips(l, true) : ""}
        </div>
      </div>
      ${opts.drilldown ? `<span class="${P}-row-chev" aria-hidden="true">${icon("chevron", 16)}</span>` : ""}
    </div>
    ${opts.drilldown ? `<div class="${P}-dd" id="${P}-dd-${key.replace(/[^\w-]/g, "_")}" hidden></div>` : ""}
  </li>`;
}

export function race(
  learners: Learner[], metric: MetricId,
  opts: { drilldown: boolean; badges: boolean; streak: boolean },
): string {
  if (!learners.length) return "";
  const max = Math.max(...learners.map(l => metricValue(l, metric)), 0);
  const rows = learners.map((l, i) => raceRow(l, i + 1, max, metric, opts)).join("");
  return `<ol class="${P}-race" aria-label="${esc(S.field)}">${rows}</ol>`;
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
