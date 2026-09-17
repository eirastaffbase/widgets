// Shared types for the Cornerstone learning gamification widget.

/** A request-options factory — lets the same fetch be retried under a
 *  different identity (token vs. user session). Ported from
 *  `engagement-leaderboard/types.ts`. */
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
  profile?: {
    position?: string;
    department?: string;
    location?: string;
  };
};

/** A person as the widget uses them: flat, display-ready. */
export type Person = {
  id: string;
  name: string;
  avatar: string;
  position: string;
  department: string;
  /** True when this row is a generated demo peer rather than a real API user. */
  synthetic: boolean;
  /** The person looking at the widget. Drives the "Tú" chip, the highlighted
   *  line in the XP chart and the gap the catch-up button measures. */
  isViewer?: boolean;
};

/** Course delivery format. Drives the XP weight and the meta chips. */
export type CourseType = "online" | "event";

export type Course = {
  id: number;
  title: string;
  image: string;
  type: CourseType;
  /** Minutes — the mock's "1 h" / "45 min" strings, normalized. */
  minutes: number;
  /** Compliance courses ("Obligatorio") are worth the most XP. */
  required: boolean;
  /** Display string for the due date, straight from the mock. */
  dueDate: string;
  description: string;
  modules: string[];
};

/** One course a learner finished, with the facts the badges reason over. */
export type Completion = {
  course: Course;
  /** Epoch ms. Synthetic, but stable for a given user id. */
  at: number;
  /** Finished before the deadline — feeds the Madrugador badge and the XP bonus. */
  onTime: boolean;
};

export type BadgeId =
  | "madrugador"
  | "maratonista"
  | "cumplidor"
  | "explorador"
  | "imparable";

export type Badge = {
  id: BadgeId;
  label: string;
  description: string;
};

export type TierId = "bronce" | "plata" | "oro" | "platino";

export type Tier = {
  id: TierId;
  label: string;
  /** XP at which this tier starts. */
  from: number;
  /** XP at which the next tier starts; `Infinity` for the top tier. */
  to: number;
};

/** Where a learner sits on the tier ladder right now. */
export type TierProgress = {
  tier: Tier;
  next: Tier | null;
  /** 0–1 fill toward the next tier; 1 at the top tier. */
  fraction: number;
  /** XP still needed for the next tier; 0 at the top tier. */
  remaining: number;
};

export type MetricId = "courses" | "hours" | "xp" | "streak";

/**
 * How a metric is drawn. Each metric gets the shape that actually suits it —
 * a ranking is bars, a composition is segments, an accumulation over time is
 * lines, and week-by-week activity is a grid.
 *
 * `race`, `stack` and `heat` share one row skeleton on purpose: the same
 * `<li data-key>` nodes survive the switch, so rows can FLIP to their new rank
 * and an open drilldown travels with its person. `lines` is the deliberate
 * exception — it has no per-person row to move.
 */
export type ChartKind = "race" | "stack" | "lines" | "heat";

/** One person plus every derived number. All metrics come from `completions`,
 *  so they can never disagree with each other. */
export type Learner = {
  person: Person;
  /** Unique within a field. Real people key on their user ID; demo peers have
   *  none, so they key on their slot — two peers can share a display name and
   *  must still be told apart when a row is clicked. */
  key: string;
  completions: Completion[];
  courses: number;
  /** Minutes, formatted to hours at render time. */
  minutes: number;
  xp: number;
  /** Consecutive weeks (counting back from now) with at least one completion. */
  streak: number;
  /** Completions per week over the last `SPARK_WEEKS`, oldest first. */
  spark: number[];
  /** Cumulative XP at the end of each of the last `SPARK_WEEKS` weeks, oldest
   *  first. The last entry equals `xp`. This is what the line chart plots, and
   *  it is derived from the same completions as everything else so a line can
   *  never end somewhere other than the person's XP total. */
  series: number[];
  tier: TierProgress;
  badges: Badge[];
};

/** How the three podium slots were drawn out of the configured pool. */
export type DrawMode = "shuffle" | "typed" | "daily" | "weekly";

/** A group-driven brand: two reference colors and an optional label. */
export type Brand = {
  /** Group ID or group name as typed in the editor. */
  group: string;
  primary: string;
  accent: string;
  label: string;
  /** 1-based slot number, for debug output. */
  slot: number;
};

export type BrandMatch = {
  primary: string;
  accent: string;
  label: string;
  /** How the colors were chosen — surfaced in debug mode. */
  source: "brand" | "theme" | "manual" | "default";
  /** The group that matched, when `source === "brand"`. */
  via: string;
};
