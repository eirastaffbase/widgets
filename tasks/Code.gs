// ============================================================
// Google Sheets → Staffbase Tasks Integration
// Sheet columns (row 1 is header): title | description | due date
// ============================================================

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();

  var tasks = [];
  // Start at row 1 to skip the header row
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var title = String(row[0] || '').trim();
    if (!title) continue; // skip blank rows

    tasks.push({
      title: title,
      description: String(row[1] || '').trim(),
      dueDate: formatDate(row[2])
    });
  }

  var payload = JSON.stringify({ tasks: tasks });
  var output = ContentService.createTextOutput(payload);
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// Converts a sheet cell value to an ISO date string, or null
function formatDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString();
  }
  var d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
