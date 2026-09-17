/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ../tasks/shared/i18n.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared i18n engine for the Staffbase task widgets.
//
// Imported by each widget via a relative path (e.g. `../shared/i18n`). webpack
// inlines it into each bundle — there is no runtime/package dependency.
//
// Design rules:
//  - Dependency-free, ES2015-compatible (matches each widget's tsconfig target).
//  - DOM/browser globals are accessed defensively (guarded) so the module is
//    safe to load in any widget context.
//  - The default/source locale is always `en_US`. For `en_US` (or any unmatched
//    locale) the helpers resolve to the exact source strings — so a widget that
//    only ships an `en_US` bundle behaves identically to having no i18n at all.
// ─────────────────────────────────────────────────────────────────────────────
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const DEFAULT_LOCALE = "en_US";
// Language prefixes that render right-to-left (from the Staffbase locale table:
// every entry flagged `direction: right_to_left`).
const RTL_LANGS = ["ar", "fa", "he", "ur", "ps"];
/** Split a raw locale string into a normalized `{ lang, region }`. */
function parts(raw) {
    // Accept `en-US`, `en_US`, `EN`, `zh-hk`, etc.
    const cleaned = (raw || "").trim().replace(/-/g, "_");
    const seg = cleaned.split("_");
    const lang = (seg[0] || "").toLowerCase();
    const region = (seg[1] || "").toUpperCase();
    return { lang, region };
}
/** Normalize any locale string to canonical `lang_REGION` (or just `lang`). */
function normalizeLocale(raw) {
    const { lang, region } = parts(raw);
    if (!lang)
        return "";
    return region ? lang + "_" + region : lang;
}
/**
 * Resolve a requested locale against the set of bundles we actually ship.
 * Match order: exact → same-language → DEFAULT_LOCALE.
 *
 *   resolveLocale("es_MX", ["en_US","es_ES"]) -> "es_ES"
 *   resolveLocale("de-DE", ["en_US","de_DE"]) -> "de_DE"
 *   resolveLocale("pt_PT", ["en_US","de_DE"]) -> "en_US"
 */
function resolveLocale(raw, available) {
    const norm = normalizeLocale(raw);
    if (!norm)
        return DEFAULT_LOCALE;
    // Exact (compare normalized on both sides so casing/dashes don't matter).
    for (const a of available) {
        if (normalizeLocale(a) === norm)
            return a;
    }
    // Same language, any region.
    const lang = parts(norm).lang;
    for (const a of available) {
        if (parts(a).lang === lang)
            return a;
    }
    return DEFAULT_LOCALE;
}
/** True when the locale's language renders right-to-left. */
function isRtl(locale) {
    return RTL_LANGS.indexOf(parts(locale).lang) !== -1;
}
/**
 * Pick the best locale for the current viewer.
 * Priority: explicit `configLocale` (authoritative Staffbase user locale) →
 * `navigator.language` (browser fallback) → DEFAULT_LOCALE.
 *
 * `configLocale` is read by the widget from `GET /api/users/{id}` → config.locale
 * (the only field that reflects the user's Staffbase language). It is passed in
 * rather than fetched here so this module stays free of auth/transport concerns.
 */
function detectLocale(opts) {
    const navLang = typeof navigator !== "undefined"
        ? navigator.language || ""
        : "";
    const candidates = [opts.configLocale || "", navLang];
    for (const c of candidates) {
        if (!c)
            continue;
        const r = resolveLocale(c, opts.available);
        // resolveLocale returns DEFAULT when nothing matched; only accept a
        // candidate if it actually produced a non-default match OR the default is
        // genuinely the best (its own language).
        if (r !== DEFAULT_LOCALE || parts(c).lang === parts(DEFAULT_LOCALE).lang) {
            return r;
        }
    }
    return resolveLocale(DEFAULT_LOCALE, opts.available);
}
/**
 * Build a translation function bound to `locale`.
 * Lookup order per key: requested locale → DEFAULT_LOCALE → the key itself.
 * Missing translations therefore degrade to English, never to blank/broken UI.
 *
 *   const t = makeT(STRINGS, "de_DE");
 *   t("refresh") // German if present, else English, else "refresh"
 */
// ─────────────────────────────────────────────────────────────────────────────
// On-demand content translation (Phase B "Translate" button).
//
// Free-text user content (task titles, descriptions, custom type names,
// comments) is translated on demand via Staffbase's POST /api/translations.
// Items are batched into one request as indexed <p> tags — the endpoint
// preserves tags and translates only text nodes, so we map results back by
// index. Transport/auth is supplied by the caller via `send` so this module
// stays free of endpoint/auth concerns.
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function unescHtml(s) {
    return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
/**
 * Translate a set of strings in a single batched request.
 * Returns a map of original-text → translated-text (only for non-empty inputs).
 * On any failure the map is empty (caller falls back to originals).
 *
 * `send(payload)` must POST the payload to /api/translations and resolve with
 * the translated `contents.value` string.
 */
function translateMap(texts, send) {
    return __awaiter(this, void 0, void 0, function* () {
        const map = {};
        const uniq = [];
        const seen = {};
        for (const raw of texts) {
            const t = (raw || "").trim();
            if (t && !seen[t]) {
                seen[t] = true;
                uniq.push(t);
            }
        }
        if (!uniq.length)
            return map;
        const payload = uniq.map((t, i) => `<p data-i="${i}">${escHtml(t)}</p>`).join("");
        let resp;
        try {
            resp = yield send(payload);
        }
        catch (_) {
            return map;
        }
        const re = /<p data-i="(\d+)">([\s\S]*?)<\/p>/g;
        let m;
        while ((m = re.exec(resp))) {
            const i = parseInt(m[1], 10);
            if (uniq[i] != null)
                map[uniq[i]] = unescHtml(m[2]);
        }
        return map;
    });
}
function makeT(bundles, locale) {
    const primary = bundles[locale] || {};
    const fallback = bundles[DEFAULT_LOCALE] || {};
    return function t(key) {
        if (primary[key] != null)
            return primary[key];
        if (fallback[key] != null)
            return fallback[key];
        return key;
    };
}

;// ./api.ts
// ─────────────────────────────────────────────────────────────────────────────
// API layer + auth ladder for the mixed feed.
//
// Two identities are available to a widget, and they reach different data:
//
//   token   — Basic API token. A *service* identity, not a user. Works for
//             /channels, /channels/{id}/posts, /posts/{id}, /users, /groups
//             and /theming.
//   session — the logged-in viewer's cookie + CSRF. Required for anything the
//             backend declares USER-only, and required for any write so the
//             action is attributed to a real person rather than the token.
//
// Verified live against bimbo.staffbase.rocks:
//   GET /posts/{id}/comments        → 403 under token (USER-only), fine under session.
//   GET /comments?parentId=…        → parentId/parentID are IGNORED; the endpoint
//                                     returns every comment in the branch (216 here).
//                                     `filter=` rejects both `parentID` and `rootID`
//                                     as "not a valid filter field", so there is no
//                                     server-side way to scope comments to a post
//                                     under the token. Hence the two-tier read below.
//   GET /reactions?parentId=&parentType=post → USER-only, so likes ride the session.
//
// Both option factories are ported from `tasks/my-tasks-widget.ts`
// (apiOpts / readCsrf / sessionOpts) — the current pattern across these widgets.
// ─────────────────────────────────────────────────────────────────────────────
var api_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// ── Identities ───────────────────────────────────────────────────────────────
const makeApiOpts = (apiToken) => (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: Object.assign({ Authorization: `Basic ${apiToken}`, Accept: "application/json" }, ((extra === null || extra === void 0 ? void 0 : extra.headers) || {})) }));
/** Confirmed CSRF source in both web and mobile widget contexts is
 *  `window.we.authMgr.csrfToken`; the rest are defensive fallbacks. */
function readCsrf() {
    var _a, _b;
    const w = window;
    try {
        const t = (_b = (_a = w.we) === null || _a === void 0 ? void 0 : _a.authMgr) === null || _b === void 0 ? void 0 : _b.csrfToken;
        if (t)
            return String(t);
    }
    catch (_) { /* not available */ }
    if (w.csrfToken)
        return String(w.csrfToken);
    const m = document.cookie.match(/(?:^|;\s*)(?:csrf|XSRF-TOKEN|csrftoken)=([^;]+)/i);
    if (m)
        return decodeURIComponent(m[1]);
    const meta = document.querySelector('meta[name="csrf-token"]');
    return (meta === null || meta === void 0 ? void 0 : meta.content) || "";
}
const sessionOpts = (extra) => {
    const csrf = readCsrf();
    return Object.assign(Object.assign({}, extra), { credentials: "include", headers: Object.assign(Object.assign({ Accept: "application/json" }, (csrf ? { "x-csrf-token": csrf } : {})), ((extra === null || extra === void 0 ? void 0 : extra.headers) || {})) });
};
function getJson(url, opts, log) {
    return api_awaiter(this, void 0, void 0, function* () {
        try {
            const r = yield fetch(url, opts);
            if (!r.ok) {
                log("GET", url, "←", r.status);
                return null;
            }
            return (yield r.json());
        }
        catch (e) {
            log("GET", url, "failed —", e && e.message);
            return null;
        }
    });
}
/** Try each identity in order and take the first that answers. Endpoints differ
 *  in which identity they accept, and the useful order is not the same for all
 *  of them, so callers pass the ladder they need. */
function getJsonAny(url, ladder, log, extra) {
    return api_awaiter(this, void 0, void 0, function* () {
        for (const opts of ladder) {
            const out = yield getJson(url, opts(extra), log);
            if (out)
                return out;
        }
        return null;
    });
}
// ── Channels ─────────────────────────────────────────────────────────────────
/** All channels in the branch, keyed by id.
 *
 *  Fetched in one call rather than per-id: the widget needs every configured
 *  channel's `contentType` and localized title before it can classify or label
 *  anything, and the branch-wide list is a single cheap request. */
function fetchChannels(base, ladder, log) {
    return api_awaiter(this, void 0, void 0, function* () {
        const out = new Map();
        const d = yield getJsonAny(`${base}/channels?limit=200`, ladder, log);
        for (const c of (d && d.data) || [])
            if (c && c.id)
                out.set(c.id, c);
        log(`loaded ${out.size} channels`);
        return out;
    });
}
/** Posts for one channel. Resolves to `[]` rather than rejecting, so a channel
 *  the viewer cannot read degrades to "absent" instead of failing the feed. */
function fetchChannelPosts(base, channelId, limit, ladder, log) {
    return api_awaiter(this, void 0, void 0, function* () {
        const d = yield getJsonAny(`${base}/channels/${encodeURIComponent(channelId)}/posts?limit=${limit}`, ladder, log);
        return (d && d.data) || [];
    });
}
function fetchPost(base, postId, ladder, log) {
    return api_awaiter(this, void 0, void 0, function* () {
        return getJsonAny(`${base}/posts/${encodeURIComponent(postId)}`, ladder, log);
    });
}
// ── Likes ────────────────────────────────────────────────────────────────────
//
// `/reactions` is USER-only, so both calls ride the session. The count endpoint
// returns a typed breakdown; we only surface LIKE.
function fetchLikeState(base, postId, viewerId, log) {
    return api_awaiter(this, void 0, void 0, function* () {
        const q = `parentId=${encodeURIComponent(postId)}&parentType=post`;
        const reqs = [getJson(`${base}/reactions-count?${q}`, sessionOpts(), log)];
        if (viewerId)
            reqs.push(getJson(`${base}/reactions?${q}&userId=${encodeURIComponent(viewerId)}`, sessionOpts(), log));
        const [countJson, mineJson] = yield Promise.all(reqs);
        if (!countJson)
            return null;
        const row = (countJson.data || []).find(x => x && x.type === "LIKE");
        return {
            count: (row && Number(row.count)) || 0,
            mine: ((mineJson && mineJson.data) || []).some((x) => x && x.type === "LIKE"),
        };
    });
}
function setLike(base, postId, liked) {
    return api_awaiter(this, void 0, void 0, function* () {
        const q = `parentId=${encodeURIComponent(postId)}&parentType=post`;
        try {
            const r = liked
                ? yield fetch(`${base}/reactions`, sessionOpts({
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ parentId: postId, parentType: "post", type: "LIKE" }),
                }))
                : yield fetch(`${base}/reactions?${q}`, sessionOpts({ method: "DELETE" }));
            return r.ok;
        }
        catch (_) {
            return false;
        }
    });
}
// ── Comments ─────────────────────────────────────────────────────────────────
//
// Same read/write split the task widgets use: reads prefer whatever identity can
// answer, writes must be the session so the comment is attributed to the viewer.
//
// Reading is two-tier because there is no way to scope /comments to a post under
// the token (see the header note):
//   1. GET /posts/{id}/comments under session — the correct per-post endpoint.
//   2. Fallback: page /comments once for the whole branch under the token and
//      group by `parentID`. Cached, so the cost is paid at most once.
let allCommentsCache = null;
function commentRows(d) {
    if (!d)
        return [];
    return Array.isArray(d) ? d : (d.data || []);
}
function fetchAllCommentsGrouped(base, ladder, cap, log) {
    return api_awaiter(this, void 0, void 0, function* () {
        const grouped = new Map();
        const page = 100;
        for (let offset = 0; offset < cap; offset += page) {
            const d = yield getJsonAny(`${base}/comments?limit=${page}&offset=${offset}`, ladder, log);
            const rows = commentRows(d);
            for (const c of rows) {
                const parent = String(c.parentID || c.parentId || "");
                if (!parent)
                    continue;
                const list = grouped.get(parent);
                if (list)
                    list.push(c);
                else
                    grouped.set(parent, [c]);
            }
            const total = (d && typeof d.total === "number") ? d.total : rows.length;
            if (rows.length < page || offset + page >= total)
                break;
        }
        log(`grouped comments for ${grouped.size} parents`);
        return grouped;
    });
}
function fetchComments(base, postId, ladder, cap, log) {
    return api_awaiter(this, void 0, void 0, function* () {
        const direct = yield getJson(`${base}/posts/${encodeURIComponent(postId)}/comments?limit=100`, sessionOpts(), log);
        if (direct)
            return commentRows(direct);
        if (!allCommentsCache)
            allCommentsCache = fetchAllCommentsGrouped(base, ladder, cap, log);
        const grouped = yield allCommentsCache;
        return grouped.get(postId) || [];
    });
}
/** Post a comment as the logged-in viewer. Returns the created row when the API
 *  echoes one, so the caller can render it without a refetch. */
function postComment(base, postId, text) {
    return api_awaiter(this, void 0, void 0, function* () {
        const body = JSON.stringify({ text: `<p>${escapeHtml(text)}</p>` });
        try {
            const r = yield fetch(`${base}/posts/${encodeURIComponent(postId)}/comments`, sessionOpts({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
            }));
            if (!r.ok)
                throw new Error(`HTTP ${r.status}`);
            // A fresh comment invalidates the bulk fallback cache.
            allCommentsCache = null;
            try {
                return (yield r.json());
            }
            catch (_) {
                return null;
            }
        }
        catch (_) {
            return null;
        }
    });
}
// ── Posting ──────────────────────────────────────────────────────────────────
/** Create a social post as the logged-in viewer (session + CSRF), so it carries a
 *  real author id and avatar and the viewer can be liked/commented back. */
function createPost(base, channelId, locale, text) {
    return api_awaiter(this, void 0, void 0, function* () {
        const html = text.split(/\n{2,}/).map(par => `<p>${escapeHtml(par).replace(/\n/g, "<br>")}</p>`).join("");
        const body = JSON.stringify({
            contents: { [locale]: { title: text.slice(0, 120), content: html } },
            published: true,
            commentingEnabled: true,
            likingEnabled: true,
            notificationChannels: [],
        });
        try {
            const r = yield fetch(`${base}/channels/${encodeURIComponent(channelId)}/posts`, sessionOpts({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
            }));
            if (!r.ok)
                throw new Error(`HTTP ${r.status}`);
            return (yield r.json());
        }
        catch (_) {
            return null;
        }
    });
}
// ── Users ────────────────────────────────────────────────────────────────────
function fetchUser(base, userId, ladder, log) {
    return api_awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const u = yield getJsonAny(`${base}/users/${encodeURIComponent(userId)}`, ladder, log);
        if (!u)
            return null;
        return {
            name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "",
            avatarUrl: ((_b = (_a = u.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = u.avatar) === null || _c === void 0 ? void 0 : _c.thumb) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = u.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "",
        };
    });
}
/**
 * Resolve group IDs to names, one request per ID.
 *
 * Deliberately not built from `GET /groups`: on this tenant that listing
 * reports `total: 18` and omits `6aaa7d70a742e5436549bc91` — the very group the
 * production branding CSS targets — even though `GET /groups/{id}` resolves it
 * fine. Building an id→name map from the listing would therefore silently fail
 * to match exactly the groups that matter. Failures are skipped rather than
 * fatal: a missing name costs a brand rule, not the feed.
 */
function fetchGroupNames(base, groupIds, ladder, log) {
    return api_awaiter(this, void 0, void 0, function* () {
        const out = new Map();
        const unique = Array.from(new Set((groupIds || []).filter(Boolean)));
        if (!unique.length)
            return out;
        yield Promise.all(unique.map((id) => api_awaiter(this, void 0, void 0, function* () {
            const g = yield getJsonAny(`${base}/groups/${encodeURIComponent(id)}`, ladder, log);
            const name = g && (g.name || g.title);
            if (name)
                out.set(id, String(name));
        })));
        log(`resolved ${out.size}/${unique.length} group name(s)`);
        return out;
    });
}
// ── Shared escaping ──────────────────────────────────────────────────────────
function escapeHtml(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

;// ../tasks/shared/theming.ts
// Shared theming helper — pulls brand colors from the Staffbase theming API.
//
// Used by the "Use Theme Colors" config option across the task widgets. We fetch
// with the same Basic-auth API token the widgets already use, and explicitly omit
// the session cookie (credentials:"omit") so the request always resolves as the
// token's service identity — never the viewing user, who may be a different,
// theme-less account when impersonating via the login-as widget.
//
// GET {baseUrl}/theming/themes/{themeId}  ->
//   { globalTheme: { customColors: [ {id, color}, ... ], interfaceColor },
//     desktopTheme: { components: { navigation: { accentColor }, ... } } }
//
// Note: a color field (e.g. navigation.accentColor) may hold either a literal
// hex ("#FF6720") OR an *id* that references one of globalTheme.customColors
// ("legacy-text-color"), so we resolve references against the customColors map.
//
// Color choice: a configured brand color can be too light to read on the white
// widget background (widgets use primary for text/icons/borders), so we gather the
// whole palette and choose intelligently:
//   - primary = darkest still-saturated color, darkened further if needed to clear
//               a ~4.5:1 contrast ratio on white
//   - accent  = most vivid color (only used in gradients, on colored backgrounds)
var theming_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const isHex = (s) => /^#[0-9a-fA-F]{3,8}$/.test(s);
// Pure white/black are useless as an accent (invisible on light UIs / harsh),
// so we treat them as "no usable accent" and fall through to the next candidate.
const isNeutralExtreme = (s) => {
    const x = s.replace("#", "").toLowerCase();
    return x === "ffffff" || x === "fff" || x === "000000" || x === "000";
};
// ── Color math (used to pick readable colors off the theme palette) ────────────
function relLuminance(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const lin = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
// Contrast ratio of a color against white (the widget's background).
function contrastOnWhite(hex) {
    return 1.05 / (relLuminance(hex) + 0.05);
}
// Contrast ratio against the near-black stage the leaderboard renders on.
function contrastOnDark(hex) {
    return (relLuminance(hex) + 0.05) / (relLuminance("#0b0d12") + 0.05);
}
function hexToHsl(hex) {
    const x = (hex.replace("#", "") + "000000").slice(0, 6);
    const r = parseInt(x.slice(0, 2), 16) / 255, g = parseInt(x.slice(2, 4), 16) / 255, b = parseInt(x.slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2;
    let s = 0, h = 0;
    if (d) {
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        if (mx === r)
            h = ((g - b) / d) % 6;
        else if (mx === g)
            h = (b - r) / d + 2;
        else
            h = (r - g) / d + 4;
        h *= 60;
        if (h < 0)
            h += 360;
    }
    return { h, s, l };
}
function hslToHex(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60)
        [r, g, b] = [c, x, 0];
    else if (h < 120)
        [r, g, b] = [x, c, 0];
    else if (h < 180)
        [r, g, b] = [0, c, x];
    else if (h < 240)
        [r, g, b] = [0, x, c];
    else if (h < 300)
        [r, g, b] = [x, 0, c];
    else
        [r, g, b] = [c, 0, x];
    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return `#${to(r)}${to(g)}${to(b)}`;
}
// Darken a color (keep hue/saturation) until it reads on a white background.
function darkenToContrast(hex, target = 4.5) {
    let { h, s, l } = hexToHsl(hex);
    let out = hex;
    for (let i = 0; i < 50 && contrastOnWhite(out) < target && l > 0.04; i++) {
        l = Math.max(0, l - 0.02);
        out = hslToHex(h, s, l);
    }
    return out;
}
// Lighten a color (keep hue/saturation) until it reads on the dark stage.
function lightenToContrast(hex, target = 4.5) {
    let { h, s, l } = hexToHsl(hex);
    let out = hex;
    for (let i = 0; i < 60 && contrastOnDark(out) < target && l < 0.96; i++) {
        l = Math.min(1, l + 0.02);
        out = hslToHex(h, s, l);
    }
    return out;
}
// From a palette, pick the color to use ON A DARK STAGE (headlines, bars, glow):
// the most saturated color, lightened only as far as legibility demands so the
// brand hue survives. Returns "" if nothing usable.
function pickOnDark(cands) {
    const scored = cands.filter(isHex).map(hex => (Object.assign(Object.assign({ hex }, hexToHsl(hex)), { contrast: contrastOnDark(hex) })));
    let pool = scored.filter(c => c.s >= 0.35 && c.l >= 0.15 && c.l <= 0.92);
    if (!pool.length)
        pool = scored.filter(c => c.s >= 0.2);
    if (!pool.length)
        return "";
    // Most saturated first, then whichever already reads best on dark.
    pool.sort((a, b) => (b.s - a.s) || (b.contrast - a.contrast));
    return lightenToContrast(pool[0].hex, 4.5);
}
// From a palette, pick the color to use ON WHITE (names, active states, borders):
// the darkest one that's still clearly saturated, then darken further if it's
// still too light to read. Returns "" if nothing usable (caller falls back).
function pickOnWhite(cands) {
    const scored = cands.filter(isHex).map(hex => (Object.assign(Object.assign({ hex }, hexToHsl(hex)), { contrast: contrastOnWhite(hex) })));
    // Saturated, not near-white / near-black / gray.
    let pool = scored.filter(c => c.s >= 0.35 && c.l >= 0.12 && c.l <= 0.85);
    if (!pool.length)
        pool = scored.filter(c => c.s >= 0.2 && c.l <= 0.9);
    if (!pool.length)
        return "";
    // Darkest first (highest contrast on white); tie-break toward more saturated.
    pool.sort((a, b) => (b.contrast - a.contrast) || (b.s - a.s));
    return darkenToContrast(pool[0].hex, 4.5);
}
// Most vivid color in the palette (used for gradient accents, where it sits on a
// colored background so light/bright is fine). Avoids matching `exclude`.
function pickVivid(cands, exclude = "") {
    const pool = cands.filter(isHex).map(hex => (Object.assign({ hex }, hexToHsl(hex))))
        .filter(c => c.s >= 0.3 && c.l >= 0.15 && c.l <= 0.92)
        .sort((a, b) => b.s - a.s);
    if (!pool.length)
        return "";
    return (pool.find(c => c.hex.toLowerCase() !== exclude.toLowerCase()) || pool[0]).hex;
}
function fetchThemeColors(baseUrl_1, apiToken_1) {
    return theming_awaiter(this, arguments, void 0, function* (baseUrl, apiToken, themeId = "primary", surface = "light") {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        try {
            const res = yield fetch(`${baseUrl}/theming/themes/${themeId}`, {
                // Omit the session cookie so the request is authenticated purely by the
                // Basic API token (the service identity). Otherwise, when the viewer is
                // logged in as another user (e.g. via the login-as widget), the cookie is
                // sent and the theming endpoint is evaluated as that user — who may lack
                // theme access — so it returns nothing and brand colors silently fail.
                credentials: "omit",
                headers: { Authorization: `Basic ${apiToken}`, Accept: "application/json" },
            });
            if (!res.ok)
                return {};
            const data = yield res.json();
            // Build id -> hex map from customColors.
            const customs = {};
            for (const c of ((_a = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _a === void 0 ? void 0 : _a.customColors) || []) {
                if (c && c.id && c.color)
                    customs[c.id] = c.color;
            }
            // Resolve a value that's either a hex or a customColors id reference.
            const resolve = (v) => {
                if (!v)
                    return "";
                if (v[0] === "#")
                    return v;
                return customs[v] || "";
            };
            // Gather every color the theme exposes (skip pure white/black), then choose:
            //  - primary = darkest still-saturated color (it sits on the white widget bg)
            //  - accent  = most vivid color (only used in gradients, on colored bg)
            // A configured brand color can be too light (e.g. #F7DDED) to read on white,
            // so we never just trust primary-brand-color for on-white text.
            const palette = [
                ...Object.values(customs),
                typeof ((_b = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _b === void 0 ? void 0 : _b.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "",
                resolve((_e = (_d = (_c = data === null || data === void 0 ? void 0 : data.desktopTheme) === null || _c === void 0 ? void 0 : _c.components) === null || _d === void 0 ? void 0 : _d.navigation) === null || _e === void 0 ? void 0 : _e.accentColor),
            ].filter(c => isHex(c) && !isNeutralExtreme(c));
            // Primary: best on-white color from the palette; fall back to the older
            // brand-color resolution (darkened for contrast) if nothing was saturated.
            let primary = surface === "dark" ? pickOnDark(palette) : pickOnWhite(palette);
            if (!primary) {
                primary =
                    resolve("primary-brand-color") ||
                        customs["legacy-background-color"] ||
                        (typeof ((_f = data === null || data === void 0 ? void 0 : data.globalTheme) === null || _f === void 0 ? void 0 : _f.interfaceColor) === "string" ? data.globalTheme.interfaceColor : "");
                if (isHex(primary)) {
                    primary = surface === "dark" ? lightenToContrast(primary, 4.5) : darkenToContrast(primary, 4.5);
                }
            }
            // Accent: most vivid palette color, else nav accent, else fall back to primary.
            let accent = pickVivid(palette, primary) ||
                resolve((_j = (_h = (_g = data === null || data === void 0 ? void 0 : data.desktopTheme) === null || _g === void 0 ? void 0 : _g.components) === null || _h === void 0 ? void 0 : _h.navigation) === null || _j === void 0 ? void 0 : _j.accentColor) ||
                String(primary);
            // On the dark stage the accent is a real text/graphic color too, not just a
            // gradient stop, so it has to clear contrast the same way primary does.
            if (surface === "dark" && isHex(String(accent)))
                accent = lightenToContrast(String(accent), 3);
            return {
                primary: isHex(String(primary)) ? String(primary) : undefined,
                accent: isHex(String(accent)) ? String(accent) : undefined,
            };
        }
        catch (_k) {
            return {};
        }
    });
}
/**
 * A categorical ramp anchored to the tenant's own brand.
 *
 * Categorical palettes are usually picked off the shelf, which drops saturated
 * web-safe hues (#0EA5E9, #EF4444) onto a brand-tinted surface and makes the
 * chart read as a foreign object. This walks the hue wheel from the primary
 * instead, holding saturation and lightness at the values that survive the
 * given surface, so every slice is distinguishable *and* clearly related.
 */
function reactionRamp(primary, surface, n = 6) {
    const { h, s, l } = hexToHsl(primary);
    // hexToHsl/hslToHex work in 0-1 fractions, not percentages. Passing 0-100
    // here silently produces malformed hex, which paints nothing at all.
    const sat = Math.min(0.85, Math.max(0.52, s));
    const lit = surface === "dark"
        ? Math.min(0.68, Math.max(0.52, l))
        : Math.min(0.50, Math.max(0.38, l));
    const out = [];
    for (let i = 0; i < n; i++) {
        // 47 degrees is coprime enough with 360 to avoid repeats over a short ramp
        // while keeping neighbouring slices clearly apart.
        const hue = (h + i * 47) % 360;
        // Alternate a small lightness step so adjacent slices differ even for
        // viewers who cannot separate the hues.
        const step = i % 2 === 0 ? 0 : (surface === "dark" ? 0.10 : -0.08);
        out.push(hslToHex(hue, sat, Math.min(0.78, Math.max(0.30, lit + step))));
    }
    return out;
}

;// ./branding.ts
// ─────────────────────────────────────────────────────────────────────────────
// Multibranding: resolve the viewer's brand color, corner radius and pinned post.
//
// Resolution order, first match wins:
//   1. A `brandoverrides` rule matching one of the viewer's groups, by ID or by
//      group name.
//   2. The tenant's own branding theme, via the shared theming API helper.
//   3. The widget's neutral defaults.
//
// Only accents are branded — buttons, chips, active states, the like heart. Card
// chrome deliberately stays neutral so the feed reads modern and generic on any
// tenant rather than looking like a skinned brand page.
//
// Why a rule may name several groups, and why names are matched at all: this
// tenant has TWO distinct groups both called "El Globo"
// (6aaa7d70a742e5436549bc91 and 6a42ed4319053625a91b37c2). Targeting the wrong
// one produced no error and no brand — the widget just quietly fell back to the
// theming colour. Matching by name, and allowing a rule to list several IDs,
// removes that failure mode.
// ─────────────────────────────────────────────────────────────────────────────
var branding_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

const NEUTRAL_COLOR = "#1F6FEB";
const DEFAULT_RADIUS = "14px";
/** Staffbase IDs are 24-char hex (ObjectId-style); anything else is a name. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
function branding_isHex(s) {
    return HEX.test(String(s || "").trim());
}
function hexToRgb(hex) {
    const h = (String(hex).replace("#", "") + "000000").slice(0, 6);
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)).join(",");
}
/** Readable foreground for text placed on `hex`. Uses the WCAG relative
 *  luminance threshold rather than a naive average, so mid-tone brand colors
 *  (like El Globo's #8B374A) resolve correctly. */
function contrastColor(hex) {
    const [r, g, b] = hexToRgb(hex).split(",").map(Number);
    const lin = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return luminance > 0.55 ? "#111418" : "#FFFFFF";
}
/** Normalize a radius value. Bare numbers are treated as px so admins can type
 *  `5` instead of `5px`. */
function normalizeRadius(raw, fallback) {
    const v = String(raw == null ? "" : raw).trim();
    if (!v)
        return fallback;
    return /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v;
}
/** Parse the `brandoverrides` JSON config. Invalid JSON yields no overrides
 *  rather than breaking the widget — a malformed brand rule should cost you the
 *  brand color, not the feed. */
function parseOverrides(raw, log) {
    const text = String(raw || "").trim();
    if (!text)
        return [];
    try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter((o) => o && ruleTargets(o).length);
    }
    catch (e) {
        log("brandoverrides is not valid JSON —", e && e.message);
        return [];
    }
}
/** The group IDs or names a rule applies to. Accepts `group` as a string or an
 *  array, and the legacy single `groupId`. */
function ruleTargets(rule) {
    const raw = Array.isArray(rule.group)
        ? rule.group
        : [rule.group, rule.groupId];
    return raw.map(v => String(v == null ? "" : v).trim()).filter(Boolean);
}
/** Case- and accent-insensitive key, so a rule saying "El Globo" matches a
 *  group stored as "el globo" or "EL GLOBO". */
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
/**
 * Collect the viewer's branding groups from the host DOM.
 *
 * Staffbase's own multibranding puts a `group-<id>` class on an ancestor (the
 * body/html element), which is exactly what tenant custom CSS keys off —
 * `.group-6aaa7d70a742e5436549bc91 .header-title { … }`. Reading it costs
 * nothing and reflects what the host actually believes about this viewer, which
 * makes it a better signal than the profile call alone.
 */
function groupsFromDom(start) {
    const found = [];
    for (let el = start; el; el = el.parentElement) {
        // `className` is not a string on SVG elements, so read the attribute.
        const cls = el.getAttribute && el.getAttribute("class");
        if (!cls)
            continue;
        for (const token of cls.split(/\s+/)) {
            const m = /^group-([0-9a-f]{24})$/i.exec(token);
            if (m)
                found.push(m[1]);
        }
    }
    return Array.from(new Set(found));
}
/** True when any rule targets something other than a 24-hex ID, which is the
 *  only case where group names have to be fetched. Pure-ID configs stay free. */
const needsGroupNames = (overrides) => overrides.some(o => ruleTargets(o).some(g => !OBJECT_ID.test(g)));
function resolveBrand(opts) {
    return branding_awaiter(this, void 0, void 0, function* () {
        const { baseUrl, apiToken, overrides, viewerGroupIds, groupNames, useThemeColor, fallbackColor, fallbackRadius, fallbackPinnedPostId, log, } = opts;
        const ids = new Set(viewerGroupIds || []);
        const names = new Set((viewerGroupIds || [])
            .map(id => norm((groupNames && groupNames.get(id)) || ""))
            .filter(Boolean));
        log(`brand: viewer in ${ids.size} group(s)`, Array.from(ids).join(",") || "(none)");
        if (names.size)
            log("brand: group names", Array.from(names).join(" | "));
        let match;
        let matchedVia = "";
        for (const rule of overrides) {
            const targets = ruleTargets(rule);
            const hitId = targets.find(g => ids.has(g));
            const hitName = hitId ? "" : targets.find(g => !OBJECT_ID.test(g) && names.has(norm(g)));
            if (hitId || hitName) {
                match = rule;
                matchedVia = hitId ? `group id ${hitId}` : `group name "${hitName}"`;
                break;
            }
            log(`brand: no match for rule ${rule.label || targets.join("/")} (${targets.join(", ")})`);
        }
        let color = "";
        let radius = "";
        let pinnedPostId = "";
        let matchedLabel = "";
        if (match) {
            matchedLabel = match.label || ruleTargets(match)[0] || "";
            if (branding_isHex(match.color || ""))
                color = String(match.color).trim();
            radius = normalizeRadius(match.radius, "");
            pinnedPostId = String(match.pinnedPostId || "").trim();
            log(`brand: matched "${matchedLabel}" via ${matchedVia} — color ${color || "(none)"}, radius ${radius || "(default)"}`);
        }
        else if (overrides.length) {
            log(`brand: viewer matched none of ${overrides.length} rule(s) — using theme/defaults`);
        }
        // Only reach for the theming API when no override supplied a color — an
        // override is an explicit decision and must not be second-guessed.
        if (!color && useThemeColor && apiToken) {
            const themed = yield fetchThemeColors(baseUrl, apiToken, "primary", "light");
            if (themed.primary && branding_isHex(themed.primary)) {
                color = themed.primary;
                log(`brand color from theming API: ${color}`);
            }
        }
        if (!color)
            color = branding_isHex(fallbackColor) ? fallbackColor : NEUTRAL_COLOR;
        if (!radius)
            radius = normalizeRadius(fallbackRadius, DEFAULT_RADIUS);
        if (!pinnedPostId)
            pinnedPostId = String(fallbackPinnedPostId || "").trim();
        return {
            color,
            colorRgb: hexToRgb(color),
            onColor: contrastColor(color),
            radius,
            pinnedPostId,
            matchedLabel,
        };
    });
}

;// ./css.ts
// ─────────────────────────────────────────────────────────────────────────────
// Stylesheet.
//
// Three things here are load-bearing and easy to break:
//
// 1. HOST_RESET — Staffbase's own CSS reaches into widget markup and restyles
//    bare elements. Buttons in particular get a host width/margin/line-height,
//    lists get bullets, headings get margins. Everything is re-declared under
//    the widget's root class with `!important`.
//
//    The :hover/:focus/:active reset carries ONLY background, color, box-shadow
//    and outline. Putting width/margin/border-radius in that block is what makes
//    round buttons snap square the moment they are tapped, because the reset
//    then overrides the component's own geometry on interaction.
//
// 2. FULL_BLEED — inside the Staffbase shell the widget renders in a padded card.
//    On phones that padding wastes ~32px of an already narrow screen, so at
//    <=640px the root breaks out of its container and spans the viewport.
//
// 3. The hero image is the widget's one big gesture. It is sized by aspect-ratio
//    with a min-height floor so it stays generous on every breakpoint, and the
//    headline sits on a gradient scrim over the photo rather than beneath it.
// ─────────────────────────────────────────────────────────────────────────────
const P = "mfd";
const HOST_RESET = `
.${P}-root button{
  width:auto!important;min-width:0!important;max-width:none!important;margin:0!important;
  border:0!important;font-family:inherit!important;font-size:inherit!important;
  line-height:normal!important;text-transform:none!important;letter-spacing:inherit!important;
  cursor:pointer;-webkit-appearance:none;appearance:none;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation;
  display:inline-flex;align-items:center;justify-content:center}
/* Interaction states restyle paint only. Geometry (width/margin/border-radius)
   is deliberately absent — see the note at the top of this file. */
.${P}-root button:hover,
.${P}-root button:focus,
.${P}-root button:focus-visible,
.${P}-root button:active{
  background:none;color:inherit;box-shadow:none;outline:none!important}
.${P}-root a,.${P}-root a:hover,.${P}-root a:focus,.${P}-root a:active{
  color:inherit!important;text-decoration:none!important;background:none!important}
.${P}-root ol,.${P}-root ul{list-style:none!important;margin:0!important;padding:0!important}
.${P}-root li{margin:0!important;padding:0!important;list-style:none!important}
.${P}-root h1,.${P}-root h2,.${P}-root h3,.${P}-root h4,.${P}-root h5,.${P}-root h6,
.${P}-root p,.${P}-root figure{margin:0!important;padding:0!important;font-family:inherit!important}
/* Scoped to host-authored images only. An unqualified ".${P}-root img" rule
   outranks our own single-class media rules (0,1,1 vs 0,1,0), so "height:auto"
   would silently beat "height:100%" and every cover image would size to its
   intrinsic ratio instead of filling its frame. Our images all carry a
   prefixed class; rich-text images from the host carry none. */
.${P}-root img:not([class*="${P}-"]){max-width:100%!important;height:auto;display:block}
.${P}-root input,.${P}-root textarea{
  font-family:inherit!important;font-size:16px;width:100%!important;margin:0!important;
  -webkit-appearance:none;appearance:none;box-sizing:border-box}
.${P}-root *,.${P}-root *::before,.${P}-root *::after{box-sizing:border-box}
`;
/* Break out of the host's padded card and span the viewport.
   The negative margins come from `--bleed-l/r`, which the widget measures at
   runtime from the root's real distance to each viewport edge. A fixed
   `calc(50% - 50vw)` is the fallback, but it is only correct when no ancestor
   clips: overshoot the container and any `overflow:hidden` parent shears the
   overhang off, cutting the first character of every line. Measuring means the
   breakout lands exactly on the viewport edge and never exceeds it. */
const FULL_BLEED = `
@media (max-width:640px){
  .${P}-root.${P}-bleed{
    margin-left:var(--bleed-l,calc(50% - 50vw))!important;
    margin-right:var(--bleed-r,calc(50% - 50vw))!important;
    padding-left:env(safe-area-inset-left);
    padding-right:env(safe-area-inset-right);
    max-width:100vw}
  /* Square off and butt the big surfaces against the screen edges — a rounded
     card floating in a 0px gutter looks like a mistake. */
  .${P}-root.${P}-bleed .${P}-hero,
  .${P}-root.${P}-bleed .${P}-card{
    border-radius:0!important;border-left:0!important;border-right:0!important}
  .${P}-root.${P}-bleed .${P}-bar,
  .${P}-root.${P}-bleed .${P}-compose,
  .${P}-root.${P}-bleed .${P}-head{margin-inline:16px;width:auto}
}
`;
function buildCss(brand, background, rtl) {
    const dirStart = rtl ? "right" : "left";
    return `
${HOST_RESET}

.${P}-root{
  --c:${brand.color};
  --c-rgb:${brand.colorRgb};
  --on-c:${brand.onColor};
  --r:${brand.radius};
  /* Smaller radii read better on small chrome than the card radius does, but a
     brand that asks for square corners must stay square, so they clamp. */
  --r-sm:min(8px, ${brand.radius});
  --r-pill:min(999px, max(${brand.radius}, 8px));
  --ink:#14171a;
  --ink-2:#5b6472;
  --ink-3:#8b95a3;
  --line:#e6e9ee;
  --surface:#ffffff;
  --surface-2:#f6f7f9;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;
  color:var(--ink);
  background:${background || "transparent"};
  -webkit-font-smoothing:antialiased;
  display:block}

/* ── Header ───────────────────────────────────────────────────────────── */
.${P}-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.${P}-title{font-size:19px;font-weight:750;letter-spacing:-.015em;line-height:1.2}
.${P}-refresh{
  margin-inline-start:auto!important;width:34px!important;height:34px;flex:0 0 34px;
  border-radius:var(--r-pill);color:var(--ink-3);background:transparent;transition:color .15s,background .15s}
.${P}-refresh:hover,.${P}-refresh:focus{color:var(--c)!important;background:rgba(var(--c-rgb),.08)!important}
.${P}-refresh.${P}-busy{animation:${P}-spin .8s linear infinite}

/* ── Hero (pinned post) ───────────────────────────────────────────────── */
/* The hero is an <a>, so it is hit by the link reset above — its background has
   to be re-declared with !important or the gradient behind the photo is dropped
   and a failed image leaves a blank white slab. */
.${P}-hero{
  position:relative;display:block;width:100%;
  aspect-ratio:16/9;min-height:320px;max-height:480px;
  border-radius:var(--r);overflow:hidden;margin-bottom:18px;
  background:linear-gradient(135deg,rgba(var(--c-rgb),.95),rgba(var(--c-rgb),.62))!important;
  box-shadow:0 12px 32px rgba(16,22,34,.13),0 2px 6px rgba(16,22,34,.06);
  isolation:isolate;cursor:pointer;-webkit-tap-highlight-color:transparent}
/* Cover images are pinned with !important and an extra class of specificity on
   purpose. The host wraps the widget in ".widget-card .css-...-Widget", and a
   single host rule like "img{height:auto}" (0,1,1) outranks a lone
   ".mfd-hero-img" (0,1,0) — the image then letterboxes to its intrinsic ratio
   and the empty band under it reads as broken layout behind the scrim. Geometry
   here must not be negotiable. */
.${P}-root .${P}-hero-img{
  position:absolute!important;inset:0!important;
  width:100%!important;height:100%!important;
  max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;
  object-fit:cover!important;object-position:center!important;display:block!important;
  transform:scale(1.01);transition:transform .7s cubic-bezier(.22,.61,.36,1)}
@media (hover:hover){.${P}-hero:hover .${P}-hero-img{transform:scale(1.05)}}
/* One continuous ramp, not two overlapping gradients. The old version reached
   rgba(8,11,16,.92) at the foot, which is close enough to solid black that the
   bottom of the photo looked like unfilled space rather than a darkened image.
   This tops out lower and eases in, so the text still has its dark backing but
   the photograph stays visibly a photograph all the way down. */
.${P}-hero-scrim{
  position:absolute;inset:0;pointer-events:none;
  background:
    linear-gradient(180deg,rgba(8,11,16,.34) 0%,rgba(8,11,16,0) 38%),
    linear-gradient(180deg,
      rgba(8,11,16,0) 30%,
      rgba(8,11,16,.14) 48%,
      rgba(8,11,16,.38) 64%,
      rgba(8,11,16,.60) 80%,
      rgba(8,11,16,.74) 100%)}
.${P}-hero-body{
  position:absolute;inset-inline:0;bottom:0;padding:28px 28px 26px;
  display:flex;flex-direction:column;gap:10px;color:#fff}
.${P}-hero-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.${P}-hero-title{
  font-size:clamp(21px,2.4vw,30px);font-weight:780;line-height:1.18;letter-spacing:-.02em;
  color:#fff!important;text-shadow:0 1px 14px rgba(0,0,0,.35);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.${P}-hero-teaser{
  font-size:14.5px;line-height:1.5;color:rgba(255,255,255,.88)!important;max-width:62ch;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.${P}-hero-cta{
  display:inline-flex;align-items:center;gap:7px;align-self:flex-start;margin-top:4px;
  font-size:13.5px;font-weight:700;color:#fff}
.${P}-hero-cta svg{transition:transform .2s}
@media (hover:hover){.${P}-hero:hover .${P}-hero-cta svg{transform:translateX(3px)}}
.${P}-hero[dir="rtl"] .${P}-hero-cta svg,[dir="rtl"] .${P}-hero-cta svg{transform:scaleX(-1)}

.${P}-pin{
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 10px;border-radius:var(--r-pill);
  font-size:11px;font-weight:750;letter-spacing:.03em;text-transform:uppercase;
  background:var(--c);color:var(--on-c)}
.${P}-pin svg{width:13px;height:13px}
.${P}-hero-chip{
  padding:4px 10px;border-radius:var(--r-pill);font-size:11.5px;font-weight:650;
  background:rgba(255,255,255,.18);color:#fff;backdrop-filter:blur(6px)}
.${P}-hero-date{font-size:11.5px;font-weight:600;color:rgba(255,255,255,.8)}

/* ── Filter bar ───────────────────────────────────────────────────────── */
.${P}-bar{
  display:flex;align-items:center;gap:8px;margin-bottom:16px;
  overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.${P}-bar::-webkit-scrollbar{display:none}
.${P}-chip{
  flex:0 0 auto;height:34px;padding:0 15px!important;border-radius:var(--r-pill);
  font-size:13.5px;font-weight:650;white-space:nowrap;
  background:var(--surface-2);color:var(--ink-2);
  border:1px solid transparent!important;
  transition:background .15s,color .15s,border-color .15s}
.${P}-chip:hover,.${P}-chip:focus{background:rgba(var(--c-rgb),.09)!important;color:var(--c)!important}
.${P}-chip.${P}-on,
.${P}-chip.${P}-on:hover,
.${P}-chip.${P}-on:focus,
.${P}-chip.${P}-on:active{background:var(--c)!important;color:var(--on-c)!important}
.${P}-chip-n{
  margin-inline-start:7px;font-size:11.5px;font-weight:700;opacity:.62;font-variant-numeric:tabular-nums}

/* ── Composer ─────────────────────────────────────────────────────────── */
.${P}-compose{
  display:flex;align-items:center;gap:11px;width:100%;
  padding:11px 14px!important;margin-bottom:16px;
  border-radius:var(--r);background:var(--surface);
  border:1px solid var(--line)!important;
  text-align:start;justify-content:flex-start!important;
  transition:border-color .15s,box-shadow .15s}
.${P}-compose:hover,.${P}-compose:focus{background:var(--surface)!important;border-color:rgba(var(--c-rgb),.45)!important;box-shadow:0 2px 10px rgba(16,22,34,.06)!important}
.${P}-compose-ph{font-size:14.5px;color:var(--ink-3);font-weight:500}

/* ── Grid ─────────────────────────────────────────────────────────────── */
.${P}-grid{
  display:grid;gap:16px;
  grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
@media (min-width:1080px){.${P}-grid{grid-template-columns:repeat(3,1fr)}}
@media (max-width:900px){.${P}-grid{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){.${P}-grid{grid-template-columns:1fr;gap:12px}}

.${P}-card{
  display:flex;flex-direction:column;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--r);
  overflow:hidden;position:relative;
  transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
@media (hover:hover){
  .${P}-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(16,22,34,.10);border-color:rgba(var(--c-rgb),.3)}
}
.${P}-card:focus-within{border-color:var(--c);box-shadow:0 0 0 3px rgba(var(--c-rgb),.16)}

/* The whole card is clickable via a stretched overlay link, so the social
   buttons can still sit on top and take their own taps. */
.${P}-stretch{position:absolute;inset:0;z-index:1}
.${P}-card-body{padding:14px 16px 12px;display:flex;flex-direction:column;gap:8px;flex:1}
/* Same reasoning as the hero image: a host "img{height:auto}" must not be able
   to collapse the card's cover crop. */
.${P}-root .${P}-card-media{
  width:100%!important;max-width:none!important;
  aspect-ratio:16/9;object-fit:cover!important;object-position:center!important;
  display:block!important;background:var(--surface-2);
  transition:transform .4s cubic-bezier(.22,.61,.36,1)}
@media (hover:hover){.${P}-card:hover .${P}-card-media{transform:scale(1.03)}}
.${P}-card-media-wrap{overflow:hidden;position:relative}

.${P}-chan{
  display:inline-flex;align-items:center;align-self:flex-start;
  padding:3px 9px;border-radius:var(--r-pill);
  font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  background:rgba(var(--c-rgb),.1);color:var(--c)}
.${P}-card-title{
  font-size:15.5px;font-weight:700;line-height:1.32;letter-spacing:-.01em;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.${P}-card-text{
  font-size:13.5px;line-height:1.55;color:var(--ink-2);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.${P}-card-date{font-size:11.5px;font-weight:600;color:var(--ink-3);margin-top:auto;padding-top:2px}

/* Social variant: the person leads, so the byline sits at the top and the
   headline is dropped entirely (Staffbase stores the whole body in "title"). */
.${P}-byline{display:flex;align-items:center;gap:9px}
/* Grid rows stretch every card to the tallest in the row. With the photo last,
   a stretching body would open a white gap between the text and the image, so
   the body stays its natural height and the photo absorbs the slack instead. */
.${P}-card[data-kind="social"] .${P}-card-body{flex:0 0 auto}
.${P}-card[data-kind="social"] .${P}-card-media-wrap{flex:1 1 auto;min-height:180px;display:flex}
.${P}-root .${P}-card[data-kind="social"] .${P}-card-media{
  aspect-ratio:auto;height:100%!important;min-height:180px}
.${P}-root .${P}-av{
  width:34px!important;height:34px!important;flex:0 0 34px;
  max-width:none!important;border-radius:50%;object-fit:cover!important;
  background:var(--surface-2)}
.${P}-av-fb{
  display:flex;align-items:center;justify-content:center;
  font-size:12.5px;font-weight:700;color:var(--on-c);background:var(--c);text-transform:uppercase}
/* Nameless viewer: a muted neutral disc, so the composer does not shout in the
   brand colour before we even know who is looking at it. */
.${P}-av-anon{
  background:var(--surface-2);color:var(--ink-3);
  box-shadow:inset 0 0 0 1px var(--line)}
.${P}-byline-t{display:flex;flex-direction:column;min-width:0;gap:1px}
.${P}-byline-n{font-size:13.5px;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.${P}-byline-d{font-size:11.5px;font-weight:550;color:var(--ink-3);line-height:1.25}

/* ── Social actions ───────────────────────────────────────────────────── */
.${P}-acts{
  display:flex;align-items:center;gap:4px;position:relative;z-index:2;
  padding:6px 10px 8px;border-top:1px solid var(--line);margin-top:2px}
.${P}-act{
  gap:6px;height:32px;padding:0 10px!important;border-radius:var(--r-pill);
  font-size:12.5px;font-weight:650;color:var(--ink-2);background:transparent;
  transition:background .15s,color .15s}
.${P}-act:hover,.${P}-act:focus{background:var(--surface-2)!important;color:var(--ink)!important}
.${P}-act.${P}-on,
.${P}-act.${P}-on:hover,
.${P}-act.${P}-on:focus,
.${P}-act.${P}-on:active{color:var(--c)!important;background:rgba(var(--c-rgb),.1)!important}
.${P}-act-n{font-variant-numeric:tabular-nums}
.${P}-act svg{flex:0 0 auto}
@keyframes ${P}-pop{0%{transform:scale(1)}45%{transform:scale(1.32)}100%{transform:scale(1)}}
.${P}-act.${P}-pop svg{animation:${P}-pop .32s ease}

/* ── States ───────────────────────────────────────────────────────────── */
.${P}-state{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
  padding:52px 20px;text-align:center;
  border:1px dashed var(--line);border-radius:var(--r);color:var(--ink-3);font-size:14px}
.${P}-btn{
  height:36px;padding:0 16px!important;border-radius:var(--r-pill);
  font-size:13.5px;font-weight:700;background:var(--c);color:var(--on-c);
  box-shadow:0 3px 10px rgba(var(--c-rgb),.28)}
.${P}-btn:hover,.${P}-btn:focus,.${P}-btn:active{background:var(--c)!important;color:var(--on-c)!important;filter:brightness(1.07)}
.${P}-btn[disabled]{opacity:.5;cursor:default;filter:none;box-shadow:none}
@keyframes ${P}-spin{to{transform:rotate(360deg)}}
.${P}-spin{
  width:18px;height:18px;border-radius:50%;
  border:2px solid rgba(var(--c-rgb),.22);border-top-color:var(--c);
  animation:${P}-spin .7s linear infinite}
.${P}-skel{
  border-radius:var(--r);background:var(--surface-2);height:230px;
  animation:${P}-pulse 1.4s ease-in-out infinite}
@keyframes ${P}-pulse{0%,100%{opacity:1}50%{opacity:.55}}

/* ── Sheet (comments + composer) ──────────────────────────────────────── */
.${P}-scrim{
  position:fixed;inset:0;z-index:100000;background:rgba(10,14,20,.5);
  opacity:0;pointer-events:none;transition:opacity .28s ease}
.${P}-scrim.${P}-open{opacity:1;pointer-events:auto}
.${P}-sheet{
  position:fixed;inset-inline:0;bottom:0;z-index:100001;
  display:flex;flex-direction:column;max-height:88vh;
  background:var(--surface);border-radius:20px 20px 0 0;
  transform:translateY(102%);transition:transform .32s cubic-bezier(.32,.72,0,1);
  box-shadow:0 -8px 40px rgba(0,0,0,.18);
  padding-bottom:env(safe-area-inset-bottom);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--ink)}
.${P}-sheet.${P}-open{transform:translateY(0)}
@media (min-width:720px){
  .${P}-sheet{
    inset:auto 50% 50%;transform:translate(50%,calc(50% + 20px)) scale(.97);
    width:min(560px,92vw);border-radius:18px;max-height:82vh;opacity:0}
  .${P}-sheet.${P}-open{transform:translate(50%,50%) scale(1);opacity:1}
}
.${P}-sheet-head{
  display:flex;align-items:center;gap:10px;padding:16px 18px 12px;border-bottom:1px solid var(--line)}
.${P}-sheet-title{font-size:16px;font-weight:750;letter-spacing:-.01em}
.${P}-sheet-x{
  margin-inline-start:auto!important;width:32px!important;height:32px;flex:0 0 32px;
  border-radius:var(--r-pill);color:var(--ink-3);background:transparent}
.${P}-sheet-x:hover,.${P}-sheet-x:focus{background:var(--surface-2)!important;color:var(--ink)!important}
.${P}-sheet-body{
  padding:14px 18px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.${P}-sheet-foot{
  display:flex;align-items:flex-end;gap:9px;padding:12px 18px 14px;border-top:1px solid var(--line)}
.${P}-in{
  flex:1;min-height:40px;max-height:140px;resize:none;
  padding:10px 13px;border-radius:var(--r);
  border:1px solid var(--line)!important;background:var(--surface-2);
  font-size:15px;line-height:1.45;color:var(--ink);outline:none}
.${P}-in:focus{border-color:var(--c)!important;background:var(--surface);box-shadow:0 0 0 3px rgba(var(--c-rgb),.14)}
.${P}-send{
  width:40px!important;height:40px;flex:0 0 40px;border-radius:var(--r-pill);
  background:var(--c);color:var(--on-c)}
.${P}-send:hover,.${P}-send:focus,.${P}-send:active{background:var(--c)!important;color:var(--on-c)!important;filter:brightness(1.07)}
.${P}-send[disabled]{opacity:.42;cursor:default;filter:none}

.${P}-cmt{display:flex;gap:10px;padding:9px 0}
.${P}-cmt+.${P}-cmt{border-top:1px solid var(--line)}
.${P}-cmt-b{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.${P}-cmt-n{font-size:13px;font-weight:700}
.${P}-cmt-x{font-size:13.5px;line-height:1.5;color:var(--ink-2);word-break:break-word}
.${P}-cmt-x p{margin:0!important}
.${P}-cmt-d{font-size:11px;font-weight:600;color:var(--ink-3)}
.${P}-cmt-empty{padding:26px 4px;text-align:center;color:var(--ink-3);font-size:13.5px}
.${P}-err{
  margin-top:10px;padding:9px 12px;border-radius:var(--r-sm);
  background:#fdecee;color:#9f1f32;font-size:13px;font-weight:600}

/* ── Compact / phone ──────────────────────────────────────────────────── */
@media (max-width:640px){
  .${P}-hero{aspect-ratio:4/3;min-height:300px;max-height:420px;margin-bottom:14px}
  .${P}-hero-body{padding:20px 18px 18px;gap:8px}
  .${P}-head{margin-bottom:12px}
  .${P}-title{font-size:17.5px}
  .${P}-card-body{padding:13px 15px 11px}
}

@media (prefers-reduced-motion:reduce){
  .${P}-root *,.${P}-sheet,.${P}-scrim{
    animation-duration:.01ms!important;animation-iteration-count:1!important;
    transition-duration:.01ms!important}
}

${FULL_BLEED}
`;
}

;// ./strings.ts
// i18n bundles for the mixed feed.
//
// `en_US` is the source of truth for the *keys*, per the shared engine's
// `DEFAULT_LOCALE` — but this widget's default *display* locale is `es_MX`
// (see `resolveUiLocale` in mixed-feed.ts): the tenants it targets are
// Spanish-speaking, so an undetectable locale should land on Spanish, not
// English. es_ES is shipped separately from es_MX because the two differ in
// register (tú/ustedes) even where the vocabulary matches.
const AVAILABLE_LOCALES = ["es_MX", "es_ES", "en_US", "de_DE"];
const DEFAULT_UI_LOCALE = "es_MX";
const BUNDLES = {
    en_US: {
        "widget.title": "Feed",
        "filter.all": "All",
        "filter.news": "News",
        "filter.social": "Social",
        "state.loading": "Loading feed…",
        "state.error": "Could not load the feed.",
        "state.empty": "No posts yet.",
        "state.emptyFiltered": "No posts in this filter.",
        "state.configure": "Set the base URL, API token and channel IDs in the widget settings.",
        "state.retry": "Try again",
        "post.pinned": "Pinned",
        "post.read": "Read post",
        "post.readMore": "Read more",
        "post.by": "by {name}",
        "social.like": "Like",
        "social.liked": "Liked",
        "social.comment": "Comment",
        "social.comments": "Comments",
        "social.noComments": "No comments yet. Be the first.",
        "social.commentPlaceholder": "Write a comment…",
        "social.send": "Send",
        "social.commentFailed": "Your comment could not be posted.",
        "compose.placeholder": "What's on your mind today?",
        "compose.title": "Create a post",
        "compose.submit": "Post",
        "compose.cancel": "Cancel",
        "compose.failed": "Your post could not be published.",
        "a11y.close": "Close",
        "a11y.openPost": "Open post",
    },
    es_MX: {
        "widget.title": "Novedades",
        "filter.all": "Todo",
        "filter.news": "Noticias",
        "filter.social": "Social",
        "state.loading": "Cargando publicaciones…",
        "state.error": "No se pudo cargar el contenido.",
        "state.empty": "Aún no hay publicaciones.",
        "state.emptyFiltered": "No hay publicaciones en este filtro.",
        "state.configure": "Configura la URL base, el token de API y los IDs de canal en los ajustes del widget.",
        "state.retry": "Reintentar",
        "post.pinned": "Destacado",
        "post.read": "Ver publicación",
        "post.readMore": "Ver más",
        "post.by": "por {name}",
        "social.like": "Me gusta",
        "social.liked": "Te gusta",
        "social.comment": "Comentar",
        "social.comments": "Comentarios",
        "social.noComments": "Aún no hay comentarios. Sé el primero.",
        "social.commentPlaceholder": "Escribe un comentario…",
        "social.send": "Enviar",
        "social.commentFailed": "No se pudo publicar tu comentario.",
        "compose.placeholder": "¿Qué tienes en mente hoy?",
        "compose.title": "Crear publicación",
        "compose.submit": "Publicar",
        "compose.cancel": "Cancelar",
        "compose.failed": "No se pudo publicar tu contenido.",
        "a11y.close": "Cerrar",
        "a11y.openPost": "Abrir publicación",
    },
    es_ES: {
        "widget.title": "Novedades",
        "filter.all": "Todo",
        "filter.news": "Noticias",
        "filter.social": "Social",
        "state.loading": "Cargando publicaciones…",
        "state.error": "No se ha podido cargar el contenido.",
        "state.empty": "Todavía no hay publicaciones.",
        "state.emptyFiltered": "No hay publicaciones en este filtro.",
        "state.configure": "Configura la URL base, el token de API y los IDs de canal en los ajustes del widget.",
        "state.retry": "Reintentar",
        "post.pinned": "Destacado",
        "post.read": "Ver publicación",
        "post.readMore": "Ver más",
        "post.by": "por {name}",
        "social.like": "Me gusta",
        "social.liked": "Te gusta",
        "social.comment": "Comentar",
        "social.comments": "Comentarios",
        "social.noComments": "Todavía no hay comentarios. Sé el primero.",
        "social.commentPlaceholder": "Escribe un comentario…",
        "social.send": "Enviar",
        "social.commentFailed": "No se ha podido publicar tu comentario.",
        "compose.placeholder": "¿Qué tienes en mente hoy?",
        "compose.title": "Crear publicación",
        "compose.submit": "Publicar",
        "compose.cancel": "Cancelar",
        "compose.failed": "No se ha podido publicar tu contenido.",
        "a11y.close": "Cerrar",
        "a11y.openPost": "Abrir publicación",
    },
    de_DE: {
        "widget.title": "Neuigkeiten",
        "filter.all": "Alle",
        "filter.news": "News",
        "filter.social": "Social",
        "state.loading": "Beiträge werden geladen…",
        "state.error": "Inhalte konnten nicht geladen werden.",
        "state.empty": "Noch keine Beiträge.",
        "state.emptyFiltered": "Keine Beiträge in diesem Filter.",
        "state.configure": "Basis-URL, API-Token und Kanal-IDs in den Widget-Einstellungen hinterlegen.",
        "state.retry": "Erneut versuchen",
        "post.pinned": "Angepinnt",
        "post.read": "Beitrag ansehen",
        "post.readMore": "Mehr lesen",
        "post.by": "von {name}",
        "social.like": "Gefällt mir",
        "social.liked": "Gefällt dir",
        "social.comment": "Kommentieren",
        "social.comments": "Kommentare",
        "social.noComments": "Noch keine Kommentare. Mach den Anfang.",
        "social.commentPlaceholder": "Kommentar schreiben…",
        "social.send": "Senden",
        "social.commentFailed": "Dein Kommentar konnte nicht gepostet werden.",
        "compose.placeholder": "Was beschäftigt dich heute?",
        "compose.title": "Beitrag erstellen",
        "compose.submit": "Posten",
        "compose.cancel": "Abbrechen",
        "compose.failed": "Dein Beitrag konnte nicht veröffentlicht werden.",
        "a11y.close": "Schließen",
        "a11y.openPost": "Beitrag öffnen",
    },
};

;// ./feed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Feed assembly: classify channels, normalize posts, merge, sort.
//
// Everything downstream of this module deals in `FeedPost` — the renderer never
// touches a raw API shape, so the news/social split and the locale choice are
// made exactly once, here.
// ─────────────────────────────────────────────────────────────────────────────
var feed_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};



// ── Classification ───────────────────────────────────────────────────────────
//
// The channels API returns `contentType` as one of:
//   articles  — editorial posts with a headline, teaser and cover image → News
//   updates   — short user-authored posts, the social wall              → Social
//   pictures  — photo posts (e.g. "Cortos")                             → Social
// Anything unrecognized is treated as News, because the news card degrades
// gracefully (it just shows a title) while the social card assumes an author.
function kindOf(contentType) {
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
function resolveUiLocale(configLanguage, userLocale) {
    const explicit = String(configLanguage || "").trim();
    if (!explicit)
        return (/* inlined export .DEFAULT_UI_LOCALE */"es_MX");
    if (explicit !== "auto")
        return resolveLocale(explicit, AVAILABLE_LOCALES);
    const navLang = typeof navigator !== "undefined" ? (navigator.language || "") : "";
    for (const cand of [userLocale, navLang]) {
        const norm = normalizeLocale(cand || "");
        if (!norm)
            continue;
        const lang = norm.split("_")[0];
        // Only accept a candidate whose *language* we actually ship — otherwise
        // resolveLocale would silently hand back en_US and override the Spanish default.
        if (AVAILABLE_LOCALES.some(a => normalizeLocale(a).split("_")[0] === lang)) {
            return resolveLocale(norm, AVAILABLE_LOCALES);
        }
    }
    return (/* inlined export .DEFAULT_UI_LOCALE */"es_MX");
}
/** Choose which localized entry of a `contents`/`localization` map to show.
 *
 *  Order: exact locale → same language, any region (es_MX → es_ES) → en_US →
 *  first available. Posts on these tenants carry es_MX, es_ES, en_US and de_DE
 *  inconsistently, so the same-language step is what keeps Spanish content
 *  showing for a Spanish viewer even when the exact region is missing. */
function pickLocalized(map, locale) {
    if (!map)
        return null;
    const keys = Object.keys(map);
    if (!keys.length)
        return null;
    const want = normalizeLocale(locale);
    for (const k of keys)
        if (normalizeLocale(k) === want)
            return map[k];
    const lang = want.split("_")[0];
    for (const k of keys)
        if (normalizeLocale(k).split("_")[0] === lang)
            return map[k];
    for (const k of keys)
        if (normalizeLocale(k) === "en_US")
            return map[k];
    return map[keys[0]];
}
// ── Text + media extraction ──────────────────────────────────────────────────
const BLOCK_TAGS = /<\/(p|div|li|h[1-6]|blockquote|tr)>/gi;
/** HTML → readable plain text. Block ends become spaces so paragraphs don't run
 *  together, and entities are decoded so `&nbsp;` doesn't leak into a card. */
function toPlainText(html) {
    if (!html)
        return "";
    const withBreaks = String(html).replace(BLOCK_TAGS, " $& ").replace(/<br\s*\/?>/gi, " ");
    const el = typeof document !== "undefined" ? document.createElement("div") : null;
    if (el) {
        el.innerHTML = withBreaks;
        return (el.textContent || "").replace(/\s+/g, " ").trim();
    }
    return withBreaks.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function bestImage(img) {
    var _a, _b, _c;
    if (!img)
        return "";
    const a = img;
    // Prefer the largest rendition: the hero card fills the card width, so a
    // thumb-sized asset visibly blurs.
    const url = ((_a = a.original) === null || _a === void 0 ? void 0 : _a.url) || ((_b = a.thumb) === null || _b === void 0 ? void 0 : _b.url) || ((_c = a.icon) === null || _c === void 0 ? void 0 : _c.url) || img.url;
    return url || "";
}
/** The image a card should show.
 *
 *  Editorial posts set `image`/`feedImage`. Social posts usually set neither and
 *  instead inline the photo in the body as `<div class="media-box"><img …>`, so
 *  the first inline `src` is the only cover available for them. */
function coverImage(content) {
    if (!content)
        return "";
    const explicit = bestImage(content.image) || bestImage(content.feedImage);
    if (explicit)
        return explicit;
    const body = content.content || "";
    const m = /<img[^>]+(?:data-)?src=["']([^"']+)["']/i.exec(body);
    return m ? m[1] : "";
}
// ── Normalization ────────────────────────────────────────────────────────────
function toChannel(raw, locale) {
    var _a;
    const loc = pickLocalized((_a = raw.config) === null || _a === void 0 ? void 0 : _a.localization, locale);
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
function toFeedPost(raw, channel, locale) {
    var _a, _b;
    if (!raw || !raw.id)
        return null;
    const content = pickLocalized(raw.contents, locale);
    const kind = kindOf(raw.contentType || channel.contentType);
    const body = toPlainText(content === null || content === void 0 ? void 0 : content.content);
    // Staffbase stuffs the entire body into `title` for updates/pictures, which
    // makes a useless headline. Social cards therefore show no title at all and
    // lean on the excerpt; only editorial posts get a real headline.
    const rawTitle = String((content === null || content === void 0 ? void 0 : content.title) || "").trim();
    const title = kind === "news" ? rawTitle : "";
    const teaser = toPlainText(content === null || content === void 0 ? void 0 : content.teaser);
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
        likeCount: Number((_a = raw.likes) === null || _a === void 0 ? void 0 : _a.total) || 0,
        commentCount: Number((_b = raw.comments) === null || _b === void 0 ? void 0 : _b.total) || 0,
        // Relative, so the tap is handled by the Staffbase router instead of
        // reloading the shell. `detail_view` is absolute and points at /openlink/.
        href: `/content/news/${kind === "news" ? "article" : "update"}/${raw.id}`,
    };
}
// ── Load ─────────────────────────────────────────────────────────────────────
/** Fetch every configured channel in parallel and merge into one chronological
 *  feed. A channel that fails (deleted, or not readable by the viewer) is
 *  skipped rather than failing the whole widget. */
function loadFeed(opts) {
    return feed_awaiter(this, void 0, void 0, function* () {
        const { base, channels, perChannelLimit, totalLimit, ladder, locale, log } = opts;
        const results = yield Promise.all(channels.map((ch) => feed_awaiter(this, void 0, void 0, function* () {
            const raw = yield fetchChannelPosts(base, ch.id, perChannelLimit, ladder, log);
            return raw.map(r => toFeedPost(r, ch, locale)).filter((p) => !!p);
        })));
        const merged = [];
        const seen = new Set();
        for (const list of results) {
            for (const p of list) {
                if (seen.has(p.id))
                    continue;
                seen.add(p.id);
                merged.push(p);
            }
        }
        merged.sort((a, b) => b.publishedAt - a.publishedAt);
        log(`merged ${merged.length} posts from ${channels.length} channels`);
        return merged.slice(0, totalLimit);
    });
}
/** Staffbase ids are fixed-length hex (24 chars, ObjectId-style). */
const ID_LEN = 24;
const HEX_ONLY = /^[0-9a-f]+$/i;
/** Parse the `channelids` config value. Accepts commas, whitespace or newlines
 *  so pasting a column of IDs out of a spreadsheet just works.
 *
 *  It also repairs run-together input: Staffbase's config editor strips the
 *  newlines out of a textarea value, so "id\nid\nid" reaches the widget as one
 *  72-character token. That parsed as a single unresolvable channel and the
 *  feed silently came up empty. Ids are fixed-length hex, so an over-long
 *  pure-hex token is unambiguously several ids glued together and is split
 *  back apart rather than being dropped. */
function parseChannelIds(raw) {
    const out = [];
    for (const token of String(raw || "").split(/[\s,;]+/)) {
        const t = token.trim();
        if (!t)
            continue;
        if (t.length > ID_LEN && t.length % ID_LEN === 0 && HEX_ONLY.test(t)) {
            for (let i = 0; i < t.length; i += ID_LEN)
                out.push(t.slice(i, i + ID_LEN));
        }
        else {
            out.push(t);
        }
    }
    // A duplicated id would fetch and merge the same channel twice.
    return Array.from(new Set(out));
}
// ── Sanitizing ───────────────────────────────────────────────────────────────
const ALLOWED_TAGS = ["P", "BR", "B", "STRONG", "I", "EM", "U", "A", "SPAN"];
/** Reduce arbitrary comment HTML to a safe inline subset.
 *
 *  Comment bodies are authored by other users and arrive as raw HTML, so they
 *  are never injected as-is. Everything outside the allow-list is unwrapped
 *  (children kept, element dropped) and every attribute except a vetted `href`
 *  is removed, which also kills `javascript:` URLs and inline handlers. */
function sanitizeHtml(html) {
    if (!html)
        return "";
    if (typeof document === "undefined")
        return "";
    const root = document.createElement("div");
    root.innerHTML = String(html);
    const walk = (node) => {
        // Copy the list first: the loop mutates the live child collection.
        for (const child of Array.from(node.children))
            walk(child);
        if (ALLOWED_TAGS.indexOf(node.tagName) === -1) {
            const parent = node.parentNode;
            if (parent) {
                while (node.firstChild)
                    parent.insertBefore(node.firstChild, node);
                parent.removeChild(node);
            }
            return;
        }
        // Capture the href before the attribute sweep, or there is nothing left to
        // vet by the time we look for it.
        const href = node.tagName === "A" ? String(node.getAttribute("href") || "") : "";
        for (const attr of Array.from(node.attributes))
            node.removeAttribute(attr.name);
        if (node.tagName === "A" && /^(https?:|\/)/i.test(href)) {
            node.setAttribute("href", href);
            node.setAttribute("rel", "noopener noreferrer");
        }
    };
    for (const child of Array.from(root.children))
        walk(child);
    return root.innerHTML;
}

;// ./icons.ts
// Inline SVG icons. Inlined rather than icon-fonted so nothing has to load
// before the first paint and the glyphs inherit `currentColor` for free.
const svg = (body, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
    user: svg(`<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`, 17),
    heart: svg(`<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`),
    heartFilled: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
    comment: svg(`<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>`),
    pin: svg(`<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z"/>`),
    arrow: svg(`<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>`, 16),
    close: svg(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`, 20),
    send: svg(`<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>`, 16),
    refresh: svg(`<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>`, 16),
};

;// ./render.ts
// ─────────────────────────────────────────────────────────────────────────────
// Markup. Pure string builders — no state, no fetching, no listeners. The widget
// shell owns behaviour; this file only decides what a post looks like.
// ─────────────────────────────────────────────────────────────────────────────



// ── Dates ────────────────────────────────────────────────────────────────────
/** Relative time for anything inside a week, an absolute date beyond it.
 *
 *  Uses Intl rather than hand-written strings so "hace 2 h", "ayer" and
 *  "12 de marzo" come out correctly in every shipped locale without a
 *  translation table per unit. */
function makeFormatters(locale) {
    const tag = locale.replace("_", "-");
    let rtf = null;
    try {
        rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto", style: "short" });
    }
    catch (_) {
        rtf = null;
    }
    let dtf = null;
    try {
        dtf = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long" });
    }
    catch (_) {
        dtf = null;
    }
    let dtfYear = null;
    try {
        dtfYear = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric" });
    }
    catch (_) {
        dtfYear = null;
    }
    return function when(ms) {
        if (!ms)
            return "";
        const now = Date.now();
        const diff = ms - now;
        const abs = Math.abs(diff);
        const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR, WEEK = 7 * DAY;
        if (rtf) {
            if (abs < MIN)
                return rtf.format(Math.round(diff / 1e3), "second");
            if (abs < HOUR)
                return rtf.format(Math.round(diff / MIN), "minute");
            if (abs < DAY)
                return rtf.format(Math.round(diff / HOUR), "hour");
            if (abs < WEEK)
                return rtf.format(Math.round(diff / DAY), "day");
        }
        const d = new Date(ms);
        const sameYear = d.getFullYear() === new Date(now).getFullYear();
        const fmt = sameYear ? dtf : dtfYear;
        return fmt ? fmt.format(d) : d.toLocaleDateString();
    };
}
// ── Small pieces ─────────────────────────────────────────────────────────────
function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length)
        return "";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
/** Initials, or a neutral person glyph when there is no name at all — a lone
 *  "?" in a brand-coloured circle reads as a loading failure rather than as
 *  "you", which is exactly what the composer showed before the viewer's
 *  profile resolved. */
function avatarFallback(name, cls, hidden = false) {
    const ini = initials(name);
    return `<span class="${(/* inlined export .P */"mfd")}-av ${(/* inlined export .P */"mfd")}-av-fb ${cls}${ini ? "" : ` ${(/* inlined export .P */"mfd")}-av-anon`}"${hidden ? ` style="display:none"` : ""}>${ini ? escapeHtml(ini) : ICONS.user}</span>`;
}
/** Avatar with a graceful initials fallback. The `onerror` swap matters: avatar
 *  URLs are signed and expire, and a broken image icon on every card is worse
 *  than initials. */
function avatarHtml(name, url, cls = "") {
    if (!url)
        return avatarFallback(name, cls);
    return `<img class="${(/* inlined export .P */"mfd")}-av ${cls}" src="${escapeHtml(url)}" alt="" loading="lazy"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        + avatarFallback(name, cls, true);
}
function socialActions(post, t, liked) {
    return `<div class="${(/* inlined export .P */"mfd")}-acts">
  <button type="button" class="${(/* inlined export .P */"mfd")}-act ${(/* inlined export .P */"mfd")}-like${liked ? ` ${(/* inlined export .P */"mfd")}-on` : ""}" data-act="like" data-id="${escapeHtml(post.id)}"
    aria-pressed="${liked}" aria-label="${escapeHtml(t("social.like"))}">
    ${liked ? ICONS.heartFilled : ICONS.heart}<span class="${(/* inlined export .P */"mfd")}-act-n">${post.likeCount || ""}</span>
  </button>
  <button type="button" class="${(/* inlined export .P */"mfd")}-act" data-act="comments" data-id="${escapeHtml(post.id)}"
    aria-label="${escapeHtml(t("social.comments"))}">
    ${ICONS.comment}<span class="${(/* inlined export .P */"mfd")}-act-n">${post.commentCount || ""}</span>
  </button>
</div>`;
}
// ── Hero ─────────────────────────────────────────────────────────────────────
/** The pinned post, rendered as one large image with the headline laid over it.
 *
 *  Picture posts carry no usable title, so the excerpt is promoted to the
 *  headline slot — otherwise an El Globo "Cortos" pin would render as a giant
 *  photo with no words on it at all. */
function heroHtml(post, t, when) {
    const headline = post.title || post.excerpt;
    const teaser = post.title ? post.excerpt : "";
    const clampedHeadline = headline.length > 180 ? headline.slice(0, 177).trimEnd() + "…" : headline;
    // On failure the image removes itself so the hero's brand gradient shows
    // through. Staffbase media URLs are session-scoped and 307 away when there is
    // no session, so a blank white slab is a real state, not a hypothetical one.
    const img = post.imageUrl
        ? `<img class="${(/* inlined export .P */"mfd")}-hero-img" src="${escapeHtml(post.imageUrl)}" alt="" fetchpriority="high" onerror="this.remove()">`
        : "";
    return `<a class="${(/* inlined export .P */"mfd")}-hero" href="${escapeHtml(post.href)}" aria-label="${escapeHtml(t("a11y.openPost"))}">
  ${img}
  <span class="${(/* inlined export .P */"mfd")}-hero-scrim"></span>
  <span class="${(/* inlined export .P */"mfd")}-hero-body">
    <span class="${(/* inlined export .P */"mfd")}-hero-meta">
      <span class="${(/* inlined export .P */"mfd")}-pin">${ICONS.pin}${escapeHtml(t("post.pinned"))}</span>
      ${post.channelTitle ? `<span class="${(/* inlined export .P */"mfd")}-hero-chip">${escapeHtml(post.channelTitle)}</span>` : ""}
      ${post.publishedAt ? `<span class="${(/* inlined export .P */"mfd")}-hero-date">${escapeHtml(when(post.publishedAt))}</span>` : ""}
    </span>
    ${clampedHeadline ? `<span class="${(/* inlined export .P */"mfd")}-hero-title">${escapeHtml(clampedHeadline)}</span>` : ""}
    ${teaser ? `<span class="${(/* inlined export .P */"mfd")}-hero-teaser">${escapeHtml(teaser)}</span>` : ""}
    <span class="${(/* inlined export .P */"mfd")}-hero-cta">${escapeHtml(t("post.read"))}${ICONS.arrow}</span>
  </span>
</a>`;
}
// ── Cards ────────────────────────────────────────────────────────────────────
function cardHtml(post, t, when, showActions, liked) {
    // Drops the whole media band (not just the img) when the asset fails, so the
    // card closes up cleanly instead of reserving 16:9 of empty grey.
    const media = post.imageUrl
        ? `<span class="${(/* inlined export .P */"mfd")}-card-media-wrap"><img class="${(/* inlined export .P */"mfd")}-card-media" src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></span>`
        : "";
    // The stretched link covers the card so the whole surface is tappable, while
    // the action buttons sit above it on their own stacking level.
    const link = `<a class="${(/* inlined export .P */"mfd")}-stretch" href="${escapeHtml(post.href)}" aria-label="${escapeHtml(post.title || t("a11y.openPost"))}"></a>`;
    const body = post.kind === "news"
        ? `<span class="${(/* inlined export .P */"mfd")}-card-body">
    ${post.channelTitle ? `<span class="${(/* inlined export .P */"mfd")}-chan">${escapeHtml(post.channelTitle)}</span>` : ""}
    ${post.title ? `<span class="${(/* inlined export .P */"mfd")}-card-title">${escapeHtml(post.title)}</span>` : ""}
    ${post.excerpt ? `<span class="${(/* inlined export .P */"mfd")}-card-text">${escapeHtml(post.excerpt)}</span>` : ""}
    <span class="${(/* inlined export .P */"mfd")}-card-date">${escapeHtml(when(post.publishedAt))}</span>
  </span>`
        : `<span class="${(/* inlined export .P */"mfd")}-card-body">
    <span class="${(/* inlined export .P */"mfd")}-byline">
      ${avatarHtml(post.author.name, post.author.avatarUrl)}
      <span class="${(/* inlined export .P */"mfd")}-byline-t">
        <span class="${(/* inlined export .P */"mfd")}-byline-n">${escapeHtml(post.author.name || post.channelTitle)}</span>
        <span class="${(/* inlined export .P */"mfd")}-byline-d">${escapeHtml(when(post.publishedAt))}</span>
      </span>
    </span>
    ${post.excerpt ? `<span class="${(/* inlined export .P */"mfd")}-card-text">${escapeHtml(post.excerpt)}</span>` : ""}
  </span>`;
    // News leads with the photo; social leads with the person, so the photo drops
    // below the byline and text.
    const inner = post.kind === "news" ? media + body : body + media;
    return `<article class="${(/* inlined export .P */"mfd")}-card" data-id="${escapeHtml(post.id)}" data-kind="${post.kind}">
  ${link}${inner}${showActions ? socialActions(post, t, liked) : ""}
</article>`;
}
// ── Comments ─────────────────────────────────────────────────────────────────
function commentHtml(c, when) {
    return `<div class="${(/* inlined export .P */"mfd")}-cmt">
  ${avatarHtml(c.author.name, c.author.avatarUrl)}
  <div class="${(/* inlined export .P */"mfd")}-cmt-b">
    <span class="${(/* inlined export .P */"mfd")}-cmt-n">${escapeHtml(c.author.name)}</span>
    <div class="${(/* inlined export .P */"mfd")}-cmt-x">${c.html}</div>
    <span class="${(/* inlined export .P */"mfd")}-cmt-d">${escapeHtml(when(c.createdAt))}</span>
  </div>
</div>`;
}
// ── States ───────────────────────────────────────────────────────────────────
function stateHtml(message, actionLabel, actionAttr) {
    return `<div class="${(/* inlined export .P */"mfd")}-state">
  <span>${escapeHtml(message)}</span>
  ${actionLabel ? `<button type="button" class="${(/* inlined export .P */"mfd")}-btn" data-act="${escapeHtml(actionAttr || "retry")}">${escapeHtml(actionLabel)}</button>` : ""}
</div>`;
}
function skeletonHtml(n) {
    return `<div class="${(/* inlined export .P */"mfd")}-grid">${Array(n).fill(`<div class="${(/* inlined export .P */"mfd")}-skel"></div>`).join("")}</div>`;
}

;// ./mixed-feed.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mixed Feed — one chronological feed of social posts and news, filterable.
//
// Staffbase ships a social wall and a news feed as two separate widgets with two
// separate looks. This merges any set of channels into a single stream, sorted
// by publish date, with All / News / Social filter chips. The split is derived
// from each channel's `contentType` (articles → News, updates/pictures →
// Social), so an admin only ever pastes channel IDs — nothing has to be
// classified by hand.
//
// Presentation intent: generic and modern, not branded. The cards are neutral
// white-on-grey; only accents (chips, the like heart, buttons) take the brand
// color, which is resolved per viewer — a group override first, the tenant's
// theming API second. That way the same widget looks native in every brand of a
// multibrand tenant without an admin editing anything per branch.
// ─────────────────────────────────────────────────────────────────────────────
var mixed_feed_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};








const DEFAULT_BASE_URL = "https://app.staffbase.com/api";
/** Default pin for viewers outside every configured brand group: the tenant's
 *  highlighted corporate article. */
const DEFAULT_PINNED_POST = "6a8ca3f089ac527b38d85714";
/** Shipped as the default so the multibrand behaviour is demonstrable out of the
 *  box: El Globo staff get the maroon brand, 5px corners and a Globo pin;
 *  everyone else falls through to the theming API.
 *
 *  Both IDs are listed because this tenant has two distinct groups named
 *  "El Globo". `6aaa7d70…` is the one the production branding CSS and the
 *  cornerstone widget target, and the one real members belong to; `6a42ed43…`
 *  is the one that appears in `GET /groups`. Targeting only the latter matched
 *  nobody and silently fell back to the theme colour. */
const DEFAULT_BRAND_OVERRIDES = [
    {
        group: ["6aaa7d70a742e5436549bc91", "6a42ed4319053625a91b37c2", "El Globo"],
        label: "El Globo",
        color: "#8B374A",
        radius: "5px",
        pinnedPostId: "6a42efaf17470228967cf4e6",
    },
];
const FILTERS = ["all", "news", "social"];
const factory = (BaseBlockClass, widgetApi) => {
    return class MixedFeed extends BaseBlockClass {
        constructor() {
            super(...arguments);
            /**
             * The host calls renderBlock once per attribute change, so several async
             * renders can be in flight at once. Without a generation token the render
             * that started first — before the host had applied every attribute — can
             * resolve last and overwrite a newer, more complete one, silently dropping
             * whatever config arrived late (the composer was disappearing this way).
             */
            this.seq = 0;
            /** Undo hooks for listeners bound to targets that outlive a render. */
            this.teardown = [];
        }
        runTeardown() {
            this.teardown.splice(0).forEach(fn => { try {
                fn();
            }
            catch ( /* noop */_a) { /* noop */ } });
        }
        /** Listeners on `window`/`document` outlive the element, so a widget that is
         *  removed from the page (navigation, the editor swapping blocks) would keep
         *  them forever. Bumping `seq` also makes any in-flight render bail instead
         *  of painting into a detached tree. */
        disconnectedCallback() {
            this.seq++;
            this.runTeardown();
            const base = BaseBlockClass === null || BaseBlockClass === void 0 ? void 0 : BaseBlockClass.prototype;
            if (typeof (base === null || base === void 0 ? void 0 : base.disconnectedCallback) === "function")
                base.disconnectedCallback.call(this);
        }
        renderBlock(container) {
            return mixed_feed_awaiter(this, void 0, void 0, function* () {
                const mine = ++this.seq;
                const stale = () => mine !== this.seq;
                // `container`, `window` and `document` survive the innerHTML rewrite
                // below, so handlers from the previous render would stack and fire once
                // per render — double-toggling likes. Drop them first.
                this.runTeardown();
                const on = (target, type, fn) => {
                    target.addEventListener(type, fn);
                    this.teardown.push(() => target.removeEventListener(type, fn));
                };
                const attr = (n) => this.getAttribute(n) || "";
                const bool = (n, dflt) => {
                    const v = this.getAttribute(n);
                    return v == null || v === "" ? dflt : v === "true";
                };
                const debug = attr("debug") === "true";
                const log = (...a) => { if (debug)
                    console.log("[mixed-feed]", ...a); };
                const baseUrl = (attr("baseurl") || DEFAULT_BASE_URL).replace(/\/+$/, "");
                const token = attr("apitoken");
                const channelIds = parseChannelIds(attr("channelids"));
                const composeChannelId = attr("composechannelid").trim();
                const perChannelLimit = Math.max(1, Math.min(100, parseInt(attr("postlimit") || "12", 10) || 12));
                const totalLimit = Math.max(1, Math.min(200, parseInt(attr("totallimit") || "30", 10) || 30));
                const showActions = bool("showsocialactions", true);
                const showCompose = bool("showcomposer", true) && !!composeChannelId;
                const fullWidthMobile = bool("fullwidthmobile", true);
                const background = attr("backgroundcolor");
                const apiOpts = makeApiOpts(token);
                // Reads prefer the service token (it can see every channel regardless of
                // the viewer's own permissions on this endpoint) and fall back to the
                // session, which is the only identity available when no token is set.
                const readLadder = token ? [apiOpts, sessionOpts] : [sessionOpts];
                // ── Viewer ────────────────────────────────────────────────────────
                let viewer = { id: "", name: "", avatarUrl: "", groupIds: [], language: "" };
                try {
                    const prof = yield widgetApi.getUserInformation();
                    viewer = {
                        id: String((prof === null || prof === void 0 ? void 0 : prof.id) || ""),
                        name: [prof === null || prof === void 0 ? void 0 : prof.firstName, prof === null || prof === void 0 ? void 0 : prof.lastName].filter(Boolean).join(" "),
                        avatarUrl: "",
                        groupIds: ((prof === null || prof === void 0 ? void 0 : prof.groupIDs) || (prof === null || prof === void 0 ? void 0 : prof.groupIds) || []).map(String),
                        language: String((prof === null || prof === void 0 ? void 0 : prof.language) || (prof === null || prof === void 0 ? void 0 : prof.locale) || ""),
                    };
                    log("viewer", viewer.id, "groups", viewer.groupIds.length);
                }
                catch (e) {
                    log("getUserInformation failed —", e && e.message);
                }
                // ── Locale ────────────────────────────────────────────────────────
                const locale = resolveUiLocale(attr("language"), viewer.language);
                const t = makeT(BUNDLES, locale);
                const when = makeFormatters(locale);
                const rtl = isRtl(locale);
                log("locale", locale);
                // ── Brand ─────────────────────────────────────────────────────────
                const overridesRaw = attr("brandoverrides");
                const overrides = overridesRaw
                    ? parseOverrides(overridesRaw, log)
                    : DEFAULT_BRAND_OVERRIDES;
                // Staffbase tags an ancestor with `group-<id>` for every group the viewer
                // belongs to — the same hook tenant multibranding CSS uses. It reflects
                // what the host itself believes about this viewer, so it is unioned with
                // the profile call rather than trusting either one alone.
                const domGroups = groupsFromDom(container);
                if (domGroups.length)
                    log("groups from DOM", domGroups.join(","));
                const viewerGroupIds = Array.from(new Set([...viewer.groupIds, ...domGroups]));
                // Only pay for name lookups when a rule is actually written as a name.
                const groupNames = needsGroupNames(overrides)
                    ? yield fetchGroupNames(baseUrl, viewerGroupIds, readLadder, log)
                    : new Map();
                const brand = yield resolveBrand({
                    baseUrl,
                    apiToken: token,
                    overrides,
                    viewerGroupIds,
                    groupNames,
                    useThemeColor: bool("usethemecolors", true),
                    fallbackColor: attr("primarycolor"),
                    fallbackRadius: attr("defaultradius"),
                    fallbackPinnedPostId: attr("pinnedpostid") || DEFAULT_PINNED_POST,
                    log,
                });
                log("brand", brand.color, brand.radius, brand.matchedLabel || "(theme)");
                // A newer render has taken over while we were awaiting the profile and
                // theme; leave the DOM to it.
                if (stale())
                    return;
                // ── Shell ─────────────────────────────────────────────────────────
                const rootClasses = [`${(/* inlined export .P */"mfd")}-root`, fullWidthMobile ? `${(/* inlined export .P */"mfd")}-bleed` : ""].filter(Boolean).join(" ");
                container.innerHTML = `<style>${buildCss(brand, background, rtl)}</style>
<div class="${rootClasses}"${rtl ? ' dir="rtl"' : ""}>
  <div class="${(/* inlined export .P */"mfd")}-head">
    <h2 class="${(/* inlined export .P */"mfd")}-title">${escapeHtml(attr("title") || t("widget.title"))}</h2>
    <button type="button" class="${(/* inlined export .P */"mfd")}-refresh" data-act="refresh" aria-label="${escapeHtml(t("state.retry"))}">${ICONS.refresh}</button>
  </div>
  <div class="${(/* inlined export .P */"mfd")}-hero-slot"></div>
  <div class="${(/* inlined export .P */"mfd")}-bar" role="tablist"></div>
  <div class="${(/* inlined export .P */"mfd")}-compose-slot"></div>
  <div class="${(/* inlined export .P */"mfd")}-feed">${skeletonHtml(6)}</div>
</div>
<div class="${(/* inlined export .P */"mfd")}-scrim" data-act="close-sheet"></div>
<div class="${(/* inlined export .P */"mfd")}-sheet" role="dialog" aria-modal="true">
  <div class="${(/* inlined export .P */"mfd")}-sheet-head">
    <span class="${(/* inlined export .P */"mfd")}-sheet-title"></span>
    <button type="button" class="${(/* inlined export .P */"mfd")}-sheet-x" data-act="close-sheet" aria-label="${escapeHtml(t("a11y.close"))}">${ICONS.close}</button>
  </div>
  <div class="${(/* inlined export .P */"mfd")}-sheet-body"></div>
  <div class="${(/* inlined export .P */"mfd")}-sheet-foot">
    <textarea class="${(/* inlined export .P */"mfd")}-in" rows="1"></textarea>
    <button type="button" class="${(/* inlined export .P */"mfd")}-send" data-act="send" disabled>${ICONS.send}</button>
  </div>
</div>`;
                const root = container.querySelector(`.${(/* inlined export .P */"mfd")}-root`);
                const heroSlot = container.querySelector(`.${(/* inlined export .P */"mfd")}-hero-slot`);
                const bar = container.querySelector(`.${(/* inlined export .P */"mfd")}-bar`);
                const composeSlot = container.querySelector(`.${(/* inlined export .P */"mfd")}-compose-slot`);
                const feedEl = container.querySelector(`.${(/* inlined export .P */"mfd")}-feed`);
                const refreshBtn = container.querySelector(`.${(/* inlined export .P */"mfd")}-refresh`);
                const scrim = container.querySelector(`.${(/* inlined export .P */"mfd")}-scrim`);
                const sheet = container.querySelector(`.${(/* inlined export .P */"mfd")}-sheet`);
                const sheetTitle = container.querySelector(`.${(/* inlined export .P */"mfd")}-sheet-title`);
                const sheetBody = container.querySelector(`.${(/* inlined export .P */"mfd")}-sheet-body`);
                const sheetInput = container.querySelector(`.${(/* inlined export .P */"mfd")}-in`);
                const sheetSend = container.querySelector(`.${(/* inlined export .P */"mfd")}-send`);
                // ── State ─────────────────────────────────────────────────────────
                let posts = [];
                let pinned = null;
                let filter = "all";
                const liked = new Set();
                /** "comments" targets a post; "compose" writes a new one. */
                let sheetMode = null;
                let sheetPostId = "";
                const visible = () => posts.filter(p => (filter === "all" || p.kind === filter) && (!pinned || p.id !== pinned.id));
                // ── Load ──────────────────────────────────────────────────────────
                function load() {
                    return mixed_feed_awaiter(this, void 0, void 0, function* () {
                        if (!channelIds.length) {
                            heroSlot.innerHTML = "";
                            bar.innerHTML = "";
                            feedEl.innerHTML = stateHtml(t("state.configure"));
                            return;
                        }
                        const rawChannels = yield fetchChannels(baseUrl, readLadder, log);
                        const channels = channelIds.map(id => {
                            const raw = rawChannels.get(id);
                            // A channel missing from the list is still fetched — it may simply be
                            // outside the branch-wide listing — but it has no title or type, so it
                            // defaults to News.
                            return raw ? toChannel(raw, locale) : { id, title: "", kind: "news", contentType: "" };
                        });
                        posts = yield loadFeed({
                            base: baseUrl, channels, perChannelLimit, totalLimit, ladder: readLadder, locale, log,
                        });
                        pinned = yield resolvePinned(channels);
                        if (stale())
                            return;
                        if (showActions)
                            void hydrateLikes();
                        paint();
                    });
                }
                /** The hero post. Prefers the explicitly configured/brand-matched id; if
                 *  that post is not in the loaded feed it is fetched directly, so an admin
                 *  can pin something from a channel that is not even in the feed. Falls
                 *  back to the newest `highlighted` post, then to the newest post. */
                function resolvePinned(channels) {
                    return mixed_feed_awaiter(this, void 0, void 0, function* () {
                        const wanted = brand.pinnedPostId;
                        if (wanted) {
                            const inFeed = posts.find(p => p.id === wanted);
                            if (inFeed)
                                return inFeed;
                            const raw = yield fetchPost(baseUrl, wanted, readLadder, log);
                            if (raw) {
                                const ch = channels.find(c => c.id === raw.channelID)
                                    || { id: raw.channelID || "", title: "", kind: "news", contentType: String(raw.contentType || "") };
                                const mapped = toFeedPost(raw, ch, locale);
                                if (mapped)
                                    return mapped;
                            }
                            log("pinned post not resolvable:", wanted);
                        }
                        return posts.find(p => p.highlighted) || posts[0] || null;
                    });
                }
                /** Per-post like state, so the heart reflects the viewer rather than just
                 *  a count. Runs after paint and repaints only the buttons it changes —
                 *  the feed must not wait on a fan-out of reaction calls. */
                function hydrateLikes() {
                    return mixed_feed_awaiter(this, void 0, void 0, function* () {
                        if (!viewer.id)
                            return;
                        const targets = posts.slice(0, 24);
                        yield Promise.all(targets.map((p) => mixed_feed_awaiter(this, void 0, void 0, function* () {
                            const state = yield fetchLikeState(baseUrl, p.id, viewer.id, log);
                            if (!state)
                                return;
                            p.likeCount = state.count;
                            if (state.mine)
                                liked.add(p.id);
                            else
                                liked.delete(p.id);
                            paintLike(p);
                        })));
                    });
                }
                // ── Paint ─────────────────────────────────────────────────────────
                function paint() {
                    heroSlot.innerHTML = pinned ? heroHtml(pinned, t, when) : "";
                    paintBar();
                    paintCompose();
                    const list = visible();
                    feedEl.innerHTML = list.length
                        ? `<div class="${(/* inlined export .P */"mfd")}-grid">${list.map(p => cardHtml(p, t, when, showActions, liked.has(p.id))).join("")}</div>`
                        : stateHtml(posts.length ? t("state.emptyFiltered") : t("state.empty"));
                }
                function paintBar() {
                    bar.innerHTML = FILTERS.map(key => {
                        const n = key === "all" ? posts.length : posts.filter(p => p.kind === key).length;
                        // A filter that can never match anything is noise, so it is omitted.
                        if (!n && key !== "all")
                            return "";
                        return `<button type="button" role="tab" aria-selected="${filter === key}"
            class="${(/* inlined export .P */"mfd")}-chip${filter === key ? ` ${(/* inlined export .P */"mfd")}-on` : ""}" data-filter="${key}">
            ${escapeHtml(t(`filter.${key}`))}<span class="${(/* inlined export .P */"mfd")}-chip-n">${n}</span>
          </button>`;
                    }).join("");
                }
                function paintCompose() {
                    composeSlot.innerHTML = showCompose
                        ? `<button type="button" class="${(/* inlined export .P */"mfd")}-compose" data-act="compose">
              ${avatarHtml(viewer.name, viewer.avatarUrl)}
              <span class="${(/* inlined export .P */"mfd")}-compose-ph">${escapeHtml(t("compose.placeholder"))}</span>
            </button>`
                        : "";
                }
                function paintLike(post) {
                    const btn = feedEl.querySelector(`.${(/* inlined export .P */"mfd")}-like[data-id="${post.id}"]`);
                    if (!btn)
                        return;
                    const on = liked.has(post.id);
                    btn.classList.toggle(`${(/* inlined export .P */"mfd")}-on`, on);
                    btn.setAttribute("aria-pressed", String(on));
                    const icon = on ? ICONS.heartFilled : ICONS.heart;
                    const count = post.likeCount ? String(post.likeCount) : "";
                    btn.innerHTML = `${icon}<span class="${(/* inlined export .P */"mfd")}-act-n">${count}</span>`;
                }
                // ── Likes ─────────────────────────────────────────────────────────
                function toggleLike(postId, btn) {
                    return mixed_feed_awaiter(this, void 0, void 0, function* () {
                        const post = posts.find(p => p.id === postId);
                        if (!post || !viewer.id)
                            return;
                        const next = !liked.has(postId);
                        // Optimistic: the tap must feel instant, and a failed write is reverted
                        // below rather than blocking the interaction.
                        if (next)
                            liked.add(postId);
                        else
                            liked.delete(postId);
                        post.likeCount = Math.max(0, post.likeCount + (next ? 1 : -1));
                        paintLike(post);
                        const fresh = feedEl.querySelector(`.${(/* inlined export .P */"mfd")}-like[data-id="${postId}"]`);
                        if (fresh && next) {
                            fresh.classList.add(`${(/* inlined export .P */"mfd")}-pop`);
                            setTimeout(() => fresh.classList.remove(`${(/* inlined export .P */"mfd")}-pop`), 340);
                        }
                        const ok = yield setLike(baseUrl, postId, next);
                        if (!ok) {
                            if (next)
                                liked.delete(postId);
                            else
                                liked.add(postId);
                            post.likeCount = Math.max(0, post.likeCount + (next ? -1 : 1));
                            paintLike(post);
                        }
                    });
                }
                // ── Sheet ─────────────────────────────────────────────────────────
                function openSheet(mode, postId = "") {
                    sheetMode = mode;
                    sheetPostId = postId;
                    sheetTitle.textContent = mode === "compose" ? t("compose.title") : t("social.comments");
                    sheetInput.placeholder = mode === "compose" ? t("compose.placeholder") : t("social.commentPlaceholder");
                    sheetInput.value = "";
                    sheetSend.disabled = true;
                    sheetBody.innerHTML = mode === "compose"
                        ? ""
                        : `<div class="${(/* inlined export .P */"mfd")}-cmt-empty"><span class="${(/* inlined export .P */"mfd")}-spin"></span></div>`;
                    scrim.classList.add(`${(/* inlined export .P */"mfd")}-open`);
                    sheet.classList.add(`${(/* inlined export .P */"mfd")}-open`);
                    // Deferred so the sheet's entry transform finishes before the keyboard
                    // animates up on iOS; focusing mid-transition fights the two animations.
                    setTimeout(() => sheetInput.focus(), 320);
                    if (mode === "comments")
                        void loadCommentsInto(postId);
                }
                function closeSheet() {
                    scrim.classList.remove(`${(/* inlined export .P */"mfd")}-open`);
                    sheet.classList.remove(`${(/* inlined export .P */"mfd")}-open`);
                    sheetMode = null;
                    sheetPostId = "";
                }
                function loadCommentsInto(postId) {
                    return mixed_feed_awaiter(this, void 0, void 0, function* () {
                        const rows = yield fetchComments(baseUrl, postId, readLadder, 500, log);
                        if (sheetPostId !== postId)
                            return; // the viewer moved on
                        const mapped = rows.map(toComment)
                            .sort((a, b) => a.createdAt - b.createdAt);
                        sheetBody.innerHTML = mapped.length
                            ? mapped.map(c => commentHtml(c, when)).join("")
                            : `<div class="${(/* inlined export .P */"mfd")}-cmt-empty">${escapeHtml(t("social.noComments"))}</div>`;
                        sheetBody.scrollTop = sheetBody.scrollHeight;
                    });
                }
                function toComment(c) {
                    var _a, _b, _c, _d, _e, _f;
                    const a = c.author || {};
                    const raw = c.text || c.contents || c.content || "";
                    return {
                        id: c.id,
                        html: sanitizeHtml(String(raw)),
                        createdAt: Date.parse(c.created || c.published || "") || 0,
                        author: {
                            id: a.id || "",
                            name: [a.firstName, a.lastName].filter(Boolean).join(" ") || "—",
                            avatarUrl: ((_b = (_a = a.avatar) === null || _a === void 0 ? void 0 : _a.icon) === null || _b === void 0 ? void 0 : _b.url) || ((_d = (_c = a.avatar) === null || _c === void 0 ? void 0 : _c.thumb) === null || _d === void 0 ? void 0 : _d.url) || ((_f = (_e = a.avatar) === null || _e === void 0 ? void 0 : _e.original) === null || _f === void 0 ? void 0 : _f.url) || "",
                        },
                    };
                }
                function sheetError(message) {
                    const existing = sheet.querySelector(`.${(/* inlined export .P */"mfd")}-err`);
                    if (existing)
                        existing.remove();
                    const el = document.createElement("div");
                    el.className = `${(/* inlined export .P */"mfd")}-err`;
                    el.textContent = message;
                    sheetBody.appendChild(el);
                    sheetBody.scrollTop = sheetBody.scrollHeight;
                }
                function submitSheet() {
                    return mixed_feed_awaiter(this, void 0, void 0, function* () {
                        const text = sheetInput.value.trim();
                        if (!text || !sheetMode)
                            return;
                        sheetSend.disabled = true;
                        const mode = sheetMode;
                        const postId = sheetPostId;
                        if (mode === "comments") {
                            const created = yield postComment(baseUrl, postId, text);
                            if (!created) {
                                sheetError(t("social.commentFailed"));
                                sheetSend.disabled = false;
                                return;
                            }
                            sheetInput.value = "";
                            const post = posts.find(p => p.id === postId);
                            if (post) {
                                post.commentCount += 1;
                                const btn = feedEl.querySelector(`.${(/* inlined export .P */"mfd")}-act[data-act="comments"][data-id="${postId}"] .${(/* inlined export .P */"mfd")}-act-n`);
                                if (btn)
                                    btn.textContent = String(post.commentCount);
                            }
                            yield loadCommentsInto(postId);
                            return;
                        }
                        const created = yield createPost(baseUrl, composeChannelId, locale, text);
                        if (!created) {
                            sheetError(t("compose.failed"));
                            sheetSend.disabled = false;
                            return;
                        }
                        closeSheet();
                        // Show it immediately rather than refetching: the new post is the one
                        // thing the viewer is certain to look for straight after posting.
                        const channel = { id: composeChannelId, title: "", kind: "social", contentType: "updates" };
                        const mapped = toFeedPost(Object.assign(Object.assign({}, created), { contentType: created.contentType || "updates" }), channel, locale);
                        if (mapped) {
                            if (!mapped.author.name && viewer.name)
                                mapped.author = Object.assign(Object.assign({}, mapped.author), { name: viewer.name, avatarUrl: viewer.avatarUrl });
                            if (!mapped.publishedAt)
                                mapped.publishedAt = Date.now();
                            if (!mapped.excerpt)
                                mapped.excerpt = text;
                            posts.unshift(mapped);
                            paint();
                        }
                        else {
                            void load();
                        }
                    });
                }
                // ── Events ────────────────────────────────────────────────────────
                // ── Full-bleed on phones ──────────────────────────────────────────
                // Measured rather than assumed. `calc(50% - 50vw)` has to guess the host's
                // padding, and guessing high is destructive: any ancestor with a clipping
                // overflow shears the overhang and eats the first character of every line.
                // So we measure the real gap to the widest edge we are actually allowed to
                // reach — the viewport, or the nearest clipping ancestor if one is
                // narrower — and stop exactly there.
                function bleedBounds() {
                    let left = 0;
                    let right = document.documentElement.clientWidth;
                    for (let el = root.parentElement; el; el = el.parentElement) {
                        const cs = getComputedStyle(el);
                        const clips = /hidden|clip|auto|scroll/.test(cs.overflowX);
                        if (!clips)
                            continue;
                        const r = el.getBoundingClientRect();
                        // Stay inside the padding box; the border would cover us otherwise.
                        left = Math.max(left, r.left + parseFloat(cs.borderLeftWidth || "0"));
                        right = Math.min(right, r.right - parseFloat(cs.borderRightWidth || "0"));
                        break;
                    }
                    return { left, right };
                }
                function applyBleed() {
                    if (!fullWidthMobile || !root)
                        return;
                    root.style.setProperty("--bleed-l", "0px");
                    root.style.setProperty("--bleed-r", "0px");
                    if (window.innerWidth > 640)
                        return;
                    const rect = root.getBoundingClientRect();
                    const bounds = bleedBounds();
                    root.style.setProperty("--bleed-l", `-${Math.max(0, Math.round(rect.left - bounds.left))}px`);
                    root.style.setProperty("--bleed-r", `-${Math.max(0, Math.round(bounds.right - rect.right))}px`);
                }
                applyBleed();
                let bleedTimer = 0;
                on(window, "resize", () => {
                    clearTimeout(bleedTimer);
                    bleedTimer = window.setTimeout(applyBleed, 120);
                });
                on(container, "click", (ev) => {
                    const target = ev.target;
                    const chip = target.closest(`.${(/* inlined export .P */"mfd")}-chip`);
                    if (chip && chip.dataset.filter) {
                        filter = chip.dataset.filter;
                        paint();
                        return;
                    }
                    const btn = target.closest("[data-act]");
                    if (!btn)
                        return;
                    const act = btn.dataset.act;
                    if (act === "like") {
                        ev.preventDefault();
                        void toggleLike(btn.dataset.id || "", btn);
                        return;
                    }
                    if (act === "comments") {
                        ev.preventDefault();
                        openSheet("comments", btn.dataset.id || "");
                        return;
                    }
                    if (act === "compose") {
                        ev.preventDefault();
                        openSheet("compose");
                        return;
                    }
                    if (act === "close-sheet") {
                        ev.preventDefault();
                        closeSheet();
                        return;
                    }
                    if (act === "send") {
                        ev.preventDefault();
                        void submitSheet();
                        return;
                    }
                    if (act === "refresh" || act === "retry") {
                        ev.preventDefault();
                        refreshBtn.classList.add(`${(/* inlined export .P */"mfd")}-busy`);
                        void load().finally(() => refreshBtn.classList.remove(`${(/* inlined export .P */"mfd")}-busy`));
                    }
                });
                sheetInput.addEventListener("input", () => {
                    sheetSend.disabled = !sheetInput.value.trim();
                    // Grow with the text, capped by the CSS max-height.
                    sheetInput.style.height = "auto";
                    sheetInput.style.height = `${sheetInput.scrollHeight}px`;
                });
                sheetInput.addEventListener("keydown", (ev) => {
                    // Enter sends; Shift+Enter is a newline. On touch keyboards Enter is a
                    // literal newline key, so only the modifier-free desktop case submits.
                    if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
                        ev.preventDefault();
                        void submitSheet();
                    }
                });
                on(document, "keydown", ((ev) => {
                    if (ev.key === "Escape" && sheetMode)
                        closeSheet();
                }));
                // The viewer's own avatar is not part of getUserInformation, so it is
                // fetched separately and painted in once it lands.
                if (viewer.id) {
                    void fetchUser(baseUrl, viewer.id, readLadder, log).then(u => {
                        if (!u || stale())
                            return;
                        viewer = Object.assign(Object.assign({}, viewer), { name: viewer.name || u.name, avatarUrl: u.avatarUrl });
                        paintCompose();
                    });
                }
                try {
                    yield load();
                }
                catch (e) {
                    log("load failed —", e && e.message);
                    feedEl.innerHTML = stateHtml(t("state.error"), t("state.retry"), "retry");
                }
                // Referenced so the unused-import check stays honest about helpers that are
                // only used through the render layer.
                void root;
                void pickLocalized;
                void toPlainText;
            });
        }
        static get observedAttributes() {
            return ATTRIBUTES;
        }
    };
};
// ── Configuration ────────────────────────────────────────────────────────────
const ATTRIBUTES = [
    "apitoken", "baseurl", "channelids", "title", "postlimit", "totallimit",
    "showsocialactions", "showcomposer", "composechannelid",
    "pinnedpostid", "brandoverrides", "usethemecolors", "primarycolor", "defaultradius",
    "language", "fullwidthmobile", "backgroundcolor", "debug",
];
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token" },
        baseurl: { type: "string", title: "Base URL", default: DEFAULT_BASE_URL },
        channelids: { type: "string", title: "Channel IDs" },
        title: { type: "string", title: "Widget Title" },
        postlimit: { type: "number", title: "Posts per Channel", default: 12 },
        totallimit: { type: "number", title: "Total Posts", default: 30 },
        language: {
            type: "string", title: "Language", default: "es_MX",
            enum: ["es_MX", "es_ES", "en_US", "de_DE", "auto"],
        },
        pinnedpostid: { type: "string", title: "Pinned Post ID", default: DEFAULT_PINNED_POST },
        brandoverrides: {
            type: "string", title: "Brand Overrides (JSON)",
            default: JSON.stringify(DEFAULT_BRAND_OVERRIDES, null, 2),
        },
        usethemecolors: { type: "boolean", title: "Use Theme Color", default: true },
        defaultradius: { type: "string", title: "Default Corner Radius", default: "14px" },
        showsocialactions: { type: "boolean", title: "Show Likes & Comments", default: true },
        showcomposer: { type: "boolean", title: "Show Composer", default: true },
        fullwidthmobile: { type: "boolean", title: "Full Width on Mobile", default: true },
        backgroundcolor: { type: "string", title: "Background Color", default: "" },
        debug: { type: "boolean", title: "Debug Logging", default: false },
    },
    dependencies: {
        // The manual color picker is only meaningful when the theming API is not
        // supplying the color.
        usethemecolors: {
            oneOf: [
                {
                    properties: {
                        usethemecolors: { const: false },
                        primarycolor: { type: "string", title: "Primary Color", default: "#1F6FEB" },
                    },
                },
                { properties: { usethemecolors: { const: true } } },
            ],
        },
        showcomposer: {
            oneOf: [
                {
                    properties: {
                        showcomposer: { const: true },
                        composechannelid: { type: "string", title: "Composer Channel ID" },
                    },
                },
                { properties: { showcomposer: { const: false } } },
            ],
        },
    },
};
const uiSchema = {
    apitoken: { "ui:widget": "password", "ui:help": "Base64-encoded API token (e.g. from *.staffbase.com or *.staffbase.rocks)" },
    baseurl: { "ui:help": "API base URL e.g. https://yourorg.staffbase.com/api" },
    channelids: {
        "ui:widget": "textarea",
        "ui:help": "Channel IDs to merge into the feed — comma-separated (recommended) or one per line. News vs. Social is detected automatically from each channel's content type (articles → News, updates & pictures → Social).",
    },
    title: { "ui:help": "Heading shown above the feed. Leave blank to use the translated default." },
    postlimit: { "ui:help": "How many posts to pull from each channel before merging (1–100)." },
    totallimit: { "ui:help": "Maximum number of posts shown after merging (1–200)." },
    language: { "ui:help": "Interface language. Defaults to Spanish (Mexico). Choose “auto” to follow the viewer's Staffbase language, then the browser, falling back to Spanish." },
    pinnedpostid: { "ui:help": "Post shown in the large hero card. Overridden per group below. Leave blank to pin the newest highlighted post." },
    brandoverrides: {
        "ui:widget": "textarea",
        "ui:help": 'JSON array of {"group","label","color","radius","pinnedPostId"}. "group" is a group ID, a group name, or an array of either — useful when two groups share a name. The first entry matching one of the viewer\'s groups wins; everyone else gets the theme color and the defaults below.',
    },
    usethemecolors: { "ui:help": "Pull the accent color from the app's branding theme (uses the API Token) when no group override matches." },
    primarycolor: { "ui:widget": "color", "ui:help": "Accent color used for chips, buttons and the like heart." },
    defaultradius: { "ui:help": "Corner radius for viewers with no group override, e.g. 14px or 0." },
    showsocialactions: { "ui:help": "Show like and comment buttons on cards. Actions are performed as the logged-in user." },
    showcomposer: { "ui:help": "Show a “What's on your mind?” box that posts to the channel below." },
    composechannelid: { "ui:help": "Social channel new posts are published to. Required for the composer to appear." },
    fullwidthmobile: { "ui:help": "On phones, break out of the page's card padding so the feed spans the full screen width." },
    backgroundcolor: { "ui:widget": "color", "ui:help": "Widget background — leave blank for transparent." },
    debug: { "ui:help": "Log channel/post/brand resolution to the browser console." },
};
const blockDefinition = {
    name: "mixed-feed",
    label: "Mixed Feed",
    attributes: ATTRIBUTES,
    factory,
    configurationSchema,
    uiSchema,
    blockLevel: "block",
    iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48Y2lyY2xlIGN4PSI4NS41IiBjeT0iODUuNSIgcj0iODUuNSIgZmlsbD0iIzhCMzc0QSIvPjxnIGZpbGw9IiNmZmYiPjxyZWN0IHg9IjM2IiB5PSIzOCIgd2lkdGg9Ijk5IiBoZWlnaHQ9IjQyIiByeD0iNiIvPjxyZWN0IHg9IjM2IiB5PSI5MCIgd2lkdGg9IjQ0IiBoZWlnaHQ9IjQzIiByeD0iNiIvPjxyZWN0IHg9IjkxIiB5PSI5MCIgd2lkdGg9IjQ0IiBoZWlnaHQ9IjQzIiByeD0iNiIvPjwvZz48L3N2Zz4=",
};
const externalBlockDefinition = {
    blockDefinition,
    author: "Staffbase",
    version: "1.0.0",
};
window.defineBlock(externalBlockDefinition);

/******/ })()
;