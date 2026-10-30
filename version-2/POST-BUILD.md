# POST-BUILD — Version 2 (Garden envelope · Alya & Hakim)

Static site: `index.html` + `assets/`. No build step.

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

## Bottom bar
Utama · Lokasi · RSVP · Hubungi — appears after the envelope is opened and highlights the section in view.

All visible wording (BM + EN) lives in the `I18N` object just below. Still placeholders:
parents' names (`parents`), and programme times/items (`p1`–`p4` plus the times in the HTML).

## Run locally
`python3 -m http.server 8080` inside `version-2/`, then open http://localhost:8080

## Deploy (any static host)
- **Netlify Drop**: drag the `version-2` folder onto https://app.netlify.com/drop
- **Vercel**: `npx vercel` inside `version-2/`
- **GitHub Pages / Cloudflare Pages**: publish the `version-2` folder as the site root

After deploying, change `og:image` in `<head>` to the full URL (e.g. `https://your-site/assets/scene.jpg`)
so WhatsApp/Telegram link previews show the garden image.
