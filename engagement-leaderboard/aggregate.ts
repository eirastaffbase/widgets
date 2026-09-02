// ─────────────────────────────────────────────────────────────────────────────
// Windowing + aggregation.
//
// The whole widget is driven by one `RawData.events` array. Applying a time
// window is a pure in-memory filter, so switching windows re-renders without a
// single new request.
//
// There is no per-user engagement endpoint anywhere in the Staffbase API
// (verified: the analytics `groupBy` enum accepts only `channelId`/`spaceId`,
// and `/branch/analytics/users/rankings` is feature-flag gated), so every
// person-level metric is derived here. The weighting mirrors the product's own
// internal notion of engagement (likes + comments + shares), inverted from a
// post key to a user key.
// ─────────────────────────────────────────────────────────────────────────────

import {
  EngagementEvent, Entry, MetricId, Person, PostRanking, RawData, Tile, UserStats, Window,
} from "./types";

export type Weights = {
  comment: number;
  reaction: number;
  post: number;
  breadthPost: number;
  breadthChannel: number;
};

export const DEFAULT_WEIGHTS: Weights = {
  comment: 3, reaction: 1, post: 5, breadthPost: 2, breadthChannel: 4,
};

export type WindowKey = "all" | "7d" | "30d" | "90d" | "12m" | "custom";

/** Resolve a window key to absolute bounds. `all` spans everything. */
export function resolveWindow(key: WindowKey, now: number, customSince?: string, customUntil?: string): Window {
  const day = 86400000;
  const spans: { [k: string]: number } = { "7d": 7 * day, "30d": 30 * day, "90d": 90 * day, "12m": 365 * day };
  if (key === "custom") {
    const s = Date.parse(customSince || "");
    let u = Date.parse(customUntil || "");
    // A bare YYYY-MM-DD parses to midnight, which would silently exclude the
    // whole of the end day the viewer just picked. Run it to the last instant.
    if (isFinite(u) && /^\d{4}-\d{2}-\d{2}$/.test((customUntil || "").trim())) u += day - 1;
    return { since: isFinite(s) ? s : 0, until: isFinite(u) ? u : now };
  }
  if (key === "all" || !spans[key]) return { since: 0, until: now };
  return { since: now - spans[key], until: now };
}

/** The immediately preceding equal-length window — what Rising Star compares
 *  against. An all-time window has no meaningful predecessor. */
export function previousWindow(w: Window): Window | null {
  const len = w.until - w.since;
  if (!isFinite(len) || len <= 0 || w.since === 0) return null;
  return { since: w.since - len, until: w.since };
}

const inWindow = (e: EngagementEvent, w: Window): boolean => {
  const t = Date.parse(e.at);
  return isFinite(t) && t >= w.since && t <= w.until;
};

// ── Aggregation ──────────────────────────────────────────────────────────────

export function aggregate(events: EngagementEvent[], w: Window, exclude: Set<string>): Map<string, UserStats> {
  const out = new Map<string, UserStats>();
  const posts = new Map<string, Set<string>>();
  const channels = new Map<string, Set<string>>();
  // Who authored which post, so reactions/comments can be credited to the
  // author as "received".
  const authorOf = new Map<string, string>();
  for (const e of events) if (e.kind === "post") authorOf.set(e.postId, e.userId);

  const get = (id: string): UserStats => {
    let s = out.get(id);
    if (!s) {
      s = {
        userId: id, comments: 0, reactionsGiven: 0, reactionsReceived: 0,
        commentsReceived: 0, postsAuthored: 0, distinctPosts: 0, distinctChannels: 0,
        lastActiveAt: 0, reactionTypes: {},
      };
      out.set(id, s);
      posts.set(id, new Set());
      channels.set(id, new Set());
    }
    return s;
  };

  for (const e of events) {
    if (!e.userId || exclude.has(e.userId)) continue;
    if (!inWindow(e, w)) continue;

    const s = get(e.userId);
    const t = Date.parse(e.at);
    if (isFinite(t) && t > s.lastActiveAt) s.lastActiveAt = t;

    if (e.kind === "comment") s.comments++;
    else if (e.kind === "post") s.postsAuthored++;
    else {
      s.reactionsGiven++;
      if (e.reactionType) s.reactionTypes[e.reactionType] = (s.reactionTypes[e.reactionType] || 0) + 1;
    }

    // Breadth counts only *engagement* (not authoring your own posts), so a
    // prolific author doesn't automatically win the breadth-weighted metric.
    if (e.kind !== "post") {
      if (e.postId) posts.get(e.userId)!.add(e.postId);
      if (e.channelId) channels.get(e.userId)!.add(e.channelId);
    }

    // Credit the post's author on the receiving side.
    const author = authorOf.get(e.postId);
    if (author && author !== e.userId && !exclude.has(author)) {
      const a = get(author);
      if (e.kind === "comment") a.commentsReceived++;
      else if (e.kind === "reaction") a.reactionsReceived++;
    }
  }

  for (const [id, s] of out) {
    s.distinctPosts = posts.get(id)?.size || 0;
    s.distinctChannels = channels.get(id)?.size || 0;
  }
  return out;
}

export const activityScore = (s: UserStats): number => s.comments + s.reactionsGiven + s.postsAuthored;

export const engagementScore = (s: UserStats, w: Weights): number =>
  w.comment * s.comments +
  w.reaction * s.reactionsGiven +
  w.post * s.postsAuthored +
  w.breadthPost * s.distinctPosts +
  w.breadthChannel * s.distinctChannels;

// ── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Deterministic ordering: value, then a secondary signal, then recency, then
 * name. Without the tail-breakers the leaderboard would reshuffle between
 * renders whenever people tie — which is common on low-volume windows.
 */
function rank(
  stats: Map<string, UserStats>,
  people: Map<string, Person>,
  value: (s: UserStats) => number,
  secondary: (s: UserStats) => number,
  topN: number,
): Entry[] {
  const rows: Array<{ s: UserStats; p: Person; v: number }> = [];
  for (const [id, s] of stats) {
    const v = value(s);
    if (v <= 0) continue;
    // Deleted/system authors resolve to nothing — omitting them is better than
    // an "Unknown" row that can't be clicked through to a profile.
    const p = people.get(id);
    if (!p || !p.name) continue;
    rows.push({ s, p, v });
  }
  rows.sort((a, b) =>
    b.v - a.v ||
    secondary(b.s) - secondary(a.s) ||
    b.s.lastActiveAt - a.s.lastActiveAt ||
    a.p.name.localeCompare(b.p.name),
  );
  return rows.slice(0, topN).map(r => ({ person: r.p, value: r.v }));
}

export type BuildOptions = {
  raw: RawData;
  window: Window;
  weights: Weights;
  topN: number;
  metrics: MetricId[];
  exclude: Set<string>;
  autoWiden: boolean;
  /** Rankings fetched for the selected window (server-side filtered). */
  rankings: PostRanking[];
  /** All-time rankings, used when the advocacy tile has to widen. */
  rankingsAllTime: PostRanking[];
  t: (key: string) => string;
  colors: { comment: string; reaction: string; post: string; breadth: string };
};

/**
 * Build every requested tile.
 *
 * Auto-widen is deliberately **per tile**: on a demo branch the share data can
 * be healthy for the last 90 days while comments and reactions are months old,
 * so a single global widen would either discard good share data or leave most
 * tiles blank. Each tile therefore reports the window it actually used.
 */
export function buildTiles(o: BuildOptions): Tile[] {
  const people = new Map(o.raw.people.map(p => [p.id, p]));
  const all: Window = { since: 0, until: Date.now() };

  const primary = aggregate(o.raw.events, o.window, o.exclude);
  let widened: Map<string, UserStats> | null = null;
  const widenedStats = (): Map<string, UserStats> => {
    if (!widened) widened = aggregate(o.raw.events, all, o.exclude);
    return widened;
  };

  const prevW = previousWindow(o.window);
  const prev = prevW ? aggregate(o.raw.events, prevW, o.exclude) : new Map<string, UserStats>();

  const tiles: Tile[] = [];

  /** Rank against the window; if empty and auto-widen is on, retry all-time. */
  const ranked = (
    value: (s: UserStats) => number, secondary: (s: UserStats) => number,
  ): { entries: Entry[]; widened: boolean } => {
    const e = rank(primary, people, value, secondary, o.topN);
    if (e.length || !o.autoWiden) return { entries: e, widened: false };
    return { entries: rank(widenedStats(), people, value, secondary, o.topN), widened: true };
  };

  for (const id of o.metrics) {
    switch (id) {
      case "most_active": {
        const r = ranked(activityScore, s => s.comments);
        const src = r.widened ? widenedStats() : primary;
        // The headline number is a sum, so show what it is a sum of.
        for (const e of r.entries) {
          const s = src.get(e.person.id);
          if (!s) continue;
          e.parts = [
            { label: o.t("part.comments"), value: s.comments, color: o.colors.comment },
            { label: o.t("part.reactions"), value: s.reactionsGiven, color: o.colors.reaction },
            { label: o.t("part.posts"), value: s.postsAuthored, color: o.colors.post },
          ].filter(x => x.value > 0);
        }
        tiles.push(tile(id, o.t("metric.mostActive"), o.t("metric.mostActive.sub"), "podium", r, o.t("unit.actions")));
        break;
      }
      case "most_engaged": {
        const r = ranked(s => engagementScore(s, o.weights), activityScore);
        const src = r.widened ? widenedStats() : primary;
        // Attach the score breakdown so the composition bar can explain the
        // weighted number instead of presenting it as a magic value.
        for (const e of r.entries) {
          const s = src.get(e.person.id);
          if (!s) continue;
          e.parts = [
            { label: o.t("part.comments"), value: o.weights.comment * s.comments, color: o.colors.comment },
            { label: o.t("part.reactions"), value: o.weights.reaction * s.reactionsGiven, color: o.colors.reaction },
            { label: o.t("part.posts"), value: o.weights.post * s.postsAuthored, color: o.colors.post },
            { label: o.t("part.breadth"), value: o.weights.breadthPost * s.distinctPosts + o.weights.breadthChannel * s.distinctChannels, color: o.colors.breadth },
          ].filter(x => x.value > 0);
        }
        tiles.push(tile(id, o.t("metric.mostEngaged"), o.t("metric.mostEngaged.sub"), "podium", r, o.t("unit.points")));
        break;
      }
      case "top_commenter": {
        const r = ranked(s => s.comments, s => s.reactionsGiven);
        tiles.push(tile(id, o.t("metric.topCommenter"), o.t("metric.topCommenter.sub"), "bars", r, o.t("unit.comments")));
        break;
      }
      case "top_reactor": {
        const r = ranked(s => s.reactionsGiven, s => s.comments);
        const src = r.widened ? widenedStats() : primary;
        // A typed donut is only meaningful when session auth resolved reaction
        // types; under token auth every reaction is an untyped LIKE.
        const typed = o.raw.typedReactions && r.entries.length > 0 &&
          Object.keys(src.get(r.entries[0].person.id)?.reactionTypes || {}).length > 1;
        if (typed) {
          for (const e of r.entries) {
            const s = src.get(e.person.id);
            if (!s) continue;
            e.parts = Object.keys(s.reactionTypes).map((k, i) => ({
              label: k, value: s.reactionTypes[k], color: REACTION_COLORS[i % REACTION_COLORS.length],
            }));
          }
        }
        tiles.push(tile(id, o.t("metric.topReactor"), o.t("metric.topReactor.sub"), typed ? "donut" : "bars", r, o.t("unit.reactions")));
        break;
      }
      case "most_appreciated": {
        const r = ranked(s => s.reactionsReceived, s => s.commentsReceived);
        tiles.push(tile(id, o.t("metric.mostAppreciated"), o.t("metric.mostAppreciated.sub"), "bars", r, o.t("unit.received")));
        break;
      }
      case "top_contributor": {
        const r = ranked(s => s.postsAuthored, s => s.reactionsReceived);
        tiles.push(tile(id, o.t("metric.topContributor"), o.t("metric.topContributor.sub"), "bars", r, o.t("unit.posts")));
        break;
      }
      case "rising_star": {
        // Growth, not volume: biggest increase over the preceding window.
        const entries: Entry[] = [];
        if (prevW) {
          const rows: Array<{ p: Person; now: number; before: number }> = [];
          for (const [uid, s] of primary) {
            const p0 = prev.get(uid);
            const before = p0 ? activityScore(p0) : 0;
            const now = activityScore(s);
            const p = people.get(uid);
            if (p && now - before > 0) rows.push({ p, now, before });
          }
          rows.sort((a, b) => (b.now - b.before) - (a.now - a.before) || b.now - a.now || a.p.name.localeCompare(b.p.name));
          for (const r of rows.slice(0, o.topN)) entries.push({ person: r.p, value: r.now, previous: r.before });
        }
        tiles.push(tile(id, o.t("metric.risingStar"), o.t("metric.risingStar.sub"), "slope", { entries, widened: false }, o.t("unit.actions")));
        break;
      }
      case "advocacy": {
        // Post-level by necessity: the API exposes no per-user share log, and
        // the analytics `groupBy` has no user dimension. We surface the most
        // shared post and credit its author.
        let rows = o.rankings.filter(r => r.shares > 0);
        let didWiden = false;
        if (!rows.length && o.autoWiden) {
          rows = o.rankingsAllTime.filter(r => r.shares > 0);
          didWiden = rows.length > 0;
        }
        rows = rows.slice().sort((a, b) => b.shares - a.shares || b.clicks - a.clicks).slice(0, o.topN);
        const postAuthor = new Map(o.raw.posts.map(p => [p.id, p.authorId]));
        const entries: Entry[] = rows.map(r => {
          const author = people.get(postAuthor.get(r.postId) || "");
          return {
            person: author || { id: "", name: r.title || o.t("advocacy.unknownPost"), avatar: "", position: "", department: "", location: "", pronouns: "", headline: "" },
            value: r.shares,
            subtitle: r.title,
            parts: [
              { label: o.t("part.shares"), value: r.shares, color: o.colors.post },
              { label: o.t("part.clicks"), value: r.clicks, color: o.colors.breadth },
            ],
          };
        });
        tiles.push(tile(id, o.t("metric.advocacy"), o.t("metric.advocacy.sub"), "share_bars", { entries, widened: didWiden }, o.t("unit.shares")));
        break;
      }
    }
  }
  return tiles;
}

const REACTION_COLORS = ["#0EA5E9", "#F59E0B", "#EF4444", "#10B981", "#8B5CF6", "#EC4899"];

function tile(
  id: MetricId, title: string, subtitle: string, chart: Tile["chart"],
  r: { entries: Entry[]; widened: boolean }, unit: string,
): Tile {
  return { id, title, subtitle, chart, entries: r.entries, unit, widened: r.widened };
}
