// ============================================================
// Rewards redemption log  —  Google Apps Script backend
// Sheet columns (row 1 is the header, exactly):
//   userID | redemptionTitle | redemptionDateTime
//
// Deploy:  Deploy ▸ New deployment ▸ Web app
//          Execute as: Me   |   Who has access: Anyone
//   (After editing, redeploy: Deploy ▸ Manage deployments ▸ edit ▸
//    Version = "New version" ▸ Deploy. The /exec URL stays the same.)
//
//   GET  ?userId=<id>   → { data: [ {userID, redemptionTitle, redemptionDateTime}, ... ] }
//                         (newest first; omit userId to get every row)
//   POST {userID, redemptionTitle, redemptionDateTime}
//                         → { status: "ok", row: {...} }   (appends a row)
// ============================================================

// Leave blank to use the sheet this script is bound to (Extensions ▸ Apps Script).
// If the script is standalone, paste the spreadsheet ID here instead.
var SPREADSHEET_ID = "";
var SHEET_NAME     = "Sheet1";

function getSheet_() {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// CORS preflight (sent by browsers when a custom content-type is used).
function doOptions(e) {
  return json_({ status: "ok" });
}

// ── Read ──────────────────────────────────────────────────────────────
function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var wantUser = (e && e.parameter && e.parameter.userId)
      ? String(e.parameter.userId).trim()
      : "";

    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues();
    var out = [];
    // Row 0 is the header; rows are appended in chronological order, so read
    // bottom-up to return newest first.
    for (var i = values.length - 1; i >= 1; i--) {
      var row = values[i];
      var userID = String(row[0] || "").trim();
      if (!userID) continue;
      if (wantUser && userID !== wantUser) continue;
      out.push({
        userID: userID,
        redemptionTitle: String(row[1] || ""),
        redemptionDateTime: row[2] instanceof Date
          ? row[2].toISOString()
          : String(row[2] || ""),
      });
    }
    return json_({ data: out });
  } catch (err) {
    return json_({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ── Write ─────────────────────────────────────────────────────────────
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var body = {};
    // Accept a JSON body, or plain form fields (e.parameter) as a fallback.
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (_) { body = {}; }
    }
    if ((!body || !body.userID) && e && e.parameter) body = e.parameter;

    var userID             = String((body.userID || "")).trim();
    var redemptionTitle    = String((body.redemptionTitle || "")).trim();
    var redemptionDateTime = String((body.redemptionDateTime || "")).trim()
                             || new Date().toISOString();

    if (!userID || !redemptionTitle) {
      return json_({ error: "userID and redemptionTitle are required" });
    }

    getSheet_().appendRow([userID, redemptionTitle, redemptionDateTime]);
    return json_({
      status: "ok",
      row: { userID: userID, redemptionTitle: redemptionTitle, redemptionDateTime: redemptionDateTime },
    });
  } catch (err) {
    return json_({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
