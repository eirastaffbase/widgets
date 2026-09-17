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

import { Http, fetchGroupNames } from "./api";
import { Brand, BrandMatch, OptsFactory } from "./types";

export const MAX_BRANDS = 4;

const isHex = (s: string): boolean => /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(s).trim());

/** Normalize `#abc` → `#aabbcc` so downstream slicing is safe. */
export function normalizeHex(s: string): string {
  const v = String(s || "").trim();
  if (!isHex(v)) return "";
  const h = v.slice(1);
  return h.length === 3 ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase() : `#${h.toLowerCase()}`;
}

// ── Contrast ─────────────────────────────────────────────────────────────────
//
// A brand colour chosen for a white header is routinely unreadable on the dark
// stage (and vice versa). `tasks/shared/theming.ts` solves this internally but
// does not export the helper, so it is reimplemented here rather than reaching
// into a shared file this widget does not own.

function toRgb(hex: string): [number, number, number] {
  const h = (hex.replace("#", "") + "000000").slice(0, 6);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbTriplet(hex: string): string {
  const [r, g, b] = toRgb(hex);
  return `${r},${g},${b}`;
}

function relLuminance(hex: string): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = toRgb(hex).map(v => v / 255);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrastWith = (hex: string, other: number): number => {
  const l = relLuminance(hex);
  const [hi, lo] = l > other ? [l, other] : [other, l];
  return (hi + 0.05) / (lo + 0.05);
};

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r0, g0, b0] = toRgb(hex).map(v => v / 255);
  const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r0) h = ((g0 - b0) / d + (g0 < b0 ? 6 : 0));
  else if (max === g0) h = (b0 - r0) / d + 2;
  else h = (r0 - g0) / d + 4;
  return { h: h * 60, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, (v + m) * 255)))
    .toString(16).padStart(2, "0");
  return `#${to(r1)}${to(g1)}${to(b1)}`;
}

/**
 * Nudge a colour's lightness until it clears `target` contrast against the
 * surface, keeping hue and saturation so it still reads as the brand.
 */
export function fitToSurface(hex: string, surface: "light" | "dark", target = 3.2): string {
  const base = normalizeHex(hex);
  if (!base) return "";
  const surfaceLum = surface === "dark" ? relLuminance("#0b0d12") : relLuminance("#ffffff");
  if (contrastWith(base, surfaceLum) >= target) return base;

  const { h, s } = hexToHsl(base);
  const step = surface === "dark" ? 0.04 : -0.04;
  let { l } = hexToHsl(base);
  for (let i = 0; i < 24; i++) {
    l = Math.min(0.94, Math.max(0.08, l + step));
    const candidate = hslToHex(h, Math.max(0.35, s), l);
    if (contrastWith(candidate, surfaceLum) >= target) return candidate;
  }
  // Give up gracefully: a legible neutral beats an invisible brand colour.
  return surface === "dark" ? "#e8edf7" : "#1b2030";
}

// ── Brand slots ──────────────────────────────────────────────────────────────

/** Read `brand1group`/`brand1primary`/… out of the flat attribute bag.
 *  A slot with no group or no primary colour is simply not a brand. */
export function readBrands(attr: (name: string) => string): Brand[] {
  const out: Brand[] = [];
  for (let i = 1; i <= MAX_BRANDS; i++) {
    const group = (attr(`brand${i}group`) || "").trim();
    const primary = normalizeHex(attr(`brand${i}primary`));
    if (!group || !primary) continue;
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

export type Viewer = { id: string; groupIds: string[] };

/** Ask the SDK who is looking. Never throws — a widget that blanks because the
 *  profile call hiccuped is worse than one themed with the default palette. */
export async function readViewer(widgetApi: any, log: (...a: any[]) => void): Promise<Viewer> {
  try {
    const profile: any = await widgetApi.getUserInformation();
    const id = String(profile?.id || "");
    const groupIds: string[] = (profile?.groupIDs || profile?.groupIds || []).map(String);
    log("viewer", id || "(anonymous)", "groups", groupIds.length, groupIds.join(","));
    return { id, groupIds };
  } catch (e: any) {
    log("getUserInformation failed —", e?.message || String(e));
    return { id: "", groupIds: [] };
  }
}

/** True when any brand rule is written as something other than a group ID, in
 *  which case the id→name map has to be fetched. Staffbase group IDs are 24-char
 *  hex (Mongo ObjectIDs), so anything else is a name. */
export const needsGroupNames = (brands: Brand[]): boolean =>
  brands.some(b => !/^[0-9a-f]{24}$/i.test(b.group));

export type ResolveArgs = {
  brands: Brand[];
  viewer: Viewer;
  /** id → name, empty when only IDs were configured. */
  groupNames: Map<string, string>;
  /** Slot number to force while configuring; 0 = off. */
  preview: number;
  fallback: BrandMatch;
  surface: "light" | "dark";
  log: (...a: any[]) => void;
};

/**
 * Pick the brand for this viewer.
 *
 * Slot order decides, so an admin can express priority simply by ordering the
 * slots — the person in both "Retail" and "HQ" gets whichever was entered
 * first, every time, on every device.
 */
export function resolveBrand(args: ResolveArgs): BrandMatch {
  const { brands, viewer, groupNames, preview, fallback, surface, log } = args;

  const finish = (b: Brand, why: string): BrandMatch => {
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
    if (forced) return finish(forced, "forzado desde el editor");
    log(`brand: preview slot ${preview} is empty — falling back`);
  }

  if (!brands.length) {
    log("brand: no brand slots configured");
    return fallback;
  }

  // Name matching is case- and accent-insensitive: "Operaciones" typed in the
  // editor should match "operaciones" on the group, and an admin should not
  // have to reproduce diacritics exactly.
  const norm = (s: string) => String(s || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  const viewerIds = new Set(viewer.groupIds);
  const viewerNames = new Set(
    viewer.groupIds.map(id => norm(groupNames.get(id) || "")).filter(Boolean),
  );

  for (const b of brands) {
    if (viewerIds.has(b.group)) return finish(b, "coincidencia por ID de grupo");
    if (viewerNames.has(norm(b.group))) return finish(b, "coincidencia por nombre de grupo");
  }

  log(`brand: viewer matched none of ${brands.length} slot(s)`);
  return fallback;
}

/** Fetch the id→name map, but only when a rule actually needs it. */
export async function loadGroupNames(
  http: Http, base: string, order: OptsFactory[], brands: Brand[], log: (...a: any[]) => void,
): Promise<Map<string, string>> {
  if (!base || !order.length || !needsGroupNames(brands)) return new Map();
  try {
    const m = await fetchGroupNames(http, base, order);
    log("groups resolved", m.size);
    return m;
  } catch (e: any) {
    log("group names failed —", e?.message || String(e));
    return new Map();
  }
}

/**
 * Apply a brand.
 *
 * Both colours are already custom properties, so re-branding is a two-property
 * write on the root: every bar, medal, tier fill, badge chip and glow re-tints
 * without a re-render.
 */
export function applyBrand(root: HTMLElement, match: BrandMatch): void {
  root.style.setProperty("--csl-primary", match.primary);
  root.style.setProperty("--csl-accent", match.accent);
  root.style.setProperty("--csl-primary-rgb", rgbTriplet(match.primary));
  root.style.setProperty("--csl-accent-rgb", rgbTriplet(match.accent));
}
