# Wedding Invitation

Interactive wedding invitation for **Alya Humaira & Hakim**.

## Versions

### version-1/ — "HELLO, WORLD!" retro terminal game
A single-file (`index.html`) retro/terminal-themed mini-game:
boot sequence -> title ("we're getting married / you're invited") ->
Level 1 (groom brings the ring, proposal + deploy checklist) ->
Level 2 (merge conflict choice) -> invite reveal -> RSVP/map -> closing.
Blocky wedding-attire avatars, contributors card, on-screen d-pad + keyboard.

Status: kept as-is. Feedback: leans too "techy" — may be hard for older /
less tech-savvy guests to follow. A future version should be more universally
readable while keeping the couple's software-engineer charm.

Personalize: edit the `wedding` config object at the top of `index.html`
(names are set; still to fill: date, time, venue, address, dress code, rsvpUrl, mapUrl).
See `version-1/POST-BUILD.md` for details.

### version-2/ — Garden envelope invitation (current)
Responsive single page (`index.html` + `assets/`): garden-estate cover with a wax-sealed
envelope; tapping pops out the childhood photos, which fly into cameo frames on the first
page. Grid-paper inside pages (bow + cherry accents), BM/EN switch, background music,
butterflies, Save the Date + Maps, programme, countdown, Add to Calendar, doa.
Personalise the `WEDDING` settings block in `index.html`; see `version-2/POST-BUILD.md`.

## Run locally
Open `version-1/index.html` directly in a browser, or serve the folder:
`python3 -m http.server 8080` then visit http://localhost:8080/version-1/
