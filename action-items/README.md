# Action Items

A Staffbase widget that renders a branded action-item board from a JSON list. Tasks are authored
directly in the widget configuration — no integration or backend required — and the card picks up
your brand colors, either from the app's branding theme or from manual color pickers.

Viewers can check items off, and add timestamped notes to any item.

## Configuration

| Field | Description |
| --- | --- |
| **Tasks JSON** | The list of tasks. See the shape below. |
| **Widget Title** | Header text, shown next to the count of open items. Defaults to "My Action Items". |
| **Use Theme Colors** | Pulls Primary & Accent from the app's branding theme (needs the API Token). Hides the manual pickers. |
| **Primary Color** | Header bar, checkboxes and buttons. Shown when Use Theme Colors is off. |
| **Accent Color** | Count pill, completed checkmarks and note highlights. Shown when Use Theme Colors is off. |
| **Dark Mode** | Renders the card on a dark surface with light text. |
| **Background Color** | Overrides the card background. Leave blank to follow the light/dark surface automatically. |
| **Keep Completed Tasks Visible** | When on, completed tasks stay in the list with a strikethrough. When off, they fade out once checked. |
| **API Token** | Staffbase Basic auth token. Only needed for Use Theme Colors. |
| **Base URL** | Staffbase API base URL. Only needed for Use Theme Colors. |

## Tasks JSON

An array of objects. Only `title` is required — everything else is optional, and entries without a
usable title are skipped.

```json
[
  {
    "title": "Fix Login Timeout on Proctor App",
    "tag": "JIRA-402",
    "tagStyle": "ticket",
    "priority": "high",
    "dueDate": "today"
  },
  {
    "title": "Q1 Security Compliance Review",
    "tag": "Governance",
    "tagStyle": "category",
    "priority": "Pending Approval",
    "dueDate": "today+7"
  }
]
```

| Field | Notes |
| --- | --- |
| `title` | Required. The task text. |
| `tag` | Small badge, e.g. a ticket key or a category. |
| `tagStyle` | `ticket` (blue, default) or `category` (tinted with your primary color). |
| `priority` | `high`, `medium` or `low` render as a colored dot plus a label. Any other value is shown verbatim as status text, e.g. `Pending Approval`. |
| `dueDate` | `YYYY-MM-DD`, or the relative forms `today`, `today+7` and `today-3`. Dates in the past are flagged as overdue. |

Relative due dates are resolved when the widget renders, so a configured board keeps reading as
current without anyone editing the dates.

If the JSON can't be parsed, the widget falls back to a neutral empty state and logs the problem to
the browser console rather than breaking the page.

## Branding

Colors are resolved against the surface the widget is actually painting on. A brand color is left
exactly as configured when it already has enough contrast, and is only lightened or darkened when it
would otherwise be unreadable — so a dark navy primary stays navy on a white card and is lifted just
enough to survive in dark mode.

With **Use Theme Colors** on, the widget reads the branding theme with the API token, picks the most
readable saturated color for on-surface use and the most vivid one as the accent, and repaints once
the theme resolves.

## Development

```bash
npm install
npm start        # dev preview with a live config form at http://localhost:9000
npm test
npm run type-check
npm run lint
npm run build    # emits dist/staffbase.action-items.js
```

## Notes

Completed state and notes live in the widget for the session and reset on reload, the same way the
`static-tasks` widget behaves.
