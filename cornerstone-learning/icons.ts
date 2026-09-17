// Inline SVG icon set.
//
// Inline rather than a font or sprite sheet: these are painted with
// `currentColor` so they inherit the active brand colour for free, and a widget
// bundle cannot rely on the host page loading an icon font.

type Path = string;

const PATHS: { [k: string]: Path } = {
  trophy: '<path d="M6 4h12v4a6 6 0 0 1-12 0Z"/><path d="M6 6H4a2 2 0 0 0 0 4h2"/><path d="M18 6h2a2 2 0 0 1 0 4h-2"/><path d="M10 14v3"/><path d="M14 14v3"/><path d="M8 20h8"/><path d="M9 17h6l1 3H8Z"/>',
  flame: '<path d="M12 3c.6 3-1.4 4.2-2.6 5.6A5.4 5.4 0 0 0 8 12a4 4 0 0 0 8 0c0-1.3-.6-2.3-1.2-3.2C13.6 7 12.9 5.3 12 3Z"/><path d="M12 21a6 6 0 0 0 6-6c0-2-1-3.6-2-5"/><path d="M12 21a6 6 0 0 1-6-6c0-2 1-3.6 2-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z"/><path d="M8 7h7"/><path d="M8 11h7"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6Z"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M12 13.5 12.9 15l1.6.2-1.2 1.1.3 1.6-1.6-.8-1.6.8.3-1.6-1.2-1.1 1.6-.2Z"/><path d="M8 3h8l-2.5 6h-3Z"/>',
  crown: '<path d="M4 18h16"/><path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 7h-13Z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>',
  shield: '<path d="M12 3 5 6v6c0 4.3 2.9 8.1 7 9 4.1-.9 7-4.7 7-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
  sunrise: '<path d="M12 3v5"/><path d="m5 10 1.5 1.5"/><path d="M2 17h20"/><path d="m19 10-1.5 1.5"/><path d="M8.5 17a3.5 3.5 0 0 1 7 0"/><path d="M4 21h16"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 5.6"/><path d="M17.5 14.4A6 6 0 0 1 21 20"/>',
  rocket: '<path d="M13.5 4.5C16 2 20 3 20 3s1 4-1.5 6.5L14 14l-4-4Z"/><path d="m10 10-4 1.5L4 14l3 .5L7.5 18l2.5-2 1.5-4"/><path d="M6.5 17.5 4 20"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
  arrow: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  grid: '<rect x="3" y="4" width="7" height="7" rx="1.6"/><rect x="14" y="4" width="7" height="7" rx="1.6"/><rect x="3" y="15" width="7" height="5" rx="1.6"/><rect x="14" y="15" width="7" height="5" rx="1.6"/>',
  layers: '<path d="m12 3 8 4.5-8 4.5-8-4.5Z"/><path d="m4 12 8 4.5 8-4.5"/><path d="m4 16.5 8 4.5 8-4.5"/>',
  trend: '<path d="M3 17.5 9.5 11l4 4L21 7"/><path d="M15.5 7H21v5.5"/>',
};

export function icon(name: string, size = 16, stroke = 1.9): string {
  const d = PATHS[name] || PATHS.star;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor"`
    + ` stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`
    + ` focusable="false">${d}</svg>`;
}

/** Each metric gets its own glyph so the switcher is scannable before it is
 *  read — the labels are short Spanish words that look alike at a glance. */
export const METRIC_ICON: { [k: string]: string } = {
  courses: "book",
  hours: "clock",
  xp: "bolt",
  streak: "flame",
};

export const BADGE_ICON: { [k: string]: string } = {
  madrugador: "sunrise",
  maratonista: "bolt",
  cumplidor: "shield",
  explorador: "compass",
  imparable: "flame",
};
