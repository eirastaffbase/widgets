# Cornerstone Learning Leaderboard

A Staffbase widget that turns learning activity into a contest: a podium, an
animated bar race, levels, streaks and badges — themed by the **viewer's own
group**, so the same widget on the same page is Retail orange for one person
and corporate blue for the next.

Designed to sit **above a course grid** (the Cornerstone "Mis cursos" view). It
renders no course cards of its own; it uses the same course catalogue and
imagery as the reference mock to drive the scoring and the drill-down.

> **The people are real. The scores are not.**
> Names and avatars come from the Staffbase `/users` API. Every number is
> generated demo data, and the widget says so on screen ("Datos de
> demostración"). See [Demo data](#demo-data).

## What it shows

| Metric | Definition |
|---|---|
| **Cursos** | Courses completed |
| **Horas** | Σ course duration |
| **XP** | `50` required · `25` live event · `10` e-learning, `+15` finished before the deadline |
| **Racha** | Consecutive weeks with at least one completion |

Plus, per person:

- **Nivel** — Bronce → Plata → Oro → Platino, with a progress bar and
  "Faltan 45 XP para Oro"
- **Insignias** — Madrugador (3+ on time), Maratonista (3 in one week),
  Cumplidor (all required training done), Explorador (online *and* in-person),
  Imparable (4-week streak)
- **Racha spark** — the last six weeks as intensity squares

## Interaction

- **Metric switcher** — the field re-ranks and the rows **travel** to their new
  positions (FLIP), so the switch reveals a different story rather than
  redrawing the same one. Rows that move between the podium and the list are
  added and removed correctly.
- **Click any row** to expand that person's completed courses, with thumbnails,
  type/duration chips and an on-time marker. Keyboard-operable (Enter / Space).
- **Reveal on scroll** — staggered bars and counting numbers fire when the
  widget actually enters the viewport.
- Avatars and names are real Staffbase profile links, so the native hovercard
  attaches; clicking them opens the profile instead of the drill-down.

All motion respects the `animate` setting **and** `prefers-reduced-motion`.
Numbers render at their final value in the HTML and are only then animated, so
a failed script still leaves a correct, static chart.

## Setup

1. `npm install && npm run build`
2. Upload `dist/cornerstone-learning.js` as an external widget.
3. In the widget editor set:
   - **Base URL** — must include `/api`, e.g. `https://acme.staffbase.com/api`
   - **API Token** — a Basic API token
   - **Top 3 User IDs** — up to three IDs, comma-separated

Both credentials ship empty on purpose. **No token is committed to this
repository**, and none should be.

Without a base URL or token the widget still renders — the top three simply fall
back to demo people. That is the intended degraded state, not an error.

### Token scopes

Read access to `/users`. `/profiles/public/{id}` (a 200px avatar for the podium)
and `/groups` (only when brand rules are written as group *names*) are used when
available and skipped when not.

## Configuration

| Setting | Notes |
|---|---|
| `topuserids` | Up to 3 IDs. **The order you type is the order they rank** on Cursos and XP. |
| `fillercount` | Generated peers below the real three. Capped so names never repeat. |
| `defaultmetric` | Which metric the widget opens on. |
| `showmetricswitcher` | Off makes it a static single-metric chart. |
| `showpodium` | Off puts all ranks in the bar list. |
| `showtierbar`, `showbadges`, `showstreak`, `showdrilldown` | Feature toggles. |
| `colorscheme` | `dark` · `light` · `auto` (follows the device). |
| `usethemecolors` | Pulls brand colors from the branch theme; off reveals manual Primary/Accent. |
| `animate` | Master motion switch. |
| `showdemonote` | The "Datos de demostración" footnote. Leave it on. |
| `debugmode` | On-screen log: viewer ID, their groups, which brand matched and why. |

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
longer courses, and their drill-down lists exactly the courses their bar counts.
The seed is the user's ID, so the same person gets the same history on every
reload, in every browser.

Course counts descend by configured slot, and the XP ladder is enforced
afterwards (by nudging on-time bonuses, never by re-rolling), so **slot 1 leads
on Cursos and XP** — verified across 1,000 generated fields. *Horas* and *racha*
deliberately do **not** inherit that pinning: they are honestly derived, so
switching metric genuinely reorders the podium. A leaderboard whose switch
changes nothing is a picture, not a chart.

## Local preview

Open `preview.html` after `npm run build`. It stubs
`getUserInformation()`, so the **Viewer's groups** field lets you watch the whole
widget re-brand without a real session. Avatars and profile hovercards only
resolve inside the Staffbase app; here they fall back to gradient initials,
which is the intended degraded state.

## Files

| File | Purpose |
|---|---|
| `cornerstone-learning.ts` | CSS, config schema, custom element, interactions |
| `charts.ts` | Podium, bar race, tier bar, badges, spark, drill-down markup |
| `demo.ts` | Seeded PRNG, completion histories, every metric derivation |
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
