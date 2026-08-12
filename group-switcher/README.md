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
| Use Theme Colors | no | Reads the accent from the app's branding theme. Needs the API Token. |
| Accent Color | no | Shown only when Use Theme Colors is off. Defaults to `#1f6feb`. |
| API Token | no | Staffbase Basic auth token. Theme lookup only. |
| Base URL | no | Staffbase API base URL. Defaults to `https://app.staffbase.com/api`. |

### Groups JSON

A JSON array. Each entry:

| Key | Required | Notes |
| --- | --- | --- |
| `id` | yes | The group ID. |
| `name` | no | Overrides the name read from `GET /api/groups/{id}`. |
| `description` | no | A supporting line under the name. |
| `icon` | no | An image URL or data URI, or one of the built-in icon names. |

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

### Icon names

`users`, `building`, `briefcase`, `store`, `warehouse`, `factory`, `truck`,
`car`, `ship`, `plane`, `tractor`, `package`, `cart`, `hospital`, `health`,
`pharmacy`, `lab`, `school`, `book`, `bank`, `government`, `legal`, `tech`,
`laptop`, `telecom`, `energy`, `fuel`, `construction`, `tools`, `hammer`,
`safety`, `hotel`, `restaurant`, `support`, `marketing`, `design`,
`environment`, `global`.

Unknown names fall back to `users`. To change the set, edit
`scripts/generate-icons.js` and run `npm run icons`.

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
- CSRF token discovery is best effort. If no token is found the request is still
  attempted, since the session cookie is usually sufficient.
- Group name lookups run in parallel. If the endpoint is unavailable the widget
  still works, falling back to the group ID.
