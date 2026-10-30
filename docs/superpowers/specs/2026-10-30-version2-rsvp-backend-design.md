# version-2 RSVP backend: adopt wedding-groom's serverless proxy

## Context

`version-2/` (the current bride-side invitation site) submits its RSVP form
directly from the browser to a Google Apps Script web-app URL
(`WEDDING.rsvpEndpoint`), using `fetch(..., { mode: 'no-cors' })` with a
`URLSearchParams` body. Fields collected: `name, attending, pax, notes, lang`.
The matching backend (`version-2/apps-script/Code.gs`) writes
`Timestamp, Name, Attending, People, Notes, Language` to a Sheet. If
`rsvpEndpoint` is empty, the form instead opens WhatsApp with a pre-filled
message.

The sibling repo `wedding-groom/` (the groom-side site) uses a different
pattern: the browser POSTs JSON to a same-origin Vercel serverless function
(`/api/rsvp?side=groom`), which server-side forwards the request to a Google
Apps Script URL selected via the `side` query param from env vars
(`BRIDE_RSVP_ENDPOINT` / `GROOM_RSVP_ENDPOINT`). Its form fields are
`name, phone, attend, guests (1-6), guestGroup, message`, submitted as
`{ name, phone, attendance, guestCount, guestGroup, message, side }`.

Notably, `wedding-groom/.env.example` already contains a real-looking,
confirmed-live `BRIDE_RSVP_ENDPOINT` — i.e. a Google Apps Script backend
already exists for the bride side, built for the groom's payload schema (not
version-2's current schema).

## Goal

Make `version-2` use the exact same serverless-proxy backend pattern as
`wedding-groom`, submitting the same payload shape to the already-live
`BRIDE_RSVP_ENDPOINT`. The two sites remain separate deployments, each with
its own copy of the proxy function and env config.

## Design

### 1. Serverless function + env

- Copy `wedding-groom/api/rsvp.js` to `version-2/api/rsvp.js` unchanged.
  It proxies `POST` requests to `BRIDE_RSVP_ENDPOINT` or
  `GROOM_RSVP_ENDPOINT` (env vars) based on the `?side=` query param,
  forwarding the raw request body and relaying the JSON response back to the
  browser (or a structured `{ ok:false, error, details }` on failure).
- Copy `wedding-groom/.env.example` to `version-2/.env.example` with the same
  `BRIDE_RSVP_ENDPOINT` / `GROOM_RSVP_ENDPOINT` values (confirmed live/correct
  by the project owner).
- Delete `version-2/apps-script/Code.gs` — its schema (name/attending/pax/
  notes/lang) no longer matches what the live `BRIDE_RSVP_ENDPOINT` script
  expects, and it's superseded by the already-deployed Apps Script behind
  that endpoint.

### 2. Front-end payload + endpoint

- Replace the `WEDDING.rsvpEndpoint` config field and its empty-value
  WhatsApp-fallback branch with a hardcoded constant, mirroring groom's file:
  ```js
  const RSVP_ENDPOINT = '/api/rsvp?side=bride';
  ```
- Build and submit the exact same payload shape as groom:
  ```js
  { name, phone, attendance, guestCount, guestGroup, message, side: 'bride' }
  ```
- Switch the submit handler to groom's fetch pattern — JSON string body with
  `Content-Type: text/plain;charset=utf-8` (keeps it a CORS "simple request";
  same-origin anyway since both the page and `/api/rsvp` are on version-2's
  own deployment), parse the JSON response, check `data.ok`.
- Keep version-2's existing success/error UI (thank-you postcard,
  `localStorage` "remembered reply", bilingual error text) — only the
  request/response plumbing and payload fields change.

### 3. Form fields (index.html)

- **Name** (`name="name"`) — unchanged, required.
- **Phone** (`name="phone"`, `type="tel"`) — new, required. Localized label
  added to the `I18N` blocks (EN: "Phone Number", BM: "Nombor Telefon").
- **Attendance** — existing Hadir/Tidak Hadir radio pair keeps its localized
  labels, but the underlying `value`s change to canonical English
  `Attending` / `Not Attending` (payload field: `attendance`).
- **Guest count** — replace the current +/− stepper with a `csel`
  dropdown (ported from groom, restyled with version-2's CSS variables:
  `--maroon`, `--line`, `--mist`, etc.), range **1–4**. Hidden input
  `name="guests"` feeds `guestCount` in the payload, as in groom.
- **Guest Group** — new required field, same `csel` dropdown component,
  canonical values `['Family','Friends','Colleagues',"Parents' Friends"]`
  (must match exactly — these are read by the Apps Script / sheet). Labels
  personalized to the bride in both languages:
  - EN: "Alya's family", "Alya's friends", "Alya's colleagues",
    "Friends of Alya's parents"
  - BM: "Keluarga Alya", "Kawan Alya", "Rakan sekerja Alya",
    "Kawan kepada ibu bapa Alya"
- **Message** (`name="message"`) — renamed from `notes`, still optional
  textarea.
- **Honeypot** — add groom's hidden `company` field; a non-empty value
  silently drops the submission client-side (bot protection), matching
  groom exactly.
- Only shown when "Attending" is selected: guest count + guest group (same
  conditional-reveal behavior version-2 already has for its pax field).

### 4. Validation

Mirror groom's client-side validation order/messages (localized):
name required → phone required → guest group required when attending →
guest count defaults to 1 if unset. Honeypot check happens first and exits
silently (no error shown) if tripped.

### 5. Documentation

- Update `version-2/POST-BUILD.md`: replace the "paste Code.gs into Apps
  Script" instructions with a short section describing the serverless-proxy
  setup — copy `.env.example` into the Vercel project's environment
  variables, the `/api/rsvp?side=bride` endpoint, and that the Apps Script
  behind `BRIDE_RSVP_ENDPOINT` is already deployed and live.

## Out of scope

- No changes to `wedding-groom/` itself.
- No changes to version-2's visual theme, animations, envelope/storybook
  intro, music, or any section other than the RSVP form.
- No change to deployment topology — the two sites stay as two separate
  deployments, each with its own `api/rsvp.js` + env vars.

## Testing / verification

- Manual: serve `version-2/` locally (`python3 -m http.server`), confirm the
  RSVP form renders correctly in both languages, validation fires in the
  right order, and guest-count/guest-group dropdowns work.
- Since `/api/` serverless functions require a Vercel-like runtime, full
  end-to-end submission (hitting the live `BRIDE_RSVP_ENDPOINT`) can only be
  verified after deployment or via `vercel dev` locally — call this out
  during implementation.
