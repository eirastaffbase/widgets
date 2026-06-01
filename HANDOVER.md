# Handover — Task widgets: move store/access logic server-side

## Context

The task widgets (`my-tasks-widget`, `audit-widget`, `recurring-tasks-widget`,
`tasks-integration-widget`) each talk to the Staffbase API directly from the
browser using a **shared Basic API token** baked into the widget config
(`apitoken` attribute / `DEFAULT_API_TOKEN`). The token is a service identity,
not the viewing user — `GET /api/users/me` with it returns 404.

Each widget builds its list of "stores" (tasks-plugin installations) and, in
`my-tasks`, filters tasks down to the current viewer. The viewer's identity is
obtained client-side via the Staffbase SDK: `widgetApi.getUserInformation()`
→ `{ id, groupIDs }`.

Stores are loaded by `fetchTaskStores()` (duplicated in each of the four
widgets). It:

1. Merges two sources, deduped by id:
   - `GET /installations?limit=200` (filtered to `pluginID === "tasks"`) — the
     original source; this is all that ever showed up, and it only contains
     **unrestricted** stores. This is why Panda Express worked.
   - `GET /plugins/tasks/installations/search?permission=manage&limit=200` —
     the only endpoint that returns **access-restricted** stores (the 7-Eleven
     POC case, where each store is locked to specific users/groups with
     `branchAccess: false`). Best-effort; on failure we fall back to source ①.
2. Filters the merged list to stores the **viewer** may see, using each store's
   `accessors` (`userIds`, `groupIds`, `branchAccess`) compared against the
   viewer's `id` / `groupIDs` from `getUserInformation()`.

**This access filter is client-side only.** The shared token is readable in the
widget config, so a determined user could call the API directly and bypass the
filter. It fixes the UX (people see the right stores) but is **not a real
security boundary.**

## What needs to happen for this to be prod-ready

Move the store-resolution and per-viewer filtering **server-side**, so the
browser never holds a token that can see more than the viewer should:

- Stand up a backend (see Azure note below) that holds the API token as a
  **secret**, never shipped to the client.
- The widget passes the **viewer's id** (and groups) — which we already have
  from `getUserInformation()` — to the backend. The backend does the
  `/installations` + `/plugins/tasks/installations/search` merge and the
  `accessors` access check, and **returns only the stores/tasks that viewer is
  entitled to.** Nothing more reaches the browser.
- Same shape applies to the per-task assignee filtering currently done in
  `my-tasks` (`assigneeIds` / `groupIds` vs. `currentUserId` / `userGroupIds`)
  — move it behind the same endpoint so the client only ever receives the
  viewer's own tasks.

Functions to relocate (currently client-side):
- `fetchTaskStores()` — the merge + `canSee()` access filter (all four widgets).
- `my-tasks` task-fetch loop + the "mine vs. other" assignee/group filtering.

The widgets then become thin: call the backend with the viewer id, render what
comes back.

## Azure migration (tracked separately, do it together)

The recurring-tasks runner currently lives in **Google Apps Script** (the
`script.google.com/macros/.../exec` endpoint referenced in
`tasks-integration-widget.ts` and the recurring widget). The plan is to move
**all the Apps Script logic to Azure Functions**. The new server-side
store/access endpoint described above should be built on the **same Azure
Functions** stack so there's one backend holding the token secret, rather than
two systems. Build the access-filtering endpoint and the recurring runner
together.

## Pointers

- Store load: search `fetchTaskStores(` in any of the four `*.ts` files.
- Viewer identity: `widgetApi.getUserInformation()` → `{ id, groupIDs }`.
- Token: `apitoken` attribute, fallback `DEFAULT_API_TOKEN` near the top of
  each widget `.ts`.
- Relevant endpoints:
  - `GET /installations?limit=200` (unrestricted stores only)
  - `GET /plugins/tasks/installations/search?permission=manage&limit=200&sort=updated_DESC`
    (all manageable stores incl. restricted; returns `entries[].data` with
    `accessors`)
- Rebuild after edits: `cd tasks/<widget> && npm run build` (webpack → `dist/`).
