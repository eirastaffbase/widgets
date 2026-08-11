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
 * a trailing slash, with the path middle-elided when it's too long.
 *
 * Two rules, differing on one point — how much of the host to show:
 *
 *   external:  google.com/search?q=hello
 *              docs.example.com/guides/…/publishing
 *   internal:  harris…/content/…/6a7b815efeae020a98098727
 *
 * An external link keeps its full domain: on the open web the domain is the
 * security signal, and truncating it is the shape phishing imitates (see the
 * Chromium URL Display Guidelines and NN/g's "URL as UI"). A same-app link is
 * different — the reader is already on that host, inside an internal comms
 * platform, so the domain carries no trust information and is just noise. It's
 * cut to a short hint that keeps the cue "this is a link" without eating the
 * line.
 *
 * The path follows the usual convention: keep the first and last segments,
 * elide the middle. Those are the meaningful ends — the first says which area
 * of the site, the last identifies the actual resource. The full URL stays in
 * the anchor's `title` for anyone who wants it.
 */
function displayLabel(escapedUrl: string, internal?: boolean): string {
  const base = escapedUrl.replace(/^https?:\/\//i, "").replace(/^www\./i, "");

  const cut = base.search(/[/?#]/);
  const host = cut < 0 ? base : base.slice(0, cut);
  const rest = cut < 0 ? "" : base.slice(cut);

  return (internal ? hintHost(host) : host) + elidePath(rest);
}

// Host hint for same-app links: enough to recognise, not enough to dominate.
const HOST_HINT_KEEP = 6;

/**
 * Shorten a host to a recognisable hint ("harristeeter-demo.staffbase.rocks" →
 * "harris…"). Left alone when it's already at or under the budget, so short
 * hosts don't gain a pointless ellipsis.
 */
function hintHost(host: string): string {
  return host.length <= HOST_HINT_KEEP ? host : `${host.slice(0, HOST_HINT_KEEP)}…`;
}

// Longest path we render in full before eliding the middle.
const MAX_PATH = 28;
// Tail of the final segment kept when that segment is itself very long.
const LEAF_KEEP = 12;

/**
 * Middle-elide a path, keeping the first and last segments:
 *
 *   /content/form/6a7b…/test  →  /content/…/test
 *   /a/b/c                    →  /a/b/c            (already short)
 *
 * Query and fragment are dropped — they're rarely meaningful to a reader and
 * routinely long (tracking parameters especially). A trailing slash goes too.
 */
function elidePath(rest: string): string {
  const path = rest.split(/[?#]/)[0].replace(/\/+$/, "");
  if (!path || path === "/") return "";
  if (path.length <= MAX_PATH) return path;

  const segs = path.split("/").filter(Boolean);
  const leaf = segs[segs.length - 1];
  // A single long segment has no middle to elide, so trim its head instead —
  // the tail is the part that distinguishes one id from another.
  if (segs.length < 2) return `/…${sliceTail(leaf, LEAF_KEEP)}`;

  const short = `/${segs[0]}/…/${leaf}`;
  if (short.length <= MAX_PATH) return short;
  return `/${segs[0]}/…${sliceTail(leaf, LEAF_KEEP)}`;
}

/** Last `n` characters, without splitting a trailing HTML entity. */
function sliceTail(s: string, n: number): string {
  if (s.length <= n) return s;
  const out = s.slice(-n);
  // The input is escaped, so a cut can land inside "&amp;" — drop the fragment.
  const partial = out.indexOf(";");
  const amp = out.indexOf("&");
  return partial >= 0 && (amp < 0 || partial < amp) ? out.slice(partial + 1) : out;
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

/**
 * Whether a URL points at same-app content, and if so the in-app path it maps to
 * ("https://app.example.com/openlink/content/form/x" → "/content/form/x").
 * Returns null for anything that should be treated as external.
 *
 * Kept deliberately conservative: disagreeing with the host app about what
 * "internal" means is how you end up rendering an in-app link that then
 * navigates away.
 *
 * Excluded because they aren't pages:
 *   /api/       — the REST API
 *   /external/  — external-redirect route
 *   /url/, /lp/ — link-tracking and landing-page redirectors
 *
 * `/openlink/` is the share/copy-link wrapper and resolves to the same
 * destination without it.
 *
 * Input is HTML-escaped, which only affects the query string ("&" as "&amp;").
 * Every rule below looks at the path alone, so that's harmless.
 */
export function parseInternalLink(
  escapedUrl: string,
  selfHost: string
): string | null {
  const self = (selfHost || "").replace(/^www\./i, "").toLowerCase();
  if (!escapedUrl || !self) return null;

  // Path is matched case-insensitively; the query is left untouched.
  const q = escapedUrl.indexOf("?");
  let link =
    q < 0
      ? escapedUrl.toLowerCase()
      : escapedUrl.slice(0, q).toLowerCase() + escapedUrl.slice(q);

  const abs = link.match(/^https?:\/\/([^/?#]+)(.*)$/i);
  if (abs) {
    if (abs[1].replace(/^www\./i, "") !== self) return null;
    link = abs[2] || "/";
  }
  if (link.charAt(0) !== "/") return null;

  // Only the "/openlink/" form is a wrapper; a bare "/openlink" stays put.
  if (link.indexOf("/openlink/") === 0) link = link.slice("/openlink".length);

  if (link.indexOf("/api/") !== -1) return null;
  if (link.indexOf("/external/") !== -1) return null;
  if (link.indexOf("/url/") === 0 || link.indexOf("/lp/") === 0) return null;

  return link;
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
 * Same-app links carry the platform's standard internal-link classes and no
 * `target`, so they inherit its styling and are recognisable as in-app links.
 * Navigation itself is handled by installLinkHandler. External links open in a
 * new tab as usual.
 *
 * The href is the URL exactly as pasted — nothing is rewritten.
 */
const INTERNAL_LINK_CLASSES = "internal-link colored clickable";

function anchor(href: string, url: string, internal: boolean): string {
  const cls = internal
    ? `${AUTOLINK_CLASS} ${AUTOLINK_CLASS}-int ${INTERNAL_LINK_CLASSES}`
    : AUTOLINK_CLASS;
  const rel = internal ? "" : ' target="_blank" rel="noopener noreferrer"';
  return (
    `<a class="${cls}" href="${href}" title="${url}"${rel}>` +
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
  return scanUrls(escaped, (url, href) =>
    anchor(href, url, parseInternalLink(url, selfHost || "") !== null)
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
  return scanUrls(escaped, (url) => {
    const label = displayLabel(url, parseInternalLink(url, selfHost || "") !== null);
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
 */export const AUTOLINK_CSS = `
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

// ─────────────────────────────────────────────────────────────────────────────
// In-app navigation
//
// A widget-sdk v3 widget renders inside a shadow root, so the surrounding page's
// link handling doesn't pick up anchors we render and the browser falls back to
// a full page load. In the mobile app that means the user loses their place.
//
// So the widget routes its own links: `window.NavigationMgr` is exposed for
// exactly this kind of custom code and navigates without a reload, on both web
// and mobile. Anything it can't handle falls back to an ordinary navigation.
// ─────────────────────────────────────────────────────────────────────────────

// Roots that already carry the delegated handler, so repeated renders don't
// stack duplicate listeners.
const HANDLED = new WeakSet<EventTarget>();

/**
 * Optional diagnostics sink. Widgets with a debug panel pass their own logger so
 * link routing can be traced inside the mobile WebView, where there is no
 * console to read.
 */
export type LinkLog = (...args: any[]) => void;

/**
 * One-shot snapshot of everything the in-app navigation depends on, for the
 * debug panel. Every line is a reason navigation could fail, so a user who
 * reports "the link still doesn't work" can copy this instead of guessing.
 */
export function linkEnvReport(): string[] {
  if (typeof window === "undefined") return ["link env · no window"];
  const w = window as any;
  const nav = w.NavigationMgr;
  const we = w.we;
  const out: string[] = [];

  out.push(
    "link env · NavigationMgr " +
      (!nav
        ? "MISSING (links will use a full page load)"
        : typeof nav.goTo === "function"
        ? "ok"
        : "present but goTo() missing")
  );
  out.push(
    "link env · we " +
      (!we ? "MISSING" : "ok") +
      " · native " +
      (we ? JSON.stringify(we.native) : "n/a") +
      " · hideAllTabs " +
      (nav && typeof nav.hideAllTabs === "function" ? "ok" : "missing")
  );
  // When the platform exposes its own classifier we cross-check ours against it
  // at click time, which is the fastest way to spot a rules drift.
  out.push(
    "link env · platform link parser " +
      (we && we.util && we.util.ui && typeof we.util.ui.parseInternalLink === "function"
        ? "ok (ours will be cross-checked)"
        : "unavailable (ours only)")
  );
  out.push("link env · origin " + location.origin + " · href " + location.href);
  return out;
}

/** Ask the platform's own classifier, when it happens to be reachable. */
function realParseInternalLink(href: string): string | null | undefined {
  const w = window as any;
  const fn = w && w.we && w.we.util && w.we.util.ui && w.we.util.ui.parseInternalLink;
  if (typeof fn !== "function") return undefined;
  try {
    return fn(href);
  } catch (_) {
    return undefined;
  }
}

export interface LinkHandlerOptions {
  /** Diagnostics sink — see LinkLog. */
  log?: LinkLog;
  /**
   * Run just before routing away, so the widget can dismiss anything it has
   * open. The detail sheet and its backdrop would otherwise stay on screen
   * during the transition and, since routing doesn't reload the page, still be
   * sitting there on the destination.
   */
  beforeNavigate?: () => void;
}

/**
 * Route clicks on same-app auto-links through the platform's router.
 *
 * Call once per render with the container the widget was given (its shadow
 * root). `document` is bound too, because panels and modals are appended to
 * document.body — outside the shadow root — so those links would otherwise be
 * unhandled as well.
 *
 * External links are left completely alone: they keep target="_blank" and the
 * browser opens them as usual.
 */
export function installLinkHandler(
  container: EventTarget | null,
  selfHost?: string,
  opts?: LinkHandlerOptions
): void {
  bindLinkHandler(container, selfHost, opts);
  bindLinkHandler(typeof document !== "undefined" ? document : null, selfHost, opts);
}

function bindLinkHandler(
  root: EventTarget | null,
  selfHost?: string,
  opts?: LinkHandlerOptions
): void {
  if (!root || HANDLED.has(root)) return;
  HANDLED.add(root);
  // Capture phase, so the link is resolved before a surrounding card's own click
  // handler can treat it as a click on the card.
  root.addEventListener(
    "click",
    (ev) => onLinkClick(ev as MouseEvent, selfHost, opts),
    true
  );
}

function onLinkClick(ev: MouseEvent, selfHost?: string, opts?: LinkHandlerOptions): void {
  const log = opts && opts.log;
  if (ev.defaultPrevented) return;
  // Leave modified clicks to the browser: cmd/ctrl-click, middle-click and
  // shift-click all have meanings a reader expects to keep working.
  if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) {
    return;
  }

  const target = ev.target as Element | null;
  if (!target || typeof target.closest !== "function") return;
  const a = target.closest(`a.${AUTOLINK_CLASS}`) as HTMLAnchorElement | null;
  if (!a) return;

  const href = a.getAttribute("href") || "";
  const path = parseInternalLink(href, selfHost || "");

  if (log) {
    log("link click · href", href, "· selfHost", selfHost || "(none)");
    log("link click · internal path", path === null ? "null (external → new tab)" : path);
    // A disagreement here means our rules have drifted from the platform's.
    const real = realParseInternalLink(href);
    if (real !== undefined && real !== path) {
      log("link click · WARNING ours/platform disagree · platform says", real === null ? "null" : real);
    }
  }

  if (!path) return;

  ev.preventDefault();
  ev.stopPropagation();

  if (opts && opts.beforeNavigate) {
    try {
      opts.beforeNavigate();
      if (log) log("link nav · dismissed open panels");
    } catch (e: any) {
      // Never let a dismissal problem swallow the navigation itself.
      if (log) log("link nav · beforeNavigate threw", (e && e.message) || String(e));
    }
  }

  goToInApp(path, log);
}

/** Navigate to an in-app path, falling back to a plain load if the app's router isn't there. */
function goToInApp(path: string, log?: LinkLog): void {
  const w = window as any;
  const nav = w.NavigationMgr;
  if (nav && typeof nav.goTo === "function") {
    try {
      // On mobile the tab overlays are dismissed before routing.
      if (w.we && w.we.native && typeof nav.hideAllTabs === "function") {
        if (log) log("link nav · native", JSON.stringify(w.we.native), "· hideAllTabs()");
        nav.hideAllTabs();
      }
      if (log) log("link nav · NavigationMgr.goTo", path);
      nav.goTo(path);
      if (log) log("link nav · goTo returned ok");
      return;
    } catch (e: any) {
      // Router present but unhappy — fall through rather than dead-ending.
      if (log) log("link nav · goTo THREW", (e && e.message) || String(e), "· falling back");
    }
  } else if (log) {
    log("link nav · NavigationMgr unavailable · falling back to location.assign");
  }
  if (log) log("link nav · location.assign", path);
  window.location.assign(path);
}
