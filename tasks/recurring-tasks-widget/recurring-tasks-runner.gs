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
//   3. Run setupHourlyTrigger() once, approve the auth prompt.
//   4. (Optional) Run runRecurring() manually to test; check Executions for logs.
//
// Hourly cadence honors each schedule's time-of-day. Schedules never fire more
// than once per day per store.
// ============================================================================

var REGISTRY_SHEET_ID = "1x3giib9AQKaAHZPvS8phtfiALtTBZbcBxZ29qacC80c";
var TEMPLATE_TYPE = "recur-template";
var WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
// Priority levels (mirror recurring-tasks-widget). "critical" & "high" both map to
// Priority_1 (Staffbase only has 3); the distinct level lives in the rule.
var LEVELS = { normal: "Priority_3", medium: "Priority_2", high: "Priority_1", critical: "Priority_1" };
function levelToPriority(level) { return LEVELS[level] || "Priority_3"; }
function priorityToLevel(pr) { return pr === "Priority_1" ? "high" : pr === "Priority_2" ? "medium" : "normal"; }

// ── Trigger setup ────────────────────────────────────────────────────────────
function setupHourlyTrigger() {
  // Remove existing triggers for this function, then create a fresh hourly one.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "runRecurring") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("runRecurring").timeBased().everyHours(1).create();
  Logger.log("Hourly trigger installed for runRecurring().");
}

// ── Main entry point (called by the trigger) ─────────────────────────────────
function runRecurring() {
  var envs = readEnvs();
  Logger.log("Processing " + envs.length + " enabled environment(s).");
  var totalCreated = 0, totalSkipped = 0, totalFailed = 0;
  envs.forEach(function (env) {
    try {
      var r = processEnv(env);
      totalCreated += r.created; totalSkipped += r.skipped; totalFailed += r.failed;
      Logger.log("[" + env.envName + "] created=" + r.created + " skipped=" + r.skipped + " failed=" + r.failed);
    } catch (e) {
      Logger.log("[" + env.envName + "] ERROR: " + e.message);
    }
  });
  Logger.log("Done. created=" + totalCreated + " skipped=" + totalSkipped + " failed=" + totalFailed);
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
  var created = 0, skipped = 0, failed = 0;
  var headers = { Authorization: "Basic " + env.apiToken, "Content-Type": "application/json" };

  var installs = apiJson(env.baseUrl + "/installations?limit=200", headers);
  var list = (installs && (installs.data || installs)) || [];
  var taskInstalls = list.filter(function (i) { return i.pluginID === "tasks" || i.pluginId === "tasks"; });

  taskInstalls.forEach(function (inst) {
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

        // "Now" in the schedule's timezone.
        var ymd = Utilities.formatDate(new Date(), rule.tz, "yyyy-MM-dd").split("-").map(Number);
        var todayStr = Utilities.formatDate(new Date(), rule.tz, "yyyy-MM-dd");
        var nowMin = parseInt(Utilities.formatDate(new Date(), rule.tz, "HH"), 10) * 60 +
                     parseInt(Utilities.formatDate(new Date(), rule.tz, "mm"), 10);
        var schedMin = parseInt(rule.time.split(":")[0], 10) * 60 + parseInt(rule.time.split(":")[1], 10);

        if (!firesOn(rule, new Date(ymd[0], ymd[1] - 1, ymd[2]))) return;   // not today
        if (nowMin < schedMin) return;                                       // not time yet
        if (markers[sid + "@" + todayStr]) { skipped++; return; }           // already created today

        try {
          createTask(env.baseUrl, headers, inst.id, l.id, t, rule, sid, todayStr, ymd);
          created++;
        } catch (e) {
          failed++;
          Logger.log("  create failed for " + sid + " in " + inst.id + ": " + e.message);
        }
      });
    });
  });

  return { created: created, skipped: skipped, failed: failed };
}

function createTask(baseUrl, headers, installId, listId, tmpl, rule, sid, todayStr, ymd) {
  var realDesc = stripTags(tmpl.description || "");
  var desc = realDesc;
  if (rule.taskType) desc += (desc ? " " : "") + "[type: " + rule.taskType + "]";
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
