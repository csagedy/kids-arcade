const K = require('../js/rules.js');
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/deals.js'), 'utf8').replace('var KLONDIKE_DEALS', 'this.D'), ctx);
let bad = 0, n = 0, t0 = Date.now();
for (const draw of [1, 3]) for (const seed of ctx.D[draw]) {
  const st = K.deal(seed);
  const r = K.solve(st, { draw, maxNodes: 300000 });
  try { if (!r.ok) throw new Error('not solved'); K.expand(st, r.moves, draw); n++; }
  catch (e) { bad++; console.log(draw, seed, e.message); }
}
console.log('verified', n, 'bad', bad, (Date.now() - t0) + 'ms');
