# Engagement Leaderboard

A Staffbase widget that renders a grid of engagement metric tiles — who
comments, who reacts, who publishes, and which posts get shared — computed live
from branch data.



## Metrics

| Tile | Definition | Chart |
|---|---|---|
| **Most active** | `comments + reactions given + posts authored` — raw volume | Podium |
| **Most engaged** | Weighted for depth *and* breadth: `3·comments + 1·reactions + 5·posts + 2·distinct posts touched + 4·distinct channels touched` | Podium + composition bar |
| **Top commenter** | Comments authored | Avatar bars |
| **Top reactor** | Reactions given | Avatar bars, or a typed donut under session auth |
| **Most appreciated** | Reactions received on their own posts | Avatar bars |
| **Top contributor** | Posts published | Avatar bars |
| **Rising star** | Biggest increase in activity vs. the immediately preceding equal-length period | Slope chart |
| **Social advocacy** | Most-shared posts in the period, credited to their author | Two-tone share/click bars |

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
not reachable in the mobile app.

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

## Configuration reference

| Setting | Default | Notes |
|---|---|---|
| API Token | *(empty)* | Required |
| Base URL | *(empty)* | Must include `/api` |
| Authentication | `auto` | `auto` / `token` / `session` |
| Time Period | `90d` | `all` / `7d` / `30d` / `90d` / `12m` / `custom` |
| Fall Back to All Time | on | Per-tile auto-widen |
| Let Viewers Change the Period | on | Re-filters from cache, no requests |
| Metrics | all 8 | Multi-select |
| People Per Tile | 3 | 1–10 |
| Limit to Channel IDs | *(empty)* | Comma-separated |
| Exclude User IDs | *(empty)* | Comma-separated |
| Max Posts to Scan | 200 | One request each |
| Cache Lifetime | 15 min | `sessionStorage` |
| Show Engagement Map | off | Full-width breadth × volume scatter |
| Animate Charts | on | Yields to `prefers-reduced-motion` |
| Use Theme Colors | off | Otherwise Primary/Accent pickers |
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
| `charts.ts` | Podium, bars, donut, slope, share bars, bubble map |
| `types.ts` | Shared vocabulary |
| `strings.ts` | i18n bundles (en, de, fr, fr-CA, es, es-MX, nl) |
