// ─────────────────────────────────────────────────────────────────────────────
// Markup. Pure string builders — no state, no fetching, no listeners. The widget
// shell owns behaviour; this file only decides what a post looks like.
// ─────────────────────────────────────────────────────────────────────────────

import { escapeHtml } from "./api";
import { P } from "./css";
import { ICONS } from "./icons";
import { Comment, FeedPost } from "./types";

export type T = (key: string) => string;

// ── Dates ────────────────────────────────────────────────────────────────────

/** Relative time for anything inside a week, an absolute date beyond it.
 *
 *  Uses Intl rather than hand-written strings so "hace 2 h", "ayer" and
 *  "12 de marzo" come out correctly in every shipped locale without a
 *  translation table per unit. */
export function makeFormatters(locale: string) {
  const tag = locale.replace("_", "-");

  let rtf: Intl.RelativeTimeFormat | null = null;
  try { rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto", style: "short" }); } catch (_) { rtf = null; }

  let dtf: Intl.DateTimeFormat | null = null;
  try { dtf = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long" }); } catch (_) { dtf = null; }

  let dtfYear: Intl.DateTimeFormat | null = null;
  try { dtfYear = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric" }); } catch (_) { dtfYear = null; }

  return function when(ms: number): string {
    if (!ms) return "";
    const now = Date.now();
    const diff = ms - now;
    const abs = Math.abs(diff);

    const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR, WEEK = 7 * DAY;
    if (rtf) {
      if (abs < MIN) return rtf.format(Math.round(diff / 1e3), "second");
      if (abs < HOUR) return rtf.format(Math.round(diff / MIN), "minute");
      if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
      if (abs < WEEK) return rtf.format(Math.round(diff / DAY), "day");
    }
    const d = new Date(ms);
    const sameYear = d.getFullYear() === new Date(now).getFullYear();
    const fmt = sameYear ? dtf : dtfYear;
    return fmt ? fmt.format(d) : d.toLocaleDateString();
  };
}

// ── Small pieces ─────────────────────────────────────────────────────────────

export function initials(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Initials, or a neutral person glyph when there is no name at all — a lone
 *  "?" in a brand-coloured circle reads as a loading failure rather than as
 *  "you", which is exactly what the composer showed before the viewer's
 *  profile resolved. */
function avatarFallback(name: string, cls: string, hidden = false): string {
  const ini = initials(name);
  return `<span class="${P}-av ${P}-av-fb ${cls}${ini ? "" : ` ${P}-av-anon`}"${hidden ? ` style="display:none"` : ""}>${ini ? escapeHtml(ini) : ICONS.user}</span>`;
}

/** Avatar with a graceful initials fallback. The `onerror` swap matters: avatar
 *  URLs are signed and expire, and a broken image icon on every card is worse
 *  than initials. */
export function avatarHtml(name: string, url: string, cls = ""): string {
  if (!url) return avatarFallback(name, cls);
  return `<img class="${P}-av ${cls}" src="${escapeHtml(url)}" alt="" loading="lazy"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    + avatarFallback(name, cls, true);
}

function socialActions(post: FeedPost, t: T, liked: boolean): string {
  return `<div class="${P}-acts">
  <button type="button" class="${P}-act ${P}-like${liked ? ` ${P}-on` : ""}" data-act="like" data-id="${escapeHtml(post.id)}"
    aria-pressed="${liked}" aria-label="${escapeHtml(t("social.like"))}">
    ${liked ? ICONS.heartFilled : ICONS.heart}<span class="${P}-act-n">${post.likeCount || ""}</span>
  </button>
  <button type="button" class="${P}-act" data-act="comments" data-id="${escapeHtml(post.id)}"
    aria-label="${escapeHtml(t("social.comments"))}">
    ${ICONS.comment}<span class="${P}-act-n">${post.commentCount || ""}</span>
  </button>
</div>`;
}

// ── Hero ─────────────────────────────────────────────────────────────────────

/** The pinned post, rendered as one large image with the headline laid over it.
 *
 *  Picture posts carry no usable title, so the excerpt is promoted to the
 *  headline slot — otherwise an El Globo "Cortos" pin would render as a giant
 *  photo with no words on it at all. */
export function heroHtml(post: FeedPost, t: T, when: (ms: number) => string): string {
  const headline = post.title || post.excerpt;
  const teaser = post.title ? post.excerpt : "";
  const clampedHeadline = headline.length > 180 ? headline.slice(0, 177).trimEnd() + "…" : headline;

  // On failure the image removes itself so the hero's brand gradient shows
  // through. Staffbase media URLs are session-scoped and 307 away when there is
  // no session, so a blank white slab is a real state, not a hypothetical one.
  const img = post.imageUrl
    ? `<img class="${P}-hero-img" src="${escapeHtml(post.imageUrl)}" alt="" fetchpriority="high" onerror="this.remove()">`
    : "";

  return `<a class="${P}-hero" href="${escapeHtml(post.href)}" aria-label="${escapeHtml(t("a11y.openPost"))}">
  ${img}
  <span class="${P}-hero-scrim"></span>
  <span class="${P}-hero-body">
    <span class="${P}-hero-meta">
      <span class="${P}-pin">${ICONS.pin}${escapeHtml(t("post.pinned"))}</span>
      ${post.channelTitle ? `<span class="${P}-hero-chip">${escapeHtml(post.channelTitle)}</span>` : ""}
      ${post.publishedAt ? `<span class="${P}-hero-date">${escapeHtml(when(post.publishedAt))}</span>` : ""}
    </span>
    ${clampedHeadline ? `<span class="${P}-hero-title">${escapeHtml(clampedHeadline)}</span>` : ""}
    ${teaser ? `<span class="${P}-hero-teaser">${escapeHtml(teaser)}</span>` : ""}
    <span class="${P}-hero-cta">${escapeHtml(t("post.read"))}${ICONS.arrow}</span>
  </span>
</a>`;
}

// ── Cards ────────────────────────────────────────────────────────────────────

export function cardHtml(
  post: FeedPost, t: T, when: (ms: number) => string, showActions: boolean, liked: boolean,
): string {
  // Drops the whole media band (not just the img) when the asset fails, so the
  // card closes up cleanly instead of reserving 16:9 of empty grey.
  const media = post.imageUrl
    ? `<span class="${P}-card-media-wrap"><img class="${P}-card-media" src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></span>`
    : "";

  // The stretched link covers the card so the whole surface is tappable, while
  // the action buttons sit above it on their own stacking level.
  const link = `<a class="${P}-stretch" href="${escapeHtml(post.href)}" aria-label="${escapeHtml(post.title || t("a11y.openPost"))}"></a>`;

  const body = post.kind === "news"
    ? `<span class="${P}-card-body">
    ${post.channelTitle ? `<span class="${P}-chan">${escapeHtml(post.channelTitle)}</span>` : ""}
    ${post.title ? `<span class="${P}-card-title">${escapeHtml(post.title)}</span>` : ""}
    ${post.excerpt ? `<span class="${P}-card-text">${escapeHtml(post.excerpt)}</span>` : ""}
    <span class="${P}-card-date">${escapeHtml(when(post.publishedAt))}</span>
  </span>`
    : `<span class="${P}-card-body">
    <span class="${P}-byline">
      ${avatarHtml(post.author.name, post.author.avatarUrl)}
      <span class="${P}-byline-t">
        <span class="${P}-byline-n">${escapeHtml(post.author.name || post.channelTitle)}</span>
        <span class="${P}-byline-d">${escapeHtml(when(post.publishedAt))}</span>
      </span>
    </span>
    ${post.excerpt ? `<span class="${P}-card-text">${escapeHtml(post.excerpt)}</span>` : ""}
  </span>`;

  // News leads with the photo; social leads with the person, so the photo drops
  // below the byline and text.
  const inner = post.kind === "news" ? media + body : body + media;

  return `<article class="${P}-card" data-id="${escapeHtml(post.id)}" data-kind="${post.kind}">
  ${link}${inner}${showActions ? socialActions(post, t, liked) : ""}
</article>`;
}

// ── Comments ─────────────────────────────────────────────────────────────────

export function commentHtml(c: Comment, when: (ms: number) => string): string {
  return `<div class="${P}-cmt">
  ${avatarHtml(c.author.name, c.author.avatarUrl)}
  <div class="${P}-cmt-b">
    <span class="${P}-cmt-n">${escapeHtml(c.author.name)}</span>
    <div class="${P}-cmt-x">${c.html}</div>
    <span class="${P}-cmt-d">${escapeHtml(when(c.createdAt))}</span>
  </div>
</div>`;
}

// ── States ───────────────────────────────────────────────────────────────────

export function stateHtml(message: string, actionLabel?: string, actionAttr?: string): string {
  return `<div class="${P}-state">
  <span>${escapeHtml(message)}</span>
  ${actionLabel ? `<button type="button" class="${P}-btn" data-act="${escapeHtml(actionAttr || "retry")}">${escapeHtml(actionLabel)}</button>` : ""}
</div>`;
}

export function skeletonHtml(n: number): string {
  return `<div class="${P}-grid">${Array(n).fill(`<div class="${P}-skel"></div>`).join("")}</div>`;
}
