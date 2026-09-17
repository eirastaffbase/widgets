/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

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
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
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
    return __awaiter(this, arguments, void 0, function* (baseUrl, apiToken, themeId = "primary", surface = "light") {
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

;// ./api.ts
// ─────────────────────────────────────────────────────────────────────────────
// API layer — a deliberately small one.
//
// This widget reads *people*, nothing else. Two identities are available:
//
//   token   — Basic API token. A service identity, not a user. Reads `/users`
//             and `/groups`.
//   session — the signed-in viewer's cookie + CSRF. Required for endpoints the
//             backend declares USER-only, e.g. `/profiles/public/{id}`.
//
// Ported from `engagement-leaderboard/api.ts`, trimmed to the four calls this
// widget actually makes: one user lookup, one public-profile avatar upgrade,
// and the two group-list endpoints multibranding needs.
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
const makeApiOpts = (apiToken) => (extra) => (Object.assign(Object.assign({}, extra), { credentials: "omit", headers: Object.assign({ Authorization: `Basic ${apiToken}`, "Content-Type": "application/json" }, ((extra === null || extra === void 0 ? void 0 : extra.headers) || {})) }));
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
    return Object.assign(Object.assign({}, extra), { credentials: "include", headers: Object.assign(Object.assign({}, (csrf ? { "x-csrf-token": csrf } : {})), ((extra === null || extra === void 0 ? void 0 : extra.headers) || {})) });
};
const RETRY_STATUS = [429, 500, 502, 503, 504];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
class Http {
    constructor(concurrency, log) {
        this.concurrency = concurrency;
        this.log = log;
        this.active = 0;
        this.queue = [];
    }
    acquire() {
        if (this.active < this.concurrency) {
            this.active++;
            return Promise.resolve();
        }
        return new Promise(resolve => this.queue.push(() => { this.active++; resolve(); }));
    }
    release() {
        this.active--;
        const next = this.queue.shift();
        if (next)
            next();
    }
    /** GET JSON with backoff. Throws `HTTP <status>` on a non-retryable failure. */
    getJson(url_1, makeOpts_1) {
        return api_awaiter(this, arguments, void 0, function* (url, makeOpts, tries = 3) {
            yield this.acquire();
            try {
                let lastErr = new Error("no attempt");
                for (let i = 0; i < tries; i++) {
                    try {
                        const res = yield fetch(url, makeOpts({ headers: { Accept: "application/json" } }));
                        if (res.ok)
                            return yield res.json();
                        // A burst-403 is the rate limiter, but a genuine 403 (wrong identity)
                        // must surface immediately on the last try.
                        const retryable = RETRY_STATUS.indexOf(res.status) >= 0 || (res.status === 403 && i < tries - 1);
                        if (!retryable)
                            throw new Error(`HTTP ${res.status}`);
                        const retryAfter = Number(res.headers.get("Retry-After") || 0);
                        yield sleep(retryAfter > 0 ? retryAfter * 1000 : 400 * Math.pow(2, i));
                        lastErr = new Error(`HTTP ${res.status}`);
                    }
                    catch (e) {
                        lastErr = e instanceof Error ? e : new Error(String(e));
                        if (/^HTTP (4\d\d)$/.test(lastErr.message) && !/HTTP 429/.test(lastErr.message))
                            throw lastErr;
                        if (i < tries - 1)
                            yield sleep(400 * Math.pow(2, i));
                    }
                }
                throw lastErr;
            }
            finally {
                this.release();
            }
        });
    }
    /** Try each identity in turn, returning the first success. */
    ladder(url, order, label) {
        return api_awaiter(this, void 0, void 0, function* () {
            let lastErr = new Error("no identity available");
            for (let i = 0; i < order.length; i++) {
                try {
                    return yield this.getJson(url, order[i]);
                }
                catch (e) {
                    lastErr = e;
                    this.log(`${label}: identity ${i + 1}/${order.length} failed —`, e.message);
                }
            }
            throw lastErr;
        });
    }
}
// ── Normalizers ──────────────────────────────────────────────────────────────
/** Avatar URL preference, largest-to-smallest fallback. `icon` is 48px,
 *  `thumb` 200px — podium avatars want the bigger one. */
function avatarUrl(a, prefer = "thumb") {
    var _a, _b, _c;
    if (!a)
        return "";
    const icon = ((_a = a.icon) === null || _a === void 0 ? void 0 : _a.url) || "";
    const thumb = ((_b = a.thumb) === null || _b === void 0 ? void 0 : _b.url) || "";
    const orig = ((_c = a.original) === null || _c === void 0 ? void 0 : _c.url) || "";
    return prefer === "thumb" ? (thumb || icon || orig) : (icon || thumb || orig);
}
function toPerson(u) {
    var _a, _b;
    return {
        id: u.id || "",
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "",
        avatar: avatarUrl(u.avatar),
        position: u.position || ((_a = u.profile) === null || _a === void 0 ? void 0 : _a.position) || "",
        department: u.department || ((_b = u.profile) === null || _b === void 0 ? void 0 : _b.department) || "",
        synthetic: false,
    };
}
/**
 * Staffbase avatar URLs carry their pixel size in the path
 * (`.../image-48.jpg`). Rewriting it is the difference between a crisp podium
 * portrait and a 48px image stretched to 96.
 */
function hiResAvatar(url, px) {
    if (!url)
        return "";
    return url.replace(/-(\d{2,4})(\.[a-z]{3,4})(\?|$)/i, (m, n, ext, tail) => Number(n) >= px ? m : `-${px}${ext}${tail}`);
}
// ── Endpoints ────────────────────────────────────────────────────────────────
/** One named person. Returns `null` rather than throwing: a mistyped user ID in
 *  the editor degrades that row to a demo peer instead of killing the chart. */
function fetchUserById(http, base, id, order) {
    return api_awaiter(this, void 0, void 0, function* () {
        try {
            const d = yield http.ladder(`${base}/users/${encodeURIComponent(id)}`, order, `user ${id}`);
            const p = toPerson(d || {});
            return p.id ? p : null;
        }
        catch (_) {
            return null;
        }
    });
}
/**
 * `/profiles/public/{id}` returns a 200px square `avatarUrl` where `/users`
 * gives a 48px icon, so it is worth one extra request for the three people who
 * appear at podium size. USER-only, so it is attempted under session first and
 * simply skipped when there is no session.
 */
function fetchPublicProfile(http, base, id, order) {
    return api_awaiter(this, void 0, void 0, function* () {
        try {
            const d = yield http.ladder(`${base}/profiles/public/${encodeURIComponent(id)}`, order, `profile ${id}`);
            return {
                avatar: (d === null || d === void 0 ? void 0 : d.avatarUrl) || avatarUrl(d === null || d === void 0 ? void 0 : d.avatar, "thumb") || "",
                position: (d === null || d === void 0 ? void 0 : d.position) || "",
                department: (d === null || d === void 0 ? void 0 : d.department) || "",
            };
        }
        catch (_) {
            return null;
        }
    });
}
/**
 * Every group in the branch as an id→name map.
 *
 * Two endpoints, merged: `/groups/search` is the current one but does not
 * return everything, and legacy `/groups` fills the gaps. This is the same
 * two-call merge `tasks/my-tasks-widget.ts` uses, and it exists only so that
 * brand rules can be written as human-readable group *names*.
 */
function fetchGroupNames(http, base, order) {
    return api_awaiter(this, void 0, void 0, function* () {
        const out = new Map();
        const nameOf = (g) => {
            var _a, _b, _c, _d, _e, _f;
            return ((_c = (_b = (_a = g === null || g === void 0 ? void 0 : g.config) === null || _a === void 0 ? void 0 : _a.localization) === null || _b === void 0 ? void 0 : _b.en_US) === null || _c === void 0 ? void 0 : _c.title)
                || ((_f = (_e = (_d = g === null || g === void 0 ? void 0 : g.config) === null || _d === void 0 ? void 0 : _d.localization) === null || _e === void 0 ? void 0 : _e.en_US) === null || _f === void 0 ? void 0 : _f.name)
                || (g === null || g === void 0 ? void 0 : g.name)
                || "";
        };
        const [searchRes, legacyRes] = yield Promise.all([
            http.ladder(`${base}/groups/search?limit=100&sort=name_ASC`, order, "groups/search").catch(() => null),
            http.ladder(`${base}/groups?limit=200`, order, "groups").catch(() => null),
        ]);
        if (searchRes) {
            const rows = searchRes.entries || searchRes.data || searchRes.results
                || searchRes.items || (Array.isArray(searchRes) ? searchRes : []);
            for (const e of rows) {
                const inner = (e === null || e === void 0 ? void 0 : e.data) || e;
                const name = nameOf(inner);
                if ((inner === null || inner === void 0 ? void 0 : inner.id) && name && !out.has(inner.id))
                    out.set(inner.id, name);
            }
        }
        if (legacyRes) {
            for (const g of (legacyRes.data || [])) {
                const name = nameOf(g);
                if ((g === null || g === void 0 ? void 0 : g.id) && name && !out.has(g.id))
                    out.set(g.id, name);
            }
        }
        return out;
    });
}

;// ./branding.ts
// ─────────────────────────────────────────────────────────────────────────────
// Multibranding — theming driven by the viewer's group membership.
//
// Staffbase multibranding works by using groups to vary presentation, so the
// honest implementation is: ask who is looking, ask which groups they are in,
// and pick a brand from that. The viewer identity comes from the widget SDK,
// not from an API call —
//
//     const profile = await widgetApi.getUserInformation();
//     profile.id; profile.groupIDs;
//
// — the same idiom `tasks/my-tasks-widget.ts:3062` uses. Group *names* cost two
// extra requests and are only resolved when a brand rule is written as a name
// rather than an ID, so ID-based configuration stays free.
//
// Resolution is first-match-by-slot, not best-match: a person in two branded
// groups must get a stable answer, and "whichever group the API listed first"
// is not one.
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

const MAX_BRANDS = 4;
const branding_isHex = (s) => /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(s).trim());
/** Normalize `#abc` → `#aabbcc` so downstream slicing is safe. */
function normalizeHex(s) {
    const v = String(s || "").trim();
    if (!branding_isHex(v))
        return "";
    const h = v.slice(1);
    return h.length === 3 ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase() : `#${h.toLowerCase()}`;
}
// ── Contrast ─────────────────────────────────────────────────────────────────
//
// A brand colour chosen for a white header is routinely unreadable on the dark
// stage (and vice versa). `tasks/shared/theming.ts` solves this internally but
// does not export the helper, so it is reimplemented here rather than reaching
// into a shared file this widget does not own.
function toRgb(hex) {
    const h = (hex.replace("#", "") + "000000").slice(0, 6);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbTriplet(hex) {
    const [r, g, b] = toRgb(hex);
    return `${r},${g},${b}`;
}
function branding_relLuminance(hex) {
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const [r, g, b] = toRgb(hex).map(v => v / 255);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrastWith = (hex, other) => {
    const l = branding_relLuminance(hex);
    const [hi, lo] = l > other ? [l, other] : [other, l];
    return (hi + 0.05) / (lo + 0.05);
};
function branding_hexToHsl(hex) {
    const [r0, g0, b0] = toRgb(hex).map(v => v / 255);
    const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0);
    const l = (max + min) / 2;
    if (max === min)
        return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r0)
        h = ((g0 - b0) / d + (g0 < b0 ? 6 : 0));
    else if (max === g0)
        h = (b0 - r0) / d + 2;
    else
        h = (r0 - g0) / d + 4;
    return { h: h * 60, s, l };
}
function branding_hslToHex(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    const [r1, g1, b1] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
        : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
    const m = l - c / 2;
    const to = (v) => Math.round(Math.min(255, Math.max(0, (v + m) * 255)))
        .toString(16).padStart(2, "0");
    return `#${to(r1)}${to(g1)}${to(b1)}`;
}
/**
 * Nudge a colour's lightness until it clears `target` contrast against the
 * surface, keeping hue and saturation so it still reads as the brand.
 */
function fitToSurface(hex, surface, target = 3.2) {
    const base = normalizeHex(hex);
    if (!base)
        return "";
    const surfaceLum = surface === "dark" ? branding_relLuminance("#0b0d12") : branding_relLuminance("#ffffff");
    if (contrastWith(base, surfaceLum) >= target)
        return base;
    const { h, s } = branding_hexToHsl(base);
    const step = surface === "dark" ? 0.04 : -0.04;
    let { l } = branding_hexToHsl(base);
    for (let i = 0; i < 24; i++) {
        l = Math.min(0.94, Math.max(0.08, l + step));
        const candidate = branding_hslToHex(h, Math.max(0.35, s), l);
        if (contrastWith(candidate, surfaceLum) >= target)
            return candidate;
    }
    // Give up gracefully: a legible neutral beats an invisible brand colour.
    return surface === "dark" ? "#e8edf7" : "#1b2030";
}
// ── Brand slots ──────────────────────────────────────────────────────────────
/** Read `brand1group`/`brand1primary`/… out of the flat attribute bag.
 *  A slot with no group or no primary colour is simply not a brand. */
function readBrands(attr) {
    const out = [];
    for (let i = 1; i <= MAX_BRANDS; i++) {
        const group = (attr(`brand${i}group`) || "").trim();
        const primary = normalizeHex(attr(`brand${i}primary`));
        if (!group || !primary)
            continue;
        out.push({
            group,
            primary,
            accent: normalizeHex(attr(`brand${i}accent`)) || primary,
            label: (attr(`brand${i}label`) || "").trim(),
            slot: i,
        });
    }
    return out;
}
/** Ask the SDK who is looking. Never throws — a widget that blanks because the
 *  profile call hiccuped is worse than one themed with the default palette. */
function readViewer(widgetApi, log) {
    return branding_awaiter(this, void 0, void 0, function* () {
        try {
            const profile = yield widgetApi.getUserInformation();
            const id = String((profile === null || profile === void 0 ? void 0 : profile.id) || "");
            const groupIds = ((profile === null || profile === void 0 ? void 0 : profile.groupIDs) || (profile === null || profile === void 0 ? void 0 : profile.groupIds) || []).map(String);
            log("viewer", id || "(anonymous)", "groups", groupIds.length, groupIds.join(","));
            return { id, groupIds };
        }
        catch (e) {
            log("getUserInformation failed —", (e === null || e === void 0 ? void 0 : e.message) || String(e));
            return { id: "", groupIds: [] };
        }
    });
}
/** True when any brand rule is written as something other than a group ID, in
 *  which case the id→name map has to be fetched. Staffbase group IDs are 24-char
 *  hex (Mongo ObjectIDs), so anything else is a name. */
const needsGroupNames = (brands) => brands.some(b => !/^[0-9a-f]{24}$/i.test(b.group));
/**
 * Pick the brand for this viewer.
 *
 * Slot order decides, so an admin can express priority simply by ordering the
 * slots — the person in both "Retail" and "HQ" gets whichever was entered
 * first, every time, on every device.
 */
function resolveBrand(args) {
    const { brands, viewer, groupNames, preview, fallback, surface, log } = args;
    const finish = (b, why) => {
        log(`brand: slot ${b.slot} (${b.label || b.group}) — ${why}`);
        return {
            primary: fitToSurface(b.primary, surface),
            accent: fitToSurface(b.accent, surface),
            label: b.label,
            source: "brand",
            via: b.group,
        };
    };
    if (preview > 0) {
        const forced = brands.filter(b => b.slot === preview)[0];
        if (forced)
            return finish(forced, "forzado desde el editor");
        log(`brand: preview slot ${preview} is empty — falling back`);
    }
    if (!brands.length) {
        log("brand: no brand slots configured");
        return fallback;
    }
    // Name matching is case- and accent-insensitive: "Operaciones" typed in the
    // editor should match "operaciones" on the group, and an admin should not
    // have to reproduce diacritics exactly.
    const norm = (s) => String(s || "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const viewerIds = new Set(viewer.groupIds);
    const viewerNames = new Set(viewer.groupIds.map(id => norm(groupNames.get(id) || "")).filter(Boolean));
    for (const b of brands) {
        if (viewerIds.has(b.group))
            return finish(b, "coincidencia por ID de grupo");
        if (viewerNames.has(norm(b.group)))
            return finish(b, "coincidencia por nombre de grupo");
    }
    log(`brand: viewer matched none of ${brands.length} slot(s)`);
    return fallback;
}
/** Fetch the id→name map, but only when a rule actually needs it. */
function loadGroupNames(http, base, order, brands, log) {
    return branding_awaiter(this, void 0, void 0, function* () {
        if (!base || !order.length || !needsGroupNames(brands))
            return new Map();
        try {
            const m = yield fetchGroupNames(http, base, order);
            log("groups resolved", m.size);
            return m;
        }
        catch (e) {
            log("group names failed —", (e === null || e === void 0 ? void 0 : e.message) || String(e));
            return new Map();
        }
    });
}
/**
 * Apply a brand.
 *
 * Both colours are already custom properties, so re-branding is a two-property
 * write on the root: every bar, medal, tier fill, badge chip and glow re-tints
 * without a re-render.
 */
function applyBrand(root, match) {
    root.style.setProperty("--csl-primary", match.primary);
    root.style.setProperty("--csl-accent", match.accent);
    root.style.setProperty("--csl-primary-rgb", rgbTriplet(match.primary));
    root.style.setProperty("--csl-accent-rgb", rgbTriplet(match.accent));
}

;// ./catalogue.ts
// ─────────────────────────────────────────────────────────────────────────────
// The synthetic course catalogue.
//
// Lifted from the Cornerstone mock so the imagery and copy match what the demo
// audience has already seen. This is the *only* source of truth for scoring:
// every metric the widget shows is derived from a learner's set of completions
// against this catalogue, so the numbers can never contradict each other.
//
// These courses are not read from Cornerstone. See `demo.ts`.
// ─────────────────────────────────────────────────────────────────────────────
const COURSES = [
    {
        id: 1,
        title: "Fundamentos de liderazgo",
        image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=300",
        type: "online",
        minutes: 60,
        required: true,
        dueDate: "Vence en 3 días",
        description: "Domina las habilidades esenciales para liderar equipos de manera efectiva. Incluye comunicación, empatía y pensamiento estratégico.",
        modules: ["Introducción al liderazgo", "Estilos de comunicación", "Resolución de conflictos"],
    },
    {
        id: 2,
        title: "Gestión de producto 101",
        image: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=300",
        type: "online",
        minutes: 45,
        required: false,
        dueDate: "20 de enero",
        description: "Una introducción al ciclo de vida del producto, desde la idea hasta el lanzamiento. Aprende a definir requerimientos y colaborar con ingeniería.",
        modules: ["Ciclo de vida del producto", "Historias de usuario", "Hoja de ruta"],
    },
    {
        id: 3,
        title: "Capacitación en vivo: Seguridad",
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=300",
        type: "event",
        minutes: 480,
        required: true,
        dueDate: "28 de enero",
        description: "Capacitación presencial de seguridad para el personal de almacén y operaciones. La asistencia es obligatoria.",
        modules: ["Sesión de la mañana", "Manejo de equipo", "Protocolos de emergencia"],
    },
    {
        id: 4,
        title: "Comunicación entre culturas",
        image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=300",
        type: "event",
        minutes: 180,
        required: false,
        dueDate: "14 de febrero",
        description: "Aprende a desenvolverte entre diferencias culturales dentro de un entorno laboral global.",
        modules: ["Dimensiones culturales", "Señales no verbales", "Casos de estudio"],
    },
    {
        id: 5,
        title: "Privacidad de datos 2026",
        image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=300",
        type: "online",
        minutes: 60,
        required: true,
        dueDate: "Vence en 3 días",
        description: "Aprende a manejar datos personales de forma responsable y comprende los principios clave de GDPR y CCPA para proteger la privacidad y cumplir con la normativa.",
        modules: ["Datos personales", "Responsabilidades de GDPR y CCPA", "Buenas prácticas de privacidad"],
    },
    {
        id: 6,
        title: "Seguridad de la información",
        image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=300",
        type: "online",
        minutes: 45,
        required: true,
        dueDate: "20 de enero",
        description: "Protección de los activos de la empresa frente a amenazas cibernéticas. Phishing, seguridad de contraseñas e ingeniería social.",
        modules: ["Concientización sobre phishing", "Higiene de contraseñas", "Reporte de incidentes"],
    },
    {
        id: 7,
        title: "Excel avanzado",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=300",
        type: "online",
        minutes: 120,
        required: false,
        dueDate: "Opcional",
        description: "Lleva tus hojas de cálculo al siguiente nivel con tablas dinámicas, BUSCARV y macros.",
        modules: ["Fórmulas", "Tablas dinámicas", "Macros"],
    },
];
/** Required compliance work is worth the most, live events next, self-paced
 *  e-learning least — so the ranking rewards the courses the business actually
 *  cares about rather than whoever clicked through the most short modules. */
const XP = {
    required: 50,
    event: 25,
    online: 10,
    /** Bonus for finishing before the deadline. */
    onTime: 15,
};
function courseXp(required, type, onTime) {
    const base = required ? XP.required : type === "event" ? XP.event : XP.online;
    return base + (onTime ? XP.onTime : 0);
}
/** Thresholds are spaced so a plausible demo field spans three tiers — a ladder
 *  where everyone sits in the same bucket communicates nothing. */
const TIERS = [
    { id: "bronce", label: "Bronce", from: 0, to: 120 },
    { id: "plata", label: "Plata", from: 120, to: 260 },
    { id: "oro", label: "Oro", from: 260, to: 420 },
    { id: "platino", label: "Platino", from: 420, to: Infinity },
];
const BADGES = {
    madrugador: {
        id: "madrugador",
        label: "Madrugador",
        description: "Terminó al menos 3 cursos antes de la fecha límite",
    },
    maratonista: {
        id: "maratonista",
        label: "Maratonista",
        description: "Completó 3 cursos en una misma semana",
    },
    cumplidor: {
        id: "cumplidor",
        label: "Cumplidor",
        description: "Completó toda la formación obligatoria",
    },
    explorador: {
        id: "explorador",
        label: "Explorador",
        description: "Combinó cursos en línea y eventos presenciales",
    },
    imparable: {
        id: "imparable",
        label: "Imparable",
        description: "Cuatro semanas seguidas aprendiendo",
    },
};
/** Number of weeks in the streak spark row. */
const SPARK_WEEKS = 6;
const REQUIRED_COUNT = COURSES.filter(c => c.required).length;

;// ./demo.ts
// ─────────────────────────────────────────────────────────────────────────────
// The demo scoring engine.
//
// None of these numbers come from Cornerstone. They are generated — but they
// are generated *once, from one source*, and everything else is derived:
//
//     seeded PRNG → a set of completions → courses / hours / XP / streak /
//     tier / badges
//
// That matters more than it sounds. If each metric were rolled independently,
// the demo would show someone leading "cursos" with fewer "horas" than a person
// who finished half as many, and the first person to look closely would notice.
// Deriving everything from one completion set makes the story internally
// consistent, and re-ranking on a metric switch reveals a genuinely different
// order rather than a reshuffle.
//
// The seed is the user's ID, so the same person gets the same history on every
// reload, across every viewer's browser.
// ─────────────────────────────────────────────────────────────────────────────

const WEEK = 7 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
// ── Seeded randomness ────────────────────────────────────────────────────────
/** FNV-1a. Cheap, and spreads short similar strings (`user-1`, `user-2`) well
 *  enough that neighbouring IDs don't produce near-identical histories. */
function hashSeed(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
/** mulberry32 — small, fast, and good enough that a sequence of draws doesn't
 *  visibly correlate. Returns a function so each learner gets an isolated
 *  stream; sharing one generator would make results depend on render order. */
function prng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// ── Synthetic peers ──────────────────────────────────────────────────────────
/** Demo peers below the three real people. Spanish names, because the widget is
 *  Spanish; no avatars, so they render as initials and stay visibly distinct
 *  from the real users at the top. */
const FILLER_NAMES = [
    "Lucía Márquez", "Diego Fuentes", "Valeria Ortiz", "Mateo Delgado",
    "Camila Reyes", "Andrés Navarro", "Sofía Cabrera", "Javier Peña",
    "Elena Vargas", "Tomás Herrera", "Paula Sandoval", "Rubén Castaño",
];
const FILLER_ROLES = [
    "Operaciones", "Recursos Humanos", "Ventas", "Atención al cliente",
    "Logística", "Marketing", "Finanzas", "TI",
];
const FILLER_POOL = FILLER_NAMES.length;
function syntheticPeople(count, offset = 0) {
    const out = [];
    for (let i = 0; i < count; i++) {
        const idx = (offset + i) % FILLER_NAMES.length;
        out.push({
            id: "",
            name: FILLER_NAMES[idx],
            avatar: "",
            position: FILLER_ROLES[idx % FILLER_ROLES.length],
            department: "",
            synthetic: true,
        });
    }
    return out;
}
// ── Drawing the podium out of the pool ───────────────────────────────────────
/**
 * Choose which `count` of the configured people stand on the podium.
 *
 * The admin pastes as many user IDs as they like; only three fit on a podium.
 * Taking the first three would make the configuration order the answer, and the
 * same three faces would be on the demo forever. Taking them with `Math.random`
 * would reshuffle on every reload, which looks broken — the podium would change
 * while the viewer watched, and two people looking at the same screen would
 * disagree.
 *
 * So the draw is *seeded*: random-looking, picked from anywhere in the array,
 * and identical for every viewer until something deliberately changes it. What
 * counts as "deliberately" is the mode:
 *
 *   shuffle — fixed. Re-roll by editing the seed field.
 *   typed   — no draw at all; the order pasted is the order ranked.
 *   daily   — the period is folded into the seed, so a new three appear each day.
 *   weekly  — same, per week.
 *
 * Returns indices into `ids`, in the order drawn — which becomes the rank
 * order, so who wins varies too, not just who appears.
 */
function drawPodium(poolSize, mode, seed, count, now = Date.now()) {
    const idx = [];
    for (let i = 0; i < poolSize; i++)
        idx.push(i);
    if (mode === "typed" || poolSize <= count)
        return idx.slice(0, count);
    const period = mode === "daily" ? Math.floor(now / DAY)
        : mode === "weekly" ? Math.floor(now / WEEK)
            : 0;
    const rand = prng(hashSeed(`${seed}|${poolSize}|${period}`));
    // Fisher–Yates over the whole array, so slot 1 can come from the end of the
    // list just as easily as the start.
    for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = idx[i];
        idx[i] = idx[j];
        idx[j] = t;
    }
    return idx.slice(0, count);
}
/** The complement of a draw, in the original order — the configured people who
 *  did not make the podium. They are still real users and still appear; being
 *  left out of the draw must not delete someone from the leaderboard. */
function restOfPool(pool, drawn) {
    const taken = new Set(drawn);
    return pool.filter((_, i) => !taken.has(i));
}
// ── History generation ───────────────────────────────────────────────────────
/**
 * Pick `n` courses without replacement, biased toward required courses.
 *
 * A uniform draw regularly produces a top performer who has skipped every
 * compliance course, which reads as a bug rather than a demo. Weighting keeps
 * the leaderboard aligned with the behaviour the business wants to reward.
 */
function pickCourses(rand, n) {
    const pool = COURSES.slice();
    const out = [];
    const take = Math.min(n, pool.length);
    for (let k = 0; k < take; k++) {
        const weights = pool.map(c => (c.required ? 2.2 : 1));
        const total = weights.reduce((a, b) => a + b, 0);
        let r = rand() * total;
        let idx = 0;
        for (; idx < pool.length - 1; idx++) {
            r -= weights[idx];
            if (r <= 0)
                break;
        }
        out.push(pool[idx]);
        pool.splice(idx, 1);
    }
    return out;
}
/**
 * Build one learner's completion history.
 *
 * `strength` (0–1) scales how much they did — it is what lets the caller pin
 * the configured users to the top three without hand-writing their numbers.
 * `forceCount`, when given, fixes the number of courses outright, which is how
 * the featured band gets a guaranteed ladder rather than a likely one.
 */
function makeCompletions(seed, strength, now, forceCount) {
    const rand = prng(seed);
    // 1–7 courses. The floor of 1 matters: a zero-length bar in a bar *race* is
    // indistinguishable from a failed render.
    const count = forceCount != null
        ? Math.max(1, Math.min(COURSES.length, forceCount))
        : Math.max(1, Math.round(1 + strength * (COURSES.length - 1) * (0.72 + rand() * 0.38)));
    const picked = pickCourses(rand, count);
    return picked.map((course) => {
        // Spread completions over the streak window, newest first, so the spark row
        // and the streak counter have something to show.
        const weeksAgo = Math.floor(rand() * (/* inlined export .SPARK_WEEKS */6));
        const jitter = Math.floor(rand() * WEEK);
        const at = now - weeksAgo * WEEK - jitter;
        // Stronger learners are likelier to have beaten the deadline — the on-time
        // bonus should reinforce the ranking, not fight it.
        const onTime = rand() < 0.35 + strength * 0.5;
        return { course, at, onTime };
    }).sort((a, b) => b.at - a.at);
}
// ── Derivations ──────────────────────────────────────────────────────────────
/** Which week bucket a timestamp falls into, counting back from `now`.
 *  0 = this week, 1 = last week, … */
const weekIndex = (at, now) => Math.floor((now - at) / WEEK);
function streakOf(completions, now) {
    const weeks = new Set(completions.map(c => weekIndex(c.at, now)));
    let n = 0;
    // A streak that has to start *this* week punishes anyone who simply hasn't
    // studied yet on a Monday, so an unbroken run ending last week still counts.
    const start = weeks.has(0) ? 0 : weeks.has(1) ? 1 : -1;
    if (start < 0)
        return 0;
    for (let w = start; weeks.has(w); w++)
        n++;
    return n;
}
function sparkOf(completions, now) {
    const bins = new Array((/* inlined export .SPARK_WEEKS */6)).fill(0);
    for (const c of completions) {
        const w = weekIndex(c.at, now);
        if (w >= 0 && w < (/* inlined export .SPARK_WEEKS */6))
            bins[(/* inlined export .SPARK_WEEKS */6) - 1 - w]++; // oldest first
    }
    return bins;
}
/**
 * Cumulative XP at the end of each week in the window, oldest first.
 *
 * Derived from the same completions as the XP total, so the last point of a
 * line is always exactly the number shown next to that person's name — a chart
 * that ended somewhere else would undermine every other figure on the widget.
 * Cumulative rather than per-week because the story the XP view tells is "who
 * is pulling ahead", which is about the slope, not the spikes.
 */
function seriesOf(completions, now) {
    const perWeek = new Array((/* inlined export .SPARK_WEEKS */6)).fill(0);
    for (const c of completions) {
        const w = weekIndex(c.at, now);
        const bin = (/* inlined export .SPARK_WEEKS */6) - 1 - w;
        // Anything older than the window still counts, folded into the first bucket,
        // so the line starts from where the person already was.
        const at = w >= (/* inlined export .SPARK_WEEKS */6) ? 0 : Math.max(0, bin);
        perWeek[at] += courseXp(c.course.required, c.course.type, c.onTime);
    }
    const out = [];
    let run = 0;
    for (let i = 0; i < (/* inlined export .SPARK_WEEKS */6); i++) {
        run += perWeek[i];
        out.push(run);
    }
    return out;
}
function tierOf(xp) {
    let i = 0;
    while (i < TIERS.length - 1 && xp >= TIERS[i].to)
        i++;
    const tier = TIERS[i];
    const next = i < TIERS.length - 1 ? TIERS[i + 1] : null;
    if (!next)
        return { tier, next: null, fraction: 1, remaining: 0 };
    const span = tier.to - tier.from;
    const fraction = span > 0 ? Math.min(1, Math.max(0, (xp - tier.from) / span)) : 1;
    return { tier, next, fraction, remaining: Math.max(0, Math.ceil(tier.to - xp)) };
}
function badgesOf(completions, streak, now) {
    const out = [];
    if (completions.filter(c => c.onTime).length >= 3)
        out.push(BADGES.madrugador);
    const perWeek = new Map();
    for (const c of completions) {
        const w = weekIndex(c.at, now);
        perWeek.set(w, (perWeek.get(w) || 0) + 1);
    }
    let busiest = 0;
    perWeek.forEach(v => { if (v > busiest)
        busiest = v; });
    if (busiest >= 3)
        out.push(BADGES.maratonista);
    if (completions.filter(c => c.course.required).length >= REQUIRED_COUNT)
        out.push(BADGES.cumplidor);
    const types = new Set(completions.map(c => c.course.type));
    if (types.size > 1)
        out.push(BADGES.explorador);
    if (streak >= 4)
        out.push(BADGES.imparable);
    return out;
}
/** Turn a person plus a strength into a fully derived learner. */
function makeLearner(person, index, strength, now, forceCount) {
    // Synthetic peers have no ID, so their seed comes from name + slot; that
    // keeps two people with the same filler name in different slots distinct.
    const seed = hashSeed(person.id || `${person.name}#${index}`);
    const completions = makeCompletions(seed, strength, now, forceCount);
    return fromCompletions(person, index, completions, now);
}
/** Everything a learner shows, derived from one completion set. Separated from
 *  generation so a history can be reassigned to a different person (see the
 *  featured ladder in `buildField`) without recomputing it by hand. */
function fromCompletions(person, index, completions, now) {
    const minutes = completions.reduce((a, c) => a + c.course.minutes, 0);
    const xp = completions.reduce((a, c) => a + courseXp(c.course.required, c.course.type, c.onTime), 0);
    const streak = streakOf(completions, now);
    return {
        person,
        // The slot is part of the key on purpose. Demo peers are drawn from a fixed
        // name list, so two of them can legitimately share a display name — and if
        // they shared a key, clicking one row would open the other one's courses.
        key: person.id || `demo:${index}:${person.name}`,
        completions,
        courses: completions.length,
        minutes,
        xp,
        streak,
        spark: sparkOf(completions, now),
        series: seriesOf(completions, now),
        tier: tierOf(xp),
        badges: badgesOf(completions, streak, now),
    };
}
// ── The field ────────────────────────────────────────────────────────────────
const metricValue = (l, m) => m === "courses" ? l.courses
    : m === "hours" ? l.minutes / 60
        : m === "xp" ? l.xp
            : l.streak;
/** Featured slot 1 gets the full catalogue, each later slot one fewer course,
 *  never below three — a podium where third place has done one course does not
 *  look like a contest. */
const featuredCount = (slot) => Math.max(3, COURSES.length - slot);
const xpOf = (cs) => cs.reduce((a, c) => a + courseXp(c.course.required, c.course.type, c.onTime), 0);
/** Flip one late completion to on-time (+bonus). Returns false when there is
 *  nothing left to promote. */
function promote(h) {
    for (const c of h)
        if (!c.onTime) {
            c.onTime = true;
            return true;
        }
    return false;
}
/** The inverse: drop one on-time completion back to late (−bonus). */
function demote(h) {
    for (let i = h.length - 1; i >= 0; i--)
        if (h[i].onTime) {
            h[i].onTime = false;
            return true;
        }
    return false;
}
/**
 * Force `hi` to out-score `lo` on XP, by nudging on-time flags rather than
 * re-rolling — re-rolling would cost determinism, and the bonus is the only
 * lever that changes XP without changing the course set every other metric is
 * derived from.
 *
 * Promotion is tried first ("the person ahead of you also hit their
 * deadlines"), demotion second. If neither can close the gap the ordering is
 * left alone: a wrong number is worse than a tie.
 */
function enforceAbove(hi, lo) {
    let guard = 0;
    const limit = hi.length + lo.length + 2;
    while (xpOf(hi) <= xpOf(lo) && guard++ < limit) {
        if (promote(hi))
            continue;
        if (demote(lo))
            continue;
        break;
    }
}
/**
 * Build the whole field.
 *
 * `featured` are the people drawn for the podium, and the order they were drawn
 * is the order they are ranked — on **cursos** and **XP**. That is guaranteed
 * rather than hoped for: course counts descend by slot by construction, and the
 * XP ladder is enforced afterwards.
 *
 * `others` are real people who exist but were not drawn — the rest of the
 * configured pool, plus the viewer. They are capped below the podium band so
 * the draw means something, but they are otherwise ordinary participants with
 * real names, avatars and profile links.
 *
 * *Horas* and *racha* deliberately do not inherit the pinning. They are
 * genuinely derived from the same histories, so switching metric reorders even
 * the podium — a leaderboard whose switch changes nothing is a picture, not a
 * chart.
 */
function buildField(featured, others, fillerCount, now = Date.now()) {
    // Generate every featured history first, then rank the *histories* and pair
    // them with people by slot. Determinism survives: the same people in the same
    // order always produce the same pairing.
    const histories = featured.map((p, i) => makeCompletions(hashSeed(p.id || `${p.name}#${i}`), 1 - i * 0.14, now, featuredCount(i)));
    histories.sort((a, b) => b.length - a.length || xpOf(b) - xpOf(a));
    for (let i = 1; i < histories.length; i++)
        enforceAbove(histories[i - 1], histories[i]);
    // Everyone below the podium is hard-capped one course under the weakest
    // featured slot. Without the cap a generated peer occasionally ties the third
    // real person and takes the podium spot the draw explicitly assigned.
    const cap = Math.max(1, featuredCount(Math.max(0, featured.length - 1)) - 1);
    const chasers = others.slice();
    // The filler offset counts only the slots that actually consumed a name from
    // the pool — the featured band. Chasers are real users (or the viewer, who is
    // called "Tú"), so they take no filler name and must not push the offset far
    // enough to wrap it back onto the names already in use.
    const peers = syntheticPeople(fillerCount, featured.length);
    const below = chasers.concat(peers);
    const belowHistories = below.map((p, i) => {
        // The viewer is placed mid-pack on purpose. Top of the field and the
        // catch-up button has nothing to ask for; bottom and the gap is dispiriting
        // rather than motivating. Mid-pack is where "one more course" is true.
        const strength = p.isViewer ? 0.5 : Math.max(0.12, 0.62 - i * 0.07);
        const count = p.isViewer
            ? Math.max(1, Math.min(cap, Math.round(cap * 0.6)))
            : Math.max(1, Math.min(cap, Math.round(cap * strength) + (i % 2)));
        return makeCompletions(hashSeed(p.id || `${p.name}#${featured.length + i}`), strength, now, count);
    });
    // A short-but-compliance-heavy peer can still out-XP the third real person, so
    // the same ladder is applied across the boundary.
    const weakest = histories[histories.length - 1];
    if (weakest)
        for (const h of belowHistories)
            enforceAbove(weakest, h);
    const learners = [];
    featured.forEach((p, i) => learners.push(fromCompletions(p, i, histories[i], now)));
    below.forEach((p, i) => learners.push(fromCompletions(p, featured.length + i, belowHistories[i], now)));
    return learners;
}
/**
 * The person immediately ahead of the viewer on the current metric, and by how
 * much. This is what turns a generic "do more courses" button into a specific
 * one — "te faltan 2 cursos para alcanzar a Lucía" is a target; "¡sigue así!"
 * is wallpaper.
 */
function gapAhead(learners, metric) {
    const ordered = rank(learners, metric);
    const i = ordered.findIndex(l => l.person.isViewer);
    if (i < 0)
        return null;
    if (i === 0) {
        return { target: ordered[0], gap: 0, rank: 1, total: ordered.length };
    }
    const me = ordered[i];
    const target = ordered[i - 1];
    return {
        target,
        gap: Math.max(0, metricValue(target, metric) - metricValue(me, metric)),
        rank: i + 1,
        total: ordered.length,
    };
}
/** Rank for one metric. Ties break on XP, then course count, then name, so the
 *  order is stable across switches instead of jittering. */
function rank(learners, metric) {
    return learners.slice().sort((a, b) => metricValue(b, metric) - metricValue(a, metric)
        || b.xp - a.xp
        || b.courses - a.courses
        || a.person.name.localeCompare(b.person.name));
}

;// ./icons.ts
// Inline SVG icon set.
//
// Inline rather than a font or sprite sheet: these are painted with
// `currentColor` so they inherit the active brand colour for free, and a widget
// bundle cannot rely on the host page loading an icon font.
const PATHS = {
    trophy: '<path d="M6 4h12v4a6 6 0 0 1-12 0Z"/><path d="M6 6H4a2 2 0 0 0 0 4h2"/><path d="M18 6h2a2 2 0 0 1 0 4h-2"/><path d="M10 14v3"/><path d="M14 14v3"/><path d="M8 20h8"/><path d="M9 17h6l1 3H8Z"/>',
    flame: '<path d="M12 3c.6 3-1.4 4.2-2.6 5.6A5.4 5.4 0 0 0 8 12a4 4 0 0 0 8 0c0-1.3-.6-2.3-1.2-3.2C13.6 7 12.9 5.3 12 3Z"/><path d="M12 21a6 6 0 0 0 6-6c0-2-1-3.6-2-5"/><path d="M12 21a6 6 0 0 1-6-6c0-2 1-3.6 2-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z"/><path d="M8 7h7"/><path d="M8 11h7"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6Z"/>',
    medal: '<circle cx="12" cy="15" r="5"/><path d="M12 13.5 12.9 15l1.6.2-1.2 1.1.3 1.6-1.6-.8-1.6.8.3-1.6-1.2-1.1 1.6-.2Z"/><path d="M8 3h8l-2.5 6h-3Z"/>',
    crown: '<path d="M4 18h16"/><path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 7h-13Z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>',
    shield: '<path d="M12 3 5 6v6c0 4.3 2.9 8.1 7 9 4.1-.9 7-4.7 7-9V6Z"/><path d="m9 12 2 2 4-4"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
    sunrise: '<path d="M12 3v5"/><path d="m5 10 1.5 1.5"/><path d="M2 17h20"/><path d="m19 10-1.5 1.5"/><path d="M8.5 17a3.5 3.5 0 0 1 7 0"/><path d="M4 21h16"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 5.6"/><path d="M17.5 14.4A6 6 0 0 1 21 20"/>',
    rocket: '<path d="M13.5 4.5C16 2 20 3 20 3s1 4-1.5 6.5L14 14l-4-4Z"/><path d="m10 10-4 1.5L4 14l3 .5L7.5 18l2.5-2 1.5-4"/><path d="M6.5 17.5 4 20"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
    arrow: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
    grid: '<rect x="3" y="4" width="7" height="7" rx="1.6"/><rect x="14" y="4" width="7" height="7" rx="1.6"/><rect x="3" y="15" width="7" height="5" rx="1.6"/><rect x="14" y="15" width="7" height="5" rx="1.6"/>',
    layers: '<path d="m12 3 8 4.5-8 4.5-8-4.5Z"/><path d="m4 12 8 4.5 8-4.5"/><path d="m4 16.5 8 4.5 8-4.5"/>',
    trend: '<path d="M3 17.5 9.5 11l4 4L21 7"/><path d="M15.5 7H21v5.5"/>',
};
function icon(name, size = 16, stroke = 1.9) {
    const d = PATHS[name] || PATHS.star;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor"`
        + ` stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`
        + ` focusable="false">${d}</svg>`;
}
/** Each metric gets its own glyph so the switcher is scannable before it is
 *  read — the labels are short Spanish words that look alike at a glance. */
const METRIC_ICON = {
    courses: "book",
    hours: "clock",
    xp: "bolt",
    streak: "flame",
};
const BADGE_ICON = {
    madrugador: "sunrise",
    maratonista: "bolt",
    cumplidor: "shield",
    explorador: "compass",
    imparable: "flame",
};

;// ./strings.ts
// Spanish copy, in one place.
//
// One locale by design — but structured as a keyed map rather than inline
// literals so a second bundle can be added later without touching render code.
const S = {
    title: "Clasificación de aprendizaje",
    subtitle: "Quién va adelante este trimestre",
    metricCourses: "Cursos",
    metricHours: "Horas",
    metricXp: "XP",
    metricStreak: "Racha",
    unitCourses: "cursos",
    unitCoursesOne: "curso",
    unitHours: "h",
    unitXp: "XP",
    unitStreak: "semanas",
    unitStreakOne: "semana",
    leader: "Líder",
    podium: "Podio",
    field: "Clasificación",
    tierNext: (n, tier) => `Faltan ${n} XP para ${tier}`,
    tierMax: "Nivel máximo alcanzado",
    tierLabel: "Nivel",
    streakWeeks: "Últimas 6 semanas",
    streakNone: "Sin racha activa",
    // ── Per-metric chart captions ──
    capCourses: "Cursos completados por persona",
    capHours: "Cómo se reparten las horas entre cursos",
    capXp: "XP acumulado en las últimas 6 semanas",
    capStreak: "Actividad semana a semana",
    // ── Line chart ──
    you: "Tú",
    youLong: "Tú",
    lineYou: "Tu progreso",
    lineOthers: "Compañeros",
    lineLeader: "Líder",
    lineHint: "Pasa el cursor por una persona para resaltar su línea",
    weekLabel: (n) => (n === 0 ? "Esta sem." : `-${n} sem.`),
    xpAt: (xp, week) => `${xp} XP · ${week}`,
    // ── Heatmap ──
    heatHint: "Cada cuadro es una semana",
    heatNone: "Sin actividad",
    heatWeek: (n, week) => `${n} · ${week}`,
    // ── Catch-up ──
    ctaTitle: "¡Ponte al día!",
    ctaAction: "Haz más cursos",
    ctaGapCourses: (n, name) => `Te ${n === 1 ? "falta" : "faltan"} ${n} ${n === 1 ? "curso" : "cursos"} para alcanzar a ${name}`,
    ctaGapHours: (n, name) => `Te faltan ${n} h para alcanzar a ${name}`,
    ctaGapXp: (n, name) => `Te faltan ${n} XP para alcanzar a ${name}`,
    ctaGapStreak: (n, name) => `Te ${n === 1 ? "falta" : "faltan"} ${n} ${n === 1 ? "semana" : "semanas"} para alcanzar a ${name}`,
    ctaLeading: "Vas en cabeza. Mantén la racha con un curso más.",
    ctaGeneric: "Suma cursos y escala posiciones en la clasificación.",
    ctaRankOf: (rank, total) => `Puesto ${rank} de ${total}`,
    badgesTitle: "Insignias",
    noBadges: "Aún sin insignias",
    drilldownOpen: "Ver cursos completados",
    drilldownClose: "Ocultar cursos",
    completedCourses: "Cursos completados",
    onTime: "A tiempo",
    late: "Fuera de plazo",
    required: "Obligatorio",
    typeOnline: "En línea",
    typeEvent: "Evento",
    modules: (n) => (n === 1 ? "1 módulo" : `${n} módulos`),
    noCompletions: "Todavía no ha completado ningún curso",
    demoNote: "Datos de demostración",
    loading: "Cargando clasificación…",
    errorTitle: "No se pudo cargar la clasificación",
    unconfigured: "Configura la URL base y el token de la API en el editor del widget.",
    brandDefault: "Marca corporativa",
};
/** Spanish pluralisation is regular enough for a two-form helper. */
const plural = (n, one, many) => (Math.abs(n) === 1 ? one : many);

;// ./charts.ts
/* unused harmony import specifier */ var charts_plural;
/* unused harmony import specifier */ var charts_S;
// ─────────────────────────────────────────────────────────────────────────────
// Charts — hand-rolled HTML/CSS/SVG, no chart library.
//
// The deciding constraint is the avatar: every row is a person's photo, and
// photos 404 often enough that a gradient-initials fallback is mandatory. That
// fallback is an `<img onerror>`, which only works for real DOM images — so
// canvas is out.
//
// The second constraint is the reorder. A bar race has to visibly *race*: rows
// must travel to their new rank when the metric changes. That needs stable DOM
// nodes with measurable boxes (FLIP), which rules out re-rendering the list
// from scratch. So every row carries a `data-key`, and the shell moves nodes
// rather than replacing them.
// ─────────────────────────────────────────────────────────────────────────────




const P = "csl"; // class prefix
function esc(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length)
        return "?";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
    return (first + last).toUpperCase();
}
/** Whole numbers stay whole; hours keep one decimal. Locale-formatted so
 *  Spanish gets its comma decimal separator. */
const fmt = (n, decimals = 0) => Number(n).toLocaleString("es", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
});
const METRICS = ["courses", "hours", "xp", "streak"];
const METRIC_LABEL = {
    courses: S.metricCourses,
    hours: S.metricHours,
    xp: S.metricXp,
    streak: S.metricStreak,
};
/**
 * Each metric is drawn as the thing it actually is.
 *
 * Four bar charts with different numbers in them would make the switcher a
 * relabelling exercise. A count is a ranking (bars); hours are a composition
 * (one segment per course, so you can see *what* the time went into); XP is an
 * accumulation over time, and the only metric where the interesting question is
 * "how do I compare" rather than "who won" (lines, with the viewer's own line
 * picked out); a streak is a calendar (a grid of weeks).
 */
const CHART_KIND = {
    courses: "race",
    hours: "stack",
    xp: "lines",
    streak: "heat",
};
const CAPTION = {
    courses: S.capCourses,
    hours: S.capHours,
    xp: S.capXp,
    streak: S.capStreak,
};
/** `race`, `stack` and `heat` are the same `<li data-key>` rows with different
 *  middles, so switching between them can move nodes instead of replacing them.
 *  `lines` has no rows, so it is the one transition that rebuilds. */
const isRowChart = (m) => CHART_KIND[m] !== "lines";
/** Hours are the only fractional metric, so formatting is metric-dependent. */
const formatMetric = (l, m) => m === "hours" ? fmt(l.minutes / 60, 1) : fmt(metricValue(l, m));
const metricUnit = (l, m) => m === "courses" ? plural(l.courses, S.unitCoursesOne, S.unitCourses)
    : m === "hours" ? S.unitHours
        : m === "xp" ? S.unitXp
            : plural(l.streak, S.unitStreakOne, S.unitStreak);
/** A stable identity per row, so FLIP can pair old and new positions. Comes
 *  from the learner, not the person: demo peers share a fixed name pool, and
 *  two rows with the same key would swap each other's drilldowns. */
const keyOf = (l) => l.key;
// ── Avatar ───────────────────────────────────────────────────────────────────
/**
 * Wrapped in `internal-link clickable` + `/profile/<id>` + `data-uid`, which is
 * the markup Staffbase's own author links use — that is what attaches the
 * native profile hovercard to a chart node instead of leaving it an inert
 * image. Demo peers get no link, because there is no profile to open.
 */
function avatar(p, size, cls = "") {
    const ini = esc(initials(p.name));
    const style = `--av:${size}px`;
    const inner = p.avatar
        ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('${P}-av-fb');this.remove()">`
        : "";
    const body = `<span class="${P}-av ${cls}${p.avatar ? "" : ` ${P}-av-fb`}" style="${style}" data-ini="${ini}">${inner}</span>`;
    if (!p.id)
        return body;
    return `<a class="${P}-avlink internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}" tabindex="-1" aria-label="${esc(p.name)}">${body}</a>`;
}
function personName(p, cls) {
    return p.id
        ? `<a class="${cls} internal-link clickable" href="/profile/${esc(p.id)}" data-uid="${esc(p.id)}">${esc(p.name)}</a>`
        : `<span class="${cls}">${esc(p.name)}</span>`;
}
// ── Switcher ─────────────────────────────────────────────────────────────────
function switcher(active) {
    const tabs = METRICS.map(m => `
    <button type="button" class="${P}-tab${m === active ? ` ${P}-tab-on` : ""}"
            data-metric="${m}" role="tab" aria-selected="${m === active}">
      <span class="${P}-tab-ico">${icon(METRIC_ICON[m], 15)}</span>
      <span class="${P}-tab-lbl">${esc(METRIC_LABEL[m])}</span>
    </button>`).join("");
    return `<div class="${P}-tabs" role="tablist" aria-label="${esc(S.field)}">
    ${tabs}<span class="${P}-tab-ink" aria-hidden="true"></span>
  </div>`;
}
// ── Tier bar ─────────────────────────────────────────────────────────────────
function tierBar(l) {
    const t = l.tier;
    const pct = Math.round(t.fraction * 100);
    const caption = t.next ? S.tierNext(t.remaining, t.next.label) : S.tierMax;
    return `<div class="${P}-tier" data-tier="${t.tier.id}">
    <div class="${P}-tier-head">
      <span class="${P}-tier-name">${icon("medal", 13)} ${esc(t.tier.label)}</span>
      <span class="${P}-tier-cap">${esc(caption)}</span>
    </div>
    <div class="${P}-tier-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="${pct}" aria-label="${esc(S.tierLabel)} ${esc(t.tier.label)}">
      <span class="${P}-tier-fill" style="--pct:${pct}%"></span>
    </div>
  </div>`;
}
// ── Badges ───────────────────────────────────────────────────────────────────
function badgeChips(l, compact = false) {
    if (!l.badges.length) {
        return compact ? "" : `<span class="${P}-nobadge">${esc(S.noBadges)}</span>`;
    }
    const chips = l.badges.map(b => `
    <span class="${P}-badge" title="${esc(b.description)}">
      ${icon(BADGE_ICON[b.id], compact ? 12 : 13)}${compact ? "" : `<span>${esc(b.label)}</span>`}
    </span>`).join("");
    return `<div class="${P}-badges${compact ? ` ${P}-badges-c` : ""}">${chips}</div>`;
}
// ── Streak spark ─────────────────────────────────────────────────────────────
/** Six weekly buckets as squares rather than a line: the numbers are 0–3, and a
 *  line chart over integers that small reads as noise. */
function streakSpark(l) {
    const max = Math.max(1, ...l.spark);
    const cells = l.spark.map((v, i) => {
        const lvl = v === 0 ? 0 : Math.ceil((v / max) * 3);
        return `<span class="${P}-spark-c" data-lvl="${lvl}" style="--i:${i}" title="${v} ${esc(charts_plural(v, charts_S.unitCoursesOne, charts_S.unitCourses))}"></span>`;
    }).join("");
    return `<div class="${P}-spark" aria-hidden="true">${cells}</div>`;
}
// ── Podium ───────────────────────────────────────────────────────────────────
/**
 * The top three at full scale.
 *
 * Ordered 2–1–3 visually (a real podium) but 1–2–3 in the DOM, so keyboard and
 * screen-reader order still runs by rank; CSS `order` does the rearranging.
 */
function podium(top, metric, showTier, showBadges) {
    if (!top.length)
        return "";
    const cards = top.slice(0, 3).map((l, i) => {
        const rank = i + 1;
        const av = rank === 1 ? 92 : 68;
        const meta = [l.person.position, l.person.department].filter(Boolean).join(" · ");
        return `<div class="${P}-pod ${P}-pod-${rank}" data-key="${esc(keyOf(l))}" style="--i:${i}"${l.person.isViewer ? ` data-you="1"` : ""}>
      <div class="${P}-pod-avwrap">
        ${avatar(l.person, av, `${P}-av-hero`)}
        <span class="${P}-pod-rank">${rank === 1 ? icon("crown", 14) : rank}</span>
      </div>
      <div class="${P}-pod-nm">${personName(l.person, `${P}-pod-nmlink`)}${l.person.isViewer ? ` <span class="${P}-you">${esc(S.you)}</span>` : ""}</div>
      ${meta ? `<div class="${P}-pod-meta">${esc(meta)}</div>` : ""}
      <div class="${P}-pod-num">
        <span class="${P}-num" data-count="${metricValue(l, metric)}" data-dec="${metric === "hours" ? 1 : 0}">${formatMetric(l, metric)}</span>
        <span class="${P}-unit">${esc(metricUnit(l, metric))}</span>
      </div>
      ${showTier ? tierBar(l) : ""}
      ${showBadges ? badgeChips(l, true) : ""}
    </div>`;
    }).join("");
    return `<div class="${P}-podium">${cards}</div>`;
}
// ── Row charts: race, stack, heat ────────────────────────────────────────────
/** A week's label, counting back from this one. Used by both the stacked bar
 *  tooltips and the heatmap cells. */
const weekTitle = (i) => S.weekLabel((/* inlined export .SPARK_WEEKS */6) - 1 - i);
/** Bars are scaled against the leader with a floor, so a runaway winner does not
 *  flatten everyone else into invisible slivers. */
const barWidth = (v, max) => Math.max(6, max > 0 ? (v / max) * 100 : 0);
/** Courses view: one solid bar per person, length = rank position. */
function plainBar(l, metric, max) {
    const w = barWidth(metricValue(l, metric), max);
    return `<div class="${P}-bar"><span class="${P}-bar-fill" style="--w:${w.toFixed(2)}%"></span></div>`;
}
/**
 * Hours view: the same bar, cut into one segment per course.
 *
 * The total length still ranks people, so nothing is lost — but the segments
 * answer the question a raw hour count cannot, which is where the time went.
 * Segments are ordered longest-first so the bar reads as a composition rather
 * than as a jagged history, and required courses get the accent so compliance
 * is visible at a glance.
 */
function stackedBar(l, max) {
    const totalHours = l.minutes / 60;
    const w = barWidth(totalHours, max);
    const segs = l.completions
        .slice()
        .sort((a, b) => b.course.minutes - a.course.minutes)
        .map((c, i) => {
        const share = l.minutes > 0 ? (c.course.minutes / l.minutes) * 100 : 0;
        const dur = c.course.minutes >= 60
            ? `${fmt(c.course.minutes / 60, c.course.minutes % 60 ? 1 : 0)} ${S.unitHours}`
            : `${c.course.minutes} min`;
        return `<span class="${P}-seg" style="--s:${share.toFixed(2)}%;--i:${i}"`
            + ` data-req="${c.course.required}" data-type="${esc(c.course.type)}"`
            + ` title="${esc(c.course.title)} · ${esc(dur)}"></span>`;
    }).join("");
    return `<div class="${P}-bar"><div class="${P}-bar-stack" style="--w:${w.toFixed(2)}%">${segs}</div></div>`;
}
/**
 * Streak view: six weekly cells per person.
 *
 * A streak is a statement about a calendar, and the number alone ("4 semanas")
 * hides whether those weeks were recent. The grid shows the run itself — and
 * shows the gaps, which is what makes a broken streak legible.
 *
 * Levels are absolute (1 / 2 / 3+ courses), not scaled to each person's own
 * busiest week. Per-row normalisation would make the darkest cell mean "two
 * courses" on one line and "five" on the next, which is exactly the comparison
 * a grid of identical squares invites you to make.
 */
function heatCells(l) {
    const cells = l.spark.map((v, i) => {
        const lvl = v === 0 ? 0 : v === 1 ? 1 : v === 2 ? 2 : 3;
        return `<span class="${P}-heat-c" data-lvl="${lvl}" style="--i:${i}"`
            + ` title="${esc(weekTitle(i))} · ${v} ${esc(plural(v, S.unitCoursesOne, S.unitCourses))}"></span>`;
    }).join("");
    return `<div class="${P}-heat">${cells}</div>`;
}
/** The middle of a row — the only part that differs between the three row
 *  charts. Kept separate so a metric switch can swap it in place and leave the
 *  row node (and any open drilldown) exactly where it is. */
function rowBody(l, metric, max, opts) {
    const kind = CHART_KIND[metric];
    const v = metricValue(l, metric);
    const middle = kind === "stack" ? stackedBar(l, max)
        : kind === "heat" ? heatCells(l)
            : plainBar(l, metric, max);
    return `<div class="${P}-row-top">
      ${personName(l.person, `${P}-row-nm`)}
      ${l.person.isViewer ? `<span class="${P}-you">${esc(S.you)}</span>` : ""}
      <span class="${P}-row-val">
        <span class="${P}-num" data-count="${v}" data-dec="${metric === "hours" ? 1 : 0}">${formatMetric(l, metric)}</span>
        <span class="${P}-unit">${esc(metricUnit(l, metric))}</span>
      </span>
    </div>
    ${middle}
    <div class="${P}-row-sub">
      ${opts.streak && l.streak > 0 ? `<span class="${P}-streak">${icon("flame", 12)}${l.streak}</span>` : ""}
      ${opts.badges ? badgeChips(l, true) : ""}
    </div>`;
}
/**
 * One row.
 *
 * `data-key` is what the shell's FLIP and drilldown read; the row renders its
 * final width and value inline so a dead script still shows a correct, static
 * chart.
 */
function raceRow(l, rank, max, metric, opts) {
    const key = esc(keyOf(l));
    const ddId = `${P}-dd-${key.replace(/[^\w-]/g, "_")}`;
    return `<li class="${P}-row" data-key="${key}" style="--i:${rank - 1}"${l.person.isViewer ? ` data-you="1"` : ""}>
    <div class="${P}-row-main"${opts.drilldown ? ` role="button" tabindex="0" aria-expanded="false" aria-controls="${ddId}"` : ""}>
      <span class="${P}-rank">${rank}</span>
      ${avatar(l.person, 34)}
      <div class="${P}-row-body">${rowBody(l, metric, max, opts)}</div>
      ${opts.drilldown ? `<span class="${P}-row-chev" aria-hidden="true">${icon("chevron", 16)}</span>` : ""}
    </div>
    ${opts.drilldown ? `<div class="${P}-dd" id="${ddId}" hidden></div>` : ""}
  </li>`;
}
function race(learners, metric, opts) {
    if (!learners.length)
        return "";
    const max = Math.max(...learners.map(l => metricValue(l, metric)), 0);
    const rows = learners.map((l, i) => raceRow(l, i + 1, max, metric, opts)).join("");
    return `<ol class="${P}-race" data-kind="${CHART_KIND[metric]}" aria-label="${esc(S.field)}">${rows}</ol>`;
}
// ── XP: cumulative curves, you against the field ─────────────────────────────
const LW = 640, LH = 210; // viewBox; scaled to the container by CSS
const PAD = { l: 14, r: 92, t: 22, b: 30 };
/**
 * A playful palette for the field.
 *
 * Every line being one of two brand colours made the chart read as a report.
 * Giving each person their own hue turns it into a race you can follow with
 * your eyes. Hues are dealt out by position rather than hashed per person, so
 * no two people in a field of ten share a colour — a hash collision would put
 * two identical curves on the chart, which is exactly the confusion the colour
 * was added to prevent.
 */
const LINE_HUES = [268, 200, 330, 42, 160, 15, 288, 96, 220, 350];
/** Where in the palette the field starts. Hashing the leader's key means two
 *  different fields don't both open on purple, while the same field opens the
 *  same way every time. */
function hueStart(key) {
    let h = 0;
    for (let i = 0; i < key.length; i++)
        h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return h % LINE_HUES.length;
}
/**
 * Catmull-Rom through the points, converted to cubic béziers.
 *
 * Straight segments made six weeks of XP look like a stock ticker. A curve
 * reads as a journey, which is the feeling the metric is supposed to have.
 *
 * The control points are clamped to each segment's own vertical range *and*
 * ordered within it: the series is cumulative and therefore never decreases, so
 * the drawn curve must never decrease either. An unclamped spline will happily
 * dip below a flat stretch and draw someone losing XP, and clamping the two
 * control points independently can still leave them out of order, which puts a
 * small wobble in an otherwise flat week.
 */
function curve(pts) {
    if (pts.length < 2)
        return "";
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i];
        const p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
        // y decreases as XP rises, so p2[1] is the floor and p1[1] the ceiling.
        const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6, lo, hi);
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const c2y = clamp(clamp(p2[1] - (p3[1] - p1[1]) / 6, lo, hi), lo, c1y);
        d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)}`
            + ` ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
}
/** Keep end medallions from stacking on top of each other when two people
 *  finish the six weeks a few XP apart. */
function spread(ys, gap, lo, hi) {
    const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
    let prev = -Infinity;
    for (const o of order) {
        o.y = Math.max(o.y, prev + gap);
        prev = o.y;
    }
    const over = order.length ? order[order.length - 1].y - hi : 0;
    if (over > 0)
        for (const o of order)
            o.y -= over;
    const out = ys.slice();
    for (const o of order)
        out[o.i] = Math.max(lo, o.y);
    return out;
}
let uidSeq = 0;
/**
 * The XP view: every learner's cumulative XP over the last six weeks.
 *
 * This is the one view that is not about the podium. Bars answer "who is
 * winning"; the question people actually have about their own XP is "where am
 * I against everyone else, and am I gaining or falling behind" — which is a
 * slope, and needs a shared time axis to be visible at all.
 *
 * Everything that made it look like an analytics dashboard is gone: no
 * gridlines, no value axis, no tick marks. A gridline exists so you can read an
 * exact number off a line, and nobody needs their XP to three significant
 * figures — the number they want is their own, so it rides at the end of their
 * own curve on a coloured medallion instead.
 *
 * The viewer's curve is the subject: drawn last (on top), thickest, with a
 * glowing gradient stroke, a soft area fill underneath and a pulsing ring on
 * its leading dot. Everyone else is a friendly colour at lower weight.
 * Hovering any curve brings it forward; clicking opens that person's courses.
 */
function lines(learners, viewerKey) {
    if (!learners.length)
        return "";
    const weeks = Math.max(2, learners[0].series.length);
    const top = Math.max(...learners.map(l => l.series[l.series.length - 1] || 0), 1);
    const uid = `${P}-x${++uidSeq}`;
    const h0 = hueStart(keyOf(learners[0]));
    const hue = new Map(learners.map((l, i) => [keyOf(l), LINE_HUES[(h0 + i) % LINE_HUES.length]]));
    const hueOf = (k) => hue.get(k) || LINE_HUES[0];
    const x = (i) => PAD.l + (i / (weeks - 1)) * (LW - PAD.l - PAD.r);
    // A little headroom above the leader so the top curve never grazes the edge.
    const y = (v) => LH - PAD.b - (Math.min(v, top) / top) * (LH - PAD.t - PAD.b) * 0.92;
    const xticks = learners[0].series.map((_, i) => `<text class="${P}-xtick" x="${x(i).toFixed(1)}" y="${LH - PAD.b + 17}" text-anchor="middle"`
        + ` data-i="${i}" style="--i:${i}">${esc(weekTitle(i))}</text>`).join("");
    // Leaders by final XP, so "the curves you are chasing" are the ones that
    // carry a name rather than an arbitrary three.
    const byXp = learners.slice().sort((a, b) => (b.series[b.series.length - 1] || 0) - (a.series[a.series.length - 1] || 0));
    const leaders = new Set(byXp.slice(0, 3).map(l => keyOf(l)));
    const roleOf = (l) => keyOf(l) === viewerKey ? "you" : leaders.has(keyOf(l)) ? "top" : "peer";
    // Painter's order: faint peers first, leaders over them, the viewer on top —
    // SVG has no z-index, so the order *is* the stacking.
    const rank = { peer: 0, top: 1, you: 2 };
    const ordered = learners.slice()
        .sort((a, b) => rank[roleOf(a)] - rank[roleOf(b)]);
    // Medallion positions are de-collided across the whole field at once, so they
    // have to be solved before any single line is drawn.
    const labelled = ordered.filter(l => roleOf(l) !== "peer");
    const lastY = labelled.map(l => y(l.series[l.series.length - 1] || 0));
    const slots = spread(lastY, 30, PAD.t + 2, LH - PAD.b - 2);
    const slotOf = new Map(labelled.map((l, i) => [keyOf(l), slots[i]]));
    const draw = (l) => {
        const key = keyOf(l);
        const role = roleOf(l);
        const you = role === "you";
        const pts = l.series.map((v, i) => [x(i), y(v)]);
        const d = curve(pts);
        const last = l.series[l.series.length - 1] || 0;
        const endX = pts[pts.length - 1][0], endY = pts[pts.length - 1][1];
        const stroke = you ? `url(#${uid}-you)` : `hsl(${hueOf(key)} 78% 62%)`;
        // Only the subject gets an area — two filled curves would muddy each other.
        const area = you
            ? `<path class="${P}-ln-area" d="${d}L${endX.toFixed(1)},${(LH - PAD.b).toFixed(1)}`
                + `L${pts[0][0].toFixed(1)},${(LH - PAD.b).toFixed(1)}Z" fill="url(#${uid}-fill)"/>`
            : "";
        let cap = "";
        if (role !== "peer") {
            const ly = (slotOf.get(key) || endY);
            const mx = LW - PAD.r + 26;
            cap = `<g class="${P}-ln-cap" style="--ly:${ly.toFixed(1)}px">
        <path class="${P}-ln-leader" d="M${endX.toFixed(1)},${endY.toFixed(1)}`
                + `Q${(endX + 14).toFixed(1)},${endY.toFixed(1)} ${(mx - 15).toFixed(1)},${ly.toFixed(1)}"/>
        <circle class="${P}-ln-med" cx="${mx.toFixed(1)}" cy="${ly.toFixed(1)}" r="13"/>
        <text class="${P}-ln-ini" x="${mx.toFixed(1)}" y="${ly.toFixed(1)}"
              text-anchor="middle" dominant-baseline="central">${esc(you ? S.you : initials(l.person.name))}</text>
        <text class="${P}-ln-val" x="${(mx + 19).toFixed(1)}" y="${ly.toFixed(1)}"
              dominant-baseline="central">${fmt(last)}</text>
      </g>`;
        }
        const head = `<circle class="${P}-ln-head" cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}"
      r="${you ? 5 : 3.6}"/>`
            + (you ? `<circle class="${P}-ln-ping" cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="5"/>` : "");
        return `<g class="${P}-lngrp" data-key="${esc(key)}" data-role="${role}" tabindex="0"
      role="button" style="--c:hsl(${hueOf(key)} 78% 62%);--i:${rank[role]}"
      aria-label="${esc(l.person.name)} · ${fmt(last)} ${esc(S.unitXp)}">
      <title>${esc(l.person.name)} · ${fmt(last)} ${esc(S.unitXp)}</title>
      ${area}
      <path class="${P}-ln-hit" d="${d}"/>
      <path class="${P}-ln" d="${d}" stroke="${stroke}"/>
      ${head}${cap}
    </g>`;
    };
    const legend = `<div class="${P}-lgd">
    ${viewerKey ? `<span class="${P}-lgd-i" data-role="you">${esc(S.lineYou)}</span>` : ""}
    <span class="${P}-lgd-i" data-role="top">${esc(S.lineLeader)}</span>
    <span class="${P}-lgd-i" data-role="peer">${esc(S.lineOthers)}</span>
    <span class="${P}-lgd-hint">${esc(S.lineHint)}</span>
  </div>`;
    return `<div class="${P}-lines">
    <svg viewBox="0 0 ${LW} ${LH}" class="${P}-lines-svg" role="img"
         aria-label="${esc(S.capXp)}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="${uid}-you" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--csl-primary)"/>
          <stop offset="100%" stop-color="var(--csl-accent)"/>
        </linearGradient>
        <linearGradient id="${uid}-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--csl-accent)" stop-opacity=".34"/>
          <stop offset="100%" stop-color="var(--csl-accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${xticks}
      ${ordered.map(draw).join("")}
    </svg>
    ${legend}
    <div class="${P}-lines-dd" hidden></div>
  </div>`;
}
/** The gap sentence, in the units of the metric being shown. Recomputed on
 *  every metric switch, because "te faltan 2" means nothing without knowing two
 *  of what. */
function gapText(info, metric) {
    if (!info)
        return S.ctaGeneric;
    if (info.gap <= 0 || info.rank === 1)
        return S.ctaLeading;
    const name = info.target.person.name.split(" ")[0];
    return metric === "hours" ? S.ctaGapHours(fmt(info.gap, 1), name)
        : metric === "xp" ? S.ctaGapXp(Math.ceil(info.gap), name)
            : metric === "streak" ? S.ctaGapStreak(Math.ceil(info.gap), name)
                : S.ctaGapCourses(Math.ceil(info.gap), name);
}
/**
 * The call to action.
 *
 * A leaderboard that only ranks people is a scoreboard; the point of gamifying
 * learning is the next action, so the widget ends on one. The sentence above
 * the button is specific — it names the person directly ahead of the viewer and
 * the exact gap in the current metric — because "haz más cursos" is advice,
 * while "te faltan 2 cursos para alcanzar a Lucía" is a target.
 */
function catchUp(info, metric, label, href) {
    const rankChip = info ? `<span class="${P}-cta-rank">${esc(S.ctaRankOf(info.rank, info.total))}</span>` : "";
    const btn = href
        ? `<a class="${P}-cta-btn" href="${esc(href)}" data-cta="1">`
        : `<button type="button" class="${P}-cta-btn" data-cta="1">`;
    const btnEnd = href ? `</a>` : `</button>`;
    return `<div class="${P}-cta" data-done="${info && info.rank === 1 ? "1" : "0"}">
    <span class="${P}-cta-ico">${icon("rocket", 20)}</span>
    <div class="${P}-cta-txt">
      <div class="${P}-cta-title">${esc(S.ctaTitle)} ${rankChip}</div>
      <div class="${P}-cta-gap">${esc(gapText(info, metric))}</div>
    </div>
    ${btn}<span>${esc(label || S.ctaAction)}</span>${icon("arrow", 15)}${btnEnd}
  </div>`;
}
// ── Drilldown ────────────────────────────────────────────────────────────────
/** Built on demand rather than up front: seven course cards per person across a
 *  dozen rows is a lot of hidden DOM (and a lot of Unsplash requests) for a
 *  panel most viewers never open. */
function drilldown(l) {
    if (!l.completions.length) {
        return `<div class="${P}-dd-empty">${esc(S.noCompletions)}</div>`;
    }
    const cards = l.completions.map((c, i) => {
        const t = c.course;
        const typeLabel = t.type === "event" ? S.typeEvent : S.typeOnline;
        const dur = t.minutes >= 60
            ? `${fmt(t.minutes / 60, t.minutes % 60 ? 1 : 0)} ${S.unitHours}`
            : `${t.minutes} min`;
        return `<div class="${P}-cc" style="--i:${i}">
      <div class="${P}-cc-img">
        <img src="${esc(t.image)}" alt="" loading="lazy"
             onerror="this.parentElement.classList.add('${P}-cc-noimg');this.remove()">
        ${t.required ? `<span class="${P}-cc-req">${esc(S.required)}</span>` : ""}
      </div>
      <div class="${P}-cc-body">
        <div class="${P}-cc-title">${esc(t.title)}</div>
        <div class="${P}-cc-meta">
          <span>${icon(t.type === "event" ? "calendar" : "headphones", 12)} ${esc(typeLabel)}</span>
          <span>${icon("clock", 12)} ${esc(dur)}</span>
          <span>${esc(S.modules(t.modules.length))}</span>
        </div>
        <span class="${P}-cc-flag" data-ok="${c.onTime}">
          ${icon(c.onTime ? "check" : "clock", 12)} ${esc(c.onTime ? S.onTime : S.late)}
        </span>
      </div>
    </div>`;
    }).join("");
    return `<div class="${P}-dd-in">
    <div class="${P}-dd-head">${esc(S.completedCourses)} · ${esc(String(l.completions.length))}</div>
    <div class="${P}-cc-grid">${cards}</div>
    ${badgeChips(l)}
  </div>`;
}
// ── Header ───────────────────────────────────────────────────────────────────
function header(brandLabel, metric, showSwitcher) {
    return `<div class="${P}-head">
    <div class="${P}-head-txt">
      <h3 class="${P}-title">${icon("trophy", 18)} ${esc(S.title)}</h3>
      <p class="${P}-sub">${esc(S.subtitle)}</p>
    </div>
    <div class="${P}-head-side">
      ${brandLabel ? `<span class="${P}-brandchip">${icon("users", 12)} ${esc(brandLabel)}</span>` : ""}
      ${showSwitcher ? switcher(metric) : ""}
    </div>
  </div>`;
}
function footnote() {
    return `<div class="${P}-note">${icon("star", 11)} ${esc(S.demoNote)}</div>`;
}
/** A one-line label above each chart. The shapes change between metrics, so the
 *  view says what it is showing rather than leaving the viewer to infer it from
 *  a switch they may not have noticed pressing. */
function caption(metric) {
    const glyph = CHART_KIND[metric] === "lines" ? "trend"
        : CHART_KIND[metric] === "heat" ? "grid"
            : CHART_KIND[metric] === "stack" ? "layers" : "book";
    return `<div class="${P}-cap">${icon(glyph, 12)} ${esc(CAPTION[metric])}</div>`;
}

;// ./cornerstone-learning.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cornerstone Learning Leaderboard — a gamified ranking of learning activity,
// themed by the viewer's own group membership.
//
// Two things make this widget more than a bar chart:
//
//   1. The bars *race*. Switching metric re-ranks the field and the rows travel
//      to their new positions (FLIP), so the switch reveals a different story
//      instead of redrawing the same one.
//   2. The colours follow the viewer. Multibranding is group-driven, so the
//      same widget on the same page is Retail red for one person and HQ blue
//      for the next. See `branding.ts`.
//
// The people are real (`/users`); the scores are demo data, derived from one
// seeded completion history per person so the metrics agree with each other.
// See `demo.ts`, and the "Datos de demostración" footnote that says so on
// screen.
// ─────────────────────────────────────────────────────────────────────────────
var cornerstone_learning_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};






// ── Defaults ─────────────────────────────────────────────────────────────────
// Ships empty on purpose: the token is a runtime editor value, never a
// committed secret.
const DEFAULT_API_TOKEN = "";
const DEFAULT_BASE_URL = "";
const DEFAULT_PRIMARY = "#7C5CFF";
const DEFAULT_ACCENT = "#3DDC97";
const MAX_FEATURED = 3;
/** A ceiling on the pasted pool — not a design limit, just a guard against a
 *  runaway paste turning into a hundred user lookups. */
const MAX_POOL = 24;
// ── Config schema ────────────────────────────────────────────────────────────
const brandProps = {};
for (let i = 1; i <= (/* inlined export .MAX_BRANDS */4); i++) {
    brandProps[`brand${i}group`] = { type: "string", title: `Brand ${i} — Group (ID or name)`, default: "" };
    brandProps[`brand${i}primary`] = { type: "string", title: `Brand ${i} — Primary Color`, default: "" };
    brandProps[`brand${i}accent`] = { type: "string", title: `Brand ${i} — Accent Color`, default: "" };
    brandProps[`brand${i}label`] = { type: "string", title: `Brand ${i} — Label`, default: "" };
}
const configurationSchema = {
    properties: {
        apitoken: { type: "string", title: "API Token", default: DEFAULT_API_TOKEN },
        baseurl: { type: "string", title: "Base URL (e.g. https://acme.staffbase.com/api)", default: DEFAULT_BASE_URL },
        authmode: { type: "string", title: "Authentication", enum: ["auto", "token", "session"], default: "auto" },
        topuserids: { type: "string", title: "User IDs (comma-separated — as many as you like)", default: "" },
        podiumdraw: {
            type: "string", title: "How the Top 3 Are Chosen",
            enum: ["shuffle", "typed", "daily", "weekly"], default: "shuffle",
        },
        drawseed: { type: "string", title: "Draw Seed (change to re-roll)", default: "" },
        showviewer: { type: "boolean", title: "Add the Logged-In Viewer to the Ranking", default: true },
        fillercount: { type: "number", title: "Demo Peers Below the Top 3", default: 5 },
        defaultmetric: { type: "string", title: "Starting Metric", enum: ["courses", "hours", "xp", "streak"], default: "courses" },
        showmetricswitcher: { type: "boolean", title: "Let Viewers Switch Metric", default: true },
        showpodium: { type: "boolean", title: "Show Podium", default: true },
        showtierbar: { type: "boolean", title: "Show Level Progress", default: true },
        showbadges: { type: "boolean", title: "Show Badges", default: true },
        showstreak: { type: "boolean", title: "Show Streaks", default: true },
        showdrilldown: { type: "boolean", title: "Let Viewers Open Completed Courses", default: true },
        showcta: { type: "boolean", title: "Show the “Catch Up” Button", default: true },
        ctalabel: { type: "string", title: "Catch-Up Button Label", default: S.ctaAction },
        ctaurl: { type: "string", title: "Catch-Up Button Link (optional)", default: "" },
        colorscheme: { type: "string", title: "Color Scheme", enum: ["dark", "light", "auto"], default: "dark" },
        multibranding: { type: "boolean", title: "Multibranding (Color by the Viewer’s Group)", default: false },
        usethemecolors: { type: "boolean", title: "Use Theme Colors", default: true },
        animate: { type: "boolean", title: "Animate", default: true },
        showdemonote: { type: "boolean", title: "Show “Demo Data” Note", default: true },
        debugmode: { type: "boolean", title: "Debug Mode (on-screen logs)", default: false },
    },
    dependencies: {
        // Manual colours only exist when the branch theme is not driving.
        usethemecolors: {
            oneOf: [
                {
                    properties: {
                        usethemecolors: { const: false },
                        primarycolor: { type: "string", title: "Primary Color", default: DEFAULT_PRIMARY },
                        accentcolor: { type: "string", title: "Accent Color", default: DEFAULT_ACCENT },
                    },
                },
                { properties: { usethemecolors: { const: true } } },
            ],
        },
        // Brand slots only exist when multibranding is on — otherwise the editor is
        // sixteen fields of noise for the majority of setups that never use them.
        multibranding: {
            oneOf: [
                { properties: { multibranding: { const: false } } },
                {
                    properties: Object.assign(Object.assign({ multibranding: { const: true } }, brandProps), { brandfallback: {
                            type: "string", title: "When the Viewer Matches No Brand",
                            enum: ["theme", "manual"], default: "theme",
                        }, brandpreview: {
                            type: "number", title: "Preview Brand Slot (0 = off)", default: 0,
                        } }),
                },
            ],
        },
    },
};
// Left unannotated: the widget SDK bundles its own copy of the rjsf UiSchema
// type, so an explicit annotation from @rjsf/utils is a nominal mismatch.
const uiSchema = {
    apitoken: { "ui:help": "Basic API token. Stored in the widget configuration, not in source." },
    baseurl: { "ui:help": "Must include /api, e.g. https://acme.staffbase.com/api" },
    topuserids: {
        "ui:help": "Any number of Staffbase user IDs. Three of them are drawn for the podium; "
            + "the rest still appear in the ranking.",
    },
    podiumdraw: {
        "ui:help": "Shuffle picks three from anywhere in the list and keeps them fixed. "
            + "Typed ranks them in the order you pasted. Daily/Weekly draw a new three each day or week.",
    },
    drawseed: { "ui:help": "Any text. Changing it re-rolls which three are drawn, without touching the IDs." },
    showviewer: { "ui:help": "The person viewing the page joins the ranking as “Tú”, mid-field, so the XP chart and the catch-up button have a subject." },
    fillercount: { "ui:help": "Generated demo colleagues that fill the ranking below the three real users." },
    ctaurl: { "ui:help": "Where the button goes — your course catalogue. Leave empty to only emit the “cornerstone-learning:catchup” event for the page to handle." },
    multibranding: { "ui:help": "Reads the viewer's groups and themes the widget with the first matching brand." },
    brandpreview: { "ui:help": "Force a brand slot while configuring, since you cannot join every group." },
    brandfallback: { "ui:help": "Theme uses your branch branding; Manual uses the Primary/Accent colors above." },
    showdemonote: { "ui:help": "The scores are generated for demo purposes. Leave this on so viewers know." },
};
// ── CSS ──────────────────────────────────────────────────────────────────────
/* Staffbase's own stylesheet reaches into widget markup. Everything here is a
   neutralisation of a host rule, not a design choice.

   The button reset is split deliberately: (1) the base rule kills geometry
   (width/margin) once, and (2) the state rules re-declare ONLY paint
   (background/color/shadow/outline). Geometry must not appear in (2) — Staffbase
   sets `width:90%; margin:auto` on the base button rule only, so repeating
   geometry per state raises specificity above the widget's own component rules
   and collapses round buttons the moment they are hovered or pressed. */
const HOST_RESET = `
.${(/* inlined export .P */"csl")}-root button{
  width:auto!important;min-width:0!important;margin:0!important;
  background:none!important;border:0!important;box-shadow:none!important;
  color:inherit!important;font-family:inherit!important;line-height:normal!important;
  text-transform:none!important;letter-spacing:inherit!important;outline:none!important;
  padding:0;border-radius:0;cursor:pointer;-webkit-appearance:none;appearance:none;
  -webkit-tap-highlight-color:transparent;display:inline-flex;align-items:center;justify-content:center}
.${(/* inlined export .P */"csl")}-root button:hover,
.${(/* inlined export .P */"csl")}-root button:focus,
.${(/* inlined export .P */"csl")}-root button:focus-visible,
.${(/* inlined export .P */"csl")}-root button:active{
  background:none!important;box-shadow:none!important;color:inherit!important;
  outline:none!important}
.${(/* inlined export .P */"csl")}-root a,.${(/* inlined export .P */"csl")}-root a:hover,.${(/* inlined export .P */"csl")}-root a:focus,.${(/* inlined export .P */"csl")}-root a:active{
  color:inherit!important;text-decoration:none!important;background:none!important}
.${(/* inlined export .P */"csl")}-root ol,.${(/* inlined export .P */"csl")}-root ul{list-style:none!important;margin:0!important;padding:0!important}
.${(/* inlined export .P */"csl")}-root li{margin:0!important;padding:0!important;list-style:none!important}
.${(/* inlined export .P */"csl")}-root h1,.${(/* inlined export .P */"csl")}-root h2,.${(/* inlined export .P */"csl")}-root h3,.${(/* inlined export .P */"csl")}-root h4,.${(/* inlined export .P */"csl")}-root h5,.${(/* inlined export .P */"csl")}-root h6,
.${(/* inlined export .P */"csl")}-root p,.${(/* inlined export .P */"csl")}-root figure{
  margin:0!important;padding:0!important;font-family:inherit!important}
/* Staffbase's rich-text rule is ~6 classes deep but carries no !important, so
   pinning the properties it sets wins outright. Scoped to bare p, which is the
   entire blast radius — without it every paragraph is forced to 16px/#171719,
   invisible on the dark stage. */
.${(/* inlined export .P */"csl")}-root p{
  color:inherit!important;font-size:inherit!important;font-weight:inherit!important;
  font-style:normal!important;line-height:inherit!important}
.${(/* inlined export .P */"csl")}-root img{max-width:none!important;margin:0!important;border-radius:0}
.${(/* inlined export .P */"csl")}-root svg{display:block;overflow:visible}
.${(/* inlined export .P */"csl")}-root *,.${(/* inlined export .P */"csl")}-root *::before,.${(/* inlined export .P */"csl")}-root *::after{box-sizing:border-box}
`;
const CSS = `
${HOST_RESET}

/* --tint is what makes two schemes possible from one stylesheet: the colour
   laid over the background at low alpha for panels, tracks and hairlines.
   White on the dark stage, near-black on the light one. */
.${(/* inlined export .P */"csl")}-root{
  --tint:255,255,255;
  --bg:#0B0D12;
  --bg-2:#141926;
  --panel:rgba(var(--tint),.045);
  --panel-2:rgba(var(--tint),.075);
  --line:rgba(var(--tint),.10);
  --ink:#F2F5FA;
  --ink-2:#98A4BC;
  --csl-primary:${DEFAULT_PRIMARY};
  --csl-accent:${DEFAULT_ACCENT};
  --csl-primary-rgb:${rgbTriplet(DEFAULT_PRIMARY)};
  --csl-accent-rgb:${rgbTriplet(DEFAULT_ACCENT)};
  --r:20px;--r-sm:12px;--r-xs:8px;
  --dur:.42s;
  --ease:cubic-bezier(.22,.86,.28,1);
  --back:cubic-bezier(.34,1.56,.64,1);
  position:relative;
  font-family:inherit;
  color:var(--ink);
  border-radius:var(--r);
  padding:22px 22px 16px;
  background:
    radial-gradient(120% 90% at 8% -10%, rgba(var(--csl-primary-rgb),.30), transparent 60%),
    radial-gradient(90% 80% at 100% 0%, rgba(var(--csl-accent-rgb),.20), transparent 62%),
    linear-gradient(160deg, var(--bg-2), var(--bg));
  box-shadow:0 24px 60px -30px rgba(0,0,0,.75);
  overflow:hidden;
  /* Brand colour changes are animated: on a multibrand demo the recolour is the
     point, and a hard swap reads as a reload. */
  transition:background .5s var(--ease);
}
.${(/* inlined export .P */"csl")}-root[data-scheme="light"]{
  --tint:16,20,30;
  --bg:#FFFFFF;
  --bg-2:#F4F6FB;
  --panel:rgba(var(--tint),.045);
  --panel-2:rgba(var(--tint),.07);
  --line:rgba(var(--tint),.12);
  --ink:#121724;
  --ink-2:#5C6780;
  box-shadow:0 18px 40px -28px rgba(16,20,30,.4);
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-head{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;
  justify-content:space-between;margin-bottom:18px}
.${(/* inlined export .P */"csl")}-title{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:700;
  letter-spacing:-.01em}
.${(/* inlined export .P */"csl")}-title svg{color:var(--csl-accent)}
.${(/* inlined export .P */"csl")}-sub{margin-top:3px!important;font-size:12.5px;color:var(--ink-2)}
.${(/* inlined export .P */"csl")}-head-side{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.${(/* inlined export .P */"csl")}-brandchip{display:inline-flex;align-items:center;gap:5px;font-size:11px;
  font-weight:650;letter-spacing:.02em;padding:5px 9px;border-radius:999px;
  color:var(--csl-primary);background:rgba(var(--csl-primary-rgb),.14);
  border:1px solid rgba(var(--csl-primary-rgb),.3)}

/* ── Metric switcher ────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-tabs{position:relative;display:inline-flex;gap:2px;padding:3px;
  background:var(--panel);border:1px solid var(--line);border-radius:999px}
.${(/* inlined export .P */"csl")}-tab{position:relative;z-index:1;gap:6px;padding:7px 13px!important;
  border-radius:999px!important;font-size:12.5px;font-weight:600;color:var(--ink-2);
  transition:color .22s var(--ease)}
.${(/* inlined export .P */"csl")}-tab-ico{display:inline-flex;opacity:.85}
.${(/* inlined export .P */"csl")}-tab-on{color:#fff}
.${(/* inlined export .P */"csl")}-root[data-scheme="light"] .${(/* inlined export .P */"csl")}-tab-on{color:#fff}
.${(/* inlined export .P */"csl")}-tab-ink{position:absolute;z-index:0;top:3px;left:0;height:calc(100% - 6px);
  border-radius:999px;background:linear-gradient(120deg,var(--csl-primary),var(--csl-accent));
  box-shadow:0 6px 18px -8px rgba(var(--csl-primary-rgb),.9);
  transition:transform var(--dur) var(--ease),width var(--dur) var(--ease);
  transform:translateX(0);width:0}

/* ── Podium ─────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-podium{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;
  align-items:end;margin-bottom:18px}
.${(/* inlined export .P */"csl")}-pod{display:flex;flex-direction:column;align-items:center;text-align:center;
  gap:7px;padding:16px 12px 14px;border-radius:var(--r-sm);
  background:var(--panel);border:1px solid var(--line)}
.${(/* inlined export .P */"csl")}-pod-1{order:2;padding-top:22px;
  background:linear-gradient(170deg,rgba(var(--csl-primary-rgb),.22),var(--panel));
  border-color:rgba(var(--csl-primary-rgb),.36)}
.${(/* inlined export .P */"csl")}-pod-2{order:1}
.${(/* inlined export .P */"csl")}-pod-3{order:3}
.${(/* inlined export .P */"csl")}-pod-avwrap{position:relative}
.${(/* inlined export .P */"csl")}-pod-rank{position:absolute;bottom:-4px;right:-4px;display:inline-flex;
  align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;
  font-size:12px;font-weight:800;color:#0B0D12;
  background:linear-gradient(140deg,var(--csl-accent),var(--csl-primary));
  box-shadow:0 4px 12px -4px rgba(0,0,0,.6)}
.${(/* inlined export .P */"csl")}-pod-nm{font-size:13.5px;font-weight:680;line-height:1.25}
.${(/* inlined export .P */"csl")}-pod-meta{font-size:11px;color:var(--ink-2);line-height:1.3}
.${(/* inlined export .P */"csl")}-pod-num{display:flex;align-items:baseline;gap:4px;margin-top:2px}
.${(/* inlined export .P */"csl")}-pod-num .${(/* inlined export .P */"csl")}-num{font-size:24px;font-weight:800;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums}
.${(/* inlined export .P */"csl")}-pod-1 .${(/* inlined export .P */"csl")}-num{font-size:30px;color:var(--csl-accent)}
.${(/* inlined export .P */"csl")}-unit{font-size:11px;color:var(--ink-2);font-weight:600}

/* ── Tier ───────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-tier{width:100%;margin-top:4px}
.${(/* inlined export .P */"csl")}-tier-head{display:flex;justify-content:space-between;align-items:center;gap:6px;
  font-size:10.5px;margin-bottom:4px}
.${(/* inlined export .P */"csl")}-tier-name{display:inline-flex;align-items:center;gap:4px;font-weight:700;
  color:var(--csl-accent)}
.${(/* inlined export .P */"csl")}-tier-cap{color:var(--ink-2);text-align:right}
.${(/* inlined export .P */"csl")}-tier-track{height:5px;border-radius:999px;background:var(--panel-2);overflow:hidden}
.${(/* inlined export .P */"csl")}-tier-fill{display:block;height:100%;width:var(--pct);border-radius:999px;
  background:linear-gradient(90deg,var(--csl-primary),var(--csl-accent));
  transform-origin:left center}

/* ── Badges ─────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}
.${(/* inlined export .P */"csl")}-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;
  border-radius:999px;font-size:10.5px;font-weight:650;color:var(--csl-accent);
  background:rgba(var(--csl-accent-rgb),.12);
  border:1px solid rgba(var(--csl-accent-rgb),.26);cursor:default}
.${(/* inlined export .P */"csl")}-badges-c .${(/* inlined export .P */"csl")}-badge{padding:3px;border-radius:50%}
.${(/* inlined export .P */"csl")}-nobadge{font-size:11px;color:var(--ink-2)}

/* ── Race ───────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-race{display:flex;flex-direction:column;gap:2px}
.${(/* inlined export .P */"csl")}-row{border-radius:var(--r-sm)}
.${(/* inlined export .P */"csl")}-row-main{display:flex;align-items:center;gap:11px;padding:9px 10px;
  border-radius:var(--r-sm);cursor:default;transition:background .2s var(--ease)}
.${(/* inlined export .P */"csl")}-row-main[role="button"]{cursor:pointer}
.${(/* inlined export .P */"csl")}-row-main[role="button"]:hover{background:var(--panel)}
.${(/* inlined export .P */"csl")}-row-main:focus-visible{outline:2px solid var(--csl-accent);outline-offset:-2px}
.${(/* inlined export .P */"csl")}-rank{flex:0 0 18px;text-align:center;font-size:12px;font-weight:700;
  color:var(--ink-2);font-variant-numeric:tabular-nums}
.${(/* inlined export .P */"csl")}-row-body{flex:1;min-width:0}
.${(/* inlined export .P */"csl")}-row-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.${(/* inlined export .P */"csl")}-row-nm{font-size:13px;font-weight:620;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.${(/* inlined export .P */"csl")}-row-val{display:inline-flex;align-items:baseline;gap:4px;flex:0 0 auto}
.${(/* inlined export .P */"csl")}-row-val .${(/* inlined export .P */"csl")}-num{font-size:13.5px;font-weight:750;font-variant-numeric:tabular-nums}
.${(/* inlined export .P */"csl")}-bar{height:7px;margin-top:5px;border-radius:999px;background:var(--panel-2);
  overflow:hidden}
.${(/* inlined export .P */"csl")}-bar-fill{display:block;height:100%;width:var(--w);border-radius:999px;
  background:linear-gradient(90deg,rgba(var(--csl-primary-rgb),.95),var(--csl-accent));
  transition:width var(--dur) var(--ease)}
.${(/* inlined export .P */"csl")}-row:nth-child(1) .${(/* inlined export .P */"csl")}-bar-fill{box-shadow:0 0 16px -2px rgba(var(--csl-accent-rgb),.6)}

/* ── Stacked hours ──────────────────────────────────────────────────────── */
/* The stack keeps the track of a normal bar (so lengths stay comparable across
   people) and divides its own width into one segment per course. */
.${(/* inlined export .P */"csl")}-bar-stack{display:flex;gap:1.5px;width:var(--w);height:100%;
  transition:width var(--dur) var(--ease);transform-origin:left center}
.${(/* inlined export .P */"csl")}-seg{flex:0 0 var(--s);height:100%;border-radius:2px;min-width:2px;
  background:rgba(var(--csl-primary-rgb),.55);cursor:default;
  transition:transform .18s var(--ease),filter .18s var(--ease)}
.${(/* inlined export .P */"csl")}-seg:first-child{border-top-left-radius:999px;border-bottom-left-radius:999px}
.${(/* inlined export .P */"csl")}-seg:last-child{border-top-right-radius:999px;border-bottom-right-radius:999px}
.${(/* inlined export .P */"csl")}-seg[data-type="event"]{background:rgba(var(--csl-primary-rgb),.85)}
.${(/* inlined export .P */"csl")}-seg[data-req="true"]{background:var(--csl-accent)}
.${(/* inlined export .P */"csl")}-seg:hover{transform:scaleY(1.7);filter:brightness(1.15)}

/* ── Streak heatmap ─────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-heat{display:flex;gap:4px;margin-top:6px}
.${(/* inlined export .P */"csl")}-heat-c{flex:1 1 0;height:14px;border-radius:3px;background:var(--panel-2);
  cursor:default;transition:transform .18s var(--ease),background .25s var(--ease)}
.${(/* inlined export .P */"csl")}-heat-c[data-lvl="1"]{background:rgba(var(--csl-primary-rgb),.38)}
.${(/* inlined export .P */"csl")}-heat-c[data-lvl="2"]{background:rgba(var(--csl-primary-rgb),.7)}
.${(/* inlined export .P */"csl")}-heat-c[data-lvl="3"]{background:var(--csl-accent)}
.${(/* inlined export .P */"csl")}-heat-c:hover{transform:scaleY(1.25)}

/* ── XP curves ──────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-lines{margin-top:2px}
.${(/* inlined export .P */"csl")}-lines-svg{width:100%;height:auto;overflow:visible}
.${(/* inlined export .P */"csl")}-xtick{fill:var(--ink-2);font-size:10.5px;font-family:inherit;font-weight:600;
  opacity:.75;letter-spacing:.01em}
.${(/* inlined export .P */"csl")}-lngrp{cursor:pointer;transition:opacity .22s var(--ease)}
.${(/* inlined export .P */"csl")}-lngrp:focus{outline:none}
.${(/* inlined export .P */"csl")}-lngrp:focus-visible .${(/* inlined export .P */"csl")}-ln{stroke-width:5}
/* A 16px transparent stroke under each curve: a 3px path is not a hit target,
   and "hover the line" is the entire interaction. */
.${(/* inlined export .P */"csl")}-ln-hit{fill:none;stroke:transparent;stroke-width:16;pointer-events:stroke}
.${(/* inlined export .P */"csl")}-ln{fill:none;stroke-linejoin:round;stroke-linecap:round;stroke-width:3;
  pointer-events:none;transition:stroke-width .2s var(--ease)}
.${(/* inlined export .P */"csl")}-ln-area{pointer-events:none}
.${(/* inlined export .P */"csl")}-ln-head{fill:var(--c);stroke:var(--bg-2);stroke-width:2;pointer-events:none;
  transform-box:fill-box;transform-origin:center}
.${(/* inlined export .P */"csl")}-ln-leader{fill:none;stroke:var(--c);stroke-width:1.4;opacity:.45;
  stroke-dasharray:2 3;pointer-events:none}
.${(/* inlined export .P */"csl")}-ln-med{fill:var(--c);stroke:var(--bg-2);stroke-width:2;pointer-events:none;
  filter:drop-shadow(0 3px 8px rgba(0,0,0,.35))}
.${(/* inlined export .P */"csl")}-ln-ini{fill:#0B0D12;font-size:10.5px;font-weight:800;font-family:inherit;
  pointer-events:none}
.${(/* inlined export .P */"csl")}-ln-val{fill:var(--ink);font-size:12px;font-weight:800;font-family:inherit;
  font-variant-numeric:tabular-nums;pointer-events:none}
.${(/* inlined export .P */"csl")}-lngrp[data-role="peer"] .${(/* inlined export .P */"csl")}-ln{stroke-width:2.2;opacity:.42}
.${(/* inlined export .P */"csl")}-lngrp[data-role="peer"] .${(/* inlined export .P */"csl")}-ln-head{opacity:.5}
.${(/* inlined export .P */"csl")}-lngrp[data-role="top"] .${(/* inlined export .P */"csl")}-ln{opacity:.95}
/* The subject of the chart: gradient stroke, a glow, and a ring that keeps
   pulsing at the tip so your own progress is the thing your eye lands on. */
.${(/* inlined export .P */"csl")}-lngrp[data-role="you"]{--c:var(--csl-accent)}
.${(/* inlined export .P */"csl")}-lngrp[data-role="you"] .${(/* inlined export .P */"csl")}-ln{stroke-width:4.4;
  filter:drop-shadow(0 3px 12px rgba(var(--csl-accent-rgb),.65))}
.${(/* inlined export .P */"csl")}-lngrp[data-role="you"] .${(/* inlined export .P */"csl")}-ln-val{fill:var(--csl-accent)}
.${(/* inlined export .P */"csl")}-ln-ping{fill:none;stroke:var(--csl-accent);stroke-width:2;pointer-events:none;
  transform-box:fill-box;transform-origin:center;opacity:0}
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-ln-ping{animation:${(/* inlined export .P */"csl")}-ping 2.4s var(--ease) 1.7s infinite}
/* One curve raised, the rest pushed back — the comparison only reads if the
   others recede. */
.${(/* inlined export .P */"csl")}-lines[data-on="1"] .${(/* inlined export .P */"csl")}-lngrp{opacity:.12}
.${(/* inlined export .P */"csl")}-lines[data-on="1"] .${(/* inlined export .P */"csl")}-lngrp.${(/* inlined export .P */"csl")}-ln-on{opacity:1}
.${(/* inlined export .P */"csl")}-lines[data-on="1"] .${(/* inlined export .P */"csl")}-lngrp.${(/* inlined export .P */"csl")}-ln-on .${(/* inlined export .P */"csl")}-ln{stroke-width:5}
.${(/* inlined export .P */"csl")}-lgd{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:8px;
  padding-left:2px;font-size:11px;color:var(--ink-2)}
.${(/* inlined export .P */"csl")}-lgd-i{display:inline-flex;align-items:center;gap:6px;font-weight:620}
.${(/* inlined export .P */"csl")}-lgd-i::before{content:"";width:16px;height:3px;border-radius:2px;
  background:linear-gradient(90deg,hsl(268 78% 62%),hsl(160 78% 62%))}
.${(/* inlined export .P */"csl")}-lgd-i[data-role="top"]::before{background:hsl(42 85% 60%)}
.${(/* inlined export .P */"csl")}-lgd-i[data-role="you"]::before{height:4px;
  background:linear-gradient(90deg,var(--csl-primary),var(--csl-accent))}
.${(/* inlined export .P */"csl")}-lgd-i[data-role="you"]{color:var(--csl-accent)}
.${(/* inlined export .P */"csl")}-lgd-hint{margin-left:auto;opacity:.7}
.${(/* inlined export .P */"csl")}-lines-dd{margin-top:6px;border-top:1px solid var(--line)}
.${(/* inlined export .P */"csl")}-lines-dd .${(/* inlined export .P */"csl")}-dd-in{padding:12px 2px 4px}

/* ── You ────────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-you{flex:0 0 auto;padding:1px 6px;border-radius:999px;font-size:9.5px;
  font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#0B0D12;
  background:var(--csl-accent)}
.${(/* inlined export .P */"csl")}-row[data-you="1"]{background:rgba(var(--csl-accent-rgb),.07);
  box-shadow:inset 0 0 0 1px rgba(var(--csl-accent-rgb),.22)}
.${(/* inlined export .P */"csl")}-pod[data-you="1"]{box-shadow:0 0 0 1px rgba(var(--csl-accent-rgb),.45)}

/* ── Catch up ───────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-cta{display:flex;align-items:center;gap:13px;margin-top:14px;padding:13px 15px;
  border-radius:var(--r-sm);
  background:linear-gradient(120deg,rgba(var(--csl-primary-rgb),.20),rgba(var(--csl-accent-rgb),.10));
  border:1px solid rgba(var(--csl-primary-rgb),.3)}
.${(/* inlined export .P */"csl")}-cta-ico{display:inline-flex;flex:0 0 auto;width:38px;height:38px;border-radius:50%;
  align-items:center;justify-content:center;color:var(--csl-accent);
  background:rgba(var(--csl-accent-rgb),.14)}
.${(/* inlined export .P */"csl")}-cta-txt{flex:1;min-width:0}
.${(/* inlined export .P */"csl")}-cta-title{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:750}
.${(/* inlined export .P */"csl")}-cta-rank{padding:1px 7px;border-radius:999px;font-size:10px;font-weight:700;
  color:var(--ink-2);background:var(--panel-2)}
.${(/* inlined export .P */"csl")}-cta-gap{margin-top:2px;font-size:12px;color:var(--ink-2);line-height:1.35}
.${(/* inlined export .P */"csl")}-cta-btn{flex:0 0 auto;gap:7px;padding:9px 15px!important;border-radius:999px!important;
  font-size:12.5px;font-weight:700;color:#0B0D12!important;
  background:linear-gradient(120deg,var(--csl-accent),var(--csl-primary))!important;
  box-shadow:0 10px 24px -12px rgba(var(--csl-accent-rgb),.9);
  transition:transform .18s var(--ease),box-shadow .18s var(--ease)}
.${(/* inlined export .P */"csl")}-cta-btn:hover{transform:translateY(-1px);
  box-shadow:0 14px 28px -12px rgba(var(--csl-accent-rgb),1)}
.${(/* inlined export .P */"csl")}-cta-btn:active{transform:translateY(0)}
.${(/* inlined export .P */"csl")}-cta-btn:focus-visible{outline:2px solid var(--csl-accent);outline-offset:3px}
/* Pressing the button with no URL configured has nothing visible to do — the
   page is listening for the event instead — so the press acknowledges itself. */
.${(/* inlined export .P */"csl")}-cta-btn[data-pulse="1"]{animation:${(/* inlined export .P */"csl")}-pulse .6s var(--ease)}
@keyframes ${(/* inlined export .P */"csl")}-pulse{
  0%{transform:scale(1)}
  35%{transform:scale(1.06)}
  100%{transform:scale(1)}}
.${(/* inlined export .P */"csl")}-cta[data-done="1"] .${(/* inlined export .P */"csl")}-cta-gap{color:var(--csl-accent)}

/* ── Caption ────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-cap{display:flex;align-items:center;gap:6px;margin:0 0 9px 2px;font-size:11px;
  font-weight:600;letter-spacing:.01em;color:var(--ink-2)}
.${(/* inlined export .P */"csl")}-cap svg{opacity:.8}
.${(/* inlined export .P */"csl")}-row-sub{display:flex;align-items:center;gap:6px;margin-top:5px;min-height:0}
.${(/* inlined export .P */"csl")}-row-sub:empty{display:none}
.${(/* inlined export .P */"csl")}-streak{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;
  font-weight:700;color:#FF9E5E}
.${(/* inlined export .P */"csl")}-row-chev{color:var(--ink-2);transition:transform .25s var(--ease)}
.${(/* inlined export .P */"csl")}-row[data-open="1"] .${(/* inlined export .P */"csl")}-row-chev{transform:rotate(180deg)}
.${(/* inlined export .P */"csl")}-row[data-open="1"]{background:var(--panel)}

/* ── Spark ──────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-spark{display:inline-flex;gap:3px;align-items:flex-end}
.${(/* inlined export .P */"csl")}-spark-c{width:7px;height:7px;border-radius:2px;background:var(--panel-2)}
.${(/* inlined export .P */"csl")}-spark-c[data-lvl="1"]{background:rgba(var(--csl-primary-rgb),.45)}
.${(/* inlined export .P */"csl")}-spark-c[data-lvl="2"]{background:rgba(var(--csl-primary-rgb),.75)}
.${(/* inlined export .P */"csl")}-spark-c[data-lvl="3"]{background:var(--csl-accent)}

/* ── Drilldown ──────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-dd{overflow:hidden}
.${(/* inlined export .P */"csl")}-dd-in{padding:4px 10px 14px 39px}
.${(/* inlined export .P */"csl")}-dd-head{font-size:11px;font-weight:700;letter-spacing:.04em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:8px}
.${(/* inlined export .P */"csl")}-dd-empty{padding:6px 10px 14px 39px;font-size:12px;color:var(--ink-2)}
.${(/* inlined export .P */"csl")}-cc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:9px}
.${(/* inlined export .P */"csl")}-cc{display:flex;flex-direction:column;border-radius:var(--r-xs);overflow:hidden;
  background:var(--panel);border:1px solid var(--line)}
.${(/* inlined export .P */"csl")}-cc-img{position:relative;height:74px;background:var(--panel-2)}
.${(/* inlined export .P */"csl")}-cc-img img{width:100%;height:100%;object-fit:cover;display:block}
.${(/* inlined export .P */"csl")}-cc-req{position:absolute;top:6px;left:6px;padding:2px 6px;border-radius:999px;
  font-size:9.5px;font-weight:750;color:#0B0D12;background:var(--csl-accent)}
.${(/* inlined export .P */"csl")}-cc-body{padding:8px 9px 9px;display:flex;flex-direction:column;gap:4px}
.${(/* inlined export .P */"csl")}-cc-title{font-size:12px;font-weight:660;line-height:1.3}
.${(/* inlined export .P */"csl")}-cc-meta{display:flex;flex-wrap:wrap;gap:7px;font-size:10px;color:var(--ink-2)}
.${(/* inlined export .P */"csl")}-cc-meta span{display:inline-flex;align-items:center;gap:3px}
.${(/* inlined export .P */"csl")}-cc-flag{display:inline-flex;align-items:center;gap:3px;font-size:10px;
  font-weight:700;color:#FF9E5E;margin-top:1px}
.${(/* inlined export .P */"csl")}-cc-flag[data-ok="true"]{color:var(--csl-accent)}

/* ── Avatars ────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-av{position:relative;display:inline-block;width:var(--av);height:var(--av);
  border-radius:50%;overflow:hidden;flex:0 0 auto;background:var(--panel-2)}
.${(/* inlined export .P */"csl")}-av img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}
.${(/* inlined export .P */"csl")}-av-fb::after{content:attr(data-ini);position:absolute;inset:0;display:flex;
  align-items:center;justify-content:center;
  font-size:calc(var(--av) * .38);font-weight:700;color:#fff;letter-spacing:.02em;
  background:linear-gradient(140deg,var(--csl-primary),var(--csl-accent))}
.${(/* inlined export .P */"csl")}-av-hero{box-shadow:0 10px 26px -12px rgba(0,0,0,.85);
  outline:2px solid rgba(var(--csl-accent-rgb),.5);outline-offset:2px}
.${(/* inlined export .P */"csl")}-avlink{display:inline-flex;border-radius:50%}

/* ── States ─────────────────────────────────────────────────────────────── */
.${(/* inlined export .P */"csl")}-state{padding:26px 10px;text-align:center;font-size:13px;color:var(--ink-2)}
.${(/* inlined export .P */"csl")}-state strong{display:block;color:var(--ink);font-size:14px;margin-bottom:5px}
.${(/* inlined export .P */"csl")}-note{display:flex;align-items:center;gap:5px;margin-top:12px;font-size:10.5px;
  color:var(--ink-2);opacity:.8}
.${(/* inlined export .P */"csl")}-dbg{margin-top:12px;padding:9px 10px;border-radius:var(--r-xs);
  background:var(--panel);border:1px solid var(--line);font-family:ui-monospace,monospace;
  font-size:10.5px;color:var(--ink-2);white-space:pre-wrap;max-height:180px;overflow:auto}

/* ── Motion ─────────────────────────────────────────────────────────────── */
/* Gated behind [data-anim="1"] so the config flag and prefers-reduced-motion
   both switch it off by removing one attribute, rather than by trying to
   unwind transitions that have already been declared. */
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-pod,
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-row{
  opacity:0;transform:translateY(10px);
  animation:${(/* inlined export .P */"csl")}-in .5s var(--ease) forwards;
  animation-delay:calc(var(--i,0) * 55ms)}
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-bar-fill{
  animation:${(/* inlined export .P */"csl")}-grow .7s var(--ease) both;
  animation-delay:calc(var(--i,0) * 55ms + 90ms)}
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-bar-stack{
  animation:${(/* inlined export .P */"csl")}-grow .7s var(--ease) both;
  animation-delay:calc(var(--i,0) * 55ms + 90ms)}
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-heat-c{
  opacity:0;animation:${(/* inlined export .P */"csl")}-pop .4s var(--ease) forwards;
  animation-delay:calc(var(--i,0) * 45ms + 120ms)}
/* The curve draws itself: dasharray is set to the path length in JS (SVG cannot
   express "my own length" in CSS), then the offset is animated to zero. A path
   that simply appeared would lose the sense of accumulation the chart is for.
   Peers go first and the viewer's curve lands last, so the animation ends on
   the line the viewer came to see. */
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-ln[data-len]{
  stroke-dasharray:var(--len);stroke-dashoffset:var(--len);
  animation:${(/* inlined export .P */"csl")}-draw 1.15s cubic-bezier(.33,.9,.3,1) forwards;
  animation-delay:calc(var(--i,0) * 220ms)}
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-ln-area{
  opacity:0;animation:${(/* inlined export .P */"csl")}-in .6s var(--ease) forwards;animation-delay:1.5s}
/* The head arrives at the end of its own curve, then the medallion pops in —
   the dot landing before the label is what makes it feel like a finish line. */
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-ln-head{
  opacity:0;animation:${(/* inlined export .P */"csl")}-pop .45s var(--back) forwards;
  animation-delay:calc(var(--i,0) * 220ms + .95s)}
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-ln-cap{
  opacity:0;animation:${(/* inlined export .P */"csl")}-cap .5s var(--back) forwards;
  animation-delay:calc(var(--i,0) * 220ms + 1.1s)}
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-xtick{
  opacity:0;animation:${(/* inlined export .P */"csl")}-in .4s var(--ease) forwards;
  animation-delay:calc(var(--i,0) * 60ms + .15s)}
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-reveal .${(/* inlined export .P */"csl")}-cta{
  opacity:0;animation:${(/* inlined export .P */"csl")}-in .5s var(--ease) forwards;animation-delay:.42s}
.${(/* inlined export .P */"csl")}-root[data-anim="1"] .${(/* inlined export .P */"csl")}-cc{
  opacity:0;animation:${(/* inlined export .P */"csl")}-in .34s var(--ease) forwards;
  animation-delay:calc(var(--i,0) * 40ms)}
@keyframes ${(/* inlined export .P */"csl")}-in{to{opacity:1;transform:none}}
@keyframes ${(/* inlined export .P */"csl")}-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
/* translate only, no scale: a scaled <g> needs transform-box:fill-box, which
   older engines ignore on group elements and then fly the medallion in from the
   SVG origin. */
@keyframes ${(/* inlined export .P */"csl")}-cap{from{opacity:0;transform:translateX(10px)}
  to{opacity:1;transform:none}}
@keyframes ${(/* inlined export .P */"csl")}-ping{0%{opacity:.85;transform:scale(1)}
  70%{opacity:0;transform:scale(2.6)}100%{opacity:0;transform:scale(2.6)}}
@keyframes ${(/* inlined export .P */"csl")}-draw{to{stroke-dashoffset:0}}
@keyframes ${(/* inlined export .P */"csl")}-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
/* FLIP: the row is put back at its old offset with no transition, then released
   on the next frame with one. */
.${(/* inlined export .P */"csl")}-row[data-flip="1"]{transition:none}
.${(/* inlined export .P */"csl")}-row[data-flip="2"]{transition:transform var(--dur) var(--ease)}
@media (prefers-reduced-motion:reduce){
  .${(/* inlined export .P */"csl")}-root *{animation:none!important;transition:none!important}
}

/* ── Narrow ─────────────────────────────────────────────────────────────── */
@media (max-width:560px){
  .${(/* inlined export .P */"csl")}-root{padding:16px 14px 12px}
  .${(/* inlined export .P */"csl")}-head{flex-direction:column;align-items:stretch}
  /* The podium stays three across on a phone. Stacked, the three cards ate the
     whole screen and the ranking — the one thing a podium is for — stopped
     being a shape you could read at a glance. So it shrinks instead: smaller
     avatars, tighter type, and the secondary lines (role, badges) dropped,
     since they are legible on the rows below anyway. */
  .${(/* inlined export .P */"csl")}-podium{grid-template-columns:repeat(3,1fr);gap:6px;align-items:end}
  .${(/* inlined export .P */"csl")}-pod{padding:12px 5px 10px;gap:5px;border-radius:var(--r-xs);min-width:0}
  .${(/* inlined export .P */"csl")}-pod-1{padding-top:16px}
  .${(/* inlined export .P */"csl")}-pod .${(/* inlined export .P */"csl")}-av-hero{--av:46px!important}
  .${(/* inlined export .P */"csl")}-pod-1 .${(/* inlined export .P */"csl")}-av-hero{--av:58px!important}
  .${(/* inlined export .P */"csl")}-pod-rank{width:20px;height:20px;font-size:10px;bottom:-2px;right:-2px}
  .${(/* inlined export .P */"csl")}-pod-nm{font-size:11px;line-height:1.2;width:100%;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
    overflow:hidden;overflow-wrap:anywhere}
  .${(/* inlined export .P */"csl")}-pod-meta,.${(/* inlined export .P */"csl")}-pod .${(/* inlined export .P */"csl")}-badges,.${(/* inlined export .P */"csl")}-pod .${(/* inlined export .P */"csl")}-nobadge{display:none}
  .${(/* inlined export .P */"csl")}-pod-num{gap:2px;flex-wrap:wrap;justify-content:center}
  .${(/* inlined export .P */"csl")}-pod-num .${(/* inlined export .P */"csl")}-num{font-size:17px}
  .${(/* inlined export .P */"csl")}-pod-1 .${(/* inlined export .P */"csl")}-num{font-size:21px}
  .${(/* inlined export .P */"csl")}-unit{font-size:9.5px}
  .${(/* inlined export .P */"csl")}-pod .${(/* inlined export .P */"csl")}-tier-head{font-size:9px}
  .${(/* inlined export .P */"csl")}-pod .${(/* inlined export .P */"csl")}-tier-cap{display:none}
  .${(/* inlined export .P */"csl")}-pod .${(/* inlined export .P */"csl")}-you{font-size:8.5px;padding:1px 4px}
  .${(/* inlined export .P */"csl")}-dd-in,.${(/* inlined export .P */"csl")}-dd-empty{padding-left:12px}
  .${(/* inlined export .P */"csl")}-tabs{width:100%;justify-content:space-between}
  .${(/* inlined export .P */"csl")}-tab{flex:1;padding:7px 8px!important}
  .${(/* inlined export .P */"csl")}-cta{flex-wrap:wrap;gap:10px;padding:12px}
  .${(/* inlined export .P */"csl")}-cta-btn{width:100%!important;justify-content:center}
  .${(/* inlined export .P */"csl")}-lgd-hint{display:none}
  /* Text inside the SVG is in viewBox units, and the viewBox is scaled *down*
     to fit a phone — so these sizes have to go up just to hold their ground.
     640 units across a ~360px screen is a 0.56 factor. */
  .${(/* inlined export .P */"csl")}-ln-ini{font-size:14px}
  .${(/* inlined export .P */"csl")}-ln-val{font-size:17px}
  .${(/* inlined export .P */"csl")}-xtick{font-size:16px}
}
@media (max-width:420px){
  /* Six week labels will not fit; every other one still carries the axis. */
  .${(/* inlined export .P */"csl")}-xtick[data-i="1"],.${(/* inlined export .P */"csl")}-xtick[data-i="3"]{display:none}
  .${(/* inlined export .P */"csl")}-ln-ini{font-size:17px}
  .${(/* inlined export .P */"csl")}-ln-val{font-size:20px}
  .${(/* inlined export .P */"csl")}-xtick{font-size:19px}
}
@media (max-width:380px){
  .${(/* inlined export .P */"csl")}-pod .${(/* inlined export .P */"csl")}-av-hero{--av:38px!important}
  .${(/* inlined export .P */"csl")}-pod-1 .${(/* inlined export .P */"csl")}-av-hero{--av:48px!important}
  .${(/* inlined export .P */"csl")}-pod-nm{font-size:10px}
  .${(/* inlined export .P */"csl")}-pod-num .${(/* inlined export .P */"csl")}-num{font-size:15px}
  .${(/* inlined export .P */"csl")}-pod-1 .${(/* inlined export .P */"csl")}-num{font-size:18px}
  .${(/* inlined export .P */"csl")}-pod .${(/* inlined export .P */"csl")}-tier{display:none}
}
`;
// ── Factory ──────────────────────────────────────────────────────────────────
const factory = (BaseBlockClass, widgetApi) => {
    return class CornerstoneLearning extends BaseBlockClass {
        constructor() { super(); }
        connectedCallback() {
            return cornerstone_learning_awaiter(this, void 0, void 0, function* () {
                const host = this;
                const attr = (n) => host.getAttribute(n) || "";
                const bool = (n, dflt) => {
                    const v = attr(n);
                    return v === "" ? dflt : v !== "false" && v !== "0";
                };
                const num = (n, dflt) => {
                    const v = Number(attr(n));
                    return isFinite(v) && attr(n) !== "" ? v : dflt;
                };
                const debug = bool("debugmode", false);
                const logs = [];
                const log = (...a) => {
                    const line = a.map(x => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
                    logs.push(line);
                    if (debug)
                        console.log(`[${(/* inlined export .P */"csl")}]`, ...a);
                };
                // ── Scheme ──
                const schemeCfg = attr("colorscheme") || "dark";
                const prefersDark = typeof window.matchMedia === "function"
                    && window.matchMedia("(prefers-color-scheme: dark)").matches;
                const scheme = schemeCfg === "auto"
                    ? (prefersDark ? "dark" : "light")
                    : (schemeCfg === "light" ? "light" : "dark");
                const reduceMotion = typeof window.matchMedia === "function"
                    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                const animate = bool("animate", true) && !reduceMotion;
                // ── Shell ──
                host.innerHTML = `<style>${CSS}</style>
        <div class="${(/* inlined export .P */"csl")}-root" data-scheme="${scheme}" data-anim="${animate ? 1 : 0}">
          <div class="${(/* inlined export .P */"csl")}-body"><div class="${(/* inlined export .P */"csl")}-state">${esc(S.loading)}</div></div>
        </div>`;
                const root = host.querySelector(`.${(/* inlined export .P */"csl")}-root`);
                const body = host.querySelector(`.${(/* inlined export .P */"csl")}-body`);
                const baseUrl = attr("baseurl").replace(/\/+$/, "");
                const apiToken = attr("apitoken") || DEFAULT_API_TOKEN;
                const authMode = attr("authmode") || "auto";
                const http = new Http(4, log);
                const tokenOrder = apiToken && authMode !== "session" ? [makeApiOpts(apiToken)] : [];
                const sessionFirst = authMode === "token" ? tokenOrder : [sessionOpts, ...tokenOrder];
                const tokenFirst = authMode === "session" ? [sessionOpts] : [...tokenOrder, sessionOpts];
                // ── Branding ──
                const manual = {
                    primary: fitToSurface(normalizeHex(attr("primarycolor")) || DEFAULT_PRIMARY, scheme),
                    accent: fitToSurface(normalizeHex(attr("accentcolor")) || DEFAULT_ACCENT, scheme),
                    label: "",
                    source: "manual",
                    via: "",
                };
                /** The non-brand palette: branch theme when asked for and reachable,
                 *  otherwise whatever the editor set by hand. */
                const baseTheme = () => cornerstone_learning_awaiter(this, void 0, void 0, function* () {
                    if (bool("usethemecolors", true) && apiToken && baseUrl) {
                        try {
                            const t = yield fetchThemeColors(baseUrl, apiToken, "primary", scheme);
                            if (t.primary) {
                                log("theme colors", t.primary, t.accent || "(no accent)");
                                return {
                                    primary: fitToSurface(t.primary, scheme),
                                    accent: fitToSurface(t.accent || t.primary, scheme),
                                    label: "", source: "theme", via: "",
                                };
                            }
                        }
                        catch (e) {
                            log("theme colors failed —", (e === null || e === void 0 ? void 0 : e.message) || String(e));
                        }
                    }
                    return manual;
                });
                let match = yield baseTheme();
                // Read once, up front: the same identity answers two questions — which
                // brand to paint, and who "Tú" is in the ranking.
                const viewer = yield readViewer(widgetApi, log);
                if (bool("multibranding", false)) {
                    const brands = readBrands(attr);
                    const fallbackKind = attr("brandfallback") || "theme";
                    const fallback = fallbackKind === "manual" ? manual : match;
                    const groupNames = yield loadGroupNames(http, baseUrl, tokenFirst, brands, log);
                    match = resolveBrand({
                        brands, viewer, groupNames,
                        preview: Math.max(0, Math.floor(num("brandpreview", 0))),
                        fallback, surface: scheme, log,
                    });
                }
                applyBrand(root, match);
                // ── People ──
                //
                // The admin pastes a pool, not a podium. Everyone in it is resolved and
                // everyone in it appears; the draw decides which three are on top (see
                // `drawPodium`), so the same configuration can show a different three
                // without anyone editing it.
                const ids = attr("topuserids").split(",").map(s => s.trim()).filter(Boolean).slice(0, MAX_POOL);
                const canFetch = !!baseUrl && (!!apiToken || authMode !== "token");
                const pool = [];
                if (canFetch && ids.length) {
                    const found = yield Promise.all(ids.map(id => fetchUserById(http, baseUrl, id, tokenFirst)));
                    for (let i = 0; i < found.length; i++) {
                        if (!found[i]) {
                            log(`user ${ids[i]} could not be resolved — skipped`);
                            continue;
                        }
                        pool.push(found[i]);
                    }
                }
                else if (ids.length) {
                    log("no base URL or token — falling back to demo people");
                }
                const drawMode = (attr("podiumdraw") || "shuffle");
                const drawSeed = `${attr("drawseed")}|${ids.join(",")}`;
                const drawn = drawPodium(pool.length, drawMode, drawSeed, MAX_FEATURED);
                const featured = drawn.map(i => pool[i]).filter(Boolean);
                const others = restOfPool(pool, drawn);
                log("draw", drawMode, `— pool ${pool.length}, podium`, featured.map(p => p.name).join(" / ") || "(none)");
                // Podium portraits are 92px and /users only returns a 48px icon, so the
                // public profile is worth one extra request — but only for the three who
                // are actually shown at that size.
                for (const p of featured) {
                    if (!canFetch)
                        break;
                    const prof = yield fetchPublicProfile(http, baseUrl, p.id, sessionFirst);
                    if (prof === null || prof === void 0 ? void 0 : prof.avatar)
                        p.avatar = prof.avatar;
                    if (!p.position && (prof === null || prof === void 0 ? void 0 : prof.position))
                        p.position = prof.position;
                    if (!p.department && (prof === null || prof === void 0 ? void 0 : prof.department))
                        p.department = prof.department;
                    p.avatar = hiResAvatar(p.avatar, 200);
                }
                // Any unfilled slot becomes a demo peer, so the podium is never short.
                // These take names from the front of the pool and `buildField` fills from
                // `featured.length` onward, so no two rows can show the same name.
                if (featured.length < MAX_FEATURED) {
                    for (const p of syntheticPeople(MAX_FEATURED - featured.length, featured.length)) {
                        featured.push(p);
                    }
                }
                // ── The viewer ──
                //
                // Adding the logged-in person to the field is what makes the XP chart a
                // comparison and the catch-up button a request. If they are already in
                // the configured pool they are simply flagged; otherwise they join as an
                // extra participant, mid-field by construction (see `buildField`).
                if (bool("showviewer", true)) {
                    const already = featured.concat(others).filter(p => p.id && p.id === viewer.id)[0];
                    if (already) {
                        already.isViewer = true;
                        log("viewer is in the configured pool —", already.name);
                    }
                    else {
                        let me = null;
                        if (canFetch && viewer.id)
                            me = yield fetchUserById(http, baseUrl, viewer.id, sessionFirst);
                        if (me) {
                            me.avatar = hiResAvatar(me.avatar, 120);
                            me.isViewer = true;
                            others.push(me);
                            log("viewer joined the field —", me.name);
                        }
                        else {
                            // No session (editor preview, logged-out render, failed lookup) —
                            // a generic "Tú" row still demonstrates the comparison, and is
                            // clearly not claiming to be a real person.
                            others.push({
                                id: "", name: S.you, avatar: "", position: "", department: "",
                                synthetic: true, isViewer: true,
                            });
                            log("viewer could not be resolved — showing a generic “Tú” row");
                        }
                    }
                }
                // Capped so the peer names never wrap the pool and start repeating.
                const fillerCount = Math.max(0, Math.min(FILLER_POOL - featured.length, Math.round(num("fillercount", 5))));
                const learners = buildField(featured, others, fillerCount);
                const realCount = featured.concat(others).filter(p => !p.synthetic).length;
                log("field", learners.length, "learners;", realCount, "real");
                // ── Render ──
                const opts = {
                    drilldown: bool("showdrilldown", true),
                    badges: bool("showbadges", true),
                    streak: bool("showstreak", true),
                };
                const showPodium = bool("showpodium", true);
                const showTier = bool("showtierbar", true);
                const showSwitcher = bool("showmetricswitcher", true);
                const validMetric = (v) => v === "courses" || v === "hours" || v === "xp" || v === "streak";
                const startMetric = attr("defaultmetric");
                let metric = validMetric(startMetric) ? startMetric : "courses";
                const showCta = bool("showcta", true);
                const ctaLabel = attr("ctalabel") || S.ctaAction;
                const ctaUrl = attr("ctaurl");
                const viewerKey = (learners.filter(l => l.person.isViewer)[0] || { key: "" }).key;
                let ranked = rank(learners, metric);
                /** The chart itself. Which shape appears is a property of the metric, not
                 *  of the render call — see `CHART_KIND`. */
                const area = (m) => {
                    if (CHART_KIND[m] === "lines") {
                        // Lines are a comparison, so they plot the whole field including the
                        // podium — leaving the leaders out would remove the thing the viewer
                        // is measuring themselves against.
                        return lines(ranked, viewerKey);
                    }
                    return race(showPodium ? ranked.slice(3) : ranked, m, opts);
                };
                const gapNow = () => gapAhead(learners, metric);
                const paint = () => {
                    body.innerHTML = `
          ${header(match.label, metric, showSwitcher)}
          <div class="${(/* inlined export .P */"csl")}-charts">
            ${showPodium ? podium(ranked.slice(0, 3), metric, showTier, opts.badges) : ""}
            ${caption(metric)}
            <div class="${(/* inlined export .P */"csl")}-area" data-kind="${CHART_KIND[metric]}">${area(metric)}</div>
            ${showCta ? catchUp(gapNow(), metric, ctaLabel, ctaUrl) : ""}
          </div>
          ${bool("showdemonote", true) ? footnote() : ""}
          ${debug ? `<pre class="${(/* inlined export .P */"csl")}-dbg">${esc(logs.join("\n"))}</pre>` : ""}`;
                    measureLines();
                };
                /**
                 * SVG cannot express "dash me by my own length" in CSS, so the draw-on
                 * animation needs the measured path length written back as a custom
                 * property. Guarded because `getTotalLength` does not exist in every
                 * rendering context (jsdom, for one), and a missing measurement must
                 * leave a fully drawn line rather than an invisible one.
                 */
                function measureLines() {
                    const paths = Array.prototype.slice.call(body.querySelectorAll(`.${(/* inlined export .P */"csl")}-ln`));
                    paths.forEach((p, i) => {
                        if (typeof p.getTotalLength !== "function")
                            return;
                        let len = 0;
                        try {
                            len = p.getTotalLength();
                        }
                        catch (_) {
                            return;
                        }
                        if (!len)
                            return;
                        p.style.setProperty("--len", `${Math.ceil(len)}`);
                        p.setAttribute("data-len", "1");
                        const grp = p.parentElement;
                        if (grp)
                            grp.style.setProperty("--i", String(i));
                    });
                }
                paint();
                // ── Reveal ──
                // Staggered entry fires when the widget is actually on screen; a
                // leaderboard that animated in while scrolled past has animated for
                // nobody.
                //
                // `rafId` is declared before the reveal path rather than next to
                // `countUp`: without IntersectionObserver the reveal runs immediately,
                // and a `let` declared further down is still in its temporal dead zone at
                // that point.
                let rafId = 0;
                const charts = () => body.querySelector(`.${(/* inlined export .P */"csl")}-charts`);
                let observer = null;
                const reveal = () => {
                    const c = charts();
                    if (c)
                        c.classList.add(`${(/* inlined export .P */"csl")}-reveal`);
                    countUp();
                };
                if (animate && typeof IntersectionObserver === "function") {
                    observer = new IntersectionObserver(entries => {
                        for (const e of entries) {
                            if (e.isIntersecting) {
                                reveal();
                                observer === null || observer === void 0 ? void 0 : observer.disconnect();
                                observer = null;
                            }
                        }
                    }, { threshold: 0.2 });
                    observer.observe(root);
                }
                else {
                    reveal();
                }
                // ── Count-up ──
                // Values render final in the HTML and are only then rewound to 0, so a
                // script that dies mid-flight still leaves a correct chart on screen.
                function countUp() {
                    if (!animate)
                        return;
                    const nodes = Array.prototype.slice.call(body.querySelectorAll(`.${(/* inlined export .P */"csl")}-num`));
                    const targets = nodes.map(n => ({
                        n,
                        to: Number(n.getAttribute("data-count")) || 0,
                        dec: Number(n.getAttribute("data-dec")) || 0,
                    }));
                    const t0 = performance.now();
                    const dur = 780;
                    const step = (t) => {
                        const k = Math.min(1, (t - t0) / dur);
                        const eased = 1 - Math.pow(1 - k, 3);
                        for (const x of targets) {
                            x.n.textContent = (x.to * eased).toLocaleString("es", {
                                minimumFractionDigits: x.dec, maximumFractionDigits: x.dec,
                            });
                        }
                        if (k < 1)
                            rafId = requestAnimationFrame(step);
                    };
                    rafId = requestAnimationFrame(step);
                }
                // ── Metric switch ──
                //
                // Two different transitions, because there are two different kinds of
                // change.
                //
                // Between the three row charts (cursos / horas / racha) the *people* stay
                // and only their order and their middles change, so rows are moved rather
                // than re-rendered: each node keeps its identity, gets measured before and
                // after, is put back where it was and released (FLIP). That is what makes
                // the ranking visibly race instead of silently snapping — and it is why an
                // open drilldown travels with its person instead of closing.
                //
                // To or from the XP lines there are no rows to move, so that one
                // transition rebuilds the chart area behind a fade. Pretending otherwise
                // would mean animating nodes into nodes they have nothing to do with.
                function switchMetric(next) {
                    if (next === metric)
                        return;
                    const prev = metric;
                    metric = next;
                    const wrap = body.querySelector(`.${(/* inlined export .P */"csl")}-area`);
                    const list = body.querySelector(`.${(/* inlined export .P */"csl")}-race`);
                    const before = new Map();
                    const rows = list
                        ? Array.prototype.slice.call(list.children)
                        : [];
                    for (const r of rows)
                        before.set(r.getAttribute("data-key") || "", r.getBoundingClientRect().top);
                    ranked = rank(learners, metric);
                    // The podium is a different shape per rank, so it is rebuilt; the row
                    // list is the part that animates.
                    const podWrap = body.querySelector(`.${(/* inlined export .P */"csl")}-podium`);
                    if (podWrap && showPodium) {
                        podWrap.outerHTML = podium(ranked.slice(0, 3), metric, showTier, opts.badges);
                    }
                    const capEl = body.querySelector(`.${(/* inlined export .P */"csl")}-cap`);
                    if (capEl)
                        capEl.outerHTML = caption(metric);
                    const sameShape = isRowChart(prev) && isRowChart(metric) && !!list;
                    if (wrap)
                        wrap.setAttribute("data-kind", CHART_KIND[metric]);
                    if (!sameShape) {
                        if (wrap) {
                            wrap.innerHTML = area(metric);
                            measureLines();
                            // Re-arm the entry animation for the chart that just appeared: the
                            // reveal class lives on the container, so it has to be taken off
                            // and put back for the new children to run it.
                            const c = charts();
                            if (animate && c) {
                                c.classList.remove(`${(/* inlined export .P */"csl")}-reveal`);
                                void c.offsetWidth; // force reflow, or the class never left
                                c.classList.add(`${(/* inlined export .P */"csl")}-reveal`);
                            }
                        }
                    }
                    else if (list) {
                        const byKey = new Map();
                        for (const r of rows)
                            byKey.set(r.getAttribute("data-key") || "", r);
                        const tail = showPodium ? ranked.slice(3) : ranked;
                        const max = Math.max(...tail.map(l => metricValue(l, metric)), 0);
                        const wanted = new Set(tail.map(l => keyOf(l)));
                        list.setAttribute("data-kind", CHART_KIND[metric]);
                        // Membership changes, not just order: switching metric can promote a
                        // row onto the podium and drop a podium person into the list. A row
                        // whose person is now on the podium has to go, and a newcomer has to
                        // be built — reusing whatever happened to be there would leave a row
                        // showing another person's numbers.
                        for (const r of rows) {
                            if (!wanted.has(r.getAttribute("data-key") || ""))
                                r.remove();
                        }
                        tail.forEach((l, i) => {
                            const key = keyOf(l);
                            let row = byKey.get(key) || null;
                            if (!row) {
                                const holder = document.createElement("ol");
                                holder.innerHTML = raceRow(l, i + 1, max, metric, opts);
                                row = holder.firstElementChild;
                                if (!row)
                                    return;
                            }
                            list.appendChild(row); // reorder in place
                            row.style.setProperty("--i", String(i));
                            const rankEl = row.querySelector(`.${(/* inlined export .P */"csl")}-rank`);
                            if (rankEl)
                                rankEl.textContent = String(i + 1);
                            // The whole middle is swapped, because the *shape* may have changed
                            // (a bar becomes a stack becomes a grid) and not merely its size.
                            // The drilldown panel and the open state live outside this node, so
                            // they survive untouched.
                            const bodyEl = row.querySelector(`.${(/* inlined export .P */"csl")}-row-body`);
                            if (bodyEl)
                                bodyEl.innerHTML = rowBody(l, metric, max, opts);
                        });
                        if (animate) {
                            const moved = Array.prototype.slice.call(list.children);
                            for (const r of moved) {
                                const key = r.getAttribute("data-key") || "";
                                const from = before.get(key);
                                if (from == null)
                                    continue;
                                const delta = from - r.getBoundingClientRect().top;
                                if (!delta)
                                    continue;
                                r.setAttribute("data-flip", "1");
                                r.style.transform = `translateY(${delta}px)`;
                            }
                            requestAnimationFrame(() => {
                                for (const r of moved) {
                                    if (r.getAttribute("data-flip") !== "1")
                                        continue;
                                    r.setAttribute("data-flip", "2");
                                    r.style.transform = "";
                                }
                                window.setTimeout(() => {
                                    for (const r of moved)
                                        r.removeAttribute("data-flip");
                                }, 480);
                            });
                        }
                    }
                    // The gap is in the units of whatever is on screen, so it is rewritten
                    // with the chart rather than left saying "2 cursos" under an XP view.
                    updateCta();
                    // Tabs
                    const tabs = Array.prototype.slice.call(body.querySelectorAll(`.${(/* inlined export .P */"csl")}-tab`));
                    for (const t of tabs) {
                        const on = t.getAttribute("data-metric") === metric;
                        t.classList.toggle(`${(/* inlined export .P */"csl")}-tab-on`, on);
                        t.setAttribute("aria-selected", String(on));
                    }
                    moveInk();
                    if (rafId)
                        cancelAnimationFrame(rafId);
                    countUp();
                }
                /** Keeps the catch-up sentence true for the metric on screen. */
                function updateCta() {
                    const cta = body.querySelector(`.${(/* inlined export .P */"csl")}-cta`);
                    if (!cta)
                        return;
                    const info = gapNow();
                    const gapEl = cta.querySelector(`.${(/* inlined export .P */"csl")}-cta-gap`);
                    if (gapEl)
                        gapEl.textContent = gapText(info, metric);
                    const rankEl = cta.querySelector(`.${(/* inlined export .P */"csl")}-cta-rank`);
                    if (rankEl && info)
                        rankEl.textContent = S.ctaRankOf(info.rank, info.total);
                    cta.setAttribute("data-done", info && info.rank === 1 ? "1" : "0");
                }
                /** The sliding pill behind the active tab. Measured rather than computed
                 *  from an index, because the tab labels are different widths. */
                function moveInk() {
                    const ink = body.querySelector(`.${(/* inlined export .P */"csl")}-tab-ink`);
                    const on = body.querySelector(`.${(/* inlined export .P */"csl")}-tab-on`);
                    if (!ink || !on)
                        return;
                    ink.style.width = `${on.offsetWidth}px`;
                    ink.style.transform = `translateX(${on.offsetLeft}px)`;
                }
                // Fonts can land after first paint and shift the tabs, so re-measure.
                requestAnimationFrame(moveInk);
                window.setTimeout(moveInk, 350);
                // ── Drilldown ──
                function toggleRow(row) {
                    const key = row.getAttribute("data-key") || "";
                    const panel = row.querySelector(`.${(/* inlined export .P */"csl")}-dd`);
                    const main = row.querySelector(`.${(/* inlined export .P */"csl")}-row-main`);
                    if (!panel)
                        return;
                    const open = row.getAttribute("data-open") === "1";
                    if (open) {
                        panel.hidden = true;
                        panel.innerHTML = "";
                        row.removeAttribute("data-open");
                        main === null || main === void 0 ? void 0 : main.setAttribute("aria-expanded", "false");
                        return;
                    }
                    const learner = learners.filter(l => keyOf(l) === key)[0];
                    if (!learner)
                        return;
                    panel.innerHTML = drilldown(learner);
                    panel.hidden = false;
                    row.setAttribute("data-open", "1");
                    main === null || main === void 0 ? void 0 : main.setAttribute("aria-expanded", "true");
                }
                /** The XP chart's equivalent of a drilldown: one shared panel under the
                 *  lines, because the lines cross and a per-person panel would have
                 *  nowhere sensible to open. Clicking the same line again closes it. */
                function toggleLine(key) {
                    const panel = body.querySelector(`.${(/* inlined export .P */"csl")}-lines-dd`);
                    if (!panel || !opts.drilldown)
                        return;
                    if (panel.getAttribute("data-key") === key) {
                        panel.hidden = true;
                        panel.innerHTML = "";
                        panel.removeAttribute("data-key");
                        return;
                    }
                    const learner = learners.filter(l => keyOf(l) === key)[0];
                    if (!learner)
                        return;
                    panel.innerHTML = drilldown(learner);
                    panel.hidden = false;
                    panel.setAttribute("data-key", key);
                }
                /** Raise one line and push the rest back. Attribute-driven rather than
                 *  CSS `:has`, which is still too new to rely on inside a host page we do
                 *  not control. */
                function emphasize(grp) {
                    const wrap = body.querySelector(`.${(/* inlined export .P */"csl")}-lines`);
                    if (!wrap)
                        return;
                    const all = Array.prototype.slice.call(wrap.querySelectorAll(`.${(/* inlined export .P */"csl")}-lngrp`));
                    for (const g of all)
                        g.classList.remove(`${(/* inlined export .P */"csl")}-ln-on`);
                    if (grp) {
                        grp.classList.add(`${(/* inlined export .P */"csl")}-ln-on`);
                        wrap.setAttribute("data-on", "1");
                    }
                    else {
                        wrap.removeAttribute("data-on");
                    }
                }
                const onOver = (ev) => {
                    const t = ev.target;
                    if (!t || typeof t.closest !== "function")
                        return;
                    const grp = t.closest(`.${(/* inlined export .P */"csl")}-lngrp`);
                    if (grp) {
                        emphasize(grp);
                        return;
                    }
                    // Leaving the chart entirely is the only thing that clears it — moving
                    // between two lines should hand off, not flicker through neutral.
                    if (!t.closest(`.${(/* inlined export .P */"csl")}-lines-svg`))
                        emphasize(null);
                };
                const onCatchUp = (ev) => {
                    const info = gapNow();
                    const detail = {
                        metric,
                        gap: info ? info.gap : 0,
                        rank: info ? info.rank : 0,
                        total: info ? info.total : learners.length,
                        target: info ? info.target.person.name : "",
                    };
                    // Dispatched whether or not a URL is configured, so a page that hosts
                    // the course grid can scroll to it (or open its own filter) instead of
                    // navigating away. When a URL *is* set the link's default is left
                    // alone, so the event and the navigation both happen.
                    host.dispatchEvent(new CustomEvent("cornerstone-learning:catchup", {
                        detail, bubbles: true, composed: true,
                    }));
                    log("catch-up pressed —", JSON.stringify(detail));
                    if (!ctaUrl) {
                        const btn = ev.target.closest(`.${(/* inlined export .P */"csl")}-cta-btn`);
                        btn === null || btn === void 0 ? void 0 : btn.setAttribute("data-pulse", "1");
                        window.setTimeout(() => btn === null || btn === void 0 ? void 0 : btn.removeAttribute("data-pulse"), 600);
                    }
                };
                const onClick = (ev) => {
                    const target = ev.target;
                    if (!target || typeof target.closest !== "function")
                        return;
                    const tab = target.closest(`.${(/* inlined export .P */"csl")}-tab`);
                    if (tab) {
                        const m = tab.getAttribute("data-metric") || "";
                        if (validMetric(m))
                            switchMetric(m);
                        return;
                    }
                    if (target.closest(`[data-cta="1"]`)) {
                        onCatchUp(ev);
                        return;
                    }
                    const grp = target.closest(`.${(/* inlined export .P */"csl")}-lngrp`);
                    if (grp) {
                        toggleLine(grp.getAttribute("data-key") || "");
                        return;
                    }
                    // Avatar and name are real profile links; opening the drilldown instead
                    // would break the hovercard affordance Staffbase users expect.
                    if (target.closest(`.${(/* inlined export .P */"csl")}-avlink`) || target.closest("a[data-uid]"))
                        return;
                    if (!opts.drilldown)
                        return;
                    const main = target.closest(`.${(/* inlined export .P */"csl")}-row-main`);
                    if (!main)
                        return;
                    const row = main.closest(`.${(/* inlined export .P */"csl")}-row`);
                    if (row)
                        toggleRow(row);
                };
                const onKey = (ev) => {
                    if (ev.key !== "Enter" && ev.key !== " ")
                        return;
                    const target = ev.target;
                    if (!target || typeof target.closest !== "function")
                        return;
                    const grp = target.closest(`.${(/* inlined export .P */"csl")}-lngrp`);
                    if (grp) {
                        ev.preventDefault();
                        toggleLine(grp.getAttribute("data-key") || "");
                        return;
                    }
                    const main = target.closest(`.${(/* inlined export .P */"csl")}-row-main[role="button"]`);
                    if (!main)
                        return;
                    ev.preventDefault();
                    const row = main.closest(`.${(/* inlined export .P */"csl")}-row`);
                    if (row)
                        toggleRow(row);
                };
                // Keyboard focus moves the emphasis too, so tabbing through the lines
                // tells the same story as hovering them.
                const onFocusIn = (ev) => {
                    const t = ev.target;
                    if (!t || typeof t.closest !== "function")
                        return;
                    emphasize(t.closest(`.${(/* inlined export .P */"csl")}-lngrp`));
                };
                body.addEventListener("click", onClick);
                body.addEventListener("keydown", onKey);
                body.addEventListener("mouseover", onOver);
                body.addEventListener("focusin", onFocusIn);
                window.addEventListener("resize", moveInk);
                this._cslCleanup = () => {
                    body.removeEventListener("click", onClick);
                    body.removeEventListener("keydown", onKey);
                    body.removeEventListener("mouseover", onOver);
                    body.removeEventListener("focusin", onFocusIn);
                    window.removeEventListener("resize", moveInk);
                    if (rafId)
                        cancelAnimationFrame(rafId);
                    observer === null || observer === void 0 ? void 0 : observer.disconnect();
                };
            });
        }
        disconnectedCallback() {
            const self = this;
            if (self._cslCleanup) {
                try {
                    self._cslCleanup();
                }
                catch (_) { /* ignore */ }
            }
            self._cslCleanup = undefined;
        }
        static get observedAttributes() {
            return ATTRS;
        }
    };
};
const ATTRS = [
    "apitoken", "baseurl", "authmode", "topuserids", "podiumdraw", "drawseed",
    "showviewer", "fillercount", "defaultmetric",
    "showmetricswitcher", "showpodium", "showtierbar", "showbadges", "showstreak",
    "showdrilldown", "showcta", "ctalabel", "ctaurl",
    "colorscheme", "multibranding", "brandfallback", "brandpreview",
    "usethemecolors", "primarycolor", "accentcolor", "animate", "showdemonote", "debugmode",
].concat((() => {
    const out = [];
    for (let i = 1; i <= (/* inlined export .MAX_BRANDS */4); i++) {
        out.push(`brand${i}group`, `brand${i}primary`, `brand${i}accent`, `brand${i}label`);
    }
    return out;
})());
// ── Block registration ───────────────────────────────────────────────────────
const blockDefinition = {
    name: "cornerstone-learning",
    label: "Cornerstone Learning Leaderboard",
    attributes: ATTRS,
    factory,
    configurationSchema,
    uiSchema,
    blockLevel: "block",
    iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzEgMTcxIj48cmVjdCB3aWR0aD0iMTcxIiBoZWlnaHQ9IjE3MSIgcng9IjM4IiBmaWxsPSIjMEIwRDEyIi8+PHJlY3QgeD0iMjgiIHk9IjEwMCIgd2lkdGg9IjExNSIgaGVpZ2h0PSIxNCIgcng9IjciIGZpbGw9IiM3QzVDRkYiLz48cmVjdCB4PSIyOCIgeT0iMTIyIiB3aWR0aD0iNzgiIGhlaWdodD0iMTQiIHJ4PSI3IiBmaWxsPSIjN0M1Q0ZGIiBvcGFjaXR5PSIuNiIvPjxyZWN0IHg9IjI4IiB5PSI3OCIgd2lkdGg9IjUyIiBoZWlnaHQ9IjE0IiByeD0iNyIgZmlsbD0iIzNEREM5NyIgb3BhY2l0eT0iLjgiLz48Y2lyY2xlIGN4PSI4NSIgY3k9IjQ4IiByPSIyMCIgZmlsbD0iIzNEREM5NyIvPjwvc3ZnPg==",
};
window.defineBlock({ blockDefinition, author: "Staffbase", version: "1.0.0" });

/******/ })()
;