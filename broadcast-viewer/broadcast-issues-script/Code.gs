// ============================================================
// Broadcast Issues — Google Sheets Web App
// Sheet: "PBS" tab, columns as below
// Deploy: Web app | Execute as: Me | Access: Anyone
//
// Columns (row 1 is header):
//   id | show | episode | station | author | type | tags |
//   description | status | timestamp | replies
//
// tags    → comma-separated string   e.g. "Flicker, Sync issue"
// replies → semicolon-separated      e.g. "Ops Team: text here; Name: another reply"
// ============================================================

var SPREADSHEET_ID = "1dxPYxMsazmw8XqAXUdWaEY_2dDmcso4gS4NuppbgU6Q";
var SHEET_NAME     = "PBS";

// Column index map (0-based)
var COL = {
  id:          0,
  show:        1,
  episode:     2,
  station:     3,
  author:      4,
  type:        5,
  tags:        6,
  description: 7,
  status:      8,
  timestamp:   9,
  replies:     10,
};

function doOptions() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET → returns all issues as JSON
function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var sheet = getSheet();
    var data  = sheet.getDataRange().getValues();
    var issues = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id  = String(row[COL.id] || "").trim();
      if (!id) continue;

      issues.push({
        id:          id,
        show:        String(row[COL.show]        || "").trim(),
        episode:     String(row[COL.episode]     || "").trim(),
        station:     String(row[COL.station]     || "").trim(),
        author:      String(row[COL.author]      || "").trim(),
        type:        String(row[COL.type]        || "").trim(),
        tags:        parseTags(row[COL.tags]),
        description: String(row[COL.description] || "").trim(),
        status:      String(row[COL.status]      || "Open").trim(),
        timestamp:   String(row[COL.timestamp]   || "").trim(),
        replies:     parseReplies(row[COL.replies]),
      });
    }

    return json({ issues: issues });
  } catch (err) {
    return json({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// POST → append a new issue row
// Body: form-encoded payload=<json> OR raw JSON body
// JSON fields: { show, episode, station, author, type, tags[], description }
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var body   = parsePayload_(e);
    var sheet  = getSheet();
    var id     = "i" + Date.now();
    var now    = new Date().toISOString();
    var tags   = Array.isArray(body.tags) ? body.tags.join(", ") : (body.tags || "");

    sheet.appendRow([
      id,
      body.show        || "",
      body.episode     || "",
      body.station     || "",
      body.author      || "",
      body.type        || "",
      tags,
      body.description || "",
      "Open",
      now,
      "",              // replies start empty
    ]);

    return json({ ok: true, id: id });
  } catch (err) {
    return json({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ── Helpers ─────────────────────────────────────────────────

function parsePayload_(e) {
  if (!e) {
    throw new Error("Missing request event.");
  }

  // Preferred path: form-encoded body with payload=<json>
  if (e.parameter && e.parameter.payload) {
    var parsed = JSON.parse(e.parameter.payload);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid payload field.");
    }
    return parsed;
  }

  if (!e.postData || !e.postData.contents) {
    throw new Error("Missing request body.");
  }

  var raw = String(e.postData.contents || "");

  // Backward compatibility: accept direct JSON body
  try {
    var parsedJson = JSON.parse(raw);
    if (parsedJson && typeof parsedJson === "object") {
      return parsedJson;
    }
  } catch (jsonError) {
    // fall through to form parsing
  }

  // Fallback: parse application/x-www-form-urlencoded manually
  var form = parseFormEncoded_(raw);
  if (form.payload) {
    var parsedPayload = JSON.parse(form.payload);
    if (parsedPayload && typeof parsedPayload === "object") {
      return parsedPayload;
    }
  }

  throw new Error("Invalid payload. Expected JSON body or form payload field.");
}

function parseFormEncoded_(raw) {
  var result = {};
  raw.split("&").forEach(function(pair) {
    if (!pair) return;
    var parts = pair.split("=");
    var key   = decodeURIComponent(String(parts[0] || "").replace(/\+/g, " "));
    var value = decodeURIComponent(String(parts.slice(1).join("=") || "").replace(/\+/g, " "));
    result[key] = value;
  });
  return result;
}

function getSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseTags(val) {
  var s = String(val || "").trim();
  if (!s) return [];
  return s.split(",").map(function(t) { return t.trim(); }).filter(Boolean);
}

// Replies format in sheet: "Author: text; Author2: text2"
// Returns: [{ author, role, text, timestamp }]
function parseReplies(val) {
  var s = String(val || "").trim();
  if (!s) return [];
  return s.split(";").map(function(part) {
    part = part.trim();
    var colon = part.indexOf(":");
    if (colon === -1) return null;
    return {
      author:    part.slice(0, colon).trim(),
      role:      "staff",
      text:      part.slice(colon + 1).trim(),
      timestamp: "",
    };
  }).filter(Boolean);
}
