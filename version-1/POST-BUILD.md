# POST-BUILD — HELLO, WORLD! Wedding Game

## Personalize
Edit the `wedding` object at the very top of `index.html`:
- `groomName`, `date`, `time`, `venue`, `address`, `dressCode`
- `brideName` is prefilled to "ALYA HUMAIRA".

## Links
- RSVP button → `wedding.rsvpUrl`
- Map button → `wedding.mapUrl`
Use a full `https://` URL (e.g. a Google Form for RSVP, a Google Maps place link for the map).

## Re-skin avatars (optional)
Palette arrays near the avatar code: `SKIN`, `HIJAB`, `HAIR`, `OUTFIT`. Default indices are in `AVATAR`.

## Hosting
Any static host works — drag-drop the single `index.html` to Netlify Drop, GitHub Pages, or Cloudflare Pages.

## QR code
Once hosted, generate a QR pointing at the URL with any free QR generator; print it on save-the-dates.
