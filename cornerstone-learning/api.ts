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

import { ApiUser, Avatar, OptsFactory, Person } from "./types";

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
// pause, so concurrency is capped and retries back off.

export type Logger = (...args: any[]) => void;

const RETRY_STATUS = [429, 500, 502, 503, 504];

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

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
          // A burst-403 is the rate limiter, but a genuine 403 (wrong identity)
          // must surface immediately on the last try.
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

  /** Try each identity in turn, returning the first success. */
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
}

// ── Normalizers ──────────────────────────────────────────────────────────────

/** Avatar URL preference, largest-to-smallest fallback. `icon` is 48px,
 *  `thumb` 200px — podium avatars want the bigger one. */
export function avatarUrl(a?: Avatar, prefer: "icon" | "thumb" = "thumb"): string {
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
    synthetic: false,
  };
}

/**
 * Staffbase avatar URLs carry their pixel size in the path
 * (`.../image-48.jpg`). Rewriting it is the difference between a crisp podium
 * portrait and a 48px image stretched to 96.
 */
export function hiResAvatar(url: string, px: number): string {
  if (!url) return "";
  return url.replace(/-(\d{2,4})(\.[a-z]{3,4})(\?|$)/i, (m, n, ext, tail) =>
    Number(n) >= px ? m : `-${px}${ext}${tail}`);
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** One named person. Returns `null` rather than throwing: a mistyped user ID in
 *  the editor degrades that row to a demo peer instead of killing the chart. */
export async function fetchUserById(
  http: Http, base: string, id: string, order: OptsFactory[],
): Promise<Person | null> {
  try {
    const d = await http.ladder(`${base}/users/${encodeURIComponent(id)}`, order, `user ${id}`);
    const p = toPerson(d || {});
    return p.id ? p : null;
  } catch (_) {
    return null;
  }
}

/**
 * `/profiles/public/{id}` returns a 200px square `avatarUrl` where `/users`
 * gives a 48px icon, so it is worth one extra request for the three people who
 * appear at podium size. USER-only, so it is attempted under session first and
 * simply skipped when there is no session.
 */
export async function fetchPublicProfile(
  http: Http, base: string, id: string, order: OptsFactory[],
): Promise<{ avatar?: string; position?: string; department?: string } | null> {
  try {
    const d = await http.ladder(`${base}/profiles/public/${encodeURIComponent(id)}`, order, `profile ${id}`);
    return {
      avatar: d?.avatarUrl || avatarUrl(d?.avatar, "thumb") || "",
      position: d?.position || "",
      department: d?.department || "",
    };
  } catch (_) {
    return null;
  }
}

/**
 * Every group in the branch as an id→name map.
 *
 * Two endpoints, merged: `/groups/search` is the current one but does not
 * return everything, and legacy `/groups` fills the gaps. This is the same
 * two-call merge `tasks/my-tasks-widget.ts` uses, and it exists only so that
 * brand rules can be written as human-readable group *names*.
 */
export async function fetchGroupNames(
  http: Http, base: string, order: OptsFactory[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const nameOf = (g: any): string =>
    g?.config?.localization?.en_US?.title
    || g?.config?.localization?.en_US?.name
    || g?.name
    || "";

  const [searchRes, legacyRes] = await Promise.all([
    http.ladder(`${base}/groups/search?limit=100&sort=name_ASC`, order, "groups/search").catch(() => null),
    http.ladder(`${base}/groups?limit=200`, order, "groups").catch(() => null),
  ]);

  if (searchRes) {
    const rows: any[] = searchRes.entries || searchRes.data || searchRes.results
      || searchRes.items || (Array.isArray(searchRes) ? searchRes : []);
    for (const e of rows) {
      const inner = e?.data || e;
      const name = nameOf(inner);
      if (inner?.id && name && !out.has(inner.id)) out.set(inner.id, name);
    }
  }
  if (legacyRes) {
    for (const g of (legacyRes.data || [])) {
      const name = nameOf(g);
      if (g?.id && name && !out.has(g.id)) out.set(g.id, name);
    }
  }
  return out;
}
