# Widget Localization Plan

Localize the Staffbase task widgets to the viewing user's language — both the
widget's own UI (chrome) and, optionally, the user-generated task content —
**without changing anything for users who don't opt in.**

Widgets in scope: `my-tasks-widget`, `recurring-tasks-widget`, `audit-widget`.

---

## 0. Guiding principle — backward compatibility is non-negotiable

**If a user is using the widget in English and nobody opts a task into
translation, NOTHING changes.** Byte-for-byte identical render, identical stored
data, identical behavior, for all three widgets.

- Chrome localization only swaps visible labels for a non-English detected
  locale. For `en_US` the strings resolve to the exact text already in the code.
- Task-content localization is **lazy and opt-in**: a task's `title`/
  `description` are only ever modified if a human explicitly clicks `+` to add a
  language to that task. Untouched tasks stay plain strings.
- No new required config, no new network calls on the hot path for English
  users (detection piggybacks on a user fetch we already do).

---

## 1. What we verified (live API, Panda env)

| Question | Finding |
|---|---|
| Does `widgetApi.getUserInformation()` expose locale? | **No.** It returns custom profile fields only (id, groupIDs, `ispeak`, etc.). No `locale`/`config.locale`/`language`. |
| Does `navigator.language` / `<html lang>` reflect the Staffbase language? | **No.** After switching the user to German, both stayed `en-US` / `en`. They reflect the browser/OS, not Staffbase. |
| What reflects the Staffbase language? | **`GET /api/users/{id}` → `config.locale`** (became `de_DE` on switch). Authoritative source. |
| Which locales does the env support? | **`GET /api/branch` → `config.availableLocales`**: `en_US, es_ES, zh_CN, th_TH, fr_FR, ja_JP, de_DE, nl_NL`. |
| Does the Tasks API support localized content natively? | **No.** A task has only flat `title` / `description` strings (verified full object: `id, createDate, updateDate, title, description, status, dueDate, assigneeIds, groupIds, priority, taskListId, creatorId, creatorType, isArchived, attachmentIds`). No localization field. |
| Is there a translation API we can use? | **Yes — `POST /api/translations`.** Works with the widget's existing API-key Basic auth (no cookie/CSRF needed). Handles CJK + RTL. Preserves HTML tags, translates text nodes only. |

**Gotcha:** the translation endpoint translates *everything*, including our
control markers (`[type: Finance]` → `[Typ: Finanzen]`). We must protect markers
before translating.

---

## 2. Locale detection

Priority order, normalized (`en-US`/`en_US` handled), matched exact → language
prefix → default:

1. `GET /api/users/{currentUserId}` → `config.locale` (authoritative). We already
   have `currentUserId` from `getUserInformation()` and already fetch users, so
   this is effectively free.
2. `navigator.language` (last-ditch fallback).
3. `en_US` (default).

`GET /api/branch` → `config.availableLocales` is fetched once (cached) to bound
which bundles/locale options are offered.

---

## 3. Shared engine: `tasks/shared/i18n.ts`

One module, imported by each widget via relative path (webpack inlines it into
each bundle — no monorepo tooling needed). Per-widget string bundles live in the
widget.

Exports:
- `resolveLocale(raw, available)` — normalize + match (exact → language-prefix → `en_US`).
- `detectLocale()` — runs the priority chain in section 2.
- `isRtl(locale)` — backed by the RTL language set (`ar, fa, he, ur, ps`) from the
  Staffbase locale table.
- `makeT(strings, locale)` → `t(key)` with **per-key fallback to `en_US`** (missing
  translations degrade to English, never break).
- `translate({ source, target, value })` — wrapper over `POST /api/translations`
  using the widget's existing Basic auth.
- `protectMarkers(text)` / `restoreMarkers(text, tokens)` — strip control markers
  before translating, re-attach verbatim after (see section 6).
- Task-content blob: `encodeI18n()`, `parseI18n()`, `stripI18n()` (see section 5).

---

## 4. Phase A — UI chrome localization (independent, unblocked)

Static, curated string bundles. No network call on load.

1. Build `tasks/shared/i18n.ts` (section 3).
2. Wire `detectLocale()` off the existing user fetch; fetch branch
   `availableLocales` once; **remove the temporary `LOCALE-PROBE` block** from
   `my-tasks-widget.ts`.
3. **Extract** every hardcoded UI label in each widget into a per-widget
   `STRINGS` table and route through `t()`. (This is the bulk of the work.)
4. **RTL:** apply direction + mirrored CSS — see **section 7** for the full RTL
   approach, per-widget hotspots, and testing.
5. **Pilot bundles:** `en_US` + `de_DE` + one RTL (`ar_SA` or `he_IL`) to exercise
   the RTL path. `en_US` is the canonical/source bundle = exact current strings.

> Backward-compat check: with locale `en_US`, `t(key)` returns the existing text
> verbatim and `dir` is unset → identical render.

---

## 5. Phase B — Task content localization (opt-in, layered after A)

### Behavior
- **No `+` clicked → no change.** `title`/`description` untouched, no blob, nothing
  leaks into native Staffbase views.
- **`+` clicked → opt-in:**
  1. Detect the **current user's locale** — this becomes the **source-language
     tag** wrapping the existing base text.
  2. Auto-translate `title` + `description` into the chosen target locale(s) via
     `/api/translations` (markers protected).
  3. Author is shown the result and can edit before saving (forced review,
     especially the type label — section 6).
  4. Store encoded in `title`/`description` on create/PATCH.
- **Read path:** parse the blob, pick the viewer's locale, **fall back to the
  source-locale text** if their locale isn't present, and **strip the blob** from
  display in the widget.

### Accepted tradeoff
Encoded translations live in `description`, so Staffbase's **native** task views /
mobile / notifications / search show the raw blob. This is accepted, and only
occurs for tasks a human explicitly opted in.

### Encoding format
- Base text stays first and human-readable (so even native views lead with real
  content). Translations appended as a single compact trailer block, e.g.
  delimited by sentinel tokens that the widget parses and strips.
- Must coexist with existing markers (`[type:]`, `[lvl:]`, `Severity:`,
  `Audit finding:`) and the recurring widget's schedule encoding.
- Stores, per locale: translated title, translated description, translated type
  **label**, and the **source type value** (for color anchoring).

---

## 6. Type markers & color anchoring

The `[type: X]` marker has two parts, handled differently:

- **Key `type`** — structural. Never translated; always protected. The parser and
  filters depend on it.
- **Value (e.g. `Finance`)** — auto-translated **per-locale, per-task**; the author
  is **forced to review/update** the translated label when adding a language. So
  the German entry genuinely stores `Finanz`.

**Color anchoring (decided):** `typeColor()` (`my-tasks-widget.ts:117-131`) hashes
the type string to a palette color, so `Finance` and `Finanz` would otherwise get
different colors per language. To keep color identity stable across locales, we
**store the source-locale type value alongside the translated label and feed the
source value to `typeColor()`** regardless of display language. Result: badge
*reads* `Finanz` for a German user, but the color matches the English `Finance`
chip.

**Marker protection (general):** before sending any text to `/api/translations`,
strip all control markers to placeholder tokens, translate the clean human text,
then re-attach the markers verbatim.

---

## 7. RTL (right-to-left) support

RTL is a first-class requirement, not an afterthought — it's why an RTL language
is in the pilot. It is cross-cutting and affects all three widgets.

### Which locales are RTL
Language prefixes flagged `direction: right_to_left` in the Staffbase locale
table: **`ar` (all Arabic variants), `fa`, `he`, `ur`, `ps`**. `isRtl(locale)` in
`tasks/shared/i18n.ts` resolves these by language prefix (so `ar_SA`, `ar_AE`,
`ar_EG`, `fa_IR`, `fa_AF`, etc. all return true).

### What we flip
1. **Direction attribute** — set `dir="rtl"` on each widget's root element when
   `isRtl(detectedLocale)`. This flips text direction and base inline flow for
   free.
2. **Direction-sensitive CSS** — anything using physical `left`/`right`,
   `margin-left`, `padding-right`, `text-align: left`, `transform` arrows, etc.
   does **not** flip automatically. Two-pronged approach:
   - Convert to **logical properties** where cheap: `margin-inline-start`,
     `padding-inline-end`, `inset-inline-start`, `text-align: start/end`. These
     mirror automatically under `dir="rtl"`.
   - Add a scoped **`[dir="rtl"] { ... }` override block** per widget for the
     stubborn bits that aren't worth converting wholesale.

### Per-widget RTL hotspots to audit
- **my-tasks-widget:** comment chips/overflow layout, type-dot + label ordering,
  dropdown/menu positioning (`left`/`right`), the detail panel, refresh/spinner
  placement, attachment chips.
- **audit-widget:** the timer layout and button arrangement (recently reworked for
  mobile — re-check under RTL), question controls.
- **recurring-tasks-widget:** schedule/calendar day layout, occurrence rows.

### Icons & directional glyphs
Chevrons, back/forward arrows, and any progress/sequence affordances must mirror
under RTL (flip with a `[dir="rtl"]` transform or swap the glyph). Avatars,
brand/logo, and status colors do **not** mirror.

### Backward-compat
For LTR locales (incl. `en_US`) `dir` is never set and the `[dir="rtl"]` blocks
never match → zero change to the current experience.

### Testing
The pilot deliberately includes one RTL language (`ar_SA` or `he_IL`) so the
`dir`/CSS path is exercised end-to-end before any real RTL content exists —
otherwise RTL layout bugs stay hidden until the first RTL user appears.

---

## 8. Pilot scope

- Languages: `en_US` (source) + `de_DE` + one RTL (`ar_SA`/`he_IL`).
- All three widgets get chrome localization (Phase A).
- Task-content localization (Phase B) targets `my-tasks-widget` first (it owns task
  creation/editing); extend to recurring/audit as their flows need it.
- Adding the rest of the Panda 8 afterward = authoring more bundles, no new plumbing.

---

## 9. Open / future

- Region variants of one language (e.g. `pt_BR` vs `pt_PT`) are supported by the
  detection design (region-accurate `config.locale`) — no extra work unless bundles
  are authored.
- Native localized task fields would be the "proper" fix for Phase B's blob
  leakage; worth raising with Staffbase if usage grows.
- Optionally seed chrome bundles via `/api/translations` at authoring time, but keep
  the shipped bundles static (no load-time network dependency).

---

## Build order

1. **Phase A** — `tasks/shared/i18n.ts` + detection + chrome extraction + RTL +
   pilot bundles (all three widgets). Remove `LOCALE-PROBE`.
2. **Phase B** — encoding/parse/strip + opt-in `+` authoring UI + marker protection
   + type color anchoring (`my-tasks-widget` first).
