/* Mini Golf physics. Plain math, no DOM, so the same file runs in the
   browser and in Node (tools/check.js proves every hole can be finished).

   Deterministic: a fixed step (1/120 s), only + - * / and sqrt (which IEEE
   rounds exactly), and our own sine (dsin) instead of Math.sin, whose last
   bit differs between JavaScript engines. The same shot from the same spot
   at the same tick ends in the same place in Safari and in Node.

   Units are "course units": a hole is about 100 wide and 160 long; the ball
   has a radius of 2.4. Walls are capsules (a segment with a thickness), so
   straight, angled and curved walls (curves are short segments) all bounce
   the same way. The ball moves at most 0.45 radius per sub-step, so even a
   full-power putt can't pass through a wall. */
(function (root) {
  'use strict';

  var PI = Math.PI, TAU = PI * 2, HALF = PI / 2;
  var DT = 1 / 120;
  var R = 2.4;              // ball radius
  var RAIL = 1.6;           // half thickness of rails and block edges
  var ARM_R = 1.5;          // spinner arms
  var GATE_R = 2.2;         // sliding gates
  var VMAX = 240;           // full-power putt speed (units / s)
  var FRIC = 52, DRAG = 0.4;              // grass: constant + speed-proportional
  var SAND_FRIC = 230, SAND_DRAG = 2.4;   // sand
  var E_WALL = 0.74, E_MOVER = 0.6, E_BUMP = 0.95, BUMP_KICK = 48;
  var CUP_R = 3.8;          // drawn cup
  var CAPTURE = 4.7;        // ball centre this close and slow enough = in
  var CAPTURE_V = 130;
  var MAGNET_R = 11, MAGNET_A = 46, MAGNET_V = 70;
  var REST_V = 1.3, REST_STEPS = 6;
  var MAX_SUB = R * 0.45;

  /* Deterministic sine: range-reduce to [-pi/2, pi/2], then a Taylor
     series that's accurate to ~1e-12 there. */
  function dsin(x) {
    x = x % TAU;
    if (x < 0) x += TAU;
    if (x > PI) x -= TAU;
    if (x > HALF) x = PI - x;
    else if (x < -HALF) x = -PI - x;
    var x2 = x * x;
    return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110 * (1 - x2 / 156 * (1 - x2 / 210)))))));
  }
  function dcos(x) { return dsin(x + HALF); }

  /* ---------- shape helpers (used by holes.js) ---------- */
  function rad(deg) { return deg * PI / 180; }
  // points along an arc, degrees, y down (0 = right, 90 = down)
  function arc(cx, cy, r, a0, a1, n) {
    n = n || Math.max(4, Math.ceil(Math.abs(a1 - a0) / 12));
    var out = [];
    for (var i = 0; i <= n; i++) {
      var a = rad(a0 + (a1 - a0) * i / n);
      out.push([cx + r * dcos(a), cy + r * dsin(a)]);
    }
    return out;
  }
  function rect(x0, y0, x1, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  // rounded rectangle, clockwise from the top-left corner
  function rrect(x0, y0, x1, y1, r) {
    return [].concat(
      arc(x0 + r, y0 + r, r, 180, 270, 4), arc(x1 - r, y0 + r, r, 270, 360, 4),
      arc(x1 - r, y1 - r, r, 0, 90, 4), arc(x0 + r, y1 - r, r, 90, 180, 4));
  }
  // a wobbly closed blob (ponds, sand traps), seeded so it is always the same
  function blob(cx, cy, rx, ry, wob, n, seed) {
    n = n || 18; seed = seed || 1;
    var out = [], s = seed;
    var k1 = 2 + (seed % 3), k2 = 3 + (seed % 2), p1 = seed * 1.7, p2 = seed * 0.9;
    for (var i = 0; i < n; i++) {
      var a = TAU * i / n;
      var f = 1 + wob * (0.6 * dsin(k1 * a + p1) + 0.4 * dsin(k2 * a + p2));
      out.push([cx + rx * f * dcos(a), cy + ry * f * dsin(a)]);
      s++;
    }
    return out;
  }
  function circlePoly(cx, cy, r, n) { return arc(cx, cy, r, 0, 360 - 360 / (n || 20), (n || 20) - 1); }

  function inPoly(poly, x, y) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inAny(list, x, y) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) continue;
      if (inPoly(p.pts, x, y)) return p;
    }
    return null;
  }
  function boxed(pts) {
    var o = { pts: pts, x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    pts.forEach(function (p) {
      if (p[0] < o.x0) o.x0 = p[0]; if (p[0] > o.x1) o.x1 = p[0];
      if (p[1] < o.y0) o.y0 = p[1]; if (p[1] > o.y1) o.y1 = p[1];
    });
    return o;
  }
  function isPolyList(a) { return a && a.length && Array.isArray(a[0]) && Array.isArray(a[0][0]); }

  /* ---------- building a hole ---------- */
  function world(def) {
    var w = {
      def: def, segs: [], circles: [], floor: [], blocks: [], water: [], sand: [], bridges: [],
      hills: [], slopes: [], belts: [], tunnels: [], spinners: [], gates: [],
      tee: { x: def.tee[0], y: def.tee[1] }, cup: { x: def.cup[0], y: def.cup[1] }, par: def.par
    };
    function addSeg(a, b, r, kind) {
      w.segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], r: r, k: kind,
        x0: Math.min(a[0], b[0]) - r - R, x1: Math.max(a[0], b[0]) + r + R,
        y0: Math.min(a[1], b[1]) - r - R, y1: Math.max(a[1], b[1]) + r + R });
    }
    function ring(pts, kind) { for (var i = 0; i < pts.length; i++) addSeg(pts[i], pts[(i + 1) % pts.length], RAIL, kind); }
    var floors = isPolyList(def.floor) ? def.floor : [def.floor];
    floors.forEach(function (p) { w.floor.push(boxed(p)); ring(p, 'rail'); });
    (def.blocks || []).forEach(function (p) { w.blocks.push(boxed(p)); ring(p, 'block'); });
    (def.walls || []).forEach(function (line) {
      for (var i = 0; i + 1 < line.length; i++) addSeg(line[i], line[i + 1], RAIL, 'wall');
    });
    (def.posts || []).forEach(function (c) { w.circles.push({ x: c[0], y: c[1], r: c[2], e: E_WALL, kick: 0, k: 'post' }); });
    (def.bumpers || []).forEach(function (c) { w.circles.push({ x: c[0], y: c[1], r: c[2], e: E_BUMP, kick: BUMP_KICK, k: 'bumper', hit: -1e9 }); });
    (def.water || []).forEach(function (p) { w.water.push(boxed(p)); });
    (def.sand || []).forEach(function (p) { w.sand.push(boxed(p)); });
    (def.bridges || []).forEach(function (p) { w.bridges.push(boxed(p)); });
    (def.hills || []).forEach(function (h) { w.hills.push({ x: h[0], y: h[1], r: h[2], a: h[3] }); });
    (def.slopes || []).forEach(function (s) { var b = boxed(s.poly); b.ax = s.a[0]; b.ay = s.a[1]; w.slopes.push(b); });
    (def.belts || []).forEach(function (s) { var b = boxed(s.poly); b.vx = s.v[0]; b.vy = s.v[1]; w.belts.push(b); });
    (def.tunnels || []).forEach(function (t) {
      var l = Math.sqrt(t.dir[0] * t.dir[0] + t.dir[1] * t.dir[1]);
      w.tunnels.push({ x: t.from[0], y: t.from[1], r: t.r || 5, ox: t.to[0], oy: t.to[1], dx: t.dir[0] / l, dy: t.dir[1] / l });
    });
    (def.spinners || []).forEach(function (s) {
      w.spinners.push({ x: s.x, y: s.y, len: s.len, arms: s.arms || 4, speed: s.speed, phase: s.phase || 0 });
      w.circles.push({ x: s.x, y: s.y, r: 3.4, e: E_WALL, kick: 0, k: 'hub' });
    });
    (def.gates || []).forEach(function (g) {
      w.gates.push({ ax: g.a[0], ay: g.a[1], bx: g.b[0], by: g.b[1], mx: g.move[0], my: g.move[1], period: g.period, phase: g.phase || 0 });
    });
    w.hasMovers = w.spinners.length + w.gates.length > 0;
    w.moving = [];   // the movers' capsules for the current tick
    return w;
  }

  /* Where the moving things are at a tick: fills w.moving with capsules
     { ax, ay, bx, by, r, vx/vy or spinner (cx, cy, om) } */
  function placeMovers(w, tick) {
    var t = tick * DT, out = w.moving;
    out.length = 0;
    for (var i = 0; i < w.spinners.length; i++) {
      var s = w.spinners[i], th = s.phase + s.speed * t;
      for (var k = 0; k < s.arms; k++) {
        var a = th + k * TAU / s.arms;
        out.push({ ax: s.x, ay: s.y, bx: s.x + s.len * dcos(a), by: s.y + s.len * dsin(a), r: ARM_R, cx: s.x, cy: s.y, om: s.speed, vx: 0, vy: 0 });
      }
    }
    for (var j = 0; j < w.gates.length; j++) {
      var g = w.gates[j], ph = TAU * t / g.period + g.phase, f = dsin(ph), fv = dcos(ph) * TAU / g.period;
      out.push({ ax: g.ax + g.mx * f, ay: g.ay + g.my * f, bx: g.bx + g.mx * f, by: g.by + g.my * f, r: GATE_R,
        vx: g.mx * fv, vy: g.my * fv, om: 0 });
    }
    return out;
  }

  function newBall(w) {
    return { x: w.tee.x, y: w.tee.y, vx: 0, vy: 0, moving: false, slow: 0, lastX: w.tee.x, lastY: w.tee.y,
      done: false, rollT: 0, sunkV: 0 };
  }

  function shoot(b, dx, dy, power) {
    var l = Math.sqrt(dx * dx + dy * dy);
    if (!(l > 0)) return;
    if (power > 1) power = 1;
    var v = VMAX * power;
    b.lastX = b.x; b.lastY = b.y;
    b.vx = dx / l * v; b.vy = dy / l * v;
    b.moving = true; b.slow = 0; b.rollT = 0;
  }

  /* ---------- collisions ---------- */
  // Capsule (segment a-b with radius rr) against the ball. Wall velocity
  // (wvx, wvy) lets moving walls push. Returns the impact speed (0 = none).
  function hitSeg(b, ax, ay, bx, by, rr, e, wvx, wvy, om, cx, cy) {
    var ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
    var t = L2 > 0 ? ((b.x - ax) * ex + (b.y - ay) * ey) / L2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var px = ax + ex * t, py = ay + ey * t, dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy, min = R + rr;
    if (d2 >= min * min) return 0;
    var d = Math.sqrt(d2), nx, ny;
    if (d < 1e-9) { var l = Math.sqrt(L2) || 1; nx = -ey / l; ny = ex / l; }
    else { nx = dx / d; ny = dy / d; }
    b.x = px + nx * (min + 1e-6); b.y = py + ny * (min + 1e-6);
    if (om) { wvx = -om * (py - cy); wvy = om * (px - cx); }
    var rvx = b.vx - wvx, rvy = b.vy - wvy, vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      rvx -= (1 + e) * vn * nx; rvy -= (1 + e) * vn * ny;
      b.vx = rvx + wvx; b.vy = rvy + wvy;
      return -vn;
    }
    return 1e-3;
  }
  function hitCircle(b, c) {
    var dx = b.x - c.x, dy = b.y - c.y, d2 = dx * dx + dy * dy, min = R + c.r;
    if (d2 >= min * min) return 0;
    var d = Math.sqrt(d2), nx = 1, ny = 0;
    if (d > 1e-9) { nx = dx / d; ny = dy / d; }
    b.x = c.x + nx * (min + 1e-6); b.y = c.y + ny * (min + 1e-6);
    var vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + c.e) * vn * nx; b.vy -= (1 + c.e) * vn * ny;
      if (c.kick) { b.vx += nx * c.kick; b.vy += ny * c.kick; }
      return -vn + (c.kick || 0);
    }
    return 1e-3;
  }

  function collide(w, b, ev, tick) {
    var best = 0, kind = null, i;
    for (var pass = 0; pass < 2; pass++) {
      for (i = 0; i < w.segs.length; i++) {
        var s = w.segs[i];
        if (b.x < s.x0 || b.x > s.x1 || b.y < s.y0 || b.y > s.y1) continue;
        var v = hitSeg(b, s.ax, s.ay, s.bx, s.by, s.r, E_WALL, 0, 0, 0, 0, 0);
        if (v > best) { best = v; kind = 'wall'; }
      }
      for (i = 0; i < w.circles.length; i++) {
        var c = w.circles[i], vc = hitCircle(b, c);
        if (vc > 0 && c.k === 'bumper') { c.hit = tick; if (vc > 1) { kind = 'bump'; best = Math.max(best, vc, 60); } }
        else if (vc > best) { best = vc; kind = 'wall'; }
      }
      for (i = 0; i < w.moving.length; i++) {
        var m = w.moving[i];
        var vm = hitSeg(b, m.ax, m.ay, m.bx, m.by, m.r, E_MOVER, m.vx, m.vy, m.om, m.cx, m.cy);
        if (vm > best) { best = vm; kind = 'mover'; }
      }
    }
    if (ev && best > 6) ev.push({ t: kind, v: best, x: b.x, y: b.y });
    return best;
  }

  function inFloor(w, x, y) { return !!inAny(w.floor, x, y) && !inAny(w.blocks, x, y); }
  function overWater(w, x, y) { return !!inAny(w.water, x, y) && !inAny(w.bridges, x, y); }

  /* One fixed step for one ball at a tick. ev (optional) collects events:
     wall / bump / mover (with impact speed), splash, warp, sand, cup, lip,
     rest, escape. Returns nothing; the ball is changed in place. */
  function step(w, b, tick, ev) {
    if (b.done) return;
    if (w.hasMovers) placeMovers(w, tick);
    if (!b.moving) {
      // A resting ball can still be nudged by a windmill arm or a gate.
      if (w.moving.length) {
        for (var q = 0; q < w.moving.length; q++) {
          var m = w.moving[q];
          if (hitSeg(b, m.ax, m.ay, m.bx, m.by, m.r, E_MOVER, m.vx, m.vy, m.om, m.cx, m.cy) > 0) {
            b.moving = true; b.slow = 0; b.rollT = 0;
            if (ev) ev.push({ t: 'mover', v: 20, x: b.x, y: b.y });
          }
        }
        if (b.moving) { collide(w, b, null, tick); keepIn(w, b, b.x, b.y, ev); }
      }
      return;
    }
    var px = b.x, py = b.y;
    b.rollT += DT;
    var bridge = inAny(w.bridges, b.x, b.y);
    var sand = !bridge && inAny(w.sand, b.x, b.y);
    var i;
    if (!bridge) {
      for (i = 0; i < w.hills.length; i++) {
        var h = w.hills[i], hx = b.x - h.x, hy = b.y - h.y, d2 = hx * hx + hy * hy;
        if (d2 >= h.r * h.r || d2 < 1e-12) continue;
        var d = Math.sqrt(d2), f = d / h.r, a = h.a * 4 * f * (1 - f);
        b.vx += hx / d * a * DT; b.vy += hy / d * a * DT;
      }
      var sl = inAny(w.slopes, b.x, b.y);
      if (sl) { b.vx += sl.ax * DT; b.vy += sl.ay * DT; }
      var belt = inAny(w.belts, b.x, b.y);
      if (belt) { b.vx += (belt.vx - b.vx) * 3 * DT; b.vy += (belt.vy - b.vy) * 3 * DT; }
    }
    // rolling friction
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp > 0) {
      var ns = sp - (sand ? SAND_FRIC + SAND_DRAG * sp : FRIC + DRAG * sp) * DT;
      if (ns < 0) ns = 0;
      b.vx *= ns / sp; b.vy *= ns / sp; sp = ns;
    }
    if (sand && ev && sp > 30 && !b.inSand) ev.push({ t: 'sand', v: sp, x: b.x, y: b.y });
    b.inSand = !!sand;
    // the cup pulls a slow ball the last little way
    var cx = w.cup.x - b.x, cy = w.cup.y - b.y, cd2 = cx * cx + cy * cy;
    if (cd2 < MAGNET_R * MAGNET_R && sp < MAGNET_V && cd2 > 1e-9) {
      var cd = Math.sqrt(cd2);
      b.vx += cx / cd * MAGNET_A * DT; b.vy += cy / cd * MAGNET_A * DT;
      sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    }
    // move in sub-steps short enough that nothing can be skipped over
    var n = Math.max(1, Math.ceil(sp * DT / MAX_SUB));
    for (var k = 0; k < n; k++) {
      b.x += b.vx * DT / n; b.y += b.vy * DT / n;
      collide(w, b, ev, tick);
      for (i = 0; i < w.tunnels.length; i++) {
        var tn = w.tunnels[i], tx = b.x - tn.x, ty = b.y - tn.y;
        if (tx * tx + ty * ty < tn.r * tn.r) {
          var s2 = Math.sqrt(b.vx * b.vx + b.vy * b.vy) * 0.85;
          if (s2 < 70) s2 = 70;
          if (ev) ev.push({ t: 'warp', v: s2, x: b.x, y: b.y, ox: tn.ox, oy: tn.oy });
          b.x = tn.ox; b.y = tn.oy; b.vx = tn.dx * s2; b.vy = tn.dy * s2;
          break;
        }
      }
      var ux = w.cup.x - b.x, uy = w.cup.y - b.y, ud2 = ux * ux + uy * uy;
      var vs = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (ud2 < CAPTURE * CAPTURE && vs < CAPTURE_V) {
        if (ev) ev.push({ t: 'cup', v: vs, x: b.x, y: b.y });
        b.done = true; b.moving = false; b.sunkV = vs; b.vx = b.vy = 0;
        return;
      }
      if (ud2 < CUP_R * CUP_R && vs >= CAPTURE_V && !b.lipped) {
        // too fast: it rattles over the cup and loses some speed
        b.vx *= 0.72; b.vy *= 0.72; b.lipped = true;
        if (ev) ev.push({ t: 'lip', v: vs, x: b.x, y: b.y });
      }
      if (ud2 > CAPTURE * CAPTURE * 2) b.lipped = false;
      if (overWater(w, b.x, b.y)) {
        if (ev) ev.push({ t: 'splash', v: vs, x: b.x, y: b.y });
        b.x = b.lastX; b.y = b.lastY; b.vx = b.vy = 0; b.moving = false; b.slow = 0; b.splashed = true;
        return;
      }
    }
    keepIn(w, b, px, py, ev);
    sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp < REST_V) {
      if (++b.slow >= REST_STEPS) {
        b.vx = b.vy = 0; b.moving = false; b.slow = 0;
        if (ev) ev.push({ t: 'rest', x: b.x, y: b.y });
      }
    } else b.slow = 0;
  }

  // Safety net (the checker proves it never fires): a ball outside the
  // green goes back to where it was a moment ago.
  function keepIn(w, b, px, py, ev) {
    if (inFloor(w, b.x, b.y)) return;
    if (ev) ev.push({ t: 'escape', x: b.x, y: b.y });
    b.escapes = (b.escapes || 0) + 1;
    if (inFloor(w, px, py)) { b.x = px; b.y = py; b.vx *= -0.5; b.vy *= -0.5; }
    else { b.x = b.lastX; b.y = b.lastY; b.vx = b.vy = 0; b.moving = false; }
  }

  /* Where a putt would go first: a straight line from the ball that bends
     off walls, for the dotted aim line. Returns [[x, y], ...]. */
  function aimPath(w, x, y, dx, dy, len, bounces) {
    var l = Math.sqrt(dx * dx + dy * dy);
    if (!(l > 0)) return [[x, y]];
    dx /= l; dy /= l;
    var pts = [[x, y]], ghost = { x: x, y: y, vx: dx, vy: dy }, stepL = 0.8, went = 0, hits = 0;
    while (went < len) {
      ghost.x += ghost.vx * stepL; ghost.y += ghost.vy * stepL; went += stepL;
      var hit = false;
      for (var i = 0; i < w.segs.length; i++) {
        var s = w.segs[i];
        if (hitSeg(ghost, s.ax, s.ay, s.bx, s.by, s.r, 1, 0, 0, 0, 0, 0) > 0.01) hit = true;
      }
      for (var j = 0; j < w.circles.length; j++) {
        var c = w.circles[j], keep = c.kick; c.kick = 0;
        var e = c.e; c.e = 1;
        if (hitCircle(ghost, c) > 0.01) hit = true;
        c.kick = keep; c.e = e;
      }
      var sp = Math.sqrt(ghost.vx * ghost.vx + ghost.vy * ghost.vy);
      ghost.vx /= sp; ghost.vy /= sp;
      if (hit) { pts.push([ghost.x, ghost.y]); if (++hits > bounces) break; }
      if (overWater(w, ghost.x, ghost.y)) break;
    }
    pts.push([ghost.x, ghost.y]);
    return pts;
  }

  var Sim = {
    DT: DT, R: R, RAIL: RAIL, ARM_R: ARM_R, GATE_R: GATE_R, VMAX: VMAX, CUP_R: CUP_R, CAPTURE: CAPTURE,
    dsin: dsin, dcos: dcos, arc: arc, rect: rect, rrect: rrect, blob: blob, circlePoly: circlePoly,
    inPoly: inPoly, world: world, newBall: newBall, shoot: shoot, step: step, placeMovers: placeMovers,
    inFloor: inFloor, overWater: overWater, aimPath: aimPath
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  else root.GolfSim = Sim;
})(this);
