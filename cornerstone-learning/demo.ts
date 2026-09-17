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

import { BADGES, COURSES, REQUIRED_COUNT, SPARK_WEEKS, TIERS, courseXp } from "./catalogue";
import { Badge, Completion, Course, Learner, MetricId, Person, TierProgress } from "./types";

const WEEK = 7 * 24 * 60 * 60 * 1000;

// ── Seeded randomness ────────────────────────────────────────────────────────

/** FNV-1a. Cheap, and spreads short similar strings (`user-1`, `user-2`) well
 *  enough that neighbouring IDs don't produce near-identical histories. */
function hashSeed(s: string): number {
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
function prng(seed: number): () => number {
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

export const FILLER_POOL = FILLER_NAMES.length;

export function syntheticPeople(count: number, offset = 0): Person[] {
  const out: Person[] = [];
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

// ── History generation ───────────────────────────────────────────────────────

/**
 * Pick `n` courses without replacement, biased toward required courses.
 *
 * A uniform draw regularly produces a top performer who has skipped every
 * compliance course, which reads as a bug rather than a demo. Weighting keeps
 * the leaderboard aligned with the behaviour the business wants to reward.
 */
function pickCourses(rand: () => number, n: number): Course[] {
  const pool = COURSES.slice();
  const out: Course[] = [];
  const take = Math.min(n, pool.length);
  for (let k = 0; k < take; k++) {
    const weights = pool.map(c => (c.required ? 2.2 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= weights[idx];
      if (r <= 0) break;
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
function makeCompletions(seed: number, strength: number, now: number, forceCount?: number): Completion[] {
  const rand = prng(seed);
  // 1–7 courses. The floor of 1 matters: a zero-length bar in a bar *race* is
  // indistinguishable from a failed render.
  const count = forceCount != null
    ? Math.max(1, Math.min(COURSES.length, forceCount))
    : Math.max(1, Math.round(1 + strength * (COURSES.length - 1) * (0.72 + rand() * 0.38)));
  const picked = pickCourses(rand, count);

  return picked.map((course): Completion => {
    // Spread completions over the streak window, newest first, so the spark row
    // and the streak counter have something to show.
    const weeksAgo = Math.floor(rand() * SPARK_WEEKS);
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
const weekIndex = (at: number, now: number): number => Math.floor((now - at) / WEEK);

function streakOf(completions: Completion[], now: number): number {
  const weeks = new Set(completions.map(c => weekIndex(c.at, now)));
  let n = 0;
  // A streak that has to start *this* week punishes anyone who simply hasn't
  // studied yet on a Monday, so an unbroken run ending last week still counts.
  const start = weeks.has(0) ? 0 : weeks.has(1) ? 1 : -1;
  if (start < 0) return 0;
  for (let w = start; weeks.has(w); w++) n++;
  return n;
}

function sparkOf(completions: Completion[], now: number): number[] {
  const bins = new Array(SPARK_WEEKS).fill(0);
  for (const c of completions) {
    const w = weekIndex(c.at, now);
    if (w >= 0 && w < SPARK_WEEKS) bins[SPARK_WEEKS - 1 - w]++; // oldest first
  }
  return bins;
}

export function tierOf(xp: number): TierProgress {
  let i = 0;
  while (i < TIERS.length - 1 && xp >= TIERS[i].to) i++;
  const tier = TIERS[i];
  const next = i < TIERS.length - 1 ? TIERS[i + 1] : null;
  if (!next) return { tier, next: null, fraction: 1, remaining: 0 };
  const span = tier.to - tier.from;
  const fraction = span > 0 ? Math.min(1, Math.max(0, (xp - tier.from) / span)) : 1;
  return { tier, next, fraction, remaining: Math.max(0, Math.ceil(tier.to - xp)) };
}

function badgesOf(completions: Completion[], streak: number, now: number): Badge[] {
  const out: Badge[] = [];

  if (completions.filter(c => c.onTime).length >= 3) out.push(BADGES.madrugador);

  const perWeek = new Map<number, number>();
  for (const c of completions) {
    const w = weekIndex(c.at, now);
    perWeek.set(w, (perWeek.get(w) || 0) + 1);
  }
  let busiest = 0;
  perWeek.forEach(v => { if (v > busiest) busiest = v; });
  if (busiest >= 3) out.push(BADGES.maratonista);

  if (completions.filter(c => c.course.required).length >= REQUIRED_COUNT) out.push(BADGES.cumplidor);

  const types = new Set(completions.map(c => c.course.type));
  if (types.size > 1) out.push(BADGES.explorador);

  if (streak >= 4) out.push(BADGES.imparable);

  return out;
}

/** Turn a person plus a strength into a fully derived learner. */
export function makeLearner(
  person: Person, index: number, strength: number, now: number, forceCount?: number,
): Learner {
  // Synthetic peers have no ID, so their seed comes from name + slot; that
  // keeps two people with the same filler name in different slots distinct.
  const seed = hashSeed(person.id || `${person.name}#${index}`);
  const completions = makeCompletions(seed, strength, now, forceCount);
  return fromCompletions(person, index, completions, now);
}

/** Everything a learner shows, derived from one completion set. Separated from
 *  generation so a history can be reassigned to a different person (see the
 *  featured ladder in `buildField`) without recomputing it by hand. */
function fromCompletions(person: Person, index: number, completions: Completion[], now: number): Learner {
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
    tier: tierOf(xp),
    badges: badgesOf(completions, streak, now),
  };
}

// ── The field ────────────────────────────────────────────────────────────────

export const metricValue = (l: Learner, m: MetricId): number =>
  m === "courses" ? l.courses
    : m === "hours" ? l.minutes / 60
      : m === "xp" ? l.xp
        : l.streak;

/** Featured slot 1 gets the full catalogue, each later slot one fewer course,
 *  never below three — a podium where third place has done one course does not
 *  look like a contest. */
const featuredCount = (slot: number): number =>
  Math.max(3, COURSES.length - slot);

const xpOf = (cs: Completion[]) =>
  cs.reduce((a, c) => a + courseXp(c.course.required, c.course.type, c.onTime), 0);

/** Flip one late completion to on-time (+bonus). Returns false when there is
 *  nothing left to promote. */
function promote(h: Completion[]): boolean {
  for (const c of h) if (!c.onTime) { c.onTime = true; return true; }
  return false;
}

/** The inverse: drop one on-time completion back to late (−bonus). */
function demote(h: Completion[]): boolean {
  for (let i = h.length - 1; i >= 0; i--) if (h[i].onTime) { h[i].onTime = false; return true; }
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
function enforceAbove(hi: Completion[], lo: Completion[]): void {
  let guard = 0;
  const limit = hi.length + lo.length + 2;
  while (xpOf(hi) <= xpOf(lo) && guard++ < limit) {
    if (promote(hi)) continue;
    if (demote(lo)) continue;
    break;
  }
}

/**
 * Build the whole field.
 *
 * `featured` are the real, configured people, and the order they were typed in
 * is the order they are ranked — on **cursos** and **XP**. That is guaranteed
 * rather than hoped for: course counts descend by slot by construction, and the
 * XP ladder is enforced afterwards.
 *
 * *Horas* and *racha* deliberately do not inherit the pinning. They are
 * genuinely derived from the same histories, so switching metric reorders even
 * the podium — a leaderboard whose switch changes nothing is a picture, not a
 * chart.
 */
export function buildField(featured: Person[], fillerCount: number, now = Date.now()): Learner[] {
  // Generate every featured history first, then rank the *histories* and pair
  // them with people by slot. Determinism survives: the same people in the same
  // order always produce the same pairing.
  const histories = featured.map((p, i) =>
    makeCompletions(hashSeed(p.id || `${p.name}#${i}`), 1 - i * 0.14, now, featuredCount(i)));

  histories.sort((a, b) => b.length - a.length || xpOf(b) - xpOf(a));
  for (let i = 1; i < histories.length; i++) enforceAbove(histories[i - 1], histories[i]);

  // Demo peers are hard-capped one course below the weakest featured slot.
  // Without the cap a generated peer occasionally ties the third real person and
  // takes the podium spot the admin explicitly configured.
  const people = syntheticPeople(fillerCount, featured.length);
  const cap = Math.max(1, featuredCount(Math.max(0, featured.length - 1)) - 1);
  const fillerHistories = people.map((p, i) => {
    const strength = Math.max(0.12, 0.62 - i * 0.07);
    const count = Math.max(1, Math.min(cap, Math.round(cap * strength) + (i % 2)));
    return makeCompletions(hashSeed(p.id || `${p.name}#${featured.length + i}`), strength, now, count);
  });

  // A short-but-compliance-heavy peer can still out-XP the third real person, so
  // the same ladder is applied across the boundary.
  const weakest = histories[histories.length - 1];
  if (weakest) for (const h of fillerHistories) enforceAbove(weakest, h);

  const learners: Learner[] = [];
  featured.forEach((p, i) => learners.push(fromCompletions(p, i, histories[i], now)));
  people.forEach((p, i) => learners.push(fromCompletions(p, featured.length + i, fillerHistories[i], now)));
  return learners;
}

/** Rank for one metric. Ties break on XP, then course count, then name, so the
 *  order is stable across switches instead of jittering. */
export function rank(learners: Learner[], metric: MetricId): Learner[] {
  return learners.slice().sort((a, b) =>
    metricValue(b, metric) - metricValue(a, metric)
    || b.xp - a.xp
    || b.courses - a.courses
    || a.person.name.localeCompare(b.person.name));
}
