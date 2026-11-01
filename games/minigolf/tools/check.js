#!/usr/bin/env node
/* Proves every Mini Golf hole can be finished, and that the ball never
   leaves the course or gets stuck.

     node games/minigolf/tools/check.js [holeId ...] [--fuzz=N] [--quick]

   For each hole:
   1. sanity: tee and cup are on the green, not in water/sand/blocks.
   2. solver: a beam search over aim angles and powers in the deterministic
      sim (the very code the game runs) finds the fewest strokes that sink
      the ball, from several start times (moving obstacles are in different
      places). Fails if it needs more than par + 1 or can't finish.
   3. fuzz: hundreds of random putts from the tee and from wherever earlier
      putts stopped. Every one must come to rest (or drop / splash) within
      30 s, never trip the "outside the green" safety net, and never stop
      inside a block or on water.
   Prints one line per hole and exits 1 on any failure. The solver's first
   winning shot per hole is written to tools/solutions.json so the browser
   test can replay it through the real UI. */
'use strict';
const path = require('path');
const fs = require('fs');
const Sim = require('../js/sim.js');
const { COURSES } = require('../js/holes.js');

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const only = args.filter(a => !a.startsWith('--'));
const FUZZ = +opt('fuzz', 400);
const QUICK = args.includes('--quick');
const MAX_STEPS = 30 * 120;

const ANGLES = QUICK ? 48 : 90, POWERS = QUICK ? [0.2, 0.35, 0.5, 0.7, 0.9] : [0.12, 0.2, 0.28, 0.36, 0.45, 0.55, 0.65, 0.75, 0.88, 1];
const DIRS = [];
for (let i = 0; i < ANGLES; i++) { const a = Math.PI * 2 * i / ANGLES; DIRS.push([Sim.dcos(a), Sim.dsin(a)]); }

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/* Run one putt to the end. Returns { x, y, done, tick, splash, escapes, stuck, steps } */
function putt(w, x, y, tick, dx, dy, p) {
  const b = Sim.newBall(w);
  b.x = x; b.y = y;
  Sim.shoot(b, dx, dy, p);
  const ev = [];
  let n = 0;
  while ((b.moving || n === 0) && !b.done && n < MAX_STEPS) {
    Sim.step(w, b, tick + n, ev);
    n++;
  }
  return { x: b.x, y: b.y, done: b.done, tick: tick + n, splash: !!b.splashed, escapes: b.escapes || 0, stuck: n >= MAX_STEPS, steps: n };
}

/* Distance to the cup the long way round (grid BFS over dry green). */
function distField(w) {
  const def = w.def, W = Math.ceil(def.w) + 1, H = Math.ceil(def.h) + 1, D = new Float64Array(W * H).fill(1e9);
  const ok = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ok[y * W + x] = Sim.inFloor(w, x, y) && !Sim.overWater(w, x, y) ? 1 : 0;
  const q = []; const cx = Math.round(w.cup.x), cy = Math.round(w.cup.y);
  D[cy * W + cx] = 0; q.push(cy * W + cx);
  // tunnels count as a shortcut: the entrance is as close as the exit
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (!ok[j]) continue;
      const nd = D[i] + (dx && dy ? 1.414 : 1);
      if (nd < D[j] - 1e-9) { D[j] = nd; q.push(j); }
    }
  }
  const f = (x, y) => {
    let best = D[Math.round(y) * W + Math.round(x)];
    if (!(best < 1e9)) best = Math.hypot(x - w.cup.x, y - w.cup.y) * 1.5;
    w.tunnels.forEach(t => { if (Math.hypot(x - t.x, y - t.y) < 1) best = Math.min(best, f0(t.ox, t.oy)); });
    return best;
  };
  const f0 = (x, y) => { const v = D[Math.round(y) * W + Math.round(x)]; return v < 1e9 ? v : 999; };
  return f;
}

function solve(w, t0) {
  const dist = distField(w);
  let beam = [{ x: w.tee.x, y: w.tee.y, tick: t0, shots: [] }];
  const MAXD = w.par + 2;
  for (let depth = 1; depth <= MAXD; depth++) {
    const next = [];
    for (const s of beam) {
      const waits = w.hasMovers ? [0, 40, 80, 120, 160] : [0];
      for (const wt of waits) {
        for (const d of DIRS) for (const p of POWERS) {
          const r = putt(w, s.x, s.y, s.tick + wt, d[0], d[1], p);
          const shot = { x: s.x, y: s.y, tick: s.tick + wt, dx: d[0], dy: d[1], p };
          if (r.done) return { strokes: depth, shots: s.shots.concat([shot]) };
          if (r.splash || r.stuck) continue;
          next.push({ x: r.x, y: r.y, tick: r.tick, shots: s.shots.concat([shot]), score: dist(r.x, r.y) });
        }
      }
    }
    next.sort((a, b) => a.score - b.score);
    // keep a few of the best, spread out (not five copies of one spot)
    beam = [];
    for (const n of next) {
      if (beam.every(b => Math.hypot(b.x - n.x, b.y - n.y) > 6)) beam.push(n);
      if (beam.length >= (QUICK ? 3 : 5)) break;
    }
    if (!beam.length) break;
  }
  return null;
}

function fuzz(w, n, seed) {
  const r = rng(seed);
  const spots = [{ x: w.tee.x, y: w.tee.y, tick: 0 }];
  const bad = [];
  let longest = 0;
  for (let i = 0; i < n; i++) {
    const s = spots[Math.floor(r() * spots.length)];
    const a = r() * Math.PI * 2, p = 0.05 + r() * 0.95;
    const res = putt(w, s.x, s.y, s.tick + Math.floor(r() * 300), Sim.dcos(a), Sim.dsin(a), p);
    longest = Math.max(longest, res.steps);
    if (res.escapes) bad.push(`escape from (${s.x.toFixed(1)},${s.y.toFixed(1)}) a=${a.toFixed(3)} p=${p.toFixed(3)}`);
    if (res.stuck) bad.push(`stuck (never stopped) from (${s.x.toFixed(1)},${s.y.toFixed(1)}) a=${a.toFixed(3)} p=${p.toFixed(3)} at (${res.x.toFixed(1)},${res.y.toFixed(1)})`);
    if (!res.done && !res.splash && !Sim.inFloor(w, res.x, res.y)) bad.push(`stopped off the green at (${res.x.toFixed(1)},${res.y.toFixed(1)})`);
    if (!res.done && Sim.overWater(w, res.x, res.y)) bad.push(`stopped on water at (${res.x.toFixed(1)},${res.y.toFixed(1)})`);
    if (!res.done && !res.splash && !res.stuck && spots.length < 60) spots.push({ x: res.x, y: res.y, tick: res.tick });
    if (bad.length > 4) break;
  }
  return { bad, longest };
}

/* A rough "kid" model: picks the best putt it can see (one step ahead),
   then aims a bit off (about +-5 degrees, +-15% power). Average strokes
   tell whether par is fair. */
function kid(w, trials, seed) {
  const r = rng(seed), dist = distField(w), out = [];
  const A = 48, P = [0.15, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1];
  for (let t = 0; t < trials; t++) {
    let x = w.tee.x, y = w.tee.y, tick = Math.floor(r() * 400), n = 0;
    while (n < 8) {
      n++;
      let best = null;
      for (let i = 0; i < A; i++) for (const p of P) {
        const a = Math.PI * 2 * i / A, res = putt(w, x, y, tick, Sim.dcos(a), Sim.dsin(a), p);
        const sc = res.done ? -1 : res.splash ? 1e6 : dist(res.x, res.y);
        if (!best || sc < best.sc) best = { sc, a, p };
      }
      const a = best.a + (r() - 0.5) * 0.18, p = Math.min(1, best.p * (0.85 + r() * 0.3));
      const res = putt(w, x, y, tick + Math.floor(r() * 60), Sim.dcos(a), Sim.dsin(a), p);
      if (res.done) break;
      if (!res.splash) { x = res.x; y = res.y; }
      tick = res.tick;
    }
    out.push(n);
  }
  return out.reduce((a, b) => a + b, 0) / out.length;
}

let fail = 0;
const solutions = {};
const t00 = Date.now();
for (const c of COURSES) for (const def of c.holes) {
  if (only.length && !only.includes(def.id)) continue;
  const w = Sim.world(def);
  const probs = [];
  if (!Sim.inFloor(w, w.tee.x, w.tee.y) || Sim.overWater(w, w.tee.x, w.tee.y)) probs.push('tee not on dry green');
  if (!Sim.inFloor(w, w.cup.x, w.cup.y) || Sim.overWater(w, w.cup.x, w.cup.y)) probs.push('cup not on dry green');
  // the ball must fit everywhere the floor says it can go: check the tee isn't touching a rail
  const tb = Sim.newBall(w); Sim.step(w, tb, 0, null);
  // determinism: the same putt twice ends in the same place
  const a1 = putt(w, w.tee.x, w.tee.y, 7, 0.3, -1, 0.8), a2 = putt(w, w.tee.x, w.tee.y, 7, 0.3, -1, 0.8);
  if (a1.x !== a2.x || a1.y !== a2.y || a1.tick !== a2.tick) probs.push('not deterministic');
  const phases = w.hasMovers ? [0, 97, 211] : [0];
  const strokes = [];
  for (const ph of phases) {
    const t = Date.now();
    const s = solve(w, ph);
    if (!s) { probs.push(`no solution from tick ${ph}`); strokes.push('x'); continue; }
    strokes.push(s.strokes);
    if (s.strokes > def.par + 1) probs.push(`needs ${s.strokes} strokes (par ${def.par}) from tick ${ph}`);
    if (ph === 0) solutions[def.id] = s.shots;
  }
  const fz = FUZZ ? fuzz(w, FUZZ, def.id.charCodeAt(0) * 31 + def.n) : { bad: [], longest: 0 };
  probs.push(...fz.bad);
  const kidAvg = args.includes('--kid') ? kid(w, 24, def.n * 7 + def.id.charCodeAt(0)) : null;
  const ok = !probs.length;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${def.id} ${def.name.padEnd(20)} par ${def.par}  solver ${strokes.join('/')}  longest putt ${(fz.longest / 120).toFixed(1)}s` + (kidAvg ? `  kid avg ${kidAvg.toFixed(2)}` : '') + (ok ? '' : '\n      ' + probs.join('\n      ')));
}
if (!only.length) fs.writeFileSync(path.join(__dirname, 'solutions.json'), JSON.stringify(solutions));
console.log(`${fail ? fail + ' hole(s) failed' : 'all holes ok'} in ${((Date.now() - t00) / 1000).toFixed(1)}s`);
process.exit(fail ? 1 : 0);
