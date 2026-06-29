function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const payload = JSON.parse(e.postData.contents);
    
    // Assume payload is an array of check-in events
    if (Array.isArray(payload)) {
      payload.forEach(event => {
        sheet.appendRow([
          event.uuid,
          event.timestamp,
          event.syncStatus
        ]);
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
