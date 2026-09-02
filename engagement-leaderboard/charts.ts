// ─────────────────────────────────────────────────────────────────────────────
// Charts — hand-rolled HTML/CSS/SVG. No chart library.
//
// The deciding constraint is the avatar: every data point is a person's photo,
// and photos 404 often enough that a gradient-initials fallback is mandatory.
// That fallback is an `<img onerror>`, which only works for real DOM images —
// so canvas (chart.js) is out, and inside SVG the avatars are absolutely
// positioned HTML overlays rather than `<image>` elements, which have no usable
// error-fallback path.
//
// Every tile shares one anatomy so the deck reads as a single broadcast rather
// than eight unrelated widgets:
//
//   champion  — the winner, at full scale, with the headline number
//   field     — the ranked runners-up as avatar-led bars
//   flourish  — one metric-specific graphic that explains *why* they won
//
// Only the flourish changes per metric.
// ─────────────────────────────────────────────────────────────────────────────

import { Entry, Tile } from "./types";
import { icon } from "./icons";

export const P = "sbel"; // class prefix

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

export const fmt = (n: number): string =>
  (Math.round(n * 10) / 10).toLocaleString();

/**
 * Avatar markup.
 *
 * Wrapped in `internal-link clickable` + `/profile/<id>` + `data-uid`, which is
 * the markup Staffbase's own author links use — that is what makes the native
 * profile hovercard attach to a chart node instead of leaving it an inert
 * image.
 */
export function avatar(e: Entry, size: number, cls = ""): string {
  const p = e.person;
  const ini = esc(initials(p.name));
  const style = `--av:${size}px`;
  const inner = p.avatar
    ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('${P}-av-fb');this.remove()">`
    : "";
  const body = `<span class="${P}-av ${cls}${p.avatar ? "" : ` ${P}-av-fb`}" style="${style}" data-ini="${ini}">${inner}</span>`;
  if (!p.id) return body;
  return `<a class="${P}-avlink internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}" tabindex="-1" aria-label="${esc(p.name)}">${body}</a>`;
}

function personLink(e: Entry, cls: string): string {
  const p = e.person;
  return p.id
    ? `<a class="${cls} internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}">${esc(p.name)}</a>`
    : `<span class="${cls}">${esc(p.name)}</span>`;
}

/** Describe the underlying numbers for screen readers — the visual encoding
 *  (bar length, arc angle, slope) conveys nothing to them. */
function ariaLabel(tile: Tile): string {
  const rows = tile.entries.map((e, i) => `${i + 1}. ${e.person.name}, ${fmt(e.value)} ${tile.unit}`);
  return esc(`${tile.title}. ${rows.join(". ")}`);
}

// ── Champion ─────────────────────────────────────────────────────────────────

/**
 * The winner at full scale. The number carries `data-count` so it can be
 * counted up on reveal; it renders its final value immediately so a failed
 * script never leaves the slide blank.
 */
export function champion(tile: Tile, size: "stage" | "card"): string {
  const e = tile.entries[0];
  if (!e) return "";
  const p = e.person;
  const meta = [p.position, p.department].filter(Boolean).join(" · ");
  const av = size === "stage" ? 132 : 64;
  return `<div class="${P}-champ">
    <div class="${P}-champ-av">
      ${avatar(e, av, `${P}-av-hero`)}
      <span class="${P}-crown">${icon("trophy", size === "stage" ? 18 : 14)}</span>
    </div>
    <div class="${P}-champ-txt">
      ${personLink(e, `${P}-champ-nm`)}
      ${meta ? `<span class="${P}-champ-meta">${esc(meta)}</span>` : ""}
      ${e.subtitle && e.subtitle !== meta ? `<span class="${P}-champ-sub">${esc(e.subtitle)}</span>` : ""}
    </div>
    <div class="${P}-champ-num">
      <span class="${P}-num" data-count="${e.value}">${fmt(e.value)}</span>
      <span class="${P}-unit">${esc(tile.unit)}</span>
    </div>
  </div>`;
}

// ── The field ────────────────────────────────────────────────────────────────

/** Ranked runners-up. Bars are scaled against the leader, with a floor so a
 *  runaway winner doesn't flatten everyone else into invisible slivers. */
export function field(tile: Tile): string {
  const rest = tile.entries.slice(1);
  if (!rest.length) return "";
  const max = tile.entries[0]?.value || 1;
  const rows = rest.map((e, i) => `
    <li class="${P}-frow" style="--i:${i}">
      <span class="${P}-rank">${i + 2}</span>
      ${avatar(e, 30)}
      <div class="${P}-frow-body">
        <div class="${P}-frow-top">
          ${personLink(e, `${P}-frow-nm`)}
          <span class="${P}-frow-v">${fmt(e.value)}</span>
        </div>
        <span class="${P}-track"><span class="${P}-fill" style="--w:${Math.max(5, Math.round((e.value / max) * 100))}%"></span></span>
      </div>
    </li>`).join("");
  return `<ol class="${P}-field" role="img" aria-label="${ariaLabel(tile)}">${rows}</ol>`;
}

// ── Flourishes ───────────────────────────────────────────────────────────────

/** Stacked composition bar — decomposes a weighted score so the number is
 *  auditable instead of magic. */
function composition(e: Entry, label: string): string {
  const parts = (e.parts || []).filter(x => x.value > 0);
  if (parts.length < 2) return "";
  const total = parts.reduce((a, x) => a + x.value, 0) || 1;
  const segs = parts.map((x, i) =>
    `<span class="${P}-cseg" style="--w:${(x.value / total) * 100}%;--d:${i * 70}ms;background:${esc(x.color)}"></span>`).join("");
  const legend = parts.map(x =>
    `<li><i style="background:${esc(x.color)}"></i>${esc(x.label)}<b>${fmt(x.value)}</b></li>`).join("");
  return `<div class="${P}-fl">
    <span class="${P}-fl-h">${esc(label)}</span>
    <div class="${P}-cbar">${segs}</div>
    <ul class="${P}-legend">${legend}</ul>
  </div>`;
}

/**
 * Reaction-type ring. Only meaningful when session auth resolved reaction
 * *types* — under token auth every reaction is an untyped LIKE, where a
 * one-slice donut would say nothing.
 */
function ring(e: Entry, label: string): string {
  const parts = (e.parts || []).filter(x => x.value > 0);
  if (parts.length < 2) return "";
  const total = parts.reduce((a, x) => a + x.value, 0) || 1;
  const r = 46, c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = parts.map((x, i) => {
    const len = (x.value / total) * c;
    const seg = `<circle class="${P}-arc" cx="60" cy="60" r="${r}" fill="none" stroke="${esc(x.color)}"
      stroke-width="13" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 60 60)" style="--d:${i * 90}ms"
      ><title>${esc(x.label)}: ${fmt(x.value)}</title></circle>`;
    offset += len;
    return seg;
  }).join("");
  const legend = parts.map(x =>
    `<li><i style="background:${esc(x.color)}"></i>${esc(x.label)}<b>${fmt(x.value)}</b></li>`).join("");
  return `<div class="${P}-fl ${P}-fl-ring">
    <span class="${P}-fl-h">${esc(label)}</span>
    <div class="${P}-ringwrap">
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="13"/>
        ${arcs}
      </svg>
      <span class="${P}-ring-mid">${fmt(total)}</span>
    </div>
    <ul class="${P}-legend">${legend}</ul>
  </div>`;
}

/** Growth is a two-point comparison, so a slope is the honest encoding — a bar
 *  of the current value would hide the delta that defines the metric. */
function slope(e: Entry, prevLabel: string, nowLabel: string): string {
  const before = e.previous || 0;
  const now = e.value;
  const max = Math.max(before, now) || 1;
  const W = 200, H = 84, pad = 10;
  const y = (v: number) => pad + (1 - v / max) * (H - pad * 2);
  return `<div class="${P}-fl">
    <div class="${P}-slope">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="${P}-sg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="var(--sbel-accent)"/><stop offset="1" stop-color="var(--sbel-primary)"/>
        </linearGradient></defs>
        <path class="${P}-sarea" d="M${pad},${y(before)} L${W - pad},${y(now)} L${W - pad},${H} L${pad},${H} Z"/>
        <line class="${P}-sline" x1="${pad}" y1="${y(before)}" x2="${W - pad}" y2="${y(now)}"
          stroke="url(#${P}-sg)" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${pad}" cy="${y(before)}" r="4" fill="var(--sbel-accent)"/>
        <circle class="${P}-sdot" cx="${W - pad}" cy="${y(now)}" r="5" fill="var(--sbel-primary)"/>
      </svg>
      <div class="${P}-slope-ends">
        <span>${esc(prevLabel)}<b>${fmt(before)}</b></span>
        <span class="${P}-slope-now">${esc(nowLabel)}<b>${fmt(now)}</b></span>
      </div>
    </div>
  </div>`;
}

/** Shares against clicks for the winning post. */
function shareSplit(e: Entry): string {
  const parts = (e.parts || []).filter(x => x.value > 0);
  if (!parts.length) return "";
  const max = Math.max(...parts.map(x => x.value)) || 1;
  const rows = parts.map((x, i) => `
    <li style="--i:${i}">
      <span class="${P}-sl-ic">${icon(i === 0 ? "share" : "click", 15)}</span>
      <span class="${P}-sl-lbl">${esc(x.label)}</span>
      <span class="${P}-track"><span class="${P}-fill" style="--w:${Math.max(5, Math.round((x.value / max) * 100))}%;background:${esc(x.color)}"></span></span>
      <b>${fmt(x.value)}</b>
    </li>`).join("");
  return `<div class="${P}-fl"><ul class="${P}-split">${rows}</ul></div>`;
}

export type FlourishLabels = { breakdown: string; mix: string; previous: string; current: string };

/** The one metric-specific graphic per slide. */
export function flourish(tile: Tile, L: FlourishLabels): string {
  const e = tile.entries[0];
  if (!e) return "";
  switch (tile.chart) {
    case "donut": return ring(e, L.mix);
    case "podium": return composition(e, L.breakdown);
    case "slope": return slope(e, L.previous, L.current);
    case "share_bars": return shareSplit(e);
    default: return "";
  }
}

// ── Engagement map ───────────────────────────────────────────────────────────

/**
 * x = breadth (distinct posts touched), y = volume (total actions), radius ∝
 * score. Avatars are HTML overlays positioned in percentages over an SVG grid.
 */
export function bubbleMap(
  points: Array<{ entry: Entry; x: number; y: number; size: number }>,
  label: string, axisX: string, axisY: string,
): string {
  if (points.length < 3) return "";
  const maxX = Math.max(...points.map(p => p.x)) || 1;
  const maxY = Math.max(...points.map(p => p.y)) || 1;
  const maxS = Math.max(...points.map(p => p.size)) || 1;
  const nodes = points.map((p, i) => {
    const size = 26 + Math.round((p.size / maxS) * 30);
    const left = 7 + (p.x / maxX) * 84;
    const bottom = 10 + (p.y / maxY) * 78;
    return `<div class="${P}-bub" style="left:${left}%;bottom:${bottom}%;--i:${i}">${avatar(p.entry, size)}</div>`;
  }).join("");
  const grid = [25, 50, 75].map(v =>
    `<line x1="0" y1="${v}" x2="100" y2="${v}"/><line x1="${v}" y1="0" x2="${v}" y2="100"/>`).join("");
  return `<div class="${P}-bubwrap" role="img" aria-label="${esc(label)}">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" class="${P}-bubgrid">${grid}</svg>
    ${nodes}
    <span class="${P}-axis ${P}-axis-x">${esc(axisX)}</span>
    <span class="${P}-axis ${P}-axis-y">${esc(axisY)}</span>
  </div>`;
}
