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
    out += `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
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
