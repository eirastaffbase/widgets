# Cornerstone Learning Leaderboard

A Staffbase widget that turns learning activity into a contest: a podium, four
different charts, levels, streaks, badges and a catch-up button — themed by the
**viewer's own group**, so the same widget on the same page is Retail orange for
one person and corporate blue for the next.

Designed to sit **above a course grid** (the Cornerstone "Mis cursos" view). It
renders no course cards of its own; it uses the same course catalogue and
imagery as the reference mock to drive the scoring and the drill-down.

> **The people are real. The scores are not.**
> Names and avatars come from the Staffbase `/users` API. Every number is
> generated demo data, and the widget says so on screen ("Datos de
> demostración"). See [Demo data](#demo-data).

## What it shows

Each metric is drawn as the kind of chart it actually is — four bar charts with
different numbers in them would make the switcher a relabelling exercise.

| Metric | Definition | Chart |
|---|---|---|
| **Cursos** | Courses completed | Bar race — a ranking |
| **Horas** | Σ course duration | Stacked bar — one segment per course, so you can see *what* the time went into |
| **XP** | `50` required · `25` live event · `10` e-learning, `+15` finished before the deadline | Cumulative colour curves over six weeks, **the viewer's own curve picked out** |
| **Racha** | Consecutive weeks with at least one completion | Week-by-week heatmap — a streak is a statement about a calendar |

Plus, per person:

- **Nivel** — Bronce → Plata → Oro → Platino, with a progress bar and
  "Faltan 45 XP para Oro"
- **Insignias** — Madrugador (3+ on time), Maratonista (3 in one week),
  Cumplidor (all required training done), Explorador (online *and* in-person),
  Imparable (4-week streak)
- **Racha spark** — the last six weeks as intensity squares

### You, in the ranking

With `showviewer` on (the default), the logged-in person joins the field as
**Tú**, resolved through `getUserInformation()`. They are placed mid-pack by
construction: on the podium the catch-up button would have nothing to ask for,
and at the bottom the gap is dispiriting rather than motivating.

That is what makes the XP view a comparison rather than a scoreboard — your
curve is the thick gradient one with the glow, the area fill and the pulsing tip;
the leaders carry name medallions; everyone else is a friendly colour in the
background.

The XP view deliberately has **no gridlines and no value axis**. A gridline
exists so you can read an exact number off a line, and nobody needs their XP to
three significant figures — the number they want is their own, so it rides at
the end of their own curve on a coloured medallion instead. The curves are
splines rather than polylines (clamped so cumulative XP can never appear to go
down), and they draw themselves in one at a time, peers first, finishing on the
viewer's.

If there is no session (editor preview, logged-out render, failed lookup) a
generic "Tú" row stands in, so the comparison still demonstrates itself without
claiming to be a real person.

### The catch-up button

The widget ends on the next action, not on a ranking. The sentence above the
button names the person directly ahead of the viewer and the exact gap **in the
units of the chart currently on screen** — "te faltan 2 cursos para alcanzar a
Lucía", then "te faltan 40 XP para alcanzar a Lucía" when you switch to XP.
"Haz más cursos" is advice; a named target is a goal.

Pressing it always emits a `cornerstone-learning:catchup` event
(`{ metric, gap, rank, total, target }`, bubbling and composed), so the page
hosting the course grid can scroll to it or apply a filter. Set `ctaurl` as well
if it should simply navigate.

## Interaction

- **Metric switcher** — between the three row charts the field re-ranks and the
  rows **travel** to their new positions (FLIP), so the switch reveals a
  different story rather than redrawing the same one. Rows that move between the
  podium and the list are added and removed correctly, and an open drill-down
  travels with its person instead of closing.
- **Click any row** to expand that person's completed courses, with thumbnails,
  type/duration chips and an on-time marker. Keyboard-operable (Enter / Space).
- **Hover or focus any curve** in the XP view to raise it and push the rest back;
  click it to open that person's courses underneath.
- **Hover a segment** of a stacked hours bar to see which course it is.
- **Reveal on scroll** — staggered bars, drawing lines and counting numbers fire
  when the widget actually enters the viewport.
- Avatars and names are real Staffbase profile links, so the native hovercard
  attaches; clicking them opens the profile instead of the drill-down.
- **On a phone the podium stays three across.** Stacked, the three cards ate the
  whole screen and the ranking — the one thing a podium is for — stopped being a
  shape you could read at a glance, so the cards shrink instead: smaller
  avatars, tighter type, and the role and badge lines dropped, since both are
  still there on the rows below.

All motion respects the `animate` setting **and** `prefers-reduced-motion`.
Numbers render at their final value in the HTML and are only then animated, so
a failed script still leaves a correct, static chart.

## Setup

1. `npm install && npm run build`
2. Upload `dist/cornerstone-learning.js` as an external widget.
3. In the widget editor set:
   - **Base URL** — must include `/api`, e.g. `https://acme.staffbase.com/api`
   - **API Token** — a Basic API token
   - **User IDs** — as many as you like, comma-separated

Both credentials ship empty on purpose. **No token is committed to this
repository**, and none should be.

Without a base URL or token the widget still renders — the people simply fall
back to demo peers. That is the intended degraded state, not an error.

### Token scopes

Read access to `/users`. `/profiles/public/{id}` (a 200px avatar for the podium)
and `/groups` (only when brand rules are written as group *names*) are used when
available and skipped when not.

## How the top three are chosen

You paste a **pool**, not a podium. Everyone in it is resolved and everyone in it
appears in the ranking; three of them are *drawn* for the podium.

Taking the first three would make the configuration order the answer and put the
same three faces on the demo forever. Drawing with `Math.random` would reshuffle
on every reload — the podium would change while someone watched it, and two
people looking at the same screen would disagree. So the draw is **seeded**:
random-looking, taken from anywhere in the array, and identical for every viewer
until something deliberately changes it.

| `podiumdraw` | Behaviour |
|---|---|
| `shuffle` (default) | Fixed. Change **Draw Seed** to re-roll. |
| `typed` | No draw — ranked in the order you pasted. |
| `daily` | A new three each day. |
| `weekly` | A new three each week. |

The draw sets the rank order too, so *who wins* varies, not only who appears.
Whoever is not drawn stays in the field as an ordinary real participant, capped
below the podium band so the draw still means something.

## Configuration

| Setting | Notes |
|---|---|
| `topuserids` | Any number of IDs (24 max). Three are drawn for the podium; the rest still appear. |
| `podiumdraw` | How the three are drawn — see above. |
| `drawseed` | Any text. Changing it re-rolls the draw without touching the IDs. |
| `showviewer` | Adds the logged-in viewer to the ranking as "Tú", mid-field. |
| `fillercount` | Generated peers below the real people. Capped so names never repeat. |
| `defaultmetric` | Which metric the widget opens on. |
| `showmetricswitcher` | Off makes it a static single-metric chart. |
| `showpodium` | Off puts all ranks in the bar list. |
| `showcta` / `ctalabel` / `ctaurl` | The catch-up button. Leave `ctaurl` empty to only emit the event. |
| `showtierbar`, `showbadges`, `showstreak`, `showdrilldown` | Feature toggles. |
| `colorscheme` | `dark` · `light` · `auto` (follows the device). |
| `usethemecolors` | Pulls brand colors from the branch theme; off reveals manual Primary/Accent. |
| `animate` | Master motion switch. |
| `showdemonote` | The "Datos de demostración" footnote. Leave it on. |
| `debugmode` | On-screen log: viewer ID, their groups, the draw, which brand matched and why. |

## Multibranding

Staffbase multibranding uses **groups** to vary presentation, so this widget
asks who is looking and themes itself from their group membership.

Turn on **Multibranding** and fill in up to four slots:

| Field | Example |
|---|---|
| `brandNgroup` | `Retail` — a group **ID or name** |
| `brandNprimary` | `#E4572E` |
| `brandNaccent` | `#FFC914` |
| `brandNlabel` | `Retail` — shown as a chip in the header |

**How a brand is chosen**

1. The viewer comes from `widgetApi.getUserInformation()` → `id`, `groupIDs`.
   No extra request; no session juggling.
2. Slots are tested **in order**, 1 → 4. The first match wins, so a person in
   two branded groups gets the same answer every time on every device — you
   express priority simply by ordering the slots.
3. Group IDs match directly. Group *names* are matched case- and
   accent-insensitively, which costs one extra `/groups` lookup — written as IDs,
   branding is free.
4. No match, or the profile lookup failed → **`brandfallback`**: the branch
   theme, or the manual Primary/Accent pair.

Both colours are contrast-corrected for the active scheme before they are
applied, so a dark navy brand stays legible on the dark stage. They are applied
as CSS custom properties, so re-branding re-tints every bar, medal, tier fill,
badge and glow without a re-render.

**`brandpreview`** forces a slot (1–4) while you configure, since you cannot
join every group to check your own work. Set it back to `0` before publishing.

## Demo data

The scores are generated, not read from Cornerstone — but they are generated
*once, from one source*:

```
seeded PRNG → a set of completions → cursos / horas / XP / racha / nivel / insignias
```

Everything is derived from that one completion set, so the metrics can never
contradict each other — the person leading on hours really did sit through
longer courses, their drill-down lists exactly the courses their bar counts, and
their XP curve ends exactly at the XP shown beside their name. The seed is the
user's ID, so the same person gets the same history on every reload, in every
browser.

Course counts descend by podium slot, and the XP ladder is enforced afterwards
(by nudging on-time bonuses, never by re-rolling), so **the drawn three hold the
podium, in the order drawn, on Cursos and XP** — verified across 1,000 generated
fields. *Horas* and *racha* deliberately do **not** inherit that pinning: they
are honestly derived, so switching metric genuinely reorders the podium. A
leaderboard whose switch changes nothing is a picture, not a chart.

## Local preview

Open `preview.html` after `npm run build`. It stubs `getUserInformation()`, so
the **Viewer's groups** field lets you watch the whole widget re-brand without a
real session, and the page logs the `cornerstone-learning:catchup` event when you
press the button. Avatars and profile hovercards only resolve inside the
Staffbase app; here they fall back to gradient initials, which is the intended
degraded state.

## Files

| File | Purpose |
|---|---|
| `cornerstone-learning.ts` | CSS, config schema, custom element, interactions |
| `charts.ts` | Podium, bar race, stacked hours, XP curves, heatmap, CTA, drill-down markup |
| `demo.ts` | Seeded PRNG, the podium draw, completion histories, every metric derivation |
| `catalogue.ts` | Course catalogue, XP weights, tier thresholds, badge rules |
| `branding.ts` | Viewer + groups, brand matching, contrast fitting, colour application |
| `api.ts` | Auth ladder, throttled transport, user/profile/group endpoints |
| `strings.ts` | Spanish copy |
| `icons.ts` | Inline SVG set |

## Host CSS

Staffbase's stylesheet reaches into widget markup, so `HOST_RESET` neutralises
it under the `csl-` prefix. One rule matters more than the rest: the
`button:hover/:focus/:active` reset carries **only** paint properties
(background, colour, shadow, outline) and never geometry. Staffbase sets
`width:90%; margin:auto` on the base button rule alone — repeating geometry per
state raises specificity above the widget's own component rules and collapses
round buttons the moment they are pressed.
