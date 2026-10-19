/**
 * RSVP receiver for the Alya & Hakim wedding invitation.
 * Paste into Extensions > Apps Script of a Google Sheet, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Put the web-app URL in WEDDING.rsvpEndpoint.
 */
const SHEET_NAME = 'RSVP';
const HEADERS = ['Timestamp', 'Name', 'Attending', 'People', 'Notes', 'Language'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = e.parameter || {};
    const clean = (v, max) => String(v || '').replace(/^[=+\-@]/, "'$&").slice(0, max);
    const attending = p.attending === 'yes';
    sheet_().appendRow([
      new Date(),
      clean(p.name, 80),
      attending ? 'Hadir' : 'Tidak Hadir',
      attending ? Math.min(10, Math.max(1, parseInt(p.pax, 10) || 1)) : 0,
      clean(p.notes, 500),
      p.lang === 'en' ? 'EN' : 'BM'
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, service: 'wedding-rsvp' });
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
