// ============================================================================
// Recurring Tasks — scheduled runner (Google Apps Script prototype)
//
// Pairs with recurring-tasks-widget. The widget stores each schedule as a hidden
// "template" task (taskType "recur-template") whose description carries an
// [rrule: ...] tag. This script wakes up on a time-driven trigger, reads every
// environment listed in the registry sheet, finds due templates, and creates the
// real task — stamping a [recur: <id>@<YYYY-MM-DD>] marker so it never makes two
// for the same schedule on the same day (recurrence is independent of completion).
//
// SETUP (one time):
//   1. Paste this file into the Apps Script project bound to the registry sheet.
//   2. Fill the sheet's first tab: row 1 headers  envName | baseUrl | apiToken | enabled
//      (enabled = TRUE/yes/1 to activate a row).
//   3. Run setupTrigger() once, approve the auth prompt.
//   4. (Optional) Run runRecurring() manually to test; check Executions for logs.
//
// Runs every 15 minutes (clock-aligned to :00/:15/:30/:45), so it honors each
// schedule's time-of-day to the quarter hour. Never fires more than once per day
// per store (dedup marker is keyed by date).
// ============================================================================

var REGISTRY_SHEET_ID = "1x3giib9AQKaAHZPvS8phtfiALtTBZbcBxZ29qacC80c";
var TEMPLATE_TYPE = "recur-template";
var WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
var TRIGGER_GRACE_MIN = 7; // tolerate trigger jitter so a run slightly before the boundary still fires
// Priority levels (mirror recurring-tasks-widget). "critical" & "high" both map to
// Priority_1 (Staffbase only has 3); the distinct level lives in the rule.
var LEVELS = { normal: "Priority_3", medium: "Priority_2", high: "Priority_1", critical: "Priority_1" };
function levelToPriority(level) { return LEVELS[level] || "Priority_3"; }
function priorityToLevel(pr) { return pr === "Priority_1" ? "high" : pr === "Priority_2" ? "medium" : "normal"; }

// ── Trigger setup ────────────────────────────────────────────────────────────
function setupTrigger() {
  // Remove existing triggers for this function, then create a fresh 15-minute one.
  // everyMinutes(15) is clock-aligned (:00/:15/:30/:45), not offset from now.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "runRecurring") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("runRecurring").timeBased().everyMinutes(15).create();
  Logger.log("15-minute trigger installed for runRecurring().");
}

// ── Main entry point (called by the trigger) ─────────────────────────────────
function runRecurring() {
  var envs = readEnvs();
  Logger.log("=== Recurring run @ " + new Date() + " — " + envs.length + " enabled environment(s) ===");
  var tot = { created: 0, skipped: 0, pending: 0, failed: 0, notToday: 0 };
  envs.forEach(function (env) {
    Logger.log("[" + env.envName + "] ----------------------------------------");
    try {
      var r = processEnv(env);
      tot.created += r.created; tot.skipped += r.skipped; tot.pending += r.pending; tot.failed += r.failed; tot.notToday += r.notToday;
      Logger.log("[" + env.envName + "] created=" + r.created + " skipped=" + r.skipped + " upcoming-today=" + r.pending + " failed=" + r.failed + " not-scheduled-today=" + r.notToday);
    } catch (e) {
      Logger.log("[" + env.envName + "] ERROR: " + e.message);
    }
  });
  Logger.log("=== Done. created=" + tot.created + " skipped=" + tot.skipped + " upcoming-today=" + tot.pending + " failed=" + tot.failed + " not-scheduled-today=" + tot.notToday + " ===");
}

// ── Registry sheet ────────────────────────────────────────────────────────────
function readEnvs() {
  var sheet = SpreadsheetApp.openById(REGISTRY_SHEET_ID).getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var envName = String(data[i][0] || "").trim();
    var baseUrl = String(data[i][1] || "").trim().replace(/\/+$/, "");
    var apiToken = String(data[i][2] || "").trim();
    var enabled = String(data[i][3]).trim().toLowerCase();
    if (!baseUrl || !apiToken) continue;
    if (enabled !== "true" && enabled !== "yes" && enabled !== "1") continue;
    out.push({ envName: envName || baseUrl, baseUrl: baseUrl, apiToken: apiToken });
  }
  return out;
}

// ── Per-environment processing ──────────────────────────────────────────────
function processEnv(env) {
  var created = 0, skipped = 0, pending = 0, failed = 0, notToday = 0;
  var headers = { Authorization: "Basic " + env.apiToken, "Content-Type": "application/json" };
  // Group id → name, so a [notify: yes] template can send a named "Your group X
  // was assigned a task" notification. Fetched once per env (best-effort).
  var groupNames = fetchGroupNames(env.baseUrl, headers);

  // Stores: merge the classic /installations list (which only ever returns
  // unrestricted stores) with the tasks-plugin search, the only endpoint that
  // surfaces access-restricted stores (e.g. 7-Eleven, where each store is
  // locked to specific users/groups with branchAccess:false). NO viewer access
  // filter here — the runner is a service job and must process every store.
  // See HANDOVER.md.
  var byId = {};
  var installs = apiJson(env.baseUrl + "/installations?limit=200", headers);
  var list = (installs && (installs.data || installs)) || [];
  list.forEach(function (i) {
    if (i.pluginID === "tasks" || i.pluginId === "tasks") byId[i.id] = i;
  });
  var search = apiJson(env.baseUrl + "/plugins/tasks/installations/search?permission=manage&limit=200&sort=updated_DESC", headers);
  var entries = (search && search.entries) || [];
  entries.forEach(function (e) {
    var i = e.data || e;
    if (i && i.id && !byId[i.id]) byId[i.id] = i;
  });
  var taskInstalls = Object.keys(byId).map(function (k) { return byId[k]; });

  taskInstalls.forEach(function (inst) {
    var store = instTitle(inst);
    var lists = apiJson(env.baseUrl + "/tasks/" + inst.id + "/lists", headers);
    lists = Array.isArray(lists) ? lists : ((lists && lists.data) || []);
    lists.forEach(function (l) {
      var tasks = apiJson(env.baseUrl + "/tasks/" + inst.id + "/task?listId=" + l.id, headers);
      tasks = Array.isArray(tasks) ? tasks : ((tasks && tasks.data) || []);

      // Index existing dedup markers in this list so we never double-create.
      var markers = {};
      tasks.forEach(function (t) {
        var m = /\[recur:\s*([^\]]+)\]/i.exec(t.description || "");
        if (m) markers[m[1].trim()] = true;
      });

      tasks.forEach(function (t) {
        var typeM = /\[type:\s*([^\]]+)\]/i.exec(t.title || "") || /\[type:\s*([^\]]+)\]/i.exec(t.description || "");
        if (!typeM || typeM[1].trim().toLowerCase() !== TEMPLATE_TYPE) return;
        var rrM = /\[rrule:\s*([^\]]+)\]/i.exec(t.description || "");
        if (!rrM) return;

        var rule = parseRule(rrM[1]);
        var idM = /(?:^|;)\s*id=([^;]+)/.exec(rrM[1]);
        var sid = idM ? idM[1].trim() : t.id;

        // "Now" in the schedule's OWN timezone (rule.tz, captured when it was created).
        var now = new Date();
        var ymd = Utilities.formatDate(now, rule.tz, "yyyy-MM-dd").split("-").map(Number);
        var todayStr = Utilities.formatDate(now, rule.tz, "yyyy-MM-dd");
        var nowHHMM = Utilities.formatDate(now, rule.tz, "HH:mm");
        var zone = Utilities.formatDate(now, rule.tz, "z"); // e.g. "EST"
        var nowMin = parseInt(nowHHMM.split(":")[0], 10) * 60 + parseInt(nowHHMM.split(":")[1], 10);
        var schedMin = parseInt(rule.time.split(":")[0], 10) * 60 + parseInt(rule.time.split(":")[1], 10);
        var label = '"' + (t.title || sid) + '" — ' + store + " @ " + rule.time + " " + zone;

        if (!firesOn(rule, new Date(ymd[0], ymd[1] - 1, ymd[2]))) { notToday++; return; } // not scheduled today
        if (markers[sid + "@" + todayStr]) {                                              // already created today
          Logger.log("  ↺ skipped (already created today): " + label);
          skipped++; return;
        }
        // GRACE absorbs Google's trigger jitter (a run can land a couple minutes before the boundary).
        if (nowMin < schedMin - TRIGGER_GRACE_MIN) {                                       // upcoming later today
          Logger.log("  ⏳ upcoming today (not this run): " + label + " (now " + nowHHMM + " " + zone + ")");
          pending++; return;
        }

        try {
          createTask(env.baseUrl, headers, inst.id, l.id, t, rule, sid, todayStr, ymd, groupNames);
          Logger.log("  ✓ created: " + label);
          created++;
        } catch (e) {
          Logger.log("  ✗ FAILED: " + label + " — " + e.message);
          failed++;
        }
      });
    });
  });

  return { created: created, skipped: skipped, pending: pending, failed: failed, notToday: notToday };
}

function createTask(baseUrl, headers, installId, listId, tmpl, rule, sid, todayStr, ymd, groupNames) {
  var realDesc = stripTags(tmpl.description || "");
  var desc = realDesc;
  if (rule.taskType) desc += (desc ? " " : "") + "[type: " + rule.taskType + "]";
  // Critical & High both map to Priority_1 in Staffbase, so stamp a hidden [lvl: critical]
  // tag the widgets can read to distinguish Critical from High. (Separate from the
  // [recur:] dedup marker, which must stay exactly "sid@date".)
  if (rule.level === "critical") desc += (desc ? " " : "") + "[lvl: critical]";
  desc += (desc ? " " : "") + "[recur: " + sid + "@" + todayStr + "]";

  var due = new Date(ymd[0], ymd[1] - 1, ymd[2] + rule.dueOffset);
  var dueIso = due.getFullYear() + "-" + pad2(due.getMonth() + 1) + "-" + pad2(due.getDate()) + "T00:00:00.000Z";

  var body = {
    title: tmpl.title,
    description: desc,
    status: "OPEN",
    priority: levelToPriority(rule.level),
    taskListId: listId,
    assigneeIds: tmpl.assigneeIds || [],
    groupIds: tmpl.groupIds || [],
    dueDate: dueIso
  };
  var res = UrlFetchApp.fetch(baseUrl + "/tasks/" + installId + "/task", {
    method: "post", contentType: "application/json", headers: headers,
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("HTTP " + code + " " + res.getContentText().slice(0, 200));

  // Opt-in notifications: only when the template carries a [notify: yes] marker.
  // Templates without it (older widgets) send nothing — backwards compatible.
  if (/\[notify:\s*yes\]/i.test(tmpl.description || "")) {
    notifyAssignees(baseUrl, headers, tmpl.title, body.assigneeIds, body.groupIds, groupNames || {});
  }
}

// POST a "You were assigned a new task" notification to the task's assignees, and
// a named "Your group X was assigned a task" to each assigned group. Best-effort.
function notifyAssignees(baseUrl, headers, title, userIds, groupIds, groupNames) {
  function send(ids, text) {
    if (!ids || !ids.length) return;
    try {
      UrlFetchApp.fetch(baseUrl + "/branch/notifications", {
        method: "post", contentType: "application/json", headers: headers,
        payload: JSON.stringify({
          accessorIds: ids, channels: ["notificationCenter", "push"],
          content: { en_US: { text: text } }, icon: { en_US: { type: "font", char: "n" } }
        }), muteHttpExceptions: true
      });
    } catch (e) { Logger.log("  notify failed: " + e.message); }
  }
  if (userIds && userIds.length) send(userIds, "You were assigned a new task: " + title);
  (groupIds || []).forEach(function (gid) {
    send([gid], "Your group " + (groupNames[gid] || "") + " was assigned a task: " + title);
  });
}

// Build a group id → name map (best-effort; merges /groups + /groups/search).
function fetchGroupNames(baseUrl, headers) {
  var map = {};
  function take(g) {
    if (!g || !g.id) return;
    var loc = g.config && g.config.localization && g.config.localization.en_US;
    var name = (loc && (loc.title || loc.name)) || g.name;
    if (name) map[g.id] = name;
  }
  try {
    var legacy = apiJson(baseUrl + "/groups?limit=200", headers);
    ((legacy && legacy.data) || []).forEach(take);
  } catch (e) {}
  try {
    var search = apiJson(baseUrl + "/groups/search?limit=200&sort=name_ASC", headers);
    ((search && (search.entries || search.data)) || []).forEach(function (e) { take(e.data || e); });
  } catch (e) {}
  return map;
}

// ── Recurrence model (mirrors recurring-tasks-widget.ts) ─────────────────────
function parseRule(blob) {
  var r = {
    freq: "DAILY", interval: 1, byday: ["MO","TU","WE","TH","FR"],
    monthMode: "dom", dom: 1, nth: 1, nthWeekday: "MO",
    time: "09:00", tz: "America/New_York", dueOffset: 0, level: "normal", taskType: "",
    start: "1970-01-01", end: ""
  };
  blob.split(";").forEach(function (part) {
    var eq = part.indexOf("=");
    if (eq < 0) return;
    var k = part.slice(0, eq).trim(), v = part.slice(eq + 1).trim();
    switch (k) {
      case "f":   if (v === "DAILY" || v === "WEEKLY" || v === "MONTHLY") r.freq = v; break;
      case "i":   r.interval = Math.max(1, parseInt(v, 10) || 1); break;
      case "d":   r.byday = v.split(",").map(function (s) { return s.trim().toUpperCase(); }).filter(function (x) { return WEEKDAYS.indexOf(x) >= 0; }); break;
      case "mm":  r.monthMode = v === "nth" ? "nth" : "dom"; break;
      case "dom": r.dom = Math.min(31, Math.max(1, parseInt(v, 10) || 1)); break;
      case "nth": r.nth = parseInt(v, 10) || 1; break;
      case "nthd": if (WEEKDAYS.indexOf(v.toUpperCase()) >= 0) r.nthWeekday = v.toUpperCase(); break;
      case "time": if (/^\d{1,2}:\d{2}$/.test(v)) r.time = v; break;
      case "tz":  if (v) r.tz = v; break;
      case "due": r.dueOffset = parseInt(v, 10) || 0; break;
      case "lvl": if (LEVELS.hasOwnProperty(v)) r.level = v; break;
      case "pr":  if (/^Priority_[123]$/.test(v)) r.level = priorityToLevel(v); break; // back-compat
      case "t":   r.taskType = decodeURIComponent(v); break;
      case "s":   if (/^\d{4}-\d{2}-\d{2}$/.test(v)) r.start = v; break;
      case "e":   if (/^\d{4}-\d{2}-\d{2}$/.test(v)) r.end = v; break;
    }
  });
  return r;
}

function firesOn(r, date) {
  var sp = r.start.split("-").map(Number);
  var start = new Date(sp[0], sp[1] - 1, sp[2]);
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d < start) return false;
  if (r.end) { var ep = r.end.split("-").map(Number); if (d > new Date(ep[0], ep[1] - 1, ep[2])) return false; }

  if (r.freq === "DAILY") {
    var days = Math.round((d.getTime() - start.getTime()) / 86400000);
    return days % r.interval === 0;
  }
  if (r.freq === "WEEKLY") {
    if (r.byday.indexOf(WEEKDAYS[d.getDay()]) < 0) return false;
    var sw = new Date(start); sw.setDate(start.getDate() - start.getDay());
    var tw = new Date(d);     tw.setDate(d.getDate() - d.getDay());
    var weeks = Math.round((tw.getTime() - sw.getTime()) / (7 * 86400000));
    return weeks % r.interval === 0;
  }
  // MONTHLY
  var months = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
  if (months < 0 || months % r.interval !== 0) return false;
  if (r.monthMode === "dom") {
    var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() === Math.min(r.dom, lastDay);
  }
  if (WEEKDAYS[d.getDay()] !== r.nthWeekday) return false;
  if (r.nth === -1) {
    var next = new Date(d); next.setDate(d.getDate() + 7);
    return next.getMonth() !== d.getMonth();
  }
  return Math.ceil(d.getDate() / 7) === r.nth;
}

function stripTags(text) {
  return String(text)
    .replace(/\[rrule:\s*[^\]]+\]/i, "")
    .replace(/\[type:\s*[^\]]+\]/i, "")
    .replace(/\[recur:\s*[^\]]+\]/i, "")
    .replace(/\[lvl:\s*[^\]]+\]/i, "")
    .replace(/\[notify:\s*[^\]]+\]/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Small helpers ────────────────────────────────────────────────────────────
function apiJson(url, headers) {
  var res = UrlFetchApp.fetch(url, { method: "get", headers: headers, muteHttpExceptions: true });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) return null;
  try { return JSON.parse(res.getContentText()); } catch (e) { return null; }
}
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function instTitle(inst) {
  return (inst.config && inst.config.localization && inst.config.localization.en_US && inst.config.localization.en_US.title)
    || inst.title || inst.name || inst.id;
}
