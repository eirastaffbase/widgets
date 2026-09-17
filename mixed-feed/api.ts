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

import { ApiChannel, ApiComment, ApiPost, OptsFactory } from "./types";

// ── Identities ───────────────────────────────────────────────────────────────

export const makeApiOpts = (apiToken: string): OptsFactory => (extra?: RequestInit): RequestInit => ({
  ...extra,
  credentials: "omit",
  headers: { Authorization: `Basic ${apiToken}`, Accept: "application/json", ...(extra?.headers || {}) },
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
    headers: { Accept: "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}), ...(extra?.headers || {}) },
  };
};

// ── Transport ────────────────────────────────────────────────────────────────

export type Logger = (...args: any[]) => void;

async function getJson<T>(url: string, opts: RequestInit, log: Logger): Promise<T | null> {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) { log("GET", url, "←", r.status); return null; }
    return (await r.json()) as T;
  } catch (e: any) {
    log("GET", url, "failed —", e && e.message);
    return null;
  }
}

/** Try each identity in order and take the first that answers. Endpoints differ
 *  in which identity they accept, and the useful order is not the same for all
 *  of them, so callers pass the ladder they need. */
async function getJsonAny<T>(url: string, ladder: OptsFactory[], log: Logger, extra?: RequestInit): Promise<T | null> {
  for (const opts of ladder) {
    const out = await getJson<T>(url, opts(extra), log);
    if (out) return out;
  }
  return null;
}

// ── Channels ─────────────────────────────────────────────────────────────────

/** All channels in the branch, keyed by id.
 *
 *  Fetched in one call rather than per-id: the widget needs every configured
 *  channel's `contentType` and localized title before it can classify or label
 *  anything, and the branch-wide list is a single cheap request. */
export async function fetchChannels(
  base: string, ladder: OptsFactory[], log: Logger,
): Promise<Map<string, ApiChannel>> {
  const out = new Map<string, ApiChannel>();
  const d = await getJsonAny<{ data?: ApiChannel[] }>(`${base}/channels?limit=200`, ladder, log);
  for (const c of (d && d.data) || []) if (c && c.id) out.set(c.id, c);
  log(`loaded ${out.size} channels`);
  return out;
}

/** Posts for one channel. Resolves to `[]` rather than rejecting, so a channel
 *  the viewer cannot read degrades to "absent" instead of failing the feed. */
export async function fetchChannelPosts(
  base: string, channelId: string, limit: number, ladder: OptsFactory[], log: Logger,
): Promise<ApiPost[]> {
  const d = await getJsonAny<{ data?: ApiPost[] }>(
    `${base}/channels/${encodeURIComponent(channelId)}/posts?limit=${limit}`, ladder, log,
  );
  return (d && d.data) || [];
}

export async function fetchPost(
  base: string, postId: string, ladder: OptsFactory[], log: Logger,
): Promise<ApiPost | null> {
  return getJsonAny<ApiPost>(`${base}/posts/${encodeURIComponent(postId)}`, ladder, log);
}

// ── Likes ────────────────────────────────────────────────────────────────────
//
// `/reactions` is USER-only, so both calls ride the session. The count endpoint
// returns a typed breakdown; we only surface LIKE.

export async function fetchLikeState(
  base: string, postId: string, viewerId: string, log: Logger,
): Promise<{ count: number; mine: boolean } | null> {
  const q = `parentId=${encodeURIComponent(postId)}&parentType=post`;
  const reqs: Array<Promise<any>> = [getJson<any>(`${base}/reactions-count?${q}`, sessionOpts(), log)];
  if (viewerId) reqs.push(getJson<any>(`${base}/reactions?${q}&userId=${encodeURIComponent(viewerId)}`, sessionOpts(), log));
  const [countJson, mineJson] = await Promise.all(reqs);
  if (!countJson) return null;
  const row = ((countJson.data || []) as any[]).find(x => x && x.type === "LIKE");
  return {
    count: (row && Number(row.count)) || 0,
    mine: ((mineJson && mineJson.data) || []).some((x: any) => x && x.type === "LIKE"),
  };
}

export async function setLike(base: string, postId: string, liked: boolean): Promise<boolean> {
  const q = `parentId=${encodeURIComponent(postId)}&parentType=post`;
  try {
    const r = liked
      ? await fetch(`${base}/reactions`, sessionOpts({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: postId, parentType: "post", type: "LIKE" }),
      }))
      : await fetch(`${base}/reactions?${q}`, sessionOpts({ method: "DELETE" }));
    return r.ok;
  } catch (_) {
    return false;
  }
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

let allCommentsCache: Promise<Map<string, ApiComment[]>> | null = null;

function commentRows(d: any): ApiComment[] {
  if (!d) return [];
  return Array.isArray(d) ? d : (d.data || []);
}

async function fetchAllCommentsGrouped(
  base: string, ladder: OptsFactory[], cap: number, log: Logger,
): Promise<Map<string, ApiComment[]>> {
  const grouped = new Map<string, ApiComment[]>();
  const page = 100;
  for (let offset = 0; offset < cap; offset += page) {
    const d = await getJsonAny<any>(`${base}/comments?limit=${page}&offset=${offset}`, ladder, log);
    const rows = commentRows(d);
    for (const c of rows) {
      const parent = String((c as any).parentID || (c as any).parentId || "");
      if (!parent) continue;
      const list = grouped.get(parent);
      if (list) list.push(c); else grouped.set(parent, [c]);
    }
    const total = (d && typeof d.total === "number") ? d.total : rows.length;
    if (rows.length < page || offset + page >= total) break;
  }
  log(`grouped comments for ${grouped.size} parents`);
  return grouped;
}

export async function fetchComments(
  base: string, postId: string, ladder: OptsFactory[], cap: number, log: Logger,
): Promise<ApiComment[]> {
  const direct = await getJson<any>(
    `${base}/posts/${encodeURIComponent(postId)}/comments?limit=100`, sessionOpts(), log,
  );
  if (direct) return commentRows(direct);

  if (!allCommentsCache) allCommentsCache = fetchAllCommentsGrouped(base, ladder, cap, log);
  const grouped = await allCommentsCache;
  return grouped.get(postId) || [];
}

/** Post a comment as the logged-in viewer. Returns the created row when the API
 *  echoes one, so the caller can render it without a refetch. */
export async function postComment(base: string, postId: string, text: string): Promise<ApiComment | null> {
  const body = JSON.stringify({ text: `<p>${escapeHtml(text)}</p>` });
  try {
    const r = await fetch(`${base}/posts/${encodeURIComponent(postId)}/comments`, sessionOpts({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    // A fresh comment invalidates the bulk fallback cache.
    allCommentsCache = null;
    try { return (await r.json()) as ApiComment; } catch (_) { return null; }
  } catch (_) {
    return null;
  }
}

// ── Posting ──────────────────────────────────────────────────────────────────

/** Create a social post as the logged-in viewer (session + CSRF), so it carries a
 *  real author id and avatar and the viewer can be liked/commented back. */
export async function createPost(
  base: string, channelId: string, locale: string, text: string,
): Promise<ApiPost | null> {
  const html = text.split(/\n{2,}/).map(par => `<p>${escapeHtml(par).replace(/\n/g, "<br>")}</p>`).join("");
  const body = JSON.stringify({
    contents: { [locale]: { title: text.slice(0, 120), content: html } },
    published: true,
    commentingEnabled: true,
    likingEnabled: true,
    notificationChannels: [],
  });
  try {
    const r = await fetch(`${base}/channels/${encodeURIComponent(channelId)}/posts`, sessionOpts({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as ApiPost;
  } catch (_) {
    return null;
  }
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function fetchUser(
  base: string, userId: string, ladder: OptsFactory[], log: Logger,
): Promise<{ name: string; avatarUrl: string } | null> {
  const u = await getJsonAny<any>(`${base}/users/${encodeURIComponent(userId)}`, ladder, log);
  if (!u) return null;
  return {
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || u.userName || "",
    avatarUrl: u.avatar?.icon?.url || u.avatar?.thumb?.url || u.avatar?.original?.url || "",
  };
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
export async function fetchGroupNames(
  base: string, groupIds: string[], ladder: OptsFactory[], log: Logger,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set((groupIds || []).filter(Boolean)));
  if (!unique.length) return out;

  await Promise.all(unique.map(async id => {
    const g = await getJsonAny<any>(`${base}/groups/${encodeURIComponent(id)}`, ladder, log);
    const name = g && (g.name || g.title);
    if (name) out.set(id, String(name));
  }));

  log(`resolved ${out.size}/${unique.length} group name(s)`);
  return out;
}

// ── Shared escaping ──────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
