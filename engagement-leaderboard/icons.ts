// Authored icon set — one consistent 24px grid, 1.75 stroke, round caps/joins.
// Deliberately not emoji or unicode glyphs: those inherit the host font, render
// differently per platform, and cannot take `currentColor`.

const svg = (body: string, size: number): string =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
  `stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const PATHS: { [k: string]: string } = {
  chevronLeft: `<path d="M15 5 8 12l7 7"/>`,
  chevronRight: `<path d="m9 5 7 7-7 7"/>`,
  comment: `<path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/>`,
  heart: `<path d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.65 12 20 12 20Z"/>`,
  share: `<path d="M18 8a2.5 2.5 0 1 0-2.45-3L8.9 8.6a2.5 2.5 0 1 0 0 6.8l6.65 3.6A2.5 2.5 0 1 0 18 16"/>`,
  click: `<path d="M9 4v3M4 9h3M6.3 6.3 8 8"/><path d="m11 11 9 3.2-4 1.4-1.4 4Z"/>`,
  pen: `<path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5Z"/><path d="m13.5 6.5 4 4"/>`,
  trophy: `<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M16 5h3v2a3 3 0 0 1-3 3M8 5H5v2a3 3 0 0 0 3 3"/><path d="M12 13v3m-3 4h6"/>`,
  spark: `<path d="M12 4v6m0 4v6M4 12h6m4 0h6"/><path d="m7.5 7.5 3 3m3 3 3 3m0-6-3 3m-3 3-3 3"/>`,
  arrowUp: `<path d="M12 19V6"/><path d="m6 12 6-6 6 6"/>`,
  refresh: `<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v4h-4"/>`,
  people: `<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5M17 14.4A6 6 0 0 1 21 20"/>`,
  play: `<path d="M8 5.5v13l10-6.5Z"/>`,
  pause: `<path d="M9 5v14M15 5v14"/>`,

  // Metric marks. Each metric gets its own silhouette rather than a shared
  // sparkle, so the chapter rail is scannable by shape before it is read.
  pulse: `<path d="M3 12h3.5l2.5-6 4 13 2.5-7H21"/>`,
  target: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>`,
  medal: `<circle cx="12" cy="15" r="5"/><path d="M9.2 10.4 6.5 3M14.8 10.4 17.5 3M9 3h6"/><path d="m12 13 .8 1.7 1.8.2-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.2Z"/>`,
  trendUp: `<path d="M3 17.5 9 11l4 3.5 5-6.5"/><path d="M14.5 8H18v3.5"/>`,

  // States and chrome.
  clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  history: `<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v4.5h4.5"/><path d="M12 7.5V12l3.2 2"/>`,
  beaker: `<path d="M9.5 3v6.2L4.8 17A2 2 0 0 0 6.5 20h11a2 2 0 0 0 1.7-3l-4.7-7.8V3"/><path d="M8 3h8"/><path d="M6.6 14h10.8"/>`,
  alert: `<path d="M12 4.5 21 19H3Z"/><path d="M12 10v4"/><path d="M12 16.6v.1"/>`,
  inbox: `<path d="M3.5 13.5h4l1.2 2.4h6.6l1.2-2.4h4"/><path d="M5.6 5h12.8l2.1 8.5V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-4.5Z"/>`,
  scatter: `<path d="M4 4v16h16"/><circle cx="9" cy="15" r="1.7"/><circle cx="13" cy="9.5" r="1.7"/><circle cx="17.5" cy="13" r="1.7"/><circle cx="8" cy="8" r="1.2"/>`,
  star: `<path d="m12 4 2.5 5.1 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8Z"/>`,
  bolt: `<path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13Z"/>`,
  flame: `<path d="M12 3s5.5 4.3 5.5 9a5.5 5.5 0 0 1-11 0c0-2 1-3.6 2-4.7.3 1.4 1 2.2 1.8 2.2 1.3 0 1.7-1.6 1.7-6.5Z"/>`,
  eye: `<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/>`,
  check: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2 7 7M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8"/>`,
  moon: `<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>`,
};

export function icon(name: keyof typeof PATHS | string, size = 18): string {
  return svg(PATHS[name] || PATHS.spark, size);
}

/** Which icon represents each metric in the chapter rail and slide header. */
export const METRIC_ICON: { [k: string]: string } = {
  most_active: "pulse",
  most_engaged: "target",
  top_commenter: "comment",
  top_reactor: "heart",
  advocacy: "share",
  most_appreciated: "medal",
  top_contributor: "pen",
  rising_star: "trendUp",
};
