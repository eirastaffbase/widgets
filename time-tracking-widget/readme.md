# Time Tracking (clock in / clock out)

A Staffbase widget that lets a user clock in and out, with a live timer.

All state lives on the viewer's **own profile**, in two fields you nominate:

| Field | Holds |
|---|---|
| status field (default `clocked-in`) | a configurable true/false string |
| time field (default `clocked-time`) | the session: `IN:<time> \| OUT:<time> \| DAY:<minutes>` |

Because the running time is derived from the stored timestamp rather than from
anything local, the timer is correct after a reload, on a second device, or when
the app has been backgrounded for hours.

### The time field format

The time field holds the whole session rather than a single instant:

```
clocked in :  IN:2026-09-16T11:43:07.203Z | DAY:199
clocked out:  IN:2026-09-16T11:43:07.203Z | OUT:2026-09-16T15:02:11.000Z | DAY:398
```

- **`IN` / `OUT`** — the current or most recent session's boundaries. Keeping
  both is what makes *last session length* real: it's computed from the two
  stored timestamps, so it survives a reload and reads the same on every device.
- **`DAY`** — minutes already banked earlier the same day. Without it, "Worked
  Today" would silently drop every session but the last one on a multi-session
  day. It resets automatically when the last recorded event was on an earlier
  date, so yesterday's total never leaks into today.

The field is visible on the user's profile page, hence the readable spaced-pipe
separator. Parsing is deliberately more forgiving than writing — tokens may
appear in any order, with any spacing or separator, so a hand-edited value still
works. A plain ISO timestamp (the format earlier versions of this widget wrote)
is still understood and is treated as the single clock event.

## Setup

1. In **Studio → Settings → Profile Fields**, create two text fields and note
   their slugs. The defaults the widget expects are `clocked-in` and
   `clocked-time`, but any slugs work.
2. Add the widget to a page and fill in:
   - **API Token** — a Base64 Basic token for your instance.
   - **Base URL** — e.g. `https://yourorg.staffbase.com/api`.
   - **Status / Clock Time Profile Field Slug** — the two slugs from step 1.
3. Everything else has a working default.

> If a slug doesn't exist, clocking in fails with the API's own message —
> *"Parameter 'x' is invalid."* — shown directly in the widget. That's the
> fastest way to spot a typo.

### Whose profile gets clocked

Always the viewer's. The widget resolves them with
`widgetApi.getUserInformation()` — the same call `tasks/audit-widget` uses — and
reads and writes only that id. There's no user setting, and no acting-admin
`USERID` header: the service token was verified to write a profile without one.

## Settings

| Setting | Default | Notes |
|---|---|---|
| API Token | — | required |
| Base URL | `https://app.staffbase.com/api` | |
| Status Profile Field Slug | `clocked-in` | |
| Clocked-In / Clocked-Out Value | `true` / `false` | matching is case-insensitive |
| Clock Time Profile Field Slug | `clocked-time` | |
| Target Hours Per Day | `8` | drives the "of 8h target" sub-line |
| Break (minutes) | `30` | **set to 0 to hide the Break card** |
| Worked Today Baseline (minutes) | `0` | added on top of what's recorded; demo seed |
| Last Session (minutes) | `0` | fallback only, until a real session is recorded |
| Refresh App After Clocking | off | see below |
| Refresh Destination | *(blank)* | page to land on; blank = stay put |
| Also Refresh On Desktop | off | refresh is mobile-only unless this is on |
| Use Theme Colors | off | pulls Primary/Accent from the branding theme |
| Primary / Accent / Background Color | `#0EA5E9` / `#0EA5E9` / transparent | |
| Debug Mode | off | on-screen log with a copy button |

## Refreshing

The widget **always** refreshes itself after clocking: it re-reads the profile
from the server and repaints. It never trusts the optimistic local value,
because the API's `PUT` response doesn't echo custom profile fields back — the
re-read is the only real confirmation the write landed.

**Refresh App After Clocking** additionally refreshes the surrounding app view.
It routes through the app's own router (`NavigationMgr`), so it is *not* a page
reload — on mobile the user keeps their place. It only falls back to a real page
load if the router isn't available.

Two settings appear once it's on:

**Refresh Destination** — where to land. Leave it blank to stay on the current
page. Otherwise give a page path (`/content/page/123abc`); a bare path picks up
its leading slash, and a full URL on your own domain is reduced to its path so
the router can handle it in-app. A URL pointing at *another* host can't be
routed, so it becomes a real navigation instead — and an unparseable one falls
back to the current page rather than stranding the user.

**Also Refresh On Desktop** — off by default. The refresh earns its keep in the
mobile app, where sending someone back to a landing page after clocking in is
the point. In a desktop browser the same move yanks the page out from under
someone who may be mid-scroll, so it's opt-in. "Mobile app" means
`window.we.native` is present — the real native shell, not a narrow browser
window.

## Behaviour notes

- **"Unset" has two shapes** — the field missing entirely, or present but empty.
  Both read as clocked out.
- **Sessions are kept on the server, not in memory.** Clocking out keeps the
  `IN` stamp and adds an `OUT` one, so "Last session" and "Worked Today" are
  derived from the profile and stay correct across reloads and devices. The
  *Last Session (minutes)* setting is only a fallback for a profile that has
  never recorded a complete session.
- **A stale day is never counted.** If the last recorded event was on an earlier
  date, the banked `DAY` total is ignored and reset on the next clock-in, so
  yesterday's hours can't inflate today's.
- **Sub-minute sessions** are reported as a plain "Last clocked out at" rather
  than "Last session: 0min".
- **The `PUT` merges.** Only the two clock fields are sent, and everything else
  on the profile (points, avatar, names…) is left alone.
- **Clock skew** — elapsed time is the client clock against a server timestamp.
  A device clock set ahead would produce a negative duration, so it's clamped to
  `00:00:00` rather than rendering nonsense.
- Double-tapping the button can't double-write; the action is guarded while in
  flight.

## Security

Same posture as the other widgets in this repo, with one difference worth
stating plainly: this widget can **write** to user profiles. The Basic token
sits in the widget configuration and is readable by anyone who can read the
page, so anyone who extracts it can write to any profile field the token
permits — not just their own.

That makes it fine for demos and pilots, and not something to ship broadly
without moving the token behind a backend. See `HANDOVER.md` at the repo root,
which already tracks this for the task widgets.

## Development

```bash
npm install
npm run build      # -> dist/time-tracking-widget.js
npm start          # webpack --watch
```

`preview.html` runs the built bundle in one of two modes. It deliberately
injects button/list/image CSS over the widget to approximate the host styles
Staffbase applies in the real app.

- **Mock** (default) — an in-memory fake profile API that reproduces the real
  one's behaviour: the `PUT` merges rather than replaces, unknown slugs return a
  400, and the `PUT` response omits custom fields. Needs no credentials, and
  includes a "fail the next write" button for the error path.
- **Live** — talks to `https://q1eira26.staffbase.com/api` against the
  `clocked-in` / `clocked-time` fields. Paste a Basic token, hit *Load users*,
  pick someone, and the widget reads and writes that person's **real profile**.
  The seed buttons write too, so you can set up a state and then clock against
  it. Finish with *Reset: never clocked* to leave the tenant clean.

The token is held in `localStorage` only (memory if the browser blocks storage
on `file://`) and is never written into the file — don't hardcode one there.
The tenant URL and field slugs are hardcoded because that's the only tenant
this is exercised against; change the three constants at the top of the harness
script to point it elsewhere.
