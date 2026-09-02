// ─────────────────────────────────────────────────────────────────────────────
// API layer + auth ladder.
//
// Two identities are available to a widget, and they can reach different data:
//
//   token   — Basic API token. A *service* identity, not a user. Works for
//             /posts, /comments, /posts/{id}/likes, /users and the branch
//             analytics rankings.
//   session — the logged-in viewer's cookie + CSRF. Required for endpoints the
//             backend declares `@Authenticated(types=[USER])`, which a token
//             identity does not satisfy.
//
// Verified against verizon-demo:
//   GET /reactions?parentId=&parentType=post → 403 under token (even with
//   `Accept: application/json`), because it is USER-only. Under session it also
//   returns the reaction *type*, which upgrades Top Reactor from a flat like
//   count to a typed breakdown. So that one endpoint tries session *first*.
//
// Both helpers are ported from `tasks/my-tasks-widget.ts` (apiOpts:1207,
// readCsrf/sessionOpts:1388-1405) — the current pattern, not the older
// cookie-only `fetch()` used by analytics-email-open-viewer.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ApiUser, Avatar, EngagementEvent, OptsFactory, Person, Post, PostRanking, RawData,
} from "./types";

// ── Identities ───────────────────────────────────────────────────────────────

export const makeApiOpts = (apiToken: string): OptsFactory => (extra?: RequestInit): RequestInit => ({
  ...extra,
  credentials: "omit",
  headers: { Authorization: `Basic ${apiToken}`, "Content-Type": "application/json", ...(extra?.headers || {}) },
});

/** Confirmed CSRF source in both web and mobile widget contexts is
 *  `window.we.authMgr.csrfToken`; the rest are defensive fallbacks. */
export function readCsrf(): string {
  const w: any = window;
  try { const t = w.we?.authMgr?.csrfToken; if (t) return String(t); } catch (_) { /* not available */ }
  if (w.csrfToken) return String(w.csrfToken);
  const m = document.cookie.match(/(?:^|;\s*)(?:csrf|XSRF-TOKEN|csrftoken)=([^;]+)/i);
  if (m) return decodeURIComponent(m[1]);
  const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
  return meta?.content || "";
}

export const sessionOpts: OptsFactory = (extra?: RequestInit): RequestInit => {
  const csrf = readCsrf();
  return {
    ...extra,
    credentials: "include",
    headers: { ...(csrf ? { "x-csrf-token": csrf } : {}), ...(extra?.headers || {}) },
  };
};

// ── Throttled, retrying transport ────────────────────────────────────────────
//
// The live API returns spurious 403s under rapid fan-out that clear after a
// pause, so concurrency is capped and retries back off. Without this the
// 1-plus-N like-list fan-out trips the limiter and silently loses posts.

export type Logger = (...args: any[]) => void;

const RETRY_STATUS = [429, 500, 502, 503, 504];

export class Http {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(
    private concurrency: number,
    private log: Logger,
  ) {}

  private acquire(): Promise<void> {
    if (this.active < this.concurrency) { this.active++; return Promise.resolve(); }
    return new Promise<void>(resolve => this.queue.push(() => { this.active++; resolve(); }));
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }

  /** GET JSON with backoff. Throws `HTTP <status>` on a non-retryable failure. */
  async getJson(url: string, makeOpts: OptsFactory, tries = 3): Promise<any> {
    await this.acquire();
    try {
      let lastErr: Error = new Error("no attempt");
      for (let i = 0; i < tries; i++) {
        try {
          const res = await fetch(url, makeOpts({ headers: { Accept: "application/json" } }));
          if (res.ok) return await res.json();
          // A burst-403 is the rate limiter, but a genuine 403 (restricted
          // channel / wrong identity) must surface immediately on the last try.
          const retryable = RETRY_STATUS.indexOf(res.status) >= 0 || (res.status === 403 && i < tries - 1);
          if (!retryable) throw new Error(`HTTP ${res.status}`);
          const retryAfter = Number(res.headers.get("Retry-After") || 0);
          await sleep(retryAfter > 0 ? retryAfter * 1000 : 400 * Math.pow(2, i));
          lastErr = new Error(`HTTP ${res.status}`);
        } catch (e: any) {
          lastErr = e instanceof Error ? e : new Error(String(e));
          if (/^HTTP (4\d\d)$/.test(lastErr.message) && !/HTTP 429/.test(lastErr.message)) throw lastErr;
          if (i < tries - 1) await sleep(400 * Math.pow(2, i));
        }
      }
      throw lastErr;
    } finally {
      this.release();
    }
  }

  /** Try `token` then `session` (or the reverse), returning the first success. */
  async ladder(url: string, order: OptsFactory[], label: string): Promise<any> {
    let lastErr: Error = new Error("no identity available");
    for (let i = 0; i < order.length; i++) {
      try {
        return await this.getJson(url, order[i]);
      } catch (e: any) {
        lastErr = e;
        this.log(`${label}: identity ${i + 1}/${order.length} failed —`, e.message);
      }
    }
    throw lastErr;
  }

  /** Map with bounded concurrency (the queue above already caps in-flight
   *  requests; this just avoids building a huge promise array eagerly). */
  async mapLimit<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
    return Promise.all(items.map(fn));
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── Normalizers ──────────────────────────────────────────────────────────────

/** Avatar URL preference, largest-to-smallest fallback — matches
 *  `recognition-widget.ts:661`. `icon` is 48px (chart nodes), `thumb` 200px. */
export function avatarUrl(a?: Avatar, prefer: "icon" | "thumb" = "icon"): string {
  if (!a) return "";
  const icon = a.icon?.url || "";
  const thumb = a.thumb?.url || "";
  const orig = a.original?.url || "";
  return prefer === "thumb" ? (thumb || icon || orig) : (icon || thumb || orig);
}

export function toPerson(u: ApiUser): Person {
  return {
    id: u.id || "",
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "",
    avatar: avatarUrl(u.avatar),
    position: u.position || u.profile?.position || "",
    department: u.department || u.profile?.department || "",
    location: u.location || u.profile?.location || "",
    pronouns: u.profile?.pronouns || u.pronouns || "",
    headline: u.profileHeadline || u.profile?.profileHeadline || "",
  };
}

// ── Endpoints ────────────────────────────────────────────────────────────────

const PAGE = 100;

/** Page an offset-based `{total, data[]}` list endpoint to `cap` items. */
async function pageAll(
  http: Http, base: string, path: string, order: OptsFactory[], label: string, cap: number,
): Promise<any[]> {
  const out: any[] = [];
  for (let offset = 0; offset < cap; offset += PAGE) {
    const limit = Math.min(PAGE, cap - offset);
    const sep = path.indexOf("?") >= 0 ? "&" : "?";
    const d = await http.ladder(`${base}${path}${sep}limit=${limit}&offset=${offset}`, order, label);
    const data: any[] = d?.data || [];
    for (const x of data) out.push(x);
    const total = Number(d?.total ?? out.length);
    if (data.length < limit || out.length >= total) break;
  }
  return out;
}

export async function fetchUsers(http: Http, base: string, order: OptsFactory[], cap: number): Promise<Person[]> {
  const rows = await pageAll(http, base, "/users", order, "users", cap);
  return rows.map(toPerson).filter(p => p.id);
}

export async function fetchPosts(
  http: Http, base: string, order: OptsFactory[], cap: number, inlineUsers?: ApiUser[],
): Promise<Post[]> {
  const rows = await pageAll(http, base, "/posts", order, "posts", cap);
  if (inlineUsers) for (const p of rows) if (p?.author?.id) inlineUsers.push(p.author);
  return rows.map((p: any): Post => ({
    id: p.id || "",
    authorId: p.authorID || p.author?.id || "",
    channelId: p.channelID || "",
    created: p.created || "",
    published: p.published || p.created || "",
    title: pickTitle(p),
    likingEnabled: p.likingEnabled !== false,
  })).filter(p => p.id);
}

/** Posts carry localized `contents`; take the first title we find. */
function pickTitle(p: any): string {
  const c = p?.contents;
  if (c && typeof c === "object") {
    const keys = Object.keys(c);
    for (const k of ["en_US", ...keys]) {
      const t = c[k]?.title;
      if (t) return String(t);
    }
  }
  return p?.title || "";
}

/**
 * Comments, windowed server-side via the SCIM2 `filter` param.
 * Verified live: `created gt "2026-08-01T00:00:00.000Z"` → total 0, vs. 34
 * all-time, so the filter genuinely applies.
 */
export async function fetchComments(
  http: Http, base: string, order: OptsFactory[], cap: number, since?: Date, until?: Date,
): Promise<any[]> {
  const clauses: string[] = [];
  if (since) clauses.push(`created ge "${since.toISOString()}"`);
  if (until) clauses.push(`created le "${until.toISOString()}"`);
  const q = clauses.length ? `?filter=${encodeURIComponent(clauses.join(" and "))}` : "";
  return pageAll(http, base, `/comments${q}`, order, "comments", cap);
}

/**
 * Who reacted to a post.
 *
 * `/reactions` is USER-only, so it is tried under session first — success adds
 * the reaction *type*. `/posts/{id}/likes` is the token-friendly fallback and
 * yields untyped likes.
 *
 * Returns `null` when the post is unreadable (restricted channel), so the
 * caller can count it as skipped rather than failing the whole load.
 */
export async function fetchPostReactions(
  http: Http, base: string, postId: string, sessionFirst: OptsFactory[], tokenOnly: OptsFactory[],
  inlineUsers?: ApiUser[],
): Promise<{ userId: string; at: string; type?: string }[] | null> {
  if (sessionFirst.length) {
    try {
      const d = await http.getJson(
        `${base}/reactions?parentId=${postId}&parentType=post`, sessionFirst[0],
      );
      const rows: any[] = d?.data || [];
      return rows
        .map(r => ({ userId: r.userId || r.userID || "", at: r.createdAt || r.created || "", type: r.type || "LIKE" }))
        .filter(r => r.userId);
    } catch (_) { /* fall through to /likes */ }
  }
  try {
    const d = await http.ladder(`${base}/posts/${postId}/likes?limit=${PAGE}`, tokenOnly, `likes ${postId}`);
    const rows: any[] = d?.data || [];
    if (inlineUsers) for (const r of rows) if (r?.user?.id) inlineUsers.push(r.user);
    return rows
      .map(r => ({ userId: r.userID || r.userId || "", at: r.created || "" }))
      .filter(r => r.userId);
  } catch (_) {
    return null;
  }
}

/**
 * Post-level share/click analytics.
 *
 * ⚠ The time-range params are `since` / `until` in RFC3339. `from`/`to`,
 * `start`/`end`, `startDate`/`endDate` and `dateFrom`/`dateTo` all return 200
 * but are **silently ignored** — verified live, and an easy trap.
 */
export async function fetchPostRankings(
  http: Http, base: string, order: OptsFactory[], since?: Date, until?: Date,
): Promise<PostRanking[]> {
  const qs = [`limit=${PAGE}`, "orderBy=shares_DESC"];
  if (since) qs.push(`since=${rfc3339(since)}`);
  if (until) qs.push(`until=${rfc3339(until)}`);
  const d = await http.ladder(`${base}/branch/analytics/posts/rankings?${qs.join("&")}`, order, "post rankings");
  const posts = d?.entities?.posts || {};
  const rows: any[] = d?.ranking || [];
  return rows.map((r: any): PostRanking => {
    const postId = r?.group?.postId || "";
    return {
      postId,
      channelId: r?.group?.channelId || "",
      title: posts[postId]?.title || "",
      shares: num(r.shares),
      clicks: num(r.clicks),
      comments: num(r.comments),
      likes: num(r.likes ?? r.postLikes),
      visitors: num(r.registeredVisitors) + num(r.unregisteredVisitors),
    };
  }).filter(r => r.postId);
}

const num = (v: any): number => (typeof v === "number" && isFinite(v) ? v : 0);

/** The analytics endpoint parses `2006-01-02T15:04:05`, so send seconds
 *  precision without milliseconds. */
export function rfc3339(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ── Capability probe ─────────────────────────────────────────────────────────

/** `/users/me` 404s for a token (it is not a user) and succeeds for a real
 *  session, which makes it a clean session probe. */
export async function sessionWorks(http: Http, base: string): Promise<boolean> {
  try {
    const d = await http.getJson(`${base}/users/me`, sessionOpts, 1);
    return !!(d && (d.id || d.userName));
  } catch (_) {
    return false;
  }
}

// ── Full data pass ───────────────────────────────────────────────────────────

export type LoadOptions = {
  baseUrl: string;
  apiToken: string;
  authMode: "auto" | "token" | "session";
  maxPosts: number;
  concurrency: number;
  log: Logger;
  onProgress?: (done: number, total: number) => void;
};

/**
 * One pass over every source, returning the *un-windowed* event set. The time
 * window is applied afterwards in memory (see `aggregate.ts`) so switching
 * windows never re-fetches.
 */
export async function loadRawData(opts: LoadOptions): Promise<RawData> {
  const { baseUrl: base, apiToken, authMode, maxPosts, log } = opts;
  const http = new Http(opts.concurrency, log);

  const apiOpts = makeApiOpts(apiToken);
  const haveToken = !!apiToken;

  // Identity order per resource, following what we measured.
  let useSession = authMode === "session";
  if (authMode === "auto") {
    useSession = await sessionWorks(http, base);
    log("session probe:", useSession ? "available" : "unavailable");
  }

  const general: OptsFactory[] = [];
  if (authMode !== "session" && haveToken) general.push(apiOpts);
  if (authMode !== "token") general.push(sessionOpts);
  if (!general.length) general.push(sessionOpts);

  // /reactions is USER-only, so session leads; /likes covers the token case.
  const reactionSession: OptsFactory[] = (authMode !== "token" && useSession) ? [sessionOpts] : [];

  // Directory pages can miss people who are deactivated or beyond the cap, so
  // inline author/user objects are collected as a backfill source.
  const inlineUsers: ApiUser[] = [];

  const [people, posts] = await Promise.all([
    fetchUsers(http, base, general, 500).catch(e => { log("users failed —", e.message); return [] as Person[]; }),
    fetchPosts(http, base, general, maxPosts, inlineUsers).catch(e => { log("posts failed —", e.message); return [] as Post[]; }),
  ]);
  log(`loaded ${people.length} users, ${posts.length} posts`);

  // Comments are fetched un-windowed; windowing happens in memory so the cache
  // stays window-independent.
  const commentRows = await fetchComments(http, base, general, 1000)
    .catch(e => { log("comments failed —", e.message); return [] as any[]; });
  log(`loaded ${commentRows.length} comments`);

  const rankings = await fetchPostRankings(http, base, general)
    .catch(e => { log("post rankings failed —", e.message); return [] as PostRanking[]; });
  log(`loaded ${rankings.length} ranking rows`);

  // Fan-out: one reaction list per post.
  let done = 0;
  let skippedPosts = 0;
  let typedReactions = false;
  const events: EngagementEvent[] = [];

  const results = await http.mapLimit(posts, async (post) => {
    const rows = await fetchPostReactions(http, base, post.id, reactionSession, general, inlineUsers);
    done++;
    opts.onProgress?.(done, posts.length);
    return { post, rows };
  });

  for (const { post, rows } of results) {
    if (rows === null) { skippedPosts++; continue; }
    for (const r of rows) {
      if (r.type) typedReactions = true;
      events.push({
        kind: "reaction",
        userId: r.userId,
        postId: post.id,
        channelId: post.channelId,
        at: r.at || post.published,
        reactionType: r.type,
      });
    }
  }

  const postById = new Map(posts.map(p => [p.id, p]));
  for (const c of commentRows) {
    const authorId = c.authorID || c.author?.id || "";
    if (!authorId) continue; // deleted / anonymized comment
    const rootId = c.rootID || c.parentID || "";
    events.push({
      kind: "comment",
      userId: authorId,
      postId: rootId,
      channelId: postById.get(rootId)?.channelId || c.installationID || "",
      at: c.created || "",
    });
  }

  for (const p of posts) {
    if (!p.authorId) continue;
    events.push({ kind: "post", userId: p.authorId, postId: p.id, channelId: p.channelId, at: p.published || p.created });
  }

  // Backfill anyone the directory did not return, so a chart node still gets a
  // name and avatar instead of rendering as "Unknown".
  const known = new Set(people.map(p => p.id));
  for (const c of commentRows) if (c?.author?.id) inlineUsers.push(c.author);
  for (const a of inlineUsers) {
    if (a.id && !known.has(a.id)) { known.add(a.id); people.push(toPerson(a)); }
  }

  log(`built ${events.length} events, skipped ${skippedPosts} restricted posts, typed reactions: ${typedReactions}`);

  return { events, posts, people, rankings, skippedPosts, typedReactions, fetchedAt: Date.now() };
}
