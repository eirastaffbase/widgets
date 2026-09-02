// Shared types for the engagement leaderboard widget.

/** A request-options factory — lets the same fetch be retried under a
 *  different identity (token vs. user session). Mirrors the `makeOpts`
 *  idiom in `tasks/manager-tasks-widget.ts`. */
export type OptsFactory = (extra?: RequestInit) => RequestInit;

export type Avatar = {
  original?: { url?: string };
  icon?: { url?: string };
  thumb?: { url?: string };
};

export type ApiUser = {
  id?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  userName?: string;
  avatar?: Avatar;
  position?: string;
  department?: string;
  location?: string;
  profileHeadline?: string;
  pronouns?: string;
  profile?: {
    position?: string;
    department?: string;
    location?: string;
    pronouns?: string;
    profileHeadline?: string;
  };
};

/** A person as the widget uses them: flat, display-ready. */
export type Person = {
  id: string;
  name: string;
  avatar: string;
  position: string;
  department: string;
  location: string;
  pronouns: string;
  headline: string;
};

export type Post = {
  id: string;
  authorId: string;
  channelId: string;
  created: string;
  published: string;
  title: string;
  likingEnabled: boolean;
};

/** One engagement event, normalized across sources so the time window can be
 *  applied uniformly client-side. */
export type EngagementEvent = {
  kind: "comment" | "reaction" | "post";
  userId: string;
  postId: string;
  channelId: string;
  /** ISO timestamp used for windowing. */
  at: string;
  /** Reaction type (LIKE / CELEBRATE / …) when available via session auth. */
  reactionType?: string;
};

/** Per-post share/click totals from the analytics ranking endpoint. */
export type PostRanking = {
  postId: string;
  channelId: string;
  title: string;
  shares: number;
  clicks: number;
  comments: number;
  likes: number;
  visitors: number;
};

/** The raw, un-windowed result of one full data pass. Cached; the time window
 *  is applied on top of this in memory, so changing the window costs no
 *  requests. */
/** Why a post's reactions could not be read, so "partial data" can name names. */
export type SkippedPost = {
  postId: string;
  channelId: string;
  reason: string;
};

export type RawData = {
  events: EngagementEvent[];
  posts: Post[];
  people: Person[];
  rankings: PostRanking[];
  /** Posts whose like list could not be read (restricted channels). */
  skippedPosts: number;
  /** Why each skipped post was skipped, so "partial data" can name names. */
  skipped: SkippedPost[];
  /** True when reaction *types* were resolved (session auth succeeded). */
  typedReactions: boolean;
  fetchedAt: number;
};

/** Aggregated per-user counters within a window. */
export type UserStats = {
  userId: string;
  comments: number;
  reactionsGiven: number;
  reactionsReceived: number;
  commentsReceived: number;
  postsAuthored: number;
  distinctPosts: number;
  distinctChannels: number;
  lastActiveAt: number;
  reactionTypes: { [type: string]: number };
};

export type Window = { since: number; until: number };

/** One entry in a tile's ranking. */
export type Entry = {
  person: Person;
  value: number;
  /** Optional breakdown for the stacked composition bar. */
  parts?: Array<{ label: string; value: number; color: string }>;
  /** Optional secondary line (e.g. post title for Social Advocacy). */
  subtitle?: string;
  /** Rising Star: value in the previous window. */
  previous?: number;
};

export type MetricId =
  | "most_active"
  | "most_engaged"
  | "top_commenter"
  | "top_reactor"
  | "advocacy"
  | "most_appreciated"
  | "top_contributor"
  | "rising_star";

export type ChartKind = "podium" | "bars" | "donut" | "slope" | "share_bars";

export type Tile = {
  id: MetricId;
  title: string;
  subtitle: string;
  chart: ChartKind;
  entries: Entry[];
  /** Formatted unit label, e.g. "comments". */
  unit: string;
  /** True when this tile fell back to all-time because its window was empty. */
  widened: boolean;
};
