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
```

Each game is self-contained: its own folder, its own CSS, no shared runtime and
no build step. Adding a game means dropping in a folder and adding a tile to the
root `index.html`.

## Adding a picture

Append to `BUILTIN_PUZZLES` in `js/puzzles-data.js`: a `legend` mapping single
characters to hex colors, and an `art` array of equal-length strings. `.` means
blank (stays white, never needs painting). Legend order sets the swatch numbers.

## Notes

- Progress saves to `localStorage` per puzzle; photo puzzles are stored whole,
  run-length encoded (about 600 bytes each).
- Targets Safari 16 (iPhone 8 Plus and X both top out at iOS 16.7).
- Scripts are plain `<script>` tags, not modules, so the folder also works when
  opened directly from `file://`.
