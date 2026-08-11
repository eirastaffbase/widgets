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
 * Display label for a URL: the whole URL minus the scheme, a leading "www." and
 * a trailing slash.
 *
 * A same-app link keeps only a hint of its host — the first DNS label, elided —
 * rather than the whole thing. The reader is already on that host, so spelling
 * it out in full says little and crowds out the path, but dropping it entirely
 * loses the cue that this is a link at all. An external link keeps its full
 * domain, since there the domain is the most important thing to show.
 *
 *   internal:  harristeeter-demo…/content/form/6a7b815efeae020a98098727
 *   external:  google.com/search?q=hello
 *
 * The path is never elided. Long URLs are handled visually instead: the chip is
 * capped at the container width and ellipsizes via CSS, so the label stays
 * selectable/copyable and never loses the middle of a path.
 */
function displayLabel(escapedUrl: string, internal?: boolean): string {
  const base = escapedUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const shown = internal ? hintHost(stripOpenlink(base)) : base;
  // Keep a bare "host/" or "host…/" readable rather than leaving a lone slash.
  return shown.replace(/(.)\/+$/, "$1");
}

/**
 * Drop a leading "/openlink" path segment from a "host/path" string.
 * See stripOpenlinkUrl — this is the same transform, applied to the label so it
 * matches where the link actually points.
 */
function stripOpenlink(hostAndPath: string): string {
  return hostAndPath.replace(/^([^/?#]+)\/openlink(?=[/?#]|$)/i, "$1");
}

/**
 * Replace the host of a "host/path" string with a shortened hint. Used for
 * same-app links only, where the reader is already on that host.
 *
 * A short subdomain is shown whole ("hi.staffbase.com/x" → "hi…/x"). A long one
 * gets cut short and keeps the TLD, so the hint stays recognisable as a domain
 * instead of trailing off into nothing:
 *
 *   ucfuirfeoreoif.staffbase.com/whatever → ucfuirfeo…com/whatever
 */
const MAX_HOST_HINT = 12;
const HOST_HINT_KEEP = 9;

function hintHost(hostAndPath: string): string {
  const cut = hostAndPath.search(/[/?#]/);
  const host = cut < 0 ? hostAndPath : hostAndPath.slice(0, cut);
  const rest = cut < 0 ? "" : hostAndPath.slice(cut);

  const labels = host.split(".");
  const first = labels[0];
  if (labels.length < 2) return first + rest;

  const hint =
    first.length > MAX_HOST_HINT
      ? `${first.slice(0, HOST_HINT_KEEP)}…${labels[labels.length - 1]}`
      : `${first}…`;
  return hint + rest;
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
 *
 * Same-app links reproduce the markup Staffbase's own editor emits for an
 * internal link, which is known to route correctly in the mobile app:
 *
 *   <a class="internal-link colored clickable" href="https://host/content/...">
 *
 * That includes carrying *no* `target`. The app appears to key off these
 * classes to decide a link is its own and should be handled in-app; an
 * unrecognised anchor gets punted to the outer shell, which is the likeliest
 * cause of same-app links either bouncing out to the system browser or landing
 * on the home screen. External links open in a new tab as usual.
 *
 * The href is otherwise the URL exactly as pasted, except that a same-app link
 * has its "/openlink" segment removed — that's the share/copy-link redirect
 * wrapper, and the known-good markup above points straight at "/content/...".
 * Note this was tried once before and didn't help, but that was without the
 * internal-link classes; the two may only work as a pair.
 *
 * One thing deliberately *not* done: rewriting same-app links to a root-relative
 * path ("/content/form/<id>"). That works in a browser tab, but the widget runs
 * in a webview whose document base isn't the site root, so the path resolved
 * against the wrong base and dumped the user on the home screen.
 */
const INTERNAL_LINK_CLASSES = "internal-link colored clickable";

/** Drop the "/openlink" redirect wrapper from an absolute same-app URL. */
function stripOpenlinkUrl(absoluteUrl: string): string {
  return absoluteUrl.replace(
    /^(https?:\/\/[^/?#]+)\/openlink(?=[/?#]|$)/i,
    "$1"
  );
}

function anchor(href: string, url: string, internal: boolean): string {
  const cls = internal
    ? `${AUTOLINK_CLASS} ${AUTOLINK_CLASS}-int ${INTERNAL_LINK_CLASSES}`
    : AUTOLINK_CLASS;
  const rel = internal ? "" : ' target="_blank" rel="noopener noreferrer"';
  return (
    `<a class="${cls}" href="${internal ? stripOpenlinkUrl(href) : href}" title="${url}"${rel}>` +
    `${internal ? ICON_INTERNAL : ICON_EXTERNAL}` +
    `<span class="sb-autolink-txt">${displayLabel(url, internal)}</span></a>`
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

/** Class applied to the shortened URL text in previews (not a link). */
export const AUTOLINK_TEXT_CLASS = "sb-autolink-plain";

/**
 * Replace every URL with its display label, wrapped in a non-interactive span
 * tinted with the widget's primary colour. Used for truncated previews (task
 * cards, calendar entries) where the whole row is already a click target, so a
 * real link would fight with it — but the URL should still read as a URL rather
 * than disappearing into the surrounding prose.
 *
 * `selfHost` (see internalHost) matters here for labelling only: same-app links
 * are shown as a bare path, matching how they read in the detail view.
 */
export function shortenUrls(escaped: string, selfHost?: string): string {
  const self = (selfHost || "").replace(/^www\./i, "").toLowerCase();
  return scanUrls(escaped, (url) => {
    const label = displayLabel(url, !!self && hostOf(url) === self);
    return `<span class="${AUTOLINK_TEXT_CLASS}">${label}</span>`;
  });
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
  /* Shortened URL text in card/calendar previews. Not a link — the row itself
     is the click target — but tinted so it still reads as a URL. Inherits the
     preview's own line-clamping, so no overflow handling of its own. */
  .${AUTOLINK_TEXT_CLASS}{color:var(--primary,#2563eb);font-weight:500}
`;
