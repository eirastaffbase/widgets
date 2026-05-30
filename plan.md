# Widget Localization Plan

Localize the Staffbase task widgets to the viewing user's language — both the
widget's own UI (chrome) and, optionally, the user-generated task content —
**without changing anything for users who don't opt in.**

Widgets in scope: `my-tasks-widget`, `recurring-tasks-widget`, `audit-widget`,
`tasks-integration-widget`.

---

## 0. Guiding principle — backward compatibility is non-negotiable

**If a user is using the widget in English and nobody opts a task into
translation, NOTHING changes.** Byte-for-byte identical render, identical stored
data, identical behavior, for all four widgets.

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

## 5. Phase B — On-demand "Translate" button (chosen approach)

Content (free-text the user typed) is translated **on demand, ephemerally** — not
persisted. This removes the native-view leakage, storage, and encoding complexity
of the old approach (kept as a deferred alternative below).

### Two kinds of text
| Kind | Examples | How |
|---|---|---|
| **Fixed UI vocabulary** (enumerated set we control) | priority levels (Normal/Medium/High/Critical), "Recurring" badge, status, buttons/labels | **Chrome strings** (Phase A bundles) — deterministic, no API call |
| **Free-text user content** | task titles, descriptions, **custom type names**, comments, audit question text, schedule titles | **Translate button** — on-demand `/api/translations` |

Priority levels and "Recurring" therefore live in each widget's `strings.ts`.
Types are free-text → translated via the button (display-map, see section 6).

### Behavior
- **Default view = byte-identical to today.** The button is purely additive; zero
  backward-compat risk; nothing is stored.
- **Visibility:** the "Translate" button shows **only when `locale !== "en_US"`**,
  placed in the widget **header**.
- **On click:**
  1. Collect all visible free-text (titles + cleaned descriptions + unique custom
     type names + notes where shown).
  2. **Batch into one API call** — wrap each item in an indexed tag
     (`<p data-i="0">…</p>…`), send as a single `contents.value`; the endpoint
     preserves tags and translates only text nodes, so we parse back by index.
     One call per translate action → trivial volume.
  3. Swap displayed text in place; button toggles to **"Show original."**
     In-memory only.
- **Comments:** press-and-hold a comment → reveals "Translate" → one batched call
  translates all comments in the thread.
- **Caching:** memoize `{sourceText + targetLocale → translation}` per session.
- **Auth:** the **session + CSRF path** (same one comments use), not the API token
  — avoids the token's burst rate-limiting; it's a logged-in on-demand action.
- **Source/target:** `source = branch defaultLocale` (`en_US`), `target = viewer
  locale`.

### Coverage note
Because translation is dynamic, the Translate button covers **all locales the API
supports immediately** — content translation is not limited to the pilot bundles.
Only the *chrome* (Phase A) is pilot-limited (en/de/ar); more chrome locales = v2.

### Scope per widget
my-tasks (cards + types + comments), audit (question text + criteria + notes),
recurring (schedule titles + descriptions + types), tasks-integration (its
content). All four get a header Translate button.

### Deferred alternative — persisted encoding (DOWNGRADED, only if asked)
Earlier design: an opt-in `+` that auto-translates and **stores** translations
encoded in `title`/`description` (per-locale trailer block), so translated content
persists for everyone and across native views. Trade-off: the encoded blob leaks
into Staffbase's native task views / mobile / notifications. Parked unless a
concrete need for *persisted* multi-language task content comes up; the on-demand
button covers the common "I want to read this in my language" case without it.

---

## 6. Types & color anchoring (under the Translate button)

Custom type values (e.g. `Finance`) are **free text** → translated on demand via
the Translate button, as a **display-map over the canonical key**:

- The **canonical key** (`Finance`) always drives filtering, grouping, and color.
- When translated, the German user sees `Finanzen` on chips, the filter dropdown,
  and group headers — but the underlying key stays `Finance`, so logic is untouched.
- **Color anchoring:** `typeColor()` (`my-tasks-widget.ts:117-131`) hashes the type
  string for a palette color. Feed it the **canonical key** (not the translated
  label) so a type's color is identical across locales — chip *reads* `Finanzen`,
  color matches the English `Finance` chip.

**Marker handling:** the Translate button sends the **already-cleaned display
strings** (the widget strips `[type:]`, `[lvl:]`, `Severity:`, `Audit finding:`,
and the recurring schedule encoding before display), so control markers never
reach the API — no separate protection step needed.

---

## 7. RTL (right-to-left) support

RTL is a first-class requirement, not an afterthought — it's why an RTL language
is in the pilot. It is cross-cutting and affects all four widgets.

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

- Chrome languages: `en_US` (source) + `de_DE` + `ar_SA` (RTL). More = v2.
- **Four widgets** get chrome localization (Phase A): `my-tasks-widget`,
  `audit-widget`, `recurring-tasks-widget`, `tasks-integration-widget`.
- Content (Phase B Translate button) works for **all** API-supported locales
  immediately — not limited to the pilot bundles.
- Adding the rest of the Panda 8 chrome afterward = authoring more bundles, no new
  plumbing.

### Phase A status
- ✅ `tasks/shared/i18n.ts` engine; detection wired.
- ✅ `my-tasks-widget`, `audit-widget`, `recurring-tasks-widget` chrome extracted +
  de/ar bundles + RTL `dir`.
- ⏳ `tasks-integration-widget` chrome (pending).
- ⏳ Re-add priority + "Recurring" fixed enums to bundles (my-tasks, recurring,
  others where shown).
- ⏳ RTL CSS polish (physical→logical properties / `[dir="rtl"]` overrides).

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
   pilot bundles across **all four** widgets. Add priority + "Recurring" fixed
   enums to bundles. Remove `LOCALE-PROBE`. (3 of 4 widgets done.)
2. **Phase B** — header **Translate button** (visible when `locale !== "en_US"`):
   batched on-demand `/api/translations`, session/CSRF auth, in-memory cache,
   "Show original" toggle; press-hold translate on comments; type display-map with
   canonical-key color anchoring. All four widgets.
3. **Deferred** — persisted-encoding alternative (section 5), only if a concrete
   need for stored multi-language content arises.
