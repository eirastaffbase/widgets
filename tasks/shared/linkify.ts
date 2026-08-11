// ─────────────────────────────────────────────────────────────────────────────
// Auto-linking of URLs in free-text task content.
//
// Task descriptions and comments are authored as plain text, so a pasted URL
// arrives as inert text. These helpers turn those URLs into real anchors.
//
// Two entry points, depending on what the caller already has:
//   • linkifyEscaped(s) — `s` is HTML-*escaped plain text* (the usual
//     `esc(description)` output). Every URL found becomes an anchor.
//   • linkifyHtml(s)    — `s` is a *rich HTML* fragment (e.g. a comment body
//     returned by the API). Only text nodes are touched, and anything already
//     inside an <a> is left alone so existing links aren't nested/broken.
//
// Both operate on escaped text, meaning a URL's "&" arrives as "&amp;". That is
// fine to keep verbatim inside href — the HTML parser decodes it back to "&".
// ─────────────────────────────────────────────────────────────────────────────

// Matches http(s):// and bare www. URLs. The character class deliberately
// excludes whitespace and the raw HTML delimiters so a match can never escape
// the text node it was found in; trailing punctuation is trimmed afterwards.
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

// Punctuation that commonly follows a URL in prose rather than belonging to it.
const TRAILING_RE = /[.,;:!?]+$/;

/** Trim characters that a sentence—not the URL—owns. */
function trimTrailing(url: string): string {
  let out = url;
  let changed = true;
  while (changed && out) {
    changed = false;

    // Entities produced by escaping: &amp; &quot; &lt; &gt; &#39;
    const ent = out.match(/&(?:amp|quot|lt|gt|#39|apos);$/i);
    if (ent) { out = out.slice(0, -ent[0].length); changed = true; continue; }

    const punct = out.match(TRAILING_RE);
    if (punct) { out = out.slice(0, -punct[0].length); changed = true; continue; }

    // Only drop a closing bracket when it has no opener inside the URL, so
    // links like .../Foo_(bar) survive but "(see https://x.com)" does not.
    const last = out.charAt(out.length - 1);
    const pairs: { [close: string]: string } = { ")": "(", "]": "[", "}": "{" };
    if (pairs[last]) {
      const open = pairs[last];
      let opens = 0, closes = 0;
      for (let i = 0; i < out.length; i++) {
        if (out.charAt(i) === open) opens++;
        else if (out.charAt(i) === last) closes++;
      }
      if (closes > opens) { out = out.slice(0, -1); changed = true; continue; }
    }
  }
  return out;
}

/** Guard against `javascript:`/`data:` style payloads sneaking into href. */
function safeHref(url: string): string | null {
  const normalized = /^www\./i.test(url) ? `https://${url}` : url;
  if (!/^https?:\/\//i.test(normalized)) return null;
  // The value is already HTML-escaped, but quotes/angles are re-checked here so
  // the attribute can never be broken out of.
  if (/["'<>]/.test(normalized)) return null;
  return normalized;
}

/**
 * Display label for a URL. The whole URL is kept — only the noise comes off:
 * the scheme, a leading "www.", a trailing slash, and the "/openlink" redirect
 * wrapper (which is an implementation detail of Staffbase's copy-link action,
 * not somewhere a reader ever means to go).
 *
 * Nothing is elided. Long URLs are handled visually instead: the chip is
 * capped at the container width and ellipsizes via CSS, so the label stays
 * fully selectable/copyable and never loses the middle of a path.
 */
function displayLabel(escapedUrl: string): string {
  const base = escapedUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const clean = stripOpenlink(base);
  // Keep a bare "host/" readable rather than rendering a dangling slash.
  return clean.replace(/\/+$/, "") || clean;
}

/**
 * Drop a "/openlink" path segment. Staffbase's share/copy-link action hands out
 * URLs like "host/openlink/content/form/<id>"; /openlink is a redirect wrapper
 * that resolves to the real page, so it's noise in a label.
 */
function stripOpenlink(hostAndPath: string): string {
  return hostAndPath.replace(/^([^/?#]+)\/openlink(?=[/?#]|$)/i, "$1");
}

/** Class applied to every auto-detected link; widgets style it as a chip. */
export const AUTOLINK_CLASS = "sb-autolink";

/**
 * Host of the app the widget lives in, derived from the configured API base URL
 * (e.g. "https://app.staffbase.com/api" → "app.staffbase.com"). Links to this
 * host are same-app navigation and so open in the current window instead of a
 * new tab. A leading "www." is dropped so both spellings compare equal.
 */
export function internalHost(baseUrl: string): string {
  const m = String(baseUrl || "").match(/^https?:\/\/([^/?#]+)/i);
  if (!m) return "";
  return m[1].replace(/^www\./i, "").toLowerCase();
}

/** Host portion of an already-escaped URL, normalized the same way. */
function hostOf(escapedUrl: string): string {
  return escapedUrl
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

const ICON_EXTERNAL =
  '<svg class="sb-autolink-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
  '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

// Same-app links get an arrow instead of the chain-link glyph, so it's obvious
// at a glance that they won't spawn a new tab.
const ICON_INTERNAL =
  '<svg class="sb-autolink-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>';

/**
 * Build the anchor markup for one detected URL (input already escaped).
 * Same-host links navigate in place; everything else opens in a new tab.
 */
/**
 * Destination for a same-app link.
 *
 * The href stays *absolute*. An earlier version rewrote these to a root-relative
 * path ("/content/form/<id>"), which works in a browser tab but breaks inside
 * the Staffbase mobile app: the widget runs in a webview whose document base
 * isn't the site root, so a root-relative path resolves against the wrong base
 * and dumps the user on the home screen. Keeping the full URL resolves the same
 * either way. Same-window behaviour comes from omitting `target`, not from the
 * href's shape.
 *
 * A leading "/openlink" segment is dropped. Staffbase's share/copy-link action
 * hands out URLs like ".../openlink/content/form/<id>", where /openlink is just
 * a redirect wrapper that bounces to the real page — we link straight at the
 * destination and skip the round trip.
 */
function internalHref(absoluteUrl: string): string {
  return absoluteUrl.replace(
    /^(https?:\/\/[^/?#]+)\/openlink(?=[/?#]|$)/i,
    "$1"
  );
}

/**
 * Build the anchor markup for one detected URL (input already escaped).
 * Same-host links stay absolute but omit `target`, so they navigate in the
 * current window; everything else opens in a new tab.
 */
function anchor(href: string, url: string, internal: boolean): string {
  const cls = internal ? `${AUTOLINK_CLASS} ${AUTOLINK_CLASS}-int` : AUTOLINK_CLASS;
  const rel = internal ? "" : ' target="_blank" rel="noopener noreferrer"';
  const dest = internal ? internalHref(href) : href;
  return (
    `<a class="${cls}" href="${dest}" title="${url}"${rel}>` +
    `${internal ? ICON_INTERNAL : ICON_EXTERNAL}` +
    `<span class="sb-autolink-txt">${displayLabel(url)}</span></a>`
  );
}

/**
 * Linkify HTML-escaped plain text. Returns HTML.
 * Input must already be escaped — this never escapes for you.
 *
 * `selfHost` (see internalHost) marks which host counts as same-app: links to
 * it navigate in the current window rather than opening a new tab.
 */
export function linkifyEscaped(escaped: string, selfHost?: string): string {
  const self = (selfHost || "").replace(/^www\./i, "").toLowerCase();
  return scanUrls(escaped, (url, href) =>
    anchor(href, url, !!self && hostOf(url) === self)
  );
}

/**
 * Replace every URL with its display label — no anchor, no chip. Used for
 * truncated previews (task cards, calendar entries) where the whole row is
 * already a click target and a raw "https://…" would eat the line budget.
 */
export function shortenUrls(escaped: string): string {
  return scanUrls(escaped, (url) => displayLabel(url));
}

/**
 * Walk the escaped text and hand every valid URL to `render`, splicing the
 * result in place of the original. Returns the input untouched when no URL is
 * found, so the common case allocates nothing.
 */
function scanUrls(
  escaped: string,
  render: (url: string, href: string) => string
): string {
  if (!escaped) return escaped;
  URL_RE.lastIndex = 0;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(escaped))) {
    const raw = m[0];
    const url = trimTrailing(raw);
    const start = m.index;
    URL_RE.lastIndex = start + raw.length;
    if (!url) continue;
    const href = safeHref(url);
    if (!href) continue;
    out += escaped.slice(last, start);
    out += render(url, href);
    last = start + url.length;
  }
  if (!last) return escaped;
  return out + escaped.slice(last);
}

/**
 * Linkify the text nodes of an HTML fragment, skipping anything already inside
 * an <a> element (and inside <script>/<style>, which should never appear here
 * but are cheap to guard). `selfHost` behaves as in linkifyEscaped.
 */
export function linkifyHtml(html: string, selfHost?: string): string {
  if (!html) return html;
  const tagRe = /<[^>]*>/g;
  let out = "";
  let last = 0;
  let skipDepth = 0;
  let m: RegExpExecArray | null;
  const emit = (text: string) =>
    (out += skipDepth > 0 ? text : linkifyEscaped(text, selfHost));

  while ((m = tagRe.exec(html))) {
    emit(html.slice(last, m.index));
    const tag = m[0];
    out += tag;
    last = m.index + tag.length;
    const name = (tag.match(/^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/) || []) as any;
    const closing = name[1] === "/";
    const el = (name[2] || "").toLowerCase();
    if (el === "a" || el === "script" || el === "style") {
      if (closing) skipDepth = Math.max(0, skipDepth - 1);
      else if (!/\/\s*>$/.test(tag)) skipDepth++;
    }
  }
  emit(html.slice(last));
  return out;
}

/**
 * Stylesheet for the auto-link chips. Widgets concatenate this into their own
 * <style> block so the chip looks identical everywhere; `--accent` is picked up
 * from the host widget's theme variables when present.
 */
export const AUTOLINK_CSS = `
  .${AUTOLINK_CLASS}{display:inline-flex;align-items:center;gap:4px;max-width:100%;
    vertical-align:baseline;margin:0 1px;padding:1px 7px 1px 6px;border-radius:11px;
    background:rgba(15,23,42,.055);border:1px solid rgba(15,23,42,.09);
    color:inherit;text-decoration:none;font-size:.92em;line-height:1.5;
    transition:background .12s,border-color .12s}
  .${AUTOLINK_CLASS}:hover{background:rgba(15,23,42,.1);border-color:rgba(15,23,42,.16);text-decoration:none}
  .${AUTOLINK_CLASS}:focus-visible{outline:2px solid var(--accent,#2563eb);outline-offset:1px}
  .${AUTOLINK_CLASS} .sb-autolink-ico{width:11px;height:11px;flex-shrink:0;opacity:.55}
  /* The label is the full URL, so let the chip take the width it can get and
     ellipsize only what genuinely doesn't fit. min-width:0 is required or the
     flex item refuses to shrink below its content and overflows instead. */
  .${AUTOLINK_CLASS} .sb-autolink-txt{min-width:0;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap}
  .${AUTOLINK_CLASS}-int .sb-autolink-ico{opacity:.75}
`;
