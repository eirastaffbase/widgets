// Inline SVG strings, as in the task widgets, but generated from react-icons/lu
// at build time. One icon family only. Edit scripts/generate-icons.js to change
// the set, then run `npm run icons`.

import { NAMED_ICONS, UI_ICONS } from "./icons.generated";

export const ICONS = Object.freeze({
  ...UI_ICONS,
  fallback: NAMED_ICONS.users,
  widgetIconDataUri:
    "data:image/svg+xml;base64," +
    // Registry icon: the Lucide "users" glyph, white on the accent.
    btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 171 171">' +
        '<circle cx="85.5" cy="85.5" r="85.5" fill="#1f6feb"/>' +
        '<g transform="translate(43.5 43.5) scale(3.5)" fill="none" stroke="#fff" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>' +
        '<circle cx="9" cy="7" r="4"/>' +
        '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>' +
        '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
        "</g></svg>"
    ),
});

export type ResolvedIcon =
  | { kind: "image"; value: string }
  | { kind: "svg"; value: string };

const IMAGE_RE = /^(https?:\/\/|data:image\/)/i;

/** URL or data URI renders as an image; anything else maps to a named glyph. */
export function resolveIcon(value?: string): ResolvedIcon {
  const raw = (value || "").trim();
  if (!raw) return { kind: "svg", value: ICONS.fallback };
  if (IMAGE_RE.test(raw)) return { kind: "image", value: raw };

  const key = raw.toLowerCase().replace(/[\s_-]+/g, "");
  return { kind: "svg", value: NAMED_ICONS[key] || ICONS.fallback };
}

/** The icon names an editor can use, for the config help text. */
resolveIcon.names = Object.keys(NAMED_ICONS);
