# Kids' Arcade

Ad-free web games, played mostly on iPads in the car and on old iPhones at home. Plain static files —
no build step, no dependencies, no network calls, no tracking.

## Games

Puzzles (no timers, no lives; everything saves as you go):

- **Color by Number** — pixel-grid coloring. Tap a numbered swatch, drag to fill
  matching cells. One finger paints, two fingers pinch/pan. 81 built-in
  pictures in four sections by size, plus a sticker book that collects
  finished pictures into ten themed collections (Pets & farm, Wild animals,
  Under the sea, Dinos & dragons, Magic, Things that go, Yummy, Space &
  robots, Outdoors, Shapes & patterns). New pictures wear a NEW tag for
  returning players; finishing one makes it shimmer and suggests what to
  colour next. Photo import (Small / Medium / Big) turns a picture from the
  camera roll into a puzzle, entirely on the device.
- **Water Sort** — pour liquid between tubes until each holds one color. Levels
  are generated on the fly and checked with a solver before being handed over,
  so no deal is ever impossible. Unlimited undo, a hint, and a **+ Tube**
  button (one extra empty tube per level); 3 stars for using neither.
- **Block Blast** — drag three dealt shapes onto an 8x8 board; full rows and
  columns clear. No falling pieces and no timer. Combo bonuses for multiple
  lines and consecutive clears; best score is kept.
- **2048** — swipe to slide every tile; equal tiles merge. Undo, best score,
  and a "next goal" strip. The reference game for the kit.
- **Memory Match** — flip two cards, find the pairs. Easy / Medium / Hard
  (6, 8 or 12 pairs) in Animals, Food, Vehicles or Mixed; the board reshapes
  itself to give the biggest cards for the screen.
- **Picture Puzzles** (nonograms) — fill squares from the row and column clues
  to reveal a picture. Drag to fill a line, Mark mode for X's, hints, undo, a
  first-time tutorial; lines that are right cross out their spare squares.
  Every picture is checked to need no guessing.
- **Flow** — join each pair of dots with a pipe so the pipes fill the board.
  Seeded levels grow from 4x4; a bubble under the finger shows the pipe being
  drawn; stars per level and a level picker.
- **Simon** — watch the pads light up, then repeat the sequence; one more each
  round. The hub's ring fills as you go; best round is kept.
- **Shape Fit** — drag the pieces from the tray into the outline. Tap to turn
  a piece; near misses snap to the closest spot that fits. Hints and stars.
- **Dot to Dot** — tap the next dot or slide a finger through them; the
  finished outline floods with colour, then comes alive with its details (a
  face, windows, wheels, petals) and blinks when tapped. Pictures in three
  sections by size.
- **Maze** — drag the animal to its treat. Mazes are seeded, so level N is
  always the same maze; the short side grows from 5 to 15 cells and the long
  side stretches to the screen's shape (a tall phone gets a tall maze).
- **Four in a Row** — against the computer (Easy / Medium / Hard, Hard is a
  5-ply alpha-beta search) or two players passing the phone. Take back a
  move; the score chips keep a running tally for the current mode.
- **Jigsaw** — real jigsaw-shaped pieces (tabs and blanks) from Color by
  Number's 81 pictures, shown crisp and grouped by theme, or from a photo from
  the camera roll (kept on the device). Pick the size by picture: 4, 9, 16,
  25, 36 or 49 pieces (36 at most on a phone). Drag pieces from the tray;
  close enough clicks them in, and neighbours dropped side by side join up and
  move together. Two kids can drag at once. A faint picture on the board (on
  by default for 4 and 9 pieces), a peek button, a hint that lights up a
  piece's spot (edges first), and a Tidy button. Finished pictures shimmer,
  then "Up next" suggests another. Saves mid-puzzle; the library shows each
  puzzle's progress.
- **Mini Golf** — pull back anywhere on the course and let go to putt; a
  dotted line shows where the ball goes and a ring shows how hard. 18 holes in
  three courses (Candy Garden, Pirate Cove, Space Station), each hole bringing
  in one new thing: bank walls, curves, bumpers, sand, water, a bridge, hills
  and slopes, a sliding plank, spinners, a warp tunnel and a conveyor belt.
  Each hole turns on its side on wide screens so it's always as big as it can
  be. Par with stars (under par 3, par 2), a scorecard and best scores per
  hole. No failing: water just puts the ball back, and after 8 shots it hops
  in. One player, or two passing the iPad. Saves after every putt.

### Action games (the cabinet)

A separate section on the menu, styled as little arcade cabinets, for the
games that do have timers, lives and high scores. They share `cabinet/`, on
top of the kit:

- `cabinet/cabinet.js` — `Cabinet.screen` sizes a small pixel canvas (about
  240 logical px on its short side) to the screen in whole device pixels with
  no smoothing: tall on phones, near square on an iPad in portrait, wide in
  landscape (Pong turns its court sideways). A 3x5 bitmap font, sprites from
  strings, square-wave beeps and tunes, a fixed-step game loop, `Cabinet.Fx`
  (particles, rings, flashes, score pops, shake), kit score chips in the bar
  (`Cabinet.hud`), five-entry high score tables with three-letter initials,
  and the attract / pause / game-over cards (attract and pause cards carry
  How to play). `Cabinet.setup({ id, help, isPlaying })` wires mute, pause,
  first-run help, auto-pause and the side-panel score table in one call.
  `Cabinet.keep({ id, save, restore })` keeps a round across a reload or a
  turn of the screen (saved to `cab.save.<id>`; Continue on the attract card
  via `Cabinet.attract({ resume })`; a Keep playing card and a 3-2-1
  `Cabinet.countdown()`).
- `cabinet/cabinet.css` — bezel, CRT scanlines and vignette. In landscape
  the kit bar becomes a side column with the scores, the high-score table
  and help.

- **Breakout** — slide to steer, tap to launch. Seven brick layouts that loop
  faster; two-hit bricks in capitals. Falling capsules: W wide paddle, S slow
  ball, M multi-ball, + extra ball; a bonus ball for every cleared wall.
- **Snake** — swipe to turn. Speeds up every four apples; golden apples are
  worth extra. Wrap around the walls (the default) or Bump = out, each with
  its own high-score table.
- **Missile Command** — tap where the counter-missile should explode. Six
  cities, growing waves, ammo per wave, bonus for cities and ammo left. Chain
  kills score x2, x3…; an empty battery slowly reloads a few shots.
- **Frogger** — tap above the frog to hop up, beside it to sidestep. Five
  lanes of traffic, a median, five lanes of logs and turtles, five homes.
- **Space Invaders** — slide to move; the ship fires itself. The block
  speeds up as it thins, shields erode (including from your own shots). If
  the aliens land you lose a ship and the block is pushed back up.
- **Pong** — paddles top and bottom in portrait, left and right in
  landscape. Two kids share the screen, each dragging their own half, or the
  top paddle plays itself (Easy / Medium / Hard; Easy gives you a bigger
  paddle). First to 7.
- **Asteroids** — hold a finger down; the ship turns toward it, drifts after
  it and fires by itself. Rocks split three times; a UFO drops in now and then.
- **Busy Bee** — our own game. Slide a finger anywhere and the bee flies with
  it (or tap where it should go). Touch the glowing flowers to pick up pollen,
  then fly it home to the hive in the middle to make honey; the more you carry
  in one trip, the more each ball is worth. Fill the honey bar to reach the
  next level. Wasps chase you when you get close and a spider drops in from
  level 3; a bump costs a heart and spills your pollen (pick it back up
  quickly!). The hive is safe: wasps can't come in. Gold flowers give three
  pollen, heart flowers give a heart back.

Every cabinet game pauses itself when the phone sleeps or the app is
switched away, and has a pause button and the shared mute. A round in
progress is kept: it is saved when the page is hidden or closed, every few
seconds of play and after a turn of the screen. If iOS throws the tab away in
the car (or a kid taps Back mid-round), the attract card offers **Continue**
or **New game** next time, and play comes back after a 3-2-1. Game over
forgets the save. Breakout puts the ball back on the paddle (same level,
score, balls and bricks); Frogger starts the frog from the bottom strip (same
level, score, frogs and homes); Pong serves again at the same score; Snake,
Missile Command, Space Invaders and Asteroids carry on where they were (the
Asteroids ship in its shield bubble); Busy Bee waits at the hive door with its pollen,
flowers and wasps where they were. Turning the device mid-round rebuilds
the playfield for the new shape: bricks, aliens, cities and lanes are
re-spread, the snake's board turns a quarter, and Frogger slides the frog's
lane so it is never dropped in the water. The game then waits on a "Turned
around!" card with Keep playing. Nothing is refilled or lost on the way.

### Card games

A third section on the menu, on a strip of felt. They share `cards/` on top
of the kit, the way the action games share `cabinet/`. All four use the same
felt table with a wooden rim, the same seats for computer friends, and kit
result cards.

- `cards/cards.js` — the `Cards` kit: a standard deck (`{ s, r }`, four suit
  colours so younger kids can match at a glance; `Cards.SUIT_COLOR`), shuffle
  and sort, card faces as one crisp inline SVG with drawn court cards
  (`Cards.faceHTML(card)`, overridable; `Cards.courtSVG`, `Cards.pip(suit,
  cls)`; `Cards.FACE_ART` kept for compatibility), card elements that flip,
  `Cards.fan` to lay a hand out in up to three overlapping rows, `Cards.fly`
  to animate a card between any two places, computer opponents with names
  and animal faces (`Cards.pickBots`, `Cards.seat`, `Cards.updateSeat`,
  `Cards.say(seat, text, { html })`), overlays (`Cards.choose` with
  `suit` / `html` options, `Cards.handoff` for pass-and-play,
  `Cards.banner`), sounds through `Kit.sfx` and the one mute (`Cards.sfx`
  incl. `flip` / `good`, `Cards.tone`, `Cards.muted()`, `Cards.bindMute`,
  which returns the button), `Cards.reduced`, and safe
  `Cards.load/save/drop/stat`.
- `cards/cards.css` — the `.cd-table` felt table, cards, seats
  (`.cd-seat`, `.cd-seat--row` lays one out sideways; `.cd-info`), notes
  (`.cd-note`), the selected-card lift (`.hand .card.sel`) and the overlays.
  Everything scales from the `--cw` (card width) variable; phones get a thin
  rim. Options a table can switch on: `.cd-two-color` (classic red / black
  suits) and `.cd-peek` (a big rank and suit along the top edge, so a card
  peeking out of a stacked column still reads).

- **Crazy Eights** — match the suit or the number; eights are wild and pick
  the suit. Against 1-3 computer friends (Easy or Clever) or two players
  passing the phone. Party rules add 2 = draw two, Q = skip, A = reverse.
  Playable cards glow on your turn, and the deck only lets you draw when
  nothing matches. Saves mid-game.
- **Go Fish** — for kids who can't read yet: every card is an animal picture
  and every prompt is a picture. Tap a card, then tap a friend to ask for
  it; no match means go fish in the pond. Four the same make a set; most
  sets wins. 1-3 computer friends. Saves mid-game.
- **Hatch Match** — our own card game in the Crazy Eights family. Four
  critters (Dragon, Duck, Dino, Turtle), each as Egg, Hatching and Grown;
  match the colour or the picture. Hold the next stage of the critter you
  just played? Play it too (a Grow run, up to three cards). Munch +2 stacks
  onward, Storm blows every hand to the next seat, Nap skips the next
  friend, Chameleon picks the colour. 1-3 computer friends (Easy / Clever)
  or 2 players on one device. No reading needed; saves mid-game.
- **Solitaire** (Klondike) — only deals winnable games: `js/deals.js` holds
  seeds the solver has won (and replayed legally), with separate lists for
  Draw 1 and Draw 3. Tap a card to send it to its best spot or drag it;
  moves and a timer, undo, auto-finish and a win cascade. The same solver, with a time limit,
  powers the Hint button. Classic red / black suits.

## Running it

Any static file server works:

```bash
python3 -m http.server 8123
```

Then open `http://localhost:8123`. To try it on a phone on the same wifi, use the
Mac's LAN address instead of `localhost`.

## Layout

```
index.html                     arcade menu (built on the kit)
menu-art.js                    inline-SVG pictures for the menu tiles, by game id
manifest.webmanifest, icon-arcade.png   the arcade's home-screen app
sw.js                          service worker (precache list written by tools/update-sw.py)
kit/kit.css, kit/kit.js        shared kit for every game (see "Shared kit")
cabinet/                       cabinet.js + cabinet.css, on top of the kit, for the action games
cards/                         cards.js + cards.css, on top of the kit, for the card games
games/color/                   Color by Number
  css/style.css                (the only game with its stylesheet in css/)
  js/util.js                   RLE + bitset encoding, safe localStorage, color helpers
  js/quantize.js               median-cut color reduction for photo import
  js/puzzles-data.js           built-in Quick pictures as 16x16 character art
  js/pictures-*.js             bigger pictures: medium (24), hard (32), expert (40-48)
  js/puzzle.js                 puzzle model, photo -> puzzle, save/load
  js/render.js                 cached layers + pan/zoom transform
  js/input.js                  pointer gestures
  js/app.js                    screens, library, palette, photo import, glue
games/watersort/               Water Sort
  js/level.js                  rules, deal generation, solvability check
  js/game.js                   state, moves, undo
  js/ui.js                     tube sizing, pours, + Tube, hint, stars
games/blockblast/              Block Blast
  js/pieces.js                 shape table and weighted piece picking
  js/game.js                   board, placement, line clears, scoring
  js/ui.js                     drag and drop, previews, animations
games/2048/                    2048
  js/game.js                   grid as exponents, slide/merge, save
  js/ui.js                     swipes, per-tile slide/merge animation (the kit reference game)
games/memory/                  Memory Match
  js/game.js                   sizes, themes, deck, flips, matches, save
  js/ui.js                     layout for the biggest cards, flip animation
games/nonogram/                Picture Puzzles (nonograms)
  js/puzzles-data.js           pictures as character art, '#' filled
  js/game.js                   clues, cell state, per-puzzle save
  js/ui.js                     library, clue+grid .k-fit box, drag painting, hints, tutorial
games/flow/                    Flow
  js/level.js                  seeded RNG, carve grid into paths
  js/game.js                   path drawing rules, cut/backtrack, save
  js/ui.js                     candy-tube canvas, finger bubble, stars, level picker
games/simon/                   Simon
  js/game.js                   sequence, best round
  js/ui.js                     pads + hub (play / round / progress ring), Kit.sfx tones
games/shapes/                  Shape Fit
  js/level.js                  grow an outline, cut it into pieces
  js/game.js                   placement, rotation, occupancy, save
  js/ui.js                     board cropped to the outline, auto-sized tray, snap-to-fit drag
games/dots/                    Dot to Dot
  js/pictures-data.js          outlines as [x, y] points in a 0..100 square, plus optional
                               `details` (fill/disc/line/arc/dot/star/eye) in the same space
  js/game.js                   next-dot state, per-picture save
  js/ui.js                     library by size, canvas, tap or slide through dots
games/maze/                    Maze
  js/game.js                   seeded recursive-backtracker maze (stretches to the screen's shape), path, route for hints, save
  js/ui.js                     canvas, finger tracing
games/connect4/                Four in a Row
  js/game.js                   board, win check, computer player
  js/ui.js                     SVG frame, hover-and-drop, take back, setup sheet
games/jigsaw/                  Jigsaw (pictures come from games/color/js, read only)
  js/pictures.js               picture list by theme, crisp pixel-art drawing, thumbnails
  js/shapes.js                 seeded tab-and-blank cut, piece outlines
  js/photos.js                 camera-roll photos in IndexedDB
  js/game.js                   piece states (tray / table group / placed), save + checks
  js/ui.js                     library, size picker, board + tray layout, cached piece bitmaps, multi-touch drag, hints, finish
games/minigolf/                Mini Golf
  js/sim.js                    deterministic physics (fixed step, capsule walls, own sine; also loads in Node)
  js/holes.js                  three courses of six holes, in each hole's own space
  js/draw.js                   fit/turn the hole to the screen, static layer + per-frame layer
  js/ui.js                     pull-back putting, turns, banners, scorecard, saves
  tools/check.js               solver + fuzz: every hole can be finished, no ball escapes or sticks
games/breakout/ games/snake/ games/missile/
games/frogger/ games/invaders/ games/pong/ games/asteroids/ games/bee/
                               action games: js/game.js rules, js/ui.js drawing + input
games/crazy8/                  Crazy Eights
  js/game.js                   deal, legal plays, party effects, computer player
  js/ui.js                     table, turns, animations, pass-and-play
games/gofish/                  Go Fish
  js/game.js                   rules, pictures, computer friends
  js/ui.js                     table, picture prompts, animations
games/hatch/                   Hatch Match (our own shedding game)
  js/game.js                   design note, deck, rules, computer friends (no DOM)
  js/art.js                    SVG card faces and back (HMArt)
  js/ui.js                     table, Grow runs, storm / nap / munch effects, pass-and-play
games/klondike/                Solitaire
  js/rules.js                  rules, seeded deal, solver (also loads in Node)
  js/deals.js                  solver-won seeds, Draw 1 and Draw 3
  js/ui.js                     layout, tap / drag, hints, auto-finish, win cascade
  tools/gen-deals.js           regenerate deals.js: node games/klondike/tools/gen-deals.js [count] [maxNodes]
  tools/verify.js              re-solve every seed in deals.js
diag.html                      device check page (see Troubleshooting)
tools/shot.mjs                 headless WebKit screenshots (see "Testing")
tools/update-sw.py             regenerate the service worker precache list
tools/make-icon.py             draw a home-screen icon (gradient + motif)
tools/nono-check.py            verify nonograms need no guessing
```

Every game folder also has `index.html`, `manifest.webmanifest`, an icon,
and (except the cabinet games, which style through `cabinet.css`) a
`style.css` for its board.

Each game lives in its own folder with its own rules and drawing; the look,
overlays, sounds and storage come from `kit/` (puzzles, cards) or `cabinet/`
(action games). There is no build step. Adding a game means dropping in a
folder, adding an entry to `GAMES` / `ACTION` / `CARDS` in the root
`index.html` (plus a picture in `menu-art.js`), and running
`python3 tools/update-sw.py`.

The only contract between a game and the menu is one localStorage key:
`arcade.stat.<id>` holds a short progress line ("Level 12", "Best 3180") that
the tile shows.

## Shared kit

`kit/kit.css` + `kit/kit.js` are the design language every game uses: a chunky, bright "candy" look on a deep indigo night sky (low glare
in a car at night). Plain CSS and one global `Kit`, no build, no network.
`games/2048` is the reference implementation: copy its `index.html` shell and
read its `js/ui.js`. Everything is prefixed (`--k-*`, `.k-*`) so a game can
adopt it without its old CSS colliding. The cabinet and card kits sit on top
of it: cabinet games keep a CRT playfield but use the kit bar, score chips,
icons, cards, `Kit.sfx` and the mute switch.

### Tokens (`:root` in kit.css)

| Group | Names |
|---|---|
| Surfaces | `--k-bg`, `--k-bg-deep`, `--k-surface-1` (panels, boards), `--k-surface-2` (raised), `--k-surface-3`, `--k-edge` (dark under-edge), `--k-line` |
| Text | `--k-text`, `--k-muted`, `--k-faint` |
| Signals | `--k-accent` (sunny yellow) / `--k-accent-edge` / `--k-accent-ink`, `--k-good*`, `--k-bad*`, `--k-info` |
| Kid palette | `--k-red`, `--k-orange`, `--k-yellow`, `--k-green`, `--k-teal`, `--k-blue`, `--k-purple`, `--k-pink`, each with `-edge`; also `Kit.PALETTE` in JS |
| Shape | `--k-r-sm` 10, `--k-r` 16, `--k-r-lg` 24, `--k-r-xl` 32, `--k-r-round` |
| Space | `--k-s1`…`--k-s7` (4 8 12 16 24 32 48), `--k-gutter` (14, 24 on tablets) |
| Depth | `--k-depth` (button under-edge), `--k-shadow-1/2/3`, `--k-glow` |
| Motion | `--k-fast` 120ms, `--k-med` 220ms, `--k-slow` 420ms, `--k-ease`, `--k-ease-pop` |
| Type, touch | `--k-font` (rounded system stack), `--k-fs-sm/fs/fs-lg/fs-xl/fs-xxl`, `--k-tap` (48px, 58px on tablets), `--k-icon` |
| Safe area | `--k-safe-t/r/b/l` |

"Tablet" everywhere means `(min-width: 700px) and (min-height: 600px)`.

### Page shell (HTML)

```html
<html lang="en" class="k-app">            <!-- one screen, no scroll, no rubber band, no pinch -->
<link rel="stylesheet" href="../../kit/kit.css">
<body class="k-noswipe">                  <!-- only for swipe games: touch-action none everywhere -->
<div class="k-shell k-shell--side">        <!-- --side: in landscape the .k-side panel sits beside the stage -->
  <header class="k-bar">
    <div class="k-bar__start"><a class="k-btn k-btn--icon" href="../../index.html" data-k-icon="back" aria-label="Back to the arcade"></a></div>
    <div class="k-bar__mid"><!-- .k-title and/or .k-stats --></div>
    <div class="k-bar__end"><!-- up to 2 icon buttons (phones fit 3 icons + 2 chips in total) --></div>
  </header>
  <main class="k-stage"><div class="k-fit" style="--k-aspect: 1">board</div></main>
  <aside class="k-side">controls / goal / secondary buttons</aside>   <!-- optional -->
  <footer class="k-foot">hint line</footer>                          <!-- optional -->
</div>
<script src="../../kit/kit.js"></script> … <script>Kit.registerSW('../../sw.js');</script>
```

- Portrait: bar, stage, side, foot stack in DOM order; the stage takes all
  remaining height. `.k-shell--side` in landscape (`orientation: landscape`,
  width ≥ 640) becomes a grid: stage left, `.k-side` right column (~32%).
  `.k-shell--side-left` puts the panel on the left. `.k-only-portrait` /
  `.k-only-landscape` hide things in the other orientation.
- `.k-stage` is a size container. `.k-fit` is the largest box with aspect
  `--k-aspect` (width / height) that fits it: no px caps (`--k-fit-max` caps
  it if ever needed). Without container units `Kit.fit` takes over automatically.
- Inside the board, size things in `cqw` of the board by giving the board
  `container-type: size`. Gotcha: container units on an element refer to
  its *ancestor* container, so the board itself should have no padding;
  absolutely place inner layers at `inset: var(--gap)` (see 2048's style.css).
- Score chips: `<div class="k-stats"><div class="k-stat k-stat--accent"><span class="k-stat__label">Score</span><b class="k-stat__val">0</b></div>…</div>`.
  `Kit.anim(chip, 'k-bump')` bumps one.

### Components (CSS classes)

- Buttons: `.k-btn` (3D candy, presses into its under-edge) + `--primary`,
  `--good`, `--bad`, `--blue`, `--purple`, `--pink`, `--ghost`, `--lg`, `--sm`,
  `--block`, `--icon` (square, for one `data-k-icon`), `--round`. Custom colour:
  set `--k-btn-bg`, `--k-btn-edge`, `--k-btn-ink`. `.k-row` lays buttons out
  evenly. `.k-seg` > `button.k-on` is a segmented toggle (Easy/Medium/Hard).
- `.k-panel` (raised surface), `.k-label` (small caps label), `.k-badge`.
- Helpers: `.k-hidden`, `.k-sr` (screen-reader only), `.k-shake`, `.k-pulse`, `.k-pop-in`.
- `prefers-reduced-motion` turns the kit's animations off; check `Kit.reduced` in JS.
- Overlay cards adapt to small screens on their own: on short landscape
  screens (≤ 520px tall, a phone on its side) the card goes compact (smaller
  art, title, stats and buttons) and how-to steps go two-column; on narrow
  portrait phones (< 400px wide) card buttons size to their labels and wrap
  onto their own rows, so two icon buttons never crowd.

### Kit.* (JavaScript)

| Call | What it does |
|---|---|
| `Kit.icon(name, cls?)` → svg string | Icons: `back close undo redo restart new sound mute pause play help star settings hint home check next trophy shuffle heart menu` (`Kit.ICONS`). |
| `data-k-icon="name"` | Any element gets its icon on load. `Kit.icons(root?)` re-scans; `Kit.setIcon(el, name)` swaps one. |
| `Kit.result({ emoji \| icon, title, text, stats:[{label, value, hi}], stars (0-3), badge, buttons:[{label, value, primary, icon, cls}], confetti, sound, wiggle })` → Promise(value) | Win / lose card. `text` may hold `<b>`. `sound` defaults to `'win'` with confetti, else `'good'`; pass `'lose'` or `false`. |
| `Kit.confirm({ title, text, yes, no, danger, emoji \| icon })` → Promise(bool) | Tap outside / Escape = no. |
| `Kit.sheet({ title, html, buttons, onOpen(card, close), dismissValue })` → Promise | Bottom sheet for settings, level pickers. |
| `Kit.howTo(key, steps, { title, button, force })` → Promise | First-run "how to play"; remembered in `arcade.howto.<key>`. steps: strings or `{ emoji \| icon, text }`. |
| `Kit.bindHelp(btn, key, steps, opts)` | Help button that reopens the how-to card. |
| `Kit.toast(text, { icon, ms, top })` | Short message pill; `top: true` puts it over the top bar instead of the bottom. |
| `Kit.floatText(text, x, y \| element, color?)` | A "+8" that rises and fades from a point or an element. |
| `Kit.confetti({ x, y, count, colors })` | Burst (no-op with reduced motion). |
| `Kit.overlayOpen()`, `Kit.closeAll()` | Gate input while an overlay shows; close everything (on new game). |
| `Kit.sfx.tap/click/pop(pitch)/slide/place/good/bad/star(n)/win/lose/open/close()` | Tiny WebAudio synth; unlocked on first touch; silent when muted. |
| `Kit.sfx.tone(freq, dur, type, { vol, when, to, attack })` | One custom note (`to` glides). |
| `Kit.muted()`, `Kit.setMuted(b)`, `Kit.onMute(fn)`, `Kit.bindMute(btn)` | The one arcade-wide mute; `bindMute` makes a sound on/off icon button. |
| `Kit.buzz(ms \| pattern)` | Haptics where available (not when muted). |
| `Kit.load(key, fallback)`, `Kit.save(key, value)`, `Kit.drop(key)` | JSON localStorage that never throws. Old plain-number saves load as numbers. |
| `Kit.raw(key)`, `Kit.setRaw(key, string)` | Unparsed strings. |
| `Kit.stat(id, text)` | Writes `arcade.stat.<id>`, the line under the menu tile. |
| `Kit.swipe(target, fn(dir), { min, keys })` | dir 0 left, 1 up, 2 right, 3 down; fires mid-gesture; ignores buttons/links and open overlays; arrow keys + WASD too. |
| `Kit.fit(el, aspect, { parent, max, onResize(w, h) })` → `{ update, stop }` | px sizing for a canvas or old browsers. `Kit.cqSupported` says whether container units work (if not, every `.k-fit` gets `Kit.fit` automatically). |
| `Kit.anim(el, cls)`, `Kit.wait(ms)`, `Kit.esc(s)` | Restart a CSS animation; promise delay; HTML-escape. |
| `Kit.registerSW(path)` | Registers `../../sw.js` on load. |

**Storage keys.** Shared: `arcade.mute` (`'1'`/`'0'`; on first read it
honours any older switch — `cards.mute`, `cab.mute`, `bb.mute`, `ws.mute`,
`simon.mute` — and `Kit.setMuted` writes all of them), `arcade.howto.<key>`
(how-to seen), and for the menu `arcade.stat.<id>`, `arcade.seen.<id>`,
`arcade.last`. Cabinet: `cab.hi.<id>` (high-score table), `cab.initials`,
`cab.save.<id>` (round in progress).
Never rename a key kids already have scores in. Per game:

| Game | Keys |
|---|---|
| Color by Number | `cbn.progress.<id>` (plain base64 bits, or `r<rev>:<bits>` for a redrawn picture), `cbn.custom` (photo puzzles), `cbn.known` (pictures already seen, for NEW tags) |
| Water Sort | `ws.level`, `ws.game` |
| Block Blast | `bb.game`, `bb.best` |
| 2048 | `g2048.game`, `g2048.best` |
| Memory Match | `mm.game`, `mm.size`, `mm.theme`, `mm.wins`, `mm.best.<size>` |
| Picture Puzzles | `nono.p.<id>`, `nono.solved`, `nono.last`, `nono.tut` |
| Flow | `flow.level`, `flow.game`, `flow.stars` |
| Simon | `simon.best`, `simon.hint` |
| Shape Fit | `shapes.level`, `shapes.game`, `shapes.stars`, `shapes.hints` |
| Dot to Dot | `dots.p.<id>`, `dots.done`, `dots.last` |
| Maze | `maze.level`, `maze.max`, `maze.game` |
| Four in a Row | `connect4.game`, `connect4.wins`, `connect4.tally` |
| Mini Golf | `golf.game` (round in progress), `golf.best` (best strokes per hole), `golf.players` |
| Jigsaw | `jig.p.<picture id>` (puzzle in progress), `jig.done` (picture id -> bit mask of sizes finished, bit k for k×k), `jig.level` (last size); photos live in IndexedDB `jigsaw`/`photos`, so Backup & restore does not carry them |
| Snake / Pong | `snake.wrap`; `pong.diff`, `pong.wins` (high scores in `cab.hi.*`) |
| Crazy Eights | `crazy8.game`, `crazy8.opts`, `crazy8.wins` |
| Go Fish | `gofish.game`, `gofish.wins` |
| Hatch Match | `hatch.save`, `hatch.opts`, `hatch.wins` |
| Solitaire | `klondike.game`, `klondike.draw`, `klondike.next`, `klondike.stats` |

### How to put a game on the kit

1. `index.html`: `<html class="k-app">`, link `../../kit/kit.css` before the
   game's `style.css`, `theme-color` `#161843`; wrap the page in the shell
   above. Back button first; at most two icon buttons at the end of the bar
   (move help / sound / settings into `.k-side` when space is tight; 375px
   phones fit 3 bar buttons + 2 stat chips). Use `.k-shell--side` when the
   game has controls (palette, tray, pieces) that should sit beside the board
   in landscape.
2. Delete the game's copy-pasted header, `.icon-btn`, `.pill`, `.over*`,
   confetti and colour variables from its `style.css`; keep only the board.
   Replace every unicode glyph (‹ ↶ ⟳ 🔊 …) with `data-k-icon`.
3. Board: give it `.k-fit` and `--k-aspect` (columns / rows for a grid), drop
   every `max-width: …px`, and size the insides with `cqw` (board has
   `container-type: size`) or percentages. Check iPad portrait, iPad
   landscape and phone.
4. Replace hand-built overlays with `Kit.result` / `Kit.confirm` /
   `Kit.sheet`, first-run help with `Kit.howTo` + `Kit.bindHelp`, sounds with
   `Kit.sfx` + `Kit.bindMute` (remove the game's own AudioContext and mute
   key), storage with `Kit.load/save/stat` (same keys as before), swipes with
   `Kit.swipe`, and guard input with `Kit.overlayOpen()`.
5. Colours: draw pieces from the kid palette tokens; text on a colour uses
   that colour's ink/edge pair. Give pressed things the 3D under-edge.
6. Manifest: `"orientation": "any"`, colours `#161843`.
7. Screenshot it at every size (see "Testing"), then `python3 tools/update-sw.py`.

### The menu

`index.html` uses the kit too. Puzzle tiles are drawn from `GAMES` (`c1`/`c2`
are the tile gradient), cabinets from `ACTION`, card tiles from `CARDS`
(a marked slot for new card games; `corner` / `cornerColor` set the rank in
the card's corner). Each tile's picture is `MENU_ART[id]()` in
`menu-art.js` (puzzles 120 x 90 on the gradient, cabinets 100 x 75 on a black
CRT, cards 60 x 84 on a white face); a game without one shows its emoji.
Tiles animate in with a transform only, never opacity, so a stalled
animation can't leave a hole in the grid (that was the old bug where an iPad
showed one puzzle tile and a big gap).

## Adding a picture

Color by Number has 81 built-in pictures in four sections, chosen by grid size:
Quick (16x16, `js/puzzles-data.js`), Medium (24x24, `js/pictures-medium.js`),
Detailed (32x32, `js/pictures-hard.js`) and Intricate (40-48 across,
`js/pictures-expert.js`). Append to whichever file fits: an `id`, a `name`, a
`theme` (one of `pets wild sea dinos magic go food space outdoors shapes`,
which picks its sticker-book collection), a `legend` mapping single
characters to hex colours (16 at most; keep colours clearly different and
avoid pure white for things that must show on the white paper), and an `art`
array of equal-length strings. `.` means blank (stays white, never needs
painting). Legend order sets the swatch numbers. Give a new pack a `batch`
number one higher than the last (currently 2) so returning players see it
marked NEW. Never reuse or rename an id. If you redraw a picture so its cells
change, add or bump `rev` (e.g. `rev: 2`): old in-progress saves for it are
then let go safely, and finished ones stay finished. Changing only colours
needs no `rev`.

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
- Targets Safari 16 (the iPhone 8 Plus and X top out at iOS 16.7). Layouts should work on iPads in portrait and landscape as well as on phones.
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

## Testing

There are no unit tests; games are checked by looking at them.
`tools/shot.mjs` opens a page in headless WebKit (Safari's engine) at the
sizes the kids use and writes a PNG per size, printing any console errors
or page errors (and exiting 2 if there were any):

```bash
python3 -m http.server 8160 &        # any port
node tools/shot.mjs http://localhost:8160/games/2048/ /tmp/shots --sizes=ipad,ipadl,phone,phonel
node tools/shot.mjs http://localhost:8160/games/2048/ /tmp/shots --sizes=phone \
  --js="void Kit.result({ title: 'Test', buttons: [{ label: 'Play again', primary: true }] })"
```

Sizes: `ipad` 820x1180, `ipadl` 1180x820, `phone` 375x812, `phonel` 812x375
(phones at 2x). Default is `ipad,ipadl,phone`. `--wait=ms` (default 800)
is the pause after load and after `--js`. `--js` runs in the page before the
shot, e.g. to open an overlay; prefix promise-returning calls with `void`,
or the tool waits for a button press that never comes. Files are named
`<path>-<size>.png`.

Playwright lives outside the repo so the arcade stays dependency-free:
`npm install playwright` in `~/.cache/arcade-tools` (shot.mjs resolves it
from there). The Playwright installer's unzip hung on this Mac, so WebKit
was extracted by hand to `~/.cache/arcade-tools/webkit/`; shot.mjs uses
`webkit/pw_run.sh` when it exists and Playwright's stock WebKit otherwise.
Service workers are blocked in these runs, so edits always show.

Other checks: `python3 tools/nono-check.py` (nonograms solvable without
guessing) and `node games/klondike/tools/verify.js` (every Solitaire seed
still solves and replays legally), and `node games/minigolf/tools/check.js`
(every Mini Golf hole can be finished; random putts never leave the green
or get stuck).

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
