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

// A long raw URL wrecks the layout of a description or comment, so the chip
// shows a trimmed label instead and keeps the full URL in `title`.
const MAX_LABEL = 38;

/**
 * Human-friendly label for a URL: drop the scheme, "www." and any trailing
 * slash, then middle-ellipsize the path if it's still too long. Operates on the
 * escaped form, so slicing is done on entity boundaries to avoid cutting an
 * entity such as "&amp;" in half.
 */
function shortLabel(escapedUrl: string): string {
  let s = escapedUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  if (s.length <= MAX_LABEL) return s;

  const slash = s.indexOf("/");
  const host = slash < 0 ? s : s.slice(0, slash);
  const rest = slash < 0 ? "" : s.slice(slash);
  if (!rest) return sliceEntitySafe(s, MAX_LABEL - 1) + "…";

  // Keep the host intact and show the tail of the path — that's the part that
  // actually identifies the page.
  const budget = MAX_LABEL - host.length - 1;
  if (budget < 6) return sliceEntitySafe(host, MAX_LABEL - 1) + "…";
  return host + "/…" + tailEntitySafe(rest, budget - 2);
}

/** Slice from the start without splitting an HTML entity. */
function sliceEntitySafe(s: string, n: number): string {
  let out = s.slice(0, n);
  const dangling = out.match(/&[a-z#0-9]*$/i);
  return dangling ? out.slice(0, -dangling[0].length) : out;
}

/** Slice from the end without splitting an HTML entity. */
function tailEntitySafe(s: string, n: number): string {
  let out = s.slice(-n);
  const dangling = out.match(/^[a-z#0-9]*;/i);
  return dangling && s.slice(0, s.length - out.length).lastIndexOf("&") >= 0
    ? out.slice(dangling[0].length)
    : out;
}

/** Class applied to every auto-detected link; widgets style it as a chip. */
export const AUTOLINK_CLASS = "sb-autolink";

const LINK_ICON =
  '<svg class="sb-autolink-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
  '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

/** Build the anchor markup for one detected URL (input already escaped). */
function anchor(href: string, url: string): string {
  return (
    `<a class="${AUTOLINK_CLASS}" href="${href}" title="${url}" ` +
    `target="_blank" rel="noopener noreferrer">${LINK_ICON}` +
    `<span class="sb-autolink-txt">${shortLabel(url)}</span></a>`
  );
}

/**
 * Linkify HTML-escaped plain text. Returns HTML.
 * Input must already be escaped — this never escapes for you.
 */
export function linkifyEscaped(escaped: string): string {
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
    out += anchor(href, url);
    last = start + url.length;
  }
  if (!last) return escaped;
  return out + escaped.slice(last);
}

/**
 * Linkify the text nodes of an HTML fragment, skipping anything already inside
 * an <a> element (and inside <script>/<style>, which should never appear here
 * but are cheap to guard).
 */
export function linkifyHtml(html: string): string {
  if (!html) return html;
  const tagRe = /<[^>]*>/g;
  let out = "";
  let last = 0;
  let skipDepth = 0;
  let m: RegExpExecArray | null;
  const emit = (text: string) =>
    (out += skipDepth > 0 ? text : linkifyEscaped(text));

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
  .${AUTOLINK_CLASS} .sb-autolink-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;
