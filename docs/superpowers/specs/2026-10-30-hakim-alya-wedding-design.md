# New repo: hakim-alya-wedding (groom-side invitation site)

## Context

`alya-hakim-wedding` (bride-side) has a polished `version-2` design: garden-estate
cover with a wax-sealed envelope, cameo childhood photos, grid-paper inner pages,
BM/EN switch, background music, butterflies, Save the Date + Maps, programme,
countdown, Add to Calendar, doa, couple gallery, gift popup, and an RSVP form
wired to a Vercel serverless proxy (`/api/rsvp?side=bride`) that forwards to a
Google Apps Script / Sheet via the `BRIDE_RSVP_ENDPOINT` env var.

A separate repo, `wedding-groom` (`alyahmaira/wedding-groom`), already exists for
the groom's side. It has its own self-contained design (different theme, a
`CONFIG.leadName` flip, its own RSVP proxy) and its own live backend
(`GROOM_RSVP_ENDPOINT`, a separate Google Sheet). It was the original template
that `version-2`'s RSVP dropdown/payload pattern was ported from, but it hasn't
been touched since 2026-10-04 and lacks all of version-2's later polish
(envelope intro, gallery, music, butterflies, gift popup, etc.).

## Goal

Stand up a new repo, `hakim-alya-wedding`, that has the same level of polish as
`alya-hakim-wedding/version-2`, reconfigured for the groom's side, with its own
distinct-but-related color palette. It keeps posting RSVPs to the already-live
`GROOM_RSVP_ENDPOINT` (same spreadsheet the old `wedding-groom` repo used) — no
new spreadsheet needed.

## Design

### 1. Repo & deployment

- Create a new, empty GitHub repo `alyahmaira/hakim-alya-wedding` (public, same
  account as the other two, no LICENSE file — matching existing repos).
- Seed it with a flat copy of `alya-hakim-wedding/version-2/`'s contents at the
  new repo's root (`index.html`, `assets/`, `api/`, `.env.example`,
  `POST-BUILD.md`) — not nested under a `version-2/` subfolder, since this repo
  only ever has one version. `.gitignore` copied from `alya-hakim-wedding`
  (`.DS_Store`, `node_modules/`, `.env`).
- The old `wedding-groom` repo is left in place on GitHub, untouched, as a
  superseded reference (no deletion).
- Deployment is a separate Vercel project from the bride's site (out of scope
  for this task — the user deploys it manually, same as the other two sites).

### 2. Backend (RSVP)

- `api/rsvp.js` and `api/rsvp.test.js` copied verbatim from
  `alya-hakim-wedding/version-2/api/` — the handler is already side-agnostic
  (reads `?side=` query param, env vars `BRIDE_RSVP_ENDPOINT` /
  `GROOM_RSVP_ENDPOINT`), so no code changes needed.
- `.env.example` copied verbatim (keeps both endpoint vars for reference); only
  `GROOM_RSVP_ENDPOINT` needs to actually be set in the new repo's Vercel
  project env vars at deploy time.
- Front-end: `RSVP_ENDPOINT` constant changes from `/api/rsvp?side=bride` to
  `/api/rsvp?side=groom`; submit payload's `side` field changes from `'bride'`
  to `'groom'`. No other payload shape changes — reuses the live
  `GROOM_RSVP_ENDPOINT` sheet as-is.

### 3. Visual identity (CSS)

- Keep every CSS variable name, layout, and animation identical to version-2.
  Only re-point the color values:
  - `--burgundy` (and its rgba() derivatives used for shadows/borders)
    changes from the current burgundy to a deep green, e.g. `#1f3d2b` base /
    `#2e5940` for lighter accents (exact values tuned visually during
    implementation — a manual browser check in Task order below is where
    these get finalized, not frozen here).
  - Gold/cream/ivory base tones (`--olive`, parchment/cream backgrounds, gold
    foil accents) are unchanged — they're the shared "matching pair" element
    between the two sites.
- No changes to fonts, spacing, border styles, or animation timing.

### 4. Content personalization

All of the following are swapped from bride-led to groom-led. Where real data
(names, phone numbers, photos) isn't available yet, use clearly-marked
placeholders (matching the existing project convention of "still to fill"
placeholders documented in POST-BUILD.md), so the site is functional and
honest about what's unpersonalized rather than silently wrong.

- **Name order**: "Alya & Hakim" → "Hakim & Alya" everywhere it appears as a
  pair (hero `<h1>`, `<title>`, OG meta tags, postcard "Kepada" field, postcard
  stamp initials `A&H` → `H&A`, WhatsApp RSVP message header, calendar event
  text, `document.title`).
- **Invite text**: `ke majlis perkahwinan puteri kami` ("our daughter's
  wedding") → `ke majlis perkahwinan putera kami` ("our son's wedding"), and
  the English equivalent ("wedding of our eldest daughter" → "wedding of our
  son") in the first family contact's message.
- **Patronymic**: `binti Hj Ahmad Shukri` (bride's father's name) → `bin
  <groom's father's name>` — placeholder until the real name is provided.
- **Parents' names block** (`<p class="caps parents">`): bride's parents'
  names → groom's parents' names — placeholder until provided.
- **`contacts[]` array**: bride's family (father/mother/sister) → groom's
  family (father/mother/sibling), each with their own name, role label
  (`Groom's Father` / `Bapa Pengantin Lelaki`, etc.), phone, avatar image, and
  a personalized WhatsApp greeting message — placeholders for name/phone/photo
  until provided; role labels and message templates can be written now by
  mirroring the bride's phrasing with "son"/"groom" substituted for
  "daughter"/"bride".
- **`guestgroup_labels('Alya')` → `guestgroup_labels('Hakim')`** — one-line
  change in both the `ms` and `en` i18n blocks (these are already
  function-parameterized by name, so this is just swapping the literal
  argument).
- **Cameo/childhood-photo captions and `aria-label`s** that currently read
  "Alya" where the lead name is referenced — updated to be consistent with the
  Hakim & Alya name order. The childhood photo *assets themselves*
  (`bride-kid.jpg` / `groom-kid.jpg`) are copied over unchanged — both already
  exist in the bride repo's asset set and show on both sites regardless of
  which name leads.
- **Couple gallery photos** (`assets/gallery/g1.jpg`–`g6.jpg`): copied over
  unchanged — same couple, same photos, same order.
- **Unchanged**: date (`2026-12-26T11:00:00+08:00`), venue (`ISTAC, Bukit
  Tunku`), maps/waze URLs, programme items, music, gift QR — same event as the
  bride's site, so none of this differs.

### 5. Testing / verification

- `node --test api/rsvp.test.js` in the new repo passes unmodified (handler is
  unchanged).
- Manual browser check (`python3 -m http.server`) in both BM and EN: page
  renders with the new green palette, hero shows "Hakim & Alya", RSVP form
  validates in the right order, guest-count/guest-group dropdowns work and
  show Hakim-personalized labels, language switch updates all swapped strings.
- `vercel dev` smoke test: submit one test RSVP (e.g. "Test Guest", dummy
  phone, "Not Attending" so no real seat is reserved) and confirm the request
  hits `/api/rsvp?side=groom`, payload has `"side":"groom"`, and the response
  is `{"ok":true}` — then optionally verify/delete the test row in the
  `GROOM_RSVP_ENDPOINT` sheet.

## Out of scope

- No changes to `alya-hakim-wedding` or the old `wedding-groom` repo's code.
- No new Google Sheet / Apps Script — reuses the existing live
  `GROOM_RSVP_ENDPOINT`.
- No actual Vercel deployment or domain setup — repo creation and code only;
  deployment is a manual follow-up step for the user.
- No changes to layout, animations, fonts, or any section's structure — only
  color values and the content listed in "Content personalization" change.

## Open questions / placeholders to fill in later (not blockers)

- Groom's father's full name (for the patronymic and parents' names block).
- Groom's parents' names, and his family contacts' names/phones/photos.
- Final exact hex values for the green palette (tuned visually, not frozen
  here).
