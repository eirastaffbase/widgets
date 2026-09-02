# Engagement Leaderboard

A Staffbase widget that celebrates the people carrying your intranet — who
comments, who reacts, who publishes, and which posts get shared — computed live
from branch data.

It presents as a **broadcast title card**: a dark stage lit by your tenant's own
brand colour, one champion per slide, revealed with a single rehearsed
animation and rotated like a scoreboard. Each metric is a chapter you can click
to, swipe to, or arrow-key to; the deck also advances itself.

A **Grid** layout is available for dashboards that want all metrics visible at
once, and every metric can be switched off individually in the widget editor.



## Metrics

| Tile | Definition | Chart |
|---|---|---|
| **Most active** | `comments + reactions given + posts authored` — raw volume | Composition bar |
| **Most engaged** | Weighted for depth *and* breadth: `3·comments + 1·reactions + 5·posts + 2·distinct posts touched + 4·distinct channels touched` | Composition bar |
| **Top commenter** | Comments authored | Ranked field |
| **Top reactor** | Reactions given | Ranked field, plus a typed reaction ring under session auth |
| **Most appreciated** | Reactions received on their own posts | Ranked field |
| **Top contributor** | Posts published | Ranked field |
| **Rising star** | Biggest increase in activity vs. the immediately preceding equal-length period | Slope chart |
| **Social advocacy** | Most-shared posts in the period, credited to their author | Two-tone share/click bars |

Every slide shares one anatomy — **champion**, **field**, **flourish** — so the
deck reads as a single broadcast rather than eight unrelated charts. The
flourish is the only part that changes per metric, and a metric with nothing
extra to say simply omits it.

## Setup

1. `npm install && npm run build`
2. Upload `dist/engagement-leaderboard.js` as an external widget.
3. In the widget editor set:
   - **Base URL** — must include `/api`, e.g. `https://acme.staffbase.com/api`
   - **API Token** — a Basic API token

Both ship empty on purpose. **No token is committed to this repository**, and
none should be.

### Token scopes

The token needs read access to `/posts`, `/posts/{id}/likes`, `/comments`,
`/users` and `/branch/analytics/posts/rankings`. A token that cannot read
`/branch/analytics/posts/rankings` still renders every tile except Social
Advocacy.

## Authentication — token vs. session

The widget runs an **auth ladder**: each request can be retried under a second
identity. The two identities reach different data.

| Identity | Sent as | Notes |
|---|---|---|
| **Token** | `Authorization: Basic …`, `credentials: "omit"` | A *service* identity, not a user. `GET /users/me` returns 404 for it — which is how the widget probes whether a real session exists. |
| **Session** | session cookie + `x-csrf-token`, `credentials: "include"` | The signed-in viewer. CSRF is read from `window.we.authMgr.csrfToken`, falling back to `window.csrfToken`, a cookie, then a `<meta>` tag. |

`Authentication: auto` (the default) tries the token first and upgrades to the
session where that unlocks more:

- `GET /reactions?parentId=…&parentType=post` is declared `@Authenticated(types=[USER])`
  on the backend, so a token identity gets **403**. Under a session it returns
  each reaction's **type**, which upgrades Top Reactor from a flat like count to
  a typed donut. Without a session the widget falls back to
  `GET /posts/{id}/likes`, which works with a token but is untyped.

Two rules are carried over from the task widgets and matter:

- **Always target the configured Base URL, never `location.origin`.** On mobile
  the widget runs under a `capacitor://` origin, where `location.origin/api`
  hits the local app shell and returns `index.html`.
- Requests targeting the theming endpoint deliberately omit the cookie, so brand
  colors resolve against the token rather than the (possibly less privileged)
  viewer.

Enable **Debug Mode** to see the ladder's decisions on screen — the console is
not reachable in the mobile app. It also reports **exactly which channels and
posts were skipped** and why, which is what turns the "partial data" note from a
shrug into something diagnosable.

### Portraits

`GET /users` only carries a 48px `icon` and a 200px `thumb` derivative, and the
48px one is visibly soft behind the 132px champion portrait on a retina display.
`GET /profiles/public/{id}` returns a larger `avatarUrl`, and because that URL is
a transform chain the widget rewrites its `c_fill,w_200,h_200` segment to ask for
a 400px render — with the API's own URL kept as an `onerror` fallback, since the
URL shape is not ours to depend on.

That endpoint is **USER-authenticated** (an unauthenticated call returns
`NotLoggedInException`), so it only resolves under a session. It is therefore a
pure enhancement: it runs *after* the deck is on screen, patches the existing
`<img>` in place rather than re-rendering — a re-render would replay every
entrance animation for a cosmetic change — and leaves the `/users` avatar
standing if it fails.

### Profile hovercards

Every avatar and name is a `/profile/<id>` link carrying `data-uid`, so
Staffbase's own profile affordances attach. The widget adds its own hovercard on
top, showing position, department and location after a 220 ms dwell.

The card is appended to `<body>`, not to the widget: the deck animates slides
with `transform`, and a transformed ancestor re-bases `position: fixed`, which
would drag the card along with the slide. Living outside `.sbel-root` means it
inherits none of the scheme tokens, so they are copied onto it at show time.

## Time periods

One period drives every tile, but each data source filters differently:

| Source | Filtering |
|---|---|
| Comments | Server-side, SCIM2: `filter=created ge "…" and created le "…"` |
| Post shares/clicks | Server-side: `since`/`until` on `/branch/analytics/posts/rankings` |
| Reactions, posts | Client-side, on each item's `created`/`published` |

> ⚠️ On `/branch/analytics/posts/rankings` **only `since` and `until` are real**,
> and they must be RFC3339 *with* a zone (`2026-06-01T00:00:00Z`). `from`/`to`,
> `start`/`end`, `startDate`/`endDate` and `dateFrom`/`dateTo` all return `200`
> and are **silently ignored** — an easy way to ship a period filter that does
> nothing.

Because reactions cannot be narrowed server-side, the widget caches the **raw,
un-windowed** event set and applies the period in memory. Changing the period
therefore costs **zero requests**, which is what makes the viewer-facing period
picker cheap.

### Custom ranges

**Custom range** turns the period picker into a pair of native date fields.
They are honoured everywhere a preset is: the same `since`/`until` pair is
threaded into the SCIM2 comment filter and the analytics call, and applied in
memory to reactions and posts. The end date is extended to the **last instant**
of the day chosen, so picking the same day for both bounds returns that whole
day rather than nothing.

Each field constrains the other (`from` sets the other's `min`, `to` sets its
`max`), so an inverted range cannot be entered. Switching to `custom` seeds the
fields from whichever preset was showing, so the first render after switching is
never empty.

Because the raw event set is cached un-windowed, dragging the range around costs
**zero requests** for everything except the share analytics, which is cached per
range instead.

### Auto-widen is per tile, not global

Share data and person data often have very different recency — a branch can have
healthy sharing over the last 90 days while its newest comment is six months
old. So when a tile's metric yields nothing in the selected period, **that tile
alone** falls back to all time and says so. A single global period header would
misreport one source or the other.

Turn this off with **Fall Back to All Time When a Period Is Empty** if you would
rather show a truthful empty state.

## What the API cannot do

Researched against the product source; worth knowing before someone asks for it:

- **There is no per-user engagement endpoint.** The analytics `groupBy` enum
  accepts only `channelId` and `spaceId` — anything else returns
  `400 invalid groupBy`. Every person-level metric here is therefore derived
  client-side.
- **`/branch/analytics/users/rankings` exists but is feature-flag gated**,
  returning `401 "missing necessary feature flags"`. The widget never depends on
  it.
- **There is no per-user share attribution.** No advocacy or share-tracking
  service exists, so Social Advocacy is honestly framed as *post*-level: the
  most-shared post, with its author credited alongside.
- `/posts/{id}/comments` returns 403 for a token; the branch-level `/comments`
  is the working substitute.
- Access-restricted channels return 403 on their reaction lists. Those posts are
  skipped and surfaced as a "partial data" badge, never as a failure.

## Performance

Reading reactions costs **one request per post**, so a branch with 500 posts is
500 requests. Mitigations, all on by default:

- Requests are concurrency-capped (4) with `Retry-After`-aware backoff. Rapid
  fan-out against the API produces spurious 403s that clear after a pause, so
  this is load-bearing, not decorative.
- **Max Posts to Scan** (default 200) bounds the fan-out.
- The reduced event set is cached in `sessionStorage` for **Cache Lifetime**
  minutes (default 15), keyed on base URL + channels + post cap. **Refresh**
  bypasses it.

For large branches the right long-term answer is server-side pre-aggregation
(see `HANDOVER.md`), not a bigger client-side fan-out.

## Charts

Hand-rolled HTML/CSS/SVG — deliberately **no chart library**. Every data point
is a person's photo, and avatar URLs 404 often enough that an `<img onerror>`
gradient-initials fallback is mandatory. Canvas (chart.js) cannot do that, and
SVG `<image>` has no usable error path, so inside SVG charts the avatars are
absolutely-positioned HTML overlays.

Every avatar and name is wrapped in `internal-link clickable` +
`/profile/<id>` + `data-uid`, which is the markup Staffbase's own author links
use — so the native profile hovercard attaches to chart nodes.

All charts carry `role="img"` and an `aria-label` spelling out the underlying
numbers, respect `prefers-reduced-motion`, and degrade to a plain winner +
number when a metric has fewer than two data points.

## Motion

There is **one** authored moment — the champion reveal — and it is replayed per
slide, which is correct here because the deck is a rotation rather than a
scroll. The avatar scales in out of a blur, the text rises staggered behind it,
the headline number counts up on `requestAnimationFrame`, bars grow from zero
and arcs draw themselves. The exit (200ms) is deliberately faster than the
entrance (~620ms) so a rotation never feels like it is dragging its feet.

Two rules the implementation holds to:

- **Every animation starts from an already-visible resting state.** If the
  script fails, the content is still there — motion is never load-bearing.
- **Ambient motion is gated.** The slow brand-light drift only runs while the
  widget is on screen (`IntersectionObserver`) and the tab is visible
  (`visibilitychange`), and the whole system collapses under
  `prefers-reduced-motion: reduce`.

The deck stacks its slides in a single grid cell so one can cross-fade over
another, and then **animates its own height to the active slide**. Stacking
alone would leave the deck as tall as its tallest slide — several hundred pixels
of void under the short ones — while sizing to content naively would make the
page jump on every rotation. Measuring and easing avoids both.

## Color schemes

**Color Scheme** offers `dark` (the default broadcast stage), `light`, and
`auto`, which follows the viewer's `prefers-color-scheme`.

Both schemes come from one stylesheet. Every surface value is a custom
property, and the pivot is `--tint`: the colour laid over the background at low
alpha to build panels, bar tracks and hairlines. It is white on the dark stage
and near-black on the light one, so a single `rgba(var(--tint), .08)` inverts
correctly in both.

The light scheme is deliberately **not** a straight inversion — the brand
washes, ambient glow and the numeral's glow are all pulled right back or
switched off, because the same intensity that reads as atmosphere on black
reads as a stain on white.

## Theming

With **Use Theme Colors** on (the default) the widget reads the tenant palette
from `/api/theming/themes/primary`, the same source the task widgets use, and
then adapts it **to the active colour scheme**: on the dark stage it takes the
most saturated brand colour and *lightens* it until it clears 4.5:1 against
near-black; on the light stage it darkens instead. Getting this backwards is
what makes a deep navy or maroon either vanish into the background or glare off
it.

Type is deliberately `font-family: inherit` — the widget adopts the tenant's own
brand font rather than importing a display face, which would be heavy, a CSP
risk, and foreign to the surrounding intranet. The display voice comes from
scale, weight, tight tracking and tabular numerals instead.

## Surviving Staffbase's global CSS

Staffbase ships page-level rules that reach into widget markup — most
destructively `button { width: 90%; margin: auto }`, a global button
`background` on `:hover/:focus/:active`, `button { color: #fff }`, and default
list, heading and `img { max-width }` rules. They carry no `!important`, but
`button:hover` still out-specifies a single-class widget rule, so a widget that
styles a `<button>` normally gets a 90%-wide button in a colour it never chose.

The defence is a `HOST_RESET` block at the top of the stylesheet, split in two
halves — and **the split is the whole trick**:

1. **Base defaults**, stated once on `.sbel-root button`. Kept at low
   specificity (one class + one element) precisely so the widget's own component
   rules can override them normally.
2. **Per-state neutralisation** on `:hover/:focus/:focus-visible/:active`,
   carrying *only* `background`, `color`, `box-shadow` and `outline` — the
   properties Staffbase genuinely re-declares per state.

Geometry deliberately does not appear in (2). `width` and `margin` are set by
the host on the base rule only, so neutralising them once in (1) is sufficient;
repeating them per state pushes the reset above the widget's own component
rules and collapses every round button into a tall sliver the instant it is
hovered or pressed.

The same specificity trap bites content, not just controls: `.sbel-root p` and
`.sbel-root ul` zero out margins with `!important`, which silently killed the
spacing under every caption and chart legend until those rules were re-stated
as `.sbel-root .sbel-ssub` / `.sbel-root .sbel-legend`. **Any spacing rule on a
`<p>`, `<ul>` or heading inside this widget must out-specify the reset or it is
a no-op.**

### `StyledRichText` and the `!important` escape hatch

Inside a news article the widget is wrapped in Staffbase's rich-text container,
whose generated rule is roughly:

```
.css-<hash>-StyledRichText-getWowRichTextCss p:not(blockquote > p):not(…)×4 { color; font-size; font-weight; line-height; margin }
```

That is specificity ~(0,6,7) — out-specifying it with plain selectors is not
realistic. It carries **no `!important`**, though, so the widget wins by pinning
the properties: `.sbel-root p` re-declares `color`, `font-size`, `font-weight`,
`font-style` and `line-height` as `inherit !important`.

The narrow scope is deliberate. The host rule targets a **bare `p`**, so the
blast radius is only the widget's two `<p>` elements — the slide caption and the
empty state. An earlier, broader reset across every text element was reverted:
it fixed nothing extra and made the widget's own typography unoverridable.

This mirrors and extends the fix documented in
`tasks/my-tasks-widget/my-tasks-widget.ts`.

## Configuration reference

| Setting | Default | Notes |
|---|---|---|
| API Token | *(empty)* | Required |
| Base URL | *(empty)* | Must include `/api` |
| Authentication | `auto` | `auto` / `token` / `session` |
| Time Period | `90d` | `all` / `7d` / `30d` / `90d` / `12m` / `custom` |
| Fall Back to All Time | on | Per-tile auto-widen |
| Let Viewers Change the Period | on | Re-filters from cache, no requests |
| Layout | `slideshow` | `slideshow` / `grid` |
| Color Scheme | `dark` | `dark` / `light` / `auto` (follows the viewer's device setting) |
| Rotate Automatically | on | Slideshow only; pauses on hover, focus, touch-hold, offscreen and in a hidden tab |
| Seconds Per Metric | 8 | Slideshow only |
| Show Most Active … Show Social Advocacy | all on | One checkbox per metric |
| People Per Metric | 5 | 2–10 |
| Limit to Channel IDs | *(empty)* | Comma-separated |
| Exclude User IDs | *(empty)* | Comma-separated |
| Max Posts to Scan | 200 | One request each |
| Cache Lifetime | 15 min | `sessionStorage` |
| Show Engagement Map | off | Full-width breadth × volume scatter |
| Animate Charts | on | Yields to `prefers-reduced-motion` |
| Use Theme Colors | **on** | Pulls the brand palette from `/api/theming/themes/primary` and re-tunes it for the dark stage. Off falls back to the Primary/Accent pickers. |
| Show Sample Data When Unconfigured | on | Badged as sample |
| Debug Mode | off | On-screen log |

## Privacy

A named leaderboard is sensitive in some jurisdictions. **Exclude User IDs** is
provided, and as with the other token-based widgets the client-side token is
**not a security boundary** — it can read more than a given viewer should. Set
**Authentication** to `session` where that matters.

## Development

```bash
npm install
npm run type-check   # tsc --noEmit
npm run build        # -> dist/engagement-leaderboard.js
open preview.html    # local harness; blank config renders sample data
```

| File | Role |
|---|---|
| `engagement-leaderboard.ts` | Block definition, config schema, styles, render loop |
| `api.ts` | Auth ladder, throttled HTTP, one full data pass |
| `aggregate.ts` | Windowing, per-user stats, metric selectors, tile building |
| `charts.ts` | Champion, field, and the per-metric flourishes |
| `icons.ts` | Authored SVG icon set — one distinct mark per metric, plus state and chrome icons. No emoji, no icon font. |
| `types.ts` | Shared vocabulary |
| `strings.ts` | i18n bundles (en, de, fr, fr-CA, es, es-MX, nl) |
