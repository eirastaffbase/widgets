// ─────────────────────────────────────────────────────────────────────────────
// Charts — hand-rolled HTML/CSS/SVG. No chart library.
//
// The deciding constraint is the avatar: every data point is a person's photo,
// and photos 404 often enough that a gradient-initials fallback is mandatory.
// That fallback is an `<img onerror>`, which only works for real DOM images —
// so canvas (chart.js) is out, and inside SVG the avatars are absolutely
// positioned HTML `<img>` overlays rather than `<image>` elements, which have
// no usable error-fallback path.
// ─────────────────────────────────────────────────────────────────────────────

import { Entry, Tile } from "./types";

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

/**
 * Avatar markup.
 *
 * Wrapped in `internal-link clickable` + `/profile/<id>` + `data-uid`, which is
 * the markup Staffbase's own author links use — that is what makes the native
 * profile hovercard attach to a chart node instead of it being an inert image.
 */
export function avatar(e: Entry, size: number, cls = ""): string {
  const p = e.person;
  const ini = esc(initials(p.name));
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`;
  const inner = p.avatar
    ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('${P}-av-fb');this.remove()">`
    : "";
  const body = `<span class="${P}-av ${cls} ${p.avatar ? "" : `${P}-av-fb`}" style="${style}" data-ini="${ini}">${inner}</span>`;
  if (!p.id) return body;
  return `<a class="${P}-avlink internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}" title="${esc(p.name)}">${body}</a>`;
}

function nameCell(e: Entry): string {
  const p = e.person;
  const meta = [p.position, p.department].filter(Boolean).join(" · ");
  const label = p.id
    ? `<a class="${P}-nm internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}">${esc(p.name)}</a>`
    : `<span class="${P}-nm">${esc(p.name)}</span>`;
  const sub = e.subtitle || meta;
  return `${label}${sub ? `<span class="${P}-meta">${esc(sub)}</span>` : ""}`;
}

const fmt = (n: number): string => (Math.round(n * 10) / 10).toLocaleString();

/** Describe the underlying numbers for screen readers, since the visual
 *  encoding (bar length, pillar height, arc angle) conveys nothing to them. */
function ariaLabel(tile: Tile): string {
  const rows = tile.entries.map((e, i) => `${i + 1}. ${e.person.name}, ${fmt(e.value)} ${tile.unit}`);
  return esc(`${tile.title}. ${rows.join(". ")}`);
}

function chartOpen(tile: Tile, kind: string): string {
  return `<div class="${P}-chart ${P}-${kind}" role="img" aria-label="${ariaLabel(tile)}">`;
}

// ── Podium ───────────────────────────────────────────────────────────────────

/** 2nd–1st–3rd, winner centre and tallest. Heights are proportional to score
 *  but floored at 28% so a runaway winner doesn't flatten the others to
 *  invisible slivers. */
export function podium(tile: Tile): string {
  const e = tile.entries;
  if (e.length < 2) return solo(tile);
  const max = Math.max(...e.map(x => x.value)) || 1;
  const order = [1, 0, 2].filter(i => i < e.length);
  const pillars = order.map(i => {
    const entry = e[i];
    const h = Math.max(28, Math.round((entry.value / max) * 100));
    return `<div class="${P}-pil ${P}-pil-${i + 1}">
      ${avatar(entry, i === 0 ? 56 : 42, `${P}-av-ring`)}
      <span class="${P}-pil-nm">${esc(entry.person.name)}</span>
      <span class="${P}-pil-v">${fmt(entry.value)}</span>
      <div class="${P}-pil-bar" style="--h:${h}%"><span>${i + 1}</span></div>
    </div>`;
  }).join("");
  return `${chartOpen(tile, "podium")}${pillars}</div>${composition(tile)}`;
}

/** Fewer than two data points can't be a chart — show the winner plainly
 *  rather than a one-bar "chart" that implies a comparison. */
function solo(tile: Tile): string {
  const e = tile.entries[0];
  if (!e) return "";
  return `<div class="${P}-solo">
    ${avatar(e, 64, `${P}-av-ring`)}
    <div class="${P}-solo-txt">${nameCell(e)}</div>
    <div class="${P}-solo-v">${fmt(e.value)}<span>${esc(tile.unit)}</span></div>
  </div>`;
}

// ── Horizontal bars ──────────────────────────────────────────────────────────

export function bars(tile: Tile): string {
  if (tile.entries.length < 2) return solo(tile);
  const max = Math.max(...tile.entries.map(x => x.value)) || 1;
  const rows = tile.entries.map((e, i) => {
    const w = Math.max(4, Math.round((e.value / max) * 100));
    return `<div class="${P}-row${i === 0 ? ` ${P}-row-win` : ""}">
      ${avatar(e, i === 0 ? 40 : 32)}
      <div class="${P}-row-body">
        <div class="${P}-row-top">${nameCell(e)}</div>
        <div class="${P}-track"><div class="${P}-fill" style="--w:${w}%"></div></div>
      </div>
      <div class="${P}-row-v">${fmt(e.value)}</div>
    </div>`;
  }).join("");
  return `${chartOpen(tile, "bars")}${rows}</div>`;
}

// ── Two-tone share/click bars (Social Advocacy) ───────────────────────────────

/** Post-level by necessity — the API has no per-user share log — so the row is
 *  the post, with the author's avatar attached to keep a person in frame. */
export function shareBars(tile: Tile): string {
  if (!tile.entries.length) return "";
  const max = Math.max(...tile.entries.map(e => Math.max(...(e.parts || []).map(p => p.value), e.value))) || 1;
  const rows = tile.entries.map(e => {
    const parts = e.parts || [{ label: tile.unit, value: e.value, color: "var(--sbel-primary)" }];
    const segs = parts.map(p => `
      <div class="${P}-sb-row">
        <span class="${P}-sb-lbl">${esc(p.label)}</span>
        <div class="${P}-track"><div class="${P}-fill" style="--w:${Math.max(2, Math.round((p.value / max) * 100))}%;background:${esc(p.color)}"></div></div>
        <span class="${P}-sb-v">${fmt(p.value)}</span>
      </div>`).join("");
    return `<div class="${P}-sb">
      <div class="${P}-sb-head">${avatar(e, 32)}<div class="${P}-row-top">${nameCell(e)}</div></div>
      ${segs}
    </div>`;
  }).join("");
  return `${chartOpen(tile, "sharebars")}${rows}</div>`;
}

// ── Donut of reaction types ──────────────────────────────────────────────────

/**
 * Only rendered when session auth resolved reaction *types* (the token-only
 * `/posts/{id}/likes` path yields untyped likes, where a donut of one slice
 * would be meaningless). The winner's avatar sits in the hole as an HTML
 * overlay, not an SVG `<image>`, so the initials fallback still works.
 */
export function donut(tile: Tile): string {
  const win = tile.entries[0];
  const parts = (win?.parts || []).filter(p => p.value > 0);
  if (!win || parts.length < 2) return bars(tile);

  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = 54, c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = parts.map(p => {
    const len = (p.value / total) * c;
    const seg = `<circle class="${P}-arc" cx="70" cy="70" r="${r}" fill="none"
      stroke="${esc(p.color)}" stroke-width="16" stroke-linecap="butt"
      stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}"
      transform="rotate(-90 70 70)"><title>${esc(p.label)}: ${fmt(p.value)}</title></circle>`;
    offset += len;
    return seg;
  }).join("");

  const legend = parts.map(p =>
    `<li><i style="background:${esc(p.color)}"></i>${esc(p.label)}<b>${fmt(p.value)}</b></li>`).join("");

  return `${chartOpen(tile, "donut")}
    <div class="${P}-donut-wrap">
      <svg viewBox="0 0 140 140" width="140" height="140" aria-hidden="true">
        <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--sbel-track)" stroke-width="16"></circle>
        ${arcs}
      </svg>
      <div class="${P}-donut-mid">${avatar(win, 64)}</div>
    </div>
    <div class="${P}-donut-side">
      <div class="${P}-row-top">${nameCell(win)}</div>
      <ul class="${P}-legend">${legend}</ul>
    </div>
  </div>`;
}

// ── Slope chart (Rising Star) ────────────────────────────────────────────────

/** Growth is a two-point comparison, so a slope is the honest encoding: a bar
 *  chart of the current value would hide the delta that defines the metric. */
export function slope(tile: Tile): string {
  const e = tile.entries;
  if (!e.length) return "";
  const max = Math.max(...e.map(x => Math.max(x.value, x.previous || 0))) || 1;
  const W = 220, H = 120, pad = 14;
  const y = (v: number) => pad + (1 - v / max) * (H - pad * 2);

  const lines = e.map((x, i) => {
    const col = i === 0 ? "var(--sbel-primary)" : "var(--sbel-muted-line)";
    return `<line x1="${pad}" y1="${y(x.previous || 0)}" x2="${W - pad}" y2="${y(x.value)}"
      stroke="${col}" stroke-width="${i === 0 ? 3 : 2}" stroke-linecap="round" opacity="${i === 0 ? 1 : 0.55}"/>
      <circle cx="${pad}" cy="${y(x.previous || 0)}" r="3.5" fill="${col}" opacity="${i === 0 ? 1 : 0.55}"/>`;
  }).join("");

  const win = e[0];
  const delta = win.value - (win.previous || 0);
  const topPct = (y(win.value) / H) * 100;

  return `${chartOpen(tile, "slope")}
    <div class="${P}-slope-wrap" style="--sw:${W}px;--sh:${H}px">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
      <div class="${P}-slope-av" style="top:${topPct}%">${avatar(win, 40, `${P}-av-ring`)}</div>
    </div>
    <div class="${P}-slope-info">
      <div class="${P}-row-top">${nameCell(win)}</div>
      <div class="${P}-delta">▲ +${fmt(delta)} <span>${esc(tile.unit)}</span></div>
    </div>
  </div>`;
}

// ── Stacked composition bar ──────────────────────────────────────────────────

/** Explains a weighted score by decomposing it. Without this the "Most engaged"
 *  number is a magic value nobody can audit. */
function composition(tile: Tile): string {
  const win = tile.entries[0];
  const parts = (win?.parts || []).filter(p => p.value > 0);
  if (!win || parts.length < 2) return "";
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const segs = parts.map(p =>
    `<span class="${P}-cseg" style="--w:${(p.value / total) * 100}%;background:${esc(p.color)}" title="${esc(p.label)}: ${fmt(p.value)}"></span>`).join("");
  const legend = parts.map(p =>
    `<li><i style="background:${esc(p.color)}"></i>${esc(p.label)}</li>`).join("");
  return `<div class="${P}-comp"><div class="${P}-cbar">${segs}</div><ul class="${P}-legend ${P}-legend-h">${legend}</ul></div>`;
}

// ── Bubble map (optional, full width) ────────────────────────────────────────

/**
 * x = breadth (distinct posts touched), y = volume (total actions), radius ∝
 * score. Avatars are HTML overlays positioned in percentages over an SVG grid.
 */
export function bubbleMap(points: Array<{ entry: Entry; x: number; y: number; size: number }>, label: string): string {
  if (points.length < 3) return "";
  const maxX = Math.max(...points.map(p => p.x)) || 1;
  const maxY = Math.max(...points.map(p => p.y)) || 1;
  const maxS = Math.max(...points.map(p => p.size)) || 1;
  const nodes = points.map(p => {
    const size = 24 + Math.round((p.size / maxS) * 28);
    const left = 6 + (p.x / maxX) * 86;
    const bottom = 8 + (p.y / maxY) * 80;
    return `<div class="${P}-bub" style="left:${left}%;bottom:${bottom}%">${avatar(p.entry, size)}</div>`;
  }).join("");
  const grid = [25, 50, 75].map(v =>
    `<line x1="0" y1="${v}" x2="100" y2="${v}" stroke="var(--sbel-track)" stroke-width="0.4"/>
     <line x1="${v}" y1="0" x2="${v}" y2="100" stroke="var(--sbel-track)" stroke-width="0.4"/>`).join("");
  return `<div class="${P}-bubwrap" role="img" aria-label="${esc(label)}">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${grid}</svg>
    ${nodes}
  </div>`;
}

/** Dispatch a tile to its visualization. */
export function renderChart(tile: Tile): string {
  switch (tile.chart) {
    case "podium": return podium(tile);
    case "donut": return donut(tile);
    case "slope": return slope(tile);
    case "share_bars": return shareBars(tile);
    default: return bars(tile);
  }
}
