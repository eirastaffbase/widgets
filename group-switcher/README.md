# Group Switcher

A Staffbase custom widget that lets a viewer move themselves between a
configured set of groups.

Picking a group adds the viewer to it, removes them from every other group in
the same configuration, then reloads the app at its root.

The reload is deliberate. Group membership decides what the app is allowed to
show, so a client-side route change would leave the previous persona's
navigation and content on screen. Only a fresh document load re-boots the app
against the new membership.

Switching runs entirely as the viewer's own session, which is what makes it
self-service. No API token is involved. The optional token below is used only to
read brand colors from the theming API.

Only the group IDs listed in this widget's own configuration are ever removed.
Memberships outside that list are left alone.

## Configuration

| Field | Required | Notes |
| --- | --- | --- |
| Groups (JSON) | yes | The list of groups. See below. |
| Use Theme Colors | no | Reads the accent from the app's branding theme. |
| Accent Color | no | Shown only when Use Theme Colors is off. Defaults to `#1f6feb`. |
| API Token | with theming | Staffbase Basic auth token. Theme lookup only. |
| Base URL | with theming | Staffbase API base URL. Defaults to `https://app.staffbase.com/api`. |

The API token is used for exactly one thing: reading the brand palette. Reading
group names, reading descriptions and changing membership all run on the
viewer's own session. Leave Use Theme Colors off and no token is needed at all
— the field isn't even shown.

### Groups JSON

A JSON array. Each entry:

| Key | Required | Notes |
| --- | --- | --- |
| `id` | yes | The group ID. |
| `name` | no | Overrides the name read from `GET /api/groups/{id}`. |
| `description` | no | Overrides the description read from the same endpoint. |
| `icon` | no | An image URL or data URI, or one of the built-in icon names. |

Name and description are both read from the group API. Setting either in the
config overrides the fetched value, so you only need to write the ones you want
to change. Localized fields are handled: a `{ "en_US": "..." }` map resolves to
its first non-empty string. The lookup is skipped entirely when the config
already supplies both fields.

```json
[
  {
    "id": "000000000000000000000000",
    "name": "Manufacturing",
    "description": "Plant floor, maintenance and safety.",
    "icon": "factory"
  },
  {
    "id": "111111111111111111111111",
    "description": "Only \"id\" is required. Everything else is optional.",
    "icon": "https://example.com/logo.png"
  }
]
```

An entry that isn't shaped like this is skipped. JSON that doesn't parse at all
is reported inline, since that's an authoring mistake worth surfacing.

### Icons and images

`icon` accepts either a built-in icon name or an image (any `http(s)` URL or
`data:image/` URI).

The JSON shape doesn't change — you just put a URL in `icon` instead of a name:

```json
[
  { "id": "6a7cb644a3ddb7189dd7d953", "icon": "users" },
  { "id": "6a7cb637b883923553fb506a", "icon": "https://example.com/photo.jpg" },
  { "id": "6a7cb62c97e3273f2740e12e" }
]
```

How an image is displayed depends on the width available:

- **Narrow** — a 40px thumbnail at the left of the row, same shape as an icon.
- **Wide (720px container and up)** — the row becomes a near-square card with
  the image filling a 4:3 frame across the top and the name and description
  beneath it.

Card mode only engages when at least one entry actually has an image. A list of
line icons stays as rows, because a large picture frame around a small glyph is
empty weight.

Mixing the two is allowed: entries still using an icon name get their glyph
enlarged and centred in the same frame. It stays coherent, but a list where
every entry has a picture reads considerably better as cards.

Images are cropped to fill (`object-fit:cover`), so keep the subject near the
centre. Landscape art around 640x480 or wider works best; a tall portrait loses
its top and bottom. Any URL the viewer can reach will do, though a Staffbase
media URL is the safer choice since it is same-origin and behind the same auth.

The card grid is capped at 900px so a very wide host doesn't turn each card into
a billboard.

### Icon names

All 38 are Lucide glyphs, grouped by what they tend to be used for.

**People and places**
`users`, `building`, `briefcase`, `hotel`, `restaurant`, `global`

**Retail and logistics**
`store`, `cart`, `warehouse`, `package`, `truck`, `car`, `ship`, `plane`,
`tractor`

**Industry and trades**
`factory`, `construction`, `tools`, `hammer`, `safety`, `energy`, `fuel`

**Health and science**
`hospital`, `health`, `pharmacy`, `lab`, `environment`

**Knowledge and civic**
`school`, `book`, `bank`, `government`, `legal`

**Tech and office**
`tech`, `laptop`, `telecom`, `support`, `marketing`, `design`

A few aren't literal: `hospital` is a stethoscope, `legal` is scales, `tech` is a
CPU, `safety` is a shield with a check, `support` is a headset, `energy` is a
bolt and `environment` is a leaf.

Matching ignores case and strips spaces, hyphens and underscores, so `Global` and
`hard_hat`-style variants of a real name still resolve. An unrecognised name
falls back to `users` rather than leaving a gap in the layout.

To add one, map your name to any [Lucide
export](https://react-icons.github.io/react-icons/icons/lu/) in the `NAMED`
object in `scripts/generate-icons.js`, then run `npm run build`. Only the names
listed there are bundled, which is what keeps the widget at ~41 KiB instead of
shipping all of Lucide.

## Build

```sh
npm install
npm run build
```

Output is `dist/group-switcher.js`. `npm run build` regenerates the icons first.

## Preview

`preview.html` renders the widget against stubbed Staffbase endpoints in a
light host, a dark host, a narrow column, and the empty and invalid-JSON states.

```sh
npm run build
python3 -m http.server 8899
```

Then open `http://localhost:8899/preview.html`. Add `?delay=800` to hold the
loading state open.

## Notes

- Icons come from Lucide via `react-icons/lu`, rendered to plain SVG strings at
  build time. React is a devDependency and never reaches the browser bundle.
- Neutral colors are derived from the inherited `currentColor`, so the widget
  picks up whatever theme surrounds it rather than imposing its own.
- The list is a single column, switching to two at container widths of 720px and
  up. It measures its own container, not the viewport, so a narrow sidebar stays
  single-column on a wide screen.
- Every CSS rule is prefixed with the root class, giving each a specificity of
  0,2,0. Staffbase's rich-text styles reach the widget as `.css-xxx ul` at 0,1,1
  and would otherwise beat a bare `.gsw-list`, silently dropping `display:grid`
  and collapsing the layout to full-width rows with no gaps. `preview.html` has
  a panel that reproduces those host rules so the guard stays honest.
- CSRF token discovery is best effort. If no token is found the request is still
  attempted, since the session cookie is usually sufficient.
- Group name lookups run in parallel. If the endpoint is unavailable the widget
  still works, falling back to the group ID.
