// ─────────────────────────────────────────────────────────────────────────────
// Feed assembly: classify channels, normalize posts, merge, sort.
//
// Everything downstream of this module deals in `FeedPost` — the renderer never
// touches a raw API shape, so the news/social split and the locale choice are
// made exactly once, here.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeLocale, resolveLocale } from "../tasks/shared/i18n";
import { fetchChannelPosts, Logger } from "./api";
import { AVAILABLE_LOCALES, DEFAULT_UI_LOCALE } from "./strings";
import { ApiChannel, ApiContent, ApiImage, ApiPost, Avatar, Channel, FeedKind, FeedPost, OptsFactory } from "./types";

// ── Classification ───────────────────────────────────────────────────────────
//
// The channels API returns `contentType` as one of:
//   articles  — editorial posts with a headline, teaser and cover image → News
//   updates   — short user-authored posts, the social wall              → Social
//   pictures  — photo posts (e.g. "Cortos")                             → Social
// Anything unrecognized is treated as News, because the news card degrades
// gracefully (it just shows a title) while the social card assumes an author.

export function kindOf(contentType: string | undefined): FeedKind {
  const ct = String(contentType || "").toLowerCase();
  return (ct === "updates" || ct === "pictures") ? "social" : "news";
}

// ── Locale ───────────────────────────────────────────────────────────────────

/** Pick the widget's display locale.
 *
 *  Deliberately not the shared `detectLocale`: an unset or unrecognized language
 *  resolves to `es_MX`, not `en_US`. These tenants are Spanish-speaking, so
 *  Spanish is the correct answer both when nothing is configured and when
 *  detection comes up empty. Browser-following is opt-in via "auto". */
export function resolveUiLocale(configLanguage: string, userLocale: string): string {
  const explicit = String(configLanguage || "").trim();
  if (!explicit) return DEFAULT_UI_LOCALE;
  if (explicit !== "auto") return resolveLocale(explicit, AVAILABLE_LOCALES);

  const navLang = typeof navigator !== "undefined" ? ((navigator as any).language || "") : "";
  for (const cand of [userLocale, navLang]) {
    const norm = normalizeLocale(cand || "");
    if (!norm) continue;
    const lang = norm.split("_")[0];
    // Only accept a candidate whose *language* we actually ship — otherwise
    // resolveLocale would silently hand back en_US and override the Spanish default.
    if (AVAILABLE_LOCALES.some(a => normalizeLocale(a).split("_")[0] === lang)) {
      return resolveLocale(norm, AVAILABLE_LOCALES);
    }
  }
  return DEFAULT_UI_LOCALE;
}

/** Choose which localized entry of a `contents`/`localization` map to show.
 *
 *  Order: exact locale → same language, any region (es_MX → es_ES) → en_US →
 *  first available. Posts on these tenants carry es_MX, es_ES, en_US and de_DE
 *  inconsistently, so the same-language step is what keeps Spanish content
 *  showing for a Spanish viewer even when the exact region is missing. */
export function pickLocalized<T>(map: Record<string, T> | undefined | null, locale: string): T | null {
  if (!map) return null;
  const keys = Object.keys(map);
  if (!keys.length) return null;

  const want = normalizeLocale(locale);
  for (const k of keys) if (normalizeLocale(k) === want) return map[k];

  const lang = want.split("_")[0];
  for (const k of keys) if (normalizeLocale(k).split("_")[0] === lang) return map[k];

  for (const k of keys) if (normalizeLocale(k) === "en_US") return map[k];
  return map[keys[0]];
}

// ── Text + media extraction ──────────────────────────────────────────────────

const BLOCK_TAGS = /<\/(p|div|li|h[1-6]|blockquote|tr)>/gi;

/** HTML → readable plain text. Block ends become spaces so paragraphs don't run
 *  together, and entities are decoded so `&nbsp;` doesn't leak into a card. */
export function toPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const withBreaks = String(html).replace(BLOCK_TAGS, " $& ").replace(/<br\s*\/?>/gi, " ");
  const el = typeof document !== "undefined" ? document.createElement("div") : null;
  if (el) {
    el.innerHTML = withBreaks;
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }
  return withBreaks.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function bestImage(img: Avatar | ApiImage | null | undefined): string {
  if (!img) return "";
  const a = img as Avatar;
  // Prefer the largest rendition: the hero card fills the card width, so a
  // thumb-sized asset visibly blurs.
  const url = a.original?.url || a.thumb?.url || a.icon?.url || (img as ApiImage).url;
  return url || "";
}

/** The image a card should show.
 *
 *  Editorial posts set `image`/`feedImage`. Social posts usually set neither and
 *  instead inline the photo in the body as `<div class="media-box"><img …>`, so
 *  the first inline `src` is the only cover available for them. */
function coverImage(content: ApiContent | null): string {
  if (!content) return "";
  const explicit = bestImage(content.image) || bestImage(content.feedImage);
  if (explicit) return explicit;

  const body = content.content || "";
  const m = /<img[^>]+(?:data-)?src=["']([^"']+)["']/i.exec(body);
  return m ? m[1] : "";
}

// ── Normalization ────────────────────────────────────────────────────────────

export function toChannel(raw: ApiChannel, locale: string): Channel {
  const loc = pickLocalized(raw.config?.localization, locale);
  // Channel titles on multibrand tenants are authored as "Brand A // Brand B";
  // the leading segment is the one that belongs to this branch.
  const title = String((loc && loc.title) || "").split("//")[0].trim();
  return {
    id: raw.id,
    title,
    kind: kindOf(raw.contentType),
    contentType: String(raw.contentType || ""),
  };
}

export function toFeedPost(raw: ApiPost, channel: Channel, locale: string): FeedPost | null {
  if (!raw || !raw.id) return null;

  const content = pickLocalized(raw.contents, locale);
  const kind = kindOf(raw.contentType || channel.contentType);
  const body = toPlainText(content?.content);

  // Staffbase stuffs the entire body into `title` for updates/pictures, which
  // makes a useless headline. Social cards therefore show no title at all and
  // lean on the excerpt; only editorial posts get a real headline.
  const rawTitle = String(content?.title || "").trim();
  const title = kind === "news" ? rawTitle : "";
  const teaser = toPlainText(content?.teaser);
  const excerpt = kind === "news" ? (teaser || body) : (body || teaser);

  const when = raw.published || raw.created || "";
  const publishedAt = when ? Date.parse(when) : NaN;

  const author = raw.author || {};
  const authorName = [author.firstName, author.lastName].filter(Boolean).join(" ");

  return {
    id: raw.id,
    channelId: raw.channelID || channel.id,
    channelTitle: channel.title,
    kind,
    contentType: String(raw.contentType || channel.contentType || ""),
    publishedAt: isNaN(publishedAt) ? 0 : publishedAt,
    publishedIso: when,
    highlighted: !!raw.highlighted,
    title,
    excerpt,
    imageUrl: coverImage(content),
    author: {
      id: author.id || raw.authorID || "",
      name: authorName,
      avatarUrl: bestImage(author.avatar),
    },
    likeCount: Number(raw.likes?.total) || 0,
    commentCount: Number(raw.comments?.total) || 0,
    // Relative, so the tap is handled by the Staffbase router instead of
    // reloading the shell. `detail_view` is absolute and points at /openlink/.
    href: `/content/news/${kind === "news" ? "article" : "update"}/${raw.id}`,
  };
}

// ── Load ─────────────────────────────────────────────────────────────────────

/** Fetch every configured channel in parallel and merge into one chronological
 *  feed. A channel that fails (deleted, or not readable by the viewer) is
 *  skipped rather than failing the whole widget. */
export async function loadFeed(opts: {
  base: string;
  channels: Channel[];
  perChannelLimit: number;
  totalLimit: number;
  ladder: OptsFactory[];
  locale: string;
  log: Logger;
}): Promise<FeedPost[]> {
  const { base, channels, perChannelLimit, totalLimit, ladder, locale, log } = opts;

  const results = await Promise.all(channels.map(async ch => {
    const raw = await fetchChannelPosts(base, ch.id, perChannelLimit, ladder, log);
    return raw.map(r => toFeedPost(r, ch, locale)).filter((p): p is FeedPost => !!p);
  }));

  const merged: FeedPost[] = [];
  const seen = new Set<string>();
  for (const list of results) {
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }
  }

  merged.sort((a, b) => b.publishedAt - a.publishedAt);
  log(`merged ${merged.length} posts from ${channels.length} channels`);
  return merged.slice(0, totalLimit);
}

/** Parse the `channelids` config value. Accepts commas, whitespace or newlines
 *  so pasting a column of IDs out of a spreadsheet just works. */
export function parseChannelIds(raw: string): string[] {
  return String(raw || "")
    .split(/[\s,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// ── Sanitizing ───────────────────────────────────────────────────────────────

const ALLOWED_TAGS = ["P", "BR", "B", "STRONG", "I", "EM", "U", "A", "SPAN"];

/** Reduce arbitrary comment HTML to a safe inline subset.
 *
 *  Comment bodies are authored by other users and arrive as raw HTML, so they
 *  are never injected as-is. Everything outside the allow-list is unwrapped
 *  (children kept, element dropped) and every attribute except a vetted `href`
 *  is removed, which also kills `javascript:` URLs and inline handlers. */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof document === "undefined") return "";

  const root = document.createElement("div");
  root.innerHTML = String(html);

  const walk = (node: Element) => {
    // Copy the list first: the loop mutates the live child collection.
    for (const child of Array.from(node.children)) walk(child);

    if (ALLOWED_TAGS.indexOf(node.tagName) === -1) {
      const parent = node.parentNode;
      if (parent) {
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
      }
      return;
    }
    // Capture the href before the attribute sweep, or there is nothing left to
    // vet by the time we look for it.
    const href = node.tagName === "A" ? String(node.getAttribute("href") || "") : "";
    for (const attr of Array.from(node.attributes)) node.removeAttribute(attr.name);
    if (node.tagName === "A" && /^(https?:|\/)/i.test(href)) {
      node.setAttribute("href", href);
      node.setAttribute("rel", "noopener noreferrer");
    }
  };
  for (const child of Array.from(root.children)) walk(child);

  return root.innerHTML;
}

