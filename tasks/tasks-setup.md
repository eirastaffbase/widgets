# Task Widgets — Setup Guide

There are four widgets. Each is added to Staffbase the same way (as a
custom/external widget pointing at its hosted `.js`), then configured via its
config panel. **Field names below match exactly what you'll see in each
widget's config.**

## Common to all four widgets

After adding a widget, set these in the config:

1. **API Token** (`apitoken`) — your environment's Staffbase Basic auth token.
   *(Defaults to the Panda Express demo token — replace it with yours.)*
2. **Base URL** (`baseurl`) — leave as `https://app.staffbase.com/api` unless
   you're on a different data center.
3. Branding:
   - **Primary Color** (`primarycolor`) — default `#da2e32` (Panda red)
   - **Accent Color** (`accentcolor`) — default `#da2e32`
   - **Background Color** (`backgroundcolor`) — leave blank for transparent
4. **Store Label (singular)** (`storelabelsingular`) / **Store Label (plural)**
   (`storelabelplural`) — relabel "Store"/"Stores" to "Location", "Branch",
   etc. if that fits the customer.

> All four widgets **auto-translate based on the viewer's locale** — no config
> needed.

---

## 1. Recurring Tasks

*Lets a user create recurring tasks and view them scheduled on a calendar.*

**Asset:** `https://eirastaffbase.github.io/widgets/tasks/recurring-tasks-widget/dist/recurring-tasks-widget.js`

**Config fields (in addition to the common ones):**

- **Task Types (comma-separated)** (`tasktypes`) — default
  `Finance,Operations,Training,Compliance,Safety`
- **Type Colors (comma-separated hex)** (`typecolors`) — badge palette; clear
  to use built-in colors

**Required extra step — the scheduler backend:**
The widget only *defines* schedules; an Apps Script runner actually creates the
tasks on schedule. Add your environment + API key as a row here:
👉 https://docs.google.com/spreadsheets/d/1x3giib9AQKaAHZPvS8phtfiALtTBZbcBxZ29qacC80c/edit?gid=0#gid=0

> Note: this widget has **no** Apps Script URL config field — the runner reads
> the sheet above directly.

---

## 2. My Tasks

*Three modes depending on config: (1) a user views their own tasks, (2) someone
views all tasks, (3) someone views all audits and their corresponding tasks.*

**Asset:** `https://eirastaffbase.github.io/widgets/tasks/my-tasks-widget/dist/my-tasks-widget.js`

**Config toggles that select the mode/behavior:**

- **Show All Tasks (not just mine)** (`showalltasks`) — default off → **mode 2**
  when on
- **Audit Mode** (`auditmode`) — default off → **mode 3** when on (shows audit
  results + history as tabs, pass/fail color-coded)
- **Include Completed Tasks** (`showdonetasks`) — default **on**
- **Allow Task Creation** (`allowtaskcreation`) — adds a "New Task" button
  (default off)
- **Allow Task Assignment (audit mode)** (`allowtaskassignment`) — reassign a
  task to a person/group from the detail panel (default off)
- **Enable Comments (experimental)** (`enablecomments`) — comments in the task
  detail panel (default off)
- **Type Colors (comma-separated hex)** (`typecolors`)
- **Debug Mode (on-screen logs)** (`debugmode`) — handy when debugging inside
  the mobile app

> For the standard end-user view, leave `showalltasks` and `auditmode` off. For
> the audit dashboard, turn **Audit Mode** on.

---

## 3. Tasks Integration

*Create new tasks and import them from an external system (a Google Sheet). For
each prospect, clone the sheet, name a tab after the prospect, and point the
config at that tab.*

**Asset:** `https://eirastaffbase.github.io/widgets/tasks/tasks-integration-widget/dist/tasks-integration-widget.js`
**Source sheet:** https://docs.google.com/spreadsheets/d/15yCFmBWYenoCAf_Ku3bbfaHjgE_pHQ8teUcDw04eX4A/edit?gid=1501415149#gid=1501415149

**Config fields (in addition to the common ones):**

- **Apps Script URL** (`appsscripturl`) — deployed Apps Script web app URL
  (deploy as **Anyone**). Has a working default.
- **Sheet Name** (`sheetname`) — **set this to the tab name you created for the
  prospect** (e.g. `Panda`). Leave blank to use the default tab.
- **Enable Task List Updating** (`enabletasklistupdating`) — select an existing
  list to update instead of always creating a new one (default off)
- **Enable Task Types** (`enabletasktypes`) — adds a Type column and embeds the
  type in the task description (default off)
- **Task Types (comma-separated)** (`tasktypes`) — default
  `Finance,Operations,Training,Compliance,Safety`

---

## 4. Audit Tasks

*Run a store audit; failures generate corrective tasks.*

**Asset:** `https://eirastaffbase.github.io/widgets/tasks/audit-widget/dist/audit-widget.js`
**Default checklist sheet:** https://docs.google.com/spreadsheets/d/18EDgE56TUKKMrmZTqMS7i_9rSoY2SrScHcJRkZ8WlyA/edit?gid=546026405#gid=546026405

**Config fields (in addition to the common ones):**

- **Apps Script URL** (`appsscripturl`) — Apps Script web app returning the
  audit questions. Has a working default.
- **Pass Threshold (%)** (`passthreshold`) — score % required to pass,
  **default 90**

**To customize the audit checklist or the tasks it generates:**

1. Clone the default sheet above.
2. **Extensions → Apps Script**, paste this `doGet` (returns every tab as JSON):
   ```javascript
   function doGet(e) {
     const ss = SpreadsheetApp.getActiveSpreadsheet();
     const allSheets = ss.getSheets();
     const allData = {};
     allSheets.forEach(function(sheet) {
       allData[sheet.getName()] = sheet.getDataRange().getValues();
     });
     return ContentService.createTextOutput(JSON.stringify({
       status: "success",
       data: allData
     })).setMimeType(ContentService.MimeType.JSON);
   }
   ```
3. **Deploy → New deployment → Web app → Who has access: Anyone → Deploy.**
4. Paste the generated URL into the **Apps Script URL** (`appsscripturl`) config
   field.

**Demo tip:** click **Pass** on any task **5 times** to auto-fill the entire
form.

---

## End-to-end demo flow

1. Open the **Audit Tasks** widget, pick a store, and submit an audit (click
   **Pass** 5× to autofill). Failures below the **Pass Threshold (%)** generate
   corrective tasks.
2. Open a page with the **My Tasks** widget that has **Audit Mode** (`auditmode`)
   enabled → view the submitted audit and its corresponding tasks.
