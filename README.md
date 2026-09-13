# Kids' Arcade

Ad-free web games for old iPhones used as mini tablets. Plain static files —
no build step, no dependencies, no network calls, no tracking.

## Games

- **Color by Number** — pixel-grid coloring. Tap a numbered swatch, drag to fill
  matching cells. One finger paints, two fingers pinch/pan. Photo import turns a
  picture from the camera roll into a puzzle, entirely on the device.
- **Water Sort** — pour liquid between tubes until each holds one color. Levels
  are generated on the fly and checked with a solver before being handed over,
  so no deal is ever impossible. Unlimited undo.
- **Block Blast** — drag three dealt shapes onto an 8x8 board; full rows and
  columns clear. No falling pieces and no timer. Combo bonuses for multiple
  lines and consecutive clears; best score is kept.

### Action games (the cabinet)

A separate section on the menu, styled as little arcade cabinets, for the
games that do have timers, lives and high scores. They share `cabinet/`:

- `cabinet/cabinet.js` — scaled-up 240x320 canvas with no smoothing, a 3x5
  bitmap font, square-wave beeps, a fixed-step game loop, five-entry high
  score tables with three-letter initials, and the attract / game-over cards.
- `cabinet/cabinet.css` — bezel, CRT scanlines and vignette, pixel-style
  overlays.

- **Breakout** — slide to steer, tap to launch. Seven brick layouts that loop
  faster; two-hit bricks in capitals.
- **Snake** — swipe to turn. Speeds up every four apples.
- **Missile Command** — tap where the counter-missile should explode. Six
  cities, growing waves, ammo per wave, bonus for cities and ammo left.

## Running it

Any static file server works:

```bash
python3 -m http.server 8123
```

Then open `http://localhost:8123`. To try it on a phone on the same wifi, use the
Mac's LAN address instead of `localhost`.

## Layout

```
index.html                     arcade menu
games/color/                   Color by Number
  js/util.js                   RLE + bitset encoding, safe localStorage, color helpers
  js/quantize.js               median-cut color reduction for photo import
  js/puzzles-data.js           built-in pictures as 16x16 character art
  js/puzzle.js                 puzzle model, photo -> puzzle, save/load
  js/render.js                 cached layers + pan/zoom transform
  js/input.js                  pointer gestures
  js/app.js                    screens, palette, glue
games/watersort/               Water Sort
  js/level.js                  rules, deal generation, solvability check
  js/game.js                   state, moves, undo
  js/ui.js                     rendering and taps
games/blockblast/              Block Blast
  js/pieces.js                 shape table and weighted piece picking
  js/game.js                   board, placement, line clears, scoring
  js/ui.js                     drag and drop, previews, animations
games/2048/                    2048
  js/game.js                   grid as exponents, slide/merge, save
  js/ui.js                     swipes, tile animation
games/memory/                  Memory Match
  js/game.js                   deck, flips, matches, save
  js/ui.js                     card flip animation, sizes
games/nonogram/                Picture Puzzles (nonograms)
  js/puzzles-data.js           pictures as character art, '#' filled
  js/game.js                   clues, cell state, per-puzzle save
  js/ui.js                     library, grid, drag painting
games/flow/                    Flow
  js/level.js                  seeded RNG, carve grid into paths
  js/game.js                   path drawing rules, cut/backtrack, save
  js/ui.js                     canvas rendering, finger tracking
games/simon/                   Simon
  js/game.js                   sequence, best round
  js/ui.js                     playback timing, Web Audio tones
games/shapes/                  Shape Fit
  js/level.js                  grow an outline, cut it into pieces
  js/game.js                   placement, rotation, occupancy, save
  js/ui.js                     drag from tray or board, tap to rotate/lift
games/dots/                    Dot to Dot
  js/pictures-data.js          outlines as [x, y] points in a 0..100 square
  js/game.js                   next-dot state, per-picture save
  js/ui.js                     canvas, tap detection, library thumbnails
cabinet/                       shared kit for the action games (see above)
games/breakout/ games/snake/ games/missile/
                               action games: js/game.js rules, js/ui.js drawing + input
diag.html                      device check page (see Troubleshooting)
tools/update-sw.py             regenerate the service worker precache list
tools/make-icon.py             draw a home-screen icon (gradient + motif)
tools/nono-check.py            verify nonograms need no guessing
```

Each game is self-contained: its own folder, its own CSS, no shared runtime and
no build step. Adding a game means dropping in a folder, adding an entry to
`GAMES` in the root `index.html`, and running `python3 tools/update-sw.py`.

The only contract between a game and the menu is one localStorage key:
`arcade.stat.<id>` holds a short progress line ("Level 12", "Best 3180") that
the tile shows.

## Adding a picture

Append to `BUILTIN_PUZZLES` in `js/puzzles-data.js`: a `legend` mapping single
characters to hex colors, and an `art` array of equal-length strings. `.` means
blank (stays white, never needs painting). Legend order sets the swatch numbers.

## Adding a nonogram

Append to `NONO_PUZZLES` in `games/nonogram/js/puzzles-data.js`: an `art`
array of equal-length strings with `#` for filled cells, plus a `color` used
when the picture is revealed. Then run `python3 tools/nono-check.py`; it
rejects any picture that would force a kid to guess.

## Notes

- Progress saves to `localStorage` per puzzle; photo puzzles are stored whole,
  run-length encoded (about 600 bytes each).
- Water Sort and Block Blast save the board in play after every move, so a
  phone going to sleep mid-puzzle picks up exactly where it was.
- **Backup & restore** on the arcade menu turns every saved key into one
  `ARCADE1:` code (base64 JSON). Paste it into Notes or a message; paste it
  back on another phone to restore. Home-screen web apps are exempt from
  Safari's 7-day storage purge, so the main way to lose progress is deleting
  the icon.
- Targets Safari 16 (iPhone 8 Plus and X both top out at iOS 16.7).
- Scripts are plain `<script>` tags, not modules, so the folder also works when
  opened directly from `file://`.

## Deploying to GitHub Pages

The site is plain static files, so Pages needs no build step or workflow —
serving the repository root is enough.

```bash
gh repo create kids-arcade --public --source=. --remote=origin --push
gh api -X POST repos/:owner/kids-arcade/pages -f source[branch]=main -f source[path]=/
```

The site then lives at `https://<user>.github.io/kids-arcade/`. All paths in the
project are relative, so serving from a subdirectory works as-is.

Pages from a **private** repository requires a paid GitHub plan; a public repo
is free.

### After changing any file

```bash
python3 tools/update-sw.py
```

This rewrites the precache list in `sw.js` from the files on disk and bumps
`CACHE` (`arcade-v1` -> `arcade-v2`, and so on). The service worker serves from
its cache first, so without a version bump phones keep running the old copy.

The menu shows a pill in the corner: **Ready offline** once every file is
cached, or a count if some were missed. Glance at it before a road trip.
The installed version (`v13` and so on) is printed at the bottom of the
menu, and **Update now** asks the worker to check for a newer one and
reloads when it takes over. The worker fetches with the HTTP cache bypassed,
since GitHub Pages sends a 10-minute cache header.

## Adding to the home screen

Open the site in Safari, then Share -> Add to Home Screen. Each game has its own
icon and manifest, so games can be added individually as well as the arcade.
Once added, they launch fullscreen with no browser chrome and work offline.

## Developing

The service worker serves cached files first, except on `localhost`, where
it steps aside so edits show up on reload. If you test through another
hostname (the Mac's LAN address, say), unregister the worker in devtools
(Application > Service Workers) or run this in the console before reloading:

```js
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()))
```

## Troubleshooting a phone

If a game shows a blank screen on a phone, open `/diag.html` on that device. It
renders a series of plain checks — HTML, inline styles, grid, `env()`,
gradients, then JavaScript — and prints the user agent, screen size and whether
`localStorage` is blocked. Whichever step is the last one visible tells you what
the browser choked on.
