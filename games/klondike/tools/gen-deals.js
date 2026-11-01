#!/usr/bin/env node
/* Find deals the solver can win and write js/deals.js. Run from the repo root:
     node games/klondike/tools/gen-deals.js [count=400] [maxNodes=150000]
   Draw 1 and Draw 3 get separate lists (a deal winnable drawing one card at
   a time may not be when drawing three). */
const path = require('path'), fs = require('fs');
const K = require('../js/rules.js');
const count = +process.argv[2] || 1000, maxNodes = +process.argv[3] || 150000;
const out = { 1: [], 3: [] }, stats = { 1: [0, 0, 0], 3: [0, 0, 0] };
let seed = 1;
const t0 = Date.now();
for (const draw of [1, 3]) {
  seed = draw === 1 ? 1 : 500000;
  while (out[draw].length < count) {
    const st = K.deal(seed);
    const r = K.solve(st, { draw, maxNodes });
    stats[draw][r.ok ? 0 : r.complete ? 1 : 2]++;
    // Only keep deals that need some thought but not a marathon.
    if (r.ok) { K.expand(st, r.moves, draw); out[draw].push(seed); }   // throws if the solution doesn't replay
    seed++;
  }
}
console.error('draw1 won/dead/budget', stats[1], 'draw3', stats[3], ((Date.now() - t0) / 1000).toFixed(1) + 's');
const file = path.join(__dirname, '..', 'js', 'deals.js');
fs.writeFileSync(file, '/* Deal seeds the solver has won (node games/klondike/tools/gen-deals.js). */\n' +
  'var KLONDIKE_DEALS = {\n  1: [' + out[1].join(',') + '],\n  3: [' + out[3].join(',') + ']\n};\n');
console.error('wrote', file);
