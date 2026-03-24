// ============================================================
// Google Sheets → Staffbase Tasks Integration
// Sheet columns (row 1 is header): title | description | due date
// Deploy as: Web app | Execute as: Me | Who has access: Anyone
// ============================================================

var SPREADSHEET_ID = "15yCFmBWYenoCAf_Ku3bbfaHjgE_pHQ8teUcDw04eX4A";
var SHEET_NAME = "Sheet1"; // update if your sheet tab has a different name

// Handles the CORS preflight OPTIONS request that Chrome sends
// when custom x-browser-* headers are present on the request
function doOptions(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();

    var tasks = [];
    // Row 0 is the header (title | description | due date), start at 1
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var title = String(row[0] || '').trim();
      if (!title) continue; // skip blank rows
      tasks.push({
        title:       title,
        description: String(row[1] || '').trim(),
        dueDate:     formatDate(row[2])
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ tasks: tasks }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function formatDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString();
  var d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
