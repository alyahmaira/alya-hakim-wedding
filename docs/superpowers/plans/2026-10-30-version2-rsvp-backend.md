# version-2 RSVP Backend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace version-2's direct-to-Google-Apps-Script RSVP submission with wedding-groom's serverless-proxy pattern (`/api/rsvp?side=bride`), matching its exact payload shape (`name, phone, attendance, guestCount, guestGroup, message, side`).

**Architecture:** A Vercel serverless function (`version-2/api/rsvp.js`, copied verbatim from `wedding-groom/api/rsvp.js`) forwards POSTed RSVP data to a Google Apps Script URL selected by a `side` query param from env vars. The browser-side form in `version-2/index.html` is extended with phone + guest-group fields, a ported custom dropdown component, and a rewritten submit handler that POSTs JSON to the new same-origin endpoint instead of calling Google Apps Script directly.

**Tech Stack:** Static HTML/CSS/vanilla JS, Node.js serverless function (CommonJS, Vercel runtime), Node's built-in test runner (`node:test`) for the serverless function's unit test (no new dependencies).

**Reference spec:** `docs/superpowers/specs/2026-10-30-version2-rsvp-backend-design.md`

---

### Task 1: Add the serverless proxy function + env file

**Files:**
- Create: `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/api/rsvp.js`
- Create: `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/.env.example`
- Test: `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/api/rsvp.test.js`

- [ ] **Step 1: Write the failing test**

Create `version-2/api/rsvp.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./rsvp.js');

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

test('rejects non-POST requests', async () => {
  const res = makeRes();
  await handler({ method: 'GET', query: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.ok, false);
});

test('returns 500 when the endpoint env var is missing', async () => {
  delete process.env.BRIDE_RSVP_ENDPOINT;
  const res = makeRes();
  await handler({ method: 'POST', query: { side: 'bride' }, body: '{}' }, res);
  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /BRIDE_RSVP_ENDPOINT/);
});

test('defaults to the bride endpoint when side is omitted', async () => {
  process.env.BRIDE_RSVP_ENDPOINT = 'https://script.google.com/bride-exec';
  const originalFetch = global.fetch;
  let calledUrl = null;
  global.fetch = async (url) => {
    calledUrl = url;
    return { ok: true, text: async () => JSON.stringify({ ok: true }) };
  };
  const res = makeRes();
  await handler({ method: 'POST', query: {}, body: '{"name":"Test"}' }, res);
  global.fetch = originalFetch;
  assert.equal(calledUrl, 'https://script.google.com/bride-exec');
  assert.equal(res.body.ok, true);
});

test('forwards to the groom endpoint when side=groom', async () => {
  process.env.GROOM_RSVP_ENDPOINT = 'https://script.google.com/groom-exec';
  const originalFetch = global.fetch;
  let calledUrl = null;
  global.fetch = async (url) => {
    calledUrl = url;
    return { ok: true, text: async () => JSON.stringify({ ok: true }) };
  };
  const res = makeRes();
  await handler({ method: 'POST', query: { side: 'groom' }, body: '{"name":"Test"}' }, res);
  global.fetch = originalFetch;
  assert.equal(calledUrl, 'https://script.google.com/groom-exec');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test version-2/api/rsvp.test.js`
Expected: FAIL — `Cannot find module './rsvp.js'`

- [ ] **Step 3: Create `version-2/api/rsvp.js`** (copied verbatim from `wedding-groom/api/rsvp.js`)

```js
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const side = String(req.query?.side || 'bride').toLowerCase() === 'groom' ? 'groom' : 'bride';
  const endpoint = side === 'groom'
    ? process.env.GROOM_RSVP_ENDPOINT
    : process.env.BRIDE_RSVP_ENDPOINT;

  if (!endpoint) {
    return res.status(500).json({
      ok: false,
      error: `Missing ${side.toUpperCase()}_RSVP_ENDPOINT environment variable.`
    });
  }

  let rawBody = '';

  if (typeof req.body === 'string' && req.body.length) {
    rawBody = req.body;
  } else if (req.body && typeof req.body === 'object') {
    rawBody = JSON.stringify(req.body);
  } else {
    rawBody = await readRequestBody(req);
  }

  if (!rawBody) {
    rawBody = '{}';
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Accept': 'application/json'
      },
      body: rawBody
    });

    const text = await upstream.text();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { ok: upstream.ok, raw: text };
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok: false,
        error: parsed?.error || 'Upstream RSVP request failed.',
        details: parsed?.details || text
      });
    }

    return res.status(200).json(parsed && typeof parsed === 'object' ? parsed : { ok: true });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: 'Failed to reach the Google Apps Script endpoint.',
      details: error.message || String(error)
    });
  }
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test version-2/api/rsvp.test.js`
Expected: PASS — 4 tests passing, 0 failing

- [ ] **Step 5: Create `version-2/.env.example`**

```
# Copy these into your Vercel project Environment Variables.
# Change the values only when you update the Google Apps Script /exec URLs.
BRIDE_RSVP_ENDPOINT=https://script.google.com/macros/s/AKfycbxy8jCXgau5B20Okh6bgH9ZVZTqj8MwxmrBXzHnNMrP2mHPIImzG5Rr8wbfOzsXIC8/exec
GROOM_RSVP_ENDPOINT=https://script.google.com/macros/s/AKfycbzgUGB2T7QMuPfa_7iR3hHKdFru6-F4wVCzgeg_hIWBw81AsDOwM5suVbjCX6JaB9d7/exec
```

- [ ] **Step 6: Add `.env` to the repo's `.gitignore`**

The root `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/.gitignore` currently contains:

```
.DS_Store
.superpowers/
node_modules/
```

Append:

```
.env
```

- [ ] **Step 7: Commit**

```bash
cd /Users/alyaaccess/dev/wedding/alya-hakim-wedding
git add version-2/api/rsvp.js version-2/api/rsvp.test.js version-2/.env.example .gitignore
git commit -m "Add RSVP serverless proxy function to version-2"
```

---

### Task 2: Remove the obsolete Apps Script and update docs

**Files:**
- Delete: `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/apps-script/Code.gs`
- Modify: `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/POST-BUILD.md`

- [ ] **Step 1: Delete the old Apps Script file**

```bash
cd /Users/alyaaccess/dev/wedding/alya-hakim-wedding
git rm version-2/apps-script/Code.gs
rmdir version-2/apps-script 2>/dev/null || true
```

- [ ] **Step 2: Update `version-2/POST-BUILD.md`**

Replace the `## RSVP → Google Sheet` section (and the `rsvpEndpoint` bullet under `## Personalise`) with:

```markdown
## Personalise
Edit the `WEDDING` settings block near the bottom of `index.html`:
- `photos.bride` / `photos.groom` — childhood photos (portrait, face near the top). Put files in `assets/photos/`.
  Both currently use `kid-placeholder.jpg`.
- `musicSrc` — e.g. `'assets/music.mp3'`. Empty = built-in music-box tune. Use a song you have rights to.
- `contacts` — 3 family contacts: `name`, `role` (BM + EN), `phone` in international digits (e.g. `60123456789`).
  Each gets a WhatsApp button (pre-filled greeting) and a Call button.
- `mapsUrl`, `calendarUrl`, `start` (countdown target, Malaysia time).

## RSVP → serverless proxy → Google Sheet
The RSVP form POSTs to `/api/rsvp?side=bride`, a Vercel serverless function
(`api/rsvp.js`) that forwards the request to the Google Apps Script URL in the
`BRIDE_RSVP_ENDPOINT` environment variable.

1. Copy `.env.example` into your Vercel project's Environment Variables
   (Project Settings → Environment Variables). `BRIDE_RSVP_ENDPOINT` must
   point at an Apps Script web app that accepts
   `{ name, phone, attendance, guestCount, guestGroup, message, side }`.
2. Deploy with `npx vercel` (or your usual flow) so `/api/rsvp` is served
   alongside the static site.
3. A guest's own reply is remembered on their phone (they see the thank-you
   card and can send another).
```

- [ ] **Step 3: Commit**

```bash
cd /Users/alyaaccess/dev/wedding/alya-hakim-wedding
git add version-2/POST-BUILD.md
git commit -m "Remove obsolete Code.gs; document serverless RSVP proxy setup"
```

---

### Task 3: Add the `.csel` dropdown CSS component

**Files:**
- Modify: `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/index.html:165`
- Modify: `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/index.html:234` (readability-scale block)

- [ ] **Step 1: Insert the dropdown CSS**

In `version-2/index.html`, find this existing line (currently line 165):

```css
  .step small{font-size:17px;opacity:.8}
```

Insert immediately after it (before `.prow[hidden]{display:none}`):

```css
  .csel{position:relative;margin-top:8px}
  .csel-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;font:500 19px/1.4 'EB Garamond',Georgia,serif;
    text-align:left;color:var(--burgundy);background:transparent;border:0;border-bottom:1px solid rgba(110,26,40,.25);border-radius:0;
    padding:7px 0 6px;cursor:pointer;transition:border-color .2s}
  .csel-btn:focus-visible,.csel.open .csel-btn{outline:none;border-bottom-color:var(--burgundy)}
  .csel-arrow{width:13px;height:13px;flex:none;color:var(--burgundy);transition:transform .2s ease}
  .csel-arrow svg{display:block;width:100%;height:100%}
  .csel.open .csel-arrow{transform:rotate(180deg)}
  .csel-list{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:5;margin:0;padding:6px;list-style:none;
    background:#fbf7ee;border:1px solid rgba(201,163,92,.45);border-radius:10px;box-shadow:0 16px 36px -16px rgba(70,40,20,.5);
    max-height:220px;overflow-y:auto;opacity:0;transform:translateY(-6px) scale(.98);pointer-events:none;
    transition:opacity .16s ease,transform .16s ease}
  .csel.open .csel-list{opacity:1;transform:none;pointer-events:auto}
  .csel-opt{padding:10px 12px;border-radius:6px;cursor:pointer;color:var(--ink)}
  .csel-opt:hover,.csel-opt.hl{background:rgba(201,163,92,.18)}
  .csel-opt[aria-selected="true"]{color:var(--burgundy);font-weight:600}
  .prow.invalid .csel-btn{border-bottom-color:#a3221b}
```

- [ ] **Step 2: Add readability-scale overrides**

Find this existing line in the "readability scale" block:

```css
  .step small{font-size:18px}
```

Insert immediately after it:

```css
  .csel-btn{font-size:20px}
  .csel-opt{font-size:19px}
```

- [ ] **Step 3: Verify visually**

Run: `cd version-2 && python3 -m http.server 8080`, open `http://localhost:8080`.
Expected: page still loads with no visible change yet (the `.csel` markup doesn't exist in the HTML until Task 4, so this CSS has no effect yet — just confirm no console errors and the page renders normally).

- [ ] **Step 4: Commit**

```bash
cd /Users/alyaaccess/dev/wedding/alya-hakim-wedding
git add version-2/index.html
git commit -m "Add csel dropdown component styles to version-2"
```

---

### Task 4: Update the RSVP form markup (phone, guest group, guest-count dropdown, honeypot)

**Files:**
- Modify: `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/index.html:373-398`

- [ ] **Step 1: Replace the form fields**

Find this block (currently lines 373-398, inside `<form class="pc" id="rsvpForm" novalidate>`):

```html
        <div class="prow" id="fName">
          <label for="rName" data-i18n="fName">Nama</label>
          <input class="pin" type="text" id="rName" name="name" autocomplete="name" maxlength="80" data-i18n-ph="phName" placeholder="Nama penuh">
          <div class="err" data-i18n="errName">Sila isi nama anda</div>
        </div>
        <div class="prow" id="fAttend">
          <div class="lb" data-i18n="fAttend">Kehadiran</div>
          <div class="opts" role="radiogroup">
            <label class="op"><input type="radio" name="attending" value="yes"><i></i><span data-i18n="yes">Hadir</span></label>
            <label class="op"><input type="radio" name="attending" value="no"><i></i><span data-i18n="no">Tidak hadir</span></label>
          </div>
          <div class="err" data-i18n="errAttend">Sila pilih kehadiran</div>
        </div>
        <div class="prow" id="fPax" hidden>
          <div class="lb" data-i18n="fPax">Bilangan orang</div>
          <div class="step">
            <button type="button" id="paxMinus" aria-label="−">−</button>
            <output id="paxOut" aria-live="polite">1</output>
            <button type="button" id="paxPlus" aria-label="+">+</button>
            <small data-i18n="paxUnit">orang</small>
          </div>
        </div>
        <div class="prow">
          <label for="rNotes" data-i18n="fNotes">Catatan</label>
          <textarea class="pin" id="rNotes" name="notes" maxlength="500" data-i18n-ph="phNotes" placeholder="Ucapan atau catatan (tidak wajib)"></textarea>
        </div>
```

Replace with:

```html
        <div class="prow" id="fName">
          <label for="rName" data-i18n="fName">Nama</label>
          <input class="pin" type="text" id="rName" name="name" autocomplete="name" maxlength="80" data-i18n-ph="phName" placeholder="Nama penuh">
          <div class="err" data-i18n="errName">Sila isi nama anda</div>
        </div>
        <div class="prow" id="fPhone">
          <label for="rPhone" data-i18n="fPhone">Nombor Telefon</label>
          <input class="pin" type="tel" id="rPhone" name="phone" autocomplete="tel" inputmode="tel" maxlength="20" data-i18n-ph="phPhone" placeholder="012-3456789">
          <div class="err" data-i18n="errPhone">Sila isi nombor telefon anda</div>
        </div>
        <div class="prow" id="fAttend">
          <div class="lb" data-i18n="fAttend">Kehadiran</div>
          <div class="opts" role="radiogroup">
            <label class="op"><input type="radio" name="attending" value="Attending"><i></i><span data-i18n="yes">Hadir</span></label>
            <label class="op"><input type="radio" name="attending" value="Not Attending"><i></i><span data-i18n="no">Tidak hadir</span></label>
          </div>
          <div class="err" data-i18n="errAttend">Sila pilih kehadiran</div>
        </div>
        <div class="prow" id="fPax" hidden>
          <div class="lb" data-i18n="fPax">Bilangan orang</div>
          <div class="csel" id="guestsSel">
            <button type="button" class="csel-btn" id="guestsBtn" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="fPax guestsBtn">
              <span id="guestsBtnVal">1</span>
              <span class="csel-arrow" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            </button>
            <ul class="csel-list" id="guestsList" role="listbox" aria-labelledby="fPax" tabindex="-1" hidden></ul>
          </div>
          <input type="hidden" id="guests" name="guests" value="1">
        </div>
        <div class="prow" id="fGroup" hidden>
          <div class="lb" data-i18n="fGroup">Kumpulan Tetamu</div>
          <div class="csel" id="groupSel">
            <button type="button" class="csel-btn" id="groupBtn" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="fGroup groupBtn">
              <span id="groupBtnVal" data-i18n="groupPlaceholder">Pilih satu</span>
              <span class="csel-arrow" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            </button>
            <ul class="csel-list" id="groupList" role="listbox" aria-labelledby="fGroup" tabindex="-1" hidden></ul>
          </div>
          <input type="hidden" id="guestGroup" name="guestGroup" value="">
          <div class="err" data-i18n="errGroup">Sila pilih kumpulan tetamu</div>
        </div>
        <div class="prow">
          <label for="rNotes" data-i18n="fNotes">Catatan</label>
          <textarea class="pin" id="rNotes" name="message" maxlength="500" data-i18n-ph="phNotes" placeholder="Ucapan atau catatan (tidak wajib)"></textarea>
        </div>
        <div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden">
          <label for="rCompany">Company</label>
          <input id="rCompany" name="company" type="text" tabindex="-1" autocomplete="off">
        </div>
```

- [ ] **Step 2: Verify the HTML is well-formed**

Run: `cd version-2 && python3 -c "import html.parser; html.parser.HTMLParser().feed(open('index.html').read())"`
Expected: no exception raised (basic sanity check that tags are balanced enough to parse; the page's own JS will still reference `#paxMinus`/`#paxPlus` until Task 5, so don't load it in a browser yet)

- [ ] **Step 3: Commit**

```bash
cd /Users/alyaaccess/dev/wedding/alya-hakim-wedding
git add version-2/index.html
git commit -m "Add phone, guest-group, and guest-count dropdown fields to RSVP form"
```

---

### Task 5: Add new i18n strings (EN + BM)

**Files:**
- Modify: `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/index.html` (the `I18N` object, `ms` and `en` blocks)

- [ ] **Step 1: Add strings to the `ms` block**

Find this line in the `ms` block:

```js
      fName: 'Nama', phName: 'Nama penuh', errName: 'Sila isi nama anda',
      fAttend: 'Kehadiran', yes: 'Hadir', no: 'Tidak hadir', errAttend: 'Sila pilih kehadiran',
      paxUnit: 'orang',
      fPax: 'Bilangan orang', fNotes: 'Catatan', phNotes: 'Ucapan atau catatan (tidak wajib)',
```

Replace with:

```js
      fName: 'Nama', phName: 'Nama penuh', errName: 'Sila isi nama anda',
      fPhone: 'Nombor Telefon', phPhone: '012-3456789', errPhone: 'Sila isi nombor telefon anda',
      fAttend: 'Kehadiran', yes: 'Hadir', no: 'Tidak hadir', errAttend: 'Sila pilih kehadiran',
      paxUnit: 'orang',
      fPax: 'Bilangan orang', fNotes: 'Catatan', phNotes: 'Ucapan atau catatan (tidak wajib)',
      fGroup: 'Kumpulan Tetamu', groupPlaceholder: 'Pilih satu', errGroup: 'Sila pilih kumpulan tetamu',
      guestgroup_labels: n => [`Keluarga ${n}`, `Kawan ${n}`, `Rakan sekerja ${n}`, `Kawan kepada ibu bapa ${n}`],
```

- [ ] **Step 2: Add strings to the `en` block**

Find this line in the `en` block:

```js
      fName: 'Name', phName: 'Full name', errName: 'Please enter your name',
      fAttend: 'Attendance', yes: 'Attending', no: 'Not attending', errAttend: 'Please choose one',
      paxUnit: 'guest(s)',
      fPax: 'Number of people', fNotes: 'Notes', phNotes: 'Wishes or notes (optional)',
```

Replace with:

```js
      fName: 'Name', phName: 'Full name', errName: 'Please enter your name',
      fPhone: 'Phone Number', phPhone: '012-3456789', errPhone: 'Please enter your phone number',
      fAttend: 'Attendance', yes: 'Attending', no: 'Not attending', errAttend: 'Please choose one',
      paxUnit: 'guest(s)',
      fPax: 'Number of people', fNotes: 'Notes', phNotes: 'Wishes or notes (optional)',
      fGroup: 'Guest Group', groupPlaceholder: 'Select one', errGroup: 'Please select a guest group',
      guestgroup_labels: n => [`${n}'s family`, `${n}'s friends`, `${n}'s colleagues`, `Friends of ${n}'s parents`],
```

- [ ] **Step 3: Verify the object is valid JS**

Run: `cd version-2 && node -e "const fs=require('fs'); const src=fs.readFileSync('index.html','utf8'); const m=src.match(/const I18N = \{[\s\S]*?\n  \};/); new Function(m[0]+'; return I18N;')()"`
Expected: no syntax error thrown

- [ ] **Step 4: Commit**

```bash
cd /Users/alyaaccess/dev/wedding/alya-hakim-wedding
git add version-2/index.html
git commit -m "Add phone/guest-group i18n strings to version-2"
```

---

### Task 6: Rewrite the RSVP JS (dropdowns, validation, payload, fetch)

**Files:**
- Modify: `/Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/index.html` (the `WEDDING` config object and the `/* ---------- RSVP ---------- */` block)

- [ ] **Step 1: Remove `rsvpEndpoint` from the `WEDDING` config**

Find:

```js
    musicSrc: 'assets/music.m4a',                                       // e.g. 'assets/music.mp3' — empty = built-in music-box tune
    rsvpEndpoint: '',                                   // Google Apps Script web-app URL (see apps-script/Code.gs).
                                                        // Empty = RSVP is sent as a WhatsApp message to the first contact.
    contacts: [                                         // phone in international format, digits only (60 = Malaysia)
```

Replace with:

```js
    musicSrc: 'assets/music.m4a',                                       // e.g. 'assets/music.mp3' — empty = built-in music-box tune
    contacts: [                                         // phone in international format, digits only (60 = Malaysia)
```

- [ ] **Step 2: Replace the entire `/* ---------- RSVP ---------- */` block**

Find this block (currently lines 562-618):

```js
  /* ---------- RSVP ---------- */
  const form = $('#rsvpForm'), thanks = $('#rsvpThanks'), MAXPAX = 10;
  let pax = 1, lastReply = null;
  const attending = () => (form.querySelector('input[name=attending]:checked') || {}).value;
  const setPax = n => { pax = Math.min(MAXPAX, Math.max(1, n)); $('#paxOut').textContent = pax; $('#paxMinus').disabled = pax <= 1; $('#paxPlus').disabled = pax >= MAXPAX; };
  $('#paxMinus').addEventListener('click', () => setPax(pax - 1));
  $('#paxPlus').addEventListener('click', () => setPax(pax + 1));
  setPax(1);
  form.addEventListener('change', e => {
    if (e.target.name === 'attending') { $('#fPax').hidden = attending() !== 'yes'; $('#fAttend').classList.remove('invalid'); }
  });
  $('#rName').addEventListener('input', () => $('#fName').classList.remove('invalid'));

  function renderThanks(){
    if (!lastReply) return;
    const t = I18N[LANG];
    $('#thanksMsg').textContent = lastReply.attending === 'yes' ? t.thanksYes(lastReply.pax) : t.thanksNo;
  }
  function showThanks(reply){
    lastReply = reply; renderThanks();
    form.hidden = true; thanks.hidden = false;
    try { localStorage.setItem('rsvp', JSON.stringify(reply)); } catch (e) {}
  }
  $('#rsvpAgain').addEventListener('click', () => {
    form.reset(); setPax(1); $('#fPax').hidden = true; lastReply = null;
    thanks.hidden = true; form.hidden = false;
    try { localStorage.removeItem('rsvp'); } catch (e) {}
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#rName').value.trim(), att = attending();
    $('#fName').classList.toggle('invalid', !name);
    $('#fAttend').classList.toggle('invalid', !att);
    if (!name || !att) return (!name ? $('#rName') : form.querySelector('input[name=attending]')).focus();

    const reply = { name, attending: att, pax: att === 'yes' ? pax : 0, notes: $('#rNotes').value.trim(), lang: LANG };
    const t = I18N[LANG], btn = $('#rSubmit');
    $('#formErr').style.display = 'none';

    if (!WEDDING.rsvpEndpoint) {
      const text = [t.waRsvp, `${t.waName}: ${reply.name}`, `${t.waAttend}: ${att === 'yes' ? t.yes : t.no}`,
        att === 'yes' ? `${t.waPax}: ${reply.pax}` : '', reply.notes ? `${t.waNotes}: ${reply.notes}` : ''].filter(Boolean).join('\n');
      window.open(waLink(WEDDING.contacts[0].phone, text), '_blank', 'noopener');
      return showThanks(reply);
    }

    btn.disabled = true; btn.querySelector('span').textContent = t.sending;
    try {
      await fetch(WEDDING.rsvpEndpoint, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(reply) });
      showThanks(reply);
    } catch (err) {
      $('#formErr').style.display = 'block';
    } finally {
      btn.disabled = false; btn.querySelector('span').textContent = I18N[LANG].send;
    }
  });
```

Replace with:

```js
  /* ---------- RSVP ---------- */
  const RSVP_ENDPOINT = '/api/rsvp?side=bride';
  const GUEST_GROUP_VALUES = ['Family', 'Friends', 'Colleagues', "Parents' Friends"];
  const form = $('#rsvpForm'), thanks = $('#rsvpThanks');
  let lastGroupIndex = -1, lastReply = null, submitting = false;
  const attending = () => (form.querySelector('input[name=attending]:checked') || {}).value;

  /* Minimal accessible listbox dropdown: wrap owns open/close state, hover/
     keyboard highlight and outside-click dismissal; onSelect owns what
     happens when an option is chosen. */
  function makeDropdown({ wrap, btn, list, onSelect }) {
    let hl = -1;
    const opts = () => [...list.querySelectorAll('.csel-opt')];
    function open() {
      wrap.classList.add('open'); list.hidden = false; btn.setAttribute('aria-expanded', 'true');
      hl = opts().findIndex(o => o.getAttribute('aria-selected') === 'true'); paintHl();
    }
    function close() { wrap.classList.remove('open'); list.hidden = true; btn.setAttribute('aria-expanded', 'false'); hl = -1; }
    function paintHl() { opts().forEach((o, i) => o.classList.toggle('hl', i === hl)); }
    function activate(li) { if (!li) return; onSelect(li); close(); btn.focus(); }
    btn.addEventListener('click', () => wrap.classList.contains('open') ? close() : open());
    list.addEventListener('click', e => activate(e.target.closest('.csel-opt')));
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) close(); });
    btn.addEventListener('keydown', e => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'].includes(e.key)) e.preventDefault();
      if (!wrap.classList.contains('open') && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { open(); return; }
      if (e.key === 'ArrowDown') { hl = Math.min(hl + 1, opts().length - 1); paintHl(); }
      else if (e.key === 'ArrowUp') { hl = Math.max(hl - 1, 0); paintHl(); }
      else if (e.key === 'Enter' || e.key === ' ') { activate(opts()[hl]); }
      else if (e.key === 'Escape') { close(); }
    });
    return { close };
  }

  function renderGuestOptions() {
    const list = $('#guestsList'), current = $('#guests').value || '1';
    list.innerHTML = [1, 2, 3, 4].map(n =>
      `<li class="csel-opt" role="option" data-value="${n}" aria-selected="${String(n) === current}">${n}</li>`).join('');
  }
  makeDropdown({
    wrap: $('#guestsSel'), btn: $('#guestsBtn'), list: $('#guestsList'),
    onSelect(li) {
      const n = li.dataset.value;
      $('#guests').value = n; $('#guestsBtnVal').textContent = n;
      [...$('#guestsList').querySelectorAll('.csel-opt')].forEach(o => o.setAttribute('aria-selected', o === li));
    }
  });
  renderGuestOptions();

  function renderGroupOptions() {
    const t = I18N[LANG], list = $('#groupList');
    const labels = t.guestgroup_labels('Alya');
    list.innerHTML = labels.map((label, i) =>
      `<li class="csel-opt" role="option" data-value="${GUEST_GROUP_VALUES[i]}" data-index="${i}" aria-selected="${i === lastGroupIndex}">${label}</li>`).join('');
    if (lastGroupIndex >= 0) { $('#guestGroup').value = GUEST_GROUP_VALUES[lastGroupIndex]; $('#groupBtnVal').textContent = labels[lastGroupIndex]; }
  }
  makeDropdown({
    wrap: $('#groupSel'), btn: $('#groupBtn'), list: $('#groupList'),
    onSelect(li) {
      lastGroupIndex = +li.dataset.index;
      $('#guestGroup').value = li.dataset.value; $('#groupBtnVal').textContent = li.textContent;
      [...$('#groupList').querySelectorAll('.csel-opt')].forEach(o => o.setAttribute('aria-selected', o === li));
    }
  });

  form.addEventListener('change', e => {
    if (e.target.name === 'attending') {
      const show = attending() === 'Attending';
      $('#fPax').hidden = !show; $('#fGroup').hidden = !show;
      $('#fAttend').classList.remove('invalid');
    }
  });
  $('#rName').addEventListener('input', () => $('#fName').classList.remove('invalid'));
  $('#rPhone').addEventListener('input', () => $('#fPhone').classList.remove('invalid'));

  function renderThanks() {
    if (!lastReply) return;
    const t = I18N[LANG];
    $('#thanksMsg').textContent = lastReply.attendance === 'Attending' ? t.thanksYes(lastReply.guestCount) : t.thanksNo;
  }
  function showThanks(reply) {
    lastReply = reply; renderThanks();
    form.hidden = true; thanks.hidden = false;
    try { localStorage.setItem('rsvp', JSON.stringify(reply)); } catch (e) {}
  }
  $('#rsvpAgain').addEventListener('click', () => {
    form.reset(); lastGroupIndex = -1;
    $('#guestGroup').value = ''; $('#groupBtnVal').textContent = I18N[LANG].groupPlaceholder;
    $('#guests').value = '1'; $('#guestsBtnVal').textContent = '1';
    renderGuestOptions(); renderGroupOptions();
    $('#fPax').hidden = true; $('#fGroup').hidden = true; lastReply = null;
    thanks.hidden = true; form.hidden = false;
    try { localStorage.removeItem('rsvp'); } catch (e) {}
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (submitting) return;
    if ($('#rCompany').value) return; // honeypot tripped - a real guest never fills this; drop silently

    const t = I18N[LANG];
    const name = $('#rName').value.trim(), phone = $('#rPhone').value.trim(), att = attending();
    const guestGroup = $('#guestGroup').value, guestCount = +$('#guests').value || 0;

    $('#fName').classList.toggle('invalid', !name);
    $('#fPhone').classList.toggle('invalid', !phone);
    $('#fAttend').classList.toggle('invalid', !att);
    $('#fGroup').classList.toggle('invalid', att === 'Attending' && !guestGroup);

    if (!name) return $('#rName').focus();
    if (!phone) return $('#rPhone').focus();
    if (!att) return form.querySelector('input[name=attending]').focus();
    if (att === 'Attending' && !guestGroup) return;

    const reply = {
      name, phone, attendance: att,
      guestCount: att === 'Attending' ? guestCount : 0,
      guestGroup: att === 'Attending' ? guestGroup : '',
      message: $('#rNotes').value.trim(),
      side: 'bride'
    };
    $('#formErr').style.display = 'none';

    submitting = true;
    const btn = $('#rSubmit');
    btn.disabled = true; btn.querySelector('span').textContent = t.sending;
    try {
      const res = await fetch(RSVP_ENDPOINT, {
        method: 'POST',
        // text/plain keeps this a CORS "simple request" - the api/rsvp.js
        // function reads the raw body itself rather than relying on a
        // preflighted application/json request.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(reply)
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Unknown error');
      showThanks(reply);
    } catch (err) {
      $('#formErr').style.display = 'block';
    } finally {
      submitting = false;
      btn.disabled = false; btn.querySelector('span').textContent = I18N[LANG].send;
    }
  });
```

- [ ] **Step 3: Call `renderGroupOptions()` on every language switch**

Find this line inside `setLang`'s `apply()` function:

```js
      renderContacts(); renderThanks();
```

Replace with:

```js
      renderContacts(); renderThanks(); renderGroupOptions();
```

- [ ] **Step 4: Verify the JS is syntactically valid**

Run: `cd version-2 && node -e "const fs=require('fs'); const src=fs.readFileSync('index.html','utf8'); const m=src.match(/<script>([\s\S]*)<\/script>/); new Function(m[1])"`
Expected: no `SyntaxError` thrown (this only checks parsing, not execution — the script references DOM globals so it can't actually run under plain Node)

- [ ] **Step 5: Manual browser verification**

Run: `cd version-2 && python3 -m http.server 8080`, open `http://localhost:8080` in a browser, open the envelope, scroll to RSVP.

Check, for both "Hadir"/"Attending" and "Tidak hadir"/"Not Attending":
- Name, phone, guest-count dropdown, guest-group dropdown, message fields all render and are keyboard-navigable (Tab, Arrow keys, Enter, Escape on the dropdowns).
- Guest-count and guest-group fields appear only when "Hadir"/"Attending" is selected.
- Submitting with empty name/phone/guest-group shows the correct localized inline errors and focuses the right field.
- Open the browser Network tab, submit a valid RSVP, and confirm a `POST /api/rsvp?side=bride` request fires with a JSON body matching
  `{ name, phone, attendance, guestCount, guestGroup, message, side: "bride" }`. It will fail with a 404 locally (no `/api` route without `vercel dev`) — confirm the on-page error message (`sendErr`/`err_network`-equivalent) appears instead of a silent failure.
- Switch language (BM ⇄ EN) and confirm the guest-group dropdown options relabel correctly and the placeholder/"Select one" text updates.

- [ ] **Step 6: Commit**

```bash
cd /Users/alyaaccess/dev/wedding/alya-hakim-wedding
git add version-2/index.html
git commit -m "Wire version-2 RSVP form to the new serverless proxy payload shape"
```

---

### Task 7: End-to-end verification with `vercel dev` (optional but recommended)

**Files:** none (verification only)

- [ ] **Step 1: Check for the Vercel CLI**

Run: `npx --yes vercel --version`
Expected: prints a version number (downloads the CLI on first run if not already installed)

- [ ] **Step 2: Run the dev server with real env vars**

```bash
cd /Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2
cp .env.example .env
npx vercel dev
```

- [ ] **Step 3: Submit a real RSVP through the browser**

Open the printed local URL, open the envelope, submit a test RSVP (e.g. name "Test Guest", a dummy phone number, "Tidak hadir"/"Not Attending" so no real seat is reserved), and confirm:
- The request succeeds (thank-you postcard appears).
- The response in the Network tab is `{ "ok": true }` (or whatever the Apps Script returns).
- Optionally, check the Google Sheet behind `BRIDE_RSVP_ENDPOINT` for the new test row, then delete it.

- [ ] **Step 4: Clean up**

```bash
rm /Users/alyaaccess/dev/wedding/alya-hakim-wedding/version-2/.env
```

(No commit — `.env` must never be committed; `.gitignore` at the repo root already covers it if `version-2/.env` matches an ignored pattern. Verify with `git status` that `.env` doesn't show as untracked-and-about-to-be-added before moving on.)
