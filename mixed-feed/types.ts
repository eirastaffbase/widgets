// Shared types for the mixed social + news feed.

/** How a channel's posts are presented and filtered.
 *
 *  Derived from the channel's `contentType`, which the Staffbase channels API
 *  returns as one of `articles` | `updates` | `pictures` (verified against
 *  bimbo.staffbase.rocks). Editorial articles read as News; user-authored
 *  updates and picture posts read as Social. */
export type FeedKind = "news" | "social";

/** The filter chips. `all` is not a kind — it is the absence of a filter. */
export type FilterKey = "all" | FeedKind;

export type OptsFactory = (extra?: RequestInit) => RequestInit;

// ── Raw API shapes (only the fields we consume) ───────────────────────────────

export interface ApiImage {
  url?: string;
  width?: number;
  height?: number;
}

export interface Avatar {
  original?: ApiImage;
  thumb?: ApiImage;
  icon?: ApiImage;
}

export interface ApiAuthor {
  id?: string;
  firstName?: string;
  lastName?: string;
  avatar?: Avatar;
}

export interface ApiContent {
  title?: string | null;
  teaser?: string | null;
  content?: string | null;
  image?: Avatar | null;
  feedImage?: Avatar | null;
}

export interface ApiChannel {
  id: string;
  contentType?: string;
  config?: { localization?: Record<string, { title?: string | null; description?: string | null }> };
}

export interface ApiPost {
  id: string;
  channelID?: string;
  contentType?: string;
  highlighted?: boolean;
  published?: string;
  created?: string;
  authorID?: string;
  author?: ApiAuthor;
  contents?: Record<string, ApiContent>;
  likes?: { total?: number };
  comments?: { total?: number };
  links?: { detail_view?: { href?: string } };
}

export interface ApiComment {
  id: string;
  contents?: string | null;
  content?: string | null;
  text?: string | null;
  created?: string;
  published?: string;
  author?: ApiAuthor;
}

// ── Normalized shapes the renderer consumes ──────────────────────────────────

export interface Channel {
  id: string;
  title: string;
  kind: FeedKind;
  /** Raw `contentType` — kept so picture posts can be laid out differently. */
  contentType: string;
}

export interface FeedPost {
  id: string;
  channelId: string;
  channelTitle: string;
  kind: FeedKind;
  contentType: string;
  /** Milliseconds since epoch; the sole sort key for the merged feed. */
  publishedAt: number;
  publishedIso: string;
  highlighted: boolean;
  /** Empty for social posts, which carry no meaningful title. */
  title: string;
  /** Plain text, already stripped of markup and clamped by CSS. */
  excerpt: string;
  imageUrl: string;
  author: { id: string; name: string; avatarUrl: string };
  likeCount: number;
  commentCount: number;
  /** Relative in-app link, so the tap stays inside the Staffbase shell. */
  href: string;
}

export interface Comment {
  id: string;
  html: string;
  createdAt: number;
  author: { id: string; name: string; avatarUrl: string };
}

export interface Viewer {
  id: string;
  name: string;
  avatarUrl: string;
  groupIds: string[];
  language: string;
}

// ── Branding ─────────────────────────────────────────────────────────────────

/** One entry of the `brandoverrides` config array. The first entry whose
 *  `groupId` appears in the viewer's groups wins. */
export interface BrandOverride {
  /** Group ID(s) or group name(s) this rule applies to. A rule may list several
   *  so one brand can cover duplicate groups — this tenant has two distinct
   *  groups both named "El Globo". */
  group?: string | string[];
  /** Legacy single-ID form, still honoured. */
  groupId?: string;
  label?: string;
  color?: string;
  radius?: string;
  pinnedPostId?: string;
}

export interface Brand {
  color: string;
  colorRgb: string;
  /** Readable foreground for text sitting on `color`. */
  onColor: string;
  radius: string;
  pinnedPostId: string;
  /** Which override matched, for debugging. Empty when none did. */
  matchedLabel: string;
}
